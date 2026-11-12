// Guest API client: talks to the Stayvinci API (apps/api). Same function names the screens
// used with the prototype data, so pages stay unchanged where the backend already exists.
// Features without a backend yet (memberships, packages, gift cards, content, chat, wallet,
// in-app payment) return empty data, so their screens show empty states instead of fake data.
import {
  DEFAULT_MARQUEE,
  DEFAULT_SEASON,
  PRESET_PALETTES,
  activeSeason,
  finalizePalette,
  marqueeLines,
  resolvePalette,
} from '@stayvinci/demo-data/design';
import type {
  AddOn,
  Booking,
  BookingState,
  Category,
  ContentItem,
  GiftCardType,
  Location,
  MembershipTier,
  PackageOffer,
  Policies,
  Product,
  SectionKind,
  SectionStyle,
  SocialNetwork,
  Service,
  StoreCover,
  StoreMarquee,
  StorePalette,
  StoreSeason,
} from '@stayvinci/demo-data/types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly code = '',
  ) {
    super(message);
  }
}

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

/* ---------- Local state: tokens, preferences, entered stores ---------- */

interface Tokens {
  access_token: string;
  refresh_token: string;
}
interface Prefs {
  alias: string | null;
  firstName: string | null;
  phone: string;
  notificationDetail: 'neutral' | 'detailed';
  appLock: boolean;
  marketing: boolean;
}
interface Place {
  handle: string;
  code: string | null;
  at: string;
  hidden: boolean;
}

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...(JSON.parse(raw) as T) } as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // storage unavailable (private window): the session lasts until the tab closes
  }
};

let tokens: Tokens | null = read<Tokens | null>('sv.guest.tokens', null);
let prefs: Prefs = read<Prefs>('sv.guest.prefs', {
  alias: null,
  firstName: null,
  phone: '',
  notificationDetail: 'neutral',
  appLock: false,
  marketing: false,
});
const readPlaces = (): Place[] => {
  try {
    const raw = localStorage.getItem('sv.guest.places');
    return raw ? (JSON.parse(raw) as Place[]) : [];
  } catch {
    return [];
  }
};
const places: Place[] = readPlaces();

const setTokens = (t: Tokens | null) => {
  tokens = t;
  write('sv.guest.tokens', t);
};
const savePrefs = () => write('sv.guest.prefs', prefs);
const savePlaces = () => write('sv.guest.places', places);
const codeFor = (handle: string) => places.find((p) => p.handle === handle)?.code ?? null;

function remember(handle: string, code: string | null = null) {
  const found = places.find((p) => p.handle === handle);
  if (found) {
    found.hidden = false;
    if (code) found.code = code;
  } else places.unshift({ handle, code, at: new Date().toISOString(), hidden: false });
  savePlaces();
}

