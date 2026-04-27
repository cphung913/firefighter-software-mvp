"use client";

import { useSyncStore } from "@/store/sync-store";
import { cn } from "@/lib/utils";

export function SyncIndicator() {
  const online = useSyncStore((s) => s.online);
  const status = useSyncStore((s) => s.status);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);

  let dotClass = "bg-emerald-500";
  let label = "Synced";

  if (!online) {
    dotClass = "bg-red-500";
    label = pendingCount > 0 ? `Offline — ${pendingCount} pending` : "Offline";
  } else if (status === "syncing" || pendingCount > 0) {
    dotClass = "bg-amber-500";
    label =
      pendingCount > 0
        ? `Syncing ${pendingCount}…`
        : "Syncing…";
  } else if (status === "error") {
    dotClass = "bg-red-500";
    label = "Sync error";
  } else if (lastSyncAt) {
    label = "Synced";
  }

  return (
    <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium">
      <span
        className={cn("inline-block h-2.5 w-2.5 rounded-full", dotClass)}
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}
