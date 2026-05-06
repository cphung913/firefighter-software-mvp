"use client";

import { db } from "@/lib/db";
import { apiFetch } from "@/lib/api/client";
import type {
  IncidentBootstrap,
  ShiftPattern,
  ShiftGroup,
  ShiftAssignment,
} from "@vfd/shared-types";

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

  let data: IncidentBootstrap & {
    shift_patterns?: ShiftPattern[];
    shift_groups?: ShiftGroup[];
    shift_assignments?: ShiftAssignment[];
    my_assignment?: ShiftAssignment | null;
    expiring_certs_count?: number;
  };
  try {
    data = await apiFetch<typeof data>("/api/v1/incidents/bootstrap");
  } catch {
    // Offline at login — skip seeding; sync pull will catch up on reconnect
    return;
  }

  const now = new Date().toISOString();

  await db.transaction(
    "rw",
    [db.apparatus, db.department_users, db.shift_patterns, db.shift_groups, db.shift_assignments],
    async () => {
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

      // Seed scheduling data (if included in the bootstrap response)
      await db.shift_patterns.clear();
      for (const pattern of data.shift_patterns ?? []) {
        await db.shift_patterns.put({
          id: pattern.id,
          department_id: pattern.department_id,
          name: pattern.name,
          pattern_type: pattern.pattern_type,
          cycle_length_days: pattern.cycle_length_days,
          on_days: pattern.on_days,
          off_days: pattern.off_days,
          kelly_day_interval: pattern.kelly_day_interval,
          start_date: pattern.start_date,
          is_active: pattern.is_active,
          cached_at: now,
        });
      }

      await db.shift_groups.clear();
      for (const group of data.shift_groups ?? []) {
        await db.shift_groups.put({
          id: group.id,
          department_id: group.department_id,
          pattern_id: group.pattern_id,
          name: group.name,
          color: group.color,
          cycle_offset_days: group.cycle_offset_days,
          cached_at: now,
        });
      }

      await db.shift_assignments.clear();
      for (const assignment of data.shift_assignments ?? []) {
        await db.shift_assignments.put({
          id: assignment.id,
          department_id: assignment.department_id,
          user_id: assignment.user_id,
          group_id: assignment.group_id,
          start_date: assignment.start_date,
          end_date: assignment.end_date,
          cached_at: now,
        });
      }
    }
  );

  markCacheFresh();
}
