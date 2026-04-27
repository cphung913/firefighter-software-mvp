"use client";

import {
  AssetBootstrapSchema,
  type ApparatusSummary,
  type AssetBootstrap,
  type PpeAsset,
  type ScbaAsset,
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

function ppeToRecord(item: PpeAsset, cachedAt: string) {
  return {
    local_id: item.local_id ?? item.id,
    server_id: item.id,
    item_type: item.item_type,
    serial_number: item.serial_number ?? null,
    assigned_to: item.assigned_to ?? null,
    manufacture_date: item.manufacture_date ?? null,
    purchase_date: item.purchase_date ?? null,
    last_inspection: item.last_inspection ?? null,
    retired_at: item.retired_at ?? null,
    updated_at: cachedAt,
    _sync_status: "synced" as const,
    _dirty_fields: [],
  };
}

function scbaToRecord(unit: ScbaAsset, cachedAt: string) {
  return {
    local_id: unit.local_id ?? unit.id,
    server_id: unit.id,
    serial_number: unit.serial_number ?? null,
    manufacturer: unit.manufacturer ?? null,
    assigned_to: unit.assigned_to ?? null,
    cylinder_hydro_date: unit.cylinder_hydro_date ?? null,
    regulator_service_date: unit.regulator_service_date ?? null,
    updated_at: cachedAt,
    _sync_status: "synced" as const,
    _dirty_fields: [],
  };
}

export async function hydrateAssetsBootstrap(): Promise<AssetBootstrap> {
  const payload = AssetBootstrapSchema.parse(
    await apiFetch<unknown>("/api/v1/assets/bootstrap")
  );
  const cachedAt = new Date().toISOString();

  await db.transaction(
    "rw",
    db.apparatus,
    db.ppe_items,
    db.scba_units,
    db.department_users,
    async () => {
      for (const apparatus of payload.apparatus) {
        const localId = apparatus.local_id ?? apparatus.id;
        const existing = await db.apparatus.get(localId);
        if (existing?._sync_status === "pending") continue;
        await db.apparatus.put(apparatusToRecord(apparatus, cachedAt));
      }

      for (const item of payload.ppe_items) {
        const localId = item.local_id ?? item.id;
        const existing = await db.ppe_items.get(localId);
        if (existing?._sync_status === "pending") continue;
        await db.ppe_items.put(ppeToRecord(item, cachedAt));
      }

      for (const unit of payload.scba_units) {
        const localId = unit.local_id ?? unit.id;
        const existing = await db.scba_units.get(localId);
        if (existing?._sync_status === "pending") continue;
        await db.scba_units.put(scbaToRecord(unit, cachedAt));
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
