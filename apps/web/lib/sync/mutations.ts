"use client";

import { db, type Operation, type SyncTable } from "@/lib/db";
import { useSyncStore } from "@/store/sync-store";

export interface EnqueueArgs {
  table: SyncTable;
  local_id?: string;
  operation?: Operation;
  data: Record<string, unknown>;
}

function newLocalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Write a record to its target Dexie store AND queue a mutation to ship to the server.
 * Returns the local_id used (caller may want to navigate to the new record).
 */
export async function enqueueMutation({
  table,
  local_id,
  operation = "upsert",
  data,
}: EnqueueArgs): Promise<string> {
  const id = local_id ?? newLocalId();
  const now = new Date().toISOString();

  const record = {
    ...data,
    local_id: id,
    server_id: null,
    updated_at: now,
    _sync_status: "pending" as const,
    _dirty_fields: Object.keys(data),
  };

  await db.transaction(
    "rw",
    db[table],
    db.pending_mutations,
    async () => {
      if (operation === "delete") {
        await db[table].delete(id);
      } else {
        // dexie's put requires the keyPath to be present
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db[table] as any).put(record);
      }
      await db.pending_mutations.add({
        table,
        local_id: id,
        operation,
        data: { ...data, local_id: id, updated_at: now },
        updated_at: now,
        client_timestamp: now,
      });
    }
  );

  useSyncStore.getState().setPendingCount(await db.pending_mutations.count());

  return id;
}
