// Platform-wide demo data for the admin console (spec §12, §13).
// Everything here is what Stayvinci staff see across all Houses. Guest money
// never passes through Stayvinci: transactions are records of payments that
// went straight into each House's own Paybill or Till.
import { addDaysKey, dayKey, zonedToUtc } from './format';
import type { ProviderState, TenantStatus, Vertical } from './types';

const TZ = 'Africa/Nairobi';

/* ---------- Console roles ---------- */

export type PlatformRole = 'super_admin' | 'admin' | 'finance' | 'marketing';

export type PlatformCapability =
  | 'tenant.view'
  | 'tenant.create'
  | 'tenant.manage'
  | 'tenant.assist'
  | 'transaction.view'
  | 'insight.view'
  | 'plan.manage'
  | 'feature.manage'
  | 'billing.manage'
  | 'marketplace.manage'
  | 'staff.manage'
  | 'audit.view'
  | 'ads.manage';

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  finance: 'Finance',
  marketing: 'Marketing',
};

export const PLATFORM_ROLE_SUMMARY: Record<PlatformRole, string> = {
  super_admin: 'Everything, including plans, feature releases and staff accounts.',
  admin: 'Onboard and manage Houses, set up and edit their stores, watch transactions.',
  finance: 'Subscriptions, invoices, marketplace fees and transaction data.',
  marketing: 'Ads for Stayvinci, marketplace listings, featured Houses and growth insights.',
};

const ALL_CAPS: PlatformCapability[] = [
  'tenant.view',
  'tenant.create',
  'tenant.manage',
  'tenant.assist',
  'transaction.view',
  'insight.view',
  'plan.manage',
  'feature.manage',
  'billing.manage',
  'marketplace.manage',
  'staff.manage',
  'audit.view',
  'ads.manage',
];

export const PLATFORM_ROLE_CAPS: Record<PlatformRole, PlatformCapability[]> = {
  super_admin: ALL_CAPS,
  admin: [
    'tenant.view',
    'tenant.create',
    'tenant.manage',
    'tenant.assist',
    'transaction.view',
    'insight.view',
    'feature.manage',
    'audit.view',
  ],
  finance: ['tenant.view', 'transaction.view', 'insight.view', 'billing.manage', 'audit.view'],
  marketing: ['tenant.view', 'insight.view', 'marketplace.manage', 'ads.manage'],
};

export interface PlatformStaff {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  twoFactor: boolean;
  status: 'active' | 'invited';
  lastActive: string | null;
}

/* ---------- Plans and features ---------- */

export type PlanId = 'solo' | 'business' | 'signature';

export type FeatureKey =
  | 'bookings'
  | 'mpesa_payments'
  | 'private_store'
  | 'team_permissions'
  | 'memberships'
  | 'packages_gift_cards'
  | 'paid_content'
  | 'marketing_campaigns'
  | 'reviews'
  | 'advanced_reports'
  | 'marketplace_listing'
  | 'short_stay'
  | 'multi_location'
  | 'guest_import'
  | 'card_payments'
  | 'loyalty_points'
  | 'waitlist';

/** Release stage: who can get the feature at all, before plans are considered. */
export type FeatureStage = 'internal' | 'beta' | 'general';

export interface FeatureDef {
  key: FeatureKey;
  name: string;
  description: string;
  area: 'Core' | 'Sell more' | 'Grow' | 'Operations';
  /** Core features are on for every House on every plan. */
  core: boolean;
  stage: FeatureStage;
  /** Houses that get an internal or beta feature before general release. */
  testers: string[];
  releasedAt: string | null;
}

export interface Plan {
  id: PlanId;
  name: string;
  audience: string;
  features: FeatureKey[];
  /** Prices are not decided yet (CLAUDE.md rule 7). */
  price: null;
}

export interface FeatureOverride {
  feature: FeatureKey;
  on: boolean;
  reason: string;
  until: string | null;
  by: string;
  at: string;
}

/* ---------- Houses (tenants) as the platform sees them ---------- */

export type PayMethod = 'paybill' | 'till';
export type PayMode = 'daraja' | 'manual';

export interface PlatformTenant {
  id: string;
  name: string;
  handle: string;
  kind: 'house' | 'atelier';
  vertical: Vertical;
  category: string;
  area: string;
  status: TenantStatus;
  plan: PlanId;
  interval: 'monthly' | 'annual';
  source: 'self_signup' | 'invited';
  joinedAt: string;
  liveAt: string | null;
  owner: { name: string; phoneMasked: string; email: string };
  staffCount: number;
  checklist: { done: number; total: number };
  onboardingManager: string | null;
  payment: {
    method: PayMethod;
    mode: PayMode;
    shortcodeMasked: string;
    state: ProviderState;
    lastCallbackAt: string | null;
  } | null;
  visibility: 'private' | 'listed' | 'listed_limited';
  featured: boolean;
  overrides: FeatureOverride[];
  /** Monthly revenue the owner declared at sign-up, before Stayvinci (minor units). */
  baselineMonthly: number | null;
  /** True when the business app's demo data has this House's full store. */
  demoStore: boolean;
  notes: { at: string; by: string; text: string }[];
}

