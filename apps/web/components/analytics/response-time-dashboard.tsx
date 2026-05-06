"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchResponseTimeIncidents,
  fetchResponseTimeSummary,
  fetchResponseTimeTrend,
  formatSeconds,
  type ResponseTimeIncident,
  type ResponseTimeSummary,
} from "@/lib/analytics/api";
import { ResponseTimeChart } from "@/components/analytics/response-time-chart";

const PAGE_SIZE = 20;

function Pill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-display font-semibold text-[10.5px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border transition-colors"
      style={{
        borderColor: active ? "var(--blue)" : "var(--rule)",
        background: active ? "rgba(74,143,181,0.14)" : "transparent",
        color: active ? "var(--bone)" : "var(--bone-dim)",
      }}
    >
      {label}
    </button>
  );
}

function StatCard({
  title,
  subtitle,
  value,
  hint,
}: {
  title: string;
  subtitle: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      className="flex flex-col gap-1 p-[18px]"
      style={{
        background: "var(--steel)",
        border: "1px solid var(--rule-2)",
        borderRadius: 2,
      }}
    >
      <span className="font-display font-semibold text-[11px] tracking-[0.16em] uppercase text-[var(--bone-dim)]">
        {title}
      </span>
      <span
        className="font-mono text-[28px] leading-none tracking-[0.04em] text-[var(--bone)]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
      <span className="font-body text-[12px] text-[var(--bone-dim)]">{subtitle}</span>
      {hint && (
        <span className="font-mono text-[10px] tracking-[0.06em] uppercase mt-1" style={{ color: "#7a786f" }}>
          {hint}
        </span>
      )}
    </div>
  );
}

function complianceColor(pct: number | null): string {
  if (pct === null || Number.isNaN(pct)) return "var(--bone-dim)";
  if (pct >= 80) return "var(--green)";
  if (pct >= 50) return "var(--amber)";
  return "var(--signal)";
}

