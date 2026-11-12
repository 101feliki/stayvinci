// Chat between a guest and a House: send, reply, read state, discretion, the House's
// off switch, and isolation between guests and between Houses.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { tenant, withContext } from '@stayvinci/db';
import { bearer, createHarness, signIn, type Harness } from './test/harness.js';

let h: Harness;
let ownerA: { access_token: string };
let ownerB: { access_token: string };
let guest: { access_token: string };
let guest2: { access_token: string };
const A = () => `/v1/tenants/${h.ids.tenantA}`;
const B = () => `/v1/tenants/${h.ids.tenantB}`;

beforeAll(async () => {
  h = await createHarness();
  ownerA = await signIn(h, h.phones.ownerA, 'business');
  ownerB = await signIn(h, h.phones.ownerB, 'business');
  guest = await signIn(h, h.phones.guest, 'guest');
  guest2 = await signIn(h, '+254722555002', 'guest');
  await h.http.patch(`${A()}/storefront`).set(bearer(ownerA)).send({ published: true }).expect(200);
  await withContext(h.database.db, { role: 'sv_platform' }, (tx) =>
    tx.update(tenant).set({ visibility: 'listed' }).where(eq(tenant.id, h.ids.tenantA)),
  );
});

afterAll(async () => {
  await h.close();
});

describe('chat', () => {
  let conversationId = '';

  it('is on by default and shown on the store', async () => {
    const store = await h.http.get('/v1/stores/house-a').expect(200);
    expect(store.body.chat_enabled).toBe(true);
    const empty = await h.http.get('/v1/stores/house-a/chat').set(bearer(guest)).expect(200);
    expect(empty.body).toMatchObject({ enabled: true, messages: [] });
  });

  it('needs the guest app sign-in', async () => {
    await h.http.get('/v1/stores/house-a/chat').expect(401);
    await h.http
      .post('/v1/stores/house-a/chat')
      .set(bearer(ownerA))
      .send({ body: 'Hi' })
      .expect(403);
  });

  it('lets a guest write, and the House see it by alias only', async () => {
    const sent = await h.http
      .post('/v1/stores/house-a/chat')
      .set(bearer(guest))
      .send({ body: 'Do you have a slot on Saturday morning?' })
      .expect(201);
    expect(sent.body.sender).toBe('guest');

    const inbox = await h.http.get(`${A()}/conversations`).set(bearer(ownerA)).expect(200);
    expect(inbox.body.items).toHaveLength(1);
    const c = inbox.body.items[0];
    conversationId = c.id;
    expect(c.unread).toBe(true);
    expect(c.preview).toContain('Saturday');
    expect(Object.keys(c).sort()).toEqual(
      ['guest_label', 'id', 'last_message_at', 'last_sender', 'preview', 'unread'].sort(),
    );
    expect(JSON.stringify(inbox.body)).not.toMatch(/\+2547|@/);
  });

  it('marks it read when the House opens it, and delivers the reply to the guest', async () => {
    const thread = await h.http
      .get(`${A()}/conversations/${conversationId}`)
      .set(bearer(ownerA))
      .expect(200);
    expect(thread.body.messages).toHaveLength(1);
    await h.http
      .post(`${A()}/conversations/${conversationId}/messages`)
      .set(bearer(ownerA))
      .send({ body: 'Yes, 10:00 is free.' })
      .expect(201);
    const inbox = await h.http.get(`${A()}/conversations`).set(bearer(ownerA)).expect(200);
    expect(inbox.body.items[0].unread).toBe(false);

    const mine = await h.http.get('/v1/stores/house-a/chat').set(bearer(guest)).expect(200);
    expect(mine.body.messages.map((m: { sender: string }) => m.sender)).toEqual(['guest', 'house']);
  });

  it("keeps one guest's conversation away from another guest", async () => {
    const other = await h.http.get('/v1/stores/house-a/chat').set(bearer(guest2)).expect(200);
    expect(other.body.messages).toEqual([]);
  });

  it('keeps conversations inside their House', async () => {
    await h.http.get(`${B()}/conversations`).set(bearer(ownerA)).expect(404);
    const theirs = await h.http.get(`${B()}/conversations`).set(bearer(ownerB)).expect(200);
    expect(theirs.body.items).toEqual([]);
    await h.http.get(`${B()}/conversations/${conversationId}`).set(bearer(ownerB)).expect(404);
    await h.http
      .post(`${B()}/conversations/${conversationId}/messages`)
      .set(bearer(ownerB))
      .send({ body: 'Hello' })
      .expect(404);
  });

  it('can be switched off by the House: no button, no new messages, history kept', async () => {
    const sf = await h.http
      .patch(`${A()}/storefront`)
      .set(bearer(ownerA))
      .send({ chat_enabled: false })
      .expect(200);
    expect(sf.body.chat_enabled).toBe(false);
    const store = await h.http.get('/v1/stores/house-a').expect(200);
    expect(store.body.chat_enabled).toBe(false);
    await h.http
      .post('/v1/stores/house-a/chat')
      .set(bearer(guest))
      .send({ body: 'Still there?' })
      .expect(403);
    const mine = await h.http.get('/v1/stores/house-a/chat').set(bearer(guest)).expect(200);
    expect(mine.body.enabled).toBe(false);
    expect(mine.body.messages).toHaveLength(2);
  });

  it('refuses empty and over-long messages', async () => {
    await h.http
      .patch(`${A()}/storefront`)
      .set(bearer(ownerA))
      .send({ chat_enabled: true })
      .expect(200);
    await h.http
      .post('/v1/stores/house-a/chat')
      .set(bearer(guest))
      .send({ body: '   ' })
      .expect(422);
    await h.http
      .post('/v1/stores/house-a/chat')
      .set(bearer(guest))
      .send({ body: 'x'.repeat(2001) })
      .expect(422);
  });
});
