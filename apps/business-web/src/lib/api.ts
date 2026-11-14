// Business app client for the Stayvinci API (apps/api). It keeps the function names and
// shapes the screens were built with (the old in-browser mock, src/mock/api.ts, now only
// supplies the types), so pages stay unchanged where the backend already exists.
// Areas without a backend yet (payments, campaigns, content, billing, compliance, front-desk
// booking) show empty states, and their actions explain that they come in a later update.
import {
  DEFAULT_MARQUEE,
  DEFAULT_SEASON,
  PRESET_PALETTES,
  finalizePalette,
} from '@stayvinci/demo-data/design';
import type { Api, SessionInfo as MockSessionInfo } from '../mock/api';
import type {
  AccessCode,
  AuditEntry,
  Booking,
  BookingState,
  Capability,
  Category,
  Conversation,
  Guest,
  ItemVisibility,
  Location,
  Policies,
  Resource,
  ResourceType,
  Review,
  SectionKind,
  Service,
  SocialAccount,
  SocialNetwork,
  StoreCover,
  StoreMarquee,
  StorePalette,
  StoreSeason,
  Storefront,
  TeamMember,
  Tenant,
  TenantRole,
  VisibilityMode,
} from '../mock/types';
import { ROLE_BUNDLES } from './capabilities';
import { addDaysKey, dayKey } from './format';

export type SessionInfo = MockSessionInfo;
export { addDaysKey };
export function todayKey(tz: string): string {
  return dayKey(new Date(), tz);
}

export class ApiError extends Error {
  constructor(
    public code: 'forbidden' | 'not_found' | 'conflict' | 'invalid' | 'unavailable' | string,
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

/** Thrown by actions whose backend hasn't been built yet. */
const soon = (what: string): never => {
  throw new ApiError(
    'unavailable',
    `${what} isn't switched on yet. It arrives in a coming update.`,
  );
};

/* ---------- Local state: tokens, current House, role preview ---------- */

interface Tokens {
  access_token: string;
  refresh_token: string;
  second_factor: 'not_required' | 'required' | 'setup_required' | 'completed';
}

const store = {
  get<T>(key: string, fallback: T, where: Storage = localStorage): T {
    try {
      const raw = where.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, v: unknown, where: Storage = localStorage) {
    try {
      if (v === null || v === undefined) where.removeItem(key);
      else where.setItem(key, JSON.stringify(v));
    } catch {
      // storage unavailable (private window): the session lasts until the tab closes
    }
  },
};

let tokens = store.get<Tokens | null>('sv.business.tokens', null);
let tenantId = store.get<string | null>('sv.business.tenant', null);
let viewAs = store.get<TenantRole | null>('sv.business.viewas', null, sessionStorage);

const setTokens = (t: Tokens | null) => {
  tokens = t;
  store.set('sv.business.tokens', t);
};
const setTenantId = (id: string | null) => {
  tenantId = id;
  store.set('sv.business.tenant', id);
};

/* ---------- HTTP ---------- */

let refreshing: Promise<boolean> | null = null;
function refresh(): Promise<boolean> {
  if (!tokens) return Promise.resolve(false);
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

const ERROR_CODES: Record<number, string> = {
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'invalid',
};

async function http<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  opts: { body?: unknown; idempotent?: boolean; auth?: boolean } = {},
): Promise<T> {
  const key = opts.idempotent ? crypto.randomUUID() : null;
  const send = () =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.auth !== false && tokens
          ? { Authorization: `Bearer ${tokens.access_token}` }
          : {}),
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : null,
    });
  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && tokens && opts.auth !== false && (await refresh()))
      res = await send();
  } catch {
    throw new ApiError(
      'unavailable',
      "Can't reach Stayvinci. Check your connection and try again.",
    );
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as
    (T & { error?: { code: string; message: string } }) | null;
  if (!res.ok) {
    const e = data?.error;
    if (res.status === 401 && opts.auth !== false) setTokens(null);
    throw new ApiError(
      ERROR_CODES[res.status] ?? e?.code ?? 'invalid',
      e?.message ?? 'Something went wrong. Please try again.',
      res.status,
    );
  }
  return data as T;
}

const T = () => `/v1/tenants/${tenantId ?? ''}`;

/* ---------- API shapes (see Swagger at /docs) ---------- */

interface ApiMe {
  id: string;
  full_name: string | null;
  email: string | null;
  two_factor_enabled: boolean;
}
interface ApiMyTenant {
  tenant_id: string;
  name: string;
  handle: string;
  kind: 'house' | 'atelier';
  role: TenantRole;
  capabilities: Capability[];
}
interface ApiInvitation {
  membership_id: string;
  tenant_name: string;
  role: TenantRole;
}
interface ApiTenant {
  id: string;
  handle: string;
  name: string;
  kind: 'house' | 'atelier';
  vertical: 'spa' | 'short_stay' | 'atelier';
  timezone: string;
  currency: string;
  status:
    | 'onboarding_unpaid'
    | 'onboarding'
    | 'pending_verification'
    | 'ready'
    | 'live'
    | 'past_due'
    | 'suspended'
    | 'closed';
  visibility: VisibilityMode;
}
interface ApiStorefront {
  tagline: string;
  about: string;
  highlights: string[];
  amenities: string[];
  area: string | null;
  city: string | null;
  logo_url: string | null;
  cover_url: string | null;
  gallery: string[];
  design: Record<string, unknown>;
  socials: Record<string, string>;
  policies: Record<string, string>;
  published: boolean;
  chat_enabled: boolean;
  access_code: string | null;
}
type Hours = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', [string, string][]>
>;
interface ApiLocation {
  id: string;
  name: string;
  timezone: string;
  area: string | null;
  city: string | null;
  address: Record<string, unknown>;
  hours: Hours;
}
interface ApiCategory {
  id: string;
  name: string;
  position: number;
  image_url: string | null;
}
interface ApiService {
  id: string;
  name: string;
  description: string;
  category_id: string | null;
  image_url: string | null;
  icon: string | null;
  visibility: string;
  buffer_before_min: number;
  buffer_after_min: number;
  requires: string[];
  active: boolean;
  variants: {
    id: string;
    name: string;
    duration_min: number;
    price_minor: number;
    currency: string;
  }[];
  resource_ids: string[];
}
interface ApiResource {
  id: string;
  type: ResourceType;
  name: string;
  title: string | null;
  bio: string;
  specialties: string[];
  photo_url: string | null;
  amenities: string[];
  capacity: number;
  show_on_store: boolean;
  position: number;
  active: boolean;
  location_id: string | null;
}
interface ApiMember {
  id: string;
  user_id: string;
  full_name: string | null;
  role: TenantRole;
  caps_added: Capability[];
  caps_removed: Capability[];
  status: 'invited' | 'active' | 'suspended';
}
interface ApiGuest {
  id: string;
  display_name: string;
  first_touch_source: 'own_channel' | 'marketplace';
  tags: string[];
  visits: number;
  spend_minor: number;
  last_visit_at: string | null;
  joined_at: string;
  notes: string;
  phone?: string;
  email?: string;
}
interface ApiBooking {
  id: string;
  ref: string;
  state: BookingState;
  starts_at: string;
  ends_at: string;
  guest: { id: string; alias: string | null };
  service: string;
  variant: string;
  service_id: string;
  variant_id: string;
  resources: { id: string; name: string; type: string }[];
  total_minor: number;
  paid_minor: number;
  currency: string;
  source: 'guest_app' | 'staff' | 'marketplace';
  notes: string | null;
  version: number;
  created_at: string;
}
interface ApiReview {
  id: string;
  rating: number;
  comment: string;
  reply: string | null;
  created_at: string;
  booking_ref: string;
}
interface ApiConversation {
  id: string;
  guest_label: string;
  last_message_at: string;
  last_sender: 'guest' | 'house' | null;
  preview: string;
  unread: boolean;
}
interface ApiThread {
  conversation: ApiConversation;
  messages: { id: string; sender: 'guest' | 'house'; body: string; created_at: string }[];
}
interface ApiAudit {
  id: number;
  actor: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  occurred_at: string;
}
interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

