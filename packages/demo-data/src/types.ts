// Domain types for the business app. Names and enums follow docs/SPEC.md.
// Money is integer minor units + currency code; times are UTC ISO strings.

export type Vertical = 'spa' | 'short_stay';
export type TenantStatus =
  'draft' | 'onboarding' | 'verification' | 'setup' | 'live' | 'past_due' | 'suspended';
export type VisibilityMode = 'private' | 'listed' | 'listed_limited';
export type ItemVisibility = 'public' | 'members_only' | 'invite_only' | 'hidden';

export interface Money {
  amount: number; // minor units
  currency: string;
}

export interface Tenant {
  id: string;
  name: string;
  handle: string;
  vertical: Vertical;
  kind: 'house' | 'atelier';
  status: TenantStatus;
  visibility: VisibilityMode;
  timezone: string;
  currency: string;
  area: string;
  tagline: string;
  description: string;
  accent: string;
  verification: 'approved' | 'pending' | 'not_started';
}

/* ---------- Roles and capabilities (spec §1) ---------- */

export type TenantRole =
  'owner' | 'manager' | 'front_desk' | 'practitioner' | 'content_editor' | 'accountant';

export type Capability =
  | 'booking.view'
  | 'booking.create'
  | 'booking.edit'
  | 'booking.approve'
  | 'guest.view'
  | 'guest.contact.view'
  | 'guest.import'
  | 'guest.export'
  | 'message.reply'
  | 'catalogue.edit'
  | 'staff.manage'
  | 'storefront.edit'
  | 'content.edit'
  | 'access.manage'
  | 'policy.edit'
  | 'payment_account.manage'
  | 'payment.view'
  | 'payment.refund'
  | 'report.view'
  | 'report.financial.view'
  | 'marketing.manage'
  | 'review.reply'
  | 'compliance.view'
  | 'billing.manage'
  | 'settings.manage'
  | 'audit.view';

export interface TeamMember {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: TenantRole;
  added: Capability[];
  removed: Capability[];
  status: 'active' | 'invited';
  twoFactor: boolean;
  lastActive: string | null;
  staffId: string | null;
}

/* ---------- Locations and resources (spec §5.3) ---------- */

export interface Location {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  area: string;
  hours: { day: string; open: string; close: string; closed: boolean }[];
  arrivalInstructions: string;
}

export type ResourceType = 'staff' | 'room' | 'equipment' | 'unit';

export interface Resource {
  id: string;
  tenantId: string;
  type: ResourceType;
  name: string;
  locationId: string;
  capacity: number;
  visible: boolean;
  // staff
  title?: string;
  specialties?: string[];
  languages?: string[];
  guestsCanChoose?: boolean;
  schedule?: { day: string; start: string; end: string; off: boolean }[];
  colour?: string;
  // unit
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  maxGuests?: number;
  amenities?: string[];
  traLicence?: string;
}

/* ---------- Catalogue (spec §5.4) ---------- */

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  order: number;
  visibility: ItemVisibility;
  /** Optional photo for editorial category tiles on the store landing. */
  image?: string | null;
}

export interface Variant {
  id: string;
  name: string;
  durationMin: number;
  price: number; // minor units
}

export interface Service {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description: string;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  requires: ResourceType[];
  variants: Variant[];
  visibility: ItemVisibility;
  staffIds: string[];
  taxClass: 'standard' | 'exempt';
  /** Photo shown on the service card (uploaded by the House). */
  image: string | null;
  /** Or an icon from the Stayvinci icon set, when there's no photo. */
  icon: string | null;
}

export interface RatePlan {
  id: string;
  tenantId: string;
  unitId: string;
  name: string;
  nightly: number;
  weekend: number;
  minNights: number;
  maxNights: number;
  cleaningFee: number;
  extraGuestFee: number;
  damageDeposit: number;
  visibility: ItemVisibility;
}

export interface AddOn {
  id: string;
  tenantId: string;
  name: string;
  price: number;
  durationMin: number;
  appliesTo: string;
  visibility: ItemVisibility;
}

export interface PackageOffer {
  id: string;
  tenantId: string;
  name: string;
  credits: number;
  price: number;
  validityDays: number;
  transferable: boolean;
  sold: number;
  visibility: ItemVisibility;
}

export interface MembershipTier {
  id: string;
  tenantId: string;
  name: string;
  monthly: number;
  creditsPerMonth: number;
  discountPct: number;
  members: number;
  perks: string[];
  visibility: ItemVisibility;
}

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  lowStockAt: number;
  visibility: ItemVisibility;
}

export interface GiftCardType {
  id: string;
  tenantId: string;
  name: string;
  value: number | null; // null = custom value
  validityDays: number;
  sold: number;
  visibility: ItemVisibility;
}

export interface ContentItem {
  id: string;
  tenantId: string;
  title: string;
  kind: 'video' | 'gallery' | 'live';
  durationSec: number | null;
  items: number;
  price: number | null;
  tierIds: string[];
  views: number;
  moderation: 'approved' | 'pending' | 'rejected';
  visibility: ItemVisibility;
  createdAt: string;
  /** Live session details, when kind is 'live'. */
  live: LiveSession | null;
}

