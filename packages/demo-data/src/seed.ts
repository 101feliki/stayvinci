// Deterministic demo data for two Houses. Every price and fee here is sample data
// for the prototype only; real amounts come from tenant configuration and the
// platform's plan / fee_rule tables (CLAUDE.md rule 7).
import { addDaysKey, dayKey, zonedToUtc } from './format';
import type {
  AccessCode,
  AddOn,
  AuditEntry,
  Booking,
  BookingState,
  CalendarBlock,
  Campaign,
  Category,
  ContentItem,
  Conversation,
  FeeLine,
  GiftCardType,
  Guest,
  GuestRegistration,
  Invoice,
  LevyReport,
  Location,
  MembershipTier,
  PackageOffer,
  Payment,
  Policies,
  Product,
  ProviderConnection,
  RatePlan,
  Resource,
  Review,
  Service,
  Storefront,
  TeamMember,
  Tenant,
  UnmatchedPayment,
} from './types';

export interface Db {
  tenants: Tenant[];
  team: TeamMember[];
  locations: Location[];
  resources: Resource[];
  categories: Category[];
  services: Service[];
  ratePlans: RatePlan[];
  addOns: AddOn[];
  packages: PackageOffer[];
  tiers: MembershipTier[];
  products: Product[];
  giftCards: GiftCardType[];
  content: ContentItem[];
  guests: Guest[];
  bookings: Booking[];
  blocks: CalendarBlock[];
  payments: Payment[];
  unmatched: UnmatchedPayment[];
  providers: ProviderConnection[];
  codes: AccessCode[];
  policies: Record<string, Policies>;
  conversations: Conversation[];
  storefronts: Storefront[];
  campaigns: Campaign[];
  reviews: Review[];
  invoices: Invoice[];
  feeLines: FeeLine[];
  registrations: GuestRegistration[];
  levyReports: LevyReport[];
  audit: AuditEntry[];
  loyalty: Record<
    string,
    { referralsOn: boolean; referralReward: number; loyaltyOn: boolean; visitsForReward: number }
  >;
  notificationPrefs: Record<string, Record<string, boolean>>;
}

/** Sample billing configuration for the prototype (not real pricing). */
export const SAMPLE_PLAN = {
  name: 'House',
  interval: 'monthly',
  amount: 0,
  note: 'Pricing not decided yet',
};
export const SAMPLE_FEE_RULE = {
  percent: 10,
  minimum: 20_000,
  maximum: 300_000,
  version: 'sample-v1',
};

const TZ = 'Africa/Nairobi';

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  'Amani',
  'Wanjiku',
  'Kevin',
  'Faith',
  'Brian',
  'Mercy',
  'Dennis',
  'Joy',
  'Collins',
  'Esther',
  'Ian',
  'Lilian',
  'Samuel',
  'Ruth',
  'Victor',
  'Sharon',
  'Daniel',
  'Purity',
  'Eric',
  'Caroline',
  'Mark',
  'Nelly',
  'Peter',
  'Diana',
  'Kamau',
  'Zawadi',
  'Omar',
  'Aisha',
  'Tom',
  'Lucy',
  'Moses',
  'Nadia',
  'Felix',
  'Imani',
  'George',
  'Sophie',
];
const LAST = [
  'Mwangi',
  'Otieno',
  'Kamau',
  'Wanjiru',
  'Ochieng',
  'Njoroge',
  'Kiprop',
  'Achieng',
  'Mutua',
  'Wambui',
  'Hassan',
  'Kariuki',
  'Odhiambo',
  'Chebet',
  'Ndungu',
  'Barasa',
  'Mohamed',
  'Atieno',
  'Kimani',
  'Langat',
  'Okoth',
  'Nyambura',
];
const PREFS = [
  'Female therapist',
  'Male therapist',
  'Firm pressure',
  'Light pressure',
  'Nut allergy',
  'Unscented oils',
  'Quiet session',
  'Prefers mornings',
];

function pick<T>(r: () => number, arr: readonly T[]): T {
  const v = arr[Math.floor(r() * arr.length)];
  if (v === undefined) throw new Error('empty array');
  return v;
}

function ref(r: () => number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'SV-';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(r() * chars.length)];
  return s;
}

