"use client";

import {
  ApparatusCreateRequestSchema,
  ApparatusSummarySchema,
  type ApparatusCreateRequest,
  type ApparatusSummary,
} from "@vfd/shared-types";
import { z } from "zod";

import { apiFetch } from "@/lib/api/client";

export async function listApparatus(): Promise<ApparatusSummary[]> {
  const data = await apiFetch<unknown[]>("/api/v1/assets/apparatus");
  return z.array(ApparatusSummarySchema).parse(data);
}

export async function createApparatus(
  payload: ApparatusCreateRequest
): Promise<ApparatusSummary> {
  const body = ApparatusCreateRequestSchema.parse(payload);
  return ApparatusSummarySchema.parse(
    await apiFetch<unknown>("/api/v1/assets/apparatus", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

export async function updateApparatusStatus(
  apparatusId: string,
  serviceStatus: string
): Promise<ApparatusSummary> {
  return ApparatusSummarySchema.parse(
    await apiFetch<unknown>(`/api/v1/assets/apparatus/${apparatusId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ service_status: serviceStatus }),
    })
  );
}