/* ---------- Transactions and insights ---------- */

export type TxnStatus = 'succeeded' | 'failed' | 'pending' | 'expired' | 'refunded';

export interface PlatformTransaction {
  id: string;
  tenantId: string;
  at: string;
  amount: number;
  currency: string;
  method: PayMethod | 'card' | 'cash';
  flow: 'stk_push' | 'c2b' | 'manual' | 'card';
  status: TxnStatus;
  failure: string | null;
  purpose: 'deposit' | 'full_payment' | 'balance' | 'package' | 'membership' | 'gift_card';
  bookingRef: string;
  attribution: 'own_channel' | 'marketplace';
  /** Pseudonymous guest reference: lets us count repeat guests without personal data. */
  guestRef: string;
  newGuest: boolean;
  /** Seconds from payment request to confirmed callback. */
  confirmSeconds: number | null;
}

export interface TenantMonth {
  tenantId: string;
  month: string; // YYYY-MM
  bookings: number;
  revenue: number;
  guests: number;
  repeatGuests: number;
  marketplaceGuests: number;
  noShows: number;
}

export interface PlatformAuditEntry {
  id: string;
  at: string;
  actor: string;
  role: PlatformRole | 'house_owner' | 'system';
  action: string;
  tenantId: string | null;
  detail: string;
}

export interface Subscription {
  tenantId: string;
  status: 'trial' | 'active' | 'past_due' | 'suspended' | 'not_started';
  nextBillingAt: string | null;
  coupon: string | null;
  invoices: { number: string; period: string; status: 'paid' | 'open' | 'overdue' }[];
}

/* ---------- Ads: marketing Stayvinci itself ---------- */

export type AdChannel = 'meta' | 'google' | 'tiktok' | 'x' | 'linkedin';
export type AdObjective = 'house_signups' | 'guest_installs' | 'awareness';
export type MarketCode = 'KE' | 'TZ' | 'UG' | 'ZA' | 'AE' | 'NG';

export interface AdAccount {
  channel: AdChannel;
  connected: boolean;
  accountName: string | null;
  currency: string;
}

export interface AdCampaign {
  id: string;
  name: string;
  channel: AdChannel;
  objective: AdObjective;
  market: MarketCode;
  audience: string;
  status: 'active' | 'paused' | 'draft' | 'ended';
  /** Daily budget in minor units of `currency`. Paid from Stayvinci's own ad budget. */
  dailyBudget: number;
  currency: string;
  startAt: string;
  endAt: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  /** People who started sign-up or installed. */
  leads: number;
  /** Completed outcomes: Houses that signed up, or guests who entered a store. */
  conversions: number;
  creative: { headline: string; body: string; image: string; cta: string };
}

export interface PlatformDb {
  staff: PlatformStaff[];
  plans: Plan[];
  features: FeatureDef[];
  tenants: PlatformTenant[];
  transactions: PlatformTransaction[];
  months: TenantMonth[];
  subscriptions: Subscription[];
  audit: PlatformAuditEntry[];
  adAccounts: AdAccount[];
  campaigns: AdCampaign[];
}

/* ---------- Seed ---------- */

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

