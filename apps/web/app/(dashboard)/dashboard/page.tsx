"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSyncStore } from "@/store/sync-store";

// ─── LiveClock ────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      className="font-display font-semibold text-[32px] tracking-[0.06em] leading-none text-[var(--bone)]"
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {time || "--:--"}
    </span>
  );
}

// ─── StatusBoard ─────────────────────────────────────────────────────────────

function StatBlock({
  label,
  children,
  delta,
}: {
  label: string;
  children: React.ReactNode;
  delta: string;
}) {
  return (
    <div
      className="flex flex-col gap-0.5 pl-[14px] shrink-0"
      style={{ borderLeft: "1px solid var(--rule)" }}
    >
      <span
        className="font-mono text-[10px] tracking-[0.16em] uppercase"
        style={{ color: "#7a786f" }}
      >
        {label}
      </span>
      <div
        className="font-display font-semibold text-[26px] tracking-[0.04em] leading-tight"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {children}
      </div>
      <span
        className="font-mono text-[10px] tracking-[0.06em]"
        style={{ color: "var(--green)" }}
      >
        {delta}
      </span>
    </div>
  );
}

function StatusBoard({
  incidentCount,
  onDuty,
  online,
}: {
  incidentCount: number;
  onDuty: number;
  online: boolean;
}) {
  return (
    <div
      className="-mx-4 md:-mx-8 -mt-6 relative overflow-hidden"
      style={{
        background: "var(--ink)",
        borderBottom: "1px solid var(--rule)",
        padding: "18px 24px",
      }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-[6px]"
        style={{
          background:
            "repeating-linear-gradient(45deg, var(--signal) 0 10px, var(--ink) 10px 20px)",
          opacity: 0.4,
        }}
      />
      <div className="flex flex-wrap items-center gap-7 pl-3">
        <div className="flex flex-col gap-1 shrink-0">
          <span
            className="font-mono text-[10px] tracking-[0.18em] uppercase"
            style={{ color: "#7a786f" }}
          >
            // Shift Clock
          </span>
          <LiveClock />
          <span
            className="font-display text-[11px] tracking-[0.18em] uppercase"
            style={{ color: "var(--signal)" }}
          >
            B-SHIFT
          </span>
        </div>

        <div
          className="pl-6 shrink-0"
          style={{ borderLeft: "1px solid var(--rule)" }}
        >
          <h1 className="font-display font-semibold text-[32px] tracking-[0.04em] uppercase leading-none text-[var(--bone)] mb-1.5">
            Dashboard
          </h1>
          <div
            className="font-mono text-[11.5px] tracking-[0.04em]"
            style={{ color: "#7a786f" }}
          >
            Station 14 ·{" "}
            <span className="font-mono" style={{ color: "var(--bone-dim)" }}>
              Springfield, NY
            </span>
          </div>
        </div>

        <StatBlock label="Open Calls" delta="+1 vs avg">
          <span style={{ color: "var(--signal)" }}>
            {String(incidentCount).padStart(2, "0")}
          </span>
        </StatBlock>

        <StatBlock label="On Duty" delta="3 in qtrs">
          <span className="text-[var(--bone)]">
            {onDuty}
            <span
              className="font-display"
              style={{ fontSize: 13, color: "#7a786f" }}
            >
              /14
            </span>
          </span>
        </StatBlock>

        <StatBlock label="NERIS" delta="ready">
          <span style={{ color: "var(--green)" }}>92%</span>
        </StatBlock>

        <div
          className="ml-auto flex items-center gap-2 pl-[14px] shrink-0"
          style={{ borderLeft: "1px solid var(--rule)" }}
        >
          <Link
            href="/incidents/new"
            className="inline-flex items-center gap-2 px-4 py-2 font-display font-semibold text-[12px] tracking-[0.16em] uppercase text-[var(--bone)] transition-colors"
            style={{
              background: "var(--signal)",
              border: "1px solid var(--signal)",
              borderRadius: "3px",
            }}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Report
          </Link>
        </div>
      </div>
    </div>
  );
}

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

// ─── TasksCard ────────────────────────────────────────────────────────────────

type TaskPriority = "urgent" | "high" | "medium";

const TASK_CHECKBOX_STYLE: Record<TaskPriority, React.CSSProperties> = {
  urgent: {
    borderColor: "var(--signal)",
    boxShadow: "0 0 0 3px rgba(200,54,44,0.14)",
  },
  high: { borderColor: "var(--amber)" },
  medium: { borderColor: "var(--blue)" },
};

const PRIO_TAG_STYLE: Record<TaskPriority, React.CSSProperties> = {
  urgent: { background: "var(--signal)", color: "var(--bone)" },
  high: {
    background: "rgba(200,54,44,0.14)",
    color: "var(--signal)",
    border: "1px solid rgba(200,54,44,0.4)",
  },
  medium: {
    background: "rgba(232,161,58,0.14)",
    color: "var(--amber)",
    border: "1px solid rgba(232,161,58,0.4)",
  },
};

const PRIO_LABELS: Record<TaskPriority, string> = {
  urgent: "URGENT",
  high: "HIGH",
  medium: "MEDIUM",
};

const TASKS: {
  id: number;
  title: string;
  sub: string;
  cat: string;
  priority: TaskPriority;
}[] = [
  {
    id: 1,
    title: "Update equipment inventory",
    sub: "Due Feb 19, 2026 · Eng 14",
    cat: "RIG",
    priority: "urgent",
  },
  {
    id: 2,
    title: "Complete monthly inspection report",
    sub: "Due Feb 12, 2026 · ISO Pkt.",
    cat: "HYD",
    priority: "high",
  },
  {
    id: 3,
    title: "Review training certifications",
    sub: "Due Feb 23, 2026 · 4 expiring",
    cat: "TRN",
    priority: "medium",
  },
];

function TasksCard() {
  return (
    <Card tag="REQ-01" className="col-span-12 xl:col-span-5">
      <CardHead title="My Tasks" meta="— 03 OPEN" />
      {TASKS.map((task, i) => (
        <div
          key={task.id}
          style={{
            display: "grid",
            gridTemplateColumns: "22px 1fr auto",
            gap: "12px",
            padding: "14px 16px",
            borderBottom:
              i < TASKS.length - 1 ? "1px solid var(--rule)" : undefined,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              border: "1.5px solid",
              borderRadius: 3,
              flexShrink: 0,
              ...TASK_CHECKBOX_STYLE[task.priority],
            }}
          />
          <div>
            <b
              className="font-body font-semibold text-[14px] text-[var(--bone)] block mb-0.5"
              style={{ fontWeight: 600 }}
            >
              {task.title}
            </b>
            <span
              className="font-mono text-[11px] tracking-[0.04em]"
              style={{ color: "#7a786f" }}
            >
              {task.sub}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="font-mono text-[10px] px-2 py-1 tracking-[0.06em]"
              style={{
                background: "rgba(232,161,58,0.12)",
                color: "var(--amber)",
                border: "1px solid rgba(232,161,58,0.3)",
                borderRadius: 2,
              }}
            >
              {task.cat}
            </span>
            <span
              className="font-display font-semibold text-[10px] px-2 py-1 tracking-[0.18em] uppercase"
              style={{ borderRadius: 2, ...PRIO_TAG_STYLE[task.priority] }}
            >
              {PRIO_LABELS[task.priority]}
            </span>
          </div>
        </div>
      ))}
    </Card>
  );
}

// ─── DispatchesCard ───────────────────────────────────────────────────────────

type DispatchStatus = "onscene" | "enroute" | "dispatched" | "cleared";

const DISPATCH_PIP: Record<
  DispatchStatus,
  { bg: string; shadow?: string }
> = {
  onscene: {
    bg: "var(--amber)",
    shadow: "0 0 0 4px rgba(232,161,58,0.18)",
  },
  enroute: {
    bg: "var(--blue)",
    shadow: "0 0 0 4px rgba(74,143,181,0.18)",
  },
  dispatched: {
    bg: "var(--green)",
    shadow: "0 0 0 4px rgba(78,168,100,0.18)",
  },
  cleared: { bg: "var(--bone-dim)" },
};

const DISPATCH_PILL: Record<
  DispatchStatus,
  { label: string; style: React.CSSProperties }
> = {
  onscene: {
    label: "On Scene",
    style: {
      background: "rgba(232,161,58,0.16)",
      color: "var(--amber)",
      borderColor: "rgba(232,161,58,0.4)",
    },
  },
  enroute: {
    label: "En Route",
    style: {
      background: "rgba(74,143,181,0.16)",
      color: "var(--blue)",
      borderColor: "rgba(74,143,181,0.4)",
    },
  },
  dispatched: {
    label: "Dispatched",
    style: {
      background: "rgba(78,168,100,0.16)",
      color: "var(--green)",
      borderColor: "rgba(78,168,100,0.4)",
    },
  },
  cleared: {
    label: "Cleared",
    style: {
      background: "rgba(243,238,229,0.06)",
      color: "var(--bone-dim)",
      borderColor: "var(--rule-2)",
    },
  },
};

const DISPATCHES: {
  id: string;
  addr: string;
  stamp: string;
  status: DispatchStatus;
}[] = [
  {
    id: "D-2026-001 · STRUCTURE",
    addr: "78 Tate Blvd, Springfield",
    stamp: "14:08 · Eng 14, L7 · 24 min on scene",
    status: "onscene",
  },
  {
    id: "D-2026-002 · EMS",
    addr: "456 Dok Ave, Springfield",
    stamp: "14:19 · M14 · ETA 4 min",
    status: "enroute",
  },
  {
    id: "D-2026-003 · BRUSH",
    addr: "678 Pine Rd, Springfield",
    stamp: "14:28 · BR-3 · Just dispatched",
    status: "dispatched",
  },
  {
    id: "26-0417 · EMS",
    addr: "RR-12 Mile 88 — Chest pain",
    stamp: "13:46 · Cleared · 38 min total",
    status: "cleared",
  },
];

function DispatchesCard() {
  return (
    <Card tag="LIVE · 03" className="col-span-12 xl:col-span-7">
      <CardHead title="Active Dispatches" meta="— REAL TIME" />
      {DISPATCHES.map((d, i) => {
        const pip = DISPATCH_PIP[d.status];
        const pill = DISPATCH_PILL[d.status];
        return (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "12px 1fr auto",
              gap: "14px",
              padding: "14px 16px",
              borderBottom:
                i < DISPATCHES.length - 1
                  ? "1px solid var(--rule)"
                  : undefined,
              alignItems: "center",
            }}
          >
            <span
              className="rounded-full shrink-0"
              style={{
                width: 10,
                height: 10,
                background: pip.bg,
                boxShadow: pip.shadow,
                display: "block",
              }}
            />
            <div>
              <b
                className="font-mono text-[14px] tracking-[0.04em] text-[var(--bone)] block mb-1"
                style={{ fontWeight: 600 }}
              >
                {d.id}
              </b>
              <div
                className="flex items-center gap-1.5 text-[12.5px] mb-0.5"
                style={{ color: "var(--bone-dim)" }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ width: 12, height: 12, color: "#7a786f", flexShrink: 0 }}
                >
                  <path d="M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                {d.addr}
              </div>
              <div
                className="font-mono text-[10.5px] tracking-[0.04em]"
                style={{ color: "#7a786f" }}
              >
                {d.stamp}
              </div>
            </div>
            <span
              className="font-display font-semibold text-[10.5px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border shrink-0"
              style={pill.style}
            >
              {pill.label}
            </span>
          </div>
        );
      })}
    </Card>
  );
}

