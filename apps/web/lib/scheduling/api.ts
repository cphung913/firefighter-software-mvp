import { apiFetch } from "@/lib/api/client";
import type {
  ShiftPattern,
  ShiftGroup,
  ShiftAssignment,
  CalendarDay,
  LeaveRequest,
  ShiftTrade,
} from "@vfd/shared-types";

export async function listShiftPatterns(): Promise<ShiftPattern[]> {
  return apiFetch<ShiftPattern[]>("/api/v1/scheduling/patterns");
}

export async function createShiftPattern(data: {
  name: string;
  pattern_type: string;
  cycle_length_days: number;
  on_days: number;
  off_days: number;
  start_date: string;
  kelly_day_interval?: number | null;
}): Promise<ShiftPattern> {
  return apiFetch<ShiftPattern>("/api/v1/scheduling/patterns", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listShiftGroups(
  patternId?: string
): Promise<ShiftGroup[]> {
  const qs = patternId ? `?pattern_id=${patternId}` : "";
  return apiFetch<ShiftGroup[]>(`/api/v1/scheduling/groups${qs}`);
}

export async function createShiftGroup(data: {
  pattern_id: string;
  name: string;
  color: string;
  cycle_offset_days: number;
}): Promise<ShiftGroup> {
  return apiFetch<ShiftGroup>("/api/v1/scheduling/groups", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listAssignments(params?: {
  userId?: string;
  groupId?: string;
}): Promise<ShiftAssignment[]> {
  const qs = new URLSearchParams();
  if (params?.userId) qs.set("user_id", params.userId);
  if (params?.groupId) qs.set("group_id", params.groupId);
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch<ShiftAssignment[]>(`/api/v1/scheduling/assignments${query}`);
}

export async function createAssignment(data: {
  user_id: string;
  group_id: string;
  start_date: string;
  end_date?: string | null;
}): Promise<ShiftAssignment> {
  return apiFetch<ShiftAssignment>("/api/v1/scheduling/assignments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getCalendar(
  start: string,
  end: string
): Promise<CalendarDay[]> {
  return apiFetch<CalendarDay[]>(
    `/api/v1/scheduling/calendar?start=${start}&end=${end}`
  );
}

export async function listLeaveRequests(): Promise<LeaveRequest[]> {
  return apiFetch<LeaveRequest[]>("/api/v1/scheduling/leave-requests");
}

export async function createLeaveRequest(data: {
  leave_type: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
}): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>("/api/v1/scheduling/leave-requests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function reviewLeaveRequest(
  id: string,
  status: "approved" | "denied"
): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/api/v1/scheduling/leave-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function cancelLeaveRequest(id: string): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/api/v1/scheduling/leave-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled" }),
  });
}

export async function listTrades(): Promise<ShiftTrade[]> {
  return apiFetch<ShiftTrade[]>("/api/v1/scheduling/trades");
}

export async function createTrade(data: {
  recipient_id: string;
  trade_date: string;
  return_date?: string | null;
  notes?: string | null;
}): Promise<ShiftTrade> {
  return apiFetch<ShiftTrade>("/api/v1/scheduling/trades", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function reviewTrade(
  id: string,
  status: "approved" | "denied"
): Promise<ShiftTrade> {
  return apiFetch<ShiftTrade>(`/api/v1/scheduling/trades/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