/* ---------- Request context (loaded by session.get) ---------- */

interface Ctx {
  me: ApiMe;
  mine: ApiMyTenant[];
  current: ApiMyTenant;
  tenant: ApiTenant;
  storefront: ApiStorefront | null;
}
let ctx: Ctx | null = null;

const need = (): Ctx => {
  if (!ctx) throw new ApiError('forbidden', 'Sign in again to continue.');
  return ctx;
};
const caps = (): Set<Capability> => {
  const c = need();
  return new Set(viewAs ? ROLE_BUNDLES[viewAs] : c.current.capabilities);
};
const can = (cap: Capability) => caps().has(cap);

/* ---------- Mappers: API → the shapes the screens use ---------- */

const STATUS: Record<ApiTenant['status'], Tenant['status']> = {
  onboarding_unpaid: 'draft',
  onboarding: 'onboarding',
  pending_verification: 'verification',
  ready: 'setup',
  live: 'live',
  past_due: 'past_due',
  suspended: 'suspended',
  closed: 'suspended',
};

function toTenant(t: ApiTenant, sf: ApiStorefront | null): Tenant {
  return {
    id: t.id,
    name: t.name,
    handle: t.handle,
    vertical: t.vertical === 'short_stay' ? 'short_stay' : 'spa',
    kind: t.kind,
    status: STATUS[t.status],
    visibility: t.visibility,
    timezone: t.timezone,
    currency: t.currency,
    area: sf?.area ?? '',
    tagline: sf?.tagline ?? '',
    description: sf?.about ?? '',
    accent: '#C8A96A',
    verification:
      t.status === 'live' || t.status === 'ready'
        ? 'approved'
        : t.status === 'pending_verification'
          ? 'pending'
          : 'not_started',
  };
}

const DAYS = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
] as const;

function toLocation(l: ApiLocation, sf: ApiStorefront | null): Location {
  const addr = l.address as Record<string, string>;
  return {
    id: l.id,
    tenantId: tenantId ?? '',
    name: l.name,
    address: addr.line1 ?? Object.values(addr).filter(Boolean).join(', '),
    area: l.area ?? '',
    hours: DAYS.map(([k, label]) => {
      const spans = l.hours[k] ?? [];
      const first = spans[0];
      const last = spans[spans.length - 1];
      return first && last
        ? { day: label, open: first[0], close: last[1], closed: false }
        : { day: label, open: '09:00', close: '18:00', closed: true };
    }),
    arrivalInstructions: sf?.policies.arrival ?? '',
  };
}

function fromHours(hours: Location['hours']): Hours {
  const out: Hours = {};
  for (const [k, label] of DAYS) {
    const h = hours.find((x) => x.day === label);
    out[k] = h && !h.closed && h.open && h.close ? [[h.open, h.close]] : [];
  }
  return out;
}

const toCategory = (c: ApiCategory): Category => ({
  id: c.id,
  tenantId: tenantId ?? '',
  name: c.name,
  order: c.position,
  visibility: 'public',
  image: c.image_url,
});

const VIS: ItemVisibility[] = ['public', 'members_only', 'invite_only', 'hidden'];
const toService = (s: ApiService): Service => ({
  id: s.id,
  tenantId: tenantId ?? '',
  categoryId: s.category_id ?? '',
  name: s.name,
  description: s.description,
  bufferBeforeMin: s.buffer_before_min,
  bufferAfterMin: s.buffer_after_min,
  requires: s.requires.filter((r): r is ResourceType => ['staff', 'room', 'unit'].includes(r)),
  variants: s.variants.map((v) => ({
    id: v.id,
    name: v.name,
    durationMin: v.duration_min,
    price: v.price_minor,
  })),
  visibility: s.active
    ? VIS.includes(s.visibility as ItemVisibility)
      ? (s.visibility as ItemVisibility)
      : 'public'
    : 'hidden',
  staffIds: s.resource_ids,
  taxClass: 'standard',
  image: s.image_url,
  icon: s.icon,
});

const toResource = (r: ApiResource): Resource => ({
  id: r.id,
  tenantId: tenantId ?? '',
  type: r.type,
  name: r.name,
  locationId: r.location_id ?? '',
  capacity: r.capacity,
  visible: r.show_on_store,
  ...(r.title ? { title: r.title } : {}),
  specialties: r.specialties,
  amenities: r.amenities,
  guestsCanChoose: r.show_on_store,
});

const toMember = (m: ApiMember): TeamMember => ({
  id: m.id,
  tenantId: tenantId ?? '',
  name: m.full_name ?? 'Team member',
  email: '',
  role: m.role,
  added: m.caps_added,
  removed: m.caps_removed,
  status: m.status === 'invited' ? 'invited' : 'active',
  twoFactor: false,
  lastActive: null,
  staffId: null,
});

