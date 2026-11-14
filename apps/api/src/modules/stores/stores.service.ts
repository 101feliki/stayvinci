import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  booking,
  bookingItem,
  category,
  guestProfile,
  location,
  resource,
  resourceAllocation,
  review,
  service,
  serviceResource,
  serviceVariant,
  storefront,
  tenant,
  type OpeningHours,
  type Tx,
} from '@stayvinci/db';
import type {
  Availability,
  BookingCreate,
  GuestBooking,
  StoreCard,
  StoreDetail,
  StoreListQuery,
} from '@stayvinci/types';
import { randomInt } from 'node:crypto';
import type { z } from 'zod';
import { AppError, Errors } from '../../common/http.js';
import { addMinutes, range, weekdayOf, zonedToUtc } from '../../common/time.js';
import { Data, audit, emit } from '../../database.js';

type Card = z.output<typeof StoreCard>;
type Detail = z.output<typeof StoreDetail>;
type Slot = { start: Date; end: Date; free: Map<string, string[]> };

/** Guests must book at least this far ahead. */
const LEAD_MIN = 30;
/** Slots start on this grid (minutes). */
const STEP_MIN = 30;
/** Short-stay units check in at this local time. */
const CHECK_IN = '14:00';
/** Used until a House sets its own opening hours. */
const DEFAULT_HOURS: OpeningHours = {
  mon: [['09:00', '20:00']],
  tue: [['09:00', '20:00']],
  wed: [['09:00', '20:00']],
  thu: [['09:00', '20:00']],
  fri: [['09:00', '20:00']],
  sat: [['09:00', '20:00']],
  sun: [['10:00', '18:00']],
};
/** Guests can cancel online up to this many hours before the start. */
export const CANCEL_HOURS = 2;

const tenantCols = {
  id: tenant.id,
  handle: tenant.handle,
  name: tenant.name,
  kind: tenant.kind,
  vertical: tenant.vertical,
  timezone: tenant.timezone,
  currency: tenant.currency,
};

export function newRef(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'SV-';
  for (let i = 0; i < 6; i++) s += abc[randomInt(abc.length)];
  return s;
}

/** Public store browsing, availability and guest bookings (spec §9–§11). */
@Injectable()
export class StoresService {
  constructor(@Inject(Data) private readonly data: Data) {}

  /* ---------- Browsing ---------- */

