"use client";

import { db, type SyncTable } from "@/lib/db";
import { apiFetch } from "@/lib/api/client";
import { useSyncStore } from "@/store/sync-store";
import { flushAudioQueue } from "@/lib/voice/audio-queue";

interface SyncedRef {
  table: SyncTable;
  local_id: string;
  server_id: string;
  updated_at: string;
}

interface SyncConflict {
  table: SyncTable;
  local_id: string;
  reason: string;
  server_record: Record<string, unknown> & { id: string; updated_at: string };
  client_record: Record<string, unknown>;
}

interface PushResponse {
  synced: SyncedRef[];
  conflicts: SyncConflict[];
  server_time: string;
}

interface PullChange {
  table: SyncTable;
  record_id: string;
  data: Record<string, unknown> & { local_id?: string; updated_at: string };
  updated_at: string;
  is_deleted: boolean;
}

interface PullResponse {
  changes: PullChange[];
  server_time: string;
}

const BATCH_SIZE = 50;

let syncInFlight = false;

async function refreshPendingCount(): Promise<number> {
  const count = await db.pending_mutations.count();
  useSyncStore.getState().setPendingCount(count);
  return count;
}

export async function pushPending(): Promise<void> {
  const pending = await db.pending_mutations
    .orderBy("client_timestamp")
    .limit(BATCH_SIZE)
    .toArray();

  if (pending.length === 0) {
    await refreshPendingCount();
    return;
  }

  const payload = {
    mutations: pending.map((m) => ({
      table: m.table,
      local_id: m.local_id,
      operation: m.operation,
      data: m.data,
      updated_at: m.updated_at,
      client_timestamp: m.client_timestamp,
    })),
  };

  const res = await apiFetch<PushResponse>("/api/v1/sync/push", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await db.transaction(
    "rw",
    [db.pending_mutations, ...allTableHandles()],
    async () => {
      for (const ref of res.synced) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const table = db[ref.table] as any;
        const existing = await table.get(ref.local_id);
        if (existing) {
          await table.put({
            ...existing,
            server_id: ref.server_id,
            updated_at: ref.updated_at,
            _sync_status: "synced",
            _dirty_fields: [],
          });
        }
        const queued = await db.pending_mutations
          .where({ table: ref.table, local_id: ref.local_id })
          .toArray();
        for (const q of queued) {
          if (q.id !== undefined) await db.pending_mutations.delete(q.id);
        }
      }

      for (const conflict of res.conflicts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const table = db[conflict.table] as any;
        const existing = await table.get(conflict.local_id);
        if (existing) {
          await table.put({
            ...existing,
            _sync_status: "conflict",
            // Store server snapshot so the conflict resolver can show a diff
            _conflict_server_snapshot: conflict.server_record,
          });
        }
      }
    }
  );

  await refreshPendingCount();
}

export async function pullSince(): Promise<void> {
  const sinceRow = await db.sync_state.get("main");
  const since = sinceRow?.last_sync_at ?? null;

  const path = since
    ? `/api/v1/sync/pull?since=${encodeURIComponent(since)}`
    : "/api/v1/sync/pull";
  const res = await apiFetch<PullResponse>(path);

  await db.transaction("rw", allTableHandles(), async () => {
    for (const change of res.changes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = db[change.table] as any;
      const localId =
        (change.data.local_id as string | undefined) ?? change.record_id;
      const existing = await table.get(localId);
      if (existing && existing._sync_status === "pending") {
        // local has unsynced edits — don't clobber; will surface as conflict on push
        continue;
      }
      if (
        existing &&
        existing.updated_at &&
        existing.updated_at > change.updated_at
      ) {
        continue;
      }
      if (change.is_deleted) {
        await table.delete(localId);
        continue;
      }
      await table.put({
        ...change.data,
        local_id: localId,
        server_id: change.record_id,
        updated_at: change.updated_at,
        _sync_status: "synced",
        _dirty_fields: [],
      });
    }
  });

  await db.sync_state.put({ key: "main", last_sync_at: res.server_time });
  useSyncStore.getState().setLastSyncAt(res.server_time);
}

// Must include every table in SyncTable (lib/db/schema.ts) so push/pull transactions cover all sync-able tables.
function allTableHandles() {
  return [
    db.incidents,
    db.apparatus,
    db.equipment,
    db.equipment_inspections,
    db.equipment_maintenance,
    db.voice_logs,
    db.sync_state,
  ];
}

export async function runSync(): Promise<void> {
  const store = useSyncStore.getState();
  if (!store.online || syncInFlight) return;
  syncInFlight = true;
  store.setStatus("syncing");
  store.setError(null);
  try {
    await pushPending();
    await pullSince();
    await flushAudioQueue();
    store.setStatus("idle");
  } catch (err) {
    store.setStatus("error");
    store.setError(err instanceof Error ? err.message : String(err));
  } finally {
    syncInFlight = false;
  }
}

export { refreshPendingCount };
