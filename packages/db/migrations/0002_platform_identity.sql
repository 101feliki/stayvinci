-- 0002 Platform configuration and identity (spec §1, §2, §12, §19).
-- No prices or country rules are hard-coded: they live in these tables (CLAUDE.md rule 7).

create table market (
  code            char(2) primary key check (code ~ '^[A-Z]{2}$'),
  name            text not null,
  currency        char(3) not null check (currency ~ '^[A-Z]{3}$'),
  timezone        text not null,
  default_locale  text not null default 'en',
  hold_minutes    smallint not null default 10 check (hold_minutes between 2 and 60),
  tax_rules       jsonb not null default '{}'::jsonb,
  compliance      jsonb not null default '{}'::jsonb,
  enabled_providers text[] not null default '{}',
  active          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger market_updated before update on market for each row execute function set_updated_at();

create table plan (
  code            text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name            text not null,
  tenant_kinds    text[] not null default '{house,atelier}',
  features        text[] not null default '{}',
  limits          jsonb not null default '{}'::jsonb,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger plan_updated before update on plan for each row execute function set_updated_at();

-- Price per market and interval; rows appear once pricing is decided.
create table plan_price (
  plan_code       text not null references plan(code) on update cascade,
  market_code     char(2) not null references market(code),
  interval        text not null check (interval in ('monthly', 'annual')),
  amount_minor    bigint not null check (amount_minor >= 0),
  currency        char(3) not null,
  valid_from      timestamptz not null default now(),
  primary key (plan_code, market_code, interval, valid_from)
);

-- Marketplace fee rules are versioned so every fee line can name the rule it used (spec §12).
create table fee_rule (
  id              uuid primary key default gen_random_uuid(),
  market_code     char(2) not null references market(code),
  version         integer not null check (version > 0),
  percent_bps     integer not null check (percent_bps between 0 and 10000),
  min_minor       bigint check (min_minor >= 0),
  max_minor       bigint check (max_minor >= 0),
  effective_from  timestamptz not null,
  created_at      timestamptz not null default now(),
  unique (market_code, version),
  check (min_minor is null or max_minor is null or min_minor <= max_minor)
);

-- One row per person; staff and guests share it (spec §19). "user" is quoted everywhere.
create table "user" (
  id                  uuid primary key default gen_random_uuid(),
  phone_e164          text unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email               citext unique,
  full_name           text check (length(full_name) <= 120),
  email_verified_at   timestamptz,
  password_hash       text,                       -- Argon2id, staff console only
  totp_secret_enc     bytea,                      -- encrypted TOTP seed
  totp_enabled_at     timestamptz,
  platform_role       text check (platform_role in ('super_admin', 'admin', 'finance', 'marketing')),
  status              text not null default 'active' check (status in ('active', 'locked', 'deleted')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (phone_e164 is not null or email is not null)
);
create trigger user_updated before update on "user" for each row execute function set_updated_at();

-- Refresh-token sessions. Only a SHA-256 hash of the token is stored.
create table session (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references "user"(id) on delete cascade,
  refresh_hash        bytea not null unique,
  audience            text not null check (audience in ('guest', 'business', 'console')),
  second_factor_at    timestamptz,
  user_agent          text,
  ip                  inet,
  created_at          timestamptz not null default now(),
  last_used_at        timestamptz not null default now(),
  expires_at          timestamptz not null,
  revoked_at          timestamptz
);
create index session_user_active on session (user_id) where revoked_at is null;
create index session_expires on session (expires_at) where revoked_at is null;

-- One-time SMS codes. Only an HMAC of the code is stored; attempts are capped.
create table otp_challenge (
  id                  uuid primary key default gen_random_uuid(),
  phone_e164          text not null,
  code_hmac           bytea not null,
  purpose             text not null check (purpose in ('sign_in', 'verify_phone')),
  attempts            smallint not null default 0 check (attempts <= 10),
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  consumed_at         timestamptz
);
create index otp_challenge_phone_recent on otp_challenge (phone_e164, created_at desc);
create index otp_challenge_expired on otp_challenge (expires_at);

-- One-time email links: account activation (verify email), magic-link sign-in and
-- password reset. Only a SHA-256 hash of the token is stored; links expire and work once.
create table email_token (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references "user"(id) on delete cascade,
  purpose             text not null check (purpose in ('verify_email', 'magic_link', 'password_reset')),
  token_hash          bytea not null unique,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  consumed_at         timestamptz
);
create index email_token_user_purpose on email_token (user_id, purpose, created_at desc);
create index email_token_expired on email_token (expires_at);

-- Reference data everyone can read; only the platform role can change it.
grant select on market, plan, plan_price, fee_rule to sv_app, sv_identity, sv_payments, sv_platform;
grant insert, update, delete on market, plan, plan_price, fee_rule to sv_platform;

-- Identity tables: row-level security keeps each person to their own rows.
alter table "user" enable row level security;
alter table "user" force row level security;
create policy user_self on "user"
  using (id = app_current_user() or current_user in ('sv_identity', 'sv_platform'))
  with check (id = app_current_user() or current_user in ('sv_identity', 'sv_platform'));
grant select, update (full_name, email) on "user" to sv_app;
grant select, insert, update on "user" to sv_identity, sv_platform;

alter table session enable row level security;
alter table session force row level security;
create policy session_owner on session
  using (user_id = app_current_user() or current_user in ('sv_identity', 'sv_platform'))
  with check (user_id = app_current_user() or current_user in ('sv_identity', 'sv_platform'));
grant select, insert, update on session to sv_identity, sv_platform;
grant select, update (revoked_at) on session to sv_app;

alter table otp_challenge enable row level security;
alter table otp_challenge force row level security;
create policy otp_identity_only on otp_challenge
  using (current_user in ('sv_identity', 'sv_platform'))
  with check (current_user in ('sv_identity', 'sv_platform'));
grant select, insert, update, delete on otp_challenge to sv_identity, sv_platform;

alter table email_token enable row level security;
alter table email_token force row level security;
create policy email_token_identity_only on email_token
  using (current_user in ('sv_identity', 'sv_platform'))
  with check (current_user in ('sv_identity', 'sv_platform'));
grant select, insert, update, delete on email_token to sv_identity, sv_platform;

-- Kenya first. Further markets are added as configuration, not code.
insert into market (code, name, currency, timezone, default_locale, hold_minutes, enabled_providers, active)
values ('KE', 'Kenya', 'KES', 'Africa/Nairobi', 'en', 10, '{mpesa}', true);

insert into plan (code, name, features) values
  ('solo', 'Solo', '{bookings,mpesa_payments,private_store,reviews,packages_gift_cards}'),
  ('business', 'Business', '{bookings,mpesa_payments,private_store,reviews,packages_gift_cards,team_permissions,memberships,marketing_campaigns,marketplace_listing,guest_import,short_stay}'),
  ('signature', 'Signature', '{bookings,mpesa_payments,private_store,reviews,packages_gift_cards,team_permissions,memberships,marketing_campaigns,marketplace_listing,guest_import,short_stay,paid_content,advanced_reports,multi_location,card_payments,loyalty_points,waitlist}');
