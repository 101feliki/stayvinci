// The guest journey end to end: a House sets up its store, a guest finds it, sees free
// times, books, cancels, comes back, and reviews; plus discretion and no double bookings.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { tenant, withContext } from '@stayvinci/db';
import { bearer, createHarness, signIn, type Harness } from './test/harness.js';

let h: Harness;
let owner: { access_token: string };
let guest: { access_token: string };
let guest2: { access_token: string };
let therapistId = '';
let variantId = '';
let day = '';
let key = 0;
const idem = () => ({ 'Idempotency-Key': `test-${Date.now()}-${key++}` });
const A = () => `/v1/tenants/${h.ids.tenantA}`;

/** Tomorrow in Nairobi, as YYYY-MM-DD. */
function tomorrow() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(
    new Date(Date.now() + 86_400_000),
  );
}

beforeAll(async () => {
  h = await createHarness();
  owner = await signIn(h, h.phones.ownerA, 'business');
  guest = await signIn(h, h.phones.guest, 'guest');
  guest2 = await signIn(h, '+254722555001', 'guest');
  day = tomorrow();

  // House A: one therapist, one massage with two options, published and listed.
  const t = await h.http
    .post(`${A()}/resources`)
    .set(bearer(owner))
    .set(idem())
    .send({
      type: 'staff',
      name: 'Achieng',
      title: 'Senior therapist',
      specialties: ['Deep tissue'],
    })
    .expect(201);
  therapistId = t.body.id;
  const s = await h.http
    .post(`${A()}/services`)
    .set(bearer(owner))
    .set(idem())
    .send({
      name: 'Deep tissue massage',
      description: 'Firm pressure for tight muscles.',
      variants: [
        { name: '60 minutes', duration_min: 60, price_minor: 450000 },
        { name: '90 minutes', duration_min: 90, price_minor: 600000 },
      ],
      resource_ids: [therapistId],
      buffer_after_min: 15,
    })
    .expect(201);
  variantId = s.body.variants[0].id;
  await h.http
    .patch(`${A()}/storefront`)
    .set(bearer(owner))
    .send({ tagline: 'Calm in Gigiri', area: 'Gigiri', city: 'Nairobi', published: true })
    .expect(200);
  await h.http
    .patch(`/v1/tenants/${h.ids.tenantB}/storefront`)
    .set(bearer(await signIn(h, h.phones.ownerB, 'business')))
    .send({ tagline: 'Private', published: true, access_code: 'GARDEN-22' })
    .expect(200);
  await withContext(h.database.db, { role: 'sv_platform' }, (tx) =>
    tx.update(tenant).set({ visibility: 'listed' }).where(eq(tenant.id, h.ids.tenantA)),
  );
});

afterAll(async () => {
  await h.close();
});

describe('browsing', () => {
  it('lists listed stores without sign-in, never private ones', async () => {
    const res = await h.http.get('/v1/stores').expect(200);
    expect(res.body.items.map((s: { handle: string }) => s.handle)).toEqual(['house-a']);
    expect(res.body.items[0]).toMatchObject({
      tagline: 'Calm in Gigiri',
      from_price_minor: 450000,
      rating: { average: null, count: 0 },
    });
  });

  it('searches by service name', async () => {
    const hit = await h.http.get('/v1/stores?q=tissue').expect(200);
    expect(hit.body.items).toHaveLength(1);
    const miss = await h.http.get('/v1/stores?q=pedicure').expect(200);
    expect(miss.body.items).toHaveLength(0);
  });

  it('shows a store with services and team, and no private details', async () => {
    const res = await h.http.get('/v1/stores/house-a').expect(200);
    expect(res.body.services[0].variants).toHaveLength(2);
    expect(res.body.team[0]).toMatchObject({ name: 'Achieng', title: 'Senior therapist' });
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/address|access_code|phone|email|tenant_id/);
  });

  it('hides a private store unless the guest has its code', async () => {
    await h.http.get('/v1/stores/house-b').expect(404);
    await h.http.get('/v1/stores/house-b').set('X-Store-Code', 'WRONG-1').expect(404);
    await h.http.get('/v1/stores/house-b').set('X-Store-Code', 'GARDEN-22').expect(200);
  });
});