  async list(query: z.output<typeof StoreListQuery>): Promise<Card[]> {
    return this.data.publicStore(null, async (tx) => {
      const conds = [sql`${tenant.visibility} = 'listed'`];
      if (query.vertical) conds.push(eq(tenant.vertical, query.vertical));
      if (query.kind) conds.push(eq(tenant.kind, query.kind));
      if (query.q) {
        const like = `%${query.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
        conds.push(
          sql`(${tenant.name} ilike ${like} or ${storefront.tagline} ilike ${like} or ${storefront.area} ilike ${like}
               or exists (select 1 from service s where s.tenant_id = ${tenant.id} and s.name ilike ${like}))`,
        );
      }
      const rows = await tx
        .select({ t: tenantCols, s: storefrontPublicCols })
        .from(tenant)
        .innerJoin(storefront, eq(storefront.tenantId, tenant.id))
        .where(and(...conds))
        .orderBy(asc(tenant.name))
        .limit(200);
      return this.cards(tx, rows);
    });
  }

  private async cards(tx: Tx, rows: { t: TenantPublic; s: StorefrontPublic }[]): Promise<Card[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.t.id);
    const prices = await tx
      .select({
        tenantId: serviceVariant.tenantId,
        min: sql<string>`min(${serviceVariant.priceMinor})`,
      })
      .from(serviceVariant)
      .innerJoin(service, eq(service.id, serviceVariant.serviceId))
      .where(inArray(serviceVariant.tenantId, ids))
      .groupBy(serviceVariant.tenantId);
    const ratings = await tx
      .select({
        tenantId: review.tenantId,
        avg: sql<string | null>`avg(${review.rating})`,
        n: sql<string>`count(*)`,
      })
      .from(review)
      .where(inArray(review.tenantId, ids))
      .groupBy(review.tenantId);
    const priceOf = new Map(prices.map((p) => [p.tenantId, Number(p.min)]));
    const ratingOf = new Map(ratings.map((r) => [r.tenantId, r]));
    return rows.map(({ t, s }) => {
      const r = ratingOf.get(t.id);
      return {
        handle: t.handle,
        name: t.name,
        kind: t.kind,
        vertical: t.vertical,
        tagline: s.tagline,
        area: s.area,
        city: s.city,
        logo_url: s.logoUrl,
        cover_url: s.coverUrl,
        highlights: s.highlights,
        from_price_minor: priceOf.get(t.id) ?? null,
        currency: t.currency,
        rating: {
          average: r?.avg ? Math.round(Number(r.avg) * 10) / 10 : null,
          count: Number(r?.n ?? 0),
        },
      };
    });
  }

  /** The private store a code opens. Only private stores need codes; anything else is 404. */
  async enter(code: string): Promise<{ handle: string; name: string }> {
    return this.data.publicStore(code, async (tx) => {
      const [row] = await tx
        .select({ handle: tenant.handle, name: tenant.name })
        .from(tenant)
        .where(eq(tenant.visibility, 'private'));
      if (!row) throw Errors.notFound('Store');
      return row;
    });
  }

  /** A visible store by handle, or 404 (private stores need their code). */
  private async findStore(tx: Tx, handle: string) {
    const [row] = await tx
      .select({ t: tenantCols, s: storefrontPublicCols })
      .from(tenant)
      .innerJoin(storefront, eq(storefront.tenantId, tenant.id))
      .where(eq(tenant.handle, handle.toLowerCase()));
    if (!row) throw Errors.notFound('Store');
    return row;
  }

  /** The House behind a store the guest can see (chat and other guest actions). */
  async resolve(
    handle: string,
    code: string | null,
  ): Promise<{ tenantId: string; name: string; chatEnabled: boolean }> {
    return this.data.publicStore(code, async (tx) => {
      const row = await this.findStore(tx, handle);
      return { tenantId: row.t.id, name: row.t.name, chatEnabled: row.s.chatEnabled };
    });
  }

  async detail(handle: string, code: string | null): Promise<Detail> {
    return this.data.publicStore(code, async (tx) => {
      const row = await this.findStore(tx, handle);
      const tid = row.t.id;
      const [card] = await this.cards(tx, [row]);
      const [locs, cats, svcs, vars, res, revs] = await Promise.all([
        tx
          .select({
            id: location.id,
            name: location.name,
            area: location.area,
            city: location.city,
            timezone: location.timezone,
            hours: location.hours,
          })
          .from(location)
          .where(eq(location.tenantId, tid)),
        tx
          .select({ id: category.id, name: category.name, image_url: category.imageUrl })
          .from(category)
          .where(eq(category.tenantId, tid))
          .orderBy(asc(category.position), asc(category.name)),
        tx
          .select({
            id: service.id,
            category_id: service.categoryId,
            name: service.name,
            description: service.description,
            image_url: service.imageUrl,
            icon: service.icon,
            requires: service.requires,
          })
          .from(service)
          .where(eq(service.tenantId, tid))
          .orderBy(asc(service.name)),
        tx
          .select({
            id: serviceVariant.id,
            serviceId: serviceVariant.serviceId,
            name: serviceVariant.name,
            duration_min: serviceVariant.durationMin,
            price_minor: serviceVariant.priceMinor,
            currency: serviceVariant.currency,
          })
          .from(serviceVariant)
          .where(eq(serviceVariant.tenantId, tid))
          .orderBy(asc(serviceVariant.position)),
        tx
          .select(resourcePublicCols)
          .from(resource)
          .where(and(eq(resource.tenantId, tid), eq(resource.showOnStore, true)))
          .orderBy(asc(resource.position), asc(resource.name)),
        tx
          .select({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            reply: review.reply,
            created_at: review.createdAt,
          })
          .from(review)
          .where(eq(review.tenantId, tid))
          .orderBy(desc(review.createdAt))
          .limit(12),
      ]);
      if (!card) throw Errors.notFound('Store');
      return {
        ...card,
        about: row.s.about,
        amenities: row.s.amenities,
        gallery: row.s.gallery,
        design: publicDesign(row.s.design),
        socials: row.s.socials,
        policies: row.s.policies,
        chat_enabled: row.s.chatEnabled,
        locations: locs.map((l) => ({ ...l, hours: l.hours })),
        categories: cats,
        services: svcs
          .map((s) => ({
            ...s,
            variants: vars
              .filter((v) => v.serviceId === s.id)
              .map(({ serviceId: _, ...v }) => ({ ...v, price_minor: Number(v.price_minor) })),
          }))
          .filter((s) => s.variants.length > 0),
        team: res
          .filter((r) => r.type === 'staff')
          .map((r) => ({
            id: r.id,
            name: r.name,
            title: r.title,
            bio: r.bio,
            specialties: r.specialties,
            photo_url: r.photoUrl,
          })),
        rooms: res
          .filter((r) => r.type === 'room' || r.type === 'unit')
          .map((r) => ({
            id: r.id,
            type: r.type as 'room' | 'unit',
            name: r.name,
            description: r.description,
            amenities: r.amenities,
            gallery: r.gallery,
            capacity: r.capacity,
          })),
        reviews: revs.map((r) => ({ ...r, created_at: toIso(r.created_at) })),
      };
    });
  }

  /* ---------- Availability ---------- */

  async availability(
    handle: string,
    code: string | null,
    q: { variant_id: string; date: string; resource_id?: string | undefined },
  ): Promise<z.output<typeof Availability>> {
    return this.data.publicStore(code, async (tx) => {
      const store = await this.findStore(tx, handle);
      const plan = await this.slotsFor(tx, store.t.id, store.t.timezone, q.variant_id, q.date);
      const slots = plan.slots
        .map((s) => {
          const ids = s.free.get(plan.primary) ?? [];
          return { s, ids: q.resource_id ? ids.filter((id) => id === q.resource_id) : ids };
        })
        .filter((x) => x.ids.length > 0)
        .map(({ s, ids }) => ({
          starts_at: s.start.toISOString(),
          ends_at: s.end.toISOString(),
          resource_ids: ids,
        }));
      return { date: q.date, timezone: plan.timezone, slots };
    });
  }

  /**
   * Every bookable start on a local date for a variant, with the free resources of each
   * required type. Works under sv_public (busy times only) or the tenant role.
   */
  private async slotsFor(
    tx: Tx,
    tenantId: string,
    tenantZone: string,
    variantId: string,
    date: string,
  ) {
    const [v] = await tx
      .select({
        id: serviceVariant.id,
        name: serviceVariant.name,
        duration: serviceVariant.durationMin,
        price: serviceVariant.priceMinor,
        currency: serviceVariant.currency,
        serviceId: service.id,
        serviceName: service.name,
        requires: service.requires,
        before: service.bufferBeforeMin,
        after: service.bufferAfterMin,
      })
      .from(serviceVariant)
      .innerJoin(service, eq(service.id, serviceVariant.serviceId))
      .where(and(eq(serviceVariant.id, variantId), eq(serviceVariant.tenantId, tenantId)));
    if (!v) throw Errors.notFound('Service');

    const [loc] = await tx
      .select({ id: location.id, timezone: location.timezone, hours: location.hours })
      .from(location)
      .where(eq(location.tenantId, tenantId))
      .limit(1);
    const timezone = loc?.timezone ?? tenantZone;
    const hours: OpeningHours = loc?.hours ?? DEFAULT_HOURS;
    const requires = (v.requires.length ? v.requires : ['staff']).filter((r) =>
      ['staff', 'room', 'unit'].includes(r),
    );
    const primary = requires[0] ?? 'staff';

    // Who can deliver it: explicit links, or every active resource of that type.
    const all = await tx
      .select({ id: resource.id, type: resource.type })
      .from(resource)
      .where(and(eq(resource.tenantId, tenantId), inArray(resource.type, requires as never[])));
    const linked = await tx
      .select({ id: serviceResource.resourceId })
      .from(serviceResource)
      .where(
        and(eq(serviceResource.tenantId, tenantId), eq(serviceResource.serviceId, v.serviceId)),
      );
    const linkedIds = new Set(linked.map((l) => l.id));
    const eligible = new Map<string, string[]>();
    for (const type of requires) {
      const ofType = all.filter((r) => r.type === type);
      const pick = ofType.filter((r) => linkedIds.has(r.id));
      eligible.set(
        type,
        (pick.length ? pick : ofType).map((r) => r.id),
      );
    }

    // Candidate starts.
    const starts: Date[] = [];
    if (requires.includes('unit')) {
      starts.push(zonedToUtc(date, CHECK_IN, timezone));
    } else {
      for (const [open, close] of hours[weekdayOf(date)] ?? []) {
        const openAt = zonedToUtc(date, open, timezone);
        const closeAt = zonedToUtc(date, close, timezone);
        for (let t = openAt; addMinutes(t, v.duration) <= closeAt; t = addMinutes(t, STEP_MIN))
          starts.push(t);
      }
    }
    const earliest = addMinutes(new Date(), LEAD_MIN);
    const candidates = starts.filter((s) => s >= earliest);
    if (!candidates.length)
      return { v, timezone, primary, locationId: loc?.id ?? null, slots: [] as Slot[] };

    // Busy times of the eligible resources around that day.
    const ids = [...new Set([...eligible.values()].flat())];
    const first = candidates[0] as Date;
    const last = candidates[candidates.length - 1] as Date;
    const windowFrom = addMinutes(first, -v.before);
    const windowTo = addMinutes(last, v.duration + v.after);
    const busy = ids.length
      ? await tx
          .select({
            resourceId: resourceAllocation.resourceId,
            from: sql<string>`lower(${resourceAllocation.during})`,
            to: sql<string>`upper(${resourceAllocation.during})`,
          })
          .from(resourceAllocation)
          .where(
            and(
              eq(resourceAllocation.tenantId, tenantId),
              eq(resourceAllocation.active, true),
              inArray(resourceAllocation.resourceId, ids),
              sql`${resourceAllocation.during} && tstzrange(${windowFrom.toISOString()}::timestamptz, ${windowTo.toISOString()}::timestamptz)`,
            ),
          )
      : [];
    const busyBy = new Map<string, [number, number][]>();
    for (const b of busy) {
      const list = busyBy.get(b.resourceId) ?? [];
      list.push([new Date(b.from).getTime(), new Date(b.to).getTime()]);
      busyBy.set(b.resourceId, list);
    }

    const slots: Slot[] = [];
    for (const start of candidates) {
      const end = addMinutes(start, v.duration);
      const from = addMinutes(start, -v.before).getTime();
      const to = addMinutes(end, v.after).getTime();
      const free = new Map<string, string[]>();
      let ok = true;
      for (const type of requires) {
        const list = (eligible.get(type) ?? []).filter(
          (id) => !(busyBy.get(id) ?? []).some(([a, b]) => a < to && b > from),
        );
        if (!list.length) ok = false;
        free.set(type, list);
      }
      if (ok) slots.push({ start, end, free });
    }
    return { v, timezone, primary, locationId: loc?.id ?? null, slots };
  }

  /* ---------- Guest bookings ---------- */

  async book(
    userId: string,
    handle: string,
    code: string | null,
    input: z.output<typeof BookingCreate>,
    idempotencyKey: string | null,
  ): Promise<z.output<typeof GuestBooking>> {
    const startsAt = new Date(input.starts_at);
    // 1. Check the store is visible to this guest and the time is really free.
    const plan = await this.data.publicStore(code, async (tx) => {
      const store = await this.findStore(tx, handle);
      const days = new Set([
        localDateIn(startsAt, store.t.timezone),
        localDateIn(addMinutes(startsAt, -1440), store.t.timezone),
      ]);
      for (const day of days) {
        const p = await this.slotsFor(tx, store.t.id, store.t.timezone, input.variant_id, day);
        const slot = p.slots.find((s) => s.start.getTime() === startsAt.getTime());
        if (slot) return { store, p, slot };
      }
      return { store, p: null, slot: null };
    });
    if (!plan.p || !plan.slot) throw slotTaken();
    const { store, p, slot } = plan;

    // Pick resources: the guest's preferred one if free, else the first free of each type.
    const chosen: string[] = [];
    for (const [type, ids] of slot.free) {
      const preferred =
        input.resource_id && ids.includes(input.resource_id) ? input.resource_id : undefined;
      if (input.resource_id && type === p.primary && !preferred) throw slotTaken();
      const pick = preferred ?? ids[0];
      if (!pick) throw slotTaken();
      chosen.push(pick);
    }

    // 2. Write the booking as the guest inside that store. The exclusion constraint is the
    //    final word: if someone took the slot a moment ago, this insert fails cleanly.
    try {
      return await this.data.asGuestIn(userId, store.t.id, async (tx) => {
        await tx
          .insert(guestProfile)
          .values({
            tenantId: store.t.id,
            userId,
            firstTouchSource: input.via,
            firstTouchDetail: input.via === 'marketplace' ? 'marketplace' : 'store_link',
          })
          .onConflictDoNothing();
        const [profile] = await tx
          .select({ id: guestProfile.id })
          .from(guestProfile)
          .where(and(eq(guestProfile.tenantId, store.t.id), eq(guestProfile.userId, userId)));
        if (!profile) throw Errors.forbidden();
        const [b] = await tx
          .insert(booking)
          .values({
            tenantId: store.t.id,
            ref: newRef(),
            guestProfileId: profile.id,
            locationId: p.locationId,
            state: 'confirmed',
            startsAt: slot.start.toISOString(),
            endsAt: slot.end.toISOString(),
            totalMinor: Number(p.v.price),
            currency: p.v.currency,
            source: input.via === 'marketplace' ? 'marketplace' : 'guest_app',
            notes: input.notes ?? null,
            idempotencyKey,
          })
          .returning();
        if (!b) throw Errors.conflict('Could not create the booking.');
        await tx.insert(bookingItem).values({
          tenantId: store.t.id,
          bookingId: b.id,
          serviceVariantId: p.v.id,
          priceMinor: Number(p.v.price),
        });
        const from = addMinutes(slot.start, -p.v.before);
        const to = addMinutes(slot.end, p.v.after);
        await tx.insert(resourceAllocation).values(
          chosen.map((resourceId) => ({
            tenantId: store.t.id,
            resourceId,
            bookingId: b.id,
            during: range(from, to),
          })),
        );
        await audit(tx, {
          tenantId: store.t.id,
          actorUserId: userId,
          actorLabel: 'guest',
          action: 'booking.created',
          targetType: 'booking',
          targetId: b.id,
        });
        await emit(tx, {
          tenantId: store.t.id,
          type: 'booking.confirmed',
          aggregateType: 'booking',
          aggregateId: b.id,
          payload: { ref: b.ref, starts_at: b.startsAt, source: b.source },
        });
        const [mine] = await this.guestBookings(tx, store.t, profile.id, b.id);
        if (!mine) throw Errors.conflict('Could not read the booking back.');
        return mine;
      });
    } catch (e) {
      if (isExclusionViolation(e)) throw slotTaken();
      throw e;
    }
  }

  /** A guest's bookings in one store, shaped for the guest app. */
  async guestBookings(
    tx: Tx,
    store: { id: string; handle: string; name: string },
    profileId: string,
    onlyId?: string,
  ): Promise<z.output<typeof GuestBooking>[]> {
    const rows = await tx
      .select({
        b: booking,
        service: service.name,
        variant: serviceVariant.name,
        reviewed: sql<boolean>`exists (select 1 from review r where r.tenant_id = ${booking.tenantId} and r.booking_id = ${booking.id})`,
        with: sql<
          string | null
        >`(select string_agg(r.name, ', ') from resource_allocation a join resource r on r.tenant_id = a.tenant_id and r.id = a.resource_id where a.tenant_id = ${booking.tenantId} and a.booking_id = ${booking.id} and r.type = 'staff' and r.show_on_store)`,
      })
      .from(booking)
      .innerJoin(
        bookingItem,
        and(eq(bookingItem.tenantId, booking.tenantId), eq(bookingItem.bookingId, booking.id)),
      )
      .innerJoin(serviceVariant, eq(serviceVariant.id, bookingItem.serviceVariantId))
      .innerJoin(service, eq(service.id, serviceVariant.serviceId))
      .where(
        and(
          eq(booking.tenantId, store.id),
          eq(booking.guestProfileId, profileId),
          onlyId ? eq(booking.id, onlyId) : undefined,
        ),
      )
      .orderBy(desc(booking.startsAt))
      .limit(100);
    const cancelBy = addMinutes(new Date(), CANCEL_HOURS * 60);
    return rows.map(({ b, ...r }) => ({
      id: b.id,
      ref: b.ref,
      store: { handle: store.handle, name: store.name },
      state: b.state,
      starts_at: toIso(b.startsAt),
      ends_at: toIso(b.endsAt),
      service: r.service,
      variant: r.variant,
      with: r.with,
      total_minor: Number(b.totalMinor),
      currency: b.currency,
      can_cancel:
        ['held', 'pending_payment', 'requested', 'confirmed'].includes(b.state) &&
        new Date(b.startsAt) > cancelBy,
      can_review: b.state === 'completed' && !r.reviewed,
    }));
  }

  /** Every store where this person is a guest. */
  async myStores(userId: string) {
    return this.data.asGuestIn(userId, '', (tx) =>
      tx
        .select({ profileId: guestProfile.id, tenantId: guestProfile.tenantId })
        .from(guestProfile)
        .where(eq(guestProfile.userId, userId)),
    );
  }

  /** The store's name and handle, read inside that store's context. */
  async storeOf(tx: Tx, tenantId: string) {
    const [t] = await tx
      .select({ id: tenant.id, handle: tenant.handle, name: tenant.name })
      .from(tenant)
      .where(eq(tenant.id, tenantId));
    if (!t) throw Errors.notFound('Store');
    return t;
  }

  /** Upcoming first, then past. */
  static sortForGuest(list: z.output<typeof GuestBooking>[]) {
    const now = Date.now();
    const upcoming = list
      .filter((b) => new Date(b.starts_at).getTime() >= now)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const past = list
      .filter((b) => new Date(b.starts_at).getTime() < now)
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    return [...upcoming, ...past];
  }
}

/* ---------- Column sets readable by sv_public ---------- */

const storefrontPublicCols = {
  tagline: storefront.tagline,
  about: storefront.about,
  highlights: storefront.highlights,
  amenities: storefront.amenities,
  area: storefront.area,
  city: storefront.city,
  logoUrl: storefront.logoUrl,
  coverUrl: storefront.coverUrl,
  gallery: storefront.gallery,
  design: storefront.design,
  socials: storefront.socials,
  policies: storefront.policies,
  chatEnabled: storefront.chatEnabled,
};
/** The House's unpublished draft and version history stay in the business app. */
const publicDesign = (d: Record<string, unknown>) => {
  const { draft: _draft, versions: _versions, ...live } = d;
  return live;
};
type StorefrontPublic = {
  [K in keyof typeof storefrontPublicCols]: (typeof storefront.$inferSelect)[K];
};
type TenantPublic = {
  id: string;
  handle: string;
  name: string;
  kind: 'house' | 'atelier';
  vertical: 'spa' | 'short_stay' | 'atelier';
  timezone: string;
  currency: string;
};

const resourcePublicCols = {
  id: resource.id,
  type: resource.type,
  name: resource.name,
  title: resource.title,
  bio: resource.bio,
  specialties: resource.specialties,
  photoUrl: resource.photoUrl,
  description: resource.description,
  amenities: resource.amenities,
  gallery: resource.gallery,
  capacity: resource.capacity,
};

/* ---------- Helpers ---------- */

const toIso = (v: string | Date) => new Date(v).toISOString();

function localDateIn(d: Date, zone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(d);
}

const slotTaken = () =>
  new AppError(409, 'slot_taken', 'That time is no longer available. Pick another time.');

function isExclusionViolation(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur; i++) {
    if ((cur as { code?: string }).code === '23P01') return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}
