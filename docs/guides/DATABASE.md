# Database guide

PostgreSQL 16 in production; PGlite (the same engine in WebAssembly) in tests and Docker-free development. Migrations live in `packages/db/migrations/` and are the source of truth. ADR 0005 explains the choices.

## Tables

| Migration                   | Tables                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 0001 foundations            | Extensions (`btree_gist`, `citext`), roles, helper functions                                                                        |
| 0002 platform and identity  | `market`, `plan`, `plan_price`, `fee_rule`, `user`, `session`, `otp_challenge`, `email_token`                                       |
| 0003 tenancy                | `tenant`, `membership`                                                                                                              |
| 0004 records                | `audit_log` (append-only), `outbox_event`, `idempotency_key`                                                                        |
| 0005 catalogue and bookings | `location`, `resource`, `category`, `service`, `service_variant`, `guest_profile`, `booking`, `booking_item`, `resource_allocation` |
| 0006 payments               | `payment_connection`, `payment_credential` (payments role only), `payment_intent`, `provider_callback`                              |

## How isolation works

```
request ──► API guard checks membership ──► transaction:
              SET LOCAL ROLE sv_app
              set_config('app.tenant_id', <House>, true)
              set_config('app.user_id',   <person>, true)
              ... queries ...   ◄── row-level security filters every row by tenant_id
```

| Role          | Used for                              | Can see                                              |
| ------------- | ------------------------------------- | ---------------------------------------------------- |
| `sv_app`      | Requests inside a House, or "my" data | Only rows of the current House or the current person |
| `sv_identity` | Sign-in, sessions, email links        | Users, sessions, codes and tokens. No House data     |
| `sv_payments` | Payments module                       | Payment tables, including encrypted credentials      |
| `sv_platform` | Staff console, background jobs        | Everything (every use is audit-logged by the API)    |

Three safety nets catch mistakes:

- **The request forgets its House:** it sees nothing, because `app.tenant_id` is empty.
- **The login user is the table owner:** `FORCE ROW LEVEL SECURITY` still applies the policies.
- **The login user is a superuser:** don't do this. Superusers skip RLS, so the app must log in as an ordinary user. `infra/postgres/init.sh` sets this up.

## Integrity enforced by the database

- **No double bookings:** `resource_allocation` has `EXCLUDE USING gist (tenant_id WITH =, resource_id WITH =, during WITH &&) WHERE (active)`. Bookings and manual blocks share the table, so one rule covers both. Cancelling a booking frees its slots (trigger).
- **No cross-tenant links:** child tables use composite foreign keys `(tenant_id, x_id) → parent(tenant_id, id)`.
- **Attribution is permanent:** a trigger refuses changes to `guest_profile.first_touch_*`.
- **Audit log is append-only:** a trigger refuses UPDATE and DELETE, even for the owner.
- **Money** is `bigint` minor units with a currency code, and **time** is `timestamptz` (UTC).

## Adding a tenant table (checklist)

1. New file `migrations/00NN_name.sql`. Never edit an applied migration.
2. Columns `id uuid primary key default gen_random_uuid()`, `tenant_id uuid not null`, `created_at`, `updated_at` (with the `set_updated_at` trigger).
3. `unique (tenant_id, id)`, plus composite foreign keys to parents.
4. Indexes that start with `tenant_id`, matching how you'll query.
5. `enable` + `force row level security`, the `tenant_isolation` policy, and explicit `grant`s.
6. If a policy looks into another table, name its roles: `create policy ... to sv_app using (...)`.
7. Mirror the table in `src/schema.ts` and add tests to `src/db.test.ts`.

## Commands

```sh
pnpm --filter @stayvinci/db build     # compile
pnpm --filter @stayvinci/db migrate   # apply migrations (DATABASE_URL from apps/api/.env)
pnpm --filter @stayvinci/db seed      # migrations + demo data (refused in production)
pnpm --filter @stayvinci/db test      # isolation, double-booking, attribution, audit tests
```