const FEATURES: Omit<FeatureDef, 'releasedAt'>[] = [
  {
    key: 'bookings',
    name: 'Bookings and calendar',
    description: 'Online booking, calendar, requests and check-in.',
    area: 'Core',
    core: true,
    stage: 'general',
    testers: [],
  },
  {
    key: 'mpesa_payments',
    name: 'M-Pesa payments',
    description: 'Paybill or Till, via Daraja (automatic) or manual confirmation.',
    area: 'Core',
    core: true,
    stage: 'general',
    testers: [],
  },
  {
    key: 'private_store',
    name: 'Private store and codes',
    description: 'Branded store, private codes, links and QR.',
    area: 'Core',
    core: true,
    stage: 'general',
    testers: [],
  },
  {
    key: 'team_permissions',
    name: 'Team and permissions',
    description: 'Invite staff with roles and per-person permissions.',
    area: 'Operations',
    core: false,
    stage: 'general',
    testers: [],
  },
  {
    key: 'memberships',
    name: 'Memberships',
    description: 'Membership tiers with perks and members-only items.',
    area: 'Sell more',
    core: false,
    stage: 'general',
    testers: [],
  },
  {
    key: 'packages_gift_cards',
    name: 'Packages and gift cards',
    description: 'Session packages, credits and gift cards.',
    area: 'Sell more',
    core: false,
    stage: 'general',
    testers: [],
  },
  {
    key: 'paid_content',
    name: 'Paid content',
    description: 'Videos and guides guests can buy or unlock.',
    area: 'Sell more',
    core: false,
    stage: 'general',
    testers: [],
  },
  {
    key: 'marketing_campaigns',
    name: 'Marketing campaigns',
    description: 'Offers and messages to guest segments.',
    area: 'Grow',
    core: false,
    stage: 'general',
    testers: [],
  },
  {
    key: 'reviews',
    name: 'Reviews',
    description: 'Collect and reply to verified guest reviews.',
    area: 'Grow',
    core: false,
    stage: 'general',
    testers: [],
  },
  {
    key: 'advanced_reports',
    name: 'Advanced reports',
    description: 'Revenue, retention and staff performance reports with export.',
    area: 'Operations',
    core: false,
    stage: 'general',
    testers: [],
  },
  {
    key: 'marketplace_listing',
    name: 'Marketplace listing',
    description: 'Appear in Discover so new guests can find the House.',
    area: 'Grow',
    core: false,
    stage: 'general',
    testers: [],
  },
  {
    key: 'short_stay',
    name: 'Short stays',
    description: 'Nightly units, rate plans, iCal sync and guest registration.',
    area: 'Core',
    core: false,
    stage: 'general',
    testers: [],
  },
  {
    key: 'multi_location',
    name: 'Multiple locations',
    description: 'Run more than one branch from one account.',
    area: 'Operations',
    core: false,
    stage: 'general',
    testers: [],
  },
  {
    key: 'guest_import',
    name: 'Guest import',
    description: 'Bring an existing client list in from a spreadsheet.',
    area: 'Operations',
    core: false,
    stage: 'general',
    testers: [],
  },
  {
    key: 'card_payments',
    name: 'Card payments',
    description: 'A card gateway alongside M-Pesa (phase P2).',
    area: 'Sell more',
    core: false,
    stage: 'beta',
    testers: ['t_serenity', 't_karibu'],
  },
  {
    key: 'loyalty_points',
    name: 'Loyalty points',
    description: 'Guests earn points per visit and redeem them for treats.',
    area: 'Grow',
    core: false,
    stage: 'beta',
    testers: ['t_serenity', 't_nyota'],
  },
  {
    key: 'waitlist',
    name: 'Waitlist',
    description: 'Guests join a waitlist for full slots and get offered cancellations.',
    area: 'Sell more',
    core: false,
    stage: 'internal',
    testers: [],
  },
];

const PLANS: Plan[] = [
  {
    id: 'solo',
    name: 'Solo',
    audience: 'Ateliers and one-chair studios',
    price: null,
    features: ['bookings', 'mpesa_payments', 'private_store', 'reviews', 'packages_gift_cards'],
  },
  {
    id: 'business',
    name: 'Business',
    audience: 'Spas, salons and lounges with a team',
    price: null,
    features: [
      'bookings',
      'mpesa_payments',
      'private_store',
      'reviews',
      'packages_gift_cards',
      'team_permissions',
      'memberships',
      'marketing_campaigns',
      'marketplace_listing',
      'guest_import',
      'short_stay',
    ],
  },
  {
    id: 'signature',
    name: 'Signature',
    audience: 'Premium and multi-branch Houses',
    price: null,
    features: [
      'bookings',
      'mpesa_payments',
      'private_store',
      'reviews',
      'packages_gift_cards',
      'team_permissions',
      'memberships',
      'marketing_campaigns',
      'marketplace_listing',
      'guest_import',
      'short_stay',
      'paid_content',
      'advanced_reports',
      'multi_location',
      'card_payments',
      'loyalty_points',
      'waitlist',
    ],
  },
];

interface TenantSpec {
  id: string;
  name: string;
  handle: string;
  kind: 'house' | 'atelier';
  vertical: Vertical;
  category: string;
  area: string;
  status: TenantStatus;
  plan: PlanId;
  source: 'self_signup' | 'invited';
  /** Days since joining; live date follows a few weeks later. */
  joinedDaysAgo: number;
  liveAfterDays: number | null;
  owner: string;
  staff: number;
  checklist: number;
  pay: [PayMethod, PayMode, ProviderState] | null;
  visibility: PlatformTenant['visibility'];
  baseline: number | null; // KES major units per month
  /** Typical bookings per day and average ticket (KES) once live. */
  perDay: number;
  ticket: number;
  demoStore?: boolean;
}

