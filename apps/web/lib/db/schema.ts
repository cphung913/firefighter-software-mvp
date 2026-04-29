import Dexie, { type Table } from "dexie";
import type { DepartmentRosterUser } from "@vfd/shared-types";

export type SyncStatus = "pending" | "syncing" | "synced" | "conflict";

interface SyncMeta {
  local_id: string;
  server_id: string | null;
  updated_at: string;
  _sync_status: SyncStatus;
  _dirty_fields: string[];
}

export interface IncidentRecord extends SyncMeta {
  incident_number?: string | null;
  incident_type?: string | null;
  location_address?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  alarm_time?: string | null;
  dispatch_time?: string | null;
  en_route_time?: string | null;
  on_scene_time?: string | null;
  controlled_time?: string | null;
  cleared_time?: string | null;
  units_responding?: string[];
  personnel_on_scene?: string[];
  casualty_civilian?: number;
  casualty_ff?: number;
  narrative?: string | null;
  actions_taken?: string[];
  property_use?: string | null;
  raw_data?: Record<string, unknown>;
  sync_status?: string;
  // Set when _sync_status === "conflict" — holds the server's version of the record
  _conflict_server_snapshot?: Record<string, unknown> | null;
}

export interface IncidentDraftRecord {
  id: string;
  incident_number: string;
  incident_type?: string | null;
  location_address?: string | null;
  location_lat?: string | null;
  location_lng?: string | null;
  alarm_time?: string | null;
  dispatch_time?: string | null;
  en_route_time?: string | null;
  on_scene_time?: string | null;
  controlled_time?: string | null;
  cleared_time?: string | null;
  units_responding?: string[];
  personnel_on_scene?: string[];
  casualty_civilian?: number;
  casualty_ff?: number;
  narrative?: string | null;
  actions_taken?: string[];
  property_use?: string | null;
  raw_data: Record<string, unknown>;
  updated_at: string;
}

export interface DepartmentUserRecord extends DepartmentRosterUser {
  cached_at: string;
}

export interface ApparatusRecord extends SyncMeta {
  unit_id?: string | null;
  type?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  vin?: string | null;
  service_status?: string;
  mileage?: number | null;
}

export interface VoiceSessionRecord {
  id: string;
  session_code: string;
  started_at: string;
  ended_at?: string | null;
  sync_status?: string;
  cached_at: string;
}

export interface VoiceLogRecord extends SyncMeta {
  session_id: string;
  recorded_by?: string | null;
  entry_type?: string | null;
  audio_ref?: string | null;
  raw_transcript?: string | null;
  ai_extracted?: Record<string, unknown> | null;
  review_status?: string;
  sync_status?: string;
}

export type SyncTable = "incidents" | "apparatus" | "voice_logs";

export type Operation = "upsert" | "delete";

export interface PendingMutationRecord {
  id?: number;
  table: SyncTable;
  local_id: string;
  operation: Operation;
  data: Record<string, unknown>;
  updated_at: string;
  client_timestamp: string;
}

export interface SyncStateRecord {
  key: "main";
  last_sync_at: string | null;
}

export class VfdLocalDb extends Dexie {
  incidents!: Table<IncidentRecord, string>;
  incident_drafts!: Table<IncidentDraftRecord, string>;
  department_users!: Table<DepartmentUserRecord, string>;
  apparatus!: Table<ApparatusRecord, string>;
  voice_sessions!: Table<VoiceSessionRecord, string>;
  voice_logs!: Table<VoiceLogRecord, string>;
  pending_mutations!: Table<PendingMutationRecord, number>;
  sync_state!: Table<SyncStateRecord, string>;

  constructor() {
    super("vfdLocalDb");
    this.version(4).stores({
      incidents:
        "local_id, server_id, _sync_status, updated_at, incident_number, incident_type",
      incident_drafts: "id, updated_at, incident_number",
      department_users: "id, name, role, cached_at",
      apparatus:
        "local_id, server_id, _sync_status, updated_at, unit_id, service_status",
      voice_sessions: "id, session_code, cached_at",
      voice_logs: "local_id, server_id, _sync_status, updated_at, session_id",
      pending_mutations: "++id, table, local_id, client_timestamp",
      sync_state: "key",
    });
    // v5: adds _conflict_server_snapshot field to incidents (no index change needed)
    this.version(5).stores({
      incidents:
        "local_id, server_id, _sync_status, updated_at, incident_number, incident_type",
      incident_drafts: "id, updated_at, incident_number",
      department_users: "id, name, role, cached_at",
      apparatus:
        "local_id, server_id, _sync_status, updated_at, unit_id, service_status",
      voice_sessions: "id, session_code, cached_at",
      voice_logs: "local_id, server_id, _sync_status, updated_at, session_id",
      pending_mutations: "++id, table, local_id, client_timestamp",
      sync_state: "key",
    });
  }
}

export const db = new VfdLocalDb();
