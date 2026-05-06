"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Loader2, Plus, Radio, X } from "lucide-react";
import Link from "next/link";

import { generateIncidentNumber } from "@/components/incidents/incident-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IncidentRecord } from "@/lib/db";
import { db } from "@/lib/db";
import { NERIS_INCIDENT_TYPES } from "@/lib/incidents/options";
import { runSync } from "@/lib/sync/engine";
import { enqueueMutation } from "@/lib/sync/mutations";
import { MutualAidPanel } from "@/components/dispatch/mutual-aid-panel";
import { useSyncStore } from "@/store/sync-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DispatchStatus = "dispatched" | "enroute" | "onscene";

function deriveStatus(incident: IncidentRecord): DispatchStatus {
  if (incident.on_scene_time) return "onscene";
  if (incident.en_route_time) return "enroute";
  return "dispatched";
}

const STATUS_PIP: Record<DispatchStatus, { bg: string; shadow?: string }> = {
  onscene:    { bg: "var(--amber)",  shadow: "0 0 0 4px rgba(232,161,58,0.18)" },
  enroute:    { bg: "var(--blue)",   shadow: "0 0 0 4px rgba(74,143,181,0.18)" },
  dispatched: { bg: "var(--green)",  shadow: "0 0 0 4px rgba(78,168,100,0.18)" },
};

const STATUS_PILL: Record<DispatchStatus, { label: string; style: React.CSSProperties }> = {
  onscene: {
    label: "On Scene",
    style: { background: "rgba(232,161,58,0.16)", color: "var(--amber)", borderColor: "rgba(232,161,58,0.4)" },
  },
  enroute: {
    label: "En Route",
    style: { background: "rgba(74,143,181,0.16)", color: "var(--blue)", borderColor: "rgba(74,143,181,0.4)" },
  },
  dispatched: {
    label: "Dispatched",
    style: { background: "rgba(78,168,100,0.16)", color: "var(--green)", borderColor: "rgba(78,168,100,0.4)" },
  },
};

function normalizePriorityKey(raw: unknown): string {
  const p = typeof raw === "string" ? raw.toLowerCase() : "medium";
  if (p === "critical" || p === "high" || p === "medium" || p === "low") return p;
  return "medium";
}

function priorityAccentColor(priorityKey: string): string {
  switch (priorityKey) {
    case "critical":
      return "var(--signal)";
    case "high":
      return "#e85c1a";
    case "low":
      return "var(--green)";
    default:
      return "var(--amber)";
  }
}

function formatTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatElapsed(dispatchIso: string, nowMs: number): string {
  const start = new Date(dispatchIso).getTime();
  if (Number.isNaN(start)) return "—";
  let sec = Math.max(0, Math.floor((nowMs - start) / 1000));
  const h = Math.floor(sec / 3600);
  sec %= 3600;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function elapsedToneMinutes(dispatchIso: string, nowMs: number): "green" | "amber" | "red" {
  const start = new Date(dispatchIso).getTime();
  if (Number.isNaN(start)) return "green";
  const min = (nowMs - start) / 60_000;
  if (min < 5) return "green";
  if (min <= 15) return "amber";
  return "red";
}

const ELAPSED_COLOR: Record<"green" | "amber" | "red", string> = {
  green: "var(--green)",
  amber: "var(--amber)",
  red: "var(--signal)",
};

function lookupType(value?: string | null): string {
  if (!value) return "Unknown type";
  return NERIS_INCIDENT_TYPES.find((o) => o.value === value)?.label ?? value;
}


function DispatchElapsed({ dispatchTime }: { dispatchTime?: string | null }) {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!dispatchTime) return <span className="font-mono text-[10.5px] tracking-[0.04em]">—</span>;

  const tone = elapsedToneMinutes(dispatchTime, tick);
  return (
    <span
      className="font-mono text-[10.5px] tracking-[0.04em] font-medium"
      style={{ color: ELAPSED_COLOR[tone] }}
    >
      {formatElapsed(dispatchTime, tick)}
    </span>
  );
}

const EMPTY: IncidentRecord[] = [];

// ---------------------------------------------------------------------------
// Row action buttons
// ---------------------------------------------------------------------------

