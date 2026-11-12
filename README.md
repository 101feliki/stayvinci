# Stayvinci

Premium, discreet, multi-tenant booking and storefront platform.

## Run it

Needs Node 22+ and pnpm (`corepack enable`).

```sh
pnpm install
cp apps/api/.env.example apps/api/.env      # fill JWT_SECRET, OTP_PEPPER, DATA_ENCRYPTION_KEY
pnpm --filter @stayvinci/api dev            # API on http://localhost:4000, Swagger at /docs
pnpm --filter @stayvinci/business-web dev   # http://localhost:5173
pnpm --filter @stayvinci/guest-web dev      # http://localhost:5174
pnpm --filter @stayvinci/admin-console dev  # http://localhost:5175
```

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`; the encryption key needs 32 bytes in base64.

The API uses PGlite (PostgreSQL in WebAssembly) by default, so no database install is needed. For PostgreSQL 16, Redis and Mailpit run `docker compose -f infra/docker-compose.yml up -d` and set `DATABASE_URL` in `apps/api/.env`. With PGlite, stop the API before running `pnpm --filter @stayvinci/db migrate` or `seed`.

## Where things are

| Folder               | What                                                         |
| -------------------- | ------------------------------------------------------------ |
| `apps/api`           | Backend API (NestJS)                                         |
| `apps/business-web`  | Business app for Houses and their staff                      |
| `apps/guest-web`     | Guest app                                                    |
| `apps/admin-console` | Stayvinci staff console                                      |
| `apps/guest-mobile`  | Mobile guest app (Expo), later                               |
| `packages/db`        | Database migrations, row-level security, seed                |
| `packages/types`     | Shared request/response schemas and roles                    |
| `packages/ui`        | Design system                                                |
| `packages/demo-data` | Sample data used by the apps until they are wired to the API |
| `packages/sdk`       | Typed API client                                             |
| `packages/config`    | TypeScript, ESLint and Prettier presets                      |
| `infra`              | Docker Compose and example environment files                 |

## Checks

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
