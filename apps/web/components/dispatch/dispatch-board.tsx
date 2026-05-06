"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";

import type { IncidentRecord } from "@/lib/db";
import { db } from "@/lib/db";
import { NERIS_INCIDENT_TYPES } from "@/lib/incidents/options";

type DispatchStatus = "dispatched" | "enroute" | "onscene";

function deriveStatus(incident: IncidentRecord): DispatchStatus {
  if (incident.on_scene_time) return "onscene";
  if (incident.en_route_time) return "enroute";
  return "dispatched";
}

const STATUS_PILL: Record<DispatchStatus, { label: string; style: React.CSSProperties }> = {
  onscene: {
    label: "On Scene",
    style: {
      background: "rgba(232,161,58,0.2)",
      color: "var(--amber)",
      borderColor: "rgba(232,161,58,0.45)",
    },
  },
  enroute: {
    label: "En Route",
    style: {
      background: "rgba(74,143,181,0.22)",
      color: "#7ec8e8",
      borderColor: "rgba(74,143,181,0.5)",
    },
  },
  dispatched: {
    label: "Dispatched",
    style: {
      background: "rgba(78,168,100,0.2)",
      color: "#6dd88a",
      borderColor: "rgba(78,168,100,0.45)",
    },
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

function lookupType(value?: string | null): string {
  if (!value) return "Unknown type";
  return NERIS_INCIDENT_TYPES.find((o) => o.value === value)?.label ?? value;
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

function formatClock(nowMs: number): string {
  const d = new Date(nowMs);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

const EMPTY: IncidentRecord[] = [];

export function DispatchBoard() {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

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

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (list.length <= 4) return;
    const id = window.setInterval(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollTop + clientHeight >= scrollHeight - 4) {
        el.scrollTop = 0;
      } else {
        el.scrollTop += 1;
      }
    }, 48);
    return () => window.clearInterval(id);
  }, [list.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        router.push("/dispatch");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  function exitBoard() {
    router.push("/dispatch");
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col text-[var(--bone)]"
      style={{ background: "#0d0f14", fontSize: 18, minHeight: "100dvh" }}
    >
      <header
        className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5 pb-3 md:px-10"
        style={{ borderBottom: "1px solid rgba(243,238,229,0.12)" }}
      >
        <div>
          <h1
            className="font-display font-semibold uppercase tracking-[0.12em]"
            style={{ fontSize: "clamp(28px, 3.2vw, 42px)", margin: 0, color: "var(--bone)" }}
          >
            Station dispatch board
          </h1>
          <p className="mt-1 font-body text-[16px] opacity-75">Active calls — read-only display</p>
        </div>
        <div className="flex items-center gap-4">
          <div
            className="font-mono text-right tabular-nums"
            style={{ fontSize: "clamp(28px, 3vw, 40px)", fontWeight: 600, letterSpacing: "0.04em" }}
          >
            {formatClock(now)}
          </div>
          <button
            type="button"
            onClick={exitBoard}
            className="shrink-0 rounded border border-white/20 px-3 py-2 font-mono text-[14px] uppercase tracking-[0.12em] text-white/80 hover:bg-white/10"
            aria-label="Exit board"
          >
            ×
          </button>
        </div>
      </header>

      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8">
        {list.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
            <p
              className="font-display font-semibold uppercase tracking-[0.14em]"
              style={{ fontSize: "clamp(36px, 5vw, 56px)", color: "var(--green)" }}
            >
              ALL UNITS AVAILABLE
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
            {list.map((incident) => {
              const status = deriveStatus(incident);
              const pill = STATUS_PILL[status];
              const units = incident.units_responding ?? [];
              const personnel = incident.personnel_on_scene ?? [];
              const raw = incident.raw_data as Record<string, unknown> | undefined;
              const priorityKey = normalizePriorityKey(raw?.priority ?? "medium");
              const prColor = priorityAccentColor(priorityKey);

              return (
                <Fragment key={incident.local_id}>
                  <article
                    className="border border-white/10 bg-black/25 px-6 py-5 md:px-8 md:py-6"
                    style={{ borderLeftWidth: 6, borderLeftColor: prColor }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 space-y-3">
                        <p
                          className="font-display font-semibold uppercase tracking-[0.06em] leading-tight"
                          style={{ fontSize: "clamp(28px, 3.2vw, 38px)", color: "var(--bone)" }}
                        >
                          {lookupType(incident.incident_type)}
                        </p>
                        <p className="font-body text-[20px] leading-snug text-white/85">
                          {incident.location_address ?? "No address entered"}
                        </p>
                        {units.length > 0 && (
                          <p className="font-mono text-[17px] uppercase tracking-[0.08em] text-white/70">
                            Units: {units.join(", ")}
                          </p>
                        )}
                      </div>
                      <span
                        className="font-display font-semibold uppercase tracking-[0.16em] px-4 py-2 border shrink-0"
                        style={{ ...pill.style, fontSize: 15 }}
                      >
                        {pill.label}
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap items-end gap-8">
                      <div>
                        <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-white/45">
                          Elapsed
                        </p>
                        <p
                          className="font-mono font-semibold tabular-nums"
                          style={{ fontSize: "clamp(36px, 4.5vw, 52px)", letterSpacing: "0.02em" }}
                        >
                          {incident.dispatch_time
                            ? formatElapsed(incident.dispatch_time, now)
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-white/45">
                          Personnel on scene
                        </p>
                        <p className="font-mono font-semibold tabular-nums" style={{ fontSize: 40 }}>
                          {personnel.length}
                        </p>
                      </div>
                    </div>
                  </article>
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      <footer className="shrink-0 px-6 py-3 md:px-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/35">
          Press ? to exit to dispatch
        </p>
      </footer>
    </div>
  );
}
