# VFD Platform — MVP Spec

## What we're building

A mobile-first web app that lets firefighters capture incident data hands-free on the ride back, then coagulates that data into a pre-filled NERIS report for an officer to review and submit back at the station. One app, two surfaces: mobile for field capture, desktop/tablet for review and administration.

**The pitch:** narrate on the ride back, get a near-complete NERIS report when you hit the station. Works with no signal.

---

## MVP scope

### In

| Feature | Why it's in |
|---|---|
| Offline-first sync engine | Everything depends on this. Ships first. |
| Ride-back voice capture | Core wedge feature. |
| AI coagulation → NERIS draft | The payoff of the voice feature. |
| NERIS incident report (minimum fields) | Compliance requirement. No form = no adoption. |
| Station dashboard (apparatus status only) | Chiefs need to know what's available at a glance. |
| User auth + multi-tenancy | Required to have a pilot customer. |
| Roster + apparatus seed data (CSV upload) | Prerequisite for voice attribution and NERIS pre-fill. |

### Out (v2+)

| Feature | Why it's out |
|---|---|
| Full asset registry (PPE, SCBA, NFPA 1851/1852) | Important, not the wedge. |
| Digital handover + shift sign-off | Internal workflow improvement, won't drive adoption. |
| DEA dual-signature chain-of-custody | Niche, high compliance burden, not universal. |
| Apparatus checklists | Nice to have, not core to the reporting wedge. |
| Full migration engine (drag-and-drop preview) | Simple CSV upload is enough for MVP. |
| PDF export | NERIS JSON submission is the requirement. |
| Full-text shift log search | Shift logs are cut. |
| Certification expiry tracking | Dashboard v2. |
| Stat cards (open incidents, pending checklists) | Dashboard v2. |

---

## Feature specs

### 1. Offline-first sync engine

**Ships first. Every other feature depends on it.**

The first shipped milestone is: two devices, both offline, both write to the same record, reconnect, correct state on both, zero data loss.

- **Local storage:** Dexie.js (IndexedDB) for all local writes — every create/update goes to IndexedDB first, Postgres second
- **Service worker:** caches full app shell, roster, apparatus list, and NERIS taxonomy dropdowns on first login
- **Sync protocol:**
  1. `GET /api/v1/sync/pull?since={last_sync_timestamp}` — get server-side changes
  2. `POST /api/v1/sync/push` — push local mutations with vector clocks
  3. Server applies merge strategy per table, returns accepted + conflicts
  4. Client updates sync_status; surfaces conflict UI where required
- **Offline indicator:** persistent, always visible — never hide sync status
- **Offline state:** app must be fully usable in airplane mode after one prior login

**Every syncable record carries:**

```typescript
{
  local_id: string                          // client-generated UUIDv4
  vector_clock: Record<string, number>      // { device_id: seq }
  last_modified_by: string                  // user_id
  last_modified_at: string                  // ISO timestamp (client clock)
  sync_status: 'pending' | 'synced' | 'conflict'
}
```

**Conflict resolution semantics (MVP tables only):**

| Record Type | Strategy | Rationale |
|---|---|---|
| Incident fields | LWW per field (`last_modified_at`) | One author at a time; rare conflict |
| Apparatus status | LWW (`last_modified_at`) | Last known status wins |
| Voice logs | Append-only; no conflicts | Each log is a new record |

**Manual conflict UI (incidents only):** server detects conflict via vector clock comparison, returns both versions; UI surfaces side-by-side diff — user picks one or merges manually. Never auto-resolve narrative text conflicts silently.

**Sync status indicator (always visible, three states):**
- ✅ Synced — all local writes confirmed
- 🔄 Syncing — push/pull in progress
- 🔴 Offline — N changes pending — tapping opens a drawer listing pending changes by type

---

### 2. Ride-back voice capture

**Trigger:** firefighter manually taps "Start ride-back log" — large button (56px minimum tap target), surfaced in the bottom tab bar and on the incidents list page.

**Recording UX:**
- Tap to start, tap to stop
- Live waveform while recording confirms mic is active
- Listen back / re-record / keep it before confirming
- VAD filtering: suppress diesel engine (~100–200 Hz) and siren frequencies (~700–1200 Hz)
- No transcription shown during recording — runs after confirmation

