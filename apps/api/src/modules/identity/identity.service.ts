import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { emailToken, membership, otpChallenge, session, user, type Tx } from '@stayvinci/db';
import type { PlatformRole } from '@stayvinci/types';
import type { Config } from '../../config.js';
import { AppError, CONFIG, Errors, MAILER, SMS } from '../../common/http.js';
import { Data, audit } from '../../database.js';
import { templates, type Mailer } from '../../notifications/mailer.js';
import type { Sms } from '../../notifications/sms.js';
import {
  base32,
  decrypt,
  encrypt,
  hashPassword,
  hmac,
  randomToken,
  safeEqual,
  sha256,
  sixDigits,
  verifyPassword,
  verifyTotp,
} from '../../security/crypto.js';
import { signAccessToken } from '../../security/tokens.js';
import { randomBytes } from 'node:crypto';

type Audience = 'guest' | 'business' | 'console';
type UserRow = typeof user.$inferSelect;

const OTP_TTL_SECONDS = 300;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_10_MIN = 3;
const EMAIL_TTL_MINUTES = { verify_email: 24 * 60, magic_link: 15, password_reset: 30 } as const;

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  second_factor: 'not_required' | 'required' | 'setup_required' | 'completed';
}

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
  requestId: string;
}

const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

/**
 * Sign-in, sessions and two-step verification (spec §7, §18; P0 task 5).
 * Every lookup that could reveal whether an account exists returns the same answer either way.
 */
@Injectable()
export class IdentityService {
  constructor(
    @Inject(Data) private readonly data: Data,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(SMS) private readonly sms: Sms,
  ) {}

  /* ---------- Phone + SMS code ---------- */

  private smsOff() {
    if ('disabled' in this.sms && this.sms.disabled)
      throw Errors.unavailable(
        'sms_sign_in_off',
        'Sign-in by SMS is not available. Use email instead.',
      );
  }

  async requestOtp(phone: string): Promise<{ sent: true; expires_in_seconds: number }> {
    this.smsOff();
    const code = sixDigits();
    await this.data.identity(async (tx) => {
      const [recent] = await tx
        .select({ n: count() })
        .from(otpChallenge)
        .where(
          and(
            eq(otpChallenge.phoneE164, phone),
            gt(otpChallenge.createdAt, sql`now() - interval '10 minutes'` as never),
          ),
        );
      if ((recent?.n ?? 0) >= OTP_MAX_PER_10_MIN) throw Errors.tooMany();
      await tx.insert(otpChallenge).values({
        phoneE164: phone,
        codeHmac: hmac(this.config.otpPepper, `${phone}:${code}`),
        purpose: 'sign_in',
        expiresAt: minutesFromNow(OTP_TTL_SECONDS / 60),
      });
    });
    // Neutral text: no House or service names on a lock screen (rule 5).
    await this.sms.send(
      phone,
      `Your Stayvinci code is ${code}. It expires in 5 minutes. Never share it.`,
    );
    return { sent: true, expires_in_seconds: OTP_TTL_SECONDS };
  }

  async verifyOtp(
    phone: string,
    code: string,
    audience: Audience,
    client: ClientInfo,
  ): Promise<Tokens> {
    this.smsOff();
    const person = await this.data.identity(async (tx) => {
      const [challenge] = await tx
        .select()
        .from(otpChallenge)
        .where(
          and(
            eq(otpChallenge.phoneE164, phone),
            isNull(otpChallenge.consumedAt),
            gt(otpChallenge.expiresAt, sql`now()` as never),
          ),
        )
        .orderBy(desc(otpChallenge.createdAt))
        .limit(1);
      const wrong = Errors.invalid("That code isn't right or has expired. Request a new one.");
      if (!challenge) throw wrong;
      if (challenge.attempts >= OTP_MAX_ATTEMPTS) throw Errors.tooMany();
      const ok = safeEqual(
        Buffer.from(challenge.codeHmac),
        hmac(this.config.otpPepper, `${phone}:${code}`),
      );
      await tx
        .update(otpChallenge)
        .set(ok ? { consumedAt: sql`now()` as never } : { attempts: challenge.attempts + 1 })
        .where(eq(otpChallenge.id, challenge.id));
      if (!ok) return null;
      const [existing] = await tx.select().from(user).where(eq(user.phoneE164, phone));
      if (existing) return existing;
      if (audience === 'console') return null; // staff accounts are never created by sign-in
      const [created] = await tx.insert(user).values({ phoneE164: phone }).returning();
      return created ?? null;
    });
    if (!person) throw Errors.invalid("That code isn't right or has expired. Request a new one.");
    return this.startSession(person, audience, client, 'phone_code');
  }

