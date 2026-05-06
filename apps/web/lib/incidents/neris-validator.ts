export type NerisIssue = {
  field: string;
  severity: "error" | "warning";
  message: string;
};

export type NerisFormInput = {
  incident_number: string;
  incident_type: string;
  location_address: string;
  location_lat: string;
  location_lng: string;
  alarm_time: string;
  dispatch_time: string;
  en_route_time: string;
  on_scene_time: string;
  controlled_time: string;
  cleared_time: string;
  units_responding: string[];
  personnel_on_scene: string[];
  narrative: string;
  actions_taken: string[];
  property_use: string;
  casualty_civilian?: string;
  casualty_ff?: string;
};

const ACTIONS_REQUIRED_TYPES = new Set([
  "structure_fire",
  "vehicle_fire",
  "rescue_extrication",
  "hazmat_gas_leak",
]);

const PROPERTY_USE_WARNING_TYPES = new Set(["structure_fire", "vehicle_fire"]);

const NARRATIVE_EXEMPT_TYPES = new Set(["false_alarm", "public_service"]);

function parseTime(value: string): number | null {
  if (!value.trim()) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export function validateNerisReadiness(form: NerisFormInput): NerisIssue[] {
  const issues: NerisIssue[] = [];

  if (!form.incident_type.trim()) {
    issues.push({
      field: "incident_type",
      severity: "error",
      message: "Incident type is required for NERIS.",
    });
  }

  if (!form.alarm_time.trim()) {
    issues.push({
      field: "alarm_time",
      severity: "error",
      message: "Alarm time is required for NERIS.",
    });
  }

  const hasAddress = form.location_address.trim().length > 0;
  const hasLat = form.location_lat.trim().length > 0;
  const hasLng = form.location_lng.trim().length > 0;
  if (!hasAddress && !(hasLat && hasLng)) {
    issues.push({
      field: "location",
      severity: "error",
      message: "Provide a location address or both latitude and longitude.",
    });
  }

  if (!form.units_responding.length) {
    issues.push({
      field: "units_responding",
      severity: "error",
      message: "At least one responding unit is required for NERIS.",
    });
  }

  const type = form.incident_type.trim();
  if (type && !NARRATIVE_EXEMPT_TYPES.has(type) && form.narrative.trim().length < 20) {
    issues.push({
      field: "narrative",
      severity: "error",
      message: "Narrative should be at least 20 characters for this incident type.",
    });
  }

  if (type && ACTIONS_REQUIRED_TYPES.has(type) && form.actions_taken.length === 0) {
    issues.push({
      field: "actions_taken",
      severity: "error",
      message: "Select at least one action taken for this incident type.",
    });
  }

  if (type && PROPERTY_USE_WARNING_TYPES.has(type) && !form.property_use.trim()) {
    issues.push({
      field: "property_use",
      severity: "warning",
      message: "Property use is recommended for structure and vehicle fires.",
    });
  }

  if (!form.personnel_on_scene.length) {
    issues.push({
      field: "personnel_on_scene",
      severity: "warning",
      message: "Document personnel on scene when possible.",
    });
  }

  if (!form.on_scene_time.trim()) {
    issues.push({
      field: "on_scene_time",
      severity: "warning",
      message: "On-scene time improves timeline completeness.",
    });
  }

  if (!form.cleared_time.trim()) {
    issues.push({
      field: "cleared_time",
      severity: "warning",
      message: "Cleared time is recommended for a complete timeline.",
    });
  }

  const alarmT = parseTime(form.alarm_time);
  const dispatchT = parseTime(form.dispatch_time);
  const enRouteT = parseTime(form.en_route_time);
  const onSceneT = parseTime(form.on_scene_time);

  if (alarmT != null && dispatchT != null && dispatchT < alarmT) {
    issues.push({
      field: "dispatch_time",
      severity: "warning",
      message: "Dispatch time should be on or after alarm time.",
    });
  }

  if (dispatchT != null && enRouteT != null && enRouteT < dispatchT) {
    issues.push({
      field: "en_route_time",
      severity: "warning",
      message: "En route time should be on or after dispatch time.",
    });
  }

  if (enRouteT != null && onSceneT != null && onSceneT < enRouteT) {
    issues.push({
      field: "on_scene_time",
      severity: "warning",
      message: "On-scene time should be on or after en route time.",
    });
  }

  return issues;
}

export function nerisScore(issues: NerisIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "error") score -= 15;
    else score -= 5;
  }
  return Math.max(0, score);
}
