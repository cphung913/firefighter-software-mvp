"use client";

import {
  IncidentOutSchema,
  IncidentTaxonomySchema,
  type IncidentCreateRequest,
  type IncidentOut,
  type IncidentTaxonomy,
} from "@vfd/shared-types";
import { z } from "zod";

import { apiFetch } from "@/lib/api/client";

const BulkNerisExportResponseSchema = z.object({
  exported_count: z.number(),
  incidents: z.array(z.record(z.string(), z.unknown())),
  exported_at: z.string(),
});

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function fetchIncidents(opts?: {
  limit?: number;
  offset?: number;
}): Promise<IncidentOut[]> {
  const params = new URLSearchParams();
  if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts?.offset !== undefined) params.set("offset", String(opts.offset));
  const qs = params.size > 0 ? `?${params.toString()}` : "";
  return z.array(IncidentOutSchema).parse(
    await apiFetch<unknown>(`/api/v1/incidents${qs}`)
  );
}

export async function fetchIncident(id: string): Promise<IncidentOut> {
  return IncidentOutSchema.parse(
    await apiFetch<unknown>(`/api/v1/incidents/${id}`)
  );
}

export async function createIncident(
  body: IncidentCreateRequest
): Promise<IncidentOut> {
  return IncidentOutSchema.parse(
    await apiFetch<unknown>("/api/v1/incidents", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

export async function updateIncident(
  id: string,
  body: Partial<IncidentCreateRequest>
): Promise<IncidentOut> {
  return IncidentOutSchema.parse(
    await apiFetch<unknown>(`/api/v1/incidents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    })
  );
}

export async function deleteIncident(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/incidents/${id}`, { method: "DELETE" });
}

export async function fetchTaxonomy(): Promise<IncidentTaxonomy> {
  return IncidentTaxonomySchema.parse(
    await apiFetch<unknown>("/api/v1/incidents/taxonomy")
  );
}

export async function fetchNerisJson(id: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/v1/incidents/${id}/neris`);
}

export async function bulkExportNeris(incidentIds: string[]): Promise<{
  exported_count: number;
  incidents: Record<string, unknown>[];
  exported_at: string;
}> {
  return BulkNerisExportResponseSchema.parse(
    await apiFetch<unknown>("/api/v1/incidents/export/neris", {
      method: "POST",
      body: JSON.stringify({ incident_ids: incidentIds }),
    })
  );
}

export async function markIncidentExported(id: string): Promise<IncidentOut> {
  return IncidentOutSchema.parse(
    await apiFetch<unknown>(`/api/v1/incidents/${id}/mark-exported`, {
      method: "POST",
      body: "{}",
    })
  );
}

export async function submitIncident(id: string): Promise<IncidentOut> {
  return IncidentOutSchema.parse(
    await apiFetch<unknown>(`/api/v1/incidents/${id}/submit`, {
      method: "POST",
      body: "{}",
    })
  );
}

export async function approveIncident(
  id: string,
  notes?: string | null
): Promise<IncidentOut> {
  return IncidentOutSchema.parse(
    await apiFetch<unknown>(`/api/v1/incidents/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ notes: notes ?? null }),
    })
  );
}

export async function rejectIncident(
  id: string,
  notes?: string | null
): Promise<IncidentOut> {
  return IncidentOutSchema.parse(
    await apiFetch<unknown>(`/api/v1/incidents/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ notes: notes ?? null }),
    })
  );
}

export async function fetchReviewQueue(): Promise<IncidentOut[]> {
  return z.array(IncidentOutSchema).parse(
    await apiFetch<unknown>("/api/v1/incidents/review-queue")
  );
}
