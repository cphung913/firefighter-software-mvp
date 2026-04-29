"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FileOutput, Loader2, Plus, Siren } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IncidentRecord } from "@/lib/db";
import { db } from "@/lib/db";
import { printIncidentPdf } from "@/lib/incidents/export";
import {
  NERIS_INCIDENT_TYPES,
  PROPERTY_USE_OPTIONS,
} from "@/lib/incidents/options";
import { runSync } from "@/lib/sync/engine";
import { useSyncStore } from "@/store/sync-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad(v: number) {
  return v.toString().padStart(2, "0");
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function lookupLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value?: string | null
): string {
  if (!value) return "Unspecified";
  return options.find((o) => o.value === value)?.label ?? value;
}

function statusLabel(status?: string): string {
  switch (status) {
    case "conflict": return "Needs review";
    case "synced": return "Synced";
    case "syncing": return "Syncing";
    default: return "Queued";
  }
}

function statusClasses(status?: string): string {
  switch (status) {
    case "conflict": return "bg-amber-100 text-amber-800";
    case "synced": return "bg-emerald-100 text-emerald-800";
    case "syncing": return "bg-sky-100 text-sky-800";
    default: return "bg-orange-100 text-orange-800";
  }
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (typeof item === "string" ? [item] : []));
}

const EMPTY_LIST: IncidentRecord[] = [];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IncidentsList() {
  const { status: sessionStatus } = useSession();
  const online = useSyncStore((state) => state.online);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const lastSyncAt = useSyncStore((state) => state.lastSyncAt);
  const [isSyncing, setIsSyncing] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const incidents = useLiveQuery(
    () => db.incidents.orderBy("updated_at").reverse().limit(100).toArray(),
    []
  );

  const incidentList = incidents ?? EMPTY_LIST;

  // Initial sync on mount when online
  useEffect(() => {
    if (sessionStatus !== "authenticated" || !online) return;
    setIsSyncing(true);
    runSync().finally(() => setIsSyncing(false));
  }, [sessionStatus, online]);

  function handleExport(incident: IncidentRecord) {
    try {
      const raw = (incident.raw_data ?? {}) as Record<string, unknown>;
      const propertyUseValue = typeof raw.property_use === "string" ? raw.property_use : null;
      printIncidentPdf(
        incident,
        lookupLabel(NERIS_INCIDENT_TYPES, incident.incident_type),
        lookupLabel(PROPERTY_USE_OPTIONS, propertyUseValue)
      );
      setExportError(null);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Unable to open PDF export.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Incidents</h1>
          <p className="text-muted-foreground">
            All logged incidents synced to this device.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/incidents/new" className={buttonVariants()}>
            <Plus className="h-4 w-4" />
            Log incident
          </Link>
        </div>
      </div>

      {/* Sync status bar */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
          {pendingCount} pending sync
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
          {lastSyncAt ? `Last sync ${formatTimestamp(lastSyncAt)}` : "Waiting for first sync"}
        </span>
        {!online ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
            Offline — showing local data
          </span>
        ) : null}
        {isSyncing ? (
          <span className="flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-sky-800">
            <Loader2 className="h-3 w-3 animate-spin" />
            Syncing...
          </span>
        ) : null}
      </div>

      {exportError ? (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{exportError}</div>
      ) : null}

      {/* List */}
      {incidentList.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[240px] items-center justify-center">
            <div className="space-y-3 text-center">
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Siren className="h-6 w-6" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                No incidents logged yet. Log one from the field or sync to pull in prior records.
              </p>
              <Link href="/incidents/new" className={buttonVariants({ size: "sm" })}>
                Log first incident
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {incidentList.map((incident) => {
            const raw = (incident.raw_data ?? {}) as Record<string, unknown>;
            const respondingUnits = readStringArray(raw.units_responding_labels);
            const personnel = readStringArray(raw.personnel_on_scene_names);

            return (
              <Card key={incident.local_id} className="transition-shadow hover:shadow-sm">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          {incident.incident_number ?? "Pending number"}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium",
                            statusClasses(incident._sync_status)
                          )}
                        >
                          {statusLabel(incident._sync_status)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {lookupLabel(NERIS_INCIDENT_TYPES, incident.incident_type)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-sm text-muted-foreground">
                      {formatTimestamp(incident.alarm_time)}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                    <div>{incident.location_address ?? "Location not entered"}</div>
                    <div>
                      Property: {lookupLabel(PROPERTY_USE_OPTIONS, typeof raw.property_use === "string" ? raw.property_use : null)}
                    </div>
                    <div>Units: {respondingUnits.join(", ") || "None selected"}</div>
                    <div>Personnel: {personnel.join(", ") || "None selected"}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {incident.server_id ? (
                      <Link
                        href={`/incidents/${incident.server_id}`}
                        className={buttonVariants({ size: "sm", variant: "outline" })}
                      >
                        View / Edit
                      </Link>
                    ) : (
                      <Link
                        href={`/incidents/local/${incident.local_id}`}
                        className={buttonVariants({ size: "sm", variant: "outline" })}
                      >
                        View draft
                      </Link>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleExport(incident)}
                    >
                      <FileOutput className="h-4 w-4" />
                      Export PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
