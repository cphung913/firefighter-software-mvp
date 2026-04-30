"use client";

import { db } from "@/lib/db";
import { apiFetch } from "@/lib/api/client";
import type { IncidentBootstrap } from "@vfd/shared-types";

const BOOTSTRAP_CACHE_KEY = "bootstrap_seeded_at";
// Re-seed if cache is older than 1 hour
const CACHE_TTL_MS = 60 * 60 * 1000;

function isCacheStale(): boolean {
  if (typeof localStorage === "undefined") return true;
  const raw = localStorage.getItem(BOOTSTRAP_CACHE_KEY);
  if (!raw) return true;
  return Date.now() - parseInt(raw, 10) > CACHE_TTL_MS;
}

function markCacheFresh(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(BOOTSTRAP_CACHE_KEY, String(Date.now()));
}

export async function seedBootstrapData(): Promise<void> {
  if (!isCacheStale()) return;

  let data: IncidentBootstrap;
  try {
    data = await apiFetch<IncidentBootstrap>("/api/v1/incidents/bootstrap");
  } catch {
    // Offline at login — skip seeding; sync pull will catch up on reconnect
    return;
  }

  const now = new Date().toISOString();

  await db.transaction("rw", [db.apparatus, db.department_users], async () => {
    // Seed apparatus — only update records that aren't pending local changes.
    // Prefer the server-side local_id (so offline mutations match the right row);
    // fall back to the server uuid for rows that have no local_id yet.
    for (const unit of data.apparatus) {
      const localId = unit.local_id ?? unit.id;
      const existing = await db.apparatus.get(localId);
      if (existing && existing._sync_status === "pending") continue;
      await db.apparatus.put({
        local_id: localId,
        server_id: unit.id,
        unit_id: unit.unit_id ?? null,
        type: unit.type ?? null,
        year: unit.year ?? null,
        make: unit.make ?? null,
        model: unit.model ?? null,
        vin: unit.vin ?? null,
        service_status: unit.service_status,
        mileage: unit.mileage ?? null,
        updated_at: now,
        _sync_status: "synced",
        _dirty_fields: [],
      });
    }

    // Seed roster
    await db.department_users.clear();
    for (const user of data.users) {
      await db.department_users.put({
        id: user.id,
        name: user.name,
        role: user.role,
        badge_number: user.badge_number,
        cached_at: now,
      });
    }
  });

  markCacheFresh();
}
