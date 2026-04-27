"use client";

import {
  IncidentBootstrapSchema,
  type ApparatusSummary,
  type IncidentBootstrap,
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

export async function hydrateIncidentBootstrap(): Promise<IncidentBootstrap> {
  const payload = IncidentBootstrapSchema.parse(
    await apiFetch<unknown>("/api/v1/incidents/bootstrap")
  );
  const cachedAt = new Date().toISOString();

  await db.transaction(
    "rw",
    db.apparatus,
    db.department_users,
    async () => {
      for (const apparatus of payload.apparatus) {
        const localId = apparatus.local_id ?? apparatus.id;
        const existing = await db.apparatus.get(localId);

        if (existing?._sync_status === "pending") {
          continue;
        }

        await db.apparatus.put(apparatusToRecord(apparatus, cachedAt));
      }

      for (const user of payload.users) {
        await db.department_users.put({
          ...user,
          cached_at: cachedAt,
        });
      }
    }
  );

  return payload;
}