/** A live stream run by a House or an Atelier: a class, a demo or a Q&A. */
export interface LiveSession {
  startsAt: string;
  durationMin: number;
  host: string;
  capacity: number | null;
  status: 'scheduled' | 'live' | 'ended';
  attending: number;
  /** Keep a replay for guests who missed it. */
  replay: boolean;
}

/* ---------- Guests (tenant-scoped profile, spec §1, §8) ---------- */

export type AttributionSource = 'own_channel' | 'marketplace';

export interface Guest {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  alias: string | null;
  /** Omitted by the API unless the caller has guest.contact.view. */
  phone?: string;
  /** Omitted by the API unless the caller has guest.contact.view. */
  email?: string;
  attribution: AttributionSource;
  attributionDetail: string;
  admittedAt: string;
  visits: number;
  spend: number;
  lastVisit: string | null;
  notes: string;
  preferences: string[];
  tags: string[];
  membershipTierId: string | null;
  packageCredits: number;
  imported: boolean;
}

/* ---------- Bookings (spec §10) ---------- */

export type BookingState =
  | 'held'
  | 'pending_payment'
  | 'requested'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled_by_guest'
  | 'cancelled_by_tenant'
  | 'no_show'
  | 'disputed';

export interface BookingEvent {
  at: string;
  label: string;
  actor: string;
}

export interface Booking {
  id: string;
  ref: string;
  tenantId: string;
  guestId: string;
  serviceId: string | null;
  variantId: string | null;
  staffId: string | null;
  roomId: string | null;
  unitId: string | null;
  start: string;
  end: string;
  guests: number;
  state: BookingState;
  total: number;
  paid: number;
  deposit: number;
  attribution: AttributionSource;
  channel: 'store' | 'front_desk' | 'phone';
  notes: string;
  createdAt: string;
  requestExpiresAt: string | null;
  events: BookingEvent[];
}

/** Manual or imported block on a resource (staff break, maintenance, iCal import, owner stay). */
export interface CalendarBlock {
  id: string;
  tenantId: string;
  resourceId: string;
  start: string;
  end: string;
  reason: string;
  source: 'manual' | 'ical';
}

/* ---------- Payments (spec §3) ---------- */

export type ProviderKind = 'mpesa' | 'card' | 'paypal';
export type ProviderState = 'draft' | 'testing' | 'verified' | 'disabled' | 'failing';

export interface ProviderConnection {
  id: string;
  tenantId: string;
  kind: ProviderKind;
  label: string;
  state: ProviderState;
  masked: string;
  detail: string;
  order: number;
  lastCallbackAt: string | null;
}

export type PaymentStatus =
  'pending' | 'succeeded' | 'failed' | 'expired' | 'cancelled' | 'refunded' | 'partially_refunded';

export interface Payment {
  id: string;
  tenantId: string;
  bookingId: string | null;
  guestId: string | null;
  provider: ProviderKind | 'cash';
  purpose: 'deposit' | 'balance' | 'package' | 'membership' | 'content' | 'product';
  amount: number;
  refunded: number;
  status: PaymentStatus;
  providerRef: string;
  at: string;
  reconciled: boolean;
}

export interface UnmatchedPayment {
  id: string;
  tenantId: string;
  amount: number;
  providerRef: string;
  payerHint: string;
  at: string;
}

/* ---------- Access (spec §6) ---------- */

export interface AccessCode {
  id: string;
  tenantId: string;
  code: string;
  kind: 'primary' | 'campaign' | 'personal';
  label: string;
  scope: 'store' | 'invite_items';
  expiresAt: string | null;
  usageLimit: number | null;
  uses: number;
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
}

/* ---------- Policies (spec §5.6) ---------- */

export interface Policies {
  paymentAtBooking: 'none' | 'fixed_deposit' | 'percent_deposit' | 'full';
  depositValue: number;
  balance: 'at_venue' | 'auto_request' | 'in_app_after';
  freeCancelHours: number;
  lateCancel: 'deposit_kept' | 'percent_fee' | 'full_charge';
  lateCancelPct: number;
  noShow: 'deposit_forfeited' | 'fee_request';
  leadTimeHours: number;
  horizonDays: number;
  whoCanBook: 'anyone' | 'returning' | 'members' | 'invite';
  approval: 'instant' | 'request';
  approvalWindowHours: number;
  maxPerGuestPerDay: number;
  maxPartySize: number;
}

/* ---------- Messages ---------- */

export interface Conversation {
  id: string;
  tenantId: string;
  guestId: string;
  assignedTo: string | null;
  unread: number;
  messages: { id: string; from: 'guest' | 'staff'; author: string; body: string; at: string }[];
}

/* ---------- Storefront (spec §5.2, §5.8) ---------- */

export type SectionKind =
  | 'hero'
  | 'featured'
  | 'menu'
  | 'team'
  | 'gallery'
  | 'video'
  | 'memberships'
  | 'reviews'
  | 'policies'
  | 'location'
  | 'faq';

