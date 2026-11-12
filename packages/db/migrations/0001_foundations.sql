-- 0001 Foundations: extensions, database roles and helper functions.
--
-- Roles (NOLOGIN; the application's login user is granted membership and switches per
-- transaction with SET LOCAL ROLE, so a bug can never run tenant code with owner rights):
--   sv_app       tenant-scoped requests. Row-level security always applies.
--   sv_identity  sign-in and sessions only. Can read users by phone; no tenant data.
--   sv_payments  payments module. The only role that can read encrypted credentials.
--   sv_platform  Stayvinci staff console and background jobs. Policies let it see all
--                tenants; every use is audit-logged by the application.

create extension if not exists btree_gist;   -- exclusion constraints on (uuid, tstzrange)
create extension if not exists citext;       -- case-insensitive emails and handles

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'sv_app') then create role sv_app nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'sv_identity') then create role sv_identity nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'sv_payments') then create role sv_payments nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'sv_platform') then create role sv_platform nologin; end if;
end $$;

-- The migrating (owner) login can switch into each role.
grant sv_app, sv_identity, sv_payments, sv_platform to current_user;

grant usage on schema public to sv_app, sv_identity, sv_payments, sv_platform;

-- Request context, set per transaction with set_config(..., true) by the API.
create or replace function app_current_tenant() returns uuid
  language sql stable parallel safe
  as $$ select nullif(current_setting('app.tenant_id', true), '')::uuid $$;

create or replace function app_current_user() returns uuid
  language sql stable parallel safe
  as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create or replace function app_is_platform() returns boolean
  language sql stable parallel safe
  as $$ select current_user = 'sv_platform' $$;

-- Keeps updated_at honest without relying on application code.
create or replace function set_updated_at() returns trigger
  language plpgsql
  as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Append-only tables (audit log): refuse updates and deletes for everyone.
create or replace function refuse_change() returns trigger
  language plpgsql
  as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end $$;

grant execute on function app_current_tenant(), app_current_user(), app_is_platform()
  to sv_app, sv_identity, sv_payments, sv_platform;
