import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { connect, withContext, type Database, type Tx } from './connect.js';
import { migrate } from './migrate.js';
import {
  auditLog,
  booking,
  guestProfile,
  membership,
  resource,
  resourceAllocation,
  tenant,
  user,
} from './schema.js';

let database: Database;
const ids = {
  tenantA: '',
  tenantB: '',
  ownerA: '',
  ownerB: '',
  guest: '',
  profileA: '',
  profileB: '',
  roomA: '',
};

const tenantValues = (handle: string) => ({
  handle,
  name: `House ${handle}`,
  kind: 'house' as const,
  vertical: 'spa' as const,
  marketCode: 'KE',
  timezone: 'Africa/Nairobi',
  currency: 'KES',
  planCode: 'business',
});

/** Drizzle wraps database errors; the Postgres reason is on `cause`. */
async function failsWith(work: Promise<unknown>, pattern: RegExp) {
  try {
    await work;
  } catch (e) {
    const err = e as Error & { cause?: Error };
    expect(`${err.message} ${err.cause?.message ?? ''}`).toMatch(pattern);
    return;
  }
  throw new Error(`Expected a failure matching ${pattern}`);
}

const asTenantA = <T>(fn: (tx: Tx) => Promise<T>) =>
  withContext(database.db, { role: 'sv_app', tenantId: ids.tenantA, userId: ids.ownerA }, fn);
const asPlatform = <T>(fn: (tx: Tx) => Promise<T>) =>
  withContext(database.db, { role: 'sv_platform' }, fn);

beforeAll(async () => {
  database = await connect('pglite://memory');
  await migrate(database.runner);
  await asPlatform(async (tx) => {
    const [a] = await tx.insert(tenant).values(tenantValues('house-a')).returning();
    const [b] = await tx.insert(tenant).values(tenantValues('house-b')).returning();
    const [oa] = await tx
      .insert(user)
      .values({ phoneE164: '+254700000101', fullName: 'Owner A' })
      .returning();
    const [ob] = await tx
      .insert(user)
      .values({ phoneE164: '+254700000102', fullName: 'Owner B' })
      .returning();
    const [g] = await tx
      .insert(user)
      .values({ phoneE164: '+254700000103', fullName: 'Guest' })
      .returning();
    if (!a || !b || !oa || !ob || !g) throw new Error('seed failed');
    Object.assign(ids, { tenantA: a.id, tenantB: b.id, ownerA: oa.id, ownerB: ob.id, guest: g.id });
    await tx.insert(membership).values([
      { tenantId: a.id, userId: oa.id, role: 'owner', status: 'active' },
      { tenantId: b.id, userId: ob.id, role: 'owner', status: 'active' },
    ]);
    const [pa] = await tx
      .insert(guestProfile)
      .values({ tenantId: a.id, userId: g.id, firstTouchSource: 'own_channel' })
      .returning();
    const [pb] = await tx
      .insert(guestProfile)
      .values({ tenantId: b.id, userId: g.id, firstTouchSource: 'marketplace' })
      .returning();
    const [room] = await tx
      .insert(resource)
      .values({ tenantId: a.id, type: 'room', name: 'Jade Room' })
      .returning();
    if (!pa || !pb || !room) throw new Error('seed failed');
    Object.assign(ids, { profileA: pa.id, profileB: pb.id, roomA: room.id });
  });
}, 120_000);

afterAll(async () => {
  await database.close();
});

describe('migrations', () => {
  it('are idempotent', async () => {
    const again = await migrate(database.runner);
    expect(again.applied).toEqual([]);
    expect(again.skipped.length).toBeGreaterThanOrEqual(6);
  });
});