function formatAlarm(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ResponseTimeDashboard() {
  const [days, setDays] = useState(90);
  const [summary, setSummary] = useState<ResponseTimeSummary | null>(null);
  const [trend, setTrend] = useState<Awaited<
    ReturnType<typeof fetchResponseTimeTrend>
  > | null>(null);
  const [incidents, setIncidents] = useState<ResponseTimeIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const incidentDays = Math.min(days, 90);
      const [s, tr, inc] = await Promise.all([
        fetchResponseTimeSummary(days),
        fetchResponseTimeTrend(days),
        fetchResponseTimeIncidents(incidentDays, 200),
      ]);
      setSummary(s);
      setTrend(tr);
      setIncidents(inc);
      setPage(0);
    } catch {
      setSummary(null);
      setTrend(null);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(incidents.length / PAGE_SIZE) - 1);
    setPage((p) => Math.min(p, maxPage));
  }, [incidents.length]);

  const totalPages = Math.max(1, Math.ceil(incidents.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageSlice = useMemo(
    () =>
      incidents.slice(
        pageSafe * PAGE_SIZE,
        pageSafe * PAGE_SIZE + PAGE_SIZE
      ),
    [incidents, pageSafe]
  );

  const benchHint =
    summary !== null
      ? `NFPA 1720 target ≤ ${formatSeconds(summary.nfpa_benchmark_seconds)} total`
      : undefined;

  const compliancePct = summary?.nfpa_1720_compliance_pct ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase mr-2" style={{ color: "#7a786f" }}>
          Period
        </span>
        <Pill active={days === 30} label="30 days" onClick={() => setDays(30)} />
        <Pill active={days === 90} label="90 days" onClick={() => setDays(90)} />
        <Pill active={days === 365} label="1 year" onClick={() => setDays(365)} />
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{
            padding: "48px 16px",
            background: "var(--steel)",
            border: "1px solid var(--rule)",
            color: "#7a786f",
          }}
        >
          Loading analytics…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-12 gap-[14px]">
            <div className="col-span-12 md:col-span-6 xl:col-span-3">
              <StatCard
                title="Avg turnout"
                subtitle="Dispatch → En Route"
                value={formatSeconds(summary?.avg_turnout_seconds ?? null)}
                hint={benchHint}
              />
            </div>
            <div className="col-span-12 md:col-span-6 xl:col-span-3">
              <StatCard
                title="Avg travel"
                subtitle="En Route → On Scene"
                value={formatSeconds(summary?.avg_travel_seconds ?? null)}
              />
            </div>
            <div className="col-span-12 md:col-span-6 xl:col-span-3">
              <StatCard
                title="Avg total response"
                subtitle="Dispatch → On Scene"
                value={formatSeconds(summary?.avg_total_response_seconds ?? null)}
                hint={
                  summary?.p90_total_response_seconds != null
                    ? `P90 ${formatSeconds(summary.p90_total_response_seconds)}`
                    : undefined
                }
              />
            </div>
            <div className="col-span-12 md:col-span-6 xl:col-span-3">
              <div
                className="flex flex-col gap-1 p-[18px] h-full"
                style={{
                  background: "var(--steel)",
                  border: "1px solid var(--rule-2)",
                  borderRadius: 2,
                }}
              >
                <span className="font-display font-semibold text-[11px] tracking-[0.16em] uppercase text-[var(--bone-dim)]">
                  NFPA 1720 compliance
                </span>
                <span
                  className="font-mono text-[28px] leading-none tracking-[0.04em]"
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    color: complianceColor(compliancePct),
                  }}
                >
                  {compliancePct !== null ? `${compliancePct.toFixed(1)}%` : "—"}
                </span>
                <span className="font-body text-[12px] text-[var(--bone-dim)]">
                  Share of incidents meeting total response benchmark
                </span>
                {summary !== null && (
                  <span className="font-mono text-[10px] tracking-[0.06em] uppercase mt-1" style={{ color: "#7a786f" }}>
                    {summary.incidents_with_response_data} of {summary.total_incidents} incidents scored
                  </span>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              background: "var(--steel)",
              border: "1px solid var(--rule-2)",
              borderRadius: 2,
            }}
          >
            <div
              className="flex items-center gap-2.5 px-4 py-[13px]"
              style={{ borderBottom: "1px solid var(--rule)" }}
            >
              <h2 className="font-display font-semibold text-[15px] uppercase tracking-[0.16em] text-[var(--bone)]">
                Weekly Response Time Trend
              </h2>
              {trend && trend.weeks.length > 0 && (
                <span className="font-mono text-[11px] tracking-[0.06em]" style={{ color: "#7a786f" }}>
                  — {trend.weeks.length} weeks
                </span>
              )}
            </div>
            <div className="p-3">
              <ResponseTimeChart
                weeks={trend?.weeks ?? []}
                nfpaBenchmarkSeconds={
                  summary?.nfpa_benchmark_seconds ?? 17 * 60
                }
              />
            </div>
          </div>

          <div
            style={{
              background: "var(--steel)",
              border: "1px solid var(--rule-2)",
              borderRadius: 2,
            }}
          >
            <div
              className="flex items-center gap-2.5 px-4 py-[13px]"
              style={{ borderBottom: "1px solid var(--rule)" }}
            >
              <h2 className="font-display font-semibold text-[15px] uppercase tracking-[0.16em] text-[var(--bone)]">
                By incident type
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse font-body text-[13px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--rule)" }}>
                    <th className="text-left px-4 py-3 font-display font-semibold text-[11px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">
                      Type
                    </th>
                    <th className="text-right px-4 py-3 font-display font-semibold text-[11px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">
                      Count
                    </th>
                    <th className="text-right px-4 py-3 font-display font-semibold text-[11px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">
                      Avg total response
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.by_incident_type ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "#7a786f" }}>
                        No incidents in period
                      </td>
                    </tr>
                  ) : (
                    summary!.by_incident_type.map((row) => (
                      <tr
                        key={row.incident_type || "__none__"}
                        style={{ borderBottom: "1px solid var(--rule)" }}
                      >
                        <td className="px-4 py-2.5 text-[var(--bone)]">
                          {row.incident_type?.replace(/_/g, " ") || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-[var(--bone)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {row.count}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-[var(--bone)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatSeconds(row.avg_total_response_seconds)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div
            style={{
              background: "var(--steel)",
              border: "1px solid var(--rule-2)",
              borderRadius: 2,
            }}
          >
            <div
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-[13px]"
              style={{ borderBottom: "1px solid var(--rule)" }}
            >
              <h2 className="font-display font-semibold text-[15px] uppercase tracking-[0.16em] text-[var(--bone)]">
                Recent incidents
              </h2>
              <span className="font-mono text-[11px] tracking-[0.06em]" style={{ color: "#7a786f" }}>
                Last {Math.min(days, 90)} days · up to 200 rows
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse font-body text-[12px] min-w-[880px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--rule)" }}>
                    {[
                      "Incident #",
                      "Type",
                      "Alarm",
                      "Address",
                      "Turnout",
                      "Travel",
                      "Total",
                      "NFPA",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`px-3 py-3 font-display font-semibold text-[10px] uppercase tracking-[0.14em] text-[var(--bone-dim)] ${
                          h === "NFPA"
                            ? "text-center"
                            : ["Incident #", "Type", "Alarm", "Address"].includes(h)
                              ? "text-left"
                              : "text-right"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {incidents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "#7a786f" }}>
                        No incidents in window
                      </td>
                    </tr>
                  ) : (
                    pageSlice.map((row) => (
                      <tr
                        key={row.incident_id}
                        style={{ borderBottom: "1px solid var(--rule)" }}
                      >
                        <td className="px-3 py-2 font-mono text-[11px] text-[var(--bone)] whitespace-nowrap">
                          {row.incident_number ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-[var(--bone)] whitespace-nowrap">
                          {(row.incident_type ?? "").replace(/_/g, " ") || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-[var(--bone)] whitespace-nowrap">
                          {formatAlarm(row.alarm_time)}
                        </td>
                        <td className="px-3 py-2 text-[var(--bone)] max-w-[220px] truncate">
                          {row.location_address ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] text-[var(--bone)] tabular-nums">
                          {formatSeconds(row.turnout_seconds)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] text-[var(--bone)] tabular-nums">
                          {formatSeconds(row.travel_seconds)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] text-[var(--bone)] tabular-nums">
                          {formatSeconds(row.total_response_seconds)}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-[12px]">
                          {row.meets_nfpa_1720 === null
                            ? "—"
                            : row.meets_nfpa_1720
                              ? "✓"
                              : "✗"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {incidents.length > PAGE_SIZE && (
              <div
                className="flex items-center justify-between px-4 py-3 font-mono text-[11px]"
                style={{ borderTop: "1px solid var(--rule)", color: "#7a786f" }}
              >
                <button
                  type="button"
                  disabled={pageSafe <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="uppercase tracking-[0.12em] disabled:opacity-40"
                  style={{ color: "var(--bone)" }}
                >
                  Prev
                </button>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  Page {pageSafe + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={pageSafe >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  className="uppercase tracking-[0.12em] disabled:opacity-40"
                  style={{ color: "var(--bone)" }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
