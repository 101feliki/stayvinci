# Stayvinci — project context for AI coding assistants

Read this file first, then `docs/SPEC.md` (the full product and system specification). The spec is the source of truth; if code and spec disagree, ask before changing either.

## What we are building

Stayvinci is a premium, discreet, multi-tenant booking and storefront platform, starting in Kenya.

- **Houses**: businesses (spas, lounges, salons, short-stay hosts). Each gets its own private, branded store.
- **Ateliers**: verified independent professionals (therapists, stylists, makeup artists).
- **Guests**: clients who use one app (Android, iOS, web) to enter any store by private code, link, QR or marketplace browsing, then book and pay.
- **Platform**: Stayvinci staff run everything from an internal console.

Core workflow (the spec follows this order):
join (plan, agreements, account) → connect own payments → verification → store setup → open the door (private code or listed) → guest gets app → finds the House → enters the store → books and pays → visits and returns → Stayvinci earns (subscription + marketplace fee).

## Non-negotiable rules

1. **Tenant isolation.** Every tenant-owned table has `tenant_id`. PostgreSQL row-level security enforces it, and every endpoint gets a cross-tenant test.
2. **Guest money goes to the tenant's own merchant accounts.** Stayvinci never holds guest funds. Tenant payment credentials are encrypted (envelope encryption) and only the payments module can decrypt them.
3. **No double bookings.** Enforced in the database (exclusion constraint on resource time ranges) plus holds with expiry; covered by concurrency tests.
4. **Idempotency.** Every booking and money-moving POST takes an idempotency key. Every provider callback is stored raw before processing.
5. **Discretion.** Guest contact fields are omitted from API responses unless the caller has `guest.contact.view`. Notifications are neutral by default (no service or store name on the lock screen). No guest personal data in logs or analytics.
6. **Attribution.** First touch per guest–tenant pair is permanent. Marketplace fee only on the first completed booking of a `marketplace`-attributed guest.
7. **No hard-coded prices, fees or country rules.** Plans, fee rules, tax and compliance rules live in configuration (`market`, `plan`, `fee_rule`). Pricing amounts are not decided yet.
8. **Money** is integer minor units + currency code. **Time** is UTC in storage, IANA time zone for display and slot generation.
9. **Audit log** for every privileged action and every money movement.

## Tech stack (decided)

