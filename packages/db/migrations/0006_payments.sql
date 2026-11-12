-- 0006 Payments (spec §3, CLAUDE.md rules 2 and 4).
-- Guest money goes to each tenant's own Paybill or Till; Stayvinci stores records only.
-- Credentials live in their own table that ONLY the payments role can read.

create table payment_connection (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  provider        text not null check (provider in ('mpesa', 'card', 'paypal')),
  method          text check (method in ('paybill', 'till', 'card', 'paypal')),
  mode            text not null default 'daraja' check (mode in ('daraja', 'manual', 'api')),
  shortcode_masked text,                              -- e.g. "Till 5***41"; the full value is a credential
  state           text not null default 'draft' check (state in ('draft', 'testing', 'verified', 'disabled', 'failing')),
  position        smallint not null default 1,
  last_callback_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, id)
);
create index payment_connection_tenant on payment_connection (tenant_id, position);
create trigger payment_connection_updated before update on payment_connection
  for each row execute function set_updated_at();

-- Envelope encryption: ciphertext under a per-tenant data key, which is itself wrapped by
-- a KMS master key. Never selectable by sv_app or sv_platform.
create table payment_credential (
  connection_id   uuid primary key,
  tenant_id       uuid not null,
  ciphertext      bytea not null,
  iv              bytea not null,
  auth_tag        bytea not null,
  wrapped_dek     bytea not null,
  kek_id          text not null,
  rotated_at      timestamptz not null default now(),
  foreign key (tenant_id, connection_id) references payment_connection(tenant_id, id) on delete cascade
);

create table payment_intent (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  booking_id      uuid,
  connection_id   uuid not null,
  purpose         text not null check (purpose in
                    ('deposit', 'balance', 'full_payment', 'package', 'membership', 'content', 'product', 'damage_deposit', 'gift_card')),
  amount_minor    bigint not null check (amount_minor > 0),
  currency        char(3) not null,
  status          text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'expired', 'cancelled')),
  provider_ref    text,
  failure_code    text,
  idempotency_key text not null,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, booking_id) references booking(tenant_id, id),
  foreign key (tenant_id, connection_id) references payment_connection(tenant_id, id)
);
create index payment_intent_booking on payment_intent (tenant_id, booking_id);
-- Reconciliation job: pending intents past their timeout.
create index payment_intent_pending on payment_intent (expires_at) where status = 'pending';
create unique index payment_intent_provider_ref on payment_intent (connection_id, provider_ref) where provider_ref is not null;
create trigger payment_intent_updated before update on payment_intent for each row execute function set_updated_at();

-- Every provider callback is stored raw BEFORE processing (rule 4). The tenant is unknown
-- until the connection is matched, so only payments and platform roles touch this table.
create table provider_callback (
  id              bigint generated always as identity primary key,
  provider        text not null,
  connection_id   uuid,
  tenant_id       uuid references tenant(id),
  headers         jsonb not null,
  body            text not null,
  signature_ok    boolean,
  received_at     timestamptz not null default now(),
  processed_at    timestamptz,
  error           text
);
create index provider_callback_unprocessed on provider_callback (received_at) where processed_at is null;

alter table payment_connection enable row level security;
alter table payment_connection force row level security;
create policy tenant_isolation on payment_connection
  using (tenant_id = app_current_tenant() or app_is_platform() or current_user = 'sv_payments')
  with check (tenant_id = app_current_tenant() or current_user = 'sv_payments');
grant select on payment_connection to sv_app, sv_platform;
grant select, insert, update on payment_connection to sv_payments;

alter table payment_credential enable row level security;
alter table payment_credential force row level security;
create policy payments_only on payment_credential
  using (current_user = 'sv_payments') with check (current_user = 'sv_payments');
revoke all on payment_credential from public;
grant select, insert, update, delete on payment_credential to sv_payments;

alter table payment_intent enable row level security;
alter table payment_intent force row level security;
create policy tenant_isolation on payment_intent
  using (tenant_id = app_current_tenant() or app_is_platform() or current_user = 'sv_payments')
  with check (tenant_id = app_current_tenant() or current_user = 'sv_payments');
grant select on payment_intent to sv_app, sv_platform;
grant select, insert, update on payment_intent to sv_payments;

alter table provider_callback enable row level security;
alter table provider_callback force row level security;
create policy payments_and_platform on provider_callback
  using (current_user in ('sv_payments', 'sv_platform'))
  with check (current_user = 'sv_payments');
grant select, insert, update on provider_callback to sv_payments;
grant select on provider_callback to sv_platform;
