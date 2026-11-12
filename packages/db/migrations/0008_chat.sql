-- 0008 Chat between a guest and a House (spec §12 messaging).
-- One conversation per guest per House. The House can switch chat off for its store; the
-- guest then sees no chat button and new messages are refused (old ones stay readable).

alter table storefront add column chat_enabled boolean not null default true;

create table conversation (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  guest_profile_id    uuid not null,
  last_message_at     timestamptz not null default now(),
  last_sender         text check (last_sender in ('guest', 'house')),
  guest_read_at       timestamptz,
  house_read_at       timestamptz,
  created_at          timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, guest_profile_id),
  foreign key (tenant_id) references tenant(id) on delete cascade,
  foreign key (tenant_id, guest_profile_id) references guest_profile(tenant_id, id) on delete cascade
);
create index conversation_recent on conversation (tenant_id, last_message_at desc);

create table message (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  conversation_id   uuid not null,
  sender            text not null check (sender in ('guest', 'house')),
  -- The team member who replied (null for the guest's own messages).
  author_user_id    uuid references "user"(id),
  body              text not null check (length(btrim(body)) between 1 and 2000),
  created_at        timestamptz not null default now(),
  foreign key (tenant_id) references tenant(id) on delete cascade,
  foreign key (tenant_id, conversation_id) references conversation(tenant_id, id) on delete cascade
);
create index message_conversation on message (tenant_id, conversation_id, created_at);

-- Messages are a record: nobody edits them after sending.
create or replace function message_append_only() returns trigger
  language plpgsql
  as $$
begin
  raise exception 'messages cannot be changed' using errcode = 'check_violation';
end $$;
create trigger message_no_update before update on message
  for each row execute function message_append_only();

-- Row-level security: the same tenant policy as every other House table.
do $$
declare t text;
begin
  foreach t in array array['conversation', 'message'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (tenant_id = app_current_tenant() or app_is_platform())
         with check (tenant_id = app_current_tenant() or app_is_platform())', t);
  end loop;
end $$;
grant select, insert, update on conversation to sv_app, sv_platform;
grant select, insert on message to sv_app, sv_platform;
grant delete on conversation, message to sv_platform;
