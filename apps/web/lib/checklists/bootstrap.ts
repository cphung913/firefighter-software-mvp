"use client";

import {
  ChecklistBootstrapSchema,
  type ApparatusSummary,
  type ChecklistBootstrap,
} from "@vfd/shared-types";

import { apiFetch } from "@/lib/api/client";
import { db } from "@/lib/db";

function apparatusToRecord(apparatus: ApparatusSummary, cachedAt: string) {
  const localId = apparatus.local_id ?? apparatus.id;

  return {
    local_id: localId,
    server_id: apparatus.id,
    unit_id: apparatus.unit_id ?? null,
    type: apparatus.type ?? null,
    year: apparatus.year ?? null,
    make: apparatus.make ?? null,
    model: apparatus.model ?? null,
    vin: apparatus.vin ?? null,
    service_status: apparatus.service_status,
    mileage: apparatus.mileage ?? null,
    updated_at: cachedAt,
    _sync_status: "synced" as const,
    _dirty_fields: [],
  };
}

export async function hydrateChecklistBootstrap(): Promise<ChecklistBootstrap> {
  const payload = ChecklistBootstrapSchema.parse(
    await apiFetch<unknown>("/api/v1/checklists/templates")
  );
  const cachedAt = new Date().toISOString();

  await db.transaction("rw", db.checklist_templates, db.apparatus, async () => {
    for (const template of payload.templates) {
      await db.checklist_templates.put({
        ...template,
        cached_at: cachedAt,
      });
    }

    for (const apparatus of payload.apparatus) {
      const localId = apparatus.local_id ?? apparatus.id;
      const existing = await db.apparatus.get(localId);

      if (existing?._sync_status === "pending") {
        continue;
      }

      await db.apparatus.put(apparatusToRecord(apparatus, cachedAt));
    }
  });

  return payload;
}
