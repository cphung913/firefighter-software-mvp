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

// ===== Incidents =====

export const TaxonomyOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});
export type TaxonomyOption = z.infer<typeof TaxonomyOptionSchema>;

export const IncidentTaxonomySchema = z.object({
  incident_types: z.array(TaxonomyOptionSchema),
  action_taken_codes: z.array(TaxonomyOptionSchema),
  property_use_codes: z.array(TaxonomyOptionSchema),
});
export type IncidentTaxonomy = z.infer<typeof IncidentTaxonomySchema>;

export const IncidentOutSchema = z.object({
  id: z.string().uuid(),
  local_id: z.string().nullable(),
  incident_number: z.string().nullable(),
  incident_type: z.string().nullable(),
  location_address: z.string().nullable(),
  location_lat: z.number().nullable(),
  location_lng: z.number().nullable(),
  alarm_time: z.string().nullable(),
  dispatch_time: z.string().nullable(),
  en_route_time: z.string().nullable(),
  on_scene_time: z.string().nullable(),
  controlled_time: z.string().nullable(),
  cleared_time: z.string().nullable(),
  units_responding: z.array(z.string()),
  personnel_on_scene: z.array(z.string()),
  casualty_civilian: z.number(),
  casualty_ff: z.number(),
  narrative: z.string().nullable(),
  actions_taken: z.array(z.string()),
  property_use: z.string().nullable(),
  raw_data: z.record(z.string(), z.unknown()),
  sync_status: z.string(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type IncidentOut = z.infer<typeof IncidentOutSchema>;

export const IncidentCreateRequestSchema = z.object({
  local_id: z.string().nullable().optional(),
  incident_type: z.string().nullable().optional(),
  location_address: z.string().nullable().optional(),
  location_lat: z.number().nullable().optional(),
  location_lng: z.number().nullable().optional(),
  alarm_time: z.string().nullable().optional(),
  dispatch_time: z.string().nullable().optional(),
  en_route_time: z.string().nullable().optional(),
  on_scene_time: z.string().nullable().optional(),
  controlled_time: z.string().nullable().optional(),
  cleared_time: z.string().nullable().optional(),
  units_responding: z.array(z.string()).optional(),
  personnel_on_scene: z.array(z.string()).optional(),
  casualty_civilian: z.number().optional(),
  casualty_ff: z.number().optional(),
  narrative: z.string().nullable().optional(),
  actions_taken: z.array(z.string()).optional(),
  property_use: z.string().nullable().optional(),
  raw_data: z.record(z.string(), z.unknown()).optional(),
});
export type IncidentCreateRequest = z.infer<typeof IncidentCreateRequestSchema>;

// ===== Imports =====

export const ImportEntityTypeSchema = z.enum([
  "apparatus",
  "personnel",
  "incidents",
]);
export type ImportEntityType = z.infer<typeof ImportEntityTypeSchema>;

export const ImportRowActionSchema = z.enum([
  "create",
  "update",
  "skip",
  "error",
]);
export type ImportRowAction = z.infer<typeof ImportRowActionSchema>;

export const ImportFieldMappingSchema = z.object({
  source_header: z.string(),
  target_field: z.string().nullable(),
  confidence: z.number(),
});
export type ImportFieldMapping = z.infer<typeof ImportFieldMappingSchema>;

export const ImportFieldMappingOverrideSchema = z.object({
  source_header: z.string(),
  target_field: z.string().nullable(),
});
export type ImportFieldMappingOverride = z.infer<
  typeof ImportFieldMappingOverrideSchema
>;

export const ImportPreviewMappingOverrideSchema = z.object({
  section_index: z.number(),
  mappings: z.array(ImportFieldMappingOverrideSchema),
});
export type ImportPreviewMappingOverride = z.infer<
  typeof ImportPreviewMappingOverrideSchema
>;

export const ImportSectionSummarySchema = z.object({
  section_index: z.number(),
  dataset_label: z.string(),
  entity_type: ImportEntityTypeSchema,
  row_count: z.number(),
  mapped_fields: z.number(),
  warnings: z.array(z.string()),
});
export type ImportSectionSummary = z.infer<typeof ImportSectionSummarySchema>;

export const ImportUploadResponseSchema = z.object({
  upload_id: z.string(),
  file_name: z.string(),
  sections: z.array(ImportSectionSummarySchema),
});
export type ImportUploadResponse = z.infer<typeof ImportUploadResponseSchema>;

export const ImportRowDiffCellSchema = z.object({
  current: z.unknown().nullable(),
  incoming: z.unknown().nullable(),
});
export type ImportRowDiffCell = z.infer<typeof ImportRowDiffCellSchema>;

export const ImportPreviewRowSchema = z.object({
  row_index: z.number(),
  action: ImportRowActionSchema,
  match_reason: z.string().nullable(),
  warnings: z.array(z.string()),
  changed_fields: z.array(z.string()),
  incoming: z.record(z.string(), z.unknown()),
  current: z.record(z.string(), z.unknown()).nullable(),
  diff: z.record(z.string(), ImportRowDiffCellSchema),
});
export type ImportPreviewRow = z.infer<typeof ImportPreviewRowSchema>;

export const ImportPreviewSectionSchema = z.object({
  section_index: z.number(),
  dataset_label: z.string(),
  entity_type: ImportEntityTypeSchema,
  mappings: z.array(ImportFieldMappingSchema),
  rows: z.array(ImportPreviewRowSchema),
  warnings: z.array(z.string()),
});
export type ImportPreviewSection = z.infer<typeof ImportPreviewSectionSchema>;

export const ImportPreviewRequestSchema = z.object({
  upload_id: z.string(),
  mapping_overrides: z.array(ImportPreviewMappingOverrideSchema).optional(),
});
export type ImportPreviewRequest = z.infer<typeof ImportPreviewRequestSchema>;

export const ImportPreviewResponseSchema = z.object({
  upload_id: z.string(),
  file_name: z.string(),
  sections: z.array(ImportPreviewSectionSchema),
});
export type ImportPreviewResponse = z.infer<typeof ImportPreviewResponseSchema>;

export const ImportCommitSummarySchema = z.object({
  entity_type: ImportEntityTypeSchema,
  created: z.number(),
  updated: z.number(),
  skipped: z.number(),
  errors: z.number(),
});
export type ImportCommitSummary = z.infer<typeof ImportCommitSummarySchema>;

export const ImportCommitResponseSchema = z.object({
  upload_id: z.string(),
  file_name: z.string(),
  summaries: z.array(ImportCommitSummarySchema),
  committed_at: z.string(),
});
export type ImportCommitResponse = z.infer<typeof ImportCommitResponseSchema>;

export const ApparatusCreateRequestSchema = z.object({
  local_id: z.string().nullable().optional(),
  unit_id: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  year: z.number().nullable().optional(),
  make: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  vin: z.string().nullable().optional(),
  mileage: z.number().nullable().optional(),
  service_status: z.string().nullable().optional(),
});
export type ApparatusCreateRequest = z.infer<
  typeof ApparatusCreateRequestSchema
>;

export const PersonnelCreateRequestSchema = z.object({
  name: z.string(),
  email: z.string().email().nullable().optional(),
  role: z.string().nullable().optional(),
  badge_number: z.string().nullable().optional(),
});
export type PersonnelCreateRequest = z.infer<
  typeof PersonnelCreateRequestSchema
>;

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
  "apparatus",
  "voice_logs",
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
