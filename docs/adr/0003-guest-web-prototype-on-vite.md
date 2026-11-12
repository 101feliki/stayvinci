# ADR 0003: Guest web prototype on Vite (Next.js port later)

Date: 2026-11-09 · Status: accepted (temporary)

## Context

CLAUDE.md fixes Next.js (App Router) for `apps/guest-web`. The owner asked to see the guest experience now. On the main development machine, Windows Application Control blocks the native binaries Next.js needs (`@next/swc-win32-x64-msvc`) and Tailwind's native scanner, so a Next.js dev server cannot run reliably there.

## Decision

- Build the guest experience in `apps/guest-web` on React + Vite with the same stack as the business app (ADR 0002), on a guest-side mock API (`src/mock/api.ts`).
- Demo data is shared through a new internal package, `@stayvinci/demo-data` (types, seed, formatting), used by both prototype apps.
- Screens are plain React components with no Vite-specific APIs, so they can move into Next.js App Router pages later (routes map 1:1: `/`, `/discover`, `/s/[handle]/…`, `/i/[code]`, `/bookings`, `/wallet`, `/profile`).

## Consequences

- Public store pages are client-rendered for now, so no SEO yet. The marketplace listing pages (spec §6) need server rendering before P3.
- Port to Next.js once it runs on the dev machines (signed binaries allowed, or development in WSL/a dev container) or in CI. This ADR is then superseded.
- `@stayvinci/demo-data` is deleted when `apps/api` and `packages/sdk` replace the mocks; its types move to `packages/types`.
