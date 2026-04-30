"use client";

import { useState } from "react";
import { useSyncStore } from "@/store/sync-store";
import { cn } from "@/lib/utils";
import { PendingDrawer } from "./pending-drawer";

export function SyncIndicator() {
  const online = useSyncStore((s) => s.online);
  const status = useSyncStore((s) => s.status);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isClickable = !online || pendingCount > 0 || status === "error";

  let dotClass = "bg-emerald-500";
  let label = "Synced";

  if (!online) {
    dotClass = "bg-red-500";
    label = pendingCount > 0 ? `Offline — ${pendingCount} pending` : "Offline";
  } else if (status === "syncing" || pendingCount > 0) {
    dotClass = "bg-amber-500";
    label = pendingCount > 0 ? `Syncing ${pendingCount}…` : "Syncing…";
  } else if (status === "error") {
    dotClass = "bg-red-500";
    label = "Sync error";
  } else if (lastSyncAt) {
    label = "Synced";
  }

  return (
    <>
      <button
        onClick={() => isClickable && setDrawerOpen(true)}
        disabled={!isClickable}
        aria-label={isClickable ? `${label} — tap for details` : label}
        className={cn(
          "flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors",
          isClickable && "cursor-pointer hover:bg-muted"
        )}
      >
        <span
          className={cn("inline-block h-2.5 w-2.5 rounded-full", dotClass)}
          aria-hidden
        />
        <span>{label}</span>
      </button>

      <PendingDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