const TENANTS: TenantSpec[] = [
  {
    id: 't_serenity',
    name: 'Serenity Spa & Wellness',
    handle: 'serenity',
    kind: 'house',
    vertical: 'spa',
    category: 'Spa',
    area: 'Westlands, Nairobi',
    status: 'live',
    plan: 'signature',
    source: 'invited',
    joinedDaysAgo: 250,
    liveAfterDays: 18,
    owner: 'Amani Mwangi',
    staff: 6,
    checklist: 8,
    pay: ['paybill', 'daraja', 'verified'],
    visibility: 'private',
    baseline: 2_600_000,
    perDay: 14,
    ticket: 6_500,
    demoStore: true,
  },
  {
    id: 't_karibu',
    name: 'Karibu Garden Suites',
    handle: 'karibu',
    kind: 'house',
    vertical: 'short_stay',
    category: 'Short stays',
    area: 'Karen, Nairobi',
    status: 'setup',
    plan: 'business',
    source: 'invited',
    joinedDaysAgo: 20,
    liveAfterDays: null,
    owner: 'Amani Mwangi',
    staff: 3,
    checklist: 5,
    pay: ['till', 'daraja', 'testing'],
    visibility: 'private',
    baseline: 1_200_000,
    perDay: 0,
    ticket: 14_000,
    demoStore: true,
  },
  {
    id: 't_nyota',
    name: 'Nyota Day Spa',
    handle: 'nyota',
    kind: 'house',
    vertical: 'spa',
    category: 'Spa',
    area: 'Kilimani, Nairobi',
    status: 'live',
    plan: 'business',
    source: 'self_signup',
    joinedDaysAgo: 190,
    liveAfterDays: 9,
    owner: 'Grace Wambui',
    staff: 5,
    checklist: 8,
    pay: ['till', 'daraja', 'verified'],
    visibility: 'listed',
    baseline: 1_150_000,
    perDay: 10,
    ticket: 4_800,
  },
  {
    id: 't_kilele',
    name: 'Kilele Grooming Lounge',
    handle: 'kilele',
    kind: 'house',
    vertical: 'spa',
    category: 'Grooming',
    area: 'Westlands, Nairobi',
    status: 'live',
    plan: 'business',
    source: 'invited',
    joinedDaysAgo: 160,
    liveAfterDays: 12,
    owner: 'Brian Otieno',
    staff: 4,
    checklist: 8,
    pay: ['paybill', 'manual', 'verified'],
    visibility: 'listed',
    baseline: 690_000,
    perDay: 12,
    ticket: 2_200,
  },
  {
    id: 't_zuri',
    name: 'Zuri Skin Studio',
    handle: 'zuri',
    kind: 'house',
    vertical: 'spa',
    category: 'Skin',
    area: 'Lavington, Nairobi',
    status: 'past_due',
    plan: 'solo',
    source: 'self_signup',
    joinedDaysAgo: 130,
    liveAfterDays: 15,
    owner: 'Faith Njeri',
    staff: 1,
    checklist: 8,
    pay: ['till', 'daraja', 'failing'],
    visibility: 'listed_limited',
    baseline: 450_000,
    perDay: 4,
    ticket: 5_500,
  },
  {
    id: 't_pwani',
    name: 'Pwani Nail Bar',
    handle: 'pwani',
    kind: 'house',
    vertical: 'spa',
    category: 'Nails',
    area: 'Karen, Nairobi',
    status: 'live',
    plan: 'solo',
    source: 'self_signup',
    joinedDaysAgo: 100,
    liveAfterDays: 6,
    owner: 'Mercy Achieng',
    staff: 2,
    checklist: 8,
    pay: ['till', 'manual', 'verified'],
    visibility: 'listed',
    baseline: 420_000,
    perDay: 9,
    ticket: 1_800,
  },
  {
    id: 't_baraka',
    name: 'Baraka Garden Cottages',
    handle: 'baraka',
    kind: 'house',
    vertical: 'short_stay',
    category: 'Short stays',
    area: 'Naivasha',
    status: 'live',
    plan: 'signature',
    source: 'invited',
    joinedDaysAgo: 210,
    liveAfterDays: 25,
    owner: 'Peter Kamau',
    staff: 4,
    checklist: 8,
    pay: ['paybill', 'daraja', 'verified'],
    visibility: 'listed',
    baseline: 820_000,
    perDay: 2,
    ticket: 16_000,
  },
  {
    id: 't_wairimu',
    name: 'Massage by Wairimu',
    handle: 'wairimu',
    kind: 'atelier',
    vertical: 'spa',
    category: 'Massage therapist',
    area: 'Kileleshwa, Nairobi',
    status: 'live',
    plan: 'solo',
    source: 'self_signup',
    joinedDaysAgo: 75,
    liveAfterDays: 4,
    owner: 'Wairimu Kariuki',
    staff: 1,
    checklist: 8,
    pay: ['till', 'daraja', 'verified'],
    visibility: 'private',
    baseline: 300_000,
    perDay: 3,
    ticket: 4_000,
  },
  {
    id: 't_lulu',
    name: 'Lulu Hair Lounge',
    handle: 'lulu',
    kind: 'house',
    vertical: 'spa',
    category: 'Hair',
    area: 'South B, Nairobi',
    status: 'onboarding',
    plan: 'business',
    source: 'self_signup',
    joinedDaysAgo: 6,
    liveAfterDays: null,
    owner: 'Lucy Mutua',
    staff: 1,
    checklist: 2,
    pay: null,
    visibility: 'private',
    baseline: 400_000,
    perDay: 0,
    ticket: 2_500,
  },
  {
    id: 't_mawingu',
    name: 'Mawingu Retreat',
    handle: 'mawingu',
    kind: 'house',
    vertical: 'short_stay',
    category: 'Short stays',
    area: 'Nanyuki',
    status: 'verification',
    plan: 'signature',
    source: 'invited',
    joinedDaysAgo: 14,
    liveAfterDays: null,
    owner: 'Daniel Mutiso',
    staff: 2,
    checklist: 6,
    pay: ['paybill', 'daraja', 'testing'],
    visibility: 'private',
    baseline: 1_500_000,
    perDay: 0,
    ticket: 22_000,
  },
  {
    id: 't_jasiri',
    name: 'Jasiri Fitness & Spa',
    handle: 'jasiri',
    kind: 'house',
    vertical: 'spa',
    category: 'Fitness and spa',
    area: 'Kilimani, Nairobi',
    status: 'draft',
    plan: 'business',
    source: 'invited',
    joinedDaysAgo: 2,
    liveAfterDays: null,
    owner: 'Kevin Ochieng',
    staff: 0,
    checklist: 0,
    pay: null,
    visibility: 'private',
    baseline: null,
    perDay: 0,
    ticket: 3_000,
  },
  {
    id: 't_taji',
    name: 'Taji Wellness',
    handle: 'taji',
    kind: 'house',
    vertical: 'spa',
    category: 'Wellness',
    area: 'Mombasa Road, Nairobi',
    status: 'suspended',
    plan: 'solo',
    source: 'self_signup',
    joinedDaysAgo: 120,
    liveAfterDays: 20,
    owner: 'Hassan Ali',
    staff: 2,
    checklist: 8,
    pay: ['till', 'manual', 'disabled'],
    visibility: 'private',
    baseline: 170_000,
    perDay: 3,
    ticket: 2_000,
  },
];

