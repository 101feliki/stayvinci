import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildOpenApi } from './app.js';
import { bearer, createHarness, signIn, type Harness } from './test/harness.js';

let h: Harness;
let ownerA: { access_token: string };
let managerA: { access_token: string };
let deskA: { access_token: string };
let paths: [string, string][]; // [method, path]

beforeAll(async () => {
  h = await createHarness();
  ownerA = await signIn(h, h.phones.ownerA);
  managerA = await signIn(h, h.phones.managerA);
  deskA = await signIn(h, h.phones.deskA);
  const doc = buildOpenApi(h.app, h.config);
  paths = Object.entries(doc.paths).flatMap(([p, ops]) =>
    Object.keys(ops as object)
      .filter((m) => ['get', 'post', 'patch', 'delete', 'put'].includes(m))
      .map((m) => [m, p] as [string, string]),
  );
});
afterAll(async () => {
  await h.close();
});

type Method = 'get' | 'post' | 'patch' | 'delete' | 'put';
/** Calls any route by method name (used to sweep every route in the OpenAPI document). */
const call = (method: string, path: string) => h.http[method as Method](path);

const fill = (path: string, tenantId: string) =>
  path
    .replace('{tenantId}', tenantId)
    .replace(/\{[a-zA-Z]+\}/g, '00000000-0000-4000-8000-000000000000');

