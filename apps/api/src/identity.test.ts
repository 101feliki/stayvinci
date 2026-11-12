import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  STAFF_EMAIL,
  STAFF_PASSWORD,
  bearer,
  createHarness,
  lastCode,
  signIn,
  totpNow,
  type Harness,
} from './test/harness.js';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h.close();
});

describe('phone sign-in', () => {
  it('signs a guest in and creates their account on first use', async () => {
    const phone = '+254722000001';
    await h.http.post('/v1/auth/otp/request').send({ phone }).expect(202);
    const res = await h.http
      .post('/v1/auth/otp/verify')
      .send({ phone, code: lastCode(h, phone), audience: 'guest' })
      .expect(200);
    expect(res.body.second_factor).toBe('not_required');
    const me = await h.http.get('/v1/me').set(bearer(res.body)).expect(200);
    expect(me.body.phone).toBe(phone);
  });

  it('rejects a wrong code without saying why', async () => {
    const phone = '+254722000002';
    await h.http.post('/v1/auth/otp/request').send({ phone }).expect(202);
    const res = await h.http
      .post('/v1/auth/otp/verify')
      .send({ phone, code: '000000', audience: 'guest' })
      .expect(422);
    expect(res.body.error.code).toBe('validation_failed');
  });

  it('limits how many codes a number can request', async () => {
    const phone = '+254722000003';
    for (let i = 0; i < 3; i++)
      await h.http.post('/v1/auth/otp/request').send({ phone }).expect(202);
    const res = await h.http.post('/v1/auth/otp/request').send({ phone }).expect(429);
    expect(res.body.error.code).toBe('rate_limited');
  });

  it('never stores or returns the code itself', async () => {
    const rows = await h.database.runner.query<{ n: number }>(
      `select count(*)::int as n from otp_challenge where encode(code_hmac, 'escape') ~ '^[0-9]{6}$'`,
    );
    expect(rows[0]?.n ?? 0).toBe(0);
  });

  it('makes owners set up two-step verification before entering their House', async () => {
    const phone = h.phones.ownerA;
    await h.http.post('/v1/auth/otp/request').send({ phone }).expect(202);
    const res = await h.http
      .post('/v1/auth/otp/verify')
      .send({ phone, code: lastCode(h, phone), audience: 'business' })
      .expect(200);
    expect(res.body.second_factor).toBe('setup_required');
    const blocked = await h.http
      .get(`/v1/tenants/${h.ids.tenantA}`)
      .set(bearer(res.body))
      .expect(403);
    expect(blocked.body.error.code).toBe('second_factor_required');
  });
});

describe('sessions', () => {
  it('rotates refresh tokens and rejects the old one', async () => {
    const t = await signIn(h, '+254722000010', 'guest');
    const next = await h.http
      .post('/v1/auth/refresh')
      .send({ refresh_token: t.refresh_token })
      .expect(200);
    expect(next.body.refresh_token).not.toBe(t.refresh_token);
    await h.http.post('/v1/auth/refresh').send({ refresh_token: t.refresh_token }).expect(401);
  });

  it('ends the session on logout, immediately', async () => {
    const t = await signIn(h, '+254722000011', 'guest');
    await h.http.post('/v1/auth/logout').set(bearer(t)).expect(204);
    await h.http.get('/v1/me').set(bearer(t)).expect(401);
  });

  it('rejects tampered tokens', async () => {
    const t = await signIn(h, '+254722000012', 'guest');
    const forged = `${t.access_token.slice(0, -4)}AAAA`;
    await h.http.get('/v1/me').set('Authorization', `Bearer ${forged}`).expect(401);
  });
});

