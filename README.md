# VFD Platform

SaaS platform for volunteer fire departments. Offline-first, NERIS-ready, NFPA-compliant.

## Quick start

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Install JS deps
pnpm install

# 3. Set up Python env
cd apps/api && uv sync && cd ../..

# 4. Copy env files
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local

# 5. Run migrations
pnpm db:migrate

# 6. Start both apps
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:8000 (docs at /docs)

## Stack

Next.js 14 (App Router) · FastAPI · PostgreSQL · SQLAlchemy async · Alembic · NextAuth · Dexie (IndexedDB) · Tailwind + shadcn/ui · Zustand · TanStack Query.

See [context.md](./context.md) for the full spec.
