"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

import { refreshPendingCount, runSync } from "./engine";
import { useSyncStore } from "@/store/sync-store";

const POLL_INTERVAL_MS = 30_000;

export function useSyncEngine() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;

    const setOnline = (online: boolean) =>
      useSyncStore.getState().setOnline(online);

    const onOnline = () => {
      setOnline(true);
      void runSync();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    void refreshPendingCount();
    void runSync();

    const interval = window.setInterval(() => {
      void runSync();
    }, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(interval);
    };
  }, [status]);
}