const FAILURES = [
  'Guest cancelled the M-Pesa prompt',
  'Wrong PIN entered',
  'Insufficient M-Pesa balance',
  'Prompt timed out (no response)',
  'Daraja callback not received',
];

const PURPOSES: PlatformTransaction['purpose'][] = [
  'deposit',
  'full_payment',
  'full_payment',
  'balance',
  'package',
  'membership',
  'gift_card',
];

function guestCode(n: number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  let x = n * 7919 + 104729;
  for (let i = 0; i < 4; i++) {
    s += chars[x % chars.length];
    x = Math.floor(x / chars.length) + i * 31;
  }
  return `G-${s}`;
}

export function createPlatformSeed(): PlatformDb {
  const r = rng(20261110);
  const now = new Date();
  const today = dayKey(now, TZ);
  const at = (day: string, hh: number, mm: number) =>
    zonedToUtc(day, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, TZ);
  const daysAgo = (n: number) => addDaysKey(today, -n);

  const staff: PlatformStaff[] = [
    {
      id: 'ps_1',
      name: 'Felix Kariuki',
      email: 'felix@stayvinci.com',
      role: 'super_admin',
      twoFactor: true,
      status: 'active',
      lastActive: now.toISOString(),
    },
    {
      id: 'ps_2',
      name: 'Joy Wanjiru',
      email: 'joy@stayvinci.com',
      role: 'admin',
      twoFactor: true,
      status: 'active',
      lastActive: at(daysAgo(0), 9, 40),
    },
    {
      id: 'ps_3',
      name: 'Samuel Kiprop',
      email: 'samuel@stayvinci.com',
      role: 'finance',
      twoFactor: true,
      status: 'active',
      lastActive: at(daysAgo(1), 16, 5),
    },
    {
      id: 'ps_4',
      name: 'Aisha Mohamed',
      email: 'aisha@stayvinci.com',
      role: 'marketing',
      twoFactor: false,
      status: 'invited',
      lastActive: null,
    },
  ];

  const features: FeatureDef[] = FEATURES.map((f) => ({
    ...f,
    testers: [...f.testers],
    releasedAt: f.stage === 'general' ? at(daysAgo(260), 9, 0) : null,
  }));

  const tenants: PlatformTenant[] = TENANTS.map((s) => {
    const joined = daysAgo(s.joinedDaysAgo);
    const live = s.liveAfterDays !== null ? addDaysKey(joined, s.liveAfterDays) : null;
    const first = s.owner.split(' ')[0] ?? s.owner;
    return {
      id: s.id,
      name: s.name,
      handle: s.handle,
      kind: s.kind,
      vertical: s.vertical,
      category: s.category,
      area: s.area,
      status: s.status,
      plan: s.plan,
      interval: s.plan === 'signature' ? 'annual' : 'monthly',
      source: s.source,
      joinedAt: at(joined, 10, 15),
      liveAt: live ? at(live, 9, 0) : null,
      owner: {
        name: s.owner,
        phoneMasked: `+254 7•• ••• ${String(100 + Math.floor(r() * 899))}`,
        email: `${first.toLowerCase()}@${s.handle}.co.ke`,
      },
      staffCount: s.staff,
      checklist: { done: s.checklist, total: 8 },
      onboardingManager: s.source === 'invited' ? 'Joy Wanjiru' : null,
      payment: s.pay
        ? {
            method: s.pay[0],
            mode: s.pay[1],
            shortcodeMasked: `${s.pay[0] === 'paybill' ? 'Paybill' : 'Till'} ${String(
              1 + Math.floor(r() * 8),
            )}•••${String(10 + Math.floor(r() * 89))}`,
            state: s.pay[2],
            lastCallbackAt:
              s.pay[2] === 'verified' && s.pay[1] === 'daraja' ? at(today, 8, 30) : null,
          }
        : null,
      visibility: s.visibility,
      featured: s.id === 't_nyota' || s.id === 't_baraka',
      overrides: [],
      baselineMonthly: s.baseline !== null ? s.baseline * 100 : null,
      demoStore: s.demoStore === true,
      notes: [],
    };
  });

  // A couple of real-looking overrides.
  const nyota = tenants.find((t) => t.id === 't_nyota');
  if (nyota)
    nyota.overrides.push({
      feature: 'advanced_reports',
      on: true,
      reason: 'Pilot partner: trial of reports before upgrading',
      until: at(addDaysKey(today, 45), 23, 59),
      by: 'Felix Kariuki',
      at: at(daysAgo(10), 11, 0),
    });
  const lulu = tenants.find((t) => t.id === 't_lulu');
  if (lulu)
    lulu.notes.push({
      at: at(daysAgo(2), 14, 10),
      by: 'Joy Wanjiru',
      text: 'Owner asked for help adding services. Call booked for Thursday.',
    });

  /* Transactions for the last 90 days, plus monthly history for insights. */
  const transactions: PlatformTransaction[] = [];
  const months: TenantMonth[] = [];
  let guestSeq = 1;

  for (const s of TENANTS) {
    if (s.liveAfterDays === null || s.perDay === 0) continue;
    const liveDaysAgo = s.joinedDaysAgo - s.liveAfterDays;
    const stopDaysAgo = s.status === 'suspended' ? 25 : 0;
    const pay = s.pay ?? ['till', 'manual', 'verified'];
    const guestPool: string[] = [];
    const monthAgg = new Map<string, TenantMonth & { seen: Set<string> }>();

    for (let d = liveDaysAgo; d >= stopDaysAgo; d--) {
      const day = daysAgo(d);
      const age = liveDaysAgo - d; // days since going live
      // Growth: ramps up over the first ~4 months, then keeps a gentle climb.
      const growth = Math.min(1, 0.35 + age / 120) * (1 + Math.max(0, age - 120) / 600);
      const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
      const weekFactor = weekday === 5 || weekday === 6 ? 1.35 : weekday === 0 ? 1.1 : 0.9;
      const count = Math.round(s.perDay * growth * weekFactor * (0.75 + r() * 0.5));
      const month = day.slice(0, 7);
      let m = monthAgg.get(month);
      if (!m) {
        m = {
          tenantId: s.id,
          month,
          bookings: 0,
          revenue: 0,
          guests: 0,
          repeatGuests: 0,
          marketplaceGuests: 0,
          noShows: 0,
          seen: new Set(),
        };
        monthAgg.set(month, m);
      }
      for (let i = 0; i < count; i++) {
        // Returning guests become more common as the House matures.
        const repeatChance = Math.min(0.62, 0.15 + age / 400);
        let guest: string;
        let isNew = false;
        if (guestPool.length > 3 && r() < repeatChance) {
          guest = guestPool[Math.floor(r() * guestPool.length)] ?? guestCode(guestSeq++);
        } else {
          guest = guestCode(guestSeq++);
          guestPool.push(guest);
          isNew = true;
        }
        const marketplace =
          s.visibility !== 'private' && isNew && r() < (s.visibility === 'listed' ? 0.3 : 0.12);
        const amount = Math.round(s.ticket * (0.6 + r() * 0.9)) * 100;
        const roll = r();
        const status: TxnStatus =
          pay[2] === 'failing' && r() < 0.35
            ? 'failed'
            : roll < 0.86
              ? 'succeeded'
              : roll < 0.93
                ? 'failed'
                : roll < 0.96
                  ? 'expired'
                  : roll < 0.985
                    ? 'refunded'
                    : 'pending';
        m.bookings += 1;
        if (status === 'succeeded') m.revenue += amount;
        if (!m.seen.has(guest)) {
          m.seen.add(guest);
          m.guests += 1;
          if (!isNew) m.repeatGuests += 1;
          if (marketplace) m.marketplaceGuests += 1;
        }
        if (r() < 0.04) m.noShows += 1;

        if (d <= 90) {
          const flow: PlatformTransaction['flow'] =
            pay[1] === 'manual' ? 'manual' : r() < 0.8 ? 'stk_push' : 'c2b';
          const hh = 8 + Math.floor(r() * 12);
          transactions.push({
            id: `tx_${s.handle}_${d}_${i}`,
            tenantId: s.id,
            at: at(day, hh, Math.floor(r() * 60)),
            amount,
            currency: 'KES',
            method: pay[0],
            flow,
            status:
              d === 0 && status === 'pending'
                ? 'pending'
                : status === 'pending'
                  ? 'expired'
                  : status,
            failure:
              status === 'failed'
                ? (FAILURES[pay[2] === 'failing' ? 4 : Math.floor(r() * (FAILURES.length - 1))] ??
                  null)
                : status === 'expired'
                  ? 'Hold expired before payment'
                  : null,
            purpose: PURPOSES[Math.floor(r() * PURPOSES.length)] ?? 'full_payment',
            bookingRef: `${s.handle.slice(0, 3).toUpperCase()}-${String(1000 + transactions.length).slice(-4)}`,
            attribution: marketplace ? 'marketplace' : 'own_channel',
            guestRef: guest,
            newGuest: isNew,
            confirmSeconds:
              status === 'succeeded' && flow !== 'manual'
                ? Math.round(6 + r() * 30)
                : status === 'succeeded'
                  ? Math.round(300 + r() * 3000)
                  : null,
          });
        }
      }
    }
    for (const m of monthAgg.values()) {
      const { seen: _seen, ...row } = m;
      months.push(row);
    }
  }
  transactions.sort((a, b) => (a.at < b.at ? 1 : -1));

  const subscriptions: Subscription[] = tenants.map((t) => {
    const status: Subscription['status'] =
      t.status === 'draft'
        ? 'not_started'
        : t.status === 'past_due'
          ? 'past_due'
          : t.status === 'suspended'
            ? 'suspended'
            : t.status === 'onboarding' || t.status === 'verification' || t.status === 'setup'
              ? 'trial'
              : 'active';
    const invoices: Subscription['invoices'] = [];
    const joinedMonths = Math.floor(
      (now.getTime() - new Date(t.joinedAt).getTime()) / (30 * 86400000),
    );
    for (let i = Math.min(joinedMonths, 6); i >= 1; i--) {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() - i);
      const period = d.toISOString().slice(0, 7);
      const last = i === 1;
      invoices.push({
        number: `SV-KE-${period.replace('-', '')}-${t.handle.slice(0, 3).toUpperCase()}`,
        period,
        status:
          last && status === 'past_due'
            ? 'overdue'
            : status === 'suspended' && i <= 2
              ? 'overdue'
              : 'paid',
      });
    }
    return {
      tenantId: t.id,
      status,
      nextBillingAt:
        status === 'not_started' ? null : at(addDaysKey(today, 3 + (t.handle.length % 20)), 9, 0),
      coupon: t.id === 't_serenity' ? 'DESIGNPARTNER-3M' : null,
      invoices,
    };
  });

  const audit: PlatformAuditEntry[] = [
    {
      id: 'pa_1',
      at: at(daysAgo(0), 8, 2),
      actor: 'System',
      role: 'system',
      action: 'payment_connection.failing',
      tenantId: 't_zuri',
      detail: 'Daraja callbacks failing for 3 hours (Till 5•••41)',
    },
    {
      id: 'pa_2',
      at: at(daysAgo(1), 15, 30),
      actor: 'Joy Wanjiru',
      role: 'admin',
      action: 'store.edited_on_behalf',
      tenantId: 't_lulu',
      detail: 'Added 6 services and opening hours while assisting the owner',
    },
    {
      id: 'pa_3',
      at: at(daysAgo(2), 11, 12),
      actor: 'Felix Kariuki',
      role: 'super_admin',
      action: 'tenant.invited',
      tenantId: 't_jasiri',
      detail: 'Invite sent to Kevin Ochieng on Business plan',
    },
    {
      id: 'pa_4',
      at: at(daysAgo(6), 9, 45),
      actor: 'Lucy Mutua',
      role: 'house_owner',
      action: 'tenant.signed_up',
      tenantId: 't_lulu',
      detail: 'Self sign-up, Business plan, monthly',
    },
    {
      id: 'pa_5',
      at: at(daysAgo(10), 11, 0),
      actor: 'Felix Kariuki',
      role: 'super_admin',
      action: 'feature.override_set',
      tenantId: 't_nyota',
      detail: 'Advanced reports turned on for 45 days (pilot partner)',
    },
    {
      id: 'pa_6',
      at: at(daysAgo(14), 10, 20),
      actor: 'Felix Kariuki',
      role: 'super_admin',
      action: 'feature.stage_changed',
      tenantId: null,
      detail: 'Loyalty points moved from internal to beta (2 testers)',
    },
    {
      id: 'pa_7',
      at: at(daysAgo(25), 9, 0),
      actor: 'System',
      role: 'system',
      action: 'tenant.suspended',
      tenantId: 't_taji',
      detail: 'Unpaid 14 days after due date (dunning)',
    },
  ];

  const adAccounts: AdAccount[] = [
    {
      channel: 'meta',
      connected: true,
      accountName: 'Stayvinci Ads (Instagram + Facebook)',
      currency: 'KES',
    },
    { channel: 'google', connected: true, accountName: 'Stayvinci Search', currency: 'KES' },
    { channel: 'tiktok', connected: false, accountName: null, currency: 'KES' },
    { channel: 'x', connected: false, accountName: null, currency: 'KES' },
    { channel: 'linkedin', connected: false, accountName: null, currency: 'KES' },
  ];
  const camp = (
    id: string,
    name: string,
    channel: AdChannel,
    objective: AdObjective,
    market: MarketCode,
    audience: string,
    status: AdCampaign['status'],
    daily: number,
    days: number,
    ctr: number,
    cvr: number,
    creative: AdCampaign['creative'],
  ): AdCampaign => {
    const spend = status === 'draft' ? 0 : Math.round(daily * days * (0.85 + r() * 0.15)) * 100;
    const cpm = channel === 'google' ? 38000 : channel === 'linkedin' ? 90000 : 18000; // minor units per 1000
    const impressions = spend ? Math.round((spend / cpm) * 1000) : 0;
    const clicks = Math.round(impressions * ctr);
    const leads = Math.round(clicks * cvr);
    return {
      id,
      name,
      channel,
      objective,
      market,
      audience,
      status,
      dailyBudget: daily * 100,
      currency: 'KES',
      startAt: at(daysAgo(days), 6, 0),
      endAt: status === 'ended' ? at(daysAgo(2), 23, 0) : null,
      spend,
      impressions,
      clicks,
      leads,
      conversions: Math.round(leads * (objective === 'house_signups' ? 0.22 : 0.5)),
      creative,
    };
  };
  const campaigns: AdCampaign[] = [
    camp(
      'ad_1',
      'Nairobi spas: run your House quietly',
      'meta',
      'house_signups',
      'KE',
      'Spa, salon and wellness owners · Nairobi, 25–55',
      'active',
      3500,
      28,
      0.016,
      0.03,
      {
        headline: 'Your spa, run beautifully.',
        body: 'Private store, M-Pesa straight to your Till, and clients that stay yours.',
        image: '/demo/stones.jpg',
        cta: 'Start free setup',
      },
    ),
    camp(
      'ad_2',
      'Search: spa booking software Kenya',
      'google',
      'house_signups',
      'KE',
      'Searches: “spa booking app”, “salon software Kenya”',
      'active',
      2500,
      40,
      0.052,
      0.035,
      {
        headline: 'Spa booking with M-Pesa | Stayvinci',
        body: 'Bookings, deposits and a private store for your clients. Set up in a day.',
        image: '/demo/candles.jpg',
        cta: 'Get started',
      },
    ),
    camp(
      'ad_3',
      'Guests: your private places in one app',
      'meta',
      'guest_installs',
      'KE',
      'Women and men 22–45 · Nairobi · interests: wellness, beauty',
      'active',
      2000,
      21,
      0.021,
      0.12,
      {
        headline: 'Quiet places, one quiet app.',
        body: 'Enter your spa’s private code and book in seconds.',
        image: '/demo/massage.jpg',
        cta: 'Get the app',
      },
    ),
    camp(
      'ad_4',
      'Mombasa & Diani short stays',
      'meta',
      'house_signups',
      'KE',
      'Short-stay hosts · Coast region',
      'paused',
      1500,
      14,
      0.012,
      0.025,
      {
        headline: 'Fill your suites without the commission.',
        body: 'Your own booking page, deposits by M-Pesa, guest registration done for you.',
        image: '/demo/pool.jpg',
        cta: 'List your stay',
      },
    ),
    camp(
      'ad_5',
      'Dubai pilot: premium spas (test)',
      'meta',
      'house_signups',
      'AE',
      'Spa owners and managers · Dubai · luxury interests',
      'draft',
      6000,
      0,
      0.014,
      0.07,
      {
        headline: 'Private by invitation.',
        body: 'A discreet booking store for premium spas. Ladies-only spaces supported.',
        image: '/demo/hotstone.jpg',
        cta: 'Request a demo',
      },
    ),
    camp(
      'ad_6',
      'Launch week awareness',
      'google',
      'awareness',
      'KE',
      'Display · lifestyle sites · Nairobi',
      'ended',
      1800,
      7,
      0.006,
      0.02,
      {
        headline: 'Meet Stayvinci',
        body: 'Booking, beautifully private.',
        image: '/demo/facial.jpg',
        cta: 'Learn more',
      },
    ),
  ];

  return {
    adAccounts,
    campaigns,
    staff,
    plans: PLANS.map((p) => ({ ...p, features: [...p.features] })),
    features,
    tenants,
    transactions,
    months: months.sort((a, b) => (a.month < b.month ? -1 : 1)),
    subscriptions,
    audit,
  };
}

