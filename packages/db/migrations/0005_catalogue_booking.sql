-- 0005 Catalogue, guests and bookings (spec §5.3, §5.4, §8, §10).
-- Integrity lives in the database: composite tenant foreign keys, money as integer minor
-- units, and no double bookings via an exclusion constraint (CLAUDE.md rule 3).

create table location (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  name            text not null,
  address         jsonb not null default '{}'::jsonb,   -- released to guests only after payment
  timezone        text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, id)
);
create trigger location_updated before update on location for each row execute function set_updated_at();

create table resource (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  location_id     uuid,
  type            text not null check (type in ('staff', 'room', 'equipment', 'unit', 'self')),
  name            text not null,
  capacity        smallint not null default 1 check (capacity between 1 and 500),
  membership_id   uuid,                                 -- staff resources link to a team member
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id) references tenant(id) on delete cascade,
  foreign key (tenant_id, location_id) references location(tenant_id, id),
  foreign key (tenant_id, membership_id) references membership(tenant_id, id)
);
create index resource_tenant_type on resource (tenant_id, type) where active;
create trigger resource_updated before update on resource for each row execute function set_updated_at();

create table category (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  name            text not null,
  position        smallint not null default 0,
  visibility      text not null default 'public' check (visibility in ('public', 'members_only', 'invite_only', 'hidden')),
  image_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, id)
);
create index category_tenant_position on category (tenant_id, position);
create trigger category_updated before update on category for each row execute function set_updated_at();

-- An offering a guest can book (spec calls it "offering"; the apps say "service").
create table service (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  category_id     uuid,
  name            text not null check (length(name) between 2 and 120),
  description     text not null default '',
  visibility      text not null default 'public' check (visibility in ('public', 'members_only', 'invite_only', 'hidden')),
  image_url       text,
  icon            text,
  buffer_before_min smallint not null default 0 check (buffer_before_min between 0 and 240),
  buffer_after_min  smallint not null default 0 check (buffer_after_min between 0 and 240),
  requires        text[] not null default '{staff}',
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id) references tenant(id) on delete cascade,
  foreign key (tenant_id, category_id) references category(tenant_id, id)
);
create index service_tenant_category on service (tenant_id, category_id) where active;
create trigger service_updated before update on service for each row execute function set_updated_at();

create table service_variant (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  service_id      uuid not null,
  name            text not null,
  duration_min    smallint not null check (duration_min between 5 and 1440),
  price_minor     bigint not null check (price_minor >= 0),
  currency        char(3) not null,
  position        smallint not null default 0,
  unique (tenant_id, id),
  foreign key (tenant_id, service_id) references service(tenant_id, id) on delete cascade
);
create index service_variant_service on service_variant (tenant_id, service_id, position);

-- A guest inside one House. Contact details stay on "user" and are never copied here,
-- so they can only be read through the guest.contact.view path (CLAUDE.md rule 5).
create table guest_profile (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenant(id) on delete cascade,
  user_id             uuid not null references "user"(id),
  alias               text check (length(alias) <= 60),
  notes               text,
  tags                text[] not null default '{}',
  marketing_opt_in    boolean not null default false,
  first_touch_source  text not null check (first_touch_source in ('own_channel', 'marketplace')),
  first_touch_detail  text,
  first_touch_at      timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (tenant_id, id)
);
create index guest_profile_user on guest_profile (user_id);
create trigger guest_profile_updated before update on guest_profile for each row execute function set_updated_at();

-- Attribution is permanent: the first touch can never be edited (CLAUDE.md rule 6).
create or replace function guest_profile_keep_first_touch() returns trigger
  language plpgsql
  as $$
begin
  if new.first_touch_source is distinct from old.first_touch_source
     or new.first_touch_at is distinct from old.first_touch_at
     or new.first_touch_detail is distinct from old.first_touch_detail then
    raise exception 'first touch attribution is permanent' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger guest_profile_first_touch before update on guest_profile
  for each row execute function guest_profile_keep_first_touch();