const toGuest = (g: ApiGuest): Guest => ({
  id: g.id,
  tenantId: tenantId ?? '',
  firstName: g.display_name,
  lastName: '',
  alias: null,
  ...(g.phone ? { phone: g.phone } : {}),
  ...(g.email ? { email: g.email } : {}),
  attribution: g.first_touch_source,
  attributionDetail:
    g.first_touch_source === 'marketplace' ? 'Found you on Stayvinci' : 'Your own link or code',
  admittedAt: g.joined_at,
  visits: g.visits,
  spend: g.spend_minor,
  lastVisit: g.last_visit_at,
  notes: g.notes,
  preferences: [],
  tags: g.tags,
  membershipTierId: null,
  packageCredits: 0,
  imported: false,
});

const versions = new Map<string, number>();
function toBooking(b: ApiBooking): Booking {
  versions.set(b.id, b.version);
  const of = (type: string) => b.resources.find((r) => r.type === type)?.id ?? null;
  return {
    id: b.id,
    ref: b.ref,
    tenantId: tenantId ?? '',
    guestId: b.guest.id,
    serviceId: b.service_id,
    variantId: b.variant_id,
    staffId: of('staff'),
    roomId: of('room'),
    unitId: of('unit'),
    start: b.starts_at,
    end: b.ends_at,
    guests: 1,
    state: b.state,
    total: b.total_minor,
    paid: b.paid_minor,
    deposit: 0,
    attribution: b.source === 'marketplace' ? 'marketplace' : 'own_channel',
    channel: b.source === 'staff' ? 'front_desk' : 'store',
    notes: b.notes ?? '',
    createdAt: b.created_at,
    requestExpiresAt: null,
    events: [
      {
        at: b.created_at,
        label: b.source === 'staff' ? 'Booked by the team' : 'Booked in the Stayvinci app',
        actor: b.source === 'staff' ? 'Team' : 'Guest',
      },
    ],
  };
}

/* ---------- Loaders with a short cache (many screens ask for the same lists) ---------- */

const cache = new Map<string, { at: number; value: Promise<unknown> }>();
function cached<V>(key: string, load: () => Promise<V>, ttl = 4000): Promise<V> {
  const k = `${tenantId ?? ''}:${key}`;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < ttl) return hit.value as Promise<V>;
  const value = load();
  cache.set(k, { at: Date.now(), value });
  value.catch(() => cache.delete(k));
  return value;
}
const forget = () => cache.clear();