// ─── IncidentTallyCard ────────────────────────────────────────────────────────

const TALLY: { label: string; pct: number; count: number; color: string }[] = [
  { label: "EMS", pct: 62, count: 133, color: "var(--blue)" },
  { label: "Fire", pct: 15, count: 32, color: "var(--signal)" },
  { label: "Other", pct: 12, count: 26, color: "var(--amber)" },
  { label: "MVA", pct: 8, count: 17, color: "var(--purple)" },
  { label: "Mutual Aid", pct: 3, count: 6, color: "var(--green)" },
];

function IncidentTallyCard() {
  return (
    <Card tag="LAST 30D" className="col-span-12 xl:col-span-7">
      <CardHead title="Incident Tally" meta="— 214 CALLS" />
      <div className="flex flex-col gap-2.5 p-4">
        {TALLY.map((row) => (
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
                style={{ width: `${row.pct}%`, background: row.color }}
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
              <small style={{ color: "#7a786f" }}>· {row.pct}%</small>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── NerisCard ────────────────────────────────────────────────────────────────

type NerisStatus = "ok" | "warn" | "bad";

const NERIS_DOT: Record<NerisStatus, string> = {
  ok: "var(--green)",
  warn: "var(--amber)",
  bad: "var(--signal)",
};

const NERIS_ITEMS: { label: string; status: NerisStatus }[] = [
  { label: "Apparatus IDs mapped", status: "ok" },
  { label: "Personnel records", status: "ok" },
  { label: "Address geocoding", status: "ok" },
  { label: "2 reports w/ missing fields", status: "warn" },
  { label: "Mutual aid → Twp 6 pending", status: "warn" },
  { label: "1 NEMSIS export failed", status: "bad" },
];

function NerisCard() {
  return (
    <Card tag="REQ-02 · COMPLIANCE" className="col-span-12 xl:col-span-5">
      <CardHead title="NERIS Readiness" meta="— 92% READY" />
      <div className="flex flex-col gap-3.5 p-[18px]">
        <div className="flex items-baseline justify-between">
          <span
            className="font-display font-semibold text-[38px] tracking-[0.04em] leading-none"
            style={{ color: "var(--green)", fontVariantNumeric: "tabular-nums" }}
          >
            92%
          </span>
          <span
            className="font-display font-semibold text-[11px] tracking-[0.18em] uppercase"
            style={{ color: "#7a786f" }}
          >
            // 8% to file
          </span>
        </div>

        <div
          className="relative overflow-hidden"
          style={{
            height: 10,
            background: "var(--steel-2)",
            border: "1px solid var(--rule-2)",
          }}
        >
          <div
            className="absolute left-0 top-0 bottom-0"
            style={{
              width: "92%",
              background: "linear-gradient(90deg, var(--amber), var(--green))",
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
          {NERIS_ITEMS.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 font-mono text-[11.5px] tracking-[0.04em]"
              style={{ color: "var(--bone-dim)" }}
            >
              <span
                className="rounded-full shrink-0"
                style={{
                  width: 8,
                  height: 8,
                  background: NERIS_DOT[item.status],
                  display: "block",
                }}
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
        style={{
          background: "var(--ink)",
          borderBottom: "1px solid var(--rule)",
          height: 90,
        }}
        aria-hidden
      />
      <div className="grid grid-cols-12 gap-[14px] pt-[18px]">
        {(
          [
            "col-span-12 xl:col-span-5",
            "col-span-12 xl:col-span-7",
            "col-span-12 xl:col-span-7",
            "col-span-12 xl:col-span-5",
          ] as const
        ).map((cls, i) => (
          <div
            key={i}
            className={`${cls} h-48 animate-pulse`}
            style={{ background: "var(--steel)", borderRadius: 2 }}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const storeOnline = useSyncStore((s) => s.online);
  const [online, setOnline] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOnline(storeOnline);
  }, [storeOnline]);

  if (!mounted) return <PageSkeleton />;

  return (
    <div>
      <StatusBoard incidentCount={3} onDuty={11} online={online} />
      <div className="grid grid-cols-12 gap-[14px] pt-[18px] pb-9">
        <TasksCard />
        <DispatchesCard />
        <IncidentTallyCard />
        <NerisCard />
      </div>
    </div>
  );
}