describe('tenant isolation (row-level security)', () => {
  it('shows a tenant only its own rows', async () => {
    const seen = await asTenantA((tx) => tx.select().from(guestProfile));
    expect(seen.map((p) => p.tenantId)).toEqual([ids.tenantA]);
  });

  it('cannot read another tenant even when asking for it by id', async () => {
    const rows = await asTenantA((tx) =>
      tx.select().from(tenant).where(eq(tenant.id, ids.tenantB)),
    );
    expect(rows).toEqual([]);
  });

  it('refuses to write into another tenant', async () => {
    await failsWith(
      asTenantA((tx) =>
        tx.insert(resource).values({ tenantId: ids.tenantB, type: 'room', name: 'Sneaky' }),
      ),
      /row-level security/,
    );
  });

  it('cannot update another tenant (matches nothing)', async () => {
    const updated = await asTenantA((tx) =>
      tx.update(tenant).set({ name: 'Hacked' }).where(eq(tenant.id, ids.tenantB)).returning(),
    );
    expect(updated).toEqual([]);
  });

  it('lists a person their own memberships across tenants only', async () => {
    const rows = await withContext(database.db, { role: 'sv_app', userId: ids.ownerA }, (tx) =>
      tx.select().from(membership),
    );
    expect(rows.map((m) => m.userId)).toEqual([ids.ownerA]);
  });

  it('shows nothing when a request forgets to set its House', async () => {
    const rows = await withContext(database.db, { role: 'sv_app', userId: ids.ownerA }, (tx) =>
      tx.select().from(guestProfile),
    );
    expect(rows).toEqual([]);
  });

  it('keeps encrypted payment credentials away from the app role', async () => {
    await failsWith(
      asTenantA((tx) => tx.execute(sql`select * from payment_credential`)),
      /permission denied/,
    );
  });

  it('keeps sign-in codes and email tokens away from the app role', async () => {
    await failsWith(
      asTenantA((tx) => tx.execute(sql`select * from otp_challenge`)),
      /permission denied/,
    );
    await failsWith(
      asTenantA((tx) => tx.execute(sql`select * from email_token`)),
      /permission denied/,
    );
  });
});

describe('booking integrity', () => {
  const at = (h: number) => new Date(Date.UTC(2030, 0, 15, h)).toISOString();
  const newBooking = (ref: string, profileId: string) => ({
    tenantId: ids.tenantA,
    ref,
    guestProfileId: profileId,
    state: 'confirmed' as const,
    startsAt: at(9),
    endsAt: at(10),
    totalMinor: 450000,
    currency: 'KES',
    source: 'staff' as const,
  });
  const allocate = (tx: Tx, bookingId: string | undefined, from: number, to: number) =>
    tx.insert(resourceAllocation).values({
      tenantId: ids.tenantA,
      resourceId: ids.roomA,
      bookingId,
      during: `[${at(from)},${at(to)})`,
    });

  it('never double-books a resource', async () => {
    await asTenantA(async (tx) => {
      const [b] = await tx.insert(booking).values(newBooking('SV-AAAA1', ids.profileA)).returning();
      await allocate(tx, b?.id, 9, 10);
    });
    await failsWith(
      asTenantA(async (tx) => {
        const [b] = await tx
          .insert(booking)
          .values(newBooking('SV-AAAA2', ids.profileA))
          .returning();
        await allocate(tx, b?.id, 9, 11);
      }),
      /no_double_booking/,
    );
  });

  it('frees the slot when a booking is cancelled', async () => {
    await asTenantA(async (tx) => {
      await tx
        .update(booking)
        .set({ state: 'cancelled_by_guest' })
        .where(eq(booking.ref, 'SV-AAAA1'));
      const [b] = await tx.insert(booking).values(newBooking('SV-AAAA3', ids.profileA)).returning();
      await allocate(tx, b?.id, 9, 10);
    });
  });

  it("refuses to link a booking to another tenant's guest", async () => {
    await failsWith(
      asPlatform((tx) => tx.insert(booking).values(newBooking('SV-AAAA4', ids.profileB))),
      /foreign key/,
    );
  });

  it('keeps first-touch attribution permanent', async () => {
    await failsWith(
      asTenantA((tx) =>
        tx
          .update(guestProfile)
          .set({ firstTouchSource: 'marketplace' })
          .where(eq(guestProfile.id, ids.profileA)),
      ),
      /permanent/,
    );
  });
});

describe('audit log', () => {
  it('is append-only', async () => {
    await asTenantA((tx) =>
      tx
        .insert(auditLog)
        .values({ tenantId: ids.tenantA, actorLabel: 'Owner A', action: 'booking.created' }),
    );
    // No application role is even allowed to try...
    await failsWith(
      asPlatform((tx) => tx.execute(sql`delete from audit_log`)),
      /permission denied/,
    );
    // ...and the trigger stops the owner login too.
    await failsWith(database.runner.query('delete from audit_log'), /append-only/);
    await failsWith(database.runner.query(`update audit_log set actor_label = 'x'`), /append-only/);
  });
});
