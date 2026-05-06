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
  "equipment",
  "equipment_inspections",
  "equipment_maintenance",
  "training_drills",
  "training_attendees",
  "certifications",
  "leave_requests",
  "shift_trades",
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

// ===== Equipment =====

export const EquipmentSchema = z.object({
  id: z.string().uuid(),
  local_id: z.string().nullable().optional(),
  equipment_type: z.string(),
  identifier: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  year_manufactured: z.number().nullable().optional(),
  assigned_apparatus_id: z.string().uuid().nullable().optional(),
  status: z.string(),
  purchase_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  raw_data: z.record(z.string(), z.unknown()).nullable().optional(),
  next_inspection_due: z.string().nullable().optional(),
  last_inspection_date: z.string().nullable().optional(),
});
export type Equipment = z.infer<typeof EquipmentSchema>;

export const EquipmentCreateRequestSchema = z.object({
  local_id: z.string().nullable().optional(),
  equipment_type: z.string().optional(),
  identifier: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  year_manufactured: z.number().nullable().optional(),
  assigned_apparatus_id: z.string().uuid().nullable().optional(),
  status: z.string().optional(),
  purchase_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  raw_data: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type EquipmentCreateRequest = z.infer<typeof EquipmentCreateRequestSchema>;

export const EquipmentInspectionSchema = z.object({
  id: z.string().uuid(),
  local_id: z.string().nullable().optional(),
  equipment_id: z.string().uuid().nullable().optional(),
  equipment_local_id: z.string().nullable().optional(),
  inspection_type: z.string().nullable().optional(),
  inspection_date: z.string().nullable().optional(),
  passed: z.boolean(),
  inspector_name: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  next_due: z.string().nullable().optional(),
  raw_data: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type EquipmentInspection = z.infer<typeof EquipmentInspectionSchema>;

export const EquipmentMaintenanceSchema = z.object({
  id: z.string().uuid(),
  local_id: z.string().nullable().optional(),
  equipment_id: z.string().uuid().nullable().optional(),
  equipment_local_id: z.string().nullable().optional(),
  maintenance_type: z.string().nullable().optional(),
  maintenance_date: z.string().nullable().optional(),
  performed_by: z.string().nullable().optional(),
  cost: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  out_of_service_start: z.string().nullable().optional(),
  out_of_service_end: z.string().nullable().optional(),
});
export type EquipmentMaintenance = z.infer<typeof EquipmentMaintenanceSchema>;

// ===== Scheduling =====

export const ShiftPatternSchema = z.object({
  id: z.string().uuid(),
  department_id: z.string().uuid(),
  name: z.string(),
  pattern_type: z.string(),
  cycle_length_days: z.number(),
  on_days: z.number(),
  off_days: z.number(),
  kelly_day_interval: z.number().nullable(),
  start_date: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ShiftPattern = z.infer<typeof ShiftPatternSchema>;

export const ShiftGroupSchema = z.object({
  id: z.string().uuid(),
  department_id: z.string().uuid(),
  pattern_id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  cycle_offset_days: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ShiftGroup = z.infer<typeof ShiftGroupSchema>;

export const ShiftAssignmentSchema = z.object({
  id: z.string().uuid(),
  department_id: z.string().uuid(),
  user_id: z.string().uuid(),
  group_id: z.string().uuid(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ShiftAssignment = z.infer<typeof ShiftAssignmentSchema>;

export const LeaveRequestSchema = z.object({
  id: z.string().uuid(),
  department_id: z.string().uuid(),
  user_id: z.string().uuid(),
  leave_type: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  notes: z.string().nullable(),
  status: z.string(),
  reviewed_by: z.string().uuid().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type LeaveRequest = z.infer<typeof LeaveRequestSchema>;

export const LeaveRequestCreateSchema = z.object({
  leave_type: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  notes: z.string().nullable().optional(),
});
export type LeaveRequestCreate = z.infer<typeof LeaveRequestCreateSchema>;

export const ShiftTradeSchema = z.object({
  id: z.string().uuid(),
  department_id: z.string().uuid(),
  requester_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  trade_date: z.string(),
  return_date: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.string(),
  approved_by: z.string().uuid().nullable(),
  approved_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ShiftTrade = z.infer<typeof ShiftTradeSchema>;

export const ShiftTradeCreateSchema = z.object({
  recipient_id: z.string().uuid(),
  trade_date: z.string(),
  return_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type ShiftTradeCreate = z.infer<typeof ShiftTradeCreateSchema>;

export const CalendarUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  badge_number: z.string().nullable(),
  group_name: z.string(),
  group_color: z.string(),
});
export type CalendarUser = z.infer<typeof CalendarUserSchema>;

export const CalendarDaySchema = z.object({
  date: z.string(),
  on_duty: z.array(CalendarUserSchema),
  leave_count: z.number(),
  trade_count: z.number(),
  staffing_ok: z.boolean(),
});
export type CalendarDay = z.infer<typeof CalendarDaySchema>;

export const SchedulingBootstrapSchema = z.object({
  patterns: z.array(ShiftPatternSchema),
  groups: z.array(ShiftGroupSchema),
  my_assignment: ShiftAssignmentSchema.nullable(),
});
export type SchedulingBootstrap = z.infer<typeof SchedulingBootstrapSchema>;

// ===== Training =====

export const TrainingAttendeeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  badge_number: z.string().nullable(),
  role: z.string(),
});
export type TrainingAttendee = z.infer<typeof TrainingAttendeeSchema>;

export const TrainingDrillSchema = z.object({
  id: z.string().uuid(),
  department_id: z.string().uuid(),
  drill_type: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  drill_date: z.string(),
  hours: z.number(),
  instructor: z.string().nullable(),
  location: z.string().nullable(),
  iso_category: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  attendee_count: z.number(),
  attendees: z.array(TrainingAttendeeSchema).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type TrainingDrill = z.infer<typeof TrainingDrillSchema>;

export const TrainingDrillCreateSchema = z.object({
  drill_type: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  drill_date: z.string(),
  hours: z.number(),
  instructor: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  iso_category: z.string().nullable().optional(),
  attendee_ids: z.array(z.string().uuid()).optional(),
});
export type TrainingDrillCreate = z.infer<typeof TrainingDrillCreateSchema>;

export const CertificationSchema = z.object({
  id: z.string().uuid(),
  department_id: z.string().uuid(),
  user_id: z.string().uuid(),
  cert_type: z.string(),
  cert_number: z.string().nullable(),
  issuing_body: z.string().nullable(),
  issued_date: z.string(),
  expiry_date: z.string(),
  status: z.string(),
  document_ref: z.string().nullable(),
  days_until_expiry: z.number().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Certification = z.infer<typeof CertificationSchema>;

export const CertificationCreateSchema = z.object({
  user_id: z.string().uuid(),
  cert_type: z.string(),
  cert_number: z.string().nullable().optional(),
  issuing_body: z.string().nullable().optional(),
  issued_date: z.string(),
  expiry_date: z.string(),
  status: z.string().optional(),
  document_ref: z.string().nullable().optional(),
});
export type CertificationCreate = z.infer<typeof CertificationCreateSchema>;

export const MemberDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  badge_number: z.string().nullable(),
  shift_assignment: ShiftAssignmentSchema.nullable(),
  shift_group: ShiftGroupSchema.nullable(),
  total_hours_ytd: z.number(),
  total_drills_ytd: z.number(),
  certifications: z.array(CertificationSchema),
  expiring_soon: z.number(),
});
export type MemberDetail = z.infer<typeof MemberDetailSchema>;

export const ISOReportSchema = z.object({
  department_id: z.string().uuid(),
  year: z.number(),
  total_training_hours: z.number(),
  total_drills: z.number(),
  member_compliance_pct: z.number(),
  categories: z.array(z.object({
    category: z.string(),
    total_hours: z.number(),
    drill_count: z.number(),
    member_count: z.number(),
  })),
  generated_at: z.string(),
});
export type ISOReport = z.infer<typeof ISOReportSchema>;
