"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FileOutput, Loader2, Plus } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IncidentRecord } from "@/lib/db";
import { db } from "@/lib/db";
import { printIncidentPdf } from "@/lib/incidents/export";
import {
  NERIS_INCIDENT_TYPES,
  PROPERTY_USE_OPTIONS,
} from "@/lib/incidents/options";
import { useSyncStore } from "@/store/sync-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    case "conflict": return "border border-[var(--amber)] text-[var(--amber)]";
    case "synced": return "border border-green-500/50 text-green-400";
    case "syncing": return "border border-[var(--rule-strong)] text-[var(--bone-dim)]";
    default: return "border border-[var(--amber)]/60 text-[var(--amber)]";
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
  const online = useSyncStore((state) => state.online);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const lastSyncAt = useSyncStore((state) => state.lastSyncAt);
  const syncStatus = useSyncStore((state) => state.status);
  const isSyncing = syncStatus === "syncing";
  const [exportError, setExportError] = useState<string | null>(null);

  const incidents = useLiveQuery(
    () => db.incidents.orderBy("updated_at").reverse().limit(100).toArray(),
    []
  );
  const activeDraft = useLiveQuery(
    () => db.incident_drafts.get("active-incident-draft"),
    []
  );

  const incidentList = incidents ?? EMPTY_LIST;

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
          <h1 className="font-display text-[clamp(28px,4vw,40px)] uppercase tracking-[-0.005em] font-medium text-[var(--bone)]">Incidents</h1>
          <p className="font-body text-[var(--bone-dim)]">
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
      <div className="flex flex-wrap gap-2">
        <span className="border border-[var(--rule)] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">
          {pendingCount} pending sync
        </span>
        <span className="border border-[var(--rule)] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">
          {lastSyncAt ? `Last sync ${formatTimestamp(lastSyncAt)}` : "Waiting for first sync"}
        </span>
        {!online ? (
          <span className="border border-[var(--amber)] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--amber)]">
            Offline — local data
          </span>
        ) : null}
        {isSyncing ? (
          <span className="flex items-center gap-1.5 border border-[var(--rule)] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Syncing
          </span>
        ) : null}
      </div>

      {exportError ? (
        <div className="border border-[var(--amber)] bg-[rgba(232,161,58,0.08)] px-4 py-3 font-body text-[14px] text-[var(--amber)]">{exportError}</div>
      ) : null}

      {/* List */}
      {incidentList.length === 0 && !activeDraft ? (
        <div className="border border-[var(--rule)] flex min-h-[240px] items-center justify-center">
          <div className="space-y-4 text-center px-6">
            <p className="font-body text-[var(--bone-dim)]">
              No incidents logged yet. Log one from the field or sync to pull in prior records.
            </p>
            <Link href="/incidents/new" className={buttonVariants({ size: "sm" })}>
              Log first incident
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {activeDraft ? (
            <Card className="border-[var(--amber)]">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px] uppercase tracking-[0.08em] text-[var(--bone)]">
                        {activeDraft.incident_number || "Untitled draft"}
                      </span>
                      <span className="border border-[var(--amber)] bg-[rgba(232,161,58,0.12)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--amber)]">
                        Draft
                      </span>
                    </div>
                    <div className="font-body text-[14px] text-[var(--bone-dim)]">
                      {lookupLabel(NERIS_INCIDENT_TYPES, activeDraft.incident_type)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--bone-dim)]">
                    {formatTimestamp(activeDraft.updated_at)}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href="/incidents/new" className={buttonVariants({ size: "sm", variant: "outline" })}>
                    Resume draft
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-[var(--signal)] hover:text-[var(--signal-deep)]"
                    onClick={async () => {
                      if (!confirm("Discard this draft? This cannot be undone.")) return;
                      await db.incident_drafts.delete("active-incident-draft");
                    }}
                  >
                    Discard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
          {incidentList.map((incident) => {
            const raw = (incident.raw_data ?? {}) as Record<string, unknown>;
            const respondingUnits = readStringArray(raw.units_responding_labels);
            const personnel = readStringArray(raw.personnel_on_scene_names);

            return (
              <Card key={incident.local_id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[13px] uppercase tracking-[0.08em] text-[var(--bone)]">
                          {incident.incident_number ?? "Pending number"}
                        </span>
                        <span
                          className={cn(
                            "px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]",
                            statusClasses(incident._sync_status)
                          )}
                        >
                          {statusLabel(incident._sync_status)}
                        </span>
                      </div>
                      <div className="font-body text-[14px] text-[var(--bone-dim)]">
                        {lookupLabel(NERIS_INCIDENT_TYPES, incident.incident_type)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--bone-dim)]">
                      {formatTimestamp(incident.alarm_time)}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-1 font-body text-[13px] text-[var(--bone-dim)] sm:grid-cols-2">
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
