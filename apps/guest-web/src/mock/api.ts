// Guest-side mock API. Mirrors the server rules the guest app depends on:
//  - codes resolve to a tenant; private stores never appear in search (spec §6, §8)
//  - first touch per guest–tenant pair is permanent attribution (spec §8)
//  - items are filtered server-side by visibility and entitlements (spec §9)
//  - booking create takes an idempotency key; payment confirms via callback (spec §3, §10)
// It shares seed data with the business app via @stayvinci/demo-data.
import { createSeed, type Db } from '@stayvinci/demo-data/seed';
import { addDaysKey, dayKey, zonedToUtc } from '@stayvinci/demo-data/format';
import {
  DEFAULT_MARQUEE,
  DEFAULT_SEASON,
  activeSeason,
  marqueeLines,
  resolvePalette,
} from '@stayvinci/demo-data/design';
import type {
  Booking,
  BookingState,
  Guest,
  ItemVisibility,
  Policies,
  Tenant,
} from '@stayvinci/demo-data/types';

const db: Db = createSeed();

export class ApiError extends Error {}

/* ---------- Guest session ---------- */

interface Admission {
  tenantId: string;
  code: string;
  scope: 'store' | 'invite_items';
  at: string;
  hidden: boolean;
}
interface GuestSession {
  signedIn: boolean;
  firstName: string;
  lastName: string;
  phone: string;
  alias: string | null;
  admissions: Admission[];
  notificationDetail: 'neutral' | 'detailed';
  appLock: boolean;
  marketing: boolean;
}

const KEY = 'sv.guest.session';
const ME_SEED_GUEST = 'g_ser_1'; // the demo guest's profile inside Serenity

function load(): GuestSession {
  const seedGuest = db.guests.find((g) => g.id === ME_SEED_GUEST);
  const fallback: GuestSession = {
    signedIn: false,
    firstName: seedGuest?.firstName ?? 'Zawadi',
    lastName: seedGuest?.lastName ?? 'Mwangi',
    phone: '+254 712 345 678',
    alias: null,
    admissions: [
      {
        tenantId: 't_serenity',
        code: 'SERENITY',
        scope: 'store',
        at: new Date(Date.now() - 200 * 86_400_000).toISOString(),
        hidden: false,
      },
    ],
    notificationDetail: 'neutral',
    appLock: false,
    marketing: true,
  };
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo') === '1')
    return { ...fallback, signedIn: true };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fallback, ...(JSON.parse(raw) as Partial<GuestSession>) };
  } catch {
    // storage unavailable
  }
  return fallback;
}

let me: GuestSession = load();
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(me));
  } catch {
    // ignore
  }
}

/** The guest's tenant-scoped profile in a store (created on first entry). */
function profileIn(tenantId: string): Guest | undefined {
  if (tenantId === 't_serenity') return db.guests.find((g) => g.id === ME_SEED_GUEST);
  return db.guests.find((g) => g.tenantId === tenantId && g.id === `g_me_${tenantId}`);
}

