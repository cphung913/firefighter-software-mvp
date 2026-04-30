# CLAUDE.md — VFD Platform

## What This Is

MVP SaaS platform for volunteer fire departments (VFDs). Full context lives in [context.md](context.md).

**Core value props**: zero training, offline-first, self-service onboarding, regulatory compliance (NFPA 1851/1852, NERIS 2026, DEA chain-of-custody).

**Success metrics**: 65% reduction in after-call documentation time, 100% ISO/state audit compliance.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Backend | FastAPI (Python 3.11+, uv) |
| Database | PostgreSQL + SQLite (offline cache) |
| ORM | SQLAlchemy (async) + Alembic |
| Auth | NextAuth.js + JWT (FastAPI) |
| Offline | Dexie.js (IndexedDB) + CRDT sync |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand |
| API Client | TanStack Query (React Query) |
| Package Mgr | pnpm (frontend), uv (backend) |

---

## Monorepo Layout

```
apps/web/          # Next.js frontend
apps/api/          # FastAPI backend
packages/shared-types/  # Shared TS types + Zod schemas
```

### Key frontend paths
- `app/(auth)/` — login, signup
- `app/(dashboard)/` — dashboard, checklists, incidents, assets, settings
- `app/api/proxy/[...path]/route.ts` — Next.js → FastAPI proxy
- `store/sync-store.ts` — Zustand sync state
- `public/sw.js` — service worker

### Key backend paths
- `routers/` — auth, health, incidents, checklists, assets, imports, sync
- `models/` — SQLAlchemy models (department, user, incident, checklist, apparatus, ppe, scba, sync_record)
- `schemas/` — Pydantic schemas
- `services/` — auth, assets, sync
- `core/` — config, db, deps, security

---

## Feature Modules

1. **Mobile Voice Log** — hands-free dictation with VAD noise suppression (filter 100–200 Hz diesel, 700–1200 Hz siren); transcription queued offline
2. **Station Dashboard** — apparatus status, certification expiry indicators, pinned memos, stats cards
3. **NERIS Reporting** — full 2026 federal incident form; `raw_data JSONB` column for FEMA field flexibility; PDF export; offline autosave every 30s
4. **Digital Handover** — shift logs with required incoming-officer sign-off; full-text search
5. **Asset Registry** — apparatus, PPE (NFPA 1851), SCBA (NFPA 1852), EMS/DEA compliance
6. **Offline-First Sync** — Dexie.js IndexedDB, LWW CRDT, vector clocks, service worker
7. **Migration Engine** — drag-and-drop CSV/XLSX/PDF import with fuzzy header mapping and preview

**No marketplace or vendor portal** — those features are deferred; do not build or stub them.

---

## Current Build Status

### MVP Features — Complete
✅ **Offline-first sync engine** — Dexie.js (v6 schema), push/pull endpoints, LWW conflict resolution, sync status UI  
✅ **Voice capture** — Recording UI, VAD (diesel/siren filters), Web Speech API transcription, offline audio queue  
✅ **AI coagulation** — Claude Sonnet 4.6 extraction with prompt caching, NERIS field extraction, confidence scores  
✅ **NERIS incident form** — All 15 fields (incident type, location, timeline, casualties, narrative, actions, property use), autosave 30s, offline-first mutations  
✅ **Station dashboard** — Apparatus status cards (available/responding/OOS), tap-to-cycle, optimistic UI, offline fallback  

### Supporting Infrastructure — Complete
✅ Monorepo scaffold (pnpm workspaces), Next.js 14 + FastAPI + PostgreSQL  
✅ Authentication — NextAuth.js credentials + JWT (FastAPI), multi-tenancy by department  
✅ Database — SQLAlchemy async models, Alembic migrations, PostgreSQL with timezone-aware timestamps  
✅ UI/UX — shadcn/ui, Tailwind CSS, 44px+ touch targets, loading/error/offline states on all pages  
✅ Settings — CSV/XLSX/PDF import with header mapping UI, preview diff table, manual add modals (personnel + apparatus)  
✅ Conflict resolution — Side-by-side diff UI, "keep mine" vs "server version" buttons  
✅ API — All routers wired: auth, incidents, assets, voice-sessions, sync, imports  
✅ Export — PDF incident printing with NERIS-compliant JSON serialization  

### Not Yet Built
- Digital handover / shift log UI + sign-off flow (out of MVP scope)
- DEA dual-signature chain-of-custody (out of MVP scope)
- Certification expiry tracking / stat cards (v2)
- Full-text search for shift logs (v2)

---

## Hard Rules

### Data integrity
- **`narcotics_log` is append-only** — never generate `UPDATE` or `DELETE` against it; enforce with a DB trigger
- **`raw_data JSONB`** must exist on `incidents` — never remove it; FEMA field changes must not require migrations
- **Shift log sign-offs** require the incoming officer's authenticated session — no anonymous sign-offs
- **DEA events** require two distinct authenticated users to sign before the record is persisted

### Sync / offline
- Every synced record needs `vector_clock JSONB`, `last_modified_by`, and `last_modified_at`
- LWW (Last Write Wins) per field with `updated_at` as tiebreaker
- Surface UI for conflicts — never silently drop data
- Sync status indicator must always be visible; never hide it

### UX
- 44px minimum touch targets everywhere
- Every page needs loading, error, and offline states — not TODO
- Plain English labels: "Log Incident" not "Create NERIS Record"
- No jargon; UI must be usable by a 50+ year-old rural fire chief with no training

### Architecture
- Credentials auth only — no OAuth for MVP
- No marketplace, vendor portal, or cooperative pricing features
- Data export must produce valid NERIS-compliant JSON

---

## API Conventions

All endpoints: `POST /api/v1/...` — FastAPI async, authenticated via JWT bearer token.

Offline-created records use `local_id` (UUID v4) for upsert idempotency.

Sync push payload shape:
```json
{
  "mutations": [{
    "table": "checklist_completions",
    "local_id": "uuid-v4",
    "operation": "upsert",
    "data": {},
    "vector_clock": { "device_id": 3, "user_id": 1 },
    "client_timestamp": "2026-04-28T14:32:00Z"
  }]
}
```

---

## Infrastructure Notes

- **Self-hostable** open-source core; managed hosting targets AWS GovCloud (CJIS/HIPAA)
- **Data portability**: one-click full export as NERIS/JSON; departments own their data
- All data encrypted at rest and in transit in managed hosting

---

## Environment Variables

```bash
# apps/api/.env
DATABASE_URL=postgresql+asyncpg://vfd:vfd@localhost:5432/vfd
SECRET_KEY=changeme
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# apps/web/.env.local
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=changeme
NEXT_PUBLIC_API_URL=http://localhost:8000
```
