# VFD Platform — Claude Code Context

## Project Overview

You are building the MVP for a SaaS platform targeting **volunteer fire departments (VFDs)** — an underserved market dominated by legacy software. The product's core value props are:

1. **Zero training required** — UI must be "Chief-proof" and consumer-grade
2. **Offline-first** — crews operate in dead zones; the app must work fully offline
3. **Self-service onboarding** — eliminates the 90–120 day consultant-led migration of legacy vendors
4. **Regulatory compliance** — NFPA 1851/1852, NERIS 2026, DEA chain-of-custody

This is a greenfield project. Build the full MVP skeleton across all four functional areas tonight.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Backend | FastAPI (Python 3.11+) |
| Database | PostgreSQL (primary) + SQLite (local offline cache) |
| ORM | SQLAlchemy (async) + Alembic (migrations) |
| Auth | NextAuth.js (frontend) + JWT (FastAPI) |
| Offline Sync | IndexedDB (browser) with CRDT-based conflict resolution |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand |
| API Client | TanStack Query (React Query) |
| Package Mgr | pnpm (frontend), uv (backend) |

---

## Monorepo Structure

```
vfd-platform/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── app/
│   │   │   ├── (auth)/       # login, signup
│   │   │   ├── (dashboard)/  # main app shell
│   │   │   │   ├── dashboard/
│   │   │   │   ├── checklists/
│   │   │   │   ├── incidents/
│   │   │   │   ├── assets/
│   │   │   │   └── settings/
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/           # shadcn primitives
│   │   │   ├── checklists/
│   │   │   ├── incidents/
│   │   │   ├── assets/
│   │   │   └── sync/
│   │   ├── lib/
│   │   │   ├── db/           # IndexedDB + Dexie.js
│   │   │   ├── sync/         # CRDT sync engine
│   │   │   └── api/          # API client helpers
│   │   └── store/            # Zustand stores
│   └── api/                  # FastAPI backend
│       ├── main.py
│       ├── routers/
│       │   ├── auth.py
│       │   ├── departments.py
│       │   ├── incidents.py
│       │   ├── checklists.py
│       │   ├── assets.py
│       │   └── sync.py
│       ├── models/           # SQLAlchemy models
│       ├── schemas/          # Pydantic schemas
│       ├── services/         # Business logic
│       └── migrations/       # Alembic
├── packages/
│   └── shared-types/         # Shared TypeScript types + Zod schemas
└── docker-compose.yml
```

---

## MVP Feature Scope

### 1. Migration Engine ("One-Click Importer")

**Goal**: Eliminate the 90–120 day onboarding friction of legacy vendors.

- **File upload UI**: Drag-and-drop zone accepts `.csv`, `.xlsx`, `.pdf`
- **Auto-detection**: Identify column mappings from messy/inconsistent headers (use fuzzy matching or an LLM call to normalize headers → internal schema)
- **Preview step**: Show the Chief a diff table before committing import
- **Conflict resolution UI**: Flag duplicate records and let user resolve
- **Backend**: FastAPI `/api/import` endpoint handles parsing; `pandas` + `pdfplumber` for extraction
- **Schemas to import into**: apparatus records, personnel roster, PPE inventory, SCBA logs, past incident reports

### 2. Offline-First Architecture

**Goal**: Full functionality with zero connectivity. Sync on reconnect.