**Multi-crew support:**
- Single device (pass-around): each crew member taps their name from the active roster, records their piece
- Multi-device (simultaneous): devices join a shared session via a 6-character alphanumeric code (no O/0/I/1); contributions merge on reconnect via CRDT sync
- All contributions attributed to the authenticated user

**Session lifecycle:**
- Session is free-form — not tied to an incident at capture time
- User manually ends the session
- Routing to incident / shift memo / checklist happens at the review step

**Offline fallback:**
- Audio buffered locally in IndexedDB as raw blobs
- On-device transcription via Web Speech API as best-effort fallback (raw text, no structure extraction)
- Banner: "No connection — your recording is saved. AI review will run when you're back online"
- On reconnect: audio/transcript sent to backend, AI extraction runs, user notified to complete review
- Zero silent data loss — raw recording preserved until extraction succeeds

---

### 3. AI coagulation → NERIS draft

When the device reconnects, the backend assembles everything it knows about the incident window:

- GPS track (response times, location)
- Voice transcripts (attributed per crew member)
- Roster and apparatus data (who was on the call, what unit)
- Any partial form entries made at scene

AI extraction runs against the full context — not just the voice session in isolation. The extraction prompt identifies NERIS-relevant fields: incident type, times, location, units, personnel, actions taken, casualties, narrative.

**Review screen:**

- **NERIS fields card:** extracted field-value pairs with inline edit fields → "Apply to incident" (user selects or creates the incident record)

Nothing is written to the incident record without an explicit tap of Apply. AI surfaces uncertain fields as editable blanks rather than confident wrong answers.

**Offline fallback:** if AI extraction can't run (no connectivity), raw transcript is preserved and the review screen shows when extraction completes after reconnect.

---

### 4. NERIS incident report

**Minimum required fields only** — no optional modules for MVP.

| Field | Input type |
|---|---|
| Incident number | Auto-generated |
| Incident type | Dropdown (NERIS taxonomy) |
| Location | Address + lat/lng (device GPS on mobile) |
| Alarm time | Datetime |
| Dispatch time | Datetime |
| En route time | Datetime |
| On scene time | Datetime |
| Controlled time | Datetime |
| Cleared time | Datetime |
| Units responding | Multi-select from apparatus list |
| Personnel on scene | Multi-select from roster |
| Casualty information | Civilian + FF numeric fields |
| Narrative | Free text |
| Actions taken | NERIS codes (multi-select) |
| Property use | NERIS code (dropdown) |

**Mobile UX:** large tap targets (44px minimum), autosave every 30s to IndexedDB, works fully offline with sync queue.

**Pre-fill:** fields populated by AI coagulation wherever possible — officer's job is review and correction, not data entry.

**Submission:** queues for sync if offline; generates NERIS-compliant JSON on submission.

**Schema note:** `raw_data JSONB` column on incidents — never remove it; FEMA field changes must not require migrations.

---

### 5. Station dashboard (apparatus status only)

Single-purpose for MVP: officers need to know what's available at a glance.

- List of all apparatus with current status: **available / responding / out of service**
- Status updatable from mobile (tap to change)
- Syncs in real time when connected; last-known state shown offline
- No stat cards, no cert expiry, no open incident counts — those are v2

---

### 6. Auth + multi-tenancy

- Credentials-based auth (NextAuth.js + JWT) — no OAuth for MVP
- Each department is an isolated tenant; no data bleeds between departments
- Roles: **admin** (chief/officer — full access), **member** (firefighter — field capture + own records)
- Route protection on all authenticated pages

---

### 7. Roster + apparatus seed data

**Why it's here:** the voice session needs to know who was on the call and what unit responded to pre-fill NERIS personnel and apparatus fields. Without this data, the AI coagulation produces an incomplete draft.

**What's needed:**
- Personnel roster: name, badge number, role, certifications (basic)
- Apparatus list: unit ID, type, make, model, service status

**How to get it in:**
- Simple CSV upload — two templates (roster, apparatus)
- Basic column mapping (not a full migration engine)
- Manual entry as fallback for small departments

**Not in scope:** drag-and-drop preview, fuzzy matching, full migration engine — those are v2.

---

## Build order

