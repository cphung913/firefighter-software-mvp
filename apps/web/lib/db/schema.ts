import Dexie, { type Table } from "dexie";
import type {
  ChecklistTemplateItem,
  DepartmentRosterUser,
} from "@vfd/shared-types";

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
  on_scene_time?: string | null;
  cleared_time?: string | null;
  narrative?: string | null;
  raw_data?: Record<string, unknown>;
}

export interface IncidentDraftRecord {
  id: string;
  incident_number: string;
  incident_type?: string | null;
  location_address?: string | null;
  location_lat?: string | null;
  location_lng?: string | null;
  alarm_time?: string | null;
  on_scene_time?: string | null;
  cleared_time?: string | null;
  narrative?: string | null;
  raw_data: Record<string, unknown>;
  updated_at: string;
}

export interface ChecklistCompletionRecord extends SyncMeta {
  template_id?: string | null;
  apparatus_id?: string | null;
  completed_at?: string | null;
  responses?: Record<string, unknown>;
}

export interface ChecklistTemplateRecord {
  id: string;
  name: string;
  type: string;
  items: ChecklistTemplateItem[];
  updated_at: string;
  cached_at: string;
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

export interface PpeItemRecord extends SyncMeta {
  item_type: string;
  serial_number?: string | null;
  assigned_to?: string | null;
  manufacture_date?: string | null;
  purchase_date?: string | null;
  last_inspection?: string | null;
  retired_at?: string | null;
}

export interface ScbaUnitRecord extends SyncMeta {
  serial_number?: string | null;
  manufacturer?: string | null;
  assigned_to?: string | null;
  cylinder_hydro_date?: string | null;
  regulator_service_date?: string | null;
}

export type SyncTable =
  | "incidents"
  | "checklist_completions"
  | "apparatus"
  | "ppe_items"
  | "scba_units";

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
  checklist_completions!: Table<ChecklistCompletionRecord, string>;
  checklist_templates!: Table<ChecklistTemplateRecord, string>;
  department_users!: Table<DepartmentUserRecord, string>;
  apparatus!: Table<ApparatusRecord, string>;
  ppe_items!: Table<PpeItemRecord, string>;
  scba_units!: Table<ScbaUnitRecord, string>;
  pending_mutations!: Table<PendingMutationRecord, number>;
  sync_state!: Table<SyncStateRecord, string>;

  constructor() {
    super("vfdLocalDb");
    this.version(1).stores({
      incidents: "local_id, server_id, _sync_status, updated_at",
      checklist_completions: "local_id, server_id, _sync_status, updated_at",
      apparatus: "local_id, server_id, _sync_status, updated_at",
      ppe_items: "local_id, server_id, _sync_status, updated_at",
      scba_units: "local_id, server_id, _sync_status, updated_at",
      pending_mutations: "++id, table, local_id, client_timestamp",
      sync_state: "key",
    });
    this.version(2).stores({
      incidents: "local_id, server_id, _sync_status, updated_at",
      checklist_completions:
        "local_id, server_id, _sync_status, updated_at, completed_at, template_id, apparatus_id",
      checklist_templates: "id, type, updated_at, cached_at",
      apparatus:
        "local_id, server_id, _sync_status, updated_at, unit_id, service_status",
      ppe_items: "local_id, server_id, _sync_status, updated_at",
      scba_units: "local_id, server_id, _sync_status, updated_at",
      pending_mutations: "++id, table, local_id, client_timestamp",
      sync_state: "key",
    });
    this.version(3).stores({
      incidents:
        "local_id, server_id, _sync_status, updated_at, incident_number, incident_type",
      incident_drafts: "id, updated_at, incident_number",
      checklist_completions:
        "local_id, server_id, _sync_status, updated_at, completed_at, template_id, apparatus_id",
      checklist_templates: "id, type, updated_at, cached_at",
      department_users: "id, name, role, cached_at",
      apparatus:
        "local_id, server_id, _sync_status, updated_at, unit_id, service_status",
      ppe_items: "local_id, server_id, _sync_status, updated_at",
      scba_units: "local_id, server_id, _sync_status, updated_at",
      pending_mutations: "++id, table, local_id, client_timestamp",
      sync_state: "key",
    });
  }
}

export const db = new VfdLocalDb();
