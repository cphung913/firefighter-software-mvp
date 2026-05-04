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

export interface EquipmentRecord extends SyncMeta {
  equipment_type?: string;
  identifier?: string | null;
  name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  year_manufactured?: number | null;
  assigned_apparatus_id?: string | null;
  status?: string; // in_service | out_of_service | retired
  purchase_date?: string | null;
  notes?: string | null;
  raw_data?: Record<string, unknown>;
  next_inspection_due?: string | null;
  last_inspection_date?: string | null;
}

export interface EquipmentInspectionRecord extends SyncMeta {
  equipment_id?: string | null;       // server UUID of parent
  equipment_local_id?: string | null; // local_id of parent (offline join key)
  inspection_type?: string | null;
  inspection_date?: string | null;
  passed?: boolean;
  inspector_name?: string | null;
  notes?: string | null;
  next_due?: string | null;
  raw_data?: Record<string, unknown>;
}

export interface EquipmentMaintenanceRecord extends SyncMeta {
  equipment_id?: string | null;
  equipment_local_id?: string | null;
  maintenance_type?: string | null;
  maintenance_date?: string | null;
  performed_by?: string | null;
  cost?: number | null;
  description?: string | null;
  out_of_service_start?: string | null;
  out_of_service_end?: string | null;
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

export type SyncTable = "incidents" | "apparatus" | "voice_logs" | "equipment" | "equipment_inspections" | "equipment_maintenance";

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

export interface PendingAudioRecord {
  id?: number;
  local_clip_id: string;
  session_id: string;
  blob: Blob;
  recorded_by_id?: string | null;
  raw_transcript?: string | null;
  entry_type?: string | null;
  created_at: string;
  attempts: number;
}

export class VfdLocalDb extends Dexie {
  incidents!: Table<IncidentRecord, string>;
  incident_drafts!: Table<IncidentDraftRecord, string>;
  department_users!: Table<DepartmentUserRecord, string>;
  apparatus!: Table<ApparatusRecord, string>;
  equipment!: Table<EquipmentRecord, string>;
  equipment_inspections!: Table<EquipmentInspectionRecord, string>;
  equipment_maintenance!: Table<EquipmentMaintenanceRecord, string>;
  voice_sessions!: Table<VoiceSessionRecord, string>;
  voice_logs!: Table<VoiceLogRecord, string>;
  pending_mutations!: Table<PendingMutationRecord, number>;
  pending_audio!: Table<PendingAudioRecord, number>;
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
    // v6: pending_audio table for offline audio blob queue
    this.version(6).stores({
      incidents:
        "local_id, server_id, _sync_status, updated_at, incident_number, incident_type",
      incident_drafts: "id, updated_at, incident_number",
      department_users: "id, name, role, cached_at",
      apparatus:
        "local_id, server_id, _sync_status, updated_at, unit_id, service_status",
      voice_sessions: "id, session_code, cached_at",
      voice_logs: "local_id, server_id, _sync_status, updated_at, session_id",
      pending_mutations: "++id, table, local_id, client_timestamp",
      pending_audio: "++id, local_clip_id, session_id, created_at",
      sync_state: "key",
    });
    // v7: equipment inventory, inspections, and maintenance tables
    this.version(7).stores({
      incidents:
        "local_id, server_id, _sync_status, updated_at, incident_number, incident_type",
      incident_drafts: "id, updated_at, incident_number",
      department_users: "id, name, role, cached_at",
      apparatus:
        "local_id, server_id, _sync_status, updated_at, unit_id, service_status",
      equipment:
        "local_id, server_id, _sync_status, updated_at, equipment_type, status, next_inspection_due",
      equipment_inspections:
        "local_id, server_id, _sync_status, updated_at, equipment_local_id, inspection_date",
      equipment_maintenance:
        "local_id, server_id, _sync_status, updated_at, equipment_local_id, maintenance_date",
      voice_sessions: "id, session_code, cached_at",
      voice_logs: "local_id, server_id, _sync_status, updated_at, session_id",
      pending_mutations: "++id, table, local_id, client_timestamp",
      pending_audio: "++id, local_clip_id, session_id, created_at",
      sync_state: "key",
    });
  }
}

export const db = new VfdLocalDb();
