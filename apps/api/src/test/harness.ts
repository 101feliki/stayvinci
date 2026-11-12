import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  connect,
  guestProfile,
  membership,
  migrate,
  tenant,
  user,
  withContext,
  type Database,
} from '@stayvinci/db';
import { createApp } from '../app.js';
import { loadConfig, type Config } from '../config.js';
import { MemoryMailer } from '../notifications/mailer.js';
import { DisabledSms, MemorySms } from '../notifications/sms.js';
import { base32, hashPassword, totpAt } from '../security/crypto.js';

export interface Harness {
  app: NestExpressApplication;
  http: ReturnType<typeof request>;
  config: Config;
  database: Database;
  mailer: MemoryMailer;
  sms: MemorySms;
  ids: Record<'tenantA' | 'tenantB' | 'ownerA' | 'ownerB' | 'managerA' | 'deskA' | 'staff', string>;
  phones: Record<'ownerA' | 'ownerB' | 'managerA' | 'deskA' | 'guest' | 'staff', string>;
  close(): Promise<void>;
}

export const STAFF_EMAIL = 'staff@stayvinci.test';
export const STAFF_PASSWORD = 'correct horse battery staple';

/** A fresh API on an in-memory PostgreSQL (PGlite) with two Houses and their people. */
export async function createHarness(overrides: NodeJS.ProcessEnv = {}): Promise<Harness> {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'pglite://memory',
    JWT_SECRET: randomBytes(48).toString('base64url'),
    OTP_PEPPER: randomBytes(48).toString('base64url'),
    DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    CORS_ORIGINS: 'http://localhost:5173',
    DOCS_ENABLED: 'true',
    SMS_PROVIDER: 'memory',
    RATE_LIMIT: 'false',
    ...overrides,
  });
  const database = await connect(config.databaseUrl);
  await migrate(database.runner);

  const phones = {
    ownerA: '+254711000001',
    ownerB: '+254711000002',
    managerA: '+254711000003',
    deskA: '+254711000004',
    guest: '+254711000005',
    staff: '+254711000006',
  };
  const ids = await withContext(database.db, { role: 'sv_platform' }, async (tx) => {
    const values = (handle: string) => ({
      handle,
      name: `House ${handle}`,
      kind: 'house' as const,
      vertical: 'spa' as const,
      marketCode: 'KE',
      timezone: 'Africa/Nairobi',
      currency: 'KES',
      planCode: 'business',
      status: 'live' as const,
    });
    const [a] = await tx.insert(tenant).values(values('house-a')).returning();
    const [b] = await tx.insert(tenant).values(values('house-b')).returning();
    const mk = async (
      phone: string,
      name: string,
      extra: Partial<typeof user.$inferInsert> = {},
    ) => {
      const [u] = await tx
        .insert(user)
        .values({ phoneE164: phone, fullName: name, ...extra })
        .returning();
      if (!u) throw new Error('seed');
      return u.id;
    };
    const ownerA = await mk(phones.ownerA, 'Owner A', { email: 'owner.a@house.test' });
    const ownerB = await mk(phones.ownerB, 'Owner B');
    const managerA = await mk(phones.managerA, 'Manager A');
    const deskA = await mk(phones.deskA, 'Desk A');
    const guest = await mk(phones.guest, 'Wanjiku Guest', { email: 'guest@mail.test' });
    const staff = await mk(phones.staff, 'Staff', {
      email: STAFF_EMAIL,
      platformRole: 'super_admin',
      passwordHash: await hashPassword(STAFF_PASSWORD),
    });
    if (!a || !b) throw new Error('seed');
    await tx.insert(membership).values([
      { tenantId: a.id, userId: ownerA, role: 'owner', status: 'active' },
      { tenantId: b.id, userId: ownerB, role: 'owner', status: 'active' },
      { tenantId: a.id, userId: managerA, role: 'manager', status: 'active' },
      { tenantId: a.id, userId: deskA, role: 'front_desk', status: 'active' },
    ]);
    await tx.insert(guestProfile).values([
      { tenantId: a.id, userId: guest, firstTouchSource: 'own_channel', alias: 'W.' },
      { tenantId: b.id, userId: guest, firstTouchSource: 'marketplace' },
    ]);
    return { tenantA: a.id, tenantB: b.id, ownerA, ownerB, managerA, deskA, staff };
  });

  const mailer = new MemoryMailer();
  const sms = new MemorySms();
  // Set TEST_LOG=1 to see server-side errors while debugging tests.
  const app = await createApp(
    { config, database, mailer, sms: config.smsProvider === 'off' ? new DisabledSms() : sms },
    process.env.TEST_LOG ? undefined : false,
  );
  await app.init();
  return {
    app,
    http: request(app.getHttpServer()),
    config,
    database,
    mailer,
    sms,
    ids,
    phones,
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}

/** The last SMS code sent to a phone. */
export function lastCode(h: Harness, phone: string): string {
  const msg = [...h.sms.sent].reverse().find((m) => m.to === phone);
  const code = msg?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`No code sent to ${phone}`);
  return code;
}

/** Current TOTP code for a base32 secret. */
export function totpNow(secretB32: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of secretB32) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return totpAt(Buffer.from(out), Math.floor(Date.now() / 30_000));
}

export { base32 };

interface TokenBody {
  access_token: string;
  refresh_token: string;
  second_factor: string;
}

/** Signs in with an SMS code; owners also set up and complete two-step verification. */
export async function signIn(
  h: Harness,
  phone: string,
  audience: 'guest' | 'business' | 'console' = 'business',
): Promise<TokenBody> {
  await h.http.post('/v1/auth/otp/request').send({ phone }).expect(202);
  const res = await h.http
    .post('/v1/auth/otp/verify')
    .send({ phone, code: lastCode(h, phone), audience })
    .expect(200);
  let tokens = res.body as TokenBody;
  if (tokens.second_factor === 'setup_required') {
    const setup = await h.http
      .post('/v1/auth/totp/setup')
      .set('Authorization', `Bearer ${tokens.access_token}`)
      .expect(200);
    const enabled = await h.http
      .post('/v1/auth/totp/enable')
      .set('Authorization', `Bearer ${tokens.access_token}`)
      .send({ code: totpNow((setup.body as { secret: string }).secret) })
      .expect(200);
    tokens = enabled.body as TokenBody;
  }
  return tokens;
}

export const bearer = (t: { access_token: string }) => ({
  Authorization: `Bearer ${t.access_token}`,
});