function respond<T>(fn: () => T, ms = 160): Promise<T> {
  return new Promise((resolve, reject) =>
    setTimeout(
      () => {
        try {
          resolve(structuredClone(fn()));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      },
      ms + Math.random() * 100,
    ),
  );
}

function tenantByHandle(handle: string): Tenant {
  const t = db.tenants.find((x) => x.handle.toLowerCase() === handle.toLowerCase());
  if (!t) throw new ApiError('Store not found');
  return t;
}

function admission(tenantId: string) {
  return me.admissions.find((a) => a.tenantId === tenantId);
}

/** Can this guest see an item with this visibility in this store? (spec §5.7, §9) */
function visible(v: ItemVisibility, tenantId: string, tierIds: string[] = []): boolean {
  if (v === 'public') return true;
  if (v === 'hidden') return false;
  if (v === 'invite_only') return admission(tenantId)?.scope === 'invite_items';
  const p = profileIn(tenantId);
  return Boolean(
    p?.membershipTierId && (tierIds.length === 0 || tierIds.includes(p.membershipTierId)),
  );
}

const BLOCKING: BookingState[] = [
  'held',
  'pending_payment',
  'requested',
  'confirmed',
  'checked_in',
];
const overlaps = (aS: string, aE: string, bS: string, bE: string) => aS < bE && bS < aE;

/* ---------- Demo marketplace listings (listed Houses) ---------- */

export interface Listing {
  handle: string;
  name: string;
  category: string;
  area: string;
  rating: number;
  reviews: number;
  fromPrice: number | null;
  verified: boolean;
  nextAvailable: string;
  mode: 'listed' | 'listed_limited';
  tone: string;
}

const LISTINGS: Listing[] = [
  {
    handle: 'nyota',
    name: 'Nyota Day Spa',
    category: 'Spas',
    area: 'Kilimani',
    rating: 4.8,
    reviews: 126,
    fromPrice: 350000,
    verified: true,
    nextAvailable: 'Today 16:30',
    mode: 'listed',
    tone: '#3B2A3F',
  },
  {
    handle: 'kilele',
    name: 'Kilele Grooming Lounge',
    category: 'Massages',
    area: 'Westlands',
    rating: 4.7,
    reviews: 88,
    fromPrice: 250000,
    verified: true,
    nextAvailable: 'Tomorrow 10:00',
    mode: 'listed',
    tone: '#1C1C1E',
  },
  {
    handle: 'zuri',
    name: 'Zuri Skin Studio',
    category: 'Facials',
    area: 'Lavington',
    rating: 4.9,
    reviews: 64,
    fromPrice: null,
    verified: true,
    nextAvailable: 'Today 18:00',
    mode: 'listed_limited',
    tone: '#124535',
  },
  {
    handle: 'pwani',
    name: 'Pwani Nail Bar',
    category: 'Nails',
    area: 'Karen',
    rating: 4.6,
    reviews: 41,
    fromPrice: 150000,
    verified: false,
    nextAvailable: 'Thu 11:30',
    mode: 'listed',
    tone: '#94733a',
  },
  {
    handle: 'baraka',
    name: 'Baraka Garden Cottages',
    category: 'Short stays',
    area: 'Naivasha',
    rating: 4.8,
    reviews: 52,
    fromPrice: 900000,
    verified: true,
    nextAvailable: 'Fri night',
    mode: 'listed',
    tone: '#236e56',
  },
];

/* ===================================================================== */

/** The store's resolved look (spec §5.2): colours incl. season, logo, marquee and section paint. */
function designOf(sf: Db['storefronts'][number] | undefined) {
  const base = {
    theme: sf?.theme ?? ('emerald' as const),
    accent: sf?.accent ?? '#C8A96A',
    palette: sf?.palette ?? null,
    season: sf?.season ?? DEFAULT_SEASON,
  };
  const palette = resolvePalette(base);
  const season = activeSeason(base.season);
  const marquee = sf?.marquee ?? DEFAULT_MARQUEE;
  return {
    palette,
    accent: palette.accent,
    logo: sf?.logo ?? null,
    season: season
      ? { id: season.id, name: season.name, motif: season.motif, colors: season.colors }
      : null,
    marquee: marquee.enabled
      ? { speed: marquee.speed, style: marquee.style, lines: marqueeLines(marquee, season) }
      : null,
    sectionStyles: sf?.sectionStyles ?? {},
    cover: sf?.cover ?? {
      image: null,
      headline: '',
      subline: '',
      layout: 'color' as const,
      ctaLabel: 'Book a visit',
    },
    // Only accounts the House connected and chose to show. WhatsApp opens in-app chat in
    // the prototype (numbers stay private); the others link to the public profile.
    socials: (sf?.socials ?? [])
      .filter((a) => a.connected && a.showOnStore)
      .map((a) => ({
        network: a.network,
        handle: a.handle,
        url:
          a.network === 'instagram'
            ? `https://instagram.com/${a.handle}`
            : a.network === 'facebook'
              ? `https://facebook.com/${a.handle}`
              : a.network === 'x'
                ? `https://x.com/${a.handle}`
                : a.network === 'tiktok'
                  ? `https://tiktok.com/@${a.handle}`
                  : null,
      })),
  };
}

export const api = {
  me: {
    get: () =>
      respond(
        () => ({
          signedIn: me.signedIn,
          firstName: me.firstName,
          lastName: me.lastName,
          phone: me.phone,
          alias: me.alias,
          notificationDetail: me.notificationDetail,
          appLock: me.appLock,
          marketing: me.marketing,
        }),
        40,
      ),
    signIn: (phone: string, otp: string) =>
      respond(() => {
        if (phone.replace(/\D/g, '').length < 9) throw new ApiError('Enter your mobile number.');
        if (!/^\d{6}$/.test(otp)) throw new ApiError('Enter the 6-digit code we sent you.');
        me = { ...me, signedIn: true, phone };
        save();
        return true;
      }, 400),
    signOut: () =>
      respond(() => {
        me = { ...me, signedIn: false };
        save();
        return true;
      }),
    update: (
      patch: Partial<
        Pick<GuestSession, 'alias' | 'notificationDetail' | 'appLock' | 'marketing' | 'firstName'>
      >,
    ) =>
      respond(() => {
        me = { ...me, ...patch };
        save();
        return true;
      }),
  },

  /** Enter a store with a private code or link (spec §6, §8). */
  enter: (rawCode: string) =>
    respond(() => {
      const code = rawCode.trim().toUpperCase();
      if (!code) throw new ApiError('Enter a code.');
      const c = db.codes.find((x) => x.code === code);
      if (!c)
        throw new ApiError(
          "We couldn't find that code. Check the spelling, or ask the House for a new one.",
        );
      if (c.status === 'revoked')
        throw new ApiError('That code is no longer active. Ask the House for a new one.');
      if (c.status === 'expired' || (c.expiresAt && c.expiresAt < new Date().toISOString()))
        throw new ApiError('That code has expired.');
      if (c.usageLimit !== null && c.uses >= c.usageLimit)
        throw new ApiError('That code has reached its limit.');
      const t = db.tenants.find((x) => x.id === c.tenantId);
      if (!t) throw new ApiError('Store not found');
      if (t.status !== 'live')
        throw new ApiError(`${t.name} isn't open for bookings yet. Try again soon.`);
      const existing = admission(t.id);
      if (existing) {
        existing.hidden = false;
        if (c.scope === 'invite_items') existing.scope = 'invite_items';
      } else {
        me.admissions.unshift({
          tenantId: t.id,
          code,
          scope: c.scope,
          at: new Date().toISOString(),
          hidden: false,
        });
        c.uses += 1;
      }
      // First touch is permanent: an existing profile keeps its original attribution.
      if (!profileIn(t.id)) {
        db.guests.push({
          id: `g_me_${t.id}`,
          tenantId: t.id,
          firstName: me.firstName,
          lastName: me.lastName,
          alias: me.alias,
          phone: me.phone,
          attribution: 'own_channel',
          attributionDetail: `Code ${code}`,
          admittedAt: new Date().toISOString(),
          visits: 0,
          spend: 0,
          lastVisit: null,
          notes: '',
          preferences: [],
          tags: [],
          membershipTierId: null,
          packageCredits: 0,
          imported: false,
        });
      }
      save();
      return {
        handle: t.handle.toLowerCase(),
        name: t.name,
        unlockedExtras: c.scope === 'invite_items',
      };
    }, 450),

  places: () =>
    respond(() =>
      me.admissions.map((a) => {
        const t = db.tenants.find((x) => x.id === a.tenantId);
        const sf = db.storefronts.find((x) => x.tenantId === a.tenantId);
        const next = db.bookings
          .filter(
            (b) =>
              b.tenantId === a.tenantId &&
              b.guestId === profileIn(a.tenantId)?.id &&
              b.start > new Date().toISOString() &&
              BLOCKING.includes(b.state),
          )
          .sort((x, y) => x.start.localeCompare(y.start))[0];
        return {
          handle: t?.handle.toLowerCase() ?? '',
          name: t?.name ?? '',
          area: t?.area ?? '',
          vertical: t?.vertical ?? 'spa',
          theme: sf?.theme ?? 'emerald',
          accent: sf?.accent ?? '#C8A96A',
          palette: designOf(sf).palette,
          logo: sf?.logo ?? null,
          hidden: a.hidden,
          enteredAt: a.at,
          nextBooking: next ? { start: next.start, id: next.id } : null,
        };
      }),
    ),
  hidePlace: (handle: string, hidden: boolean) =>
    respond(() => {
      const a = admission(tenantByHandle(handle).id);
      if (a) a.hidden = hidden;
      save();
      return true;
    }),

  /** Marketplace search. Private stores are never returned, even on an exact name match. */
  discover: (query: string, category: string | null) =>
    respond(() => {
      const q = query.trim().toLowerCase();
      const results = LISTINGS.filter(
        (l) =>
          (!category || l.category === category) &&
          (!q || `${l.name} ${l.area} ${l.category}`.toLowerCase().includes(q)),
      );
      const privateMatch =
        q.length > 2 &&
        db.tenants.some((t) => t.visibility === 'private' && t.name.toLowerCase().includes(q));
      return { results, privateMatch };
    }),
  listing: (handle: string) =>
    respond(() => {
      const l = LISTINGS.find((x) => x.handle === handle);
      if (!l) throw new ApiError('Listing not found');
      return l;
    }),

  /** A store as this guest is allowed to see it (spec §9). */
  store: (handle: string) =>
    respond(() => {
      const t = tenantByHandle(handle);
      const a = admission(t.id);
      if (!a) throw new ApiError('PRIVATE');
      const sf = db.storefronts.find((x) => x.tenantId === t.id);
      const profile = profileIn(t.id);
      const categories = db.categories
        .filter((c) => c.tenantId === t.id && visible(c.visibility, t.id))
        .sort((x, y) => x.order - y.order);
      const services = db.services.filter(
        (s) =>
          s.tenantId === t.id &&
          visible(s.visibility, t.id) &&
          categories.some((c) => c.id === s.categoryId),
      );
      const staff = db.resources
        .filter((r) => r.tenantId === t.id && r.type === 'staff' && r.visible)
        .map((r) => ({
          id: r.id,
          name: r.name,
          title: r.title ?? '',
          specialties: r.specialties ?? [],
          languages: r.languages ?? [],
          guestsCanChoose: r.guestsCanChoose ?? false,
        }));
      const reviews = db.reviews.filter((r) => r.tenantId === t.id);
      const paidBooking =
        profile &&
        db.bookings.some(
          (b) => b.guestId === profile.id && b.paid > 0 && BLOCKING.includes(b.state),
        );
      const loc = db.locations.find((l) => l.tenantId === t.id);
      return {
        tenant: {
          name: t.name,
          handle: t.handle.toLowerCase(),
          tagline: sf?.tagline ?? t.tagline,
          description: t.description,
          area: t.area,
          vertical: t.vertical,
          timezone: t.timezone,
          verified: t.verification === 'approved',
        },
        theme: sf?.theme ?? 'emerald',
        ...designOf(sf),
        sections: (sf?.sections ?? []).filter((s) => s.enabled).map((s) => s.kind),
        showContacts: sf?.showContacts ?? false,
        categories,
        services,
        addOns: db.addOns.filter((x) => x.tenantId === t.id && visible(x.visibility, t.id)),
        staff,
        tiers: db.tiers.filter((x) => x.tenantId === t.id && visible(x.visibility, t.id)),
        packages: db.packages.filter((x) => x.tenantId === t.id && visible(x.visibility, t.id)),
        products: db.products.filter(
          (x) => x.tenantId === t.id && visible(x.visibility, t.id) && x.stock > 0,
        ),
        giftCards: db.giftCards.filter((x) => x.tenantId === t.id && visible(x.visibility, t.id)),
        content: db.content
          .filter((c) => c.tenantId === t.id && c.moderation === 'approved')
          .map((c) => ({
            ...c,
            unlocked:
              c.price === null &&
              (c.tierIds.length === 0 || visible('members_only', t.id, c.tierIds)),
          })),
        rating: reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : null,
        reviews: reviews.slice(0, 6).map((r) => ({
          id: r.id,
          rating: r.rating,
          body: r.body,
          reply: r.reply,
          at: r.at,
          service: r.serviceName,
        })),
        hours: loc?.hours ?? [],
        // Exact address and arrival instructions are released only after payment (spec §5.3).
        address: paidBooking ? (loc?.address ?? null) : null,
        arrival: paidBooking ? (loc?.arrivalInstructions ?? null) : null,
        policies: db.policies[t.id] as Policies,
        unlockedExtras: a.scope === 'invite_items',
        liveNow: db.content.some(
          (c) => c.tenantId === t.id && c.kind === 'live' && c.live?.status === 'live',
        ),
        membership: profile?.membershipTierId ?? null,
        credits: profile?.packageCredits ?? 0,
      };
    }),

  slots: (
    handle: string,
    serviceId: string,
    variantId: string,
    staffId: string | null,
    day: string,
  ) =>
    respond(() => {
      const t = tenantByHandle(handle);
      const s = db.services.find((x) => x.id === serviceId && x.tenantId === t.id);
      const v = s?.variants.find((x) => x.id === variantId);
      if (!s || !v) return [];
      const pol = db.policies[t.id];
      const earliest = new Date(Date.now() + (pol?.leadTimeHours ?? 0) * 3600_000).toISOString();
      const candidates = staffId ? [staffId] : s.staffIds;
      const out: { start: string; label: string; staffId: string }[] = [];
      for (let m = 9 * 60; m + v.durationMin <= 19 * 60 + 30; m += 30) {
        const label = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const start = zonedToUtc(day, label, t.timezone);
        if (start < earliest) continue;
        const end = new Date(
          new Date(start).getTime() + (v.durationMin + s.bufferAfterMin) * 60_000,
        ).toISOString();
        const free = candidates.find(
          (sid) =>
            !db.bookings.some(
              (b) =>
                b.tenantId === t.id &&
                BLOCKING.includes(b.state) &&
                b.staffId === sid &&
                overlaps(b.start, b.end, start, end),
            ) &&
            !db.blocks.some(
              (bl) => bl.resourceId === sid && overlaps(bl.start, bl.end, start, end),
            ),
        );
        if (free) out.push({ start, label, staffId: free });
      }
      return out;
    }, 220),

  /** Place a hold and create the booking (spec §10.1–10.2). */
  book: (input: {
    handle: string;
    serviceId: string;
    variantId: string;
    staffId: string;
    start: string;
    addOnIds: string[];
    notes: string;
    alias: string | null;
    method: 'mpesa' | 'card' | 'credit';
    idempotencyKey: string;
  }) =>
    respond(() => {
      if (!me.signedIn) throw new ApiError('Sign in to book.');
      const t = tenantByHandle(input.handle);
      const replay = db.bookings.find((b) =>
        b.events.some((e) => e.label === `idem:${input.idempotencyKey}`),
      );
      if (replay) return replay;
      const s = db.services.find((x) => x.id === input.serviceId && x.tenantId === t.id);
      const v = s?.variants.find((x) => x.id === input.variantId);
      if (!s || !v) throw new ApiError('That option is no longer available.');
      const addOns = db.addOns.filter((a) => input.addOnIds.includes(a.id));
      const dur = v.durationMin + addOns.reduce((n, a) => n + a.durationMin, 0);
      const end = new Date(new Date(input.start).getTime() + dur * 60_000).toISOString();
      const clash = db.bookings.some(
        (b) =>
          b.tenantId === t.id &&
          BLOCKING.includes(b.state) &&
          b.staffId === input.staffId &&
          overlaps(b.start, b.end, input.start, end),
      );
      if (clash) throw new ApiError('Someone just booked that time. Please choose another.');
      const profile = profileIn(t.id);
      if (!profile) throw new ApiError('Enter the store first.');
      if (input.alias !== null) profile.alias = input.alias || null;
      const pol = db.policies[t.id];
      const total = v.price + addOns.reduce((n, a) => n + a.price, 0);
      const deposit =
        input.method === 'credit'
          ? 0
          : pol?.paymentAtBooking === 'percent_deposit'
            ? Math.round((total * pol.depositValue) / 100)
            : pol?.paymentAtBooking === 'fixed_deposit'
              ? pol.depositValue * 100
              : pol?.paymentAtBooking === 'full'
                ? total
                : 0;
      const now = new Date().toISOString();
      if (input.method === 'credit') {
        if (profile.packageCredits < 1) throw new ApiError('You have no package credits left.');
        profile.packageCredits -= 1;
      }
      const room = db.resources.find(
        (r) =>
          r.tenantId === t.id &&
          r.type === 'room' &&
          !db.bookings.some(
            (b) =>
              BLOCKING.includes(b.state) &&
              b.roomId === r.id &&
              overlaps(b.start, b.end, input.start, end),
          ),
      );
      const b: Booking = {
        id: `bk_g_${Date.now()}`,
        ref: `SV-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        tenantId: t.id,
        guestId: profile.id,
        serviceId: s.id,
        variantId: v.id,
        staffId: input.staffId,
        roomId: room?.id ?? null,
        unitId: null,
        start: input.start,
        end,
        guests: 1,
        state:
          input.method === 'credit' || deposit === 0
            ? pol?.approval === 'request'
              ? 'requested'
              : 'confirmed'
            : 'pending_payment',
        total,
        paid: 0,
        deposit,
        attribution: profile.attribution,
        channel: 'store',
        notes: input.notes,
        createdAt: now,
        requestExpiresAt: null,
        events: [
          { at: now, label: 'Booked in store', actor: 'Guest' },
          { at: now, label: `idem:${input.idempotencyKey}`, actor: 'system' },
        ],
      };
      db.bookings.push(b);
      return b;
    }, 500),

  /** Simulates the M-Pesa / card callback arriving. */
  confirmPayment: (bookingId: string, success: boolean) =>
    respond(() => {
      const b = db.bookings.find((x) => x.id === bookingId);
      if (!b) throw new ApiError('Booking not found');
      if (!success) {
        b.events.push({
          at: new Date().toISOString(),
          label: 'Payment cancelled',
          actor: 'M-Pesa',
        });
        return b;
      }
      b.paid = b.deposit;
      const pol = db.policies[b.tenantId];
      b.state = pol?.approval === 'request' ? 'requested' : 'confirmed';
      b.events.push({ at: new Date().toISOString(), label: 'Payment received', actor: 'M-Pesa' });
      return b;
    }, 300),

  bookings: () =>
    respond(() => {
      const mineIds = new Set(me.admissions.map((a) => profileIn(a.tenantId)?.id).filter(Boolean));
      return db.bookings
        .filter((b) => mineIds.has(b.guestId))
        .map((b) => {
          const t = db.tenants.find((x) => x.id === b.tenantId);
          const s = db.services.find((x) => x.id === b.serviceId);
          const v = s?.variants.find((x) => x.id === b.variantId);
          const staff = db.resources.find((r) => r.id === b.staffId);
          return {
            ...b,
            storeName: t?.name ?? '',
            handle: t?.handle.toLowerCase() ?? '',
            timezone: t?.timezone ?? 'Africa/Nairobi',
            serviceName: s?.name ?? 'Stay',
            variantName: v?.name ?? '',
            staffName: staff?.name.split(' ')[0] ?? null,
            freeCancelHours: db.policies[b.tenantId]?.freeCancelHours ?? 24,
          };
        })
        .sort((x, y) => y.start.localeCompare(x.start));
    }),

  /** Refund preview and cancellation by the guest (spec §10.4). */
  cancel: (bookingId: string) =>
    respond(() => {
      const b = db.bookings.find((x) => x.id === bookingId);
      if (!b || !BLOCKING.includes(b.state))
        throw new ApiError('This booking can no longer be cancelled.');
      b.state = 'cancelled_by_guest';
      b.events.push({ at: new Date().toISOString(), label: 'Cancelled by guest', actor: 'Guest' });
      return b;
    }),

  wallet: () =>
    respond(() => {
      return me.admissions.map((a) => {
        const t = db.tenants.find((x) => x.id === a.tenantId);
        const p = profileIn(a.tenantId);
        const tier = db.tiers.find((x) => x.id === p?.membershipTierId);
        return {
          store: t?.name ?? '',
          handle: t?.handle.toLowerCase() ?? '',
          credits: p?.packageCredits ?? 0,
          membership: tier
            ? {
                name: tier.name,
                perks: tier.perks,
                renews: addDaysKey(dayKey(new Date(), 'Africa/Nairobi'), 18),
              }
            : null,
          giftCard: a.tenantId === 't_serenity' ? 450000 : 0,
        };
      });
    }),

  chat: {
    get: (handle: string) =>
      respond(() => {
        const t = tenantByHandle(handle);
        const p = profileIn(t.id);
        const c = db.conversations.find((x) => x.tenantId === t.id && x.guestId === p?.id);
        return { storeName: t.name, messages: c?.messages ?? [] };
      }),
    send: (handle: string, body: string) =>
      respond(() => {
        const t = tenantByHandle(handle);
        const p = profileIn(t.id);
        if (!p) throw new ApiError('Enter the store first.');
        let c = db.conversations.find((x) => x.tenantId === t.id && x.guestId === p.id);
        if (!c) {
          c = {
            id: `cv_g_${Date.now()}`,
            tenantId: t.id,
            guestId: p.id,
            assignedTo: null,
            unread: 0,
            messages: [],
          };
          db.conversations.push(c);
        }
        c.messages.push({
          id: `m_${Date.now()}`,
          from: 'guest',
          author: me.firstName,
          body,
          at: new Date().toISOString(),
        });
        c.unread += 1;
        const reply = c;
        setTimeout(() => {
          reply.messages.push({
            id: `m_${Date.now()}_r`,
            from: 'staff',
            author: t.name,
            body: 'Thank you for your message. We will reply shortly.',
            at: new Date().toISOString(),
          });
        }, 1500);
        return c.messages;
      }),
  },
};

export type StoreView = Awaited<ReturnType<typeof api.store>>;
export type GuestBooking = Awaited<ReturnType<typeof api.bookings>>[number];
export type Me = Awaited<ReturnType<typeof api.me.get>>;
export { LISTINGS };