/* ---------- HTTP ---------- */

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  if (!tokens) return false;
  refreshing ??= fetch(`${API_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: tokens.refresh_token }),
  })
    .then(async (r) => {
      if (!r.ok) {
        setTokens(null);
        return false;
      }
      setTokens((await r.json()) as Tokens);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function http<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  opts: { body?: unknown; headers?: Record<string, string>; auth?: boolean } = {},
): Promise<T> {
  const send = () =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.auth !== false && tokens
          ? { Authorization: `Bearer ${tokens.access_token}` }
          : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : null,
    });
  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && tokens && opts.auth !== false && (await refresh()))
      res = await send();
  } catch {
    throw new ApiError("Can't reach Stayvinci. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as
    (T & { error?: { code: string; message: string } }) | null;
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(
      e?.message ?? 'Something went wrong. Please try again.',
      res.status,
      e?.code ?? '',
    );
  }
  return data as T;
}

const storeHeaders = (handle: string): Record<string, string> => {
  const code = codeFor(handle);
  return code ? { 'X-Store-Code': code } : {};
};

/* ---------- API shapes (see Swagger at /docs) ---------- */

type Hours = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', [string, string][]>
>;
interface Card {
  handle: string;
  name: string;
  kind: 'house' | 'atelier';
  vertical: 'spa' | 'short_stay' | 'atelier';
  tagline: string;
  area: string | null;
  city: string | null;
  logo_url: string | null;
  cover_url: string | null;
  highlights: string[];
  from_price_minor: number | null;
  currency: string;
  rating: { average: number | null; count: number };
}
interface Detail extends Card {
  about: string;
  amenities: string[];
  gallery: string[];
  design: Record<string, unknown>;
  socials: Record<string, string>;
  policies: Record<string, string>;
  locations: {
    id: string;
    name: string;
    area: string | null;
    city: string | null;
    timezone: string;
    hours: Hours;
  }[];
  categories: { id: string; name: string; image_url: string | null }[];
  services: {
    id: string;
    category_id: string | null;
    name: string;
    description: string;
    image_url: string | null;
    icon: string | null;
    requires: string[];
    variants: {
      id: string;
      name: string;
      duration_min: number;
      price_minor: number;
      currency: string;
    }[];
  }[];
  team: {
    id: string;
    name: string;
    title: string | null;
    bio: string;
    specialties: string[];
    photo_url: string | null;
  }[];
  rooms: {
    id: string;
    type: 'room' | 'unit';
    name: string;
    description: string;
    amenities: string[];
    gallery: string[];
    capacity: number;
  }[];
  reviews: {
    id: string;
    rating: number;
    comment: string;
    reply: string | null;
    created_at: string;
  }[];
}
interface ApiBooking {
  id: string;
  ref: string;
  store: { handle: string; name: string };
  state: BookingState;
  starts_at: string;
  ends_at: string;
  service: string;
  variant: string;
  with: string | null;
  total_minor: number;
  currency: string;
  can_cancel: boolean;
  can_review: boolean;
}

/* ---------- Mapping the API store to what the store screens draw ---------- */

const DAYS = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
] as const;

function hoursOf(h: Hours | undefined): Location['hours'] {
  return DAYS.map(([k, label]) => {
    const spans = h?.[k] ?? [];
    const first = spans[0];
    const last = spans[spans.length - 1];
    return first && last
      ? { day: label, open: first[0], close: last[1], closed: false }
      : { day: label, open: '', close: '', closed: true };
  });
}

function paletteOf(design: Record<string, unknown>): StorePalette | null {
  const p = design.palette as
    { preset?: string } | (Partial<StorePalette> & { bg?: string }) | undefined;
  if (!p) return null;
  if ('preset' in p && p.preset) {
    const preset = PRESET_PALETTES.find((x) => x.id === p.preset);
    return preset ? finalizePalette(preset) : null;
  }
  return 'bg' in p && p.bg && 'accent' in p && p.accent ? finalizePalette(p as StorePalette) : null;
}

const VERTICAL_LABEL = { spa: 'Spa', short_stay: 'Short stays', atelier: 'Atelier' } as const;

function designOf(d: Detail) {
  const raw = d.design ?? {};
  const theme = (
    ['emerald', 'noir', 'ivory', 'plum'].includes(raw.theme as string) ? raw.theme : 'emerald'
  ) as 'emerald' | 'noir' | 'ivory' | 'plum';
  const season = { ...DEFAULT_SEASON, ...(raw.season as Partial<StoreSeason> | undefined) };
  const base = { theme, accent: '#C8A96A', palette: paletteOf(raw), season };
  const palette = resolvePalette(base);
  const active = activeSeason(season);
  const marquee: StoreMarquee = {
    ...DEFAULT_MARQUEE,
    ...(raw.marquee as Partial<StoreMarquee> | undefined),
  };
  const cover: StoreCover = {
    image: d.cover_url,
    headline: d.name,
    subline: d.tagline,
    layout: d.cover_url ? 'full' : 'color',
    ctaLabel: 'Book a visit',
    ...(raw.cover as Partial<StoreCover> | undefined),
  };
  const SOCIAL_URL: Record<string, (h: string) => string> = {
    instagram: (h) => `https://instagram.com/${h}`,
    facebook: (h) => `https://facebook.com/${h}`,
    x: (h) => `https://x.com/${h}`,
    tiktok: (h) => `https://tiktok.com/@${h}`,
  };
  return {
    theme,
    palette,
    accent: palette.accent,
    logo: d.logo_url,
    season: active
      ? { id: active.id, name: active.name, motif: active.motif, colors: active.colors }
      : null,
    marquee: marquee.enabled
      ? { speed: marquee.speed, style: marquee.style, lines: marqueeLines(marquee, active) }
      : null,
    sectionStyles: {} as Partial<Record<SectionKind, SectionStyle>>,
    cover,
    socials: Object.entries(d.socials ?? {})
      .filter(([n]) => n in SOCIAL_URL)
      .map(([network, h]) => ({
        network: network as SocialNetwork,
        handle: h,
        url: SOCIAL_URL[network]?.(h) ?? null,
      })),
  };
}