1. **Offline sync engine** — foundation. Nothing else ships until two-device sync works correctly with zero data loss.
2. **Auth + multi-tenancy + seed data** — required to have a real department using the app.
3. **NERIS incident form** — the output target. Build the form before building what fills it.
4. **Voice capture** — mobile recording, VAD, offline buffering, multi-crew session.
5. **AI coagulation + review cards** — the payoff. Connects voice + GPS + roster into the NERIS draft.
6. **Station dashboard** — apparatus status. Simplest feature, ships last as a usability layer.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Backend | FastAPI (Python 3.11+) |
| Database | PostgreSQL (primary) + SQLite (local offline cache) |
| ORM | SQLAlchemy (async) + Alembic |
| Auth | NextAuth.js + JWT |
| Offline sync | IndexedDB via Dexie.js + CRDT conflict resolution |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand |
| API client | TanStack Query (React Query) |
| Package mgr | pnpm (frontend), uv (backend) |
| Cloud | AWS GovCloud (CJIS/HIPAA) |

---

## Monorepo structure

```
firefighter-software-mvp/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── signup/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── incidents/page.tsx
│   │   │   │   ├── settings/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── (mobile)/             # field-facing, large tap targets, offline-first
│   │   │   │   ├── voice/
│   │   │   │   │   └── session/[id]/
│   │   │   │   │       ├── page.tsx  # active recording + crew roster
│   │   │   │   │       └── review/   # AI card review screen
│   │   │   │   └── incidents/[id]/   # mobile incident form (at-scene entry)
│   │   │   ├── api/
│   │   │   │   ├── proxy/[...path]/route.ts   # proxy to FastAPI
│   │   │   │   └── signup/route.ts
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn primitives
│   │   │   ├── page-stub.tsx
│   │   │   └── providers.tsx
│   │   ├── lib/
│   │   │   ├── auth.ts
│   │   │   ├── nav.ts
│   │   │   └── utils.ts
│   │   ├── public/
│   │   │   └── sw.js                 # service worker
│   │   ├── store/
│   │   │   └── sync-store.ts         # Zustand sync state
│   │   └── middleware.ts             # route protection
│   └── api/                          # FastAPI backend
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
│       │   ├── assets.py
│       │   ├── imports.py
│       │   ├── voice.py
│       │   └── sync.py
│       ├── models/                   # SQLAlchemy models
│       │   ├── base.py
│       │   ├── department.py
│       │   ├── user.py
│       │   ├── incident.py
│       │   ├── apparatus.py
│       │   ├── voice_session.py
│       │   ├── voice_log.py
│       │   └── sync_record.py
│       ├── schemas/                  # Pydantic schemas
│       │   ├── auth.py
│       │   ├── incident.py
│       │   ├── assets.py
│       │   ├── imports.py
│       │   └── sync.py
│       ├── services/
│       │   ├── auth_service.py
│       │   ├── assets_service.py
│       │   └── sync_service.py
│       └── migrations/               # Alembic
├── packages/
│   └── shared-types/                 # Shared TypeScript types + Zod schemas
├── docker-compose.yml
├── pnpm-workspace.yaml
└── .env.example
```

---

## Database schema (MVP tables only)

```sql
-- Core
departments (id, name, fdid, state, subscription_tier, created_at)
users (id, department_id, name, email, role, badge_number, certifications JSONB, created_at)

-- Sync
sync_records (id, department_id, table_name, record_id, vector_clock JSONB,
              last_modified_by, last_modified_at, is_deleted)

-- Incidents
incidents (id, department_id, incident_number, incident_type, location_address,
           location_lat, location_lng, alarm_time, dispatch_time, en_route_time,
           on_scene_time, controlled_time, cleared_time, narrative,
           raw_data JSONB, sync_status, created_by, created_at)

-- Voice
voice_sessions (id, department_id, session_code VARCHAR(8),
                started_by, started_at, ended_at, sync_status)
-- session_code: 6 alphanumeric chars, no O/0/I/1

voice_logs (id, department_id, session_id, recorded_by, entry_type,
            audio_ref TEXT, raw_transcript TEXT, ai_extracted JSONB,
            review_status VARCHAR, sync_status, created_at)
-- review_status: pending | approved | dismissed

-- Assets (MVP subset)
apparatus (id, department_id, unit_id, type, year, make, model, vin,
           service_status, mileage, created_at)
-- service_status: available | responding | out_of_service
```

