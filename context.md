# VFD Platform — Claude Code Context

## Build Status (Updated 2026-04-29)

**MVP Status: Feature-complete.** All five core features are implemented and functional:
- ✅ Offline-first sync engine (Dexie.js + push/pull endpoints + conflict resolution)
- ✅ Voice capture with VAD and transcription (Web Speech API + offline queue)
- ✅ AI coagulation (Claude Sonnet 4.6 with prompt caching)
- ✅ NERIS incident form (all 15 fields, 30s autosave, offline-first)
- ✅ Station dashboard (apparatus status, tap-to-cycle service status)
- ✅ Settings / import engine (CSV/XLSX/PDF upload with preview, manual add forms)

See [MVP.md](MVP.md) and [CLAUDE.md](CLAUDE.md) for detailed build status.

---

## Project Overview

You are building the MVP for a SaaS platform targeting **volunteer fire departments (VFDs)** — an underserved market dominated by legacy software. The product's core value props are:

1. **Zero training required** — UI must be "Chief-proof" and consumer-grade
2. **Offline-first** — crews operate in dead zones; the app must work fully offline
3. **Self-service onboarding** — eliminates the 90–120 day consultant-led migration of legacy vendors
4. **Regulatory compliance** — NFPA 1851/1852, NERIS 2026, DEA chain-of-custody

### Success Metrics
- **65% reduction** in after-call documentation time
- **100% compliance** with ISO and state record-keeping standards
- **Audit-ready** at all times — CJIS/HIPAA cloud with immutable logs

---

## Infrastructure Model

### Open-Source Core
The codebase is publicly readable and self-hostable. Departments with their own IT can run the full stack on-prem.

### CJIS/HIPAA Cloud (Managed Hosting)
- Hosted on **AWS GovCloud** for audit-ready data storage
- Satisfies CJIS and HIPAA record-keeping requirements
- All data encrypted at rest and in transit

### Data Portability
- One-click full database export in structured **NERIS/JSON** formats
- Departments own their data; no vendor lock-in

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Backend | FastAPI (Python 3.11+) |
| Database | PostgreSQL (primary) + SQLite (local offline cache) |
| ORM | SQLAlchemy (async) + Alembic (migrations) |
| Auth | NextAuth.js (frontend) + JWT (FastAPI) |
| Offline Sync | IndexedDB (browser) via Dexie.js with CRDT-based conflict resolution |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand |
| API Client | TanStack Query (React Query) |
| Package Mgr | pnpm (frontend), uv (backend) |

---

## Monorepo Structure

```
firefighter-software-mvp/
├── apps/
│   ├── web/                  # Next.js frontend (Next 14, App Router)
│   │   ├── app/
│   │   │   ├── (auth)/       # login, signup
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── signup/page.tsx
│   │   │   ├── (dashboard)/  # main app shell
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── checklists/page.tsx
│   │   │   │   ├── incidents/page.tsx
│   │   │   │   ├── assets/page.tsx
│   │   │   │   ├── settings/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── api/
│   │   │   │   ├── proxy/[...path]/route.ts   # proxy to FastAPI
│   │   │   │   └── signup/route.ts
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── ui/           # shadcn primitives
│   │   │   ├── page-stub.tsx
│   │   │   └── providers.tsx
│   │   ├── lib/
│   │   │   ├── auth.ts
│   │   │   ├── nav.ts
│   │   │   └── utils.ts
│   │   ├── public/
│   │   │   └── sw.js         # service worker (registered, basic caching)
│   │   ├── store/
│   │   │   └── sync-store.ts # Zustand sync state
│   │   └── middleware.ts     # route protection
│   └── api/                  # FastAPI backend (Python 3.11+, uv)
│       ├── main.py
│       ├── core/
│       │   ├── config.py
│       │   ├── db.py
│       │   ├── deps.py
│       │   └── security.py
│       ├── routers/
│       │   ├── auth.py
│       │   ├── health.py
│       │   ├── incidents.py
│       │   ├── checklists.py
│       │   ├── assets.py
│       │   ├── imports.py
│       │   └── sync.py
│       ├── models/           # SQLAlchemy models
│       │   ├── base.py
│       │   ├── department.py
│       │   ├── user.py
│       │   ├── incident.py
│       │   ├── checklist.py
│       │   ├── apparatus.py
│       │   ├── ppe.py
│       │   ├── scba.py
│       │   └── sync_record.py
│       ├── schemas/          # Pydantic schemas
│       │   ├── auth.py
│       │   ├── incident.py
│       │   ├── checklist.py
│       │   ├── assets.py
│       │   ├── imports.py
│       │   └── sync.py
│       ├── services/
│       │   ├── auth_service.py
│       │   ├── assets_service.py
│       │   ├── sync_service.py
│       │   ├── extraction_service.py
│       │   ├── import_service.py
│       │   ├── incident_service.py
│       │   └── voice_review_service.py
│       └── migrations/       # Alembic
├── packages/
│   └── shared-types/         # Shared TypeScript types + Zod schemas
├── docker-compose.yml
├── pnpm-workspace.yaml
└── .env.example
```