function ActionButtons({
  incident,
  onClearedDraftCreated,
}: {
  incident: IncidentRecord;
  onClearedDraftCreated: (draftId: string) => void;
}) {
  const online = useSyncStore((s) => s.online);
  const [isPending, startTransition] = useTransition();

  async function setAssignedUnitsStatus(serviceStatus: string) {
    const units = incident.units_responding ?? [];
    for (const unitId of units) {
      const apparatus =
        (await db.apparatus.where("unit_id").equals(unitId).first()) ??
        (await db.apparatus.where("local_id").equals(unitId).first()) ??
        (await db.apparatus.where("server_id").equals(unitId).first());
      if (apparatus?.local_id) {
        await enqueueMutation({
          table: "apparatus",
          local_id: apparatus.local_id,
          operation: "upsert",
          data: { service_status: serviceStatus },
        });
      }
    }
  }

  function advance(field: "en_route_time" | "on_scene_time" | "cleared_time") {
    startTransition(async () => {
      const now = new Date().toISOString();
      const data: Record<string, unknown> = { [field]: now };

      await enqueueMutation({
        table: "incidents",
        local_id: incident.local_id,
        operation: "upsert",
        data,
      });

      if (field === "en_route_time") {
        await setAssignedUnitsStatus("responding");
      }

      if (field === "on_scene_time") {
        await setAssignedUnitsStatus("on_scene");
      }

      if (field === "cleared_time") {
        await setAssignedUnitsStatus("available");

        const dup = await db.incident_drafts
          .filter(
            (d) =>
              (d.raw_data as Record<string, unknown>)?.source_incident_local_id === incident.local_id
          )
          .first();

        if (!dup) {
          const draftId = crypto.randomUUID();
          const rawBase =
            incident.raw_data && typeof incident.raw_data === "object" && !Array.isArray(incident.raw_data)
              ? (incident.raw_data as Record<string, unknown>)
              : {};
          await db.incident_drafts.put({
            id: draftId,
            incident_number: incident.incident_number || generateIncidentNumber(),
            incident_type: incident.incident_type || null,
            location_address: incident.location_address || null,
            location_lat: incident.location_lat != null ? String(incident.location_lat) : null,
            location_lng: incident.location_lng != null ? String(incident.location_lng) : null,
            alarm_time: incident.alarm_time || null,
            on_scene_time: incident.on_scene_time || null,
            cleared_time: now,
            narrative: incident.narrative || null,
            raw_data: {
              ...rawBase,
              source_incident_local_id: incident.local_id,
              dispatch_time: incident.dispatch_time || null,
              en_route_time: incident.en_route_time || null,
              controlled_time: incident.controlled_time || null,
              units_responding: incident.units_responding || [],
              personnel_on_scene: incident.personnel_on_scene || [],
            },
            updated_at: now,
          });
          onClearedDraftCreated(draftId);
        }
      }

      if (online) void runSync();
    });
  }

  const status = deriveStatus(incident);
  const btns: { label: string; action: () => void }[] = [];

  if (status === "dispatched") {
    btns.push({ label: "En Route", action: () => advance("en_route_time") });
  } else if (status === "enroute") {
    btns.push({ label: "On Scene", action: () => advance("on_scene_time") });
  } else {
    btns.push({ label: "Clear", action: () => advance("cleared_time") });
  }

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {btns.map((btn, idx) => (
        <button
          key={btn.label}
          type="button"
          disabled={isPending}
          onClick={btn.action}
          className={cn(
            "px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] border transition-colors",
            btn.label === "Clear"
              ? "border-[var(--rule)] text-[var(--bone-dim)] hover:border-[var(--signal)] hover:text-[var(--signal)]"
              : "border-[var(--rule)] text-[var(--bone-dim)] hover:border-[var(--blue)] hover:text-[var(--blue)]",
            isPending && "opacity-50 cursor-not-allowed"
          )}
        >
          {isPending && idx === 0 ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {btn.label}
            </span>
          ) : (
            btn.label
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DispatchList() {
  const [clearedBanner, setClearedBanner] = useState<{ draftId: string } | null>(null);

  useEffect(() => {
    if (!clearedBanner) return;
    const t = window.setTimeout(() => setClearedBanner(null), 8000);
    return () => window.clearTimeout(t);
  }, [clearedBanner]);

  const dispatches = useLiveQuery(
    () =>
      db.incidents
        .filter((i) => !!i.dispatch_time && !i.cleared_time)
        .toArray()
        .then((arr) =>
          arr.sort((a, b) => {
            const at = a.dispatch_time ?? "";
            const bt = b.dispatch_time ?? "";
            return bt.localeCompare(at);
          })
        ),
    []
  );

  const list = dispatches ?? EMPTY;
  const loading = dispatches === undefined;

  return (
    <div className="space-y-6">
      {clearedBanner && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border border-[var(--green)] bg-[rgba(78,168,100,0.12)] px-4 py-3 font-body text-[14px]"
          style={{ color: "var(--bone)" }}
        >
          <p>
            Call cleared — incident report draft created.{" "}
            <Link
              href={`/incidents/new?draft=${clearedBanner.draftId}`}
              className="font-medium underline underline-offset-2 hover:opacity-90"
            >
              Complete Report →
            </Link>
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setClearedBanner(null)}
            className="shrink-0 p-1 text-[var(--bone-dim)] hover:text-[var(--bone)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-[clamp(28px,4vw,40px)] uppercase tracking-[-0.005em] font-medium text-[var(--bone)]">
            Dispatch
          </h1>
          <p className="font-body text-[var(--bone-dim)]">Active calls — assign apparatus and track response.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dispatch/board"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Station Board
          </Link>
          <Link href="/dispatch/new" className={buttonVariants()}>
            <Plus className="h-4 w-4" />
            New dispatch
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center border border-[var(--rule)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bone-dim)]" />
        </div>
      ) : list.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 border border-[var(--rule)]">
          <Radio className="h-8 w-8 text-[var(--bone-dim)]" strokeWidth={1.5} />
          <div className="text-center">
            <p className="font-body text-[var(--bone-dim)]">No active dispatches.</p>
            <p className="font-body text-[14px] text-[var(--bone-dim)]">
              Create one to assign apparatus and track response.
            </p>
          </div>
          <Link href="/dispatch/new" className={buttonVariants({ size: "sm" })}>
            New dispatch
          </Link>
        </div>
      ) : (
        <div
          style={{
            background: "var(--steel)",
            border: "1px solid var(--rule-2)",
            borderRadius: 2,
          }}
        >
          {list.map((incident, i) => {
            const status = deriveStatus(incident);
            const pip = STATUS_PIP[status];
            const pill = STATUS_PILL[status];
            const units = incident.units_responding ?? [];
            const raw = incident.raw_data as Record<string, unknown> | undefined;
            const priorityKey = normalizePriorityKey(raw?.priority ?? "medium");
            const prColor = priorityAccentColor(priorityKey);

            return (
              <Fragment key={incident.local_id}>
                {i > 0 && <div style={{ borderTop: "1px solid var(--rule)" }} />}
                <div className="p-4 border-l-[3px]" style={{ borderLeftColor: prColor }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "12px 1fr auto",
                      gap: "14px",
                      alignItems: "start",
                    }}
                  >
                    <span
                      className="rounded-full mt-1.5 shrink-0"
                      style={{
                        width: 10,
                        height: 10,
                        background: pip.bg,
                        boxShadow: pip.shadow,
                        display: "block",
                      }}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-[13px] uppercase tracking-[0.08em] text-[var(--bone)]">
                          {incident.incident_number ?? "Pending #"}
                        </span>
                        <span
                          className="font-mono text-[10px] uppercase tracking-[0.1em]"
                          style={{ color: "var(--bone-dim)" }}
                        >
                          {lookupType(incident.incident_type)}
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-1.5 font-body text-[13px] mb-1"
                        style={{ color: "var(--bone-dim)" }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.6}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ width: 12, height: 12, flexShrink: 0, color: "#7a786f" }}
                        >
                          <path d="M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13z" />
                          <circle cx="12" cy="9" r="2.5" />
                        </svg>
                        {incident.location_address ?? "No address entered"}
                      </div>
                      <div
                        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] tracking-[0.04em]"
                        style={{ color: "#7a786f" }}
                      >
                        <span>{formatTime(incident.dispatch_time)}</span>
                        <span aria-hidden>·</span>
                        <DispatchElapsed dispatchTime={incident.dispatch_time} />
                        {units.length > 0 && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{units.join(", ")}</span>
                          </>
                        )}
                      </div>
                      <ActionButtons
                        incident={incident}
                        onClearedDraftCreated={(draftId) => setClearedBanner({ draftId })}
                      />
                      <MutualAidPanel
                        incidentLocalId={incident.local_id}
                        incidentServerId={incident.server_id ?? null}
                      />
                    </div>
                    <span
                      className="font-display font-semibold text-[10.5px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border shrink-0"
                      style={pill.style}
                    >
                      {pill.label}
                    </span>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