| Part             | Choice                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Monorepo         | pnpm workspaces + Turborepo, TypeScript everywhere, strict mode                                |
| API              | NestJS modular monolith, REST + OpenAPI, Zod validation                                        |
| Database         | PostgreSQL 16 (RLS, exclusion constraints via `btree_gist`), Drizzle ORM with SQL migrations   |
| Cache/queues     | Redis; BullMQ workers                                                                          |
| Guest web        | Next.js (App Router)                                                                           |
| Business app     | React + Vite (web first); Tauri shell for Windows later; React Native for Android later        |
| Platform console | React + Vite, internal                                                                         |
| Mobile guest app | Expo (React Native), from phase P2                                                             |
| Media            | Cloudflare R2; Bunny Stream or Cloudflare Stream with signed URLs                              |
| Notifications    | WhatsApp Business API, SMS (Africa's Talking), email (Resend), push (FCM/APNs) behind adapters |
| Payments v1      | M-Pesa via Safaricom Daraja (per-tenant credentials); one card gateway in P2                   |
| Testing          | Vitest (unit), Supertest (API integration), Playwright (end to end)                            |
| Local dev        | Docker Compose: postgres, redis, mailpit                                                       |

## Repository layout

One repository for everything (apps, shared packages, infrastructure, docs). Open `stayvinci.code-workspace` in VS Code for a named view.

```
stayvinci/
  apps/                 Things that run
    api/                Backend API: NestJS modular monolith (modules mirror spec sections)
    guest-web/          Guest app on the web: stores, booking, wallet (Vite now, Next.js later)
    business-web/       Business app for Houses and Ateliers (React + Vite)
    admin-console/      Stayvinci staff console (React + Vite)
    guest-mobile/       Guest app for Android and iOS (Expo, from phase P2)
  packages/             Shared code used by the apps
    db/                 Database: Drizzle schema, SQL migrations, RLS policies, seed
    types/              Shared Zod schemas and TypeScript types (API contracts)
    sdk/                Typed API client generated from OpenAPI
    ui/                 Design system: tokens, components, logo
    demo-data/          Prototype data and the store design engine (until the API is wired in)
    config/             ESLint, TypeScript and Prettier presets
  infra/                Docker Compose for local services, environment examples
  tools/                Developer scripts (brand asset builder, browser QA driver)
  docs/                 SPEC.md, decision records (docs/adr), developer guides (docs/guides)
  brand/                Logos and brand documents
```

API modules: identity, tenants, verification, storefront, catalogue, access, availability, booking, payments, wallet, attribution, notifications, moderation, billing, reporting, audit, markets.

## Naming and language

- Use **House**, **Atelier**, **Guest**, **Store** in code and UI. Never "user" for guests in UI copy; "customer" is never used.
- Database tables snake_case, plural only where the spec uses plural; TypeScript camelCase; enums as string literals matching the spec (e.g. booking states `held`, `pending_payment`, `requested`, `confirmed`, `checked_in`, `completed`, `cancelled_by_guest`, `cancelled_by_tenant`, `no_show`, `disputed`).
- Domain events named `entity.past_tense` (e.g. `booking.confirmed`), published through an outbox table.

## Brand (for UI work)

Theme: Emerald `#092720`, Champagne gold `#C8A96A`, Ivory `#F5F1E8`, Charcoal `#1C1C1E`, Deep plum `#3B2A3F`. Azure `#00AFF0` as the interactive accent (links, focus rings, selected states, badges; use azure-700 `#00739F` for text on light backgrounds). Inter for all text, headings included (decided 2026-11-09, replaces the earlier serif-heading plan). Calm, minimal, premium. Tokens live in `packages/ui/src/theme.css`. Large emerald surfaces use `bg-emerald-sheen` (a soft gold reflection rising from the left edge); every card has a slim gold line on its left edge (built into `shadow-card`). No tagline. Logos in `brand/logo/` (source: `stayvinci-logo-figma.svg`): the full logo (`Logo` component, transparent, `on="dark"` or `on="light"`) is the standard; small places such as cards, headers, the favicon and the QR centre use the SV mark (`LogoMark`).

## Build phases

P0 Foundations → P1 Spa MVP → P2 Pilot hardening → P3 Marketplace → P4 Short-stay → P5 Ateliers → P6 Expansion. Details and exit criteria in `docs/SPEC.md` section 23. **We are in P0.** Status (2026-11-11): tasks 1–9 have a first full pass (database with RLS, API with sign-in, 2FA, roles, audit, outbox, idempotency, cross-tenant harness, Swagger docs, CI); task 10 shells exist on demo data and still need wiring to the API. See ADR 0005 and `docs/guides/`.

### P0 task list

1. Scaffold the monorepo (pnpm, Turborepo, TS configs, ESLint, Prettier, Husky, commitlint).
2. `infra/docker-compose.yml` with PostgreSQL 16, Redis, Mailpit; `.env.example` files.
3. `packages/db`: Drizzle setup, first migrations: `market`, `user`, `tenant`, `membership`, `audit_log`, `outbox_event`; enable `btree_gist`; RLS policies on tenant tables using `current_setting('app.tenant_id')`.
4. `apps/api`: NestJS bootstrap, config module, health check, OpenAPI, Zod validation pipe, error format, request context that sets `app.tenant_id` per request, idempotency-key middleware.
5. Identity: phone OTP sign-in (pluggable SMS adapter with a console/dev adapter), email verification, sessions with refresh tokens, 2FA (TOTP) for owners and staff.
6. Roles and capabilities: role bundles + per-person overrides, a `@RequireCapability()` guard, field-level omission for guest contact data.
7. Audit log service and outbox publisher; BullMQ worker skeleton.
8. Cross-tenant security test harness that runs against every registered route.
9. CI (GitHub Actions): install, lint, typecheck, test, build.
10. `apps/business-web` and `apps/admin-console` shells with sign-in and tenant switcher; `packages/ui` with theme tokens.

Exit criteria: cross-tenant tests pass; an owner and a platform staff user can sign in with 2FA; CI is green.

## How to work in this repo

- Work in small, reviewable steps; one module or feature per change.
- Before writing code for a feature, restate which spec section it implements.
- Write tests with the code: domain logic unit tests, API integration tests, and a cross-tenant test for every new endpoint.
- Record significant technical decisions as short ADRs in `docs/adr/`.
- Never commit secrets; use `.env` files ignored by git.
- When something in the spec is ambiguous or missing, list the question instead of guessing.