/** A full colour set for a store. Generated or picked; always contrast-checked (spec §5.2). */
export interface StorePalette {
  id: string;
  name: string;
  /** Main brand surface (hero, header, member cards). */
  bg: string;
  /** Text on bg. */
  fg: string;
  /** Muted text on bg. */
  muted: string;
  /** Highlight: buttons, labels, rings. */
  accent: string;
  /** Text on accent. */
  onAccent: string;
  /** Light page tint behind content. */
  soft: string;
}

/** How one storefront section is painted. */
export interface SectionStyle {
  background: 'default' | 'soft' | 'brand' | 'accent' | 'texture' | 'photo';
  /** Texture id from the design catalogue, when background is 'texture'. */
  texture: string | null;
  /** Uploaded photo (data URL in the prototype; a media URL in production), when 'photo'. */
  photo: string | null;
  /** Darkening over photos and textures so text stays readable, 0–80 (%). */
  overlay: number;
}

export type MarqueeKind = 'offer' | 'service' | 'message' | 'season';

export interface MarqueeItem {
  id: string;
  kind: MarqueeKind;
  text: string;
  /** For 'service': the service it promotes (guests can tap through). */
  serviceId: string | null;
  enabled: boolean;
}

/** The moving announcement strip at the top of the store. */
export interface StoreMarquee {
  enabled: boolean;
  speed: 'slow' | 'normal' | 'fast';
  /** Strip colours: the store accent, the brand colour, or the active season's colours. */
  style: 'accent' | 'brand' | 'season';
  items: MarqueeItem[];
}

export type SeasonId =
  | 'new_year'
  | 'valentines'
  | 'easter'
  | 'eid'
  | 'mothers_day'
  | 'madaraka'
  | 'mashujaa'
  | 'halloween'
  | 'jamhuri'
  | 'christmas';

export interface StoreSeason {
  /** Chosen seasonal theme; null for none. */
  id: SeasonId | null;
  /** Follow the calendar automatically (each theme shows in its own dates). */
  auto: boolean;
  /** Also tint the store's accent with the season's colours. */
  recolor: boolean;
}

/** Editorial cover at the top of the store landing page. */
export interface StoreCover {
  image: string | null;
  headline: string;
  subline: string;
  /** full: image fills the screen; split: image beside the text; color: brand colour only. */
  layout: 'full' | 'split' | 'color';
  ctaLabel: string;
}

export type SocialNetwork = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'whatsapp';

export interface SocialAccount {
  network: SocialNetwork;
  handle: string;
  connected: boolean;
  connectedAt: string | null;
  followers: number | null;
  /** Show the icon and link on the store. */
  showOnStore: boolean;
  /** Instagram/Facebook "Book" action button pointing at the store. */
  bookButton: boolean;
}

export interface Storefront {
  tenantId: string;
  theme: 'emerald' | 'noir' | 'ivory' | 'plum';
  accent: string;
  displayName: string;
  tagline: string;
  showContacts: boolean;
  sections: { kind: SectionKind; enabled: boolean }[];
  hasDraft: boolean;
  versions: { id: string; label: string; at: string; by: string; live: boolean }[];
  /** Square logo (data URL in the prototype). Shown in the store header, hero and business app. */
  logo: string | null;
  /** Custom colour mix; when null the curated theme + accent are used. */
  palette: StorePalette | null;
  sectionStyles: Partial<Record<SectionKind, SectionStyle>>;
  marquee: StoreMarquee;
  season: StoreSeason;
  cover: StoreCover;
  socials: SocialAccount[];
}

/* ---------- Marketing ---------- */

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  segment: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'push';
  status: 'draft' | 'scheduled' | 'sent';
  audience: number;
  sentAt: string | null;
  bookings: number;
}

export interface Review {
  id: string;
  tenantId: string;
  guestId: string;
  rating: number;
  body: string;
  at: string;
  reply: string | null;
  serviceName: string;
}

/* ---------- Billing (spec §12) ---------- */

export interface Invoice {
  id: string;
  tenantId: string;
  number: string;
  period: string;
  subscription: number;
  fees: number;
  credits: number;
  status: 'paid' | 'open' | 'overdue';
  issuedAt: string;
}

export interface FeeLine {
  id: string;
  tenantId: string;
  guestId: string;
  bookingId: string;
  bookingValue: number;
  fee: number;
  status: 'raised' | 'pending' | 'voided' | 'disputed';
  explanation: string;
  at: string;
}

/* ---------- Compliance (short-stay, spec §10.6, §21) ---------- */

export interface GuestRegistration {
  id: string;
  tenantId: string;
  bookingId: string;
  fullName: string;
  nationality: string;
  idMasked: string;
  at: string;
}

export interface LevyReport {
  id: string;
  tenantId: string;
  period: string;
  nights: number;
  taxable: number;
  status: 'filed' | 'draft';
}

/* ---------- Audit log ---------- */

export interface AuditEntry {
  id: string;
  tenantId: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
}

export interface Alert {
  id: string;
  tone: 'amber' | 'red' | 'azure';
  title: string;
  body: string;
  to: string;
}
