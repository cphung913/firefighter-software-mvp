"use client";

import { useEffect, useState, useTransition } from "react";
import { db, type ApparatusRecord } from "@/lib/db";
import { updateApparatusStatus } from "@/lib/assets/api";
import { cn } from "@/lib/utils";

type ServiceStatus = "available" | "responding" | "out_of_service";

const STATUS_CYCLE: ServiceStatus[] = ["available", "responding", "out_of_service"];

const STATUS_LABEL: Record<ServiceStatus, string> = {
  available: "Available",
  responding: "Responding",
  out_of_service: "Out of Service",
};

const STATUS_DOT: Record<ServiceStatus, string> = {
  available: "bg-green-500",
  responding: "bg-[var(--amber)]",
  out_of_service: "bg-[var(--signal)]",
};

const STATUS_TEXT: Record<ServiceStatus, string> = {
  available: "text-green-400",
  responding: "text-[var(--amber)]",
  out_of_service: "text-[var(--signal)]",
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
    <div
      className={cn(
        "border border-[var(--rule)] bg-[var(--steel-2)] cursor-pointer select-none transition-[background-color] duration-150 hover:bg-[#14171c] flex items-center gap-4 p-4 min-h-[72px]",
        isPending && "opacity-60"
      )}
      onClick={handleTap}
      role="button"
      aria-label={`${displayName} — ${STATUS_LABEL[status]}. Tap to change status.`}
    >
      <span
        className={cn("inline-block h-3 w-3 shrink-0 rounded-full", STATUS_DOT[status])}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p className="truncate font-mono text-[13px] uppercase tracking-[0.14em] text-[var(--bone)] leading-tight">
          {displayName}
        </p>
        {unit.type && (
          <p className="truncate font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">
            {unit.type}
          </p>
        )}
      </div>
      <span className={cn("font-mono text-[10.5px] uppercase tracking-[0.14em] shrink-0", STATUS_TEXT[status])}>
        {STATUS_LABEL[status]}
      </span>
    </div>
  );
}
