# Infrastructure

`docker-compose.yml` starts PostgreSQL 16, Redis and Mailpit for local development. Ports bind to 127.0.0.1 only.

```sh
docker compose -f infra/docker-compose.yml up -d
```

- PostgreSQL: `postgres://stayvinci:stayvinci-local-only@127.0.0.1:5432/stayvinci` (an ordinary user, never a superuser, so row-level security applies).
- Redis: `redis://:redis-local-only@127.0.0.1:6379`
- Mailpit inbox: http://localhost:8025 (SMTP on 1025)

Override the local passwords in `infra/.env` (see `.env.example`). Hosting plan: Render (API, Postgres, Redis), Cloudflare Pages (apps), Cloudflare R2 and Stream (media).