---

## MVP Feature Scope

### 1. Mobile Voice Log

**Goal**: Hands-free dictation for apparatus checks, maintenance issues, and shift memos.

- **Voice input UI**: Large mic button, one-tap to start recording on mobile
- **Noise suppression**: Integrated Voice Activity Detection (VAD) filtering diesel engine and siren frequencies
- **Transcription**: Convert speech to structured log entry; present for quick review before save
- **Entry types**: apparatus check note, maintenance issue, shift memo
- **Offline**: recordings buffered locally in IndexedDB; transcription queued for sync

### 2. Station Dashboard ("Single Source of Truth")

**Goal**: Web-based overview visible on any station screen.

- **Apparatus status**: current service status of every unit (available / out-of-service / responding)
- **Personnel certifications**: expiry indicators for certifications per member (red = overdue, yellow = due ≤30 days)
- **Active memos**: pinned shift memos visible to all logged-in members
- **Stats cards**: open incidents, pending checklist completions, assets due for inspection

### 3. NERIS Reporting

**Goal**: Native data schema for mandatory 2026 federal incident reporting.

- **Form fields** (NERIS baseline):
  - Incident number (auto-generated)
  - Incident type (dropdown, NERIS taxonomy)
  - Location (address + lat/lng — device GPS on mobile)
  - Alarm time, dispatch time, en route time, on scene time, controlled time, cleared time
  - Units responding (multi-select from apparatus list)
  - Personnel on scene (multi-select from roster)
  - Casualty information (civilian + FF)
  - Narrative (free text)
  - Exposures, actions taken (NERIS codes), property use (NERIS codes)
- **DB schema note**: `raw_data JSONB` column on incidents so FEMA field changes don't require migrations
- **Mobile UX**: Large tap targets, autosave every 30s to IndexedDB
- **Submission**: Works offline; queues for sync; generates PDF export

### 4. Digital Handover (Shift Logs)

**Goal**: Searchable shift logs with incoming personnel sign-offs.

- Outgoing officer authors the handover note
- Incoming officer(s) must sign off digitally before the shift record is closed
- Full-text search across all past shift logs
- Offline: log authored offline, sign-off queued until connectivity

### 5. Asset Registry

**Goal**: Centralized NFPA 1851/1852-compliant cradle-to-grave tracking.

#### Apparatus (Trucks)
- Unit ID, type, year, make, model, VIN, service status, mileage, pump test dates
- Maintenance log (date, type, technician, notes)
- Out-of-service tracking with reason + expected return

#### PPE (NFPA 1851)
- Per-garment tracking: helmet, coat, pants, gloves, hood, boots
- Assigned firefighter, manufacture date, purchase date, last inspection, retire date
- Inspection log (Advanced, Verification, Cleaning) + retirement workflow

#### SCBA (NFPA 1852)
- Serial number, manufacturer, cylinder hydro test date, regulator service date, assigned user
- Flow test log, cylinder pressure log

#### EMS Bags / DEA Compliance
- Bag inventory with contents list
- **DEA chain-of-custody**: Schedule II narcotics require dual-signature digital sign-off
- Medication administration or disposal event → two authorized users must sign
- Immutable audit log — records are append-only, never editable

