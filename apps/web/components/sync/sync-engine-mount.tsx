"use client";

import { useSyncEngine } from "@/lib/sync/use-sync-engine";

export function SyncEngineMount() {
  useSyncEngine();
  return null;
}
