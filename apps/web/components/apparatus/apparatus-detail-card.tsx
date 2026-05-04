"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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

function nextStatus(current: string): ServiceStatus {
  const idx = STATUS_CYCLE.indexOf(current as ServiceStatus);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

function normalizeStatus(value: string | undefined): ServiceStatus {
  return STATUS_CYCLE.includes(value as ServiceStatus)
    ? (value as ServiceStatus)
    : "available";
}

interface Props {
  unit: ApparatusRecord;
  isOffline: boolean;
}

export function ApparatusDetailCard({ unit, isOffline }: Props) {
  const [status, setStatus] = useState<ServiceStatus>(() => normalizeStatus(unit.service_status));
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setStatus(normalizeStatus(unit.service_status));
  }, [unit.service_status]);

  const displayName =
    [unit.unit_id, unit.make, unit.model].filter(Boolean).join(" ") ||
    "Unknown Unit";

  function handleStatusTap() {
    if (!unit.local_id) return;
    const next = nextStatus(status);
    setStatus(next);

    startTransition(async () => {
      const now = new Date().toISOString();
      const localId = unit.local_id;
      const dirtyFields = Array.from(new Set([...(unit._dirty_fields ?? []), "service_status"]));

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
          // Fall through to queue
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

  const hasDetails = unit.year || unit.make || unit.model || unit.vin || unit.mileage;

  return (
    <div
      className={cn(
        "border border-[var(--rule)] bg-[var(--steel-2)] transition-opacity",
        isPending && "opacity-60"
      )}
    >
      <div className="flex items-center gap-4 p-4 min-h-[72px]">
        {/* Status tap area */}
        <div
          className="flex flex-1 min-w-0 items-center gap-4 cursor-pointer select-none"
          onClick={handleStatusTap}
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

        {/* Expand toggle */}
        {hasDetails && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-label={expanded ? "Collapse details" : "Expand details"}
            className="ml-2 shrink-0 p-1 text-[var(--bone-dim)] hover:text-[var(--bone)] transition-colors"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="border-t border-[var(--rule)] px-4 py-3 grid gap-x-6 gap-y-1.5 grid-cols-2 sm:grid-cols-3">
          {unit.year && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">Year</p>
              <p className="font-body text-[13px] text-[var(--bone)]">{unit.year}</p>
            </div>
          )}
          {unit.make && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">Make</p>
              <p className="font-body text-[13px] text-[var(--bone)]">{unit.make}</p>
            </div>
          )}
          {unit.model && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">Model</p>
              <p className="font-body text-[13px] text-[var(--bone)]">{unit.model}</p>
            </div>
          )}
          {unit.vin && (
            <div className="col-span-2 sm:col-span-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">VIN</p>
              <p className="font-mono text-[12px] text-[var(--bone)]">{unit.vin}</p>
            </div>
          )}
          {unit.mileage != null && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">Mileage</p>
              <p className="font-body text-[13px] text-[var(--bone)]">{unit.mileage.toLocaleString()} mi</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
