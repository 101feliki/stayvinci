// Typed mirror of migrations/*.sql for Drizzle queries. The SQL files are the source of
// truth (constraints, row-level security, triggers); keep this file in step with them.
import {
  bigint,
  boolean,
  char,
  customType,
  inet,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });
const citext = customType<{ data: string }>({ dataType: () => 'citext' });
/** Postgres tstzrange as its text form, e.g. ["2026-11-10 09:00+00","2026-11-10 10:00+00"). */
const tstzrange = customType<{ data: string }>({ dataType: () => 'tstzrange' });

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });
const money = (name: string) => bigint(name, { mode: 'number' });

/* ---------- Platform configuration ---------- */

export const market = pgTable('market', {
  code: char('code', { length: 2 }).primaryKey(),
  name: text('name').notNull(),
  currency: char('currency', { length: 3 }).notNull(),
  timezone: text('timezone').notNull(),
  defaultLocale: text('default_locale').notNull(),
  holdMinutes: smallint('hold_minutes').notNull(),
  taxRules: jsonb('tax_rules').notNull(),
  compliance: jsonb('compliance').notNull(),
  enabledProviders: text('enabled_providers').array().notNull(),
  active: boolean('active').notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
});

export const plan = pgTable('plan', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  tenantKinds: text('tenant_kinds').array().notNull(),
  features: text('features').array().notNull(),
  limits: jsonb('limits').notNull(),
  active: boolean('active').notNull(),
});

/* ---------- Identity ---------- */

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneE164: text('phone_e164'),
  email: citext('email'),
  fullName: text('full_name'),
  emailVerifiedAt: ts('email_verified_at'),
  passwordHash: text('password_hash'),
  totpSecretEnc: bytea('totp_secret_enc'),
  totpEnabledAt: ts('totp_enabled_at'),
  platformRole: text('platform_role').$type<'super_admin' | 'admin' | 'finance' | 'marketing'>(),
  status: text('status').$type<'active' | 'locked' | 'deleted'>().notNull().default('active'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  refreshHash: bytea('refresh_hash').notNull(),
  audience: text('audience').$type<'guest' | 'business' | 'console'>().notNull(),
  secondFactorAt: ts('second_factor_at'),
  userAgent: text('user_agent'),
  ip: inet('ip'),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastUsedAt: ts('last_used_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
  revokedAt: ts('revoked_at'),
});

export const otpChallenge = pgTable('otp_challenge', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneE164: text('phone_e164').notNull(),
  codeHmac: bytea('code_hmac').notNull(),
  purpose: text('purpose').$type<'sign_in' | 'verify_phone'>().notNull(),
  attempts: smallint('attempts').notNull().default(0),
  createdAt: ts('created_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
  consumedAt: ts('consumed_at'),
});

export const emailToken = pgTable('email_token', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  purpose: text('purpose').$type<'verify_email' | 'magic_link' | 'password_reset'>().notNull(),
  tokenHash: bytea('token_hash').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
  consumedAt: ts('consumed_at'),
});

/* ---------- Tenancy ---------- */

export type TenantStatus =
  | 'onboarding_unpaid'
  | 'onboarding'
  | 'pending_verification'
  | 'ready'
  | 'live'
  | 'past_due'
  | 'suspended'
  | 'closed';