function hhmm(totalMin: number): string {
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function overlaps(aS: string, aE: string, bS: string, bE: string): boolean {
  return aS < bE && bS < aE;
}

/** Sample House logo for the demo (gold lotus monogram), as an SVG data URL. */
const SERENITY_LOGO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="#0E3A2F"/><g fill="none" stroke="#D9BF86" stroke-width="3" stroke-linecap="round"><path d="M60 30c-9 12-9 26 0 38 9-12 9-26 0-38z"/><path d="M60 68c-12-2-22-10-26-22 12 0 22 8 26 22z"/><path d="M60 68c12-2 22-10 26-22-12 0-22 8-26 22z"/><path d="M36 78h48"/></g><text x="60" y="100" font-family="Georgia, serif" font-size="13" letter-spacing="3" fill="#D9BF86" text-anchor="middle">SERENITY</text></svg>',
)}`;

/** Demo photos (packages/demo-data/media, served from each app's /demo). */
const SERVICE_IMAGES: Record<string, string> = {
  sv_swedish: '/demo/massage-sm.jpg',
  sv_deep: '/demo/hotstone-sm.jpg',
  sv_stone: '/demo/stones-sm.jpg',
  sv_signature: '/demo/candles-sm.jpg',
  sv_glow: '/demo/facial-sm.jpg',
  sv_hammam: '/demo/pool-sm.jpg',
  sv_scrub: '/demo/botanics-sm.jpg',
};
/** Services without photos use icons from the Stayvinci set. */
const SERVICE_ICONS: Record<string, string> = {
  sv_sports: 'dumbbell',
  sv_couples: 'hearts',
  sv_mani: 'hand',
  sv_pedi: 'footprints',
  sv_staff: 'users',
};
const CATEGORY_IMAGES: Record<string, string> = {
  cat_massage: '/demo/massage-sm.jpg',
  cat_facial: '/demo/facial-sm.jpg',
  cat_body: '/demo/botanics-sm.jpg',
  cat_couples: '/demo/candles-sm.jpg',
};

export function createSeed(): Db {
  const r = rng(20261109);
  const now = new Date();
  const today = dayKey(now, TZ);
  const iso = (day: string, t: string) => zonedToUtc(day, t, TZ);

  const db: Db = {
    tenants: [],
    team: [],
    locations: [],
    resources: [],
    categories: [],
    services: [],
    ratePlans: [],
    addOns: [],
    packages: [],
    tiers: [],
    products: [],
    giftCards: [],
    content: [],
    guests: [],
    bookings: [],
    blocks: [],
    payments: [],
    unmatched: [],
    providers: [],
    codes: [],
    policies: {},
    conversations: [],
    storefronts: [],
    campaigns: [],
    reviews: [],
    invoices: [],
    feeLines: [],
    registrations: [],
    levyReports: [],
    audit: [],
    loyalty: {},
    notificationPrefs: {},
  };

  /* ===================== Tenant 1: spa ===================== */
  const spa: Tenant = {
    id: 't_serenity',
    name: 'Serenity Spa & Wellness',
    handle: 'SERENITY',
    vertical: 'spa',
    kind: 'house',
    status: 'live',
    visibility: 'private',
    timezone: TZ,
    currency: 'KES',
    area: 'Westlands, Nairobi',
    tagline: 'Quiet hours, expert hands.',
    description:
      'A calm, private spa in Westlands offering massage, facials and body rituals by appointment. Discreet entry, unhurried sessions.',
    accent: '#C8A96A',
    verification: 'approved',
  };
  db.tenants.push(spa);

  db.locations.push({
    id: 'loc_westlands',
    tenantId: spa.id,
    name: 'Westlands',
    address: 'Rhapta Road, 4th floor, Westlands, Nairobi',
    area: 'Westlands',
    hours: WEEK.map((day) => ({
      day,
      open: day === 'Sun' ? '10:00' : '09:00',
      close: day === 'Sun' ? '17:00' : '20:00',
      closed: false,
    })),
    arrivalInstructions: 'Use the side entrance on Rhapta Road. Lift to 4th floor, ring "SV".',
  });

  const staffDefs = [
    {
      name: 'Wanjiru Kamau',
      title: 'Senior therapist',
      spec: ['Deep tissue', 'Hot stone'],
      colour: '#236e56',
    },
    {
      name: 'Achieng Otieno',
      title: 'Therapist',
      spec: ['Swedish', 'Aromatherapy'],
      colour: '#00aff0',
    },
    {
      name: 'Grace Mwangi',
      title: 'Facialist',
      spec: ['Facials', 'Skin analysis'],
      colour: '#c8a96a',
    },
    {
      name: 'Fatuma Hassan',
      title: 'Therapist',
      spec: ['Hammam', 'Body scrubs'],
      colour: '#6a4d70',
    },
    {
      name: 'Brian Kiprop',
      title: 'Sports therapist',
      spec: ['Sports massage', 'Stretching'],
      colour: '#124535',
    },
    {
      name: 'Naomi Njeri',
      title: 'Nail technician',
      spec: ['Manicure', 'Pedicure'],
      colour: '#0091c8',
    },
  ];
  const staff: Resource[] = staffDefs.map((s, i) => ({
    id: `st_${i + 1}`,
    tenantId: spa.id,
    type: 'staff',
    name: s.name,
    title: s.title,
    locationId: 'loc_westlands',
    capacity: 1,
    visible: true,
    specialties: s.spec,
    languages:
      i % 2 === 0
        ? ['English', 'Kiswahili']
        : ['English', 'Kiswahili', 'French'].slice(0, 2 + (i % 3 === 0 ? 1 : 0)),
    guestsCanChoose: i !== 5,
    colour: s.colour,
    schedule: WEEK.map((day, d) => ({
      day,
      start: '09:00',
      end: d === 6 ? '17:00' : '19:00',
      off: d === (i + 1) % 7,
    })),
  }));
  const rooms: Resource[] = [
    { name: 'Jade Room', cap: 1 },
    { name: 'Amber Room', cap: 1 },
    { name: 'Couples Suite', cap: 2 },
    { name: 'Facial Studio', cap: 1 },
    { name: 'Hammam', cap: 2 },
    { name: 'Nail Lounge', cap: 2 },
  ].map((rm, i) => ({
    id: `rm_${i + 1}`,
    tenantId: spa.id,
    type: 'room' as const,
    name: rm.name,
    locationId: 'loc_westlands',
    capacity: rm.cap,
    visible: false,
  }));
  db.resources.push(...staff, ...rooms, {
    id: 'eq_1',
    tenantId: spa.id,
    type: 'equipment',
    name: 'Hot stone heater',
    locationId: 'loc_westlands',
    capacity: 1,
    visible: false,
  });

  const cats: [string, string][] = [
    ['cat_massage', 'Massage'],
    ['cat_facial', 'Facials'],
    ['cat_body', 'Body rituals'],
    ['cat_couples', 'Couples'],
    ['cat_nails', 'Hands & feet'],
  ];
  cats.forEach(([id, name], i) =>
    db.categories.push({
      id,
      tenantId: spa.id,
      name,
      order: i,
      visibility: id === 'cat_couples' ? 'invite_only' : 'public',
      image: CATEGORY_IMAGES[id] ?? null,
    }),
  );

  const svc = (
    id: string,
    categoryId: string,
    name: string,
    description: string,
    variants: [string, number, number][],
    staffIds: string[],
    visibility: Service['visibility'] = 'public',
  ): Service => ({
    id,
    tenantId: spa.id,
    categoryId,
    name,
    description,
    bufferBeforeMin: 0,
    bufferAfterMin: 15,
    requires: ['staff', 'room'],
    variants: variants.map(([vn, dur, price], i) => ({
      id: `${id}_v${i + 1}`,
      name: vn,
      durationMin: dur,
      price: price * 100,
    })),
    visibility,
    staffIds,
    taxClass: 'standard',
    image: SERVICE_IMAGES[id] ?? null,
    icon: SERVICE_ICONS[id] ?? null,
  });
  db.services.push(
    svc(
      'sv_swedish',
      'cat_massage',
      'Swedish massage',
      'Long, flowing strokes to release tension and calm the mind.',
      [
        ['60 min', 60, 4500],
        ['90 min', 90, 6500],
      ],
      ['st_1', 'st_2', 'st_4'],
    ),
    svc(
      'sv_deep',
      'cat_massage',
      'Deep tissue massage',
      'Focused, firm pressure for stubborn knots and recovery.',
      [
        ['60 min', 60, 5500],
        ['90 min', 90, 7800],
      ],
      ['st_1', 'st_5'],
    ),
    svc(
      'sv_stone',
      'cat_massage',
      'Hot stone therapy',
      'Warm basalt stones melt muscle tension.',
      [['75 min', 75, 7000]],
      ['st_1'],
    ),
    svc(
      'sv_sports',
      'cat_massage',
      'Sports massage',
      'Pre- or post-training work with assisted stretching.',
      [
        ['45 min', 45, 4000],
        ['60 min', 60, 5000],
      ],
      ['st_5'],
    ),
    svc(
      'sv_signature',
      'cat_facial',
      'Signature facial',
      'Cleanse, exfoliate, mask and massage tailored to your skin.',
      [['60 min', 60, 5000]],
      ['st_3'],
    ),
    svc(
      'sv_glow',
      'cat_facial',
      'Express glow facial',
      'A quick refresh before an event.',
      [['30 min', 30, 2800]],
      ['st_3'],
    ),
    svc(
      'sv_hammam',
      'cat_body',
      'Moroccan hammam',
      'Steam, black-soap cleanse and full body scrub.',
      [['90 min', 90, 8500]],
      ['st_4'],
    ),
    svc(
      'sv_scrub',
      'cat_body',
      'Coffee body scrub',
      'Kenyan coffee and coconut scrub with a warm wrap.',
      [['45 min', 45, 3800]],
      ['st_4', 'st_2'],
    ),
    svc(
      'sv_couples',
      'cat_couples',
      'Couples retreat',
      'Side-by-side massage in the Couples Suite with tea service.',
      [['90 min', 90, 14000]],
      ['st_1', 'st_2'],
      'invite_only',
    ),
    svc(
      'sv_mani',
      'cat_nails',
      'Classic manicure',
      'Shape, cuticle care and polish.',
      [['45 min', 45, 1800]],
      ['st_6'],
    ),
    svc(
      'sv_pedi',
      'cat_nails',
      'Spa pedicure',
      'Soak, scrub, massage and polish.',
      [['60 min', 60, 2500]],
      ['st_6'],
    ),
    svc(
      'sv_staff',
      'cat_massage',
      'Staff wellness session',
      'Internal: staff and partner sessions.',
      [['30 min', 30, 0]],
      ['st_2'],
      'hidden',
    ),
  );

  db.addOns.push(
    {
      id: 'ao_1',
      tenantId: spa.id,
      name: 'Scalp massage',
      price: 80000,
      durationMin: 15,
      appliesTo: 'All massages',
      visibility: 'public',
    },
    {
      id: 'ao_2',
      tenantId: spa.id,
      name: 'CBD-free calming oil',
      price: 50000,
      durationMin: 0,
      appliesTo: 'All massages',
      visibility: 'public',
    },
    {
      id: 'ao_3',
      tenantId: spa.id,
      name: 'Eye treatment',
      price: 120000,
      durationMin: 15,
      appliesTo: 'Facials',
      visibility: 'public',
    },
    {
      id: 'ao_4',
      tenantId: spa.id,
      name: 'Gel polish',
      price: 70000,
      durationMin: 15,
      appliesTo: 'Hands & feet',
      visibility: 'public',
    },
  );
  db.packages.push(
    {
      id: 'pk_1',
      tenantId: spa.id,
      name: '5 massages',
      credits: 5,
      price: 2000000,
      validityDays: 180,
      transferable: false,
      sold: 34,
      visibility: 'public',
    },
    {
      id: 'pk_2',
      tenantId: spa.id,
      name: '3 facials',
      credits: 3,
      price: 1350000,
      validityDays: 120,
      transferable: true,
      sold: 18,
      visibility: 'public',
    },
  );
  db.tiers.push(
    {
      id: 'tier_1',
      tenantId: spa.id,
      name: 'Silver',
      monthly: 600000,
      creditsPerMonth: 1,
      discountPct: 10,
      members: 41,
      perks: ['1 massage a month', '10% off add-ons'],
      visibility: 'public',
    },
    {
      id: 'tier_2',
      tenantId: spa.id,
      name: 'Gold',
      monthly: 1100000,
      creditsPerMonth: 2,
      discountPct: 15,
      members: 19,
      perks: ['2 sessions a month', 'Priority booking 7 days early', 'Members-only rituals'],
      visibility: 'public',
    },
    {
      id: 'tier_3',
      tenantId: spa.id,
      name: 'Private',
      monthly: 2500000,
      creditsPerMonth: 4,
      discountPct: 20,
      members: 6,
      perks: ['4 sessions a month', 'After-hours booking', 'Couples Suite access'],
      visibility: 'invite_only',
    },
  );
  db.products.push(
    {
      id: 'pr_1',
      tenantId: spa.id,
      name: 'Lavender body oil 100 ml',
      sku: 'SV-OIL-LAV',
      price: 220000,
      stock: 14,
      lowStockAt: 5,
      visibility: 'public',
    },
    {
      id: 'pr_2',
      tenantId: spa.id,
      name: 'Coffee scrub jar',
      sku: 'SV-SCR-COF',
      price: 180000,
      stock: 3,
      lowStockAt: 5,
      visibility: 'public',
    },
    {
      id: 'pr_3',
      tenantId: spa.id,
      name: 'Silk eye mask',
      sku: 'SV-ACC-EYE',
      price: 150000,
      stock: 22,
      lowStockAt: 4,
      visibility: 'public',
    },
    {
      id: 'pr_4',
      tenantId: spa.id,
      name: 'Shea face cream',
      sku: 'SV-FAC-SHE',
      price: 280000,
      stock: 0,
      lowStockAt: 3,
      visibility: 'hidden',
    },
  );
  db.giftCards.push(
    {
      id: 'gc_1',
      tenantId: spa.id,
      name: 'Signature gift card',
      value: 1000000,
      validityDays: 365,
      sold: 27,
      visibility: 'public',
    },
    {
      id: 'gc_2',
      tenantId: spa.id,
      name: 'Custom amount',
      value: null,
      validityDays: 365,
      sold: 12,
      visibility: 'public',
    },
  );
  const contentDefs: [
    string,
    ContentItem['kind'],
    number | null,
    number,
    number | null,
    string[],
    ContentItem['moderation'],
  ][] = [
    ['Self-massage for desk workers', 'video', 840, 1, 50000, [], 'approved'],
    [
      'Breathwork for better sleep',
      'video',
      1260,
      1,
      null,
      ['tier_1', 'tier_2', 'tier_3'],
      'approved',
    ],
    ['At-home facial routine', 'video', 960, 1, 40000, ['tier_2'], 'approved'],
    ['Inside our Hammam', 'gallery', null, 14, null, [], 'approved'],
    ['Couples stretching guide', 'video', 720, 1, null, ['tier_3'], 'pending'],
  ];
  contentDefs.forEach(([title, kind, durationSec, items, price, tierIds, moderation], i) =>
    db.content.push({
      id: `ct_${i + 1}`,
      tenantId: spa.id,
      title,
      kind,
      durationSec,
      items,
      price,
      tierIds,
      views: Math.floor(r() * 900) + 40,
      moderation,
      visibility: tierIds.length ? 'members_only' : 'public',
      createdAt: iso(addDaysKey(today, -Math.floor(r() * 90) - 5), '10:00'),
      live: null,
    }),
  );
  db.content.push(
    {
      id: 'ct_live_1',
      tenantId: spa.id,
      title: 'Ask a therapist: easing desk-job back pain',
      kind: 'live',
      durationSec: null,
      items: 1,
      price: null,
      tierIds: [],
      views: 0,
      moderation: 'approved',
      visibility: 'public',
      createdAt: now.toISOString(),
      live: {
        startsAt: new Date(now.getTime() - 12 * 60000).toISOString(),
        durationMin: 45,
        host: 'Wanjiru Kamau',
        capacity: null,
        status: 'live',
        attending: 38,
        replay: true,
      },
    },
    {
      id: 'ct_live_2',
      tenantId: spa.id,
      title: 'Members evening: guided breathwork',
      kind: 'live',
      durationSec: null,
      items: 1,
      price: null,
      tierIds: ['tier_2', 'tier_3'],
      views: 0,
      moderation: 'approved',
      visibility: 'members_only',
      createdAt: now.toISOString(),
      live: {
        startsAt: iso(addDaysKey(today, 2), '19:00'),
        durationMin: 30,
        host: 'Achieng Otieno',
        capacity: 40,
        status: 'scheduled',
        attending: 17,
        replay: false,
      },
    },
    {
      id: 'ct_live_3',
      tenantId: spa.id,
      title: 'Masterclass: at-home hot stone ritual',
      kind: 'live',
      durationSec: null,
      items: 1,
      price: 150000,
      tierIds: [],
      views: 0,
      moderation: 'approved',
      visibility: 'public',
      createdAt: now.toISOString(),
      live: {
        startsAt: iso(addDaysKey(today, 6), '18:30'),
        durationMin: 60,
        host: 'Wanjiru Kamau',
        capacity: 25,
        status: 'scheduled',
        attending: 9,
        replay: true,
      },
    },
  );

  /* ---------- Guests ---------- */
  const makeGuests = (tenantId: string, n: number, seedOffset: number): Guest[] => {
    const out: Guest[] = [];
    for (let i = 0; i < n; i++) {
      const firstName = FIRST[(i * 7 + seedOffset) % FIRST.length] ?? 'Guest';
      const lastName = LAST[(i * 5 + seedOffset * 3) % LAST.length] ?? '';
      const market = r() < 0.28;
      const detail = market
        ? pick(r, ['Marketplace search', 'Category browse: Massage', 'Marketplace recommendation'])
        : pick(r, [
            'Code SERENITY',
            'Invite link',
            'QR at reception',
            'Code VIP26',
            'Imported list',
          ]);
      out.push({
        id: `g_${tenantId.slice(2, 5)}_${i + 1}`,
        tenantId,
        firstName,
        lastName,
        alias: r() < 0.12 ? pick(r, ['Ms. K', 'J.', 'Mr. O', 'A. Guest', 'Room 7']) : null,
        phone: `+254 7${Math.floor(r() * 10)}${Math.floor(r() * 10)} ${String(Math.floor(r() * 1000)).padStart(3, '0')} ${String(Math.floor(r() * 1000)).padStart(3, '0')}`,
        email:
          r() < 0.6 ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@mail.co.ke` : undefined,
        attribution: market ? 'marketplace' : 'own_channel',
        attributionDetail: detail,
        admittedAt: iso(addDaysKey(today, -Math.floor(r() * 300) - 20), '12:00'),
        visits: 0,
        spend: 0,
        lastVisit: null,
        notes:
          r() < 0.3
            ? pick(r, [
                'Prefers the Jade Room.',
                'Arrives early, offer tea.',
                'Sensitive skin.',
                'Likes a quiet session, no small talk.',
              ])
            : '',
        preferences: r() < 0.6 ? [pick(r, PREFS)] : [],
        tags: r() < 0.2 ? ['VIP'] : [],
        membershipTierId: r() < 0.15 ? pick(r, ['tier_1', 'tier_2', 'tier_3']) : null,
        packageCredits: r() < 0.2 ? Math.floor(r() * 4) + 1 : 0,
        imported: detail === 'Imported list',
      } as Guest);
      const last = out[out.length - 1];
      if (last && last.email === undefined) delete last.email;
    }
    return out;
  };
  const spaGuests = makeGuests(spa.id, 64, 1);
  db.guests.push(...spaGuests);

  /* ---------- Spa bookings ---------- */
  const bookable = db.services.filter((s) => s.tenantId === spa.id && s.visibility !== 'hidden');
  const roomFor = (s: Service): string => {
    if (s.categoryId === 'cat_facial') return 'rm_4';
    if (s.id === 'sv_hammam') return 'rm_5';
    if (s.categoryId === 'cat_couples') return 'rm_3';
    if (s.categoryId === 'cat_nails') return 'rm_6';
    return pick(r, ['rm_1', 'rm_2']);
  };
  const nowIso = now.toISOString();

  for (let offset = -60; offset <= 21; offset++) {
    const day = addDaysKey(today, offset);
    const count =
      offset === 0 ? 16 : offset > 0 ? Math.max(2, 11 - offset / 2) : 8 + Math.floor(r() * 7);
    for (let k = 0; k < count; k++) {
      const s = pick(r, bookable);
      const v = pick(r, s.variants);
      const staffId = pick(r, s.staffIds);
      const roomId = roomFor(s);
      let placed = false;
      for (let attempt = 0; attempt < 6 && !placed; attempt++) {
        const startMin = 9 * 60 + Math.floor(r() * 18) * 30;
        if (startMin + v.durationMin > 19 * 60 + 30) continue;
        const start = iso(day, hhmm(startMin));
        const end = iso(day, hhmm(startMin + v.durationMin));
        const clash = db.bookings.some(
          (b) =>
            b.tenantId === spa.id &&
            !b.state.startsWith('cancelled') &&
            (b.staffId === staffId || b.roomId === roomId) &&
            overlaps(b.start, b.end, start, end),
        );
        if (clash) continue;
        placed = true;
        const guest = pick(r, spaGuests);
        let state: BookingState;
        const roll = r();
        if (end < nowIso)
          state =
            roll < 0.84
              ? 'completed'
              : roll < 0.9
                ? 'no_show'
                : roll < 0.96
                  ? 'cancelled_by_guest'
                  : roll < 0.985
                    ? 'cancelled_by_tenant'
                    : 'disputed';
        else if (start < nowIso) state = 'checked_in';
        else if (offset === 0)
          state = roll < 0.8 ? 'confirmed' : roll < 0.92 ? 'pending_payment' : 'requested';
        else
          state =
            roll < 0.78
              ? 'confirmed'
              : roll < 0.88
                ? 'requested'
                : roll < 0.95
                  ? 'pending_payment'
                  : 'cancelled_by_guest';
        const total = v.price;
        const deposit = Math.round(total * 0.3);
        const paid =
          state === 'completed' || state === 'checked_in' || state === 'disputed'
            ? total
            : state === 'confirmed' || state === 'no_show' || state === 'requested'
              ? deposit
              : state === 'cancelled_by_guest'
                ? deposit
                : 0;
        const createdAt = new Date(
          new Date(start).getTime() - (1 + Math.floor(r() * 14)) * 86_400_000,
        ).toISOString();
        const b: Booking = {
          id: `bk_${db.bookings.length + 1}`,
          ref: ref(r),
          tenantId: spa.id,
          guestId: guest.id,
          serviceId: s.id,
          variantId: v.id,
          staffId,
          roomId,
          unitId: null,
          start,
          end,
          guests: s.categoryId === 'cat_couples' ? 2 : 1,
          state,
          total,
          paid,
          deposit,
          attribution: guest.attribution,
          channel: r() < 0.75 ? 'store' : r() < 0.5 ? 'front_desk' : 'phone',
          notes:
            r() < 0.15
              ? pick(r, [
                  'Birthday treat',
                  'First visit',
                  'Prefers firm pressure',
                  'Running 10 min late',
                ])
              : '',
          createdAt,
          requestExpiresAt:
            state === 'requested'
              ? new Date(
                  Math.min(
                    new Date(start).getTime(),
                    now.getTime() + (2 + Math.floor(r() * 20)) * 3600_000,
                  ),
                ).toISOString()
              : null,
          events: [{ at: createdAt, label: 'Booked in store', actor: 'Guest' }],
        };
        if (paid > 0)
          b.events.push({
            at: createdAt,
            label: `Payment received (${paid === total ? 'full' : 'deposit'})`,
            actor: 'M-Pesa',
          });
        if (state === 'confirmed' || state === 'checked_in' || state === 'completed')
          b.events.push({ at: createdAt, label: 'Confirmed', actor: 'System' });
        if (state === 'checked_in' || state === 'completed')
          b.events.push({ at: start, label: 'Checked in', actor: 'Front desk' });
        if (state === 'completed')
          b.events.push({
            at: end,
            label: 'Completed',
            actor: staff.find((x) => x.id === staffId)?.name ?? 'Staff',
          });
        if (state === 'no_show')
          b.events.push({ at: end, label: 'Marked no-show, deposit kept', actor: 'Front desk' });
        if (state.startsWith('cancelled'))
          b.events.push({
            at: createdAt,
            label:
              state === 'cancelled_by_guest'
                ? 'Cancelled by guest'
                : 'Cancelled by you, full refund',
            actor: state === 'cancelled_by_guest' ? 'Guest' : 'Manager',
          });
        db.bookings.push(b);
        if (state === 'completed') {
          guest.visits += 1;
          guest.spend += total;
          if (!guest.lastVisit || guest.lastVisit < start) guest.lastVisit = start;
        }
        if (paid > 0) {
          const provider = r() < 0.8 ? 'mpesa' : r() < 0.5 ? 'card' : 'cash';
          db.payments.push({
            id: `pay_${db.payments.length + 1}`,
            tenantId: spa.id,
            bookingId: b.id,
            guestId: guest.id,
            provider,
            purpose: paid === total ? 'balance' : 'deposit',
            amount: paid,
            refunded: state === 'cancelled_by_tenant' ? paid : 0,
            status: state === 'cancelled_by_tenant' ? 'refunded' : 'succeeded',
            providerRef:
              provider === 'mpesa'
                ? `S${ref(r).slice(3)}${Math.floor(r() * 90 + 10)}K`
                : provider === 'card'
                  ? `ch_${ref(r).slice(3).toLowerCase()}`
                  : 'CASH',
            at: createdAt,
            reconciled: provider !== 'cash' && end < nowIso,
          });
        }
        if (state === 'pending_payment') {
          db.payments.push({
            id: `pay_${db.payments.length + 1}`,
            tenantId: spa.id,
            bookingId: b.id,
            guestId: guest.id,
            provider: 'mpesa',
            purpose: 'deposit',
            amount: deposit,
            refunded: 0,
            status: 'pending',
            providerRef: '—',
            at: nowIso,
            reconciled: false,
          });
        }
      }
    }
  }
  // A couple of failed STK pushes for realism.
  for (let i = 0; i < 4; i++) {
    const g = pick(r, spaGuests);
    db.payments.push({
      id: `pay_${db.payments.length + 1}`,
      tenantId: spa.id,
      bookingId: null,
      guestId: g.id,
      provider: 'mpesa',
      purpose: 'deposit',
      amount: 135000,
      refunded: 0,
      status: i % 2 ? 'failed' : 'expired',
      providerRef: '—',
      at: iso(addDaysKey(today, -i - 1), '14:20'),
      reconciled: false,
    });
  }
  db.unmatched.push(
    {
      id: 'um_1',
      tenantId: spa.id,
      amount: 450000,
      providerRef: 'SKL7Q2M9PX',
      payerHint: 'Paybill · account "MASSAGE"',
      at: iso(addDaysKey(today, -1), '16:42'),
    },
    {
      id: 'um_2',
      tenantId: spa.id,
      amount: 135000,
      providerRef: 'SKM3A8D1RT',
      payerHint: 'Paybill · account "SV-7F3K"',
      at: iso(today, '08:15'),
    },
  );
  db.blocks.push(
    {
      id: 'blk_1',
      tenantId: spa.id,
      resourceId: 'st_1',
      start: iso(today, '13:00'),
      end: iso(today, '13:45'),
      reason: 'Lunch',
      source: 'manual',
    },
    {
      id: 'blk_2',
      tenantId: spa.id,
      resourceId: 'st_3',
      start: iso(today, '12:30'),
      end: iso(today, '13:15'),
      reason: 'Lunch',
      source: 'manual',
    },
  );

  db.providers.push(
    {
      id: 'pc_1',
      tenantId: spa.id,
      kind: 'mpesa',
      label: 'M-Pesa Paybill',
      state: 'verified',
      masked: '•••• 4821',
      detail: 'Paybill 4•••21 · account ref SV-{ref}',
      order: 1,
      lastCallbackAt: iso(today, '09:12'),
    },
    {
      id: 'pc_2',
      tenantId: spa.id,
      kind: 'card',
      label: 'Card gateway',
      state: 'verified',
      masked: '•••• k9Q2',
      detail: 'Merchant ID ••••7731 · 3-D Secure on',
      order: 2,
      lastCallbackAt: iso(addDaysKey(today, -1), '18:03'),
    },
    {
      id: 'pc_3',
      tenantId: spa.id,
      kind: 'paypal',
      label: 'PayPal',
      state: 'draft',
      masked: '—',
      detail: 'Not connected',
      order: 3,
      lastCallbackAt: null,
    },
  );

  db.codes.push(
    {
      id: 'ac_1',
      tenantId: spa.id,
      code: 'SERENITY',
      kind: 'primary',
      label: 'Primary code',
      scope: 'store',
      expiresAt: null,
      usageLimit: null,
      uses: 412,
      status: 'active',
      createdAt: iso(addDaysKey(today, -320), '10:00'),
    },
    {
      id: 'ac_2',
      tenantId: spa.id,
      code: 'VIP26',
      kind: 'campaign',
      label: 'VIP clients 2026',
      scope: 'invite_items',
      expiresAt: iso(addDaysKey(today, 50), '23:59'),
      usageLimit: 100,
      uses: 37,
      status: 'active',
      createdAt: iso(addDaysKey(today, -40), '10:00'),
    },
    {
      id: 'ac_3',
      tenantId: spa.id,
      code: 'CORPWELL',
      kind: 'campaign',
      label: 'Corporate wellness partners',
      scope: 'store',
      expiresAt: null,
      usageLimit: 250,
      uses: 88,
      status: 'active',
      createdAt: iso(addDaysKey(today, -120), '10:00'),
    },
    {
      id: 'ac_4',
      tenantId: spa.id,
      code: 'MAYGLOW',
      kind: 'campaign',
      label: 'May glow promotion',
      scope: 'store',
      expiresAt: iso(addDaysKey(today, -150), '23:59'),
      usageLimit: 50,
      uses: 50,
      status: 'expired',
      createdAt: iso(addDaysKey(today, -190), '10:00'),
    },
    {
      id: 'ac_5',
      tenantId: spa.id,
      code: 'INV-8KD2Q',
      kind: 'personal',
      label: 'Personal invite · +254 7•• ••• 214',
      scope: 'store',
      expiresAt: iso(addDaysKey(today, 6), '23:59'),
      usageLimit: 1,
      uses: 0,
      status: 'active',
      createdAt: iso(addDaysKey(today, -1), '10:00'),
    },
  );

  db.policies[spa.id] = {
    paymentAtBooking: 'percent_deposit',
    depositValue: 30,
    balance: 'at_venue',
    freeCancelHours: 24,
    lateCancel: 'deposit_kept',
    lateCancelPct: 50,
    noShow: 'deposit_forfeited',
    leadTimeHours: 2,
    horizonDays: 60,
    whoCanBook: 'anyone',
    approval: 'instant',
    approvalWindowHours: 12,
    maxPerGuestPerDay: 2,
    maxPartySize: 4,
  };

  db.storefronts.push({
    tenantId: spa.id,
    theme: 'emerald',
    accent: '#C8A96A',
    displayName: spa.name,
    tagline: spa.tagline,
    showContacts: false,
    sections: (
      [
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
      ] as const
    ).map((kind) => ({
      kind,
      enabled: !['video', 'faq'].includes(kind),
    })),
    logo: SERENITY_LOGO,
    palette: null,
    sectionStyles: {
      hero: { background: 'texture', texture: 'glow', photo: null, overlay: 20 },
      memberships: { background: 'soft', texture: null, photo: null, overlay: 0 },
    },
    marquee: {
      enabled: true,
      speed: 'normal',
      style: 'accent',
      items: [
        {
          id: 'mq_1',
          kind: 'offer',
          text: 'Midweek calm: 15% off all massages, Monday to Wednesday',
          serviceId: null,
          enabled: true,
        },
        {
          id: 'mq_2',
          kind: 'service',
          text: 'New on the menu: Hot stone massage',
          serviceId: 'sv_stone',
          enabled: true,
        },
        {
          id: 'mq_3',
          kind: 'message',
          text: 'Gift cards are available in the store',
          serviceId: null,
          enabled: true,
        },
        { id: 'mq_4', kind: 'season', text: '', serviceId: null, enabled: false },
      ],
    },
    season: { id: null, auto: false, recolor: true },
    cover: {
      image: '/demo/stones.jpg',
      headline: 'Quiet hours, expert hands.',
      subline:
        'A private sanctuary in Westlands for massage, facials and slow rituals. By invitation.',
      layout: 'full',
      ctaLabel: 'Book a visit',
    },
    socials: [
      {
        network: 'instagram',
        handle: 'serenity.westlands',
        connected: true,
        connectedAt: iso(addDaysKey(today, -40), '10:00'),
        followers: 12400,
        showOnStore: true,
        bookButton: true,
      },
      {
        network: 'whatsapp',
        handle: '+254 7** *** 214',
        connected: true,
        connectedAt: iso(addDaysKey(today, -40), '10:05'),
        followers: null,
        showOnStore: true,
        bookButton: false,
      },
      {
        network: 'facebook',
        handle: '',
        connected: false,
        connectedAt: null,
        followers: null,
        showOnStore: false,
        bookButton: false,
      },
      {
        network: 'x',
        handle: '',
        connected: false,
        connectedAt: null,
        followers: null,
        showOnStore: false,
        bookButton: false,
      },
      {
        network: 'tiktok',
        handle: '',
        connected: false,
        connectedAt: null,
        followers: null,
        showOnStore: false,
        bookButton: false,
      },
    ],
    hasDraft: true,
    versions: [
      {
        id: 'v7',
        label: 'Version 7: new couples menu',
        at: iso(addDaysKey(today, -6), '17:20'),
        by: 'Amani Mwangi',
        live: true,
      },
      {
        id: 'v6',
        label: 'Version 6: updated team photos',
        at: iso(addDaysKey(today, -22), '11:05'),
        by: 'Lilian Achieng',
        live: false,
      },
      {
        id: 'v5',
        label: 'Version 5: memberships launched',
        at: iso(addDaysKey(today, -48), '09:40'),
        by: 'Amani Mwangi',
        live: false,
      },
    ],
  });

  db.team.push(
    {
      id: 'tm_1',
      tenantId: spa.id,
      name: 'Amani Mwangi',
      email: 'amani@serenity.co.ke',
      role: 'owner',
      added: [],
      removed: [],
      status: 'active',
      twoFactor: true,
      lastActive: nowIso,
      staffId: null,
    },
    {
      id: 'tm_2',
      tenantId: spa.id,
      name: 'Lilian Achieng',
      email: 'lilian@serenity.co.ke',
      role: 'manager',
      added: [],
      removed: [],
      status: 'active',
      twoFactor: true,
      lastActive: iso(today, '08:40'),
      staffId: null,
    },
    {
      id: 'tm_3',
      tenantId: spa.id,
      name: 'Joy Wambui',
      email: 'frontdesk@serenity.co.ke',
      role: 'front_desk',
      added: [],
      removed: [],
      status: 'active',
      twoFactor: true,
      lastActive: iso(today, '09:02'),
      staffId: null,
    },
    {
      id: 'tm_4',
      tenantId: spa.id,
      name: 'Wanjiru Kamau',
      email: 'wanjiru@serenity.co.ke',
      role: 'practitioner',
      added: [],
      removed: [],
      status: 'active',
      twoFactor: false,
      lastActive: iso(addDaysKey(today, -1), '18:30'),
      staffId: 'st_1',
    },
    {
      id: 'tm_5',
      tenantId: spa.id,
      name: 'Ian Ochieng',
      email: 'ian@studio-ochieng.com',
      role: 'content_editor',
      added: [],
      removed: [],
      status: 'active',
      twoFactor: true,
      lastActive: iso(addDaysKey(today, -3), '14:10'),
      staffId: null,
    },
    {
      id: 'tm_6',
      tenantId: spa.id,
      name: 'Kimani & Co. Accountants',
      email: 'books@kimaniandco.co.ke',
      role: 'accountant',
      added: [],
      removed: [],
      status: 'invited',
      twoFactor: false,
      lastActive: null,
      staffId: null,
    },
  );

  /* ---------- Messages ---------- */
  const msgDefs: [string, string][] = [
    [
      'Hi, is the Couples Suite free this Saturday evening?',
      'Hello! Saturday 18:00 is open. Shall I hold it for you?',
    ],
    ['Running about 10 minutes late, sorry!', 'No problem at all, see you soon.'],
    ['Can I move my facial to Thursday?', ''],
    ['Do you have parking?', 'Yes, there is secure basement parking. Mention "SV" at the gate.'],
    ['Thank you for today, felt amazing.', 'So glad to hear that. See you next time!'],
    ['Is there a female therapist available for deep tissue?', ''],
    [
      'Can I buy a gift card for my sister?',
      'Of course. You can buy it in the store under Gift cards, or we can send a link.',
    ],
  ];
  msgDefs.forEach(([q, a], i) => {
    const g = spaGuests[i * 3] ?? spaGuests[0];
    if (!g) return;
    const t0 = new Date(now.getTime() - (i * 5 + 1) * 3600_000).toISOString();
    const t1 = new Date(now.getTime() - i * 5 * 3600_000 - 600_000).toISOString();
    db.conversations.push({
      id: `cv_${i + 1}`,
      tenantId: spa.id,
      guestId: g.id,
      assignedTo: i % 3 === 0 ? 'tm_3' : null,
      unread: a ? 0 : 1 + (i % 2),
      messages: [
        { id: `m_${i}_1`, from: 'guest', author: g.firstName, body: q, at: t0 },
        ...(a
          ? [
              {
                id: `m_${i}_2`,
                from: 'staff' as const,
                author: 'Joy (front desk)',
                body: a,
                at: t1,
              },
            ]
          : []),
      ],
    });
  });

  /* ---------- Marketing ---------- */
  db.campaigns.push(
    {
      id: 'cp_1',
      tenantId: spa.id,
      name: 'Mid-week calm: 15% off Tue–Thu',
      segment: 'Guests with 2+ visits',
      channel: 'whatsapp',
      status: 'sent',
      audience: 128,
      sentAt: iso(addDaysKey(today, -12), '10:00'),
      bookings: 23,
    },
    {
      id: 'cp_2',
      tenantId: spa.id,
      name: 'We miss you',
      segment: 'No visit in 60 days',
      channel: 'sms',
      status: 'sent',
      audience: 74,
      sentAt: iso(addDaysKey(today, -30), '11:00'),
      bookings: 9,
    },
    {
      id: 'cp_3',
      tenantId: spa.id,
      name: 'December gift cards',
      segment: 'All admitted guests',
      channel: 'email',
      status: 'scheduled',
      audience: 296,
      sentAt: iso(addDaysKey(today, 14), '09:00'),
      bookings: 0,
    },
    {
      id: 'cp_4',
      tenantId: spa.id,
      name: 'Gold members: new ritual',
      segment: 'Gold tier members',
      channel: 'push',
      status: 'draft',
      audience: 19,
      sentAt: null,
      bookings: 0,
    },
  );
  const reviewBodies = [
    'Wanjiru has magic hands. Best deep tissue in Nairobi.',
    'So peaceful and private. Loved the tea afterwards.',
    'Facial was lovely, skin glowing for days.',
    'Booking with M-Pesa was effortless. Will be back.',
    'The hammam is a must. Felt brand new.',
    'Good massage but the room was a little warm.',
    'Discreet, professional, spotless.',
    'Started 10 minutes late, but the session was worth it.',
  ];
  reviewBodies.forEach((body, i) => {
    const g = spaGuests[i * 5 + 2] ?? spaGuests[0];
    if (!g) return;
    db.reviews.push({
      id: `rv_${i + 1}`,
      tenantId: spa.id,
      guestId: g.id,
      rating: i === 5 || i === 7 ? 4 : 5,
      body,
      at: iso(addDaysKey(today, -i * 4 - 1), '19:00'),
      reply: i % 3 === 0 ? 'Thank you, we look forward to welcoming you back.' : null,
      serviceName: pick(r, [
        'Deep tissue massage',
        'Signature facial',
        'Moroccan hammam',
        'Swedish massage',
      ]),
    });
  });
  db.loyalty[spa.id] = {
    referralsOn: true,
    referralReward: 100000,
    loyaltyOn: true,
    visitsForReward: 8,
  };

  /* ---------- Billing ---------- */
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const period = d.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    db.invoices.push({
      id: `inv_${i + 1}`,
      tenantId: spa.id,
      number: `SV-KE-2026-${String(180 - i * 11).padStart(4, '0')}`,
      period,
      subscription: SAMPLE_PLAN.amount,
      fees: Math.floor(r() * 6 + 1) * 45000,
      credits: i === 2 ? 45000 : 0,
      status: i === 0 ? 'open' : 'paid',
      issuedAt: d.toISOString(),
    });
  }
  // Marketplace fee lines: first completed booking of marketplace-attributed guests.
  for (const g of spaGuests.filter((x) => x.attribution === 'marketplace')) {
    const first = db.bookings
      .filter((b) => b.guestId === g.id && b.state === 'completed')
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    const anyCancelled = db.bookings.find(
      (b) => b.guestId === g.id && b.state === 'cancelled_by_guest',
    );
    if (first) {
      const fee = Math.min(
        SAMPLE_FEE_RULE.maximum,
        Math.max(
          SAMPLE_FEE_RULE.minimum,
          Math.round((first.total * SAMPLE_FEE_RULE.percent) / 100),
        ),
      );
      db.feeLines.push({
        id: `fee_${db.feeLines.length + 1}`,
        tenantId: spa.id,
        guestId: g.id,
        bookingId: first.id,
        bookingValue: first.total,
        fee,
        status: 'raised',
        explanation: `First completed booking (${first.ref}) of a guest who found you through ${g.attributionDetail.toLowerCase()}. Later bookings by this guest are fee-free.`,
        at: first.end,
      });
    } else if (anyCancelled) {
      db.feeLines.push({
        id: `fee_${db.feeLines.length + 1}`,
        tenantId: spa.id,
        guestId: g.id,
        bookingId: anyCancelled.id,
        bookingValue: anyCancelled.total,
        fee: 0,
        status: 'voided',
        explanation: `First booking (${anyCancelled.ref}) was cancelled, so no fee applies. A fee is due only when a first booking completes.`,
        at: anyCancelled.start,
      });
    }
  }
  const disputed = db.feeLines[2];
  if (disputed) disputed.status = 'disputed';

  db.notificationPrefs[spa.id] = {
    'New booking': true,
    'Booking request': true,
    Cancellation: true,
    'Payment failed': true,
    'Provider failing': true,
    'New message': true,
    'New review': false,
    'Daily summary': true,
  };

  /* ===================== Tenant 2: short-stay ===================== */
  const stay: Tenant = {
    id: 't_karibu',
    name: 'Karibu Garden Suites',
    handle: 'KARIBU',
    vertical: 'short_stay',
    kind: 'house',
    status: 'setup',
    visibility: 'private',
    timezone: TZ,
    currency: 'KES',
    area: 'Karen, Nairobi',
    tagline: 'Garden stays, a world away.',
    description: 'Four private garden suites in Karen. Self check-in, quiet grounds, fast Wi-Fi.',
    accent: '#3B2A3F',
    verification: 'pending',
  };
  db.tenants.push(stay);
  db.locations.push({
    id: 'loc_karen',
    tenantId: stay.id,
    name: 'Karen',
    address: 'Off Karen Road, Karen, Nairobi',
    area: 'Karen',
    hours: WEEK.map((day) => ({ day, open: '07:00', close: '22:00', closed: false })),
    arrivalInstructions:
      'Gate code and key box details are sent once payment and registration are complete.',
  });
  const units: Resource[] = [
    { name: 'Garden Cottage', bd: 1, mg: 2 },
    { name: 'Acacia Suite', bd: 2, mg: 4 },
    { name: 'Baobab Villa', bd: 3, mg: 6 },
    { name: 'Studio Loft', bd: 1, mg: 2 },
  ].map((u, i) => ({
    id: `un_${i + 1}`,
    tenantId: stay.id,
    type: 'unit' as const,
    name: u.name,
    locationId: 'loc_karen',
    capacity: u.mg,
    visible: true,
    bedrooms: u.bd,
    beds: u.bd,
    bathrooms: Math.max(1, u.bd - 1),
    maxGuests: u.mg,
    amenities: ['Wi-Fi', 'Kitchen', 'Parking', i === 2 ? 'Private pool' : 'Garden view'],
    traLicence: i === 3 ? '' : `TRA/STA/${2026}/${1400 + i}`,
  }));
  db.resources.push(...units);
  units.forEach((u, i) =>
    db.ratePlans.push({
      id: `rp_${i + 1}`,
      tenantId: stay.id,
      unitId: u.id,
      name: 'Standard',
      nightly: [850000, 1400000, 2600000, 700000][i] ?? 800000,
      weekend: [950000, 1600000, 3000000, 800000][i] ?? 900000,
      minNights: i === 2 ? 2 : 1,
      maxNights: 28,
      cleaningFee: 150000,
      extraGuestFee: 100000,
      damageDeposit: [500000, 1000000, 2000000, 500000][i] ?? 500000,
      visibility: 'public',
    }),
  );
  db.categories.push({
    id: 'cat_units',
    tenantId: stay.id,
    name: 'Suites & villas',
    order: 0,
    visibility: 'public',
  });
  db.addOns.push(
    {
      id: 'ao_s1',
      tenantId: stay.id,
      name: 'Airport pickup',
      price: 350000,
      durationMin: 0,
      appliesTo: 'All units',
      visibility: 'public',
    },
    {
      id: 'ao_s2',
      tenantId: stay.id,
      name: 'Breakfast hamper',
      price: 180000,
      durationMin: 0,
      appliesTo: 'All units',
      visibility: 'public',
    },
    {
      id: 'ao_s3',
      tenantId: stay.id,
      name: 'Late checkout (2 pm)',
      price: 200000,
      durationMin: 0,
      appliesTo: 'All units',
      visibility: 'public',
    },
  );
  const stayGuests = makeGuests(stay.id, 30, 9);
  db.guests.push(...stayGuests);
  units.forEach((u, ui) => {
    let cursor = -20 + ui * 2;
    while (cursor < 30) {
      const nights = 1 + Math.floor(r() * 4);
      const startDay = addDaysKey(today, cursor);
      const endDay = addDaysKey(today, cursor + nights);
      const start = iso(startDay, '14:00');
      const end = iso(endDay, '10:00');
      const g = pick(r, stayGuests);
      const rp = db.ratePlans.find((x) => x.unitId === u.id);
      const total = (rp?.nightly ?? 800000) * nights + (rp?.cleaningFee ?? 0);
      const state: BookingState =
        end < nowIso
          ? 'completed'
          : start < nowIso
            ? 'checked_in'
            : r() < 0.85
              ? 'confirmed'
              : 'requested';
      const createdAt = iso(addDaysKey(startDay, -7), '12:00');
      db.bookings.push({
        id: `bk_${db.bookings.length + 1}`,
        ref: ref(r),
        tenantId: stay.id,
        guestId: g.id,
        serviceId: null,
        variantId: null,
        staffId: null,
        roomId: null,
        unitId: u.id,
        start,
        end,
        guests: 1 + Math.floor(r() * (u.maxGuests ?? 2)),
        state,
        total,
        paid: state === 'requested' ? Math.round(total * 0.5) : total,
        deposit: Math.round(total * 0.5),
        attribution: g.attribution,
        channel: 'store',
        notes: '',
        createdAt,
        requestExpiresAt:
          state === 'requested' ? new Date(now.getTime() + 9 * 3600_000).toISOString() : null,
        events: [{ at: createdAt, label: 'Booked in store', actor: 'Guest' }],
      });
      cursor += nights + Math.floor(r() * 4);
      if (r() < 0.35 && cursor < 30) {
        const len = 1 + Math.floor(r() * 3);
        db.blocks.push({
          id: `blk_${db.blocks.length + 1}`,
          tenantId: stay.id,
          resourceId: u.id,
          start: iso(addDaysKey(today, cursor), '14:00'),
          end: iso(addDaysKey(today, cursor + len), '10:00'),
          reason: pick(r, ['Airbnb', 'Booking.com', 'Owner stay', 'Maintenance']),
          source: r() < 0.6 ? 'ical' : 'manual',
        });
        cursor += len;
      }
    }
  });
  db.providers.push(
    {
      id: 'pc_s1',
      tenantId: stay.id,
      kind: 'mpesa',
      label: 'M-Pesa Till',
      state: 'testing',
      masked: '•••• 9930',
      detail: 'Buy Goods Till 5•••30 · awaiting test callback',
      order: 1,
      lastCallbackAt: null,
    },
    {
      id: 'pc_s2',
      tenantId: stay.id,
      kind: 'card',
      label: 'Card gateway',
      state: 'failing',
      masked: '•••• P0x1',
      detail: 'Credentials rejected by provider (401)',
      order: 2,
      lastCallbackAt: iso(addDaysKey(today, -9), '10:00'),
    },
  );
  db.codes.push({
    id: 'ac_s1',
    tenantId: stay.id,
    code: 'KARIBU',
    kind: 'primary',
    label: 'Primary code',
    scope: 'store',
    expiresAt: null,
    usageLimit: null,
    uses: 23,
    status: 'active',
    createdAt: iso(addDaysKey(today, -30), '10:00'),
  });
  db.policies[stay.id] = {
    paymentAtBooking: 'percent_deposit',
    depositValue: 50,
    balance: 'auto_request',
    freeCancelHours: 72,
    lateCancel: 'percent_fee',
    lateCancelPct: 50,
    noShow: 'deposit_forfeited',
    leadTimeHours: 6,
    horizonDays: 180,
    whoCanBook: 'anyone',
    approval: 'request',
    approvalWindowHours: 12,
    maxPerGuestPerDay: 1,
    maxPartySize: 6,
  };
  db.storefronts.push({
    tenantId: stay.id,
    theme: 'plum',
    accent: '#C8A96A',
    displayName: stay.name,
    tagline: stay.tagline,
    showContacts: false,
    sections: (
      ['hero', 'featured', 'gallery', 'video', 'reviews', 'policies', 'location', 'faq'] as const
    ).map((kind) => ({ kind, enabled: kind !== 'video' })),
    logo: null,
    palette: null,
    sectionStyles: {},
    marquee: { enabled: false, speed: 'normal', style: 'accent', items: [] },
    season: { id: null, auto: false, recolor: true },
    cover: {
      image: null,
      headline: 'Garden suites in Karen',
      subline: 'Quiet stays under the trees.',
      layout: 'color',
      ctaLabel: 'Check dates',
    },
    socials: (['instagram', 'whatsapp', 'facebook', 'x', 'tiktok'] as const).map((network) => ({
      network,
      handle: '',
      connected: false,
      connectedAt: null,
      followers: null,
      showOnStore: false,
      bookButton: false,
    })),
    hasDraft: true,
    versions: [],
  });
  db.team.push(
    {
      id: 'tm_s1',
      tenantId: stay.id,
      name: 'Amani Mwangi',
      email: 'amani@karibugardens.co.ke',
      role: 'owner',
      added: [],
      removed: [],
      status: 'active',
      twoFactor: true,
      lastActive: nowIso,
      staffId: null,
    },
    {
      id: 'tm_s2',
      tenantId: stay.id,
      name: 'Peter Kimani',
      email: 'host@karibugardens.co.ke',
      role: 'manager',
      added: [],
      removed: [],
      status: 'active',
      twoFactor: true,
      lastActive: iso(today, '07:50'),
      staffId: null,
    },
  );
  db.registrations.push(
    ...db.bookings
      .filter(
        (b) => b.tenantId === stay.id && (b.state === 'checked_in' || b.state === 'completed'),
      )
      .slice(-8)
      .map((b, i) => {
        const g = stayGuests.find((x) => x.id === b.guestId);
        return {
          id: `reg_${i + 1}`,
          tenantId: stay.id,
          bookingId: b.id,
          fullName: g ? `${g.firstName} ${g.lastName}` : 'Guest',
          nationality: pick(r, ['Kenyan', 'Kenyan', 'Ugandan', 'British', 'German', 'Tanzanian']),
          idMasked: `••••${Math.floor(r() * 9000 + 1000)}`,
          at: b.start,
        };
      }),
  );
  for (let i = 1; i <= 4; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    db.levyReports.push({
      id: `lv_${i}`,
      tenantId: stay.id,
      period: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      nights: 40 + Math.floor(r() * 50),
      taxable: (40 + Math.floor(r() * 50)) * 1100000,
      status: i === 1 ? 'draft' : 'filed',
    });
  }
  db.loyalty[stay.id] = {
    referralsOn: false,
    referralReward: 0,
    loyaltyOn: false,
    visitsForReward: 5,
  };
  db.notificationPrefs[stay.id] = { ...db.notificationPrefs[spa.id] };

  /* ---------- Audit log seed ---------- */
  const auditSeed: [string, string, string, string, string, number][] = [
    [spa.id, 'Amani Mwangi', 'storefront.published', 'Storefront', 'Version 7 published', -6],
    [
      spa.id,
      'Lilian Achieng',
      'catalogue.price_changed',
      'Couples retreat',
      'KES 13,000 → KES 14,000',
      -9,
    ],
    [spa.id, 'Amani Mwangi', 'access_code.created', 'VIP26', 'Campaign code, limit 100', -40],
    [spa.id, 'Joy Wambui', 'payment.cash_recorded', 'Booking', 'Cash KES 4,500 recorded', -2],
    [
      spa.id,
      'Amani Mwangi',
      'payment_account.viewed',
      'M-Pesa Paybill',
      'Masked credentials viewed',
      -14,
    ],
    [
      spa.id,
      'Stayvinci Support',
      'impersonation.read_only',
      'Tenant',
      'Read-only session with owner consent (ticket #4471)',
      -18,
    ],
    [spa.id, 'Lilian Achieng', 'booking.refunded', 'Booking', 'Full refund KES 6,500', -4],
    [spa.id, 'Amani Mwangi', 'member.role_changed', 'Joy Wambui', 'Manager → Front desk', -60],
    [
      stay.id,
      'Amani Mwangi',
      'payment_account.created',
      'M-Pesa Till',
      'Connection created, test pending',
      -3,
    ],
    [stay.id, 'System', 'payment_account.failing', 'Card gateway', 'Provider returned 401', -9],
  ];
  auditSeed.forEach(([tenantId, actor, action, target, detail, d], i) =>
    db.audit.push({
      id: `au_${i + 1}`,
      tenantId,
      actor,
      action,
      target,
      detail,
      at: iso(addDaysKey(today, d), '10:30'),
    }),
  );
  db.audit.sort((a, b) => b.at.localeCompare(a.at));

  return db;
}