async function allPages<V>(path: string): Promise<V[]> {
  const out: V[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const sep = path.includes('?') ? '&' : '?';
    const page: Page<V> = await http<Page<V>>(
      'GET',
      `${path}${sep}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    );
    out.push(...page.items);
    cursor = page.next_cursor;
    if (!cursor) break;
  }
  return out;
}

const loadGuests = () =>
  cached('guests', async () =>
    can('guest.view') ? (await allPages<ApiGuest>(`${T()}/guests`)).map(toGuest) : [],
  );

/** The calendar window the screens work with: the last 30 days and the next 31. */
const loadBookings = () =>
  cached('bookings', async () => {
    if (!can('booking.view')) return [];
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const to = new Date(Date.now() + 31 * 86_400_000).toISOString();
    const r = await http<{ items: ApiBooking[] }>(
      'GET',
      `${T()}/bookings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    return r.items.map(toBooking);
  });

const loadServices = () =>
  cached('services', async () =>
    (await http<{ items: ApiService[] }>('GET', `${T()}/services`)).items.map(toService),
  );
const loadCategories = () =>
  cached('categories', async () =>
    (await http<{ items: ApiCategory[] }>('GET', `${T()}/categories`)).items.map(toCategory),
  );
const loadResources = () =>
  cached('resources', async () =>
    (await http<{ items: ApiResource[] }>('GET', `${T()}/resources`)).items
      .filter((r) => r.active)
      .map(toResource),
  );
const loadLocations = () =>
  cached('locations', async () => {
    const r = await http<{ items: ApiLocation[] }>('GET', `${T()}/locations`);
    return r.items.map((l) => toLocation(l, ctx?.storefront ?? null));
  });
const loadMembers = () =>
  cached('members', async () => {
    if (!can('staff.manage')) return [];
    const rows = await http<ApiMember[]>('GET', `${T()}/members`);
    return rows.filter((m) => m.status !== 'suspended').map(toMember);
  });
const loadStorefront = async (): Promise<ApiStorefront> => {
  const sf = await http<ApiStorefront>('GET', `${T()}/storefront`);
  if (ctx) ctx.storefront = sf;
  return sf;
};
const patchStorefront = async (patch: Partial<ApiStorefront>): Promise<ApiStorefront> => {
  const sf = await http<ApiStorefront>('PATCH', `${T()}/storefront`, { body: patch });
  if (ctx) ctx.storefront = sf;
  forget();
  return sf;
};

/* ---------- Storefront design ⇄ the store editor ---------- */

const NETWORKS: SocialNetwork[] = ['instagram', 'facebook', 'x', 'tiktok', 'whatsapp'];
const SECTIONS: SectionKind[] = [
  'hero',
  'featured',
  'menu',
  'team',
  'memberships',
  'gallery',
  'video',
  'reviews',
  'policies',
  'location',
  'faq',
];
/** Editor fields that live in storefront.design (the rest map to storefront columns). */
type EditorDesign = Pick<
  Storefront,
  | 'theme'
  | 'accent'
  | 'displayName'
  | 'showContacts'
  | 'sections'
  | 'palette'
  | 'sectionStyles'
  | 'marquee'
  | 'season'
  | 'cover'
> & { tagline: string; logo: string | null };
interface SavedVersion {
  id: string;
  label: string;
  at: string;
  by: string;
  live: boolean;
  snapshot?: EditorDesign;
}

function paletteOf(p: unknown): StorePalette | null {
  const v = p as { preset?: string } | (Partial<StorePalette> & { bg?: string }) | undefined;
  if (!v) return null;
  if ('preset' in v && v.preset) {
    const preset = PRESET_PALETTES.find((x) => x.id === v.preset);
    return preset ? finalizePalette(preset) : null;
  }
  return 'bg' in v && v.bg && 'accent' in v && v.accent ? finalizePalette(v as StorePalette) : null;
}

const isUrl = (s: string | null) => !!s && (/^https?:\/\//.test(s) || /^\/[\w/.-]+$/.test(s));

/** The live design as the store shows it now. */
function liveDesign(sf: ApiStorefront, name: string): EditorDesign {
  const d = sf.design;
  const theme = (
    ['emerald', 'noir', 'ivory', 'plum'].includes(d.theme as string) ? d.theme : 'emerald'
  ) as Storefront['theme'];
  const palette = paletteOf(d.palette);
  const displayName = (d.displayName as string | undefined) ?? name;
  const saved = (d.sections as Storefront['sections'] | undefined) ?? [];
  return {
    theme,
    accent: palette?.accent ?? (d.accent as string | undefined) ?? '#C8A96A',
    displayName,
    tagline: sf.tagline,
    showContacts: d.showContacts === true,
    sections: saved.length
      ? saved
      : SECTIONS.map((kind) => ({ kind, enabled: !['video', 'faq'].includes(kind) })),
    logo: sf.logo_url ?? (d.logo_image as string | undefined) ?? null,
    palette,
    sectionStyles: (d.sectionStyles as Storefront['sectionStyles'] | undefined) ?? {},
    marquee: { ...DEFAULT_MARQUEE, ...(d.marquee as Partial<StoreMarquee> | undefined) },
    season: { ...DEFAULT_SEASON, ...(d.season as Partial<StoreSeason> | undefined) },
    cover: {
      image: sf.cover_url,
      headline: displayName,
      subline: sf.tagline,
      layout: sf.cover_url ? 'full' : 'color',
      ctaLabel: 'Book a visit',
      ...(d.cover as Partial<StoreCover> | undefined),
    },
  };
}

function socialsOf(sf: ApiStorefront): SocialAccount[] {
  const prefs =
    (sf.design.socialPrefs as
      Record<string, { showOnStore?: boolean; bookButton?: boolean; at?: string }> | undefined) ??
    {};
  return NETWORKS.map((network) => {
    const handle = sf.socials[network];
    const p = prefs[network] ?? {};
    return {
      network,
      handle: handle ?? '',
      connected: !!handle,
      connectedAt: handle ? (p.at ?? null) : null,
      followers: null,
      showOnStore: !!handle && p.showOnStore !== false,
      bookButton: !!handle && !!p.bookButton,
    };
  });
}

function toStorefront(sf: ApiStorefront, name: string): Storefront {
  const d = sf.design;
  const draft = d.draft as Partial<EditorDesign> | undefined;
  const view = { ...liveDesign(sf, name), ...(draft ?? {}) };
  const saved = (d.versions as SavedVersion[] | undefined) ?? [];
  return {
    tenantId: tenantId ?? '',
    ...view,
    hasDraft: !!draft,
    versions: saved.map(({ snapshot: _s, ...v }) => v),
    socials: socialsOf(sf),
  };
}

function editorPart(s: Partial<Storefront>): Partial<EditorDesign> {
  const keys: (keyof EditorDesign)[] = [
    'theme',
    'accent',
    'displayName',
    'tagline',
    'showContacts',
    'sections',
    'logo',
    'palette',
    'sectionStyles',
    'marquee',
    'season',
    'cover',
  ];
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in s) out[k] = s[k as keyof Storefront];
  return out as Partial<EditorDesign>;
}

/** Writes an editor design as the live store (columns + design JSON). */
function liveWrite(sf: ApiStorefront, e: EditorDesign, extra: Record<string, unknown> = {}) {
  const { draft: _d, ...rest } = sf.design;
  const logoIsUrl = isUrl(e.logo);
  return {
    tagline: e.tagline.slice(0, 160),
    logo_url: logoIsUrl ? e.logo : null,
    ...(isUrl(e.cover.image) ? { cover_url: e.cover.image } : {}),
    design: {
      ...rest,
      theme: e.theme,
      accent: e.accent,
      displayName: e.displayName,
      showContacts: e.showContacts,
      sections: e.sections,
      palette: e.palette,
      sectionStyles: e.sectionStyles,
      marquee: e.marquee,
      season: e.season,
      cover: e.cover,
      logo_image: logoIsUrl ? null : e.logo,
      ...extra,
    },
  };
}

/* ---------- Messages: threads are loaded when a conversation is opened ---------- */

const threads = new Map<string, ApiThread>();
function toConversation(c: ApiConversation): Conversation & { guest: Guest } {
  const t = threads.get(c.id);
  const fresh = t && t.conversation.last_message_at === c.last_message_at;
  const actor = ctx?.me.full_name ?? 'Team';
  const messages: Conversation['messages'] = fresh
    ? t.messages.map((m) => ({
        id: m.id,
        from: m.sender === 'guest' ? 'guest' : 'staff',
        author: m.sender === 'guest' ? c.guest_label : actor,
        body: m.body,
        at: m.created_at,
      }))
    : [
        {
          id: `${c.id}:last`,
          from: c.last_sender === 'house' ? 'staff' : 'guest',
          author: c.last_sender === 'house' ? actor : c.guest_label,
          body: c.preview,
          at: c.last_message_at,
        },
      ];
  return {
    id: c.id,
    tenantId: tenantId ?? '',
    guestId: '',
    assignedTo: null,
    unread: c.unread ? 1 : 0,
    messages,
    guest: {
      ...toGuest({
        id: c.id,
        display_name: c.guest_label,
        first_touch_source: 'own_channel',
        tags: [],
        visits: 0,
        spend_minor: 0,
        last_visit_at: null,
        joined_at: c.last_message_at,
        notes: '',
      }),
    },
  };
}
const loadThread = async (id: string) => {
  const t = await http<ApiThread>('GET', `${T()}/conversations/${id}`);
  threads.set(id, t);
  return t;
};

/* ---------- Booking rules: defaults until rules are stored on the server ---------- */

const DEFAULT_POLICIES: Policies = {
  paymentAtBooking: 'none',
  depositValue: 0,
  balance: 'at_venue',
  freeCancelHours: 2,
  lateCancel: 'deposit_kept',
  lateCancelPct: 0,
  noShow: 'fee_request',
  leadTimeHours: 1,
  horizonDays: 60,
  whoCanBook: 'anyone',
  approval: 'instant',
  approvalWindowHours: 4,
  maxPerGuestPerDay: 3,
  maxPartySize: 1,
};

/* ===================================================================== */
/* Sign-in (email link or password, then two-step verification)          */
/* ===================================================================== */

export type AuthStage = 'signed_out' | 'verify_2fa' | 'setup_2fa' | 'no_house' | 'signed_in';

export const auth = {
  stage(): AuthStage {
    if (!tokens) return 'signed_out';
    if (tokens.second_factor === 'required') return 'verify_2fa';
    if (tokens.second_factor === 'setup_required') return 'setup_2fa';
    return ctx ? 'signed_in' : 'no_house';
  },
  requestLink: (email: string) =>
    http<{ accepted: true }>('POST', '/v1/auth/magic-link', {
      body: { email, audience: 'business' },
      auth: false,
    }),
  verifyLink: async (token: string) => {
    setTokens(
      await http<Tokens>('POST', '/v1/auth/magic-link/verify', {
        body: { token, audience: 'business' },
        auth: false,
      }),
    );
    return auth.stage();
  },
  password: async (email: string, password: string) => {
    setTokens(
      await http<Tokens>('POST', '/v1/auth/password/login', {
        body: { email, password },
        auth: false,
      }),
    );
    return auth.stage();
  },
  forgotPassword: (email: string) =>
    http<{ accepted: true }>('POST', '/v1/auth/password/forgot', {
      body: { email },
      auth: false,
    }),
  totpSetup: () => http<{ otpauth_url: string; secret: string }>('POST', '/v1/auth/totp/setup'),
  totpEnable: async (code: string) => {
    setTokens(await http<Tokens>('POST', '/v1/auth/totp/enable', { body: { code } }));
    return auth.stage();
  },
  totpVerify: async (code: string) => {
    setTokens(await http<Tokens>('POST', '/v1/auth/totp/verify', { body: { code } }));
    return auth.stage();
  },
  invitations: () => http<ApiInvitation[]>('GET', '/v1/me/invitations'),
  accept: (membershipId: string) =>
    http<undefined>('POST', `/v1/me/memberships/${membershipId}/accept`),
  signOut: async () => {
    await http('POST', '/v1/auth/logout').catch(() => undefined);
    setTokens(null);
    ctx = null;
    forget();
  },
};

/* ===================================================================== */

export const api: Api = {
  /* ---------- session ---------- */
  session: {
    get: async () => {
      const memberships: {
        tenantId: string;
        tenantName: string;
        vertical: Tenant['vertical'];
        role: TenantRole;
      }[] = [];
      if (
        !tokens ||
        tokens.second_factor === 'required' ||
        tokens.second_factor === 'setup_required'
      )
        return { signedIn: false as const, memberships };
      const [me, mine] = await Promise.all([
        http<ApiMe>('GET', '/v1/me'),
        http<ApiMyTenant[]>('GET', '/v1/me/tenants'),
      ]);
      const current = mine.find((t) => t.tenant_id === tenantId) ?? mine[0];
      if (!current) {
        ctx = null;
        return { signedIn: false as const, memberships };
      }
      if (current.tenant_id !== tenantId) setTenantId(current.tenant_id);
      const [tenant, storefront] = await Promise.all([
        http<ApiTenant>('GET', T()),
        http<ApiStorefront>('GET', `${T()}/storefront`).catch(() => null),
      ]);
      ctx = { me, mine, current, tenant, storefront };
      const role = viewAs ?? current.role;
      return {
        signedIn: true as const,
        personName: me.full_name ?? me.email ?? 'You',
        assistBy: null,
        tenant: toTenant(tenant, storefront),
        role,
        viewAs,
        capabilities: [...caps()],
        memberships: mine.map((m) => ({
          tenantId: m.tenant_id,
          tenantName: m.name,
          vertical: 'spa' as const,
          role: m.role,
        })),
      };
    },
    signIn: () => soon('Phone sign-in'),
    signOut: async () => {
      await auth.signOut();
      return true;
    },
    switchTenant: async (id: string) => {
      if (!ctx?.mine.some((m) => m.tenant_id === id))
        throw new ApiError('forbidden', 'You are not a member of that House');
      setTenantId(id);
      viewAs = null;
      store.set('sv.business.viewas', null, sessionStorage);
      forget();
      threads.clear();
      return true;
    },
    setViewAs: async (role: TenantRole | null) => {
      viewAs = role;
      store.set('sv.business.viewas', role, sessionStorage);
      forget();
      return true;
    },
    resetDemo: async () => {
      forget();
      return true;
    },
  },

  /* ---------- today / alerts / setup ---------- */
  alerts: async () => {
    const out: {
      id: string;
      tone: 'amber' | 'red' | 'azure';
      title: string;
      body: string;
      to: string;
    }[] = [];
    const bookings = await loadBookings();
    const req = bookings.filter((b) => b.state === 'requested').length;
    if (req && can('booking.approve'))
      out.push({
        id: 'al_req',
        tone: 'azure',
        title: `${req} booking request${req > 1 ? 's' : ''} waiting`,
        body: 'Confirm or decline them so guests know where they stand.',
        to: '/requests',
      });
    const sf = need().storefront;
    if (sf && !sf.published && can('storefront.edit'))
      out.push({
        id: 'al_pub',
        tone: 'amber',
        title: 'Your store is not published yet',
        body: 'Guests cannot enter it until you publish it.',
        to: '/storefront',
      });
    return out;
  },

  setup: async () => {
    const c = need();
    const [services, resources, locations] = await Promise.all([
      loadServices(),
      loadResources(),
      loadLocations(),
    ]);
    const t = toTenant(c.tenant, c.storefront);
    return {
      status: t.status,
      items: [
        {
          key: 'profile',
          label: 'Business profile',
          done: Boolean(t.description),
          to: '/settings',
        },
        {
          key: 'location',
          label: 'At least one location',
          done: locations.length > 0,
          to: '/settings?tab=locations',
        },
        {
          key: 'offering',
          label: 'At least one bookable offering',
          done: services.length > 0,
          to: '/catalogue',
        },
        {
          key: 'resource',
          label: 'A resource with availability',
          done: resources.length > 0,
          to: '/team?tab=resources',
        },
        { key: 'payment', label: 'A verified payment provider', done: false, to: '/payments' },
        {
          key: 'policy',
          label: 'Cancellation policy',
          done: Boolean(c.storefront?.policies.cancellation),
          to: '/policies',
        },
        {
          key: 'verification',
          label: 'Verification approved',
          done: t.verification === 'approved',
          to: '/settings',
        },
      ],
    };
  },

  /* ---------- bookings ---------- */
  bookings: {
    list: async () => {
      const rows = await loadBookings();
      return [...rows].sort((a, b) => a.start.localeCompare(b.start));
    },
    get: async (id: string) => {
      let b = (await loadBookings()).find((x) => x.id === id);
      if (!b) {
        forget();
        b = (await loadBookings()).find((x) => x.id === id);
      }
      if (!b) throw new ApiError('not_found', 'Booking not found');
      const g = (await loadGuests()).find((x) => x.id === b.guestId) ?? null;
      return { booking: b, guest: g, payments: [] };
    },
    transition: async (id: string, to: BookingState) => {
      if (!versions.has(id)) {
        forget();
        await loadBookings();
      }
      const out = await http<ApiBooking>('POST', `${T()}/bookings/${id}/transition`, {
        body: { to, version: versions.get(id) ?? 1 },
      });
      forget();
      return toBooking(out);
    },
    reschedule: () => soon('Moving a booking'),
    create: () => soon('Booking from the front desk'),
    simulateCallback: () => soon('Payments'),
    slots: async () => [],
  },

  /* ---------- guests ---------- */
  guests: {
    list: () => loadGuests(),
    get: async (id: string) => {
      const guest = (await loadGuests()).find((g) => g.id === id);
      if (!guest) throw new ApiError('not_found', 'Guest not found');
      const r = await http<{ items: ApiBooking[] }>('GET', `${T()}/bookings?guest_id=${id}`);
      return { guest, bookings: r.items.map(toBooking) };
    },
    update: async (id: string, patch: Partial<Pick<Guest, 'notes' | 'tags' | 'preferences'>>) => {
      const body = {
        ...(patch.notes !== undefined && { notes: patch.notes }),
        ...(patch.tags !== undefined && { tags: patch.tags }),
      };
      if (!Object.keys(body).length) soon('Guest preferences');
      const g = await http<ApiGuest>('PATCH', `${T()}/guests/${id}`, { body });
      forget();
      return toGuest(g);
    },
    import: () => soon('Importing guests'),
    remove: () => soon('Removing a guest'),
  },

  /* ---------- messages ---------- */
  messages: {
    list: async () => {
      const r = await http<{ items: ApiConversation[] }>('GET', `${T()}/conversations`);
      return r.items.map(toConversation);
    },
    send: async (conversationId: string, body: string) => {
      if (/(\+?254|0)7\d{8}/.test(body.replace(/\s/g, '')))
        throw new ApiError(
          'invalid',
          'Phone numbers are not shared in chat. Keep the conversation in Stayvinci.',
        );
      await http('POST', `${T()}/conversations/${conversationId}/messages`, { body: { body } });
      const t = await loadThread(conversationId);
      return toConversation(t.conversation);
    },
    markRead: async (conversationId: string) => {
      const t = await loadThread(conversationId);
      return toConversation(t.conversation);
    },
    assign: () => soon('Assigning conversations'),
  },

  /* ---------- catalogue ---------- */
  catalogue: {
    get: async () => {
      const [categories, services] = await Promise.all([loadCategories(), loadServices()]);
      return {
        categories,
        services,
        ratePlans: [],
        addOns: [],
        packages: [],
        tiers: [],
        products: [],
        giftCards: [],
      };
    },
    saveService: async (s: Service) => {
      if (!s.name.trim()) throw new ApiError('invalid', 'Give the service a name');
      if (!s.variants.length) throw new ApiError('invalid', 'Add at least one variant');
      if (s.image && !isUrl(s.image))
        throw new ApiError(
          'invalid',
          'Photo uploads arrive with media storage. Use an image link for now, or an icon.',
        );
      const body = {
        name: s.name.trim(),
        description: s.description,
        category_id: s.categoryId || null,
        image_url: s.image,
        icon: s.icon,
        visibility: s.visibility,
        buffer_before_min: s.bufferBeforeMin,
        buffer_after_min: s.bufferAfterMin,
        requires: s.requires.filter((r) => r !== 'equipment'),
        variants: s.variants.map((v) => ({
          name: v.name || 'Standard',
          duration_min: v.durationMin,
          price_minor: v.price,
        })),
        resource_ids: s.staffIds,
      };
      const exists = (await loadServices()).some((x) => x.id === s.id);
      const out = exists
        ? await http<ApiService>('PATCH', `${T()}/services/${s.id}`, { body })
        : await http<ApiService>('POST', `${T()}/services`, { body, idempotent: true });
      forget();
      return toService(out);
    },
    setVisibility: async (kind, id, visibility) => {
      if (kind !== 'services') soon('Hiding this kind of item');
      await http('PATCH', `${T()}/services/${id}`, {
        body: visibility === 'hidden' ? { active: false } : { visibility, active: true },
      });
      forget();
      return true;
    },
    bulkPrice: async (serviceIds: string[], pctChange: number) => {
      const services = (await loadServices()).filter((s) => serviceIds.includes(s.id));
      for (const s of services)
        await http('PATCH', `${T()}/services/${s.id}`, {
          body: {
            variants: s.variants.map((v) => ({
              name: v.name,
              duration_min: v.durationMin,
              price_minor: Math.round((v.price * (100 + pctChange)) / 100 / 1000) * 1000,
            })),
          },
        });
      forget();
      return true;
    },
    restock: () => soon('Products'),
  },

  /* ---------- team & resources ---------- */
  team: {
    list: async () => {
      const [members, resources, locations] = await Promise.all([
        loadMembers(),
        loadResources(),
        loadLocations(),
      ]);
      return { members, resources, locations };
    },
    updateMember: async (id: string, patch: Pick<TeamMember, 'role' | 'added' | 'removed'>) => {
      const m = await http<ApiMember>('PATCH', `${T()}/members/${id}`, {
        body: { role: patch.role, caps_added: patch.added, caps_removed: patch.removed },
      });
      forget();
      return toMember(m);
    },
    invite: async (name: string, email: string, role: TenantRole) => {
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError('invalid', 'Enter a valid email');
      const m = await http<ApiMember>('POST', `${T()}/members`, {
        body: { full_name: name, email, role },
        idempotent: true,
      });
      forget();
      return { ...toMember(m), email };
    },
    removeMember: async (id: string) => {
      await http('PATCH', `${T()}/members/${id}`, { body: { status: 'suspended' } });
      forget();
      return true;
    },
    saveResource: async (r: Resource) => {
      const body = {
        name: r.name,
        title: r.title ?? null,
        specialties: r.specialties ?? [],
        amenities: r.amenities ?? [],
        capacity: r.capacity,
        show_on_store: r.visible,
        location_id: r.locationId || null,
      };
      const exists = (await loadResources()).some((x) => x.id === r.id);
      if (exists) await http('PATCH', `${T()}/resources/${r.id}`, { body });
      else
        await http('POST', `${T()}/resources`, {
          body: { ...body, type: r.type },
          idempotent: true,
        });
      forget();
      return true;
    },
    addBlock: () => soon('Blocking time'),
  },
  blocks: async () => [],

  /* ---------- storefront & content ---------- */
  storefront: {
    get: async () => toStorefront(await loadStorefront(), need().tenant.name),
    save: async (patch: Partial<Storefront>) => {
      const sf = await loadStorefront();
      const current = toStorefront(sf, need().tenant.name);
      const draft = { ...editorPart(current), ...editorPart(patch) };
      const next = await patchStorefront({ design: { ...sf.design, draft } });
      return toStorefront(next, need().tenant.name);
    },
    publish: async () => {
      const sf = await loadStorefront();
      const name = need().tenant.name;
      const e = { ...liveDesign(sf, name), ...(sf.design.draft as Partial<EditorDesign>) };
      const old = (sf.design.versions as SavedVersion[] | undefined) ?? [];
      const n = (old[0] ? Number(old[0].id.replace(/\D/g, '')) || old.length : 0) + 1;
      const { logo: _logo, ...snap } = e;
      const version: SavedVersion = {
        id: `v${n}`,
        label: `Version ${n}`,
        at: new Date().toISOString(),
        by: need().me.full_name ?? 'Team',
        live: true,
        snapshot: { ...snap, logo: null },
      };
      const write = liveWrite(sf, e, {
        versions: [version, ...old.map((v) => ({ ...v, live: false }))].slice(0, 8),
      });
      const next = await patchStorefront({ ...write, published: true } as Partial<ApiStorefront>);
      return toStorefront(next, name);
    },
    connectSocial: async (network: SocialNetwork, handle: string) => {
      const clean = handle.trim().replace(/^@/, '');
      if (clean.length < 2) throw new ApiError('invalid', 'Enter your account name.');
      const sf = await loadStorefront();
      const prefs = (sf.design.socialPrefs as Record<string, unknown> | undefined) ?? {};
      const next = await patchStorefront({
        socials: { ...sf.socials, [network]: clean },
        design: {
          ...sf.design,
          socialPrefs: {
            ...prefs,
            [network]: {
              showOnStore: true,
              bookButton: network === 'instagram' || network === 'facebook',
              at: new Date().toISOString(),
            },
          },
        },
      });
      return socialsOf(next).find((a) => a.network === network) as SocialAccount;
    },
    updateSocial: async (network, patch) => {
      const sf = await loadStorefront();
      const prefs =
        (sf.design.socialPrefs as Record<string, Record<string, unknown>> | undefined) ?? {};
      const next = await patchStorefront({
        design: {
          ...sf.design,
          socialPrefs: { ...prefs, [network]: { ...prefs[network], ...patch } },
        },
      });
      return socialsOf(next).find((a) => a.network === network) as SocialAccount;
    },
    disconnectSocial: async (network: SocialNetwork) => {
      const sf = await loadStorefront();
      const { [network]: _gone, ...rest } = sf.socials;
      const next = await patchStorefront({ socials: rest });
      return socialsOf(next).find((a) => a.network === network) as SocialAccount;
    },
    rollback: async (versionId: string) => {
      const sf = await loadStorefront();
      const name = need().tenant.name;
      const old = (sf.design.versions as SavedVersion[] | undefined) ?? [];
      const v = old.find((x) => x.id === versionId);
      if (!v?.snapshot) throw new ApiError('not_found', 'That version can no longer be restored.');
      const current = liveDesign(sf, name);
      const write = liveWrite(
        sf,
        { ...v.snapshot, logo: current.logo },
        { versions: old.map((x) => ({ ...x, live: x.id === versionId })) },
      );
      return toStorefront(await patchStorefront(write as Partial<ApiStorefront>), name);
    },
  },
  content: {
    list: async () => [],
    create: () => soon('Content uploads'),
    remove: () => soon('Content'),
    scheduleLive: () => soon('Live sessions'),
    setLiveStatus: () => soon('Live sessions'),
  },

  /* ---------- access ---------- */
  access: {
    get: async () => {
      const c = need();
      const sf = c.storefront ?? (await loadStorefront());
      const codes: AccessCode[] = sf.access_code
        ? [
            {
              id: 'primary',
              tenantId: tenantId ?? '',
              code: sf.access_code,
              kind: 'primary',
              label: 'Private store code',
              scope: 'store',
              expiresAt: null,
              usageLimit: null,
              uses: 0,
              status: 'active',
              createdAt: c.tenant.id ? new Date().toISOString() : '',
            },
          ]
        : [];
      return { visibility: c.tenant.visibility, handle: c.tenant.handle, codes };
    },
    setVisibility: async (mode: VisibilityMode) => {
      const t = await http<ApiTenant>('PATCH', T(), { body: { visibility: mode } });
      need().tenant = t;
      forget();
      return toTenant(t, need().storefront);
    },
    createCode: async (c) => {
      const sf = need().storefront ?? (await loadStorefront());
      if (sf.access_code && c.kind !== 'primary') soon('Extra codes for campaigns and people');
      const code = c.code.trim().toUpperCase();
      if (!/^[A-Z0-9-]{4,16}$/.test(code))
        throw new ApiError('invalid', 'Codes are 4–16 letters, numbers or dashes.');
      await patchStorefront({ access_code: code });
      return {
        ...c,
        code,
        kind: 'primary',
        id: 'primary',
        tenantId: tenantId ?? '',
        uses: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
    },
    revoke: () => {
      throw new ApiError('invalid', 'The primary code cannot be revoked. Change it instead.');
    },
  },

  /* ---------- policies ---------- */
  policies: {
    get: async () => DEFAULT_POLICIES,
    save: () => soon('Saving booking rules'),
  },

  /* ---------- payments ---------- */
  payments: {
    overview: async () => {
      const [bookings, guests] = await Promise.all([loadBookings(), loadGuests()]);
      return {
        providers: [],
        payments: [],
        unmatched: [],
        bookings: bookings.map((b) => ({
          id: b.id,
          ref: b.ref,
          guestId: b.guestId,
          total: b.total,
          paid: b.paid,
          start: b.start,
          state: b.state,
        })),
        guests: guests.map((g) => ({ id: g.id, name: g.firstName })),
      };
    },
    testProvider: () => soon('Payment providers'),
    reorder: () => soon('Payment providers'),
    refund: () => soon('Refunds'),
    attachUnmatched: () => soon('Payment matching'),
  },

  /* ---------- marketing ---------- */
  marketing: {
    get: async () => {
      const r = can('booking.view')
        ? await http<{ items: ApiReview[] }>('GET', `${T()}/reviews`)
        : { items: [] };
      const reviews: (Review & { guestName: string })[] = r.items.map((x) => ({
        id: x.id,
        tenantId: tenantId ?? '',
        guestId: '',
        rating: x.rating,
        body: x.comment,
        at: x.created_at,
        reply: x.reply,
        serviceName: `Booking ${x.booking_ref}`,
        guestName: 'Guest',
      }));
      return {
        campaigns: [],
        reviews,
        loyalty: { referralsOn: false, referralReward: 0, loyaltyOn: false, visitsForReward: 5 },
      };
    },
    createCampaign: () => soon('Campaigns'),
    reply: async (reviewId: string, reply: string) => {
      const x = await http<ApiReview>('POST', `${T()}/reviews/${reviewId}/reply`, {
        body: { reply },
      });
      return {
        id: x.id,
        tenantId: tenantId ?? '',
        guestId: '',
        rating: x.rating,
        body: x.comment,
        at: x.created_at,
        reply: x.reply,
        serviceName: `Booking ${x.booking_ref}`,
      };
    },
    saveLoyalty: () => soon('Loyalty and referrals'),
  },

  /* ---------- compliance (short-stay) ---------- */
  compliance: {
    get: async () => ({
      units: (await loadResources()).filter((r) => r.type === 'unit'),
      registrations: [],
      levy: [],
    }),
    saveLicence: () => soon('Licences'),
  },

  /* ---------- billing ---------- */
  billing: {
    get: async () => {
      const guests = await loadGuests();
      return {
        invoices: [],
        feeLines: [],
        attributed: {
          own: guests.filter((g) => g.attribution === 'own_channel').length,
          marketplace: guests.filter((g) => g.attribution === 'marketplace').length,
        },
      };
    },
    dispute: () => soon('Fee disputes'),
  },

  /* ---------- settings ---------- */
  settings: {
    get: async () => {
      const c = need();
      return {
        tenant: toTenant(c.tenant, c.storefront),
        locations: await loadLocations(),
        notifications: store.get<Record<string, boolean>>(`sv.business.notify.${tenantId}`, {}),
      };
    },
    saveTenant: async (patch) => {
      const c = need();
      if (patch.name && patch.name !== c.tenant.name)
        c.tenant = await http<ApiTenant>('PATCH', T(), { body: { name: patch.name } });
      const sfPatch = {
        ...(patch.tagline !== undefined && { tagline: patch.tagline.slice(0, 160) }),
        ...(patch.description !== undefined && { about: patch.description }),
        ...(patch.area !== undefined && { area: patch.area || null }),
      };
      if (Object.keys(sfPatch).length) await patchStorefront(sfPatch);
      forget();
      return toTenant(c.tenant, c.storefront);
    },
    saveNotifications: async (prefs: Record<string, boolean>) => {
      store.set(`sv.business.notify.${tenantId}`, prefs);
      return prefs;
    },
    saveLocation: async (id: string, patch: Partial<Location>) => {
      const body = {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.area !== undefined && { area: patch.area || null }),
        ...(patch.address !== undefined && { address: { line1: patch.address } }),
        ...(patch.hours !== undefined && { hours: fromHours(patch.hours) }),
      };
      const l = Object.keys(body).length
        ? await http<ApiLocation>('PATCH', `${T()}/locations/${id}`, { body })
        : null;
      if (patch.arrivalInstructions !== undefined) {
        const sf = need().storefront ?? (await loadStorefront());
        await patchStorefront({
          policies: { ...sf.policies, arrival: patch.arrivalInstructions },
        });
      }
      forget();
      const fresh = (await loadLocations()).find((x) => x.id === id);
      if (fresh) return fresh;
      if (l) return toLocation(l, need().storefront);
      throw new ApiError('not_found', 'Location not found');
    },
    audit: async () => {
      if (!can('audit.view')) return [];
      const r = await http<Page<ApiAudit>>('GET', `${T()}/audit?limit=100`);
      return r.items.map((a): AuditEntry => ({
        id: String(a.id),
        tenantId: tenantId ?? '',
        at: a.occurred_at,
        actor: a.actor,
        action: a.action,
        target: a.target_type ?? '',
        detail: '',
      }));
    },
    exportData: () => soon('Data export'),
  },

  /** Universal search for the top bar: guests, bookings, services, team. */
  search: async (q: string) => {
    const query = q.trim().toLowerCase();
    const empty = { guests: [], bookings: [], services: [], team: [], codes: [], tiers: [] };
    if (query.length < 2) return empty;
    const has = (text: string) => query.split(/\s+/).every((w) => text.toLowerCase().includes(w));
    const [guests, bookings, services, resources] = await Promise.all([
      loadGuests(),
      loadBookings(),
      loadServices(),
      loadResources(),
    ]);
    return {
      guests: guests
        .filter((g) => has(g.firstName))
        .slice(0, 5)
        .map((g) => ({ id: g.id, name: g.firstName })),
      bookings: bookings
        .filter((b) => has(b.ref))
        .slice(0, 5)
        .map((b) => ({ id: b.id, ref: b.ref, start: b.start })),
      services: services
        .filter((x) => has(`${x.name} ${x.description}`))
        .slice(0, 5)
        .map((x) => ({
          id: x.id,
          name: x.name,
          price: Math.min(...x.variants.map((v) => v.price)),
        })),
      team: resources
        .filter(
          (r) =>
            r.type === 'staff' &&
            has(`${r.name} ${r.title ?? ''} ${(r.specialties ?? []).join(' ')}`),
        )
        .slice(0, 4)
        .map((r) => ({ id: r.id, name: r.name, title: r.title ?? '' })),
      codes: [],
      tiers: [],
    };
  },
};