### 6. Offline-First Architecture

**Goal**: Full write functionality with zero connectivity. Correct,
lossless sync on reconnect. Zero silent data loss.

#### Core Principle

Build and validate the sync engine **before** building additional UI
modules. Every other feature depends on this working correctly. The
first shipped milestone is: two devices, both offline, both write to
the same record, reconnect, correct state on both, zero data loss.

---

#### Local Storage

- **Dexie.js** (IndexedDB) for all local writes — every create/update
  goes to IndexedDB first, Postgres second
- **Service Worker** (`public/sw.js`) caches:
  - Full app shell (JS, CSS, fonts)
  - Reference data: apparatus list, personnel roster, NERIS taxonomy
    dropdowns — fetched and cached on first login
  - Last-fetched API responses for read-heavy pages (dashboard, asset
    list)
- App must be fully openable in airplane mode after one prior login

---

#### Sync Infrastructure

Every syncable record carries:

```typescript
{
  local_id: string          // client-generated UUIDv4
  vector_clock: Record<string, number>  // { device_id: seq }
  last_modified_by: string  // user_id
  last_modified_at: string  // ISO timestamp (client clock)
  sync_status: 'pending' | 'synced' | 'conflict'
}
```

---

#### Conflict Resolution — Explicit Semantics by Record Type

**This replaces the prior underspecified "LWW per field" strategy.**
Each record type has a defined merge strategy:

| Record Type | Strategy | Rationale |
|---|---|---|
| Incident fields | LWW per field (`last_modified_at`) | One author at a time; rare conflict |
| Shift log body | LWW whole record | One author (outgoing officer) |
| Apparatus status | LWW (`last_modified_at`) | Last known status wins |
| Apparatus mileage | LWW (`last_modified_at`) | Numeric, last reading wins |
| Checklist completion | **Union merge** | See below |
| PPE / SCBA fields | LWW per field | Single-author updates |
| Voice logs | Append-only; no conflicts | Each log is a new record |
| Narcotics log | Append-only; no conflicts | Each event is a new record |

**Checklist Union Merge (the hard case)**

When two devices both write to the same checklist offline:
- Each checklist item is an independent boolean keyed by `item_id`
- Merge rule: an item is **complete** if *either* device marked it
  complete — completion is monotonic and cannot be un-done offline
- An item can only be marked *incomplete* by an online, authenticated
  action (explicit un-check requires connectivity)
- Result: no data is dropped; the safer state (more items checked)
  wins; UI does not need to surface a conflict for checklists

**Manual Conflict UI (incidents and shift logs only)**

If two devices edited the same incident or shift log body offline:
- Server detects conflict via vector clock comparison
- Returns both versions in the conflict response
- UI surfaces a side-by-side diff — user picks one or merges manually
- Never auto-resolve narrative text conflicts silently

---

#### Sync Protocol

**On reconnect:**

1. `GET /api/v1/sync/pull?since={last_sync_timestamp}`
   → server returns all records modified since last sync for this
   department

2. `POST /api/v1/sync/push`
```json
   {
     "mutations": [
       {
         "table": "checklist_completions",
         "local_id": "uuid-v4",
         "operation": "upsert",
         "data": { "...": "..." },
         "vector_clock": { "device_abc": 3 },
         "client_timestamp": "2026-04-28T14:32:00Z"
       }
     ]
   }
```

3. Server applies merge strategy per table (see table above), returns:
```json
   {
     "accepted": ["uuid-v4", "..."],
     "conflicts": [
       {
         "local_id": "uuid-v4",
         "server_version": { "...": "..." },
         "client_version": { "...": "..." }
       }
     ]
   }
```

4. Client updates `sync_status` to `synced` for accepted records;
   sets `conflict` status for conflict records and surfaces UI

---

#### Sync Status Indicator

Always-visible in nav bar. Three states only:
- ✅ **Synced** — all local writes confirmed by server
- 🔄 **Syncing** — push/pull in progress
- 🔴 **Offline — N changes pending** — no connectivity; N = count of
  `sync_status: 'pending'` records in IndexedDB

