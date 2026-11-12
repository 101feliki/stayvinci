-- 0007: storefronts, public store browsing, team and room profiles, opening hours,
-- who-can-do-what, and reviews from completed visits (spec §7, §8, §9, §11, §14).
--
-- A new role, sv_public, serves guests who are browsing stores (signed in or not). It can
-- only read published, live stores, and only the columns granted below: no addresses,
-- no guest data, no access codes, no prices that aren't public.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'sv_public') then
    create role sv_public nologin;
  end if;
end $$;
grant sv_public to current_user;
grant usage on schema public to sv_public;
grant execute on function app_current_tenant(), app_current_user(), app_is_platform() to sv_public;

-- The private code a guest types to enter a private store (spec §9 access). Owners and
-- staff can read it; sv_public can only match against it through the policy below.
alter table tenant add column access_code citext unique
  check (access_code is null or access_code ~ '^[A-Za-z0-9-]{4,24}$');

create or replace function app_access_code() returns text
  language sql stable
  as $$ select nullif(current_setting('app.access_code', true), '') $$;
grant execute on function app_access_code() to sv_app, sv_platform, sv_public;

-- A store is visible to the public when it is live and either listed or entered by code.
create policy tenant_public on tenant for select to sv_public using (
  status = 'live' and (visibility <> 'private' or (access_code is not null and access_code = app_access_code()))
);
grant select (id, handle, name, kind, vertical, market_code, timezone, currency, visibility)
  on tenant to sv_public;
grant update (access_code) on tenant to sv_app;

-- Storefront: what guests see. One row per tenant.
create table storefront (
  tenant_id     uuid primary key references tenant(id) on delete cascade,
  tagline       text not null default '' check (length(tagline) <= 160),
  about         text not null default '' check (length(about) <= 4000),
  highlights    text[] not null default '{}',     -- short promises, e.g. "Heated outdoor pool"
  amenities     text[] not null default '{}',     -- e.g. sauna, steam room, parking
  area          text,                             -- neighbourhood shown publicly (never the address)
  city          text,
  logo_url      text,
  cover_url     text,
  gallery       text[] not null default '{}',
  design        jsonb not null default '{}'::jsonb,  -- palette, sections, season, marquee (design engine)
  socials       jsonb not null default '{}'::jsonb,  -- public handles only
  policies      jsonb not null default '{}'::jsonb,  -- cancellation, arrival, etiquette text
  published     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger storefront_updated before update on storefront for each row execute function set_updated_at();

-- Opening hours and the public part of a location's address.
alter table location
  add column hours jsonb not null default
    '{"mon":[["09:00","20:00"]],"tue":[["09:00","20:00"]],"wed":[["09:00","20:00"]],"thu":[["09:00","20:00"]],"fri":[["09:00","20:00"]],"sat":[["09:00","20:00"]],"sun":[["10:00","18:00"]]}'::jsonb,
  add column area text,
  add column city text;

-- Team and room profiles shown on the store.
alter table resource
  add column title         text check (length(title) <= 80),
  add column bio           text not null default '' check (length(bio) <= 1200),
  add column specialties   text[] not null default '{}',
  add column photo_url     text,
  add column description   text not null default '' check (length(description) <= 2000),
  add column amenities     text[] not null default '{}',
  add column gallery       text[] not null default '{}',
  add column show_on_store boolean not null default true,
  add column position      smallint not null default 0;
drop index resource_tenant_type;  -- replaced by the index below (same prefix, adds position)
create index resource_tenant_type_position on resource (tenant_id, type, position) where active;

-- Which staff (or rooms) can deliver which service. Availability reads this.
create table service_resource (
  tenant_id     uuid not null,
  service_id    uuid not null,
  resource_id   uuid not null,
  primary key (tenant_id, service_id, resource_id),
  foreign key (tenant_id) references tenant(id) on delete cascade,
  foreign key (tenant_id, service_id) references service(tenant_id, id) on delete cascade,
  foreign key (tenant_id, resource_id) references resource(tenant_id, id) on delete cascade
);
create index service_resource_resource on service_resource (tenant_id, resource_id);

-- Reviews: only a guest with a completed booking can leave one, once per booking.
create table review (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  booking_id        uuid not null,
  guest_profile_id  uuid not null,
  rating            smallint not null check (rating between 1 and 5),
  comment           text not null default '' check (length(comment) <= 1000),
  reply             text check (length(reply) <= 1000),
  published         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, booking_id),
  foreign key (tenant_id) references tenant(id) on delete cascade,
  foreign key (tenant_id, booking_id) references booking(tenant_id, id) on delete cascade,
  foreign key (tenant_id, guest_profile_id) references guest_profile(tenant_id, id)
);
create index review_tenant_recent on review (tenant_id, created_at desc) where published;
create trigger review_updated before update on review for each row execute function set_updated_at();