create table booking (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  ref               text not null check (ref ~ '^SV-[A-Z0-9]{4,10}$'),
  guest_profile_id  uuid not null,
  location_id       uuid,
  state             text not null check (state in
                      ('held', 'pending_payment', 'requested', 'confirmed', 'checked_in', 'completed',
                       'cancelled_by_guest', 'cancelled_by_tenant', 'no_show', 'disputed')),
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  hold_expires_at   timestamptz,
  total_minor       bigint not null check (total_minor >= 0),
  deposit_minor     bigint not null default 0 check (deposit_minor >= 0),
  paid_minor        bigint not null default 0 check (paid_minor >= 0),
  currency          char(3) not null,
  source            text not null check (source in ('guest_app', 'staff', 'marketplace')),
  notes             text,
  idempotency_key   text,
  version           integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, ref),
  unique (tenant_id, idempotency_key),
  check (ends_at > starts_at),
  check (deposit_minor <= total_minor),
  check (state <> 'held' or hold_expires_at is not null),
  foreign key (tenant_id) references tenant(id) on delete cascade,
  foreign key (tenant_id, guest_profile_id) references guest_profile(tenant_id, id),
  foreign key (tenant_id, location_id) references location(tenant_id, id)
);
-- Calendar views read one tenant's day or week.
create index booking_tenant_start on booking (tenant_id, starts_at);
create index booking_guest on booking (tenant_id, guest_profile_id, starts_at desc);
-- The hold sweeper only scans live holds.
create index booking_open_holds on booking (hold_expires_at) where state = 'held';
create trigger booking_updated before update on booking for each row execute function set_updated_at();

create table booking_item (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  booking_id          uuid not null,
  service_variant_id  uuid not null,
  price_minor         bigint not null check (price_minor >= 0),
  guests              smallint not null default 1 check (guests between 1 and 50),
  unique (tenant_id, id),
  foreign key (tenant_id, booking_id) references booking(tenant_id, id) on delete cascade,
  foreign key (tenant_id, service_variant_id) references service_variant(tenant_id, id)
);
create index booking_item_booking on booking_item (tenant_id, booking_id);

-- Who and what is busy when. Bookings and manual blocks share this table so ONE
-- exclusion constraint covers both: a resource can never be in two places at once.
create table resource_allocation (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  resource_id     uuid not null,
  booking_id      uuid,
  block_reason    text,
  during          tstzrange not null check (not isempty(during)),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  check ((booking_id is null) <> (block_reason is null)),
  foreign key (tenant_id, resource_id) references resource(tenant_id, id),
  foreign key (tenant_id, booking_id) references booking(tenant_id, id) on delete cascade,
  constraint no_double_booking exclude using gist
    (tenant_id with =, resource_id with =, during with &&) where (active)
);
create index resource_allocation_booking on resource_allocation (tenant_id, booking_id);

-- Cancelling a booking frees its resources in the same transaction.
create or replace function booking_release_allocations() returns trigger
  language plpgsql
  as $$
begin
  if new.state in ('cancelled_by_guest', 'cancelled_by_tenant') and old.state is distinct from new.state then
    update resource_allocation set active = false
     where tenant_id = new.tenant_id and booking_id = new.id and active;
  end if;
  return new;
end $$;
create trigger booking_state_release after update of state on booking
  for each row execute function booking_release_allocations();

-- Row-level security: identical tenant policy on every table in this migration.
do $$
declare t text;
begin
  foreach t in array array['location', 'resource', 'category', 'service', 'service_variant',
                           'guest_profile', 'booking', 'booking_item', 'resource_allocation'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (tenant_id = app_current_tenant() or app_is_platform())
         with check (tenant_id = app_current_tenant() or app_is_platform())', t);
    execute format('grant select, insert, update, delete on %I to sv_app, sv_platform', t);
    execute format('grant select on %I to sv_payments', t);
  end loop;
end $$;
-- Payments confirm bookings after a callback.
grant update (state, paid_minor, hold_expires_at, version) on booking to sv_payments;
grant update (active) on resource_allocation to sv_payments;

-- People visible inside a House: its team members and its guests. The API still omits
-- phone and email unless the caller has guest.contact.view (CLAUDE.md rule 5).
create policy user_in_current_tenant on "user" for select to sv_app using (
  exists (select 1 from membership m where m.user_id = "user".id and m.tenant_id = app_current_tenant())
  or exists (select 1 from guest_profile g where g.user_id = "user".id and g.tenant_id = app_current_tenant())
);