Tapping the indicator opens a drawer listing pending changes by type.

---

#### Out of Scope for MVP Sync

- Cross-department sync
- Real-time collaborative editing (WebSocket / live updates)
- Peer-to-peer sync between devices without hitting the server
- Background sync via the Background Sync API (defer — poor iOS
  support)

### 7. Migration Engine ("Guided Importer")

**Goal**: Get a department's first data into the system in under a day,
without a consultant.

#### MVP Scope (Narrow Intentionally)

The MVP targets **one legacy system per early customer**, not a
general-purpose importer. The general-purpose drag-and-drop + LLM
normalization vision is deferred post-MVP. Rationale: column mapping
normalization across all legacy fire RMS platforms (ImageTrend, ESO,
FIREHOUSE, RMS Superion) is weeks of work per vendor, and LLM
normalization on ambiguous schemas produces silent data corruption —
the worst possible failure mode for compliance records.

#### What Gets Built for MVP

**Phase 1 — Manual Template Import**
- Provide downloadable CSV templates for each data type:
  - `apparatus-template.csv`
  - `personnel-roster-template.csv`
  - `ppe-inventory-template.csv`
  - `scba-units-template.csv`
- Department fills in the template (or Chase/support maps their export
  into it once manually)
- Upload → validate → preview → commit

**Phase 2 — Targeted Vendor Parser (first paying customer only)**
- Once first customer is identified, build one parser for their specific
  legacy system export format
- Hard-code the column mappings for that vendor's CSV/XLSX structure
- Fuzzy match only as a safety net for column name typos, not as the
  primary strategy

**What is NOT built for MVP**
- General-purpose LLM column normalization
- PDF parsing of legacy incident reports (deferred — pdfplumber on
  unstructured fire RMS PDFs is unreliable)
- Conflict resolution UI for duplicate records (handle by validating
  unique keys pre-import and rejecting duplicates with a clear error)
- Auto-detection of arbitrary file formats

#### Import Flow (MVP)

1. User downloads the correct CSV template from the Settings page
2. User fills it in (or exports from legacy system and maps columns)
3. User uploads via drag-and-drop (`multipart/form-data` to
   `POST /api/v1/import/upload`)
4. Backend validates: required fields, type coercion, duplicate key
   detection — returns structured error list
5. Frontend renders a **preview table** showing rows to be imported,
   with any validation errors highlighted
6. User confirms → `POST /api/v1/import/commit` → records written

#### Backend

- `pandas` for CSV/XLSX parsing (already in dependencies — keep)
- Remove `pdfplumber` and `fuzzywuzzy` / `python-levenshtein` from MVP
  dependencies — defer until a concrete use case exists
- Validation layer returns per-row errors: `{ row: 4, field: "vin",
  error: "duplicate" }`

#### Success Criterion

A department can import their full apparatus list, personnel roster,
and PPE inventory in under 2 hours with no outside help, using only
the template CSV workflow.

---

## Database Schema (Key Tables)

```sql
-- Core multi-tenancy
departments (id, name, fdid, state, subscription_tier, created_at)
users (id, department_id, name, email, role, badge_number, certifications JSONB, created_at)

-- Sync infrastructure
sync_records (id, department_id, table_name, record_id, vector_clock JSONB,
              last_modified_by, last_modified_at, is_deleted)

-- Incidents (NERIS)
incidents (id, department_id, incident_number, incident_type, location_address,
           location_lat, location_lng, alarm_time, dispatch_time, en_route_time,
           on_scene_time, controlled_time, cleared_time, narrative,
           raw_data JSONB, sync_status, created_by, created_at)

-- Shift logs / handover
shift_logs (id, department_id, authored_by, shift_date, body TEXT,
            signoffs JSONB, closed_at, created_at)

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

-- Voice logs
voice_logs (id, department_id, recorded_by, entry_type, transcript TEXT,
            audio_ref TEXT, sync_status, created_at)

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

POST   /api/v1/import/upload          # multipart file
POST   /api/v1/import/preview
POST   /api/v1/import/commit

GET    /api/v1/incidents
POST   /api/v1/incidents
GET    /api/v1/incidents/{id}
PATCH  /api/v1/incidents/{id}

GET    /api/v1/shift-logs
POST   /api/v1/shift-logs
POST   /api/v1/shift-logs/{id}/signoff

GET    /api/v1/assets/apparatus
POST   /api/v1/assets/apparatus
GET    /api/v1/assets/ppe
GET    /api/v1/assets/scba

GET    /api/v1/checklists/templates
POST   /api/v1/checklists/complete

GET    /api/v1/voice-logs
POST   /api/v1/voice-logs

POST   /api/v1/sync/push
GET    /api/v1/sync/pull

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
         "data": { "..." : "..." },
         "vector_clock": { "device_id": 3, "user_id": 1 },
         "client_timestamp": "2026-04-28T14:32:00Z"
       }
     ]
   }
   ```
