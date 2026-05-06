import { apiFetch } from "@/lib/api/client";
import type {
  TrainingDrill,
  TrainingDrillCreate,
  Certification,
  CertificationCreate,
  ISOReport,
} from "@vfd/shared-types";

export async function listDrills(params?: {
  from_date?: string;
  to_date?: string;
  drill_type?: string;
}): Promise<TrainingDrill[]> {
  const qs = new URLSearchParams();
  if (params?.from_date) qs.set("from_date", params.from_date);
  if (params?.to_date) qs.set("to_date", params.to_date);
  if (params?.drill_type) qs.set("drill_type", params.drill_type);
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch<TrainingDrill[]>(`/api/v1/training/drills${query}`);
}

export async function createDrill(data: TrainingDrillCreate): Promise<TrainingDrill> {
  return apiFetch<TrainingDrill>("/api/v1/training/drills", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getDrill(drillId: string): Promise<TrainingDrill> {
  return apiFetch<TrainingDrill>(`/api/v1/training/drills/${drillId}`);
}

export async function updateDrill(
  drillId: string,
  data: Partial<TrainingDrillCreate>,
): Promise<TrainingDrill> {
  return apiFetch<TrainingDrill>(`/api/v1/training/drills/${drillId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteDrill(drillId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/training/drills/${drillId}`, { method: "DELETE" });
}

export async function addAttendees(drillId: string, userIds: string[]): Promise<void> {
  return apiFetch<void>(`/api/v1/training/drills/${drillId}/attendees`, {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });
}

export async function removeAttendee(drillId: string, userId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/training/drills/${drillId}/attendees/${userId}`, {
    method: "DELETE",
  });
}

export async function listCertifications(params?: {
  user_id?: string;
  expiring_days?: number;
}): Promise<Certification[]> {
  const qs = new URLSearchParams();
  if (params?.user_id) qs.set("user_id", params.user_id);
  if (params?.expiring_days) qs.set("expiring_days", String(params.expiring_days));
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch<Certification[]>(`/api/v1/training/certifications${query}`);
}

export async function createCertification(data: CertificationCreate): Promise<Certification> {
  return apiFetch<Certification>("/api/v1/training/certifications", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCertification(
  certId: string,
  data: Partial<CertificationCreate>,
): Promise<Certification> {
  return apiFetch<Certification>(`/api/v1/training/certifications/${certId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteCertification(certId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/training/certifications/${certId}`, { method: "DELETE" });
}

export async function getExpiringCertifications(days = 90): Promise<Certification[]> {
  return apiFetch<Certification[]>(`/api/v1/training/certifications/expiring?days=${days}`);
}

export async function getISOReport(year?: number): Promise<ISOReport> {
  const qs = year ? `?year=${year}` : "";
  return apiFetch<ISOReport>(`/api/v1/training/iso-report${qs}`);
}
