import { apiFetch } from "@/lib/api/client";
import type { PersonnelCreateRequest } from "@vfd/shared-types";

export interface RosterMember {
  id: string;
  name: string;
  email: string;
  role: string;
  badge_number: string | null;
  created_at: string;
}

export interface MemberDetail extends RosterMember {
  shift_assignment: {
    id: string;
    group_id: string;
    group_name: string;
    group_color: string;
    start_date: string;
    end_date: string | null;
  } | null;
  training_hours_ytd: number;
  cert_count: number;
  expiring_cert_count: number;
}

export interface MemberUpdateRequest {
  name?: string;
  email?: string;
  role?: string;
  badge_number?: string | null;
}

export async function createPersonnel(
  data: PersonnelCreateRequest
): Promise<RosterMember> {
  return apiFetch<RosterMember>("/api/v1/roster", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listRoster(params?: {
  search?: string;
  role?: string;
}): Promise<RosterMember[]> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.role) qs.set("role", params.role);
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch<RosterMember[]>(`/api/v1/roster${query}`);
}

export async function getMemberDetail(userId: string): Promise<MemberDetail> {
  return apiFetch<MemberDetail>(`/api/v1/roster/${userId}`);
}

export async function updateMember(
  userId: string,
  data: MemberUpdateRequest
): Promise<RosterMember> {
  return apiFetch<RosterMember>(`/api/v1/roster/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteMember(userId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/roster/${userId}`, { method: "DELETE" });
}