3. Server applies LWW merge, returns conflicts array
4. Client resolves conflicts via UI if any; otherwise marks records as synced

---

## UX / Design Constraints

- **Target user**: Rural fire chiefs, often 50+, not tech-savvy — opinionated and simple
- **Mobile-first**: Most daily use on phones at station or on scene
- **Large tap targets**: 44px minimum everywhere
- **Offline indicator**: Persistent, always visible — never hide sync status
- **No jargon**: "Log Incident", not "Create NERIS Record"
- **Color system**: Red as primary (fire/urgency), neutral grays as base
- **Font**: Legible and authoritative — not playful
- **Checklist UX**: Big checkboxes, swipe-to-complete on mobile, clear completion state

---

## Current Build Status

### Done
- Monorepo scaffolded (`pnpm workspaces`, `pnpm-workspace.yaml`)
- Next.js 14 app in `apps/web` — TypeScript, Tailwind, App Router, shadcn/ui
- FastAPI app in `apps/api` — uv, health check, async SQLAlchemy
- `docker-compose.yml` (postgres + redis)
- Alembic migrations wired up
- NextAuth.js credentials provider (login + signup pages)
- FastAPI JWT middleware (`core/security.py`, `core/deps.py`)
- Next.js route protection middleware
- App shell: sidebar nav, mobile bottom tab bar
- Sync status indicator (Zustand `sync-store.ts`)
- Service worker registered (`public/sw.js`)
- API proxy route (`app/api/proxy/[...path]/route.ts`)
- FastAPI routers stubbed: auth, health, incidents, checklists, assets, imports, sync
- SQLAlchemy models: department, user, incident, checklist, apparatus, ppe, scba, sync_record
- Pydantic schemas: auth, incident, checklist, assets, imports, sync
- Services: auth, assets, sync

### In Progress / Not Yet Built
- Voice log UI (mic button, VAD, transcription flow)
- Station dashboard stat cards (currently placeholder data)
- NERIS incident form (full field set)
- Digital handover / shift log UI + sign-off flow
- Asset registry UI (apparatus, PPE, SCBA detail pages)
- Migration engine UI (drag-and-drop + preview)
- DEA dual-signature flow
- Dexie.js IndexedDB schema + `useSyncEngine` hook
- PDF export for incidents
- Full-text search for shift logs

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

- **CRDT conflict resolution**: LWW (Last Write Wins) per field with `updated_at` as tiebreaker; flag true conflicts for manual resolution
- **DEA narcotics log is append-only**: never generate UPDATE or DELETE queries against `narcotics_log`; enforce at DB level with a trigger
- **NERIS schema flexibility**: always use `raw_data JSONB` on incidents so FEMA field changes don't require schema migrations
- **Don't over-engineer auth**: credentials provider is fine for MVP; no OAuth needed yet
- **Error states matter**: every page needs loading, error, and offline states — don't leave as TODO
- **Voice log VAD**: filter diesel engine (~100–200 Hz) and siren frequencies (~700–1200 Hz) before transcription
- **Shift log sign-offs**: require the incoming officer's authenticated session — no anonymous sign-offs
- **Data portability**: every export must be valid NERIS-compliant JSON; schema documented alongside export endpoint
- **No marketplace**: the vendor/marketplace features are deferred — do not build or stub them