---

## API endpoints (MVP only)

```
POST   /api/v1/auth/login
POST   /api/v1/auth/signup

POST   /api/v1/import/upload          # CSV roster + apparatus
POST   /api/v1/import/preview
POST   /api/v1/import/commit

GET    /api/v1/incidents
POST   /api/v1/incidents
GET    /api/v1/incidents/{id}
PATCH  /api/v1/incidents/{id}

GET    /api/v1/assets/apparatus
PATCH  /api/v1/apparatus/{id}/status  # update available/responding/OOS

POST   /api/v1/voice-sessions
GET    /api/v1/voice-sessions/{code}
POST   /api/v1/voice-sessions/{id}/end
POST   /api/v1/voice-logs
POST   /api/v1/voice-logs/{id}/extract
POST   /api/v1/voice-logs/{id}/approve

POST   /api/v1/sync/push
GET    /api/v1/sync/pull
```

---

## Current build status

### Done — All MVP features
✅ **Offline-first sync engine** — Dexie.js IndexedDB (v6 schema), `/api/v1/sync/push` + `/api/v1/sync/pull`, LWW conflict resolution, `useSyncEngine` hook with 30s polling
✅ **Voice capture & transcription** — `useRecorder` hook with waveform visualization, `useVad` with diesel/siren filters, Web Speech API fallback, offline audio queue to IndexedDB  
✅ **AI coagulation → NERIS draft** — Claude Sonnet 4.6 with prompt caching, full NERIS taxonomy in system prompt, confidence scoring, extraction status polling
✅ **NERIS incident form** — All 15 fields (incident type, location address + GPS, 6 timestamps, units/personnel multi-select, casualties, actions taken, property use, narrative), 30s autosave, offline-first mutations
✅ **Station dashboard** — Apparatus status cards with tap-to-cycle (available → responding → out of service), optimistic UI, sync fallback, Dexie live queries
✅ **Auth + multi-tenancy** — NextAuth.js credentials, FastAPI JWT middleware, department-scoped data isolation
✅ **Settings / import engine** — Drag-and-drop CSV/XLSX/PDF upload, header normalization with confidence, preview diff table (row action, incoming values, field changes), manual add modals
✅ **Conflict UI** — Side-by-side diff, "keep mine" vs "server version" buttons, pending changes drawer
✅ **Routes** — Auth (login/signup), Dashboard (apparatus list), Incidents (list + detail + new), Voice (new session, join by code, recording, review), Settings (import)
✅ **Database** — SQLAlchemy models (department, user, incident, apparatus, voice_session, voice_log, sync_record), Alembic migrations, PostgreSQL with async support
✅ **Export** — PDF printing for incidents with NERIS-compliant JSON serialization

### Out of MVP scope (deferred to v2+)
- Digital handover / shift sign-off flow
- DEA dual-signature chain-of-custody
- Certification expiry tracking
- Stat cards (open incidents, pending checklists)
- Full-text search for shift logs

---

## UX constraints (non-negotiable) — All implemented

- **56px tap targets** on voice recording button (✅ done) — gloved-hands use case
- **44px tap targets** everywhere else (✅ done)
- **Offline indicator** persistent and always visible (✅ done — Zustand sync-store, badge in every page)
- **Never auto-commit** (✅ done) — AI extraction populates fields, officer explicitly taps "Apply to incident"
- **No jargon** (✅ done) — "Log Incident", "Start ride-back log", "Incidents" instead of NERIS/FEMA terms
- **Chief-proof** (✅ done) — explicit "Apply to incident" / "Save" buttons, no swipe-to-dismiss
- **Session code** (✅ done) — 6 alphanumeric chars (no O/0/I/1), 5xl font, mono, selectable for verbal handoff
- Every page has loading/error/offline states (✅ done) — not stubbed

---

## Success metrics

- 65% reduction in after-call documentation time vs. current workflow
- 100% NERIS compliance on submitted reports
- Zero data loss on reconnect from offline sessions
- Officer can complete report review in under 5 minutes from reconnect