function policiesOf(d: Detail): Policies & { text: Record<string, string> } {
  return {
    paymentAtBooking: 'none',
    depositValue: 0,
    balance: 'at_venue',
    freeCancelHours: 2,
    lateCancel: 'deposit_kept',
    lateCancelPct: 0,
    noShow: 'fee_request',
    leadTimeHours: 0.5,
    horizonDays: 60,
    whoCanBook: 'anyone',
    approval: 'instant',
    approvalWindowHours: 0,
    maxPerGuestPerDay: 3,
    maxPartySize: 2,
    text: d.policies ?? {},
  };
}

function toStoreView(d: Detail) {
  const tz = d.locations[0]?.timezone ?? 'Africa/Nairobi';
  const uncategorised = d.services.some((s) => !s.category_id);
  const categories: Category[] = [
    ...d.categories.map((c, i) => ({
      id: c.id,
      tenantId: d.handle,
      name: c.name,
      order: i,
      visibility: 'public' as const,
      image: c.image_url,
    })),
    ...(uncategorised
      ? [
          {
            id: '_other',
            tenantId: d.handle,
            name: VERTICAL_LABEL[d.vertical],
            order: 99,
            visibility: 'public' as const,
          },
        ]
      : []),
  ].filter((c) => d.services.some((s) => (s.category_id ?? '_other') === c.id));
  const team = d.team.map((r) => ({
    id: r.id,
    name: r.name,
    title: r.title ?? '',
    bio: r.bio,
    photo: r.photo_url,
    specialties: r.specialties,
    languages: [] as string[],
    guestsCanChoose: true,
  }));
  const services: Service[] = d.services.map((s) => ({
    id: s.id,
    tenantId: d.handle,
    categoryId: s.category_id ?? '_other',
    name: s.name,
    description: s.description,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    requires: s.requires as Service['requires'],
    variants: s.variants.map((v) => ({
      id: v.id,
      name: v.name,
      durationMin: v.duration_min,
      price: v.price_minor,
    })),
    visibility: 'public',
    // The API decides who can deliver it; every shown team member is offered as a choice and
    // availability answers for the one picked.
    staffIds: team.map((t) => t.id),
    taxClass: 'standard',
    image: s.image_url,
    icon: s.icon,
  }));
  const rating = d.rating.average;
  // Store landing order. Empty blocks are skipped by the page.
  const sections: string[] = [
    'hero',
    'featured',
    'highlights',
    'rooms',
    'team',
    'gallery',
    'reviews',
    'policies',
    'location',
  ];
  return {
    tenant: {
      name: d.name,
      handle: d.handle,
      tagline: d.tagline,
      description: d.about,
      area: [d.area, d.city].filter(Boolean).join(', '),
      vertical: d.vertical,
      kind: d.kind,
      timezone: tz,
      verified: true,
    },
    ...designOf(d),
    sections,
    showContacts: false,
    highlights: d.highlights,
    amenities: d.amenities,
    gallery: d.gallery,
    rooms: d.rooms,
    categories,
    services,
    addOns: [] as AddOn[],
    staff: team,
    tiers: [] as MembershipTier[],
    packages: [] as PackageOffer[],
    products: [] as Product[],
    giftCards: [] as GiftCardType[],
    content: [] as (ContentItem & { unlocked: boolean })[],
    rating,
    ratingCount: d.rating.count,
    reviews: d.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.comment,
      reply: r.reply,
      at: r.created_at,
      service: '',
    })),
    hours: hoursOf(d.locations[0]?.hours),
    // The exact address is shared in the booking, never on the public store.
    address: null as string | null,
    arrival: null as string | null,
    policies: policiesOf(d),
    unlockedExtras: false,
    liveNow: false,
    membership: null as string | null,
    credits: 0,
  };
}

function toBooking(b: ApiBooking): Booking & { with: string | null } {
  return {
    id: b.id,
    ref: b.ref,
    tenantId: b.store.handle,
    guestId: '',
    serviceId: null,
    variantId: null,
    staffId: null,
    roomId: null,
    unitId: null,
    start: b.starts_at,
    end: b.ends_at,
    guests: 1,
    state: b.state,
    total: b.total_minor,
    paid: 0,
    deposit: 0,
    attribution: 'own_channel',
    channel: 'store',
    notes: '',
    createdAt: b.starts_at,
    requestExpiresAt: null,
    events: [],
    with: b.with,
  };
}

const cards = (q: { q?: string; vertical?: string }) => {
  const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]);
  return http<{ items: Card[] }>('GET', `/v1/stores${p.size ? `?${p}` : ''}`, { auth: false });
};