  /* ---------- Email links: activation, magic link, password reset ---------- */

  private appUrl(audience: Audience) {
    return audience === 'guest'
      ? this.config.appUrls.guest
      : audience === 'business'
        ? this.config.appUrls.business
        : this.config.appUrls.console;
  }

  private async createEmailToken(
    tx: Tx,
    userId: string,
    purpose: keyof typeof EMAIL_TTL_MINUTES,
  ): Promise<string> {
    const token = randomToken(32);
    // One live link per purpose: older ones stop working.
    await tx
      .update(emailToken)
      .set({ consumedAt: sql`now()` as never })
      .where(
        and(
          eq(emailToken.userId, userId),
          eq(emailToken.purpose, purpose),
          isNull(emailToken.consumedAt),
        ),
      );
    await tx.insert(emailToken).values({
      userId,
      purpose,
      tokenHash: sha256(token),
      expiresAt: minutesFromNow(EMAIL_TTL_MINUTES[purpose]),
    });
    return token;
  }

  private async consumeEmailToken(tx: Tx, token: string, purpose: keyof typeof EMAIL_TTL_MINUTES) {
    const [row] = await tx
      .update(emailToken)
      .set({ consumedAt: sql`now()` as never })
      .where(
        and(
          eq(emailToken.tokenHash, sha256(token)),
          eq(emailToken.purpose, purpose),
          isNull(emailToken.consumedAt),
          gt(emailToken.expiresAt, sql`now()` as never),
        ),
      )
      .returning({ userId: emailToken.userId });
    if (!row) throw Errors.invalid('This link has expired or was already used. Request a new one.');
    return row.userId;
  }

  async requestMagicLink(email: string, audience: Audience): Promise<void> {
    const found = await this.data.identity(async (tx) => {
      let [u] = await tx.select().from(user).where(eq(user.email, email));
      // Guests sign up by email (SMS sign-in is on hold): the first link creates the account,
      // and opening it verifies the address. The response is the same either way.
      if (!u && audience === 'guest') [u] = await tx.insert(user).values({ email }).returning();
      if (!u || u.status !== 'active' || (audience === 'console' && !u.platformRole)) return null;
      return { token: await this.createEmailToken(tx, u.id, 'magic_link') };
    });
    if (found) {
      const url = `${this.appUrl(audience)}/auth/magic?token=${found.token}`;
      await this.mailer.send(templates.magicLink(email, url));
    }
  }

  async verifyMagicLink(token: string, audience: Audience, client: ClientInfo): Promise<Tokens> {
    const person = await this.data.identity(async (tx) => {
      const userId = await this.consumeEmailToken(tx, token, 'magic_link');
      // Opening the link proves the inbox is theirs.
      const [u] = await tx
        .update(user)
        .set({ emailVerifiedAt: sql`coalesce(email_verified_at, now())` as never })
        .where(eq(user.id, userId))
        .returning();
      return u;
    });
    if (!person || (audience === 'console' && !person.platformRole))
      throw Errors.invalid('This link has expired or was already used. Request a new one.');
    return this.startSession(person, audience, client, 'magic_link');
  }

  async sendEmailVerification(userId: string): Promise<void> {
    const result = await this.data.identity(async (tx) => {
      const [u] = await tx.select().from(user).where(eq(user.id, userId));
      if (!u?.email) throw Errors.badRequest('no_email', 'Add an email address first.');
      if (u.emailVerifiedAt) return null;
      return { email: u.email, token: await this.createEmailToken(tx, u.id, 'verify_email') };
    });
    if (result)
      await this.mailer.send(
        templates.verifyEmail(
          result.email,
          `${this.config.appUrls.business}/auth/verify-email?token=${result.token}`,
        ),
      );
  }

  async verifyEmail(token: string): Promise<void> {
    await this.data.identity(async (tx) => {
      const userId = await this.consumeEmailToken(tx, token, 'verify_email');
      await tx
        .update(user)
        .set({ emailVerifiedAt: sql`now()` as never })
        .where(eq(user.id, userId));
      await audit(tx, {
        tenantId: null,
        actorUserId: userId,
        actorLabel: 'self',
        action: 'user.email_verified',
      });
    });
  }

  /* ---------- Password (staff console, and owners who choose one) ---------- */

