# ADR 0002: Business app frontend stack and mock-first build

Date: 2026-11-09 · Status: accepted

## Context

The owner asked to build the full House business web app (spec §14) before the API exists, so the product can be seen and shaped early. CLAUDE.md fixes React + Vite for `apps/business-web`; the UI libraries were not yet chosen. Brand direction was updated: Inter for all text, and Azure `#00AFF0` as an accent alongside Emerald, Champagne and Ivory.

## Decision

- **Styling:** Tailwind CSS v4 with design tokens in `packages/ui/src/theme.css` (`@theme`). `packages/ui` exports source (`.ts`/`.tsx`) directly; apps compile it.
- **Components:** small in-house set in `packages/ui` (buttons, form controls, cards, tables, tabs). Radix primitives for accessible dialogs, drawers and menus. Icons: lucide-react.
- **Routing:** React Router 7 (library mode). Booking drawer is URL-driven (`?booking=<id>`).
- **Server state:** TanStack Query. Every query key starts with the tenant ID so switching House refetches everything.
- **Mock API:** `apps/business-web/src/mock/api.ts` mirrors server rules (tenant scoping, capability checks, guest-contact omission, audit entries, idempotency key on booking create). It is replaced by the generated SDK (`packages/sdk`) when `apps/api` lands; pages call `api.*` only.
- **Charts:** hand-built SVG/HTML, single series, colour `#2a8a6a` validated for chroma and contrast.
- **Tailwind scanner fallback:** on machines where Windows Application Control blocks Tailwind's native `oxide` binary, `apps/business-web/tailwind-js-scanner.ts` feeds Tailwind's compiler from a JavaScript file scan. It activates only when the native scanner finds nothing; CI and other machines use the official `@tailwindcss/vite` plugin.
- **Dev shortcut:** `?demo=1` (and `&tenant=t_karibu`) skips sign-in, in dev builds only.

## Consequences

- The app is fully clickable now with realistic Kenyan demo data; no backend is needed to review UX.
- Contract drift is the main risk: when the API is built, its responses must match `src/mock/types.ts` or the types move to `packages/types` (Zod) and both sides import them. That move is the first step of API integration.
- The scanner fallback should be deleted once the native binary is allowed on all dev machines.
