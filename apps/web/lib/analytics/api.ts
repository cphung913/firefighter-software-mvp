import { apiFetch } from "@/lib/api/client";

export interface ResponseTimeSummary {
  period_days: number;
  total_incidents: number;
  incidents_with_response_data: number;
  avg_turnout_seconds: number | null;
  avg_travel_seconds: number | null;
  avg_total_response_seconds: number | null;
  p90_total_response_seconds: number | null;
  nfpa_1720_compliance_pct: number | null;
  nfpa_benchmark_seconds: number;
  by_incident_type: Array<{
    incident_type: string;
    count: number;
    avg_total_response_seconds: number | null;
  }>;
}

export interface TrendWeek {
  week_start: string;
  incident_count: number;
  avg_total_response_seconds: number | null;
  avg_turnout_seconds: number | null;
}

export interface ResponseTimeIncident {
  incident_id: string;
  incident_number: string | null;
  incident_type: string | null;
  alarm_time: string | null;
  location_address: string | null;
  turnout_seconds: number | null;
  travel_seconds: number | null;
  total_response_seconds: number | null;
  meets_nfpa_1720: boolean | null;
}

export function formatSeconds(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export async function fetchResponseTimeSummary(
  days?: number,
  incidentType?: string
): Promise<ResponseTimeSummary> {
  const params = new URLSearchParams();
  if (days !== undefined) params.set("days", String(days));
  if (incidentType !== undefined && incidentType !== "") {
    params.set("incident_type", incidentType);
  }
  const q = params.toString();
  const path = `/api/v1/analytics/response-times/summary${q ? `?${q}` : ""}`;
  return apiFetch<ResponseTimeSummary>(path);
}

export async function fetchResponseTimeTrend(
  days?: number
): Promise<{ weeks: TrendWeek[] }> {
  const params = new URLSearchParams();
  if (days !== undefined) params.set("days", String(days));
  const q = params.toString();
  const path = `/api/v1/analytics/response-times/trend${q ? `?${q}` : ""}`;
  return apiFetch<{ weeks: TrendWeek[] }>(path);
}

export async function fetchResponseTimeIncidents(
  days?: number,
  limit?: number
): Promise<ResponseTimeIncident[]> {
  const params = new URLSearchParams();
  if (days !== undefined) params.set("days", String(days));
  if (limit !== undefined) params.set("limit", String(limit));
  const q = params.toString();
  const path = `/api/v1/analytics/response-times/incidents${q ? `?${q}` : ""}`;
  return apiFetch<ResponseTimeIncident[]>(path);
}
