# Getting started

Everything lives in this one repository. Read `CLAUDE.md` first (rules and stack), then `docs/SPEC.md` (the product). Decisions are recorded in `docs/adr/`.

## 1. Install

You need Node 22+ and pnpm (`corepack enable`).

```sh
pnpm install
```

## 2. Run the backend

The API uses PostgreSQL. Pick one option.

**Option A (no Docker).** Uses PGlite, real PostgreSQL in WebAssembly, stored in `apps/api/.data/`:

```sh
cp apps/api/.env.example apps/api/.env      # then fill JWT_SECRET, OTP_PEPPER, DATA_ENCRYPTION_KEY
pnpm --filter @stayvinci/api dev            # builds, migrates, starts on http://localhost:4000
pnpm --filter @stayvinci/db seed            # optional: demo House "Serenity", its owner, a staff user
```

With PGlite, stop the API before running `migrate` or `seed`: a PGlite database folder must only be open in one process at a time.

**Option B (Docker: PostgreSQL 16, Redis, Mailpit):**

```sh
docker compose -f infra/docker-compose.yml up -d
# in apps/api/.env:
#   DATABASE_URL=postgres://stayvinci:stayvinci-local-only@127.0.0.1:5432/stayvinci
pnpm --filter @stayvinci/api dev
```

The commands below are what you'll use most. Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`; the encryption key needs 32 bytes in base64.

| What                                     | Where                                             |
| ---------------------------------------- | ------------------------------------------------- |
| API docs (Swagger)                       | http://localhost:4000/docs                        |
| OpenAPI JSON                             | http://localhost:4000/docs/openapi.json           |
| Emails (activation, magic links, resets) | Mailpit inbox at http://localhost:8025 (Option B) |
| SMS sign-in codes in development         | Printed in the API log (`SMS_PROVIDER=console`)   |

## 3. Run the apps

```sh
pnpm --filter @stayvinci/business-web dev   # http://localhost:5173  (add ?demo=1 to skip sign-in)
pnpm --filter @stayvinci/guest-web dev      # http://localhost:5174/?demo=1
pnpm --filter @stayvinci/admin-console dev  # http://localhost:5175/?demo=1
```

The apps still run on demo data (`packages/demo-data`). They switch to the API module by module.

## 4. Check your work

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

CI runs the same steps on every pull request (`.github/workflows/ci.yml`). Database and API tests use an in-memory PGlite, so they need no services.

## Where things are

| Folder                        | What                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/api/src/modules/`       | API endpoints by area: `identity` (sign-in), `me`, `tenants` (Houses), `platform` (staff), `health` |
| `apps/api/src/security/`      | Guards (sign-in, House membership, capabilities, staff roles), idempotency, crypto, tokens          |
| `apps/api/src/common/`        | Validation and docs helpers, error format, request ids                                              |
| `apps/api/src/notifications/` | Email (Nodemailer) and SMS adapters                                                                 |
| `apps/api/src/*.test.ts`      | API tests, including the cross-tenant harness                                                       |
| `packages/db/migrations/`     | SQL migrations: the source of truth for tables, policies and constraints                            |
| `packages/db/src/`            | Typed schema, migration runner, `withContext`, seed                                                 |
| `packages/types/src/`         | Roles, capabilities and every API request/response schema                                           |

## Adding an endpoint

1. Add request/response schemas to `packages/types/src/api.ts` with `.meta({ id: 'Name' })`.
2. Add the route in the right `apps/api/src/modules/*` controller with `@ApiOperation`, `@DocBody`, `@DocResponse`.
3. House routes go under `v1/tenants/:tenantId` and declare `@RequireCapability(...)`. Creating things or moving money? Add `@Idempotent()`.
4. Use `Data.inTenant(req, tx => ...)` for queries, then `audit(...)` and `emit(...)` in the same transaction.
5. Run `pnpm --filter @stayvinci/api test`: the cross-tenant sweep picks your route up automatically.

See `docs/guides/DATABASE.md` before adding a table.