export const tenant = pgTable('tenant', {
  id: uuid('id').primaryKey().defaultRandom(),
  handle: citext('handle').notNull(),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  kind: text('kind').$type<'house' | 'atelier'>().notNull(),
  vertical: text('vertical').$type<'spa' | 'short_stay' | 'atelier'>().notNull(),
  marketCode: char('market_code', { length: 2 }).notNull(),
  timezone: text('timezone').notNull(),
  currency: char('currency', { length: 3 }).notNull(),
  status: text('status').$type<TenantStatus>().notNull().default('onboarding'),
  visibility: text('visibility')
    .$type<'private' | 'listed' | 'listed_limited'>()
    .notNull()
    .default('private'),
  planCode: text('plan_code').notNull(),
  source: text('source').$type<'self_signup' | 'invited'>().notNull().default('self_signup'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export type TenantRole =
  'owner' | 'manager' | 'front_desk' | 'practitioner' | 'content_editor' | 'accountant';

export const membership = pgTable('membership', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id').notNull(),
  role: text('role').$type<TenantRole>().notNull(),
  capsAdded: text('caps_added').array().notNull().default([]),
  capsRemoved: text('caps_removed').array().notNull().default([]),
  status: text('status').$type<'invited' | 'active' | 'suspended'>().notNull().default('invited'),
  invitedBy: uuid('invited_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

/* ---------- Audit, outbox, idempotency ---------- */

export const auditLog = pgTable('audit_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid('tenant_id'),
  actorUserId: uuid('actor_user_id'),
  actorLabel: text('actor_label').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  ip: inet('ip'),
  requestId: text('request_id'),
  occurredAt: ts('occurred_at').notNull().defaultNow(),
});

export const outboxEvent = pgTable('outbox_event', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid('tenant_id'),
  type: text('type').notNull(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  publishedAt: ts('published_at'),
  attempts: smallint('attempts').notNull().default(0),
  nextAttemptAt: ts('next_attempt_at').notNull().defaultNow(),
  lastError: text('last_error'),
});

export const idempotencyKey = pgTable('idempotency_key', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  tenantId: uuid('tenant_id'),
  key: text('key').notNull(),
  method: text('method').notNull(),
  path: text('path').notNull(),
  requestHash: bytea('request_hash').notNull(),
  status: text('status').$type<'in_progress' | 'completed'>().notNull().default('in_progress'),
  responseCode: smallint('response_code'),
  responseBody: jsonb('response_body'),
  createdAt: ts('created_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
});

/* ---------- Catalogue and bookings ---------- */

export type Visibility = 'public' | 'members_only' | 'invite_only' | 'hidden';

export const location = pgTable('location', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  address: jsonb('address').notNull(),
  timezone: text('timezone').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const resource = pgTable('resource', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  locationId: uuid('location_id'),
  type: text('type').$type<'staff' | 'room' | 'equipment' | 'unit' | 'self'>().notNull(),
  name: text('name').notNull(),
  capacity: smallint('capacity').notNull().default(1),
  membershipId: uuid('membership_id'),
  active: boolean('active').notNull().default(true),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const category = pgTable('category', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  position: smallint('position').notNull().default(0),
  visibility: text('visibility').$type<Visibility>().notNull().default('public'),
  imageUrl: text('image_url'),
});

export const service = pgTable('service', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  categoryId: uuid('category_id'),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  visibility: text('visibility').$type<Visibility>().notNull().default('public'),
  imageUrl: text('image_url'),
  icon: text('icon'),
  bufferBeforeMin: smallint('buffer_before_min').notNull().default(0),
  bufferAfterMin: smallint('buffer_after_min').notNull().default(0),
  requires: text('requires').array().notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const serviceVariant = pgTable('service_variant', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  serviceId: uuid('service_id').notNull(),
  name: text('name').notNull(),
  durationMin: smallint('duration_min').notNull(),
  priceMinor: money('price_minor').notNull(),
  currency: char('currency', { length: 3 }).notNull(),
  position: smallint('position').notNull().default(0),
});

export const guestProfile = pgTable('guest_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id').notNull(),
  alias: text('alias'),
  notes: text('notes'),
  tags: text('tags').array().notNull().default([]),
  marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
  firstTouchSource: text('first_touch_source').$type<'own_channel' | 'marketplace'>().notNull(),
  firstTouchDetail: text('first_touch_detail'),
  firstTouchAt: ts('first_touch_at').notNull().defaultNow(),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

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

export const booking = pgTable('booking', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  ref: text('ref').notNull(),
  guestProfileId: uuid('guest_profile_id').notNull(),
  locationId: uuid('location_id'),
  state: text('state').$type<BookingState>().notNull(),
  startsAt: ts('starts_at').notNull(),
  endsAt: ts('ends_at').notNull(),
  holdExpiresAt: ts('hold_expires_at'),
  totalMinor: money('total_minor').notNull(),
  depositMinor: money('deposit_minor').notNull().default(0),
  paidMinor: money('paid_minor').notNull().default(0),
  currency: char('currency', { length: 3 }).notNull(),
  source: text('source').$type<'guest_app' | 'staff' | 'marketplace'>().notNull(),
  notes: text('notes'),
  idempotencyKey: text('idempotency_key'),
  version: integer('version').notNull().default(1),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const bookingItem = pgTable('booking_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  bookingId: uuid('booking_id').notNull(),
  serviceVariantId: uuid('service_variant_id').notNull(),
  priceMinor: money('price_minor').notNull(),
  guests: smallint('guests').notNull().default(1),
});

export const resourceAllocation = pgTable('resource_allocation', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  resourceId: uuid('resource_id').notNull(),
  bookingId: uuid('booking_id'),
  blockReason: text('block_reason'),
  during: tstzrange('during').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: ts('created_at').notNull().defaultNow(),
});

/* ---------- Payments ---------- */

export const paymentConnection = pgTable('payment_connection', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  provider: text('provider').$type<'mpesa' | 'card' | 'paypal'>().notNull(),
  method: text('method').$type<'paybill' | 'till' | 'card' | 'paypal'>(),
  mode: text('mode').$type<'daraja' | 'manual' | 'api'>().notNull().default('daraja'),
  shortcodeMasked: text('shortcode_masked'),
  state: text('state')
    .$type<'draft' | 'testing' | 'verified' | 'disabled' | 'failing'>()
    .notNull()
    .default('draft'),
  position: smallint('position').notNull().default(1),
  lastCallbackAt: ts('last_callback_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const paymentIntent = pgTable('payment_intent', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  bookingId: uuid('booking_id'),
  connectionId: uuid('connection_id').notNull(),
  purpose: text('purpose').notNull(),
  amountMinor: money('amount_minor').notNull(),
  currency: char('currency', { length: 3 }).notNull(),
  status: text('status')
    .$type<'pending' | 'succeeded' | 'failed' | 'expired' | 'cancelled'>()
    .notNull()
    .default('pending'),
  providerRef: text('provider_ref'),
  failureCode: text('failure_code'),
  idempotencyKey: text('idempotency_key').notNull(),
  expiresAt: ts('expires_at').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});
