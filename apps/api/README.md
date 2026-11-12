# API (`apps/api`)

NestJS backend. Every endpoint is documented at **http://localhost:4000/docs** (Swagger) when running locally.

```sh
cp .env.example .env    # fill the three secrets
pnpm dev                # build, migrate, start on :4000
pnpm test               # API tests incl. the cross-tenant harness (in-memory database)
```

| Folder                 | What                                                                        |
| ---------------------- | --------------------------------------------------------------------------- |
| `src/modules/identity` | Sign-in: SMS codes, magic links, passwords, two-step verification, sessions |
| `src/modules/me`       | The signed-in person and their Houses                                       |
| `src/modules/tenants`  | One House: settings, team, guests, activity log                             |
| `src/modules/platform` | Stayvinci staff console endpoints                                           |
| `src/modules/health`   | Load-balancer checks                                                        |
| `src/security`         | Guards, idempotency, crypto, access tokens                                  |
| `src/common`           | Validation and docs helpers, error format, request ids                      |
| `src/notifications`    | Email (Nodemailer/SMTP) and SMS adapters                                    |

Security defaults and the reasons behind them: `docs/adr/0005-backend-foundations.md`. Developer guide: `docs/guides/GETTING_STARTED.md`.