describe('email: magic links, activation, password reset (Nodemailer adapter)', () => {
  it('signs in with a magic link and verifies the email', async () => {
    await h.http
      .post('/v1/auth/magic-link')
      .send({ email: 'guest@mail.test', audience: 'guest' })
      .expect(202);
    const mail = h.mailer.sent.at(-1);
    expect(mail?.subject).toBe('Your sign-in link');
    const token = mail?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? '';
    const res = await h.http
      .post('/v1/auth/magic-link/verify')
      .send({ token, audience: 'guest' })
      .expect(200);
    const me = await h.http.get('/v1/me').set(bearer(res.body)).expect(200);
    expect(me.body.email_verified).toBe(true);
    // Links work once.
    await h.http.post('/v1/auth/magic-link/verify').send({ token, audience: 'guest' }).expect(422);
  });

  it('answers the same for unknown emails (no account enumeration)', async () => {
    const before = h.mailer.sent.length;
    for (const audience of ['business', 'console']) {
      const res = await h.http
        .post('/v1/auth/magic-link')
        .send({ email: 'nobody@nowhere.test', audience })
        .expect(202);
      expect(res.body).toEqual({ accepted: true });
    }
    expect(h.mailer.sent.length).toBe(before);
  });

  it('lets a new guest sign up by email link', async () => {
    await h.http
      .post('/v1/auth/magic-link')
      .send({ email: 'new.guest@mail.test', audience: 'guest' })
      .expect(202);
    const token = h.mailer.sent.at(-1)?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? '';
    const res = await h.http
      .post('/v1/auth/magic-link/verify')
      .send({ token, audience: 'guest' })
      .expect(200);
    const me = await h.http.get('/v1/me').set(bearer(res.body)).expect(200);
    expect(me.body).toMatchObject({ email: 'new.guest@mail.test', email_verified: true });
  });

  it('keeps email subjects neutral', () => {
    for (const m of h.mailer.sent) expect(m.subject).not.toMatch(/house|spa|massage/i);
  });

  it('resets a password and signs out other sessions', async () => {
    const login = await h.http
      .post('/v1/auth/password/login')
      .send({ email: STAFF_EMAIL, password: STAFF_PASSWORD })
      .expect(200);
    await h.http.post('/v1/auth/password/forgot').send({ email: STAFF_EMAIL }).expect(202);
    const token = h.mailer.sent.at(-1)?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? '';
    await h.http
      .post('/v1/auth/password/reset')
      .send({ token, password: 'a brand new long password' })
      .expect(204);
    await h.http.get('/v1/me').set(bearer(login.body)).expect(401);
    await h.http
      .post('/v1/auth/password/login')
      .send({ email: STAFF_EMAIL, password: STAFF_PASSWORD })
      .expect(401);
    await h.http
      .post('/v1/auth/password/login')
      .send({ email: STAFF_EMAIL, password: 'a brand new long password' })
      .expect(200);
  });

  it('sends an activation email', async () => {
    const t = await signIn(h, h.phones.ownerA);
    await h.http.post('/v1/auth/email/verification').set(bearer(t)).expect(202);
    const mail = h.mailer.sent.at(-1);
    expect(mail?.subject).toBe('Confirm your email');
    const token = mail?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? '';
    await h.http.post('/v1/auth/email/verify').send({ token }).expect(204);
  });
});

describe('two-step verification', () => {
  it('requires a TOTP code after password sign-in for staff', async () => {
    const res = await h.http
      .post('/v1/auth/password/login')
      .send({ email: STAFF_EMAIL, password: 'a brand new long password' })
      .expect(200);
    expect(res.body.second_factor).toBe('setup_required');
    await h.http.get('/v1/platform/tenants').set(bearer(res.body)).expect(403);
    const setup = await h.http.post('/v1/auth/totp/setup').set(bearer(res.body)).expect(200);
    const done = await h.http
      .post('/v1/auth/totp/enable')
      .set(bearer(res.body))
      .send({ code: totpNow(setup.body.secret) })
      .expect(200);
    expect(done.body.second_factor).toBe('completed');
    await h.http.get('/v1/platform/tenants').set(bearer(done.body)).expect(200);
  });
});

describe('SMS sign-in switched off (SMS_PROVIDER=off)', () => {
  it('answers 503 on the SMS endpoints while email sign-in still works', async () => {
    const off = await createHarness({ SMS_PROVIDER: 'off' });
    try {
      const phone = '+254722000099';
      const req = await off.http.post('/v1/auth/otp/request').send({ phone }).expect(503);
      expect(req.body.error.code).toBe('sms_sign_in_off');
      await off.http
        .post('/v1/auth/otp/verify')
        .send({ phone, code: '123456', audience: 'guest' })
        .expect(503);
      await off.http
        .post('/v1/auth/password/login')
        .send({ email: STAFF_EMAIL, password: STAFF_PASSWORD })
        .expect(200);
    } finally {
      await off.close();
    }
  });
});
