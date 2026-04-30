"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { db, type ApparatusRecord } from "@/lib/db";
import { updateApparatusStatus } from "@/lib/assets/api";

type ServiceStatus = "available" | "responding" | "out_of_service";

const STATUS_CYCLE: ServiceStatus[] = ["available", "responding", "out_of_service"];

const STATUS_LABEL: Record<ServiceStatus, string> = {
  available: "Available",
  responding: "Responding",
  out_of_service: "Out of Service",
};

const STATUS_COLOR: Record<ServiceStatus, string> = {
  available: "bg-green-500",
  responding: "bg-yellow-400",
  out_of_service: "bg-red-500",
};

const STATUS_TEXT: Record<ServiceStatus, string> = {
  available: "text-green-700 dark:text-green-400",
  responding: "text-yellow-700 dark:text-yellow-400",
  out_of_service: "text-red-700 dark:text-red-400",
};

interface Props {
  unit: ApparatusRecord;
  isOffline: boolean;
}

function nextStatus(current: string): ServiceStatus {
  const idx = STATUS_CYCLE.indexOf(current as ServiceStatus);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

function normalizeStatus(value: string | undefined): ServiceStatus {
  return STATUS_CYCLE.includes(value as ServiceStatus)
    ? (value as ServiceStatus)
    : "available";
}

export function ApparatusStatusCard({ unit, isOffline }: Props) {
  // Optimistic UI status; re-syncs to prop when prop changes (e.g., another device flipped it).
  const [status, setStatus] = useState<ServiceStatus>(() => normalizeStatus(unit.service_status));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setStatus(normalizeStatus(unit.service_status));
  }, [unit.service_status]);

  const displayName =
    [unit.unit_id, unit.make, unit.model].filter(Boolean).join(" ") ||
    "Unknown Unit";

  function handleTap() {
    if (!unit.local_id) return;
    const next = nextStatus(status);
    setStatus(next);

    startTransition(async () => {
      const now = new Date().toISOString();
      const localId = unit.local_id;

      const dirtyFields = Array.from(
        new Set([...(unit._dirty_fields ?? []), "service_status"])
      );

      // Always write to Dexie first (offline-first).
      await db.apparatus.put({
        ...unit,
        service_status: next,
        updated_at: now,
        _sync_status: "pending",
        _dirty_fields: dirtyFields,
      });

      if (!isOffline && unit.server_id) {
        try {
          await updateApparatusStatus(unit.server_id, next);
          await db.apparatus.put({
            ...unit,
            service_status: next,
            updated_at: now,
            _sync_status: "synced",
            _dirty_fields: [],
          });
          return;
        } catch {
          // Fall through and queue for later sync.
        }
      }

      await db.pending_mutations.add({
        table: "apparatus",
        local_id: localId,
        operation: "upsert",
        data: { service_status: next },
        updated_at: now,
        client_timestamp: now,
      });
    });
  }

  return (
    <Card
      className={`cursor-pointer select-none transition-opacity ${isPending ? "opacity-60" : ""}`}
      onClick={handleTap}
      role="button"
      aria-label={`${displayName} — ${STATUS_LABEL[status]}. Tap to change status.`}
    >
      <CardContent className="flex items-center gap-4 p-4 min-h-[72px]">
        <span
          className={`inline-block h-4 w-4 shrink-0 rounded-full ${STATUS_COLOR[status]}`}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium leading-tight">{displayName}</p>
          {unit.type && (
            <p className="text-xs text-muted-foreground truncate">{unit.type}</p>
          )}
        </div>
        <span className={`text-sm font-semibold shrink-0 ${STATUS_TEXT[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </CardContent>
    </Card>
  );
}
