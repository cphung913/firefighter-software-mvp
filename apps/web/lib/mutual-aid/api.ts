import { apiFetch } from "@/lib/api/client";

export interface MutualAidAgency {
  id: string;
  department_id?: string;
  name: string;
  agency_type: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  radio_channel: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MutualAidAssignment {
  id: string;
  incident_id: string;
  department_id?: string;
  agency_id: string | null;
  agency_name: string | null;
  agency_name_override: string | null;
  units_assigned: string | null;
  status: string;
  notes: string | null;
  assigned_by: string | null;
  created_at: string;
  updated_at?: string;
}

export function fetchAgencies(): Promise<MutualAidAgency[]> {
  return apiFetch<MutualAidAgency[]>("/api/v1/mutual-aid/agencies");
}

export function createAgency(data: {
  name: string;
  agency_type?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  radio_channel?: string | null;
  notes?: string | null;
}): Promise<MutualAidAgency> {
  return apiFetch<MutualAidAgency>("/api/v1/mutual-aid/agencies", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchAssignments(
  incidentId: string
): Promise<MutualAidAssignment[]> {
  return apiFetch<MutualAidAssignment[]>(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/mutual-aid`
  );
}

export function createAssignment(
  incidentId: string,
  data: {
    agency_id?: string | null;
    agency_name_override?: string | null;
    units_assigned?: string | null;
    status?: string;
    notes?: string | null;
  }
): Promise<MutualAidAssignment> {
  return apiFetch<MutualAidAssignment>(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/mutual-aid`,
    { method: "POST", body: JSON.stringify(data) }
  );
}

export function updateAssignment(
  incidentId: string,
  assignmentId: string,
  data: {
    units_assigned?: string | null;
    status?: string | null;
    notes?: string | null;
  }
): Promise<MutualAidAssignment> {
  return apiFetch<MutualAidAssignment>(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/mutual-aid/${encodeURIComponent(assignmentId)}`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

export function deleteAssignment(
  incidentId: string,
  assignmentId: string
): Promise<void> {
  return apiFetch<void>(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/mutual-aid/${encodeURIComponent(assignmentId)}`,
    { method: "DELETE" }
  );
}
