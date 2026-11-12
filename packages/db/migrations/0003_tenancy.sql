-- 0003 Tenancy: Houses and Ateliers, and who works in them (spec §1, §2, §18).
--
-- Pattern used by every tenant-owned table from here on:
--   * tenant_id NOT NULL, and UNIQUE (tenant_id, id) so child tables can use composite
--     foreign keys (tenant_id, x_id). A row can never point at another tenant's row.
--   * Indexes lead with tenant_id, matching the row-level security predicate.
--   * ENABLE + FORCE row level security with the tenant_isolation policy.

create table tenant (
  id              uuid primary key default gen_random_uuid(),
  handle          citext not null unique check (handle ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  name            text not null check (length(name) between 2 and 120),
  legal_name      text,
  kind            text not null check (kind in ('house', 'atelier')),
  vertical        text not null check (vertical in ('spa', 'short_stay', 'atelier')),
  market_code     char(2) not null references market(code),
  timezone        text not null,
  currency        char(3) not null,
  status          text not null default 'onboarding' check (status in
                    ('onboarding_unpaid', 'onboarding', 'pending_verification', 'ready',
                     'live', 'past_due', 'suspended', 'closed')),
  visibility      text not null default 'private' check (visibility in ('private', 'listed', 'listed_limited')),
  plan_code       text not null references plan(code) on update cascade,
  source          text not null default 'self_signup' check (source in ('self_signup', 'invited')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tenant_market_status on tenant (market_code, status);
create trigger tenant_updated before update on tenant for each row execute function set_updated_at();

-- user <-> tenant with a role bundle and per-person capability overrides (spec §1).
create table membership (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  user_id         uuid not null references "user"(id) on delete cascade,
  role            text not null check (role in
                    ('owner', 'manager', 'front_desk', 'practitioner', 'content_editor', 'accountant')),
  caps_added      text[] not null default '{}',
  caps_removed    text[] not null default '{}',
  status          text not null default 'invited' check (status in ('invited', 'active', 'suspended')),
  invited_by      uuid references "user"(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (tenant_id, id)
);
create index membership_user on membership (user_id) where status = 'active';
create trigger membership_updated before update on membership for each row execute function set_updated_at();

-- Tenants: visible inside their own context, to their active members (to list "my Houses"),
-- and to the platform role. Only the platform creates tenants; members update their own.
alter table tenant enable row level security;
alter table tenant force row level security;
-- Policies that look into other tables name their roles, so roles without access to those
-- tables (sign-in, payments) never evaluate them.
create policy tenant_read on tenant for select to sv_app, sv_platform using (
  id = app_current_tenant()
  or app_is_platform()
  or exists (select 1 from membership m
             where m.tenant_id = tenant.id and m.user_id = app_current_user() and m.status = 'active')
);
create policy tenant_read_payments on tenant for select to sv_payments using (id = app_current_tenant());
create policy tenant_update on tenant for update
  using (id = app_current_tenant() or app_is_platform())
  with check (id = app_current_tenant() or app_is_platform());
create policy tenant_insert on tenant for insert with check (app_is_platform());
grant select, update (name, legal_name, timezone, visibility) on tenant to sv_app;
grant select, insert, update on tenant to sv_platform;
grant select on tenant to sv_payments;

-- Memberships: a person can see their own across tenants; changes stay inside the tenant.
alter table membership enable row level security;
alter table membership force row level security;
create policy membership_read on membership for select using (
  tenant_id = app_current_tenant() or user_id = app_current_user() or app_is_platform()
);
create policy membership_write on membership for all
  using (tenant_id = app_current_tenant() or app_is_platform())
  with check (tenant_id = app_current_tenant() or app_is_platform());
grant select, insert, update, delete on membership to sv_app, sv_platform;
