"use client";

import { Fragment, useTransition } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Loader2, Plus, Radio } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IncidentRecord } from "@/lib/db";
import { db } from "@/lib/db";
import { NERIS_INCIDENT_TYPES } from "@/lib/incidents/options";
import { runSync } from "@/lib/sync/engine";
import { enqueueMutation } from "@/lib/sync/mutations";
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

function formatTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function lookupType(value?: string | null): string {
  if (!value) return "Unknown type";
  return NERIS_INCIDENT_TYPES.find((o) => o.value === value)?.label ?? value;
}

const EMPTY: IncidentRecord[] = [];

// ---------------------------------------------------------------------------
// Row action buttons
// ---------------------------------------------------------------------------

function ActionButtons({ incident }: { incident: IncidentRecord }) {
  const online = useSyncStore((s) => s.online);
  const [isPending, startTransition] = useTransition();

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

      if (field === "cleared_time") {
        const units = incident.units_responding ?? [];
        for (const unitId of units) {
          const apparatus = await db.apparatus.where("unit_id").equals(unitId).first()
            ?? await db.apparatus.where("local_id").equals(unitId).first()
            ?? await db.apparatus.where("server_id").equals(unitId).first();
          if (apparatus?.local_id) {
            await enqueueMutation({
              table: "apparatus",
              local_id: apparatus.local_id,
              operation: "upsert",
              data: { service_status: "available" },
            });
          }
        }
      }

      if (online) void runSync();
    });
  }

  const status = deriveStatus(incident);
  const btns: { label: string; action: () => void }[] = [];

  if (status === "dispatched") {
    btns.push({ label: "En Route", action: () => advance("en_route_time") });
  }
  if (status === "enroute") {
    btns.push({ label: "On Scene", action: () => advance("on_scene_time") });
  }
  btns.push({ label: "Clear", action: () => advance("cleared_time") });

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {btns.map((btn) => (
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
          {isPending && btn === btns[0] ? (
            <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />{btn.label}</span>
          ) : btn.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DispatchList() {
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-[clamp(28px,4vw,40px)] uppercase tracking-[-0.005em] font-medium text-[var(--bone)]">
            Dispatch
          </h1>
          <p className="font-body text-[var(--bone-dim)]">Active calls — assign apparatus and track response.</p>
        </div>
        <Link href="/dispatch/new" className={buttonVariants()}>
          <Plus className="h-4 w-4" />
          New dispatch
        </Link>
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

            return (
              <Fragment key={incident.local_id}>
                {i > 0 && <div style={{ borderTop: "1px solid var(--rule)" }} />}
                <div className="p-4">
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
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, flexShrink: 0, color: "#7a786f" }}>
                          <path d="M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13z" />
                          <circle cx="12" cy="9" r="2.5" />
                        </svg>
                        {incident.location_address ?? "No address entered"}
                      </div>
                      <div className="font-mono text-[10.5px] tracking-[0.04em]" style={{ color: "#7a786f" }}>
                        {formatTime(incident.dispatch_time)}
                        {units.length > 0 && ` · ${units.join(", ")}`}
                      </div>
                      <ActionButtons incident={incident} />
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