/**
 * What a House actually gets, and why. Order of rules:
 * 1. A per-House override always wins.
 * 2. Core features are on for everyone.
 * 3. Internal and beta features are on only for their testers.
 * 4. Generally released features follow the plan.
 */
export function effectiveFeatures(db: PlatformDb, tenant: PlatformTenant) {
  const plan = db.plans.find((p) => p.id === tenant.plan);
  return db.features.map((f) => {
    const override = tenant.overrides.find((o) => o.feature === f.key);
    const inPlan = plan?.features.includes(f.key) ?? false;
    let on: boolean;
    let why: string;
    if (override) {
      on = override.on;
      why = `${override.on ? 'Turned on' : 'Turned off'} by ${override.by}: ${override.reason}`;
    } else if (f.core) {
      on = true;
      why = 'Core feature, on for every House';
    } else if (f.stage !== 'general') {
      on = f.testers.includes(tenant.id);
      why = on
        ? `${f.stage === 'beta' ? 'Beta' : 'Internal'} tester`
        : `Not released yet (${f.stage})`;
    } else {
      on = inPlan;
      why = inPlan ? `Included in ${plan?.name ?? 'plan'}` : `Not in ${plan?.name ?? 'plan'}`;
    }
    return { feature: f, on, why, inPlan, override: override ?? null };
  });
}
