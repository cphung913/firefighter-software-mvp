"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { IncidentRecord } from "@/lib/db";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

// ─── Card primitives ──────────────────────────────────────────────────────────

function Card({
  tag,
  className,
  children,
}: {
  tag: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-col${className ? " " + className : ""}`}
      style={{
        background: "var(--steel)",
        border: "1px solid var(--rule-2)",
        borderRadius: "2px",
      }}
    >
      <span
        className="absolute top-0 right-3.5 -translate-y-1/2 px-2 font-mono text-[9.5px] tracking-[0.16em] uppercase pointer-events-none select-none"
        style={{ background: "var(--ink)", color: "#7a786f" }}
      >
        {tag}
      </span>
      {children}
    </div>
  );
}

function CardHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-[13px]"
      style={{ borderBottom: "1px solid var(--rule)" }}
    >
      <h3 className="font-display font-semibold text-[15px] uppercase tracking-[0.16em] text-[var(--bone)]">
        {title}
      </h3>
      {meta && (
        <span
          className="font-mono text-[11px] tracking-[0.06em]"
          style={{ color: "#7a786f" }}
        >
          {meta}
        </span>
      )}
    </div>
  );
}

// ─── FleetStatusCard ──────────────────────────────────────────────────────────

const FLEET_STATUS_COLOR: Record<string, { dot: string; text: string }> = {
  available:      { dot: "bg-green-500",            text: "text-green-400" },
  responding:     { dot: "bg-[var(--amber)]",        text: "text-[var(--amber)]" },
  out_of_service: { dot: "bg-[var(--signal)]",       text: "text-[var(--signal)]" },
};
const FLEET_STATUS_LABEL: Record<string, string> = {
  available:      "Available",
  responding:     "Responding",
  out_of_service: "Out of Service",
};

function FleetStatusCard() {
  const apparatus = useLiveQuery(() => db.apparatus.orderBy("unit_id").toArray(), []);
  const list = apparatus ?? [];

  const grouped = list.reduce<Record<string, typeof list>>((acc, unit) => {
    const s = unit.service_status ?? "available";
    (acc[s] ??= []).push(unit);
    return acc;
  }, {});

  const order = ["responding", "out_of_service", "available"];

  return (
    <Card tag="FLEET" className="col-span-12 xl:col-span-5">
      <CardHead
        title="Apparatus Status"
        meta={list.length > 0 ? `— ${list.length} UNITS` : undefined}
      />
      {list.length === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ padding: "32px 16px", color: "#7a786f" }}
        >
          <span className="font-mono text-[11px] tracking-[0.14em] uppercase">
            No apparatus registered
          </span>
        </div>
      ) : (
        <div className="flex flex-col">
          {order.flatMap((statusKey) => {
            const units = grouped[statusKey];
            if (!units?.length) return [];
            const colors = FLEET_STATUS_COLOR[statusKey] ?? { dot: "bg-[var(--bone-dim)]", text: "text-[var(--bone-dim)]" };
            return units.map((unit, i) => (
              <div
                key={unit.local_id}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  borderBottom:
                    statusKey !== order[order.length - 1] || i < units.length - 1
                      ? "1px solid var(--rule)"
                      : undefined,
                }}
              >
                <span
                  className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", colors.dot)}
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--bone)]">
                    {unit.unit_id ?? "Unknown"}
                  </p>
                  {unit.type && (
                    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--bone-dim)]">
                      {unit.type}
                    </p>
                  )}
                </div>
                <span className={cn("font-mono text-[10px] uppercase tracking-[0.12em] shrink-0", colors.text)}>
                  {FLEET_STATUS_LABEL[statusKey] ?? statusKey}
                </span>
              </div>
            ));
          })}
        </div>
      )}
    </Card>
  );
}

// ─── DispatchesCard ───────────────────────────────────────────────────────────

type DispatchStatus = "onscene" | "enroute" | "dispatched" | "cleared";

const DISPATCH_PIP: Record<DispatchStatus, { bg: string; shadow?: string }> = {
  onscene:    { bg: "var(--amber)", shadow: "0 0 0 4px rgba(232,161,58,0.18)" },
  enroute:    { bg: "var(--blue)",  shadow: "0 0 0 4px rgba(74,143,181,0.18)" },
  dispatched: { bg: "var(--green)", shadow: "0 0 0 4px rgba(78,168,100,0.18)" },
  cleared:    { bg: "var(--bone-dim)" },
};

const DISPATCH_PILL: Record<DispatchStatus, { label: string; style: React.CSSProperties }> = {
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
  cleared: {
    label: "Cleared",
    style: { background: "rgba(243,238,229,0.06)", color: "var(--bone-dim)", borderColor: "var(--rule-2)" },
  },
};

function deriveDispatchStatus(incident: IncidentRecord): DispatchStatus {
  if (incident.on_scene_time) return "onscene";
  if (incident.en_route_time) return "enroute";
  return "dispatched";
}

function formatDispatchTime(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const EMPTY_INCIDENTS: IncidentRecord[] = [];

function DispatchesCard() {
  const dispatches = useLiveQuery(
    () =>
      db.incidents
        .filter((i) => !!i.dispatch_time && !i.cleared_time)
        .toArray()
        .then((arr) =>
          arr
            .sort((a, b) => (b.dispatch_time ?? "").localeCompare(a.dispatch_time ?? ""))
            .slice(0, 5)
        ),
    []
  );

  const list = dispatches ?? EMPTY_INCIDENTS;
  const count = list.length;

  return (
    <Card tag={`LIVE · ${String(count).padStart(2, "0")}`} className="col-span-12 xl:col-span-7">
      <CardHead title="Active Dispatches" meta="— REAL TIME" />
      {count === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ padding: "32px 16px", color: "#7a786f" }}
        >
          <span className="font-mono text-[11px] tracking-[0.14em] uppercase">No active dispatches</span>
        </div>
      ) : (
        list.map((d, i) => {
          const status = deriveDispatchStatus(d);
          const pip  = DISPATCH_PIP[status];
          const pill = DISPATCH_PILL[status];
          const units = (d.units_responding ?? []).join(", ");

          return (
            <div
              key={d.local_id}
              style={{
                display: "grid",
                gridTemplateColumns: "12px 1fr auto",
                gap: "14px",
                padding: "14px 16px",
                borderBottom: i < list.length - 1 ? "1px solid var(--rule)" : undefined,
                alignItems: "center",
              }}
            >
              <span
                className="rounded-full shrink-0"
                style={{ width: 10, height: 10, background: pip.bg, boxShadow: pip.shadow, display: "block" }}
              />
              <div>
                <b className="font-mono text-[14px] tracking-[0.04em] text-[var(--bone)] block mb-1" style={{ fontWeight: 600 }}>
                  {d.incident_number ?? "Pending #"}
                </b>
                <div className="flex items-center gap-1.5 text-[12.5px] mb-0.5" style={{ color: "var(--bone-dim)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, color: "#7a786f", flexShrink: 0 }}>
                    <path d="M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13z" />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                  {d.location_address ?? "No address"}
                </div>
                <div className="font-mono text-[10.5px] tracking-[0.04em]" style={{ color: "#7a786f" }}>
                  {formatDispatchTime(d.dispatch_time)}
                  {units ? ` · ${units}` : ""}
                </div>
              </div>
              <span className="font-display font-semibold text-[10.5px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border shrink-0" style={pill.style}>
                {pill.label}
              </span>
            </div>
          );
        })
      )}
    </Card>
  );
}

// ─── IncidentTallyCard ────────────────────────────────────────────────────────

const TALLY_GROUPS: { label: string; types: string[]; color: string }[] = [
  { label: "Fire",    types: ["structure_fire", "vehicle_fire"],      color: "var(--signal)" },
  { label: "EMS",     types: ["medical_assist"],                      color: "var(--blue)" },
  { label: "MVA",     types: ["motor_vehicle_collision"],             color: "var(--purple)" },
  { label: "Rescue",  types: ["rescue_extrication"],                  color: "var(--amber)" },
  { label: "Hazmat",  types: ["hazmat_gas_leak"],                     color: "var(--green)" },
  { label: "Other",   types: ["public_service", "false_alarm"],       color: "#7a786f" },
];

const CATEGORIZED_TYPES = new Set(TALLY_GROUPS.flatMap((g) => g.types));

function IncidentTallyCard() {
  const incidents = useLiveQuery(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString();
    return db.incidents
      .filter((i) => {
        const ts = i.alarm_time ?? i.dispatch_time;
        return !!ts && ts >= cutoffStr;
      })
      .toArray();
  }, []);

  const list = incidents ?? [];
  const total = list.length;

  const tally = TALLY_GROUPS.map((group) => {
    const count = list.filter((i) => group.types.includes(i.incident_type ?? "")).length;
    return { ...group, count };
  });

  // Uncategorized goes into Other
  const uncategorized = list.filter(
    (i) => i.incident_type && !CATEGORIZED_TYPES.has(i.incident_type)
  ).length;
  const otherIdx = tally.findIndex((t) => t.label === "Other");
  if (otherIdx >= 0) tally[otherIdx] = { ...tally[otherIdx], count: tally[otherIdx].count + uncategorized };

  const rows = tally.filter((t) => t.count > 0);

  return (
    <Card tag="LAST 30D" className="col-span-12 xl:col-span-7">
      <CardHead
        title="Incident Tally"
        meta={total > 0 ? `— ${total} CALLS` : undefined}
      />
      {total === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ padding: "32px 16px", color: "#7a786f" }}
        >
          <span className="font-mono text-[11px] tracking-[0.14em] uppercase">
            No incidents in last 30 days
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 p-4">
          {rows.map((row) => {
            const pct = Math.round((row.count / total) * 100);
            return (
              <div
                key={row.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 1fr 60px",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                <span className="font-display font-semibold text-[12px] tracking-[0.14em] uppercase text-[var(--bone)]">
                  {row.label}
                </span>
                <div
                  className="relative overflow-hidden"
                  style={{
                    height: 18,
                    background: "rgba(243,238,229,0.04)",
                    border: "1px solid var(--rule)",
                  }}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0"
                    style={{ width: `${pct}%`, background: row.color }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(90deg, transparent 0 6px, rgba(0,0,0,0.18) 6px 7px)",
                      }}
                    />
                  </div>
                </div>
                <span
                  className="font-mono text-[12px] text-right tracking-[0.04em] text-[var(--bone)]"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {row.count}{" "}
                  <small style={{ color: "#7a786f" }}>· {pct}%</small>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── NerisCard ────────────────────────────────────────────────────────────────

type NerisStatus = "ok" | "warn";

const NERIS_DOT: Record<NerisStatus, string> = {
  ok: "var(--green)",
  warn: "var(--amber)",
};

function isNerisComplete(i: IncidentRecord): boolean {
  const hasLocation = !!(i.location_address?.trim() || (i.location_lat && i.location_lng));
  return !!(i.incident_type && i.alarm_time && hasLocation);
}

function NerisCard() {
  const incidents = useLiveQuery(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString();
    return db.incidents
      .filter((i) => {
        const ts = i.alarm_time ?? i.dispatch_time;
        return !!ts && ts >= cutoffStr;
      })
      .toArray();
  }, []);

  const apparatus    = useLiveQuery(() => db.apparatus.toArray(), []);
  const rosterCount  = useLiveQuery(() => db.department_users.count(), []);
  const pendingCount = useLiveQuery(() => db.pending_mutations.count(), []);

  const list             = incidents ?? [];
  const total            = list.length;
  const completeCount    = list.filter(isNerisComplete).length;
  const incompleteCount  = total - completeCount;
  const geocodedCount    = list.filter((i) => i.location_lat && i.location_lng).length;
  const readinessPct     = total === 0 ? 100 : Math.round((completeCount / total) * 100);
  const toFilePct        = 100 - readinessPct;

  const apparatusList     = apparatus ?? [];
  const unmappedApparatus = apparatusList.filter((u) => !u.unit_id?.trim()).length;
  const hasPersonnel      = (rosterCount ?? 0) > 0;
  const pending           = pendingCount ?? 0;

  const items: { label: string; status: NerisStatus }[] = [
    {
      label: unmappedApparatus === 0 ? "Apparatus IDs mapped" : `${unmappedApparatus} apparatus missing ID`,
      status: unmappedApparatus === 0 ? "ok" : "warn",
    },
    {
      label: hasPersonnel ? "Personnel records on file" : "No personnel records",
      status: hasPersonnel ? "ok" : "warn",
    },
    {
      label:
        total === 0 || geocodedCount === total
          ? "Address / GPS coverage"
          : `${total - geocodedCount} incidents lack GPS coords`,
      status: total === 0 || geocodedCount === total ? "ok" : "warn",
    },
    {
      label:
        incompleteCount === 0
          ? "All reports complete"
          : `${incompleteCount} report${incompleteCount > 1 ? "s" : ""} missing fields`,
      status: incompleteCount === 0 ? "ok" : "warn",
    },
    ...(pending > 0
      ? [{ label: `${pending} change${pending > 1 ? "s" : ""} pending sync`, status: "warn" as NerisStatus }]
      : []),
  ];

  const scoreColor = readinessPct === 100 ? "var(--green)" : readinessPct >= 80 ? "var(--amber)" : "var(--signal)";

  return (
    <Card tag={`LAST 30D · ${total} CALLS`} className="col-span-12 xl:col-span-5">
      <CardHead title="NERIS Readiness" meta={`— ${readinessPct}% READY`} />
      <div className="flex flex-col gap-3.5 p-[18px]">
        <div className="flex items-baseline justify-between">
          <span
            className="font-display font-semibold text-[38px] tracking-[0.04em] leading-none"
            style={{ color: scoreColor, fontVariantNumeric: "tabular-nums" }}
          >
            {readinessPct}%
          </span>
          <span
            className="font-display font-semibold text-[11px] tracking-[0.18em] uppercase"
            style={{ color: "#7a786f" }}
          >
            {toFilePct > 0 ? `To file ${toFilePct}%` : "All clear"}
          </span>
        </div>

        <div
          className="relative overflow-hidden"
          style={{ height: 10, background: "var(--steel-2)", border: "1px solid var(--rule-2)" }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 transition-all duration-500"
            style={{
              width: `${readinessPct}%`,
              background: `linear-gradient(90deg, var(--amber), ${scoreColor})`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, transparent 0 8px, rgba(0,0,0,0.2) 8px 9px)",
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 font-mono text-[11.5px] tracking-[0.04em]"
              style={{ color: "var(--bone-dim)" }}
            >
              <span
                className="rounded-full shrink-0"
                style={{ width: 8, height: 8, background: NERIS_DOT[item.status], display: "block" }}
              />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Page skeleton (SSR-safe) ─────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div>
      <div
        className="-mx-4 md:-mx-8 -mt-6"
        style={{ background: "var(--ink)", borderBottom: "1px solid var(--rule)", height: 90 }}
        aria-hidden
      />
      <div className="grid grid-cols-12 gap-[14px] pt-[18px]">
        {(["col-span-12 xl:col-span-5", "col-span-12 xl:col-span-7", "col-span-12 xl:col-span-7", "col-span-12 xl:col-span-5"] as const).map(
          (cls, i) => (
            <div
              key={i}
              className={`${cls} h-48 animate-pulse`}
              style={{ background: "var(--steel)", borderRadius: 2 }}
              aria-hidden
            />
          )
        )}
      </div>
    </div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <PageSkeleton />;

  return (
    <div>
      <div className="grid grid-cols-12 gap-[14px] pt-[18px] pb-9">
        <FleetStatusCard />
        <DispatchesCard />
        <IncidentTallyCard />
        <NerisCard />
      </div>
    </div>
  );
}
