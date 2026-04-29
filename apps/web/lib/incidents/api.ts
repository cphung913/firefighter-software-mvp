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
