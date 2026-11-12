# Admin console (`apps/admin-console`)

Where Stayvinci staff run the platform (spec section 13, ADR 0004). React + Vite on mock data until `apps/api` exists.

```sh
pnpm --filter @stayvinci/admin-console dev   # http://localhost:5175
```

Open http://localhost:5175/?demo=1 to skip sign-in (dev only). Otherwise sign in with `felix@stayvinci.com`, any 8-character password and any 6 digits.

## What's where

| Folder                      | Screens                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/features/overview`     | Overview: what needs attention, money paid to Houses, Houses by stage                                                |
| `src/features/houses`       | Houses list, Add a House (invite), House detail (plan & features, M-Pesa, payments, growth, notes, **Manage store**) |
| `src/features/onboarding`   | Onboarding board: invited → onboarding → verification → ready → live                                                 |
| `src/features/transactions` | Every payment across Houses, M-Pesa connection health, CSV export                                                    |
| `src/features/insights`     | Growth insights: is Stayvinci growing revenue for each House?                                                        |
| `src/features/plans`        | Which features each plan includes                                                                                    |
| `src/features/releases`     | Feature releases: internal → beta → released, with test Houses                                                       |
| `src/features/marketplace`  | Listed and featured Houses                                                                                           |
| `src/features/billing`      | Subscriptions, invoices, coupons, grace periods                                                                      |
| `src/features/staff`        | Console staff and roles                                                                                              |
| `src/features/activity`     | Activity log of every change                                                                                         |
| `src/mock/api.ts`           | Stand-in API with role checks and audit entries                                                                      |
| `src/app`                   | Sign-in, sidebar and routes                                                                                          |

## Demo tips

- **Manage store** on Serenity or Karibu opens the business app (http://localhost:5173) with full control and a gold "Stayvinci support" banner. Changes show in that House's activity log.
- Use the user menu (top right) to preview the console as Admin, Finance or Marketing.
- Data is demo data and resets on reload.