/* ---------- The guest API ---------- */

export const DISCOVER_CATEGORIES = [
  { label: 'Spas', vertical: 'spa' },
  { label: 'Therapists & artists', vertical: 'atelier' },
  { label: 'Rooms & stays', vertical: 'short_stay' },
] as const;

export const api = {
  me: {
    get: async () => {
      const base = {
        signedIn: false,
        firstName: prefs.firstName ?? 'Guest',
        lastName: '',
        phone: prefs.phone,
        email: null as string | null,
        alias: prefs.alias,
        notificationDetail: prefs.notificationDetail,
        appLock: prefs.appLock,
        marketing: prefs.marketing,
      };
      if (!tokens) return base;
      try {
        const u = await http<{
          full_name: string | null;
          email: string | null;
          phone: string | null;
        }>('GET', '/v1/me');
        const [first = '', ...rest] = (u.full_name ?? '').split(' ');
        return {
          ...base,
          signedIn: true,
          firstName: prefs.firstName ?? (first || (u.email?.split('@')[0] ?? 'Guest')),
          lastName: rest.join(' '),
          phone: prefs.phone || (u.phone ?? ''),
          email: u.email,
        };
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) setTokens(null);
        return base;
      }
    },
    /** Emails a one-time sign-in link. New guests get an account when they open it. */
    requestLink: async (email: string) => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        throw new ApiError('Enter your email address.');
      await http('POST', '/v1/auth/magic-link', {
        body: { email: email.trim().toLowerCase(), audience: 'guest' },
        auth: false,
      });
      return true;
    },
    /** Completes sign-in from the emailed link (/auth/magic?token=…). */
    finishLink: async (token: string) => {
      const t = await http<Tokens>('POST', '/v1/auth/magic-link/verify', {
        body: { token, audience: 'guest' },
        auth: false,
      });
      setTokens(t);
      return true;
    },
    signOut: async () => {
      if (tokens) await http('POST', '/v1/auth/logout').catch(() => undefined);
      setTokens(null);
      return true;
    },
    update: async (
      patch: Partial<
        Pick<
          Prefs,
          'alias' | 'notificationDetail' | 'appLock' | 'marketing' | 'firstName' | 'phone'
        >
      >,
    ) => {
      prefs = { ...prefs, ...patch };
      savePrefs();
      return true;
    },
  },

  /** Enter a private store with its code (spec §6, §8). */
  enter: async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) throw new ApiError('Enter a code.');
    try {
      const r = await http<{ handle: string; name: string }>('POST', '/v1/stores/enter', {
        body: { code },
        auth: false,
      });
      remember(r.handle, code);
      return { ...r, unlockedExtras: false };
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 422))
        throw new ApiError(
          "We couldn't find that code. Check the spelling, or ask the House for a new one.",
        );
      throw e;
    }
  },

  /** Stores this guest entered or booked, newest first. */
  places: async () => {
    const booked = tokens ? await api.bookings().catch(() => []) : [];
    for (const b of booked) if (!places.some((p) => p.handle === b.handle)) remember(b.handle);
    const out = await Promise.all(
      places.map(async (p) => {
        try {
          const s = toStoreView(
            await http<Detail>('GET', `/v1/stores/${p.handle}`, {
              headers: storeHeaders(p.handle),
              auth: false,
            }),
          );
          const next = booked
            .filter(
              (b) =>
                b.handle === p.handle &&
                b.start > new Date().toISOString() &&
                ['confirmed', 'requested', 'pending_payment', 'held'].includes(b.state),
            )
            .sort((x, y) => x.start.localeCompare(y.start))[0];
          return {
            handle: p.handle,
            name: s.tenant.name,
            area: s.tenant.area,
            vertical: s.tenant.vertical,
            theme: s.theme,
            accent: s.accent,
            palette: s.palette,
            logo: s.logo,
            cover: s.cover.image,
            hidden: p.hidden,
            enteredAt: p.at,
            nextBooking: next ? { start: next.start, id: next.id } : null,
          };
        } catch {
          return null; // closed or its code changed
        }
      }),
    );
    return out.filter((x): x is NonNullable<typeof x> => x !== null);
  },
  hidePlace: async (handle: string, hidden: boolean) => {
    const p = places.find((x) => x.handle === handle);
    if (p) p.hidden = hidden;
    savePlaces();
    return true;
  },

  /** Marketplace search. Private stores are never returned. */
  discover: async (query: string, vertical: string | null) => {
    const res = await cards({ q: query.trim() || undefined, vertical: vertical ?? undefined } as {
      q?: string;
      vertical?: string;
    });
    return { results: res.items, privateMatch: false };
  },

  /** A store as this guest is allowed to see it (spec §9). */
  store: async (handle: string) => {
    try {
      const d = await http<Detail>('GET', `/v1/stores/${handle}`, {
        headers: storeHeaders(handle),
        auth: false,
      });
      return toStoreView(d);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) throw new ApiError('PRIVATE', 404);
      throw e;
    }
  },
  /** Opening a store adds it to My places. */
  visit: (handle: string) => remember(handle),

  slots: async (
    handle: string,
    _serviceId: string,
    variantId: string,
    staffId: string | null,
    day: string,
  ) => {
    if (!variantId) return [];
    const p = new URLSearchParams({ variant_id: variantId, date: day });
    if (staffId) p.set('resource_id', staffId);
    const a = await http<{
      timezone: string;
      slots: { starts_at: string; resource_ids: string[] }[];
    }>('GET', `/v1/stores/${handle}/availability?${p}`, {
      headers: storeHeaders(handle),
      auth: false,
    });
    const label = new Intl.DateTimeFormat('en-GB', {
      timeZone: a.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return a.slots.map((s) => ({
      start: s.starts_at,
      label: label.format(new Date(s.starts_at)),
      staffId: staffId ?? '',
    }));
  },

  /** Books the time (spec §10.1). The idempotency key makes a retried tap safe. */
  book: async (input: {
    handle: string;
    variantId: string;
    staffId: string;
    start: string;
    notes: string;
    idempotencyKey: string;
    via?: 'own_channel' | 'marketplace';
  }) => {
    const b = await http<ApiBooking>('POST', `/v1/stores/${input.handle}/bookings`, {
      headers: { ...storeHeaders(input.handle), 'Idempotency-Key': input.idempotencyKey },
      body: {
        variant_id: input.variantId,
        starts_at: input.start,
        ...(input.staffId ? { resource_id: input.staffId } : {}),
        ...(input.notes.trim() ? { notes: input.notes.trim() } : {}),
        via: input.via ?? (codeFor(input.handle) ? 'own_channel' : 'marketplace'),
      },
    }).catch((e: unknown) => {
      if (e instanceof ApiError && e.code === 'slot_taken')
        throw new ApiError('Someone just booked that time. Please choose another.', 409, e.code);
      throw e;
    });
    remember(input.handle);
    return toBooking(b);
  },

  bookings: async () => {
    if (!tokens) return [];
    const res = await http<{ items: ApiBooking[] }>('GET', '/v1/me/bookings');
    return res.items
      .map((b) => ({
        ...toBooking(b),
        storeName: b.store.name,
        handle: b.store.handle,
        timezone: 'Africa/Nairobi',
        serviceName: b.service,
        variantName: b.variant,
        staffName: b.with?.split(' ')[0] ?? null,
        freeCancelHours: 2,
        canCancel: b.can_cancel,
        canReview: b.can_review,
      }))
      .sort((x, y) => y.start.localeCompare(x.start));
  },

  cancel: (bookingId: string) =>
    http<ApiBooking>('POST', `/v1/me/bookings/${bookingId}/cancel`).then(toBooking),

  review: (bookingId: string, rating: number, comment: string) =>
    http('POST', `/v1/me/bookings/${bookingId}/review`, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: { rating, comment },
    }),

  /** Memberships, packages and gift cards arrive with payments (phase P2). */
  wallet: async () =>
    [] as {
      store: string;
      handle: string;
      credits: number;
      membership: { name: string; perks: string[]; renews: string } | null;
      giftCard: number;
    }[],

  /** In-app messages arrive with notifications; until then the store page shows how to reach the House. */
  chat: {
    get: async (handle: string) => {
      const s = await api.store(handle);
      return {
        storeName: s.tenant.name,
        messages: [] as {
          id: string;
          from: 'guest' | 'staff';
          author: string;
          body: string;
          at: string;
        }[],
      };
    },
    send: async (_handle: string, _body: string) => {
      throw new ApiError('Messages are coming soon. For now, add a note to your booking.');
    },
  },
};

export type StoreView = Awaited<ReturnType<typeof api.store>>;
export type GuestBooking = Awaited<ReturnType<typeof api.bookings>>[number];
export type Me = Awaited<ReturnType<typeof api.me.get>>;
export type StoreCard = Card;