- **Local DB**: Use [Dexie.js](https://dexie.org/) (IndexedDB wrapper) for all local writes
- **Sync layer**: Every record gets a `vector_clock` (or Lamport timestamp) and `last_modified_by` field
- **CRDT strategy**: Last-Write-Wins with per-field granularity for simple records; use `automerge` or manual merge logic for checklists
- **Sync endpoint**: `POST /api/sync` accepts a batch of local mutations with vector clocks; server returns authoritative state + any conflicts
- **Conflict resolution**: If two users edited the same checklist item offline, surface a UI to resolve — never silently drop data
- **Sync status indicator**: Always-visible indicator in the nav (🟢 Synced / 🟡 Syncing / 🔴 Offline — X changes pending)
- **Service Worker**: Register a service worker to cache the app shell and API responses for true offline mode

### 3. NERIS-Ready Incident Logging

**Goal**: Meet the 2026 federal NERIS mandate with a mobile-optimized form.

- **Form fields** (NERIS baseline):
  - Incident number (auto-generated)
  - Incident type (dropdown, NERIS taxonomy)
  - Location (address + lat/lng — use device GPS on mobile)
  - Alarm time, dispatch time, en route time, on scene time, controlled time, cleared time
  - Units responding (multi-select from apparatus list)
  - Personnel on scene (multi-select from roster)
  - Casualty information (civilian + FF)
  - Narrative (free text)
  - Exposures
  - Actions taken (NERIS codes)
  - Property use (NERIS codes)
- **Architecture note**: Build the DB schema with a `raw_data JSONB` column so FEMA field changes don't require migrations — validate the known fields, store the rest in JSONB
- **Mobile UX**: Large tap targets, minimal scrolling, autosave every 30s to IndexedDB
- **Submission**: Works offline; queues for sync; generates a PDF export

### 4. Asset Management

**Goal**: NFPA 1851/1852-compliant cradle-to-grave tracking.

#### Apparatus (Trucks)
- Fields: unit ID, type, year, make, model, VIN, service status, mileage, pump test dates
- Maintenance log with date, type, technician, notes
- Out-of-service tracking with reason + expected return

#### PPE (NFPA 1851)
- Per-garment tracking: helmet, coat, pants, gloves, hood, boots
- Fields: assigned firefighter, manufacture date, purchase date, last inspection, retire date
- Inspection log (Advanced Inspection, Verification, Cleaning)
- Retirement workflow

#### SCBA (NFPA 1852)
- Fields: serial number, manufacturer, cylinder hydro test date, regulator service date, assigned user
- Flow test log
- Cylinder pressure log

#### EMS Bags / DEA Compliance
- Bag inventory with contents list
- **DEA chain-of-custody**: Schedule II narcotics require dual-signature. Build a digital sign-off flow:
  - Medication administration or disposal event
  - Two authorized users must sign (biometric prompt on mobile, or typed signature + badge number on desktop)
  - Immutable audit log — records are append-only, never editable

---

## Database Schema (Key Tables)

```sql
-- Core multi-tenancy
departments (id, name, fdid, state, subscription_tier, created_at)
users (id, department_id, name, email, role, badge_number, created_at)

-- Sync infrastructure
sync_records (id, department_id, table_name, record_id, vector_clock JSONB,
              last_modified_by, last_modified_at, is_deleted)

-- Incidents
incidents (id, department_id, incident_number, incident_type, location_address,
           location_lat, location_lng, alarm_time, on_scene_time, cleared_time,
           narrative, raw_data JSONB, sync_status, created_by, created_at)

-- Assets
apparatus (id, department_id, unit_id, type, year, make, model, vin,
           service_status, mileage, created_at)
ppe_items (id, department_id, item_type, serial_number, assigned_to,
           manufacture_date, purchase_date, last_inspection, retired_at)
scba_units (id, department_id, serial_number, manufacturer, assigned_to,
            cylinder_hydro_date, regulator_service_date)

-- Checklists
checklist_templates (id, department_id, name, type, items JSONB, created_at)
checklist_completions (id, template_id, apparatus_id, completed_by, completed_at,
                       responses JSONB, sync_status, local_id)

-- DEA / Narcotics
narcotics_log (id, department_id, bag_id, event_type, medication, quantity,
               witness_1_id, witness_2_id, signatures JSONB, created_at)
-- NOTE: narcotics_log is append-only. Never UPDATE or DELETE rows.
```

---

## API Design

All endpoints under `/api/v1/`. FastAPI with async SQLAlchemy.

```
POST   /api/v1/auth/login
POST   /api/v1/auth/signup

POST   /api/v1/import/upload          # accepts multipart file
POST   /api/v1/import/preview         # returns mapped fields for review
POST   /api/v1/import/commit          # writes preview to DB

GET    /api/v1/incidents              # paginated list
POST   /api/v1/incidents              # create (or upsert by local_id for offline sync)
GET    /api/v1/incidents/{id}
PATCH  /api/v1/incidents/{id}

GET    /api/v1/assets/apparatus
POST   /api/v1/assets/apparatus
GET    /api/v1/assets/ppe
GET    /api/v1/assets/scba

GET    /api/v1/checklists/templates
POST   /api/v1/checklists/complete    # upsert by local_id

POST   /api/v1/sync/push              # client pushes local mutations
GET    /api/v1/sync/pull              # client pulls server changes since last_sync_at

GET    /api/v1/narcotics/log
POST   /api/v1/narcotics/event        # dual-signature required
```

---

## Sync Protocol (Offline → Cloud)

When the device reconnects:

1. Client calls `GET /api/v1/sync/pull?since={last_sync_timestamp}` → gets server-side changes
2. Client calls `POST /api/v1/sync/push` with array of local mutations:
   ```json
   {
     "mutations": [
       {
         "table": "checklist_completions",
         "local_id": "uuid-v4",
         "operation": "upsert",
         "data": { ... },
         "vector_clock": { "device_id": 3, "user_id": 1 },
         "client_timestamp": "2025-04-26T14:32:00Z"
       }
     ]
   }
   ```
3. Server applies LWW merge, returns conflicts array
4. Client resolves conflicts via UI if any exist; otherwise marks records as synced

---

## UX / Design Constraints

- **Target user**: Rural fire chiefs, often 50+, not tech-savvy. Design must be opinionated and simple.
- **Mobile-first**: Most daily use happens on phones at the station or on scene
- **Large tap targets**: Minimum 44px touch targets everywhere
- **Offline indicator**: Persistent, always visible — never hide sync status
- **No jargon**: Button labels should be plain English ("Log Incident", not "Create NERIS Record")
- **Color system**: Use red as primary (fire/urgency), neutral grays as base
- **Font**: Something legible and authoritative — not playful
- **Checklist UX**: Big checkboxes, swipe-to-complete on mobile, clear completion state

---

## Build Order for Tonight

Work through these phases in order. Each phase should be independently runnable.

### Phase 1 — Scaffolding (30 min)
- [ ] Init monorepo with `pnpm workspaces`
- [ ] `create-next-app` in `apps/web` with TypeScript + Tailwind + App Router
- [ ] FastAPI app in `apps/api` with `uv`, `main.py`, health check route
- [ ] `docker-compose.yml` with postgres + redis services
- [ ] Alembic init + first migration (departments, users tables)
- [ ] `.env.example` with all required vars

### Phase 2 — Auth (45 min)
- [ ] NextAuth.js with credentials provider (email + password)
- [ ] FastAPI JWT middleware
- [ ] Login + signup pages
- [ ] Department context in JWT claims
- [ ] Protected route middleware in Next.js

### Phase 3 — App Shell + Navigation (30 min)
- [ ] Sidebar nav: Dashboard, Checklists, Incidents, Assets, Settings
- [ ] Sync status indicator component (top bar)
- [ ] Mobile bottom tab bar
- [ ] Basic dashboard page with stats cards (placeholder data)

### Phase 4 — Offline Infrastructure (60 min)
- [ ] Dexie.js setup — define IndexedDB schema mirroring server tables
- [ ] Zustand sync store (tracks online status, pending mutations count, last sync time)
- [ ] Service worker registration
- [ ] `useSyncEngine` hook — handles push/pull on reconnect
- [ ] Sync API endpoints (`/sync/push`, `/sync/pull`) on FastAPI

### Phase 5 — Checklists (45 min)
- [ ] Checklist template model + seed data (daily apparatus check)
- [ ] Checklist completion page — mobile-optimized, large checkboxes
- [ ] Writes to IndexedDB first, queues sync
- [ ] Completion history list

### Phase 6 — Incident Logging (45 min)
- [ ] NERIS incident form (all required fields)
- [ ] GPS location capture on mobile
- [ ] Autosave to IndexedDB every 30s
- [ ] Incident list page with status badges

### Phase 7 — Asset Management (45 min)
- [ ] Apparatus list + detail page
- [ ] PPE inventory table with inspection status
- [ ] SCBA log with hydro test dates
- [ ] Color-coded expiry warnings (red = overdue, yellow = due within 30 days)

### Phase 8 — Migration Engine (60 min)
- [ ] File upload UI (drag-and-drop, CSV/XLSX/PDF)
- [ ] FastAPI parser (pandas + pdfplumber)
- [ ] Header normalization (fuzzy match to internal schema)
- [ ] Preview diff table in UI
- [ ] Commit endpoint

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

---

## Key Dependencies

### Frontend (`apps/web`)
```json
{
  "next": "14",
  "next-auth": "^4",
  "dexie": "^3",
  "dexie-react-hooks": "^1",
  "zustand": "^4",
  "@tanstack/react-query": "^5",
  "tailwindcss": "^3",
  "zod": "^3",
  "react-hook-form": "^7",
  "@hookform/resolvers": "^3"
}
```

### Backend (`apps/api`)
```
fastapi
uvicorn[standard]
sqlalchemy[asyncio]
asyncpg
alembic
python-jose[cryptography]
passlib[bcrypt]
python-multipart
pandas
openpyxl
pdfplumber
fuzzywuzzy
python-levenshtein
pydantic-settings
```

---

## Notes for Claude Code

- **Start with Phase 1 and work linearly** — don't jump ahead
- **Seed data matters**: include realistic VFD data (apparatus names, NERIS incident types, PPE item types) so the UI looks real from day one
- **CRDT conflict resolution**: keep it simple for MVP — LWW (Last Write Wins) per field with `updated_at` as the tiebreaker; flag true conflicts for manual resolution rather than auto-resolving
- **DEA narcotics log is append-only**: never generate UPDATE or DELETE queries against `narcotics_log`; enforce this at the DB level with a trigger if possible
- **NERIS schema flexibility**: always use a `raw_data JSONB` column on incidents so FEMA field changes don't require schema migrations
- **Don't over-engineer auth**: credentials provider is fine for MVP; no OAuth needed yet
- **Error states matter**: every page needs a loading state, an error state, and an offline state — don't leave these as TODO
