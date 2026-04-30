"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useSyncStore } from "@/store/sync-store";
import { ApparatusStatusCard } from "@/components/dashboard/apparatus-status-card";

export default function DashboardPage() {
  // Defer online state to after mount so SSR and first client render agree.
  const storeOnline = useSyncStore((s) => s.online);
  const [online, setOnline] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOnline(storeOnline);
  }, [storeOnline]);

  const units = useLiveQuery(() => db.apparatus.orderBy("unit_id").toArray(), []);

  // Before mount, render the stable loading skeleton to match SSR output.
  if (!mounted) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Tap an apparatus to cycle its status.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-lg bg-muted" aria-hidden />
          ))}
        </div>
      </div>
    );
  }

  const isLoading = units === undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Tap an apparatus to cycle its status.</p>
      </div>

      {!online && (
        <div
          role="status"
          className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
        >
          Offline — showing last-known status. Changes will sync when reconnected.
        </div>
      )}

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-lg bg-muted" aria-hidden />
          ))}
        </div>
      )}

      {!isLoading && units.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          No apparatus on record. Add units in the Assets section.
        </div>
      )}

      {!isLoading && units.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((unit) => (
            <ApparatusStatusCard
              key={unit.local_id}
              unit={unit}
              isOffline={!online}
            />
          ))}
        </div>
      )}
    </div>
  );
}
