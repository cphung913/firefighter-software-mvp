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

## Deploying the Web App (Vercel)

This repo is a monorepo. The Next.js app is in `apps/web` and the FastAPI app is in `apps/api`.

1. Deploy `apps/web` to Vercel.
2. Deploy `apps/api` to a Python host (Render, Fly.io, Railway, etc.).
3. Point the web app to the deployed API URL.

### Vercel project settings

- Root Directory: `apps/web` (recommended)
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm build`

If your Vercel project uses repo root instead, root `pnpm build` now forwards to the web build.

### Required Vercel environment variables

- `NEXTAUTH_URL=https://<your-web-domain>`
- `NEXTAUTH_SECRET=<long-random-secret>`
- `NEXT_PUBLIC_API_URL=https://<your-api-domain>` (origin only, no `/api` or `/api/v1` suffix)

### Required API environment update

On the API deployment, set `CORS_ORIGINS` to include your Vercel domain(s), for example:

`CORS_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com`
