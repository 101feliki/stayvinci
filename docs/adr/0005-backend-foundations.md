# ADR 0005: Backend foundations (database, API security, docs, email)

- Status: accepted
- Date: 2026-11-11
- Spec: §1, §3, §10, §18, §19, §20; P0 tasks 2–9

## Decisions

1. **SQL migrations are the source of truth.** `packages/db/migrations/*.sql` run in order with checksums; an edited migration stops the run (fix forward). `schema.ts` is a typed Drizzle mirror for queries. We don't use drizzle-kit to generate migrations: hand-written SQL lets us express RLS policies, exclusion constraints, triggers and grants precisely.
2. **Four database roles, switched per transaction.** The app logs in as an ordinary user (never a superuser, because superusers skip row-level security) and every request runs `SET LOCAL ROLE`:
   - `sv_app`: tenant requests, always under RLS.
   - `sv_identity`: sign-in only.
   - `sv_payments`: the only role that can read encrypted credentials.
   - `sv_platform`: staff and background jobs.

   Request context (`app.tenant_id`, `app.user_id`) is set with transaction-local `set_config`, so pooled connections never leak context.

3. **Integrity in the database, not just the code:**
   - **Composite foreign keys** `(tenant_id, id)`: a row can't reference another tenant's row.
   - **One exclusion constraint for the calendar:** `resource_allocation` holds both bookings and manual blocks, so a single `EXCLUDE USING gist` covers both.
   - **Triggers:** cancelling frees slots, first-touch attribution is permanent, and the audit log is append-only.
4. **Optimised for the access patterns:**
   - Every tenant table is indexed with `tenant_id` first, matching the RLS predicate.
   - Partial indexes cover the queue-style tables: unpublished outbox events, open holds, pending payment intents, unprocessed callbacks and active sessions.
   - A BRIN index keeps time scans on the audit log cheap.
   - Lists use keyset (cursor) pagination, never OFFSET.
   - The pool sets `statement_timeout` and `idle_in_transaction_session_timeout`.
5. **PGlite for tests and Docker-free development.** `DATABASE_URL=pglite://memory` (tests) or `pglite://./.data/pglite` (local). It is real PostgreSQL compiled to WebAssembly, so RLS, roles, `btree_gist` and `citext` behave as in production. Production uses PostgreSQL 16; config refuses PGlite in production.
6. **"Nothing exposed" API defaults:**
   - **Access control:** every route needs a token unless marked `@Public()`. Membership is checked for `/tenants/{tenantId}`, where non-members get 404 rather than 403. Capabilities and platform roles have their own guards.
   - **Uniform responses:** endpoints that could reveal whether a phone or email has an account always answer the same way.
   - **Errors:** a single shape with no stack traces or SQL.
   - **Request hygiene:** 100 KB body limit, strict CSP and security headers, `Cache-Control: no-store`, CORS only for listed origins, and per-IP rate limits (stricter on sign-in).
   - **Logging:** request logs carry method, route pattern, status and duration only.
   - **Secrets:** stored only as hashes or HMACs, or encrypted with AES-256-GCM; passwords use Argon2id via WebAssembly (`hash-wasm`).
   - **Configuration:** production refuses to start with missing or weak secrets, PGlite, the console SMS adapter, or open docs.
7. **Swagger docs from the same Zod schemas that validate requests** (`@stayvinci/types`). They are served at `/docs`, off in production unless `DOCS_USER`/`DOCS_PASSWORD` are set, which then protect them with basic auth. A test asserts every `$ref` resolves.
8. **Email through Nodemailer over SMTP** (activation, magic-link sign-in, password reset). Locally it goes to Mailpit; in production any SMTP provider, Resend included. Subjects are neutral (discretion rule). Links are single-use, expire, and only their SHA-256 hashes are stored.
9. **Cross-tenant harness reads routes from the OpenAPI document.** A new endpoint is automatically included in the "no token ⇒ 401" and "other House ⇒ 404" sweeps.

## Consequences

- New tenant tables must follow the pattern: `tenant_id`, `unique (tenant_id, id)`, composite foreign keys, the `tenant_isolation` policy, explicit grants. Policies that look into other tables must name their roles (`to sv_app, ...`) so restricted roles never evaluate them.
- Managed PostgreSQL must allow the app user `CREATEROLE` (for migrations) and must not make it a superuser.
- Rate limiting is in memory; when the API runs on more than one instance, move the throttler storage to Redis.
- Refresh-token reuse detection (signing out every session when an old token is replayed) is a follow-up.
- KMS integration for payment credentials (envelope encryption) arrives with the payments module (P1); the table and grants are ready.
