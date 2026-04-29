"use client";

import {
  ApparatusCreateRequestSchema,
  ApparatusSummarySchema,
  type ApparatusCreateRequest,
  type ApparatusSummary,
} from "@vfd/shared-types";

import { apiFetch } from "@/lib/api/client";

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
