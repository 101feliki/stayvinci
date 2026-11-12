# Stayvinci

Premium, discreet, multi-tenant booking and storefront platform. Start with `CLAUDE.md`, then `docs/SPEC.md`.

New here? Start with **`docs/guides/GETTING_STARTED.md`**.

## Where things are

Tip: open `stayvinci.code-workspace` in VS Code (File > Open Workspace from File...) to see these as named sections.

| Folder               | In plain words                                                                                | Runs at               |
| -------------------- | --------------------------------------------------------------------------------------------- | --------------------- |
| `apps/business-web`  | Business app: what Houses and their staff use                                                 | http://localhost:5173 |
| `apps/guest-web`     | Guest app: what clients see (Vite for now, see ADR 0003)                                      | http://localhost:5174 |
| `apps/admin-console` | Admin console: Stayvinci staff run the platform                                               | http://localhost:5175 |
| `apps/api`           | Backend API (NestJS). Swagger docs at `/docs`                                                 | http://localhost:4000 |
| `apps/guest-mobile`  | Mobile guest app (Expo), from phase P2                                                        |                       |
| `packages/ui`        | Design system: colours, buttons, cards, logo                                                  |                       |
| `packages/demo-data` | Sample Houses, guests and bookings used until the API exists                                  |                       |
| `packages/db`        | Database schema, migrations, row-level security                                               |                       |
| `packages/types`     | Shared data shapes (Zod)                                                                      |                       |
| `packages/sdk`       | Typed API client for the apps                                                                 |                       |
| `packages/config`    | TypeScript, ESLint and Prettier presets                                                       |                       |
| `brand`              | Logos (`brand/logo`) and brand documents                                                      |                       |
| `tools`              | Developer scripts: logo builder, browser QA driver                                            |                       |
| `docs`               | `SPEC.md` (the product spec), decision records (`docs/adr`), developer guides (`docs/guides`) |                       |
| `infra`              | Docker Compose and example environment files                                                  |                       |

Inside each app, code is grouped by screen: `src/features/<area>/` (for example `features/bookings`), with shared pieces in `src/components`, app-wide setup in `src/app`, and the stand-in API in `src/mock`.

## Commands

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
