-- 0004 Audit log, outbox events and idempotency keys (CLAUDE.md rules 4 and 9, spec §20).

-- Every privileged action and money movement. Append-only for everyone, including owners.
create table audit_log (
  id              bigint generated always as identity primary key,
  tenant_id       uuid references tenant(id),          -- null for platform-level actions
  actor_user_id   uuid references "user"(id),
  actor_label     text not null,                       -- e.g. "Amani Mwangi", "Stayvinci support (Felix)", "system"
  action          text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_type     text,
  target_id       text,
  before          jsonb,
  after           jsonb,
  ip              inet,
  request_id      text,
  occurred_at     timestamptz not null default now()
);
create index audit_log_tenant_time on audit_log (tenant_id, occurred_at desc);
create index audit_log_actor on audit_log (actor_user_id, occurred_at desc);
-- BRIN: tiny index that keeps time-range scans cheap as the table grows to millions of rows.
create index audit_log_time_brin on audit_log using brin (occurred_at);
create trigger audit_log_append_only before update or delete on audit_log
  for each row execute function refuse_change();

alter table audit_log enable row level security;
alter table audit_log force row level security;
create policy audit_read on audit_log for select
  using (tenant_id = app_current_tenant() or app_is_platform());
create policy audit_insert on audit_log for insert
  with check ((tenant_id is null and current_user in ('sv_identity', 'sv_platform'))
              or tenant_id = app_current_tenant() or app_is_platform());
grant select, insert on audit_log to sv_app, sv_payments, sv_platform;
grant insert on audit_log to sv_identity;

-- Domain events written in the same transaction as the change; a worker publishes them.
create table outbox_event (
  id              bigint generated always as identity primary key,
  tenant_id       uuid references tenant(id),
  type            text not null check (type ~ '^[a-z_]+\.[a-z_]+$'),   -- entity.past_tense
  aggregate_type  text not null,
  aggregate_id    text not null,
  payload         jsonb not null,
  created_at      timestamptz not null default now(),
  published_at    timestamptz,
  attempts        smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text
);
-- The publisher only ever looks at unpublished events, so the index stays small.
create index outbox_pending on outbox_event (next_attempt_at) where published_at is null;

alter table outbox_event enable row level security;
alter table outbox_event force row level security;
create policy outbox_insert on outbox_event for insert
  with check (tenant_id = app_current_tenant() or app_is_platform()
              or (tenant_id is null and current_user = 'sv_identity'));
create policy outbox_platform on outbox_event for all
  using (app_is_platform()) with check (app_is_platform());
grant insert on outbox_event to sv_app, sv_identity, sv_payments;
grant select, insert, update on outbox_event to sv_platform;

-- Stored responses for retried POSTs. Same key + same request => same response.
create table idempotency_key (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references "user"(id) on delete cascade,
  tenant_id       uuid references tenant(id) on delete cascade,
  key             text not null check (length(key) between 8 and 128),
  method          text not null,
  path            text not null,
  request_hash    bytea not null,
  status          text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  response_code   smallint,
  response_body   jsonb,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '24 hours'
);
create unique index idempotency_scope_key
  on idempotency_key (user_id, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), key);
create index idempotency_expired on idempotency_key (expires_at);

alter table idempotency_key enable row level security;
alter table idempotency_key force row level security;
create policy idempotency_owner on idempotency_key
  using (user_id = app_current_user() or app_is_platform())
  with check (user_id = app_current_user() and (tenant_id is null or tenant_id = app_current_tenant()));
grant select, insert, update, delete on idempotency_key to sv_app, sv_payments;
grant select, delete on idempotency_key to sv_platform;
