# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SaaS platform for volunteer fire departments (VFDs). Offline-first, NERIS-ready, NFPA-compliant incident reporting. Monorepo with a Next.js 14 frontend and FastAPI backend.

## Commands

### Development

```bash
# Start Postgres + Redis (required before running the API)
pnpm db:up

# Run both web and API together
pnpm dev

# Run individually
pnpm dev:web       # Next.js on http://localhost:3000
pnpm dev:api       # FastAPI on http://localhost:8000 (docs at /docs)
```

### Building & Linting

```bash
pnpm build          # builds apps/web
pnpm --filter web lint
```

### Database (Alembic)

```bash
pnpm db:migrate                          # apply migrations
pnpm db:revision -- -m "description"    # autogenerate new migration
pnpm db:down                             # stop containers
```

### Python environment (API)

```bash
cd apps/api && uv sync    # install dependencies
```

## Architecture

### Monorepo layout

- `apps/web` — Next.js 14 (App Router)
- `apps/api` — FastAPI + SQLAlchemy async + Alembic
- `packages/shared-types` — Zod schemas shared between web and API (`@vfd/shared-types`)

### Frontend (apps/web)

**Route groups:**
- `(auth)` — login / signup pages
- `(dashboard)` — main app: dashboard, incidents, settings
- `(mobile)` — voice session UI for mobile devices

**API calls:** All backend requests go through the Next.js proxy at `/api/proxy/[...path]`, which forwards to `NEXT_PUBLIC_API_URL`. Client code uses `apiFetch()` from `lib/api/client.ts`, which automatically attaches the NextAuth JWT as a Bearer token.

**Offline-first sync:**
- Dexie (IndexedDB) is the local database (`lib/db/schema.ts`)
- `lib/sync/engine.ts` runs push/pull cycles against `/api/v1/sync`
- `SyncMeta` fields (`_sync_status`, `_dirty_fields`, `server_id`) track record state
- Conflict records store the server's snapshot in `_conflict_server_snapshot`
- Zustand store (`store/sync-store.ts`) exposes sync status to the UI

**State management:** Zustand for global/UI state; TanStack Query for server-fetched data.

### Backend (apps/api)

All routes are prefixed `/api/v1` (defined in `routers/__init__.py`).

**Auth:** JWT tokens encode `sub` (user ID), `dept` (department ID), and `role`. FastAPI dependencies in `core/deps.py` (`get_current_user`, `get_current_department`, `require_admin`) validate tokens and load DB objects on every request.

**Routers:** `auth`, `assets`, `imports`, `incidents`, `roster`, `sync`, `voice`, `voice_logs`, `health`

**Voice sessions:** Uses Anthropic Claude (`claude-sonnet-4-6`) for extracting structured incident data from audio logs. Session join codes are 6-character alphanumeric (no O/0/I/1 ambiguity).

### Environment variables

**`apps/api/.env`**
```
DATABASE_URL=postgresql+asyncpg://vfd:vfd@localhost:5432/vfd
SECRET_KEY=...
CORS_ORIGINS=http://localhost:3000
ANTHROPIC_API_KEY=...
AI_MODEL=claude-sonnet-4-6
```

**`apps/web/.env.local`**
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
NEXT_PUBLIC_API_URL=http://localhost:8000   # origin only, no /api or /api/v1 suffix
```