describe('booking', () => {
  let firstSlot = '';
  let bookingId = '';

  it('offers free times', async () => {
    const res = await h.http
      .get(`/v1/stores/house-a/availability?variant_id=${variantId}&date=${day}`)
      .expect(200);
    expect(res.body.timezone).toBe('Africa/Nairobi');
    expect(res.body.slots.length).toBeGreaterThan(5);
    expect(res.body.slots[0].resource_ids).toEqual([therapistId]);
    firstSlot = res.body.slots[0].starts_at;
  });

  it('needs a guest sign-in and an idempotency key', async () => {
    const body = { variant_id: variantId, starts_at: firstSlot };
    await h.http.post('/v1/stores/house-a/bookings').send(body).expect(401);
    await h.http.post('/v1/stores/house-a/bookings').set(bearer(guest)).send(body).expect(400);
    await h.http
      .post('/v1/stores/house-a/bookings')
      .set(bearer(owner))
      .set(idem())
      .send(body)
      .expect(403);
  });

  it('never double-books, even when two guests press Book at the same moment', async () => {
    const body = { variant_id: variantId, starts_at: firstSlot };
    const [r1, r2] = await Promise.all([
      h.http.post('/v1/stores/house-a/bookings').set(bearer(guest)).set(idem()).send(body),
      h.http.post('/v1/stores/house-a/bookings').set(bearer(guest2)).set(idem()).send(body),
    ]);
    const codes = [r1.status, r2.status].sort();
    expect(codes).toEqual([201, 409]);
    const won = r1.status === 201 ? r1 : r2;
    expect(won.body).toMatchObject({ state: 'confirmed', with: 'Achieng', total_minor: 450000 });
    expect((r1.status === 409 ? r1 : r2).body.error.code).toBe('slot_taken');
    bookingId = won.body.id;
    // Make sure the winner is "guest" for the steps below.
    if (r1.status !== 201) {
      await h.http.post(`/v1/me/bookings/${bookingId}/cancel`).set(bearer(guest2)).expect(200);
      const again = await h.http
        .post('/v1/stores/house-a/bookings')
        .set(bearer(guest))
        .set(idem())
        .send(body)
        .expect(201);
      bookingId = again.body.id;
    }
  });

  it('removes the booked time (and its clean-up buffer) from availability', async () => {
    const res = await h.http
      .get(`/v1/stores/house-a/availability?variant_id=${variantId}&date=${day}`)
      .expect(200);
    const starts = res.body.slots.map((s: { starts_at: string }) => s.starts_at);
    expect(starts).not.toContain(firstSlot);
    // 60 min + 15 min buffer: the next 30-minute start is also taken.
    expect(starts).not.toContain(new Date(Date.parse(firstSlot) + 30 * 60_000).toISOString());
  });

  it("lists the guest's bookings, and only theirs", async () => {
    const mine = await h.http.get('/v1/me/bookings').set(bearer(guest)).expect(200);
    expect(mine.body.items.some((b: { id: string }) => b.id === bookingId)).toBe(true);
    await h.http.post(`/v1/me/bookings/${bookingId}/cancel`).set(bearer(guest2)).expect(404);
  });

  it('shows the House the booking with the guest by alias only', async () => {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const res = await h.http
      .get(`${A()}/bookings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .set(bearer(owner))
      .expect(200);
    const b = res.body.items.find((x: { id: string }) => x.id === bookingId);
    expect(b.resources[0].name).toBe('Achieng');
    expect(Object.keys(b.guest).sort()).toEqual(['alias', 'id']);
  });

  it("lists one guest's visits for the House without a date range", async () => {
    const range = await h.http
      .get(
        `${A()}/bookings?from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 3 * 86_400_000).toISOString())}`,
      )
      .set(bearer(owner))
      .expect(200);
    const b = range.body.items.find((x: { id: string }) => x.id === bookingId);
    expect(b).toMatchObject({ version: 1, service_id: expect.any(String), variant_id: variantId });
    const one = await h.http
      .get(`${A()}/bookings?guest_id=${b.guest.id}`)
      .set(bearer(owner))
      .expect(200);
    expect(one.body.items.map((x: { id: string }) => x.id)).toContain(bookingId);
    expect(one.body.items.every((x: { guest: { id: string } }) => x.guest.id === b.guest.id)).toBe(
      true,
    );
    await h.http.get(`${A()}/bookings`).set(bearer(owner)).expect(422);
  });

  it('frees the time when the guest cancels', async () => {
    const res = await h.http
      .post(`/v1/me/bookings/${bookingId}/cancel`)
      .set(bearer(guest))
      .expect(200);
    expect(res.body.state).toBe('cancelled_by_guest');
    const av = await h.http
      .get(`/v1/stores/house-a/availability?variant_id=${variantId}&date=${day}`)
      .expect(200);
    expect(av.body.slots.map((s: { starts_at: string }) => s.starts_at)).toContain(firstSlot);
  });

  it('lets the House complete a visit and the guest review it once', async () => {
    const b = await h.http
      .post('/v1/stores/house-a/bookings')
      .set(bearer(guest))
      .set(idem())
      .send({ variant_id: variantId, starts_at: firstSlot, resource_id: therapistId })
      .expect(201);
    await h.http
      .post(`/v1/me/bookings/${b.body.id}/review`)
      .set(bearer(guest))
      .set(idem())
      .send({ rating: 5 })
      .expect(409);
    await h.http
      .post(`${A()}/bookings/${b.body.id}/transition`)
      .set(bearer(owner))
      .send({ to: 'completed', version: 2 })
      .expect(409); // stale version
    await h.http
      .post(`${A()}/bookings/${b.body.id}/transition`)
      .set(bearer(owner))
      .send({ to: 'completed', version: 1 })
      .expect(200);
    await h.http
      .post(`/v1/me/bookings/${b.body.id}/review`)
      .set(bearer(guest))
      .set(idem())
      .send({ rating: 4, comment: 'Lovely, calm room.' })
      .expect(201);
    await h.http
      .post(`/v1/me/bookings/${b.body.id}/review`)
      .set(bearer(guest))
      .set(idem())
      .send({ rating: 1 })
      .expect(409);
    const store = await h.http.get('/v1/stores/house-a').expect(200);
    expect(store.body.rating).toEqual({ average: 4, count: 1 });
    expect(store.body.reviews[0]).toMatchObject({ rating: 4, comment: 'Lovely, calm room.' });
    expect(JSON.stringify(store.body.reviews)).not.toMatch(/Wanjiku|guest_profile/);
  });
});
