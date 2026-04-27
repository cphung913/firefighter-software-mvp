"use client";

import { create } from "zustand";

export type SyncRunStatus = "idle" | "syncing" | "error";

interface SyncState {
  online: boolean;
  status: SyncRunStatus;
  pendingCount: number;
  lastSyncAt: string | null;
  errorMessage: string | null;
  setOnline: (online: boolean) => void;
  setStatus: (status: SyncRunStatus) => void;
  setPendingCount: (n: number) => void;
  setLastSyncAt: (iso: string) => void;
  setError: (msg: string | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  status: "idle",
  pendingCount: 0,
  lastSyncAt: null,
  errorMessage: null,
  setOnline: (online) => set({ online }),
  setStatus: (status) => set({ status }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
  setError: (errorMessage) => set({ errorMessage }),
}));
