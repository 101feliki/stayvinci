# @stayvinci/business-web

House business web app (spec §14), built with React + Vite. It currently runs on an in-browser mock API with demo data (see `docs/adr/0002-business-app-frontend.md`).

## Run

```sh
pnpm install
pnpm --filter @stayvinci/business-web dev
```

Open http://localhost:5173. Sign in with any number and any 6-digit codes, or skip sign-in with http://localhost:5173/today?demo=1 (dev only). Add `&tenant=t_karibu` to open the short-stay demo House.

## What's inside

| Area                                        | Path            |
| ------------------------------------------- | --------------- |
| Shell, navigation, sign-in, search (Ctrl K) | `src/app/`      |
| Pages, one folder per spec module           | `src/features/` |
| Mock API, seed data, domain types           | `src/mock/`     |
| Formatting, capabilities, state labels      | `src/lib/`      |

Demo tips: use the avatar menu → "Preview as role" to see what Front desk, Practitioner or Accountant can see (guest phone numbers disappear for non-owners). "Reset demo data" restores the seed.