describe('every route is protected', () => {
  it('finds the routes from the OpenAPI document', () => {
    expect(paths.length).toBeGreaterThan(20);
  });

  it('refuses every non-public route without a token', async () => {
    const PUBLIC =
      /^\/health|^\/v1\/auth\/(otp|magic-link|password|refresh|email\/verify$)|^\/v1\/stores(\/enter|\/\{handle\}(\/availability)?)?$/;
    for (const [method, path] of paths) {
      if (PUBLIC.test(path)) continue;
      const res = await call(method, fill(path, h.ids.tenantA)).send({});
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });
});

describe('cross-tenant harness (P0 task 8)', () => {
  it("never lets House A's owner touch House B, on any House route", async () => {
    const tenantRoutes = paths.filter(([, p]) => p.includes('{tenantId}'));
    expect(tenantRoutes.length).toBeGreaterThan(5);
    for (const [method, path] of tenantRoutes) {
      const res = await call(method, fill(path, h.ids.tenantB))
        .set(bearer(ownerA))
        .set('Idempotency-Key', `cross-tenant-${method}-${path.length}`)
        .send({ name: 'Hacked', role: 'manager', full_name: 'X Y', phone: '+254799999999' });
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(404);
      expect(res.body.error?.code).toBe('not_found');
    }
  });

  it('treats a made-up House id exactly like one you cannot see', async () => {
    const res = await h.http
      .get('/v1/tenants/00000000-0000-4000-8000-000000000000')
      .set(bearer(ownerA))
      .expect(404);
    expect(res.body.error.code).toBe('not_found');
  });
});

describe('roles and capabilities', () => {
  it('lets the owner manage the team but not the front desk', async () => {
    await h.http.get(`/v1/tenants/${h.ids.tenantA}/members`).set(bearer(ownerA)).expect(200);
    const res = await h.http
      .get(`/v1/tenants/${h.ids.tenantA}/members`)
      .set(bearer(deskA))
      .expect(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('omits guest phone and email unless the caller has guest.contact.view (rule 5)', async () => {
    const owner = await h.http
      .get(`/v1/tenants/${h.ids.tenantA}/guests`)
      .set(bearer(ownerA))
      .expect(200);
    expect(owner.body.items[0]).toHaveProperty('phone');
    expect(owner.body.items[0]).toHaveProperty('email');
    const manager = await h.http
      .get(`/v1/tenants/${h.ids.tenantA}/guests`)
      .set(bearer(managerA))
      .expect(200);
    expect(manager.body.items[0]).not.toHaveProperty('phone');
    expect(manager.body.items[0]).not.toHaveProperty('email');
    expect(JSON.stringify(manager.body)).not.toContain(h.phones.guest);
  });

  it('shows only this House’s guests', async () => {
    const res = await h.http
      .get(`/v1/tenants/${h.ids.tenantA}/guests`)
      .set(bearer(ownerA))
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].first_touch_source).toBe('own_channel');
  });

  it('hides staff routes from everyone else (404, not 403)', async () => {
    await h.http.get('/v1/platform/tenants').set(bearer(ownerA)).expect(404);
  });

  it('stops a manager from removing the last owner', async () => {
    const team = await h.http
      .get(`/v1/tenants/${h.ids.tenantA}/members`)
      .set(bearer(ownerA))
      .expect(200);
    const owner = (team.body as { id: string; role: string }[]).find((m) => m.role === 'owner');
    const res = await h.http
      .patch(`/v1/tenants/${h.ids.tenantA}/members/${owner?.id}`)
      .set(bearer(managerA))
      .send({ role: 'manager' })
      .expect(403);
    expect(res.body.error.code).toBe('forbidden');
  });
});

describe('idempotency (rule 4)', () => {
  const invite = { full_name: 'New Therapist', phone: '+254733000001', role: 'practitioner' };

  it('requires an Idempotency-Key', async () => {
    const res = await h.http
      .post(`/v1/tenants/${h.ids.tenantA}/members`)
      .set(bearer(ownerA))
      .send(invite)
      .expect(400);
    expect(res.body.error.code).toBe('idempotency_key_required');
  });

  it('replays the first response for a retry', async () => {
    const key = 'invite-new-therapist-0001';
    const first = await h.http
      .post(`/v1/tenants/${h.ids.tenantA}/members`)
      .set(bearer(ownerA))
      .set('Idempotency-Key', key)
      .send(invite)
      .expect(201);
    const retry = await h.http
      .post(`/v1/tenants/${h.ids.tenantA}/members`)
      .set(bearer(ownerA))
      .set('Idempotency-Key', key)
      .send(invite)
      .expect(201);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(retry.body.id).toBe(first.body.id);
  });

  it('refuses the same key for a different request', async () => {
    const res = await h.http
      .post(`/v1/tenants/${h.ids.tenantA}/members`)
      .set(bearer(ownerA))
      .set('Idempotency-Key', 'invite-new-therapist-0001')
      .send({ ...invite, phone: '+254733000002' })
      .expect(422);
    expect(res.body.error.code).toBe('idempotency_key_reused');
  });
});

describe('nothing leaks', () => {
  it('sends strict security headers and no framework banner', async () => {
    const res = await h.http.get('/health/live').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('does not grant CORS to unknown websites', async () => {
    const res = await h.http.get('/health/live').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    const ok = await h.http.get('/health/live').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('answers unknown routes and bad JSON with the standard error shape only', async () => {
    const missing = await h.http.get('/v1/does-not-exist').expect(404);
    expect(missing.body).toEqual({
      error: { code: 'not_found', message: 'Not found.', request_id: expect.any(String) },
    });
    const bad = await h.http
      .post('/v1/auth/otp/request')
      .set('Content-Type', 'application/json')
      .send('{"phone":')
      .expect(400);
    expect(bad.body.error.code).toBe('invalid_json');
    expect(JSON.stringify(bad.body)).not.toMatch(/stack|node_modules|at \w+ \(/);
  });

  it('refuses oversized bodies', async () => {
    const res = await h.http
      .post('/v1/auth/otp/request')
      .send({ phone: 'x'.repeat(200_000) })
      .expect(413);
    expect(res.body.error.code).toBe('payload_too_large');
  });

  it('documents every route and every error shape', async () => {
    const doc = await h.http.get('/docs/openapi.json').expect(200);
    expect(doc.body.components.schemas).toHaveProperty('Error');
    expect(doc.body.components.securitySchemes).toHaveProperty('access-token');
    expect(Object.keys(doc.body.paths)).toContain('/v1/tenants/{tenantId}/guests');
    // Every $ref points at a component that exists (no broken models in the docs).
    const refs = [...JSON.stringify(doc.body).matchAll(/"\$ref":"([^"]+)"/g)].map(
      (m) => m[1] ?? '',
    );
    for (const ref of refs) {
      expect(ref, ref).toMatch(/^#\/components\/schemas\//);
      expect(doc.body.components.schemas, ref).toHaveProperty(ref.split('/').pop() ?? '');
    }
  });
});

describe('production safety', () => {
  it('protects the docs with basic auth when credentials are set', async () => {
    const locked = await createHarness({
      DOCS_USER: 'docs',
      DOCS_PASSWORD: 'a-long-docs-password-123',
    });
    try {
      await locked.http.get('/docs/openapi.json').expect(401);
      await locked.http
        .get('/docs/openapi.json')
        .auth('docs', 'a-long-docs-password-123')
        .expect(200);
    } finally {
      await locked.close();
    }
  });

  it('hides the docs entirely when turned off', async () => {
    const off = await createHarness({ DOCS_ENABLED: 'false' });
    try {
      await off.http.get('/docs/openapi.json').expect(404);
    } finally {
      await off.close();
    }
  });

  it('rate-limits sign-in attempts per IP', async () => {
    const limited = await createHarness({ RATE_LIMIT: 'true' });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++)
        statuses.push(
          (
            await limited.http
              .post('/v1/auth/magic-link')
              .send({ email: `x${i}@y.test`, audience: 'guest' })
          ).status,
        );
      expect(statuses.slice(0, 10).every((s) => s === 202)).toBe(true);
      expect(statuses.at(-1)).toBe(429);
    } finally {
      await limited.close();
    }
  });
});