create or replace function review_requires_completed_visit() returns trigger
  language plpgsql
  as $$
begin
  if not exists (select 1 from booking b
                  where b.tenant_id = new.tenant_id and b.id = new.booking_id
                    and b.guest_profile_id = new.guest_profile_id and b.state = 'completed') then
    raise exception 'reviews need a completed booking by the same guest' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger review_completed_visit before insert on review
  for each row execute function review_requires_completed_visit();

-- Row-level security: the tenant policy on the new tables.
do $$
declare t text;
begin
  foreach t in array array['storefront', 'service_resource', 'review'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (tenant_id = app_current_tenant() or app_is_platform())
         with check (tenant_id = app_current_tenant() or app_is_platform())', t);
    execute format('grant select, insert, update, delete on %I to sv_app, sv_platform', t);
  end loop;
end $$;

-- A guest can see their own guest profiles across Houses (to list "my bookings").
create policy guest_profile_self on guest_profile for select to sv_app using (user_id = app_current_user());

-- Public read policies. Each checks the tenant is visible to sv_public (tenant_public).
create policy store_public on storefront for select to sv_public using (
  published and exists (select 1 from tenant t where t.id = storefront.tenant_id)
);
grant select on storefront to sv_public;

create policy location_public on location for select to sv_public using (
  exists (select 1 from tenant t where t.id = location.tenant_id)
);
grant select (id, tenant_id, name, timezone, hours, area, city) on location to sv_public;

create policy category_public on category for select to sv_public using (
  visibility = 'public' and exists (select 1 from tenant t where t.id = category.tenant_id)
);
grant select (id, tenant_id, name, position, image_url) on category to sv_public;

create policy service_public on service for select to sv_public using (
  visibility = 'public' and active and exists (select 1 from tenant t where t.id = service.tenant_id)
);
grant select (id, tenant_id, category_id, name, description, image_url, icon,
              buffer_before_min, buffer_after_min, requires) on service to sv_public;

create policy variant_public on service_variant for select to sv_public using (
  exists (select 1 from tenant t where t.id = service_variant.tenant_id)
);
grant select on service_variant to sv_public;

create policy resource_public on resource for select to sv_public using (
  active and exists (select 1 from tenant t where t.id = resource.tenant_id)
);
grant select (id, tenant_id, location_id, type, name, title, bio, specialties, photo_url, capacity,
              description, amenities, gallery, show_on_store, position) on resource to sv_public;

create policy service_resource_public on service_resource for select to sv_public using (
  exists (select 1 from tenant t where t.id = service_resource.tenant_id)
);
grant select on service_resource to sv_public;

-- Busy times only (which resource, when). Never which booking or which guest.
create policy allocation_public on resource_allocation for select to sv_public using (
  active and exists (select 1 from tenant t where t.id = resource_allocation.tenant_id)
);
grant select (tenant_id, resource_id, during, active) on resource_allocation to sv_public;

create policy review_public on review for select to sv_public using (
  published and exists (select 1 from tenant t where t.id = review.tenant_id)
);
grant select (id, tenant_id, rating, comment, reply, created_at) on review to sv_public;