  async passwordLogin(email: string, password: string, client: ClientInfo): Promise<Tokens> {
    const [u] = await this.data.identity((tx) =>
      tx
        .select()
        .from(user)
        .where(and(eq(user.email, email), eq(user.status, 'active'))),
    );
    const ok = await verifyPassword(password, u?.passwordHash ?? null);
    if (!u || !ok)
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        'invalid_credentials',
        'Email or password is incorrect.',
      );
    return this.startSession(u, u.platformRole ? 'console' : 'business', client, 'password');
  }

  async forgotPassword(email: string): Promise<void> {
    const found = await this.data.identity(async (tx) => {
      const [u] = await tx
        .select()
        .from(user)
        .where(and(eq(user.email, email), eq(user.status, 'active')));
      if (!u) return null;
      return {
        token: await this.createEmailToken(tx, u.id, 'password_reset'),
        console: !!u.platformRole,
      };
    });
    if (found) {
      const base = found.console ? this.config.appUrls.console : this.config.appUrls.business;
      await this.mailer.send(
        templates.passwordReset(email, `${base}/auth/reset-password?token=${found.token}`),
      );
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const hash = await hashPassword(password);
    await this.data.identity(async (tx) => {
      const userId = await this.consumeEmailToken(tx, token, 'password_reset');
      await tx.update(user).set({ passwordHash: hash }).where(eq(user.id, userId));
      // A password change signs the person out everywhere (spec §18).
      await tx
        .update(session)
        .set({ revokedAt: sql`now()` as never })
        .where(and(eq(session.userId, userId), isNull(session.revokedAt)));
      await audit(tx, {
        tenantId: null,
        actorUserId: userId,
        actorLabel: 'self',
        action: 'user.password_reset',
      });
    });
  }

  /* ---------- Two-step verification (TOTP) ---------- */

  async totpSetup(userId: string): Promise<{ otpauth_url: string; secret: string }> {
    const secret = randomBytes(20);
    const label = await this.data.identity(async (tx) => {
      const [u] = await tx.select().from(user).where(eq(user.id, userId));
      if (!u) throw Errors.unauthorized();
      if (u.totpEnabledAt) throw Errors.conflict('Two-step verification is already on.');
      await tx
        .update(user)
        .set({ totpSecretEnc: encrypt(this.config.dataKey, secret) })
        .where(eq(user.id, userId));
      return u.email ?? `${u.phoneE164?.slice(0, 5)}•••${u.phoneE164?.slice(-3)}`;
    });
    const b32 = base32(secret);
    return {
      secret: b32,
      otpauth_url: `otpauth://totp/Stayvinci:${encodeURIComponent(label)}?secret=${b32}&issuer=Stayvinci&digits=6&period=30`,
    };
  }

  /** Confirms setup with a first code, turns 2FA on and upgrades the current session. */
  async totpEnable(
    userId: string,
    sessionId: string,
    code: string,
    audience: Audience,
  ): Promise<Tokens> {
    await this.data.identity(async (tx) => {
      const [u] = await tx.select().from(user).where(eq(user.id, userId));
      if (!u?.totpSecretEnc) throw Errors.badRequest('totp_not_started', 'Start setup first.');
      if (u.totpEnabledAt) throw Errors.conflict('Two-step verification is already on.');
      if (!verifyTotp(decrypt(this.config.dataKey, Buffer.from(u.totpSecretEnc)), code))
        throw Errors.invalid("That code isn't right.");
      await tx
        .update(user)
        .set({ totpEnabledAt: sql`now()` as never })
        .where(eq(user.id, userId));
      await audit(tx, {
        tenantId: null,
        actorUserId: userId,
        actorLabel: 'self',
        action: 'user.two_factor_enabled',
      });
    });
    return this.completeSecondFactor(userId, sessionId, audience);
  }

  /** The second step at sign-in. */
  async totpVerify(
    userId: string,
    sessionId: string,
    code: string,
    audience: Audience,
  ): Promise<Tokens> {
    const [u] = await this.data.identity((tx) => tx.select().from(user).where(eq(user.id, userId)));
    if (!u?.totpEnabledAt || !u.totpSecretEnc)
      throw Errors.badRequest('totp_not_enabled', 'Two-step verification is not on.');
    if (!verifyTotp(decrypt(this.config.dataKey, Buffer.from(u.totpSecretEnc)), code))
      throw Errors.invalid("That code isn't right.");
    return this.completeSecondFactor(userId, sessionId, audience);
  }

  private async completeSecondFactor(
    userId: string,
    sessionId: string,
    audience: Audience,
  ): Promise<Tokens> {
    const refresh = randomToken(32);
    const row = await this.data.identity(async (tx) => {
      const [s] = await tx
        .update(session)
        .set({
          secondFactorAt: sql`now()` as never,
          refreshHash: sha256(refresh),
          lastUsedAt: sql`now()` as never,
        })
        .where(
          and(eq(session.id, sessionId), eq(session.userId, userId), isNull(session.revokedAt)),
        )
        .returning();
      const [u] = await tx.select().from(user).where(eq(user.id, userId));
      return s && u ? { s, u } : null;
    });
    if (!row) throw Errors.unauthorized();
    return this.tokens(row.u, row.s.id, audience, refresh, 'completed', true);
  }

  /* ---------- Sessions ---------- */

  private async startSession(
    u: UserRow,
    audience: Audience,
    client: ClientInfo,
    method: string,
  ): Promise<Tokens> {
    if (u.status !== 'active') throw Errors.forbidden('This account is locked. Contact support.');
    if (audience === 'console' && !u.platformRole)
      throw Errors.invalid("That code isn't right or has expired. Request a new one.");
    const isOwner =
      audience === 'business' &&
      (
        await this.data.asUser(
          { userId: u.id, sessionId: '', audience, secondFactor: false, platformRole: null },
          (tx) =>
            tx
              .select({ id: membership.id })
              .from(membership)
              .where(
                and(
                  eq(membership.userId, u.id),
                  eq(membership.role, 'owner'),
                  eq(membership.status, 'active'),
                ),
              ),
        )
      ).length > 0;
    const needs2fa = audience === 'console' || isOwner || !!u.totpEnabledAt;
    const status: Tokens['second_factor'] = !needs2fa
      ? 'not_required'
      : u.totpEnabledAt
        ? 'required'
        : 'setup_required';
    const refresh = randomToken(32);
    const s = await this.data.identity(async (tx) => {
      const [row] = await tx
        .insert(session)
        .values({
          userId: u.id,
          refreshHash: sha256(refresh),
          audience,
          secondFactorAt: needs2fa ? null : (sql`now()` as never),
          userAgent: client.userAgent?.slice(0, 200) ?? null,
          ip: client.ip,
          expiresAt: new Date(Date.now() + this.config.refreshTtlDays * 86_400_000).toISOString(),
        })
        .returning();
      await audit(tx, {
        tenantId: null,
        actorUserId: u.id,
        actorLabel: 'self',
        action: 'session.started',
        after: { audience, method },
        ip: client.ip,
        requestId: client.requestId,
      });
      return row;
    });
    if (!s) throw Errors.unauthorized();
    return this.tokens(u, s.id, audience, refresh, status, !needs2fa);
  }

  async refresh(refreshToken: string): Promise<Tokens> {
    const next = randomToken(32);
    const row = await this.data.identity(async (tx) => {
      // Rotation: the old refresh token stops working the moment a new one is issued.
      const [s] = await tx
        .update(session)
        .set({ refreshHash: sha256(next), lastUsedAt: sql`now()` as never })
        .where(
          and(
            eq(session.refreshHash, sha256(refreshToken)),
            isNull(session.revokedAt),
            gt(session.expiresAt, sql`now()` as never),
          ),
        )
        .returning();
      if (!s) return null;
      const [u] = await tx.select().from(user).where(eq(user.id, s.userId));
      return u && u.status === 'active' ? { s, u } : null;
    });
    if (!row) throw Errors.unauthorized('Your session has ended. Sign in again.');
    const done = !!row.s.secondFactorAt;
    return this.tokens(
      row.u,
      row.s.id,
      row.s.audience,
      next,
      done ? 'completed' : row.u.totpEnabledAt ? 'required' : 'setup_required',
      done,
    );
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.data.identity((tx) =>
      tx
        .update(session)
        .set({ revokedAt: sql`now()` as never })
        .where(and(eq(session.id, sessionId), eq(session.userId, userId))),
    );
  }

  /** Ends every session of a person (role change, suspension, password reset). */
  async revokeAll(userId: string): Promise<void> {
    await this.data.identity((tx) =>
      tx
        .update(session)
        .set({ revokedAt: sql`now()` as never })
        .where(and(eq(session.userId, userId), isNull(session.revokedAt))),
    );
  }

  private async tokens(
    u: UserRow,
    sessionId: string,
    audience: Audience,
    refresh: string,
    secondFactor: Tokens['second_factor'],
    mfa: boolean,
  ): Promise<Tokens> {
    const access = await signAccessToken(this.config.jwtSecret, this.config.accessTtl, {
      userId: u.id,
      sessionId,
      audience,
      secondFactor: mfa,
      platformRole:
        audience === 'console' ? ((u.platformRole as PlatformRole | null) ?? null) : null,
    });
    return {
      access_token: access,
      refresh_token: refresh,
      token_type: 'Bearer',
      expires_in: this.config.accessTtl,
      second_factor: secondFactor,
    };
  }
}
