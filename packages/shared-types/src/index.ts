import { z } from "zod";

// ===== Domain =====

export const DepartmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  fdid: z.string().nullable(),
  state: z.string().nullable(),
  subscription_tier: z.string(),
  created_at: z.string(),
});
export type Department = z.infer<typeof DepartmentSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  department_id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
  badge_number: z.string().nullable(),
});
export type User = z.infer<typeof UserSchema>;

export const ApparatusSummarySchema = z.object({
  id: z.string().uuid(),
  local_id: z.string().nullable().optional(),
  unit_id: z.string().nullable(),
  type: z.string().nullable(),
  year: z.number().nullable().optional(),
  make: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  vin: z.string().nullable().optional(),
  mileage: z.number().nullable().optional(),
  service_status: z.string(),
});
export type ApparatusSummary = z.infer<typeof ApparatusSummarySchema>;

export const ChecklistTemplateItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
});
export type ChecklistTemplateItem = z.infer<typeof ChecklistTemplateItemSchema>;

export const ChecklistTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  items: z.array(ChecklistTemplateItemSchema),
  updated_at: z.string(),
});
export type ChecklistTemplate = z.infer<typeof ChecklistTemplateSchema>;

export const ChecklistBootstrapSchema = z.object({
  templates: z.array(ChecklistTemplateSchema),
  apparatus: z.array(ApparatusSummarySchema),
});
export type ChecklistBootstrap = z.infer<typeof ChecklistBootstrapSchema>;

export const DepartmentRosterUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: z.string(),
  badge_number: z.string().nullable(),
});
export type DepartmentRosterUser = z.infer<typeof DepartmentRosterUserSchema>;

export const IncidentBootstrapSchema = z.object({
  apparatus: z.array(ApparatusSummarySchema),
  users: z.array(DepartmentRosterUserSchema),
});
export type IncidentBootstrap = z.infer<typeof IncidentBootstrapSchema>;

export const PpeAssetSchema = z.object({
  id: z.string().uuid(),
  local_id: z.string().nullable().optional(),
  item_type: z.string(),
  serial_number: z.string().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  manufacture_date: z.string().nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  last_inspection: z.string().nullable().optional(),
  retired_at: z.string().nullable().optional(),
});
export type PpeAsset = z.infer<typeof PpeAssetSchema>;

export const ScbaAssetSchema = z.object({
  id: z.string().uuid(),
  local_id: z.string().nullable().optional(),
  serial_number: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  cylinder_hydro_date: z.string().nullable().optional(),
  regulator_service_date: z.string().nullable().optional(),
});
export type ScbaAsset = z.infer<typeof ScbaAssetSchema>;

export const AssetBootstrapSchema = z.object({
  apparatus: z.array(ApparatusSummarySchema),
  ppe_items: z.array(PpeAssetSchema),
  scba_units: z.array(ScbaAssetSchema),
  users: z.array(DepartmentRosterUserSchema),
});
export type AssetBootstrap = z.infer<typeof AssetBootstrapSchema>;

// ===== Auth =====

export const SignupRequestSchema = z.object({
  department_name: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("bearer"),
  user: UserSchema,
});
export type TokenResponse = z.infer<typeof TokenResponseSchema>;

// ===== Sync =====

export const SyncOperation = z.enum(["upsert", "delete"]);
export type SyncOperation = z.infer<typeof SyncOperation>;

export const SyncTable = z.enum([
  "incidents",
  "checklist_completions",
  "apparatus",
  "ppe_items",
  "scba_units",
]);
export type SyncTable = z.infer<typeof SyncTable>;

export const SyncMutationSchema = z.object({
  table: SyncTable,
  local_id: z.string(),
  operation: SyncOperation,
  data: z.record(z.string(), z.unknown()),
  updated_at: z.string(),
  client_timestamp: z.string(),
});
export type SyncMutation = z.infer<typeof SyncMutationSchema>;

export const SyncPushRequestSchema = z.object({
  mutations: z.array(SyncMutationSchema),
});
export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

export const SyncConflictSchema = z.object({
  table: SyncTable,
  local_id: z.string(),
  reason: z.string(),
  server_record: z.record(z.string(), z.unknown()),
  client_record: z.record(z.string(), z.unknown()),
});
export type SyncConflict = z.infer<typeof SyncConflictSchema>;

export const SyncSyncedRefSchema = z.object({
  table: SyncTable,
  local_id: z.string(),
  server_id: z.string().uuid(),
  updated_at: z.string(),
});
export type SyncSyncedRef = z.infer<typeof SyncSyncedRefSchema>;

export const SyncPushResponseSchema = z.object({
  synced: z.array(SyncSyncedRefSchema),
  conflicts: z.array(SyncConflictSchema),
  server_time: z.string(),
});
export type SyncPushResponse = z.infer<typeof SyncPushResponseSchema>;

export const SyncPullChangeSchema = z.object({
  table: SyncTable,
  record_id: z.string().uuid(),
  data: z.record(z.string(), z.unknown()),
  updated_at: z.string(),
  is_deleted: z.boolean(),
});
export type SyncPullChange = z.infer<typeof SyncPullChangeSchema>;

export const SyncPullResponseSchema = z.object({
  changes: z.array(SyncPullChangeSchema),
  server_time: z.string(),
});
export type SyncPullResponse = z.infer<typeof SyncPullResponseSchema>;
