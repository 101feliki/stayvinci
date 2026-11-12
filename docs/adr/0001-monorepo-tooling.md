# ADR 0001: Monorepo tooling

Date: 2026-11-09 · Status: accepted

## Context

CLAUDE.md fixes the stack: pnpm workspaces + Turborepo, strict TypeScript everywhere.

## Decision

- pnpm 12 workspaces, Turborepo 2 for task orchestration and caching.
- TypeScript **5.9.x**, not 7.x. TypeScript 7 (native compiler) is current, but NestJS decorator metadata and parts of the lint toolchain are not yet confirmed compatible. Revisit once NestJS and typescript-eslint officially support it.
- Shared presets live in `packages/config` (tsconfig `base`/`node`/`react`, ESLint flat config, Prettier).
- ESLint 10 flat config with typescript-eslint `strict`; `no-console` is an error to support the no-personal-data-in-logs rule.
- Husky + lint-staged on pre-commit; commitlint with Conventional Commits on commit-msg.
- `apps/guest-mobile` is not a workspace until P2.

## Consequences

Upgrading to TypeScript 7 is a single version bump plus a CI run once the ecosystem catches up.
