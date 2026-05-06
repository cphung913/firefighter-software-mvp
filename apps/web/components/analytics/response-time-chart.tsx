"use client";

import type { TrendWeek } from "@/lib/analytics/api";

export interface ResponseTimeChartProps {
  weeks: TrendWeek[];
  height?: number;
  nfpaBenchmarkSeconds?: number;
}

function abbrevWeekLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ResponseTimeChart({
  weeks,
  height = 260,
  nfpaBenchmarkSeconds = 17 * 60,
}: ResponseTimeChartProps) {
  const vw = 800;
  const vh = height;
  const padL = 52;
  const padR = 28;
  const padT = 36;
  const padB = 52;
  const innerW = vw - padL - padR;
  const innerH = vh - padT - padB;

  const benchmarkMin = nfpaBenchmarkSeconds / 60;

  const minuteVals = weeks
    .map((w) =>
      w.avg_total_response_seconds !== null &&
      w.avg_total_response_seconds !== undefined
        ? w.avg_total_response_seconds / 60
        : null
    )
    .filter((m): m is number => m !== null);

  const maxData =
    minuteVals.length > 0 ? Math.max(...minuteVals) : 0;
  const yMax = Math.max(maxData * 1.2, benchmarkMin * 1.05, 5);

  const n = weeks.length;
  if (n === 0) {
    return (
      <div
        className="flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.12em]"
        style={{
          height,
          background: "var(--steel)",
          border: "1px solid var(--rule)",
          color: "var(--bone-dim)",
        }}
      >
        No weekly trend data
      </div>
    );
  }

  function xAt(i: number): number {
    if (n <= 1) return padL + innerW / 2;
    return padL + (innerW * i) / (n - 1);
  }

  function yAt(minutes: number): number {
    const t = minutes / yMax;
    return padT + innerH * (1 - t);
  }

  const segments: string[][] = [];
  let currentSeg: string[] = [];
  weeks.forEach((w, i) => {
    const m =
      w.avg_total_response_seconds !== null &&
      w.avg_total_response_seconds !== undefined
        ? w.avg_total_response_seconds / 60
        : null;
    if (m === null) {
      if (currentSeg.length) {
        segments.push(currentSeg);
        currentSeg = [];
      }
      return;
    }
    currentSeg.push(`${xAt(i)},${yAt(m)}`);
  });
  if (currentSeg.length) segments.push(currentSeg);

  const benchmarkY = yAt(Math.min(benchmarkMin, yMax));

  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((yMax * i) / yTicks)
  );

  return (
    <div className="w-full" style={{ height }}>
      <svg
        className="block h-full w-full"
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Weekly average response time trend"
      >
        <rect
          x={0}
          y={0}
          width={vw}
          height={vh}
          fill="transparent"
        />

        {tickVals.map((tv) => {
          const yy = yAt(tv);
          return (
            <g key={tv}>
              <line
                x1={padL}
                x2={vw - padR}
                y1={yy}
                y2={yy}
                stroke="var(--rule)"
                strokeWidth={1}
                opacity={0.35}
              />
              <text
                x={padL - 8}
                y={yy + 4}
                textAnchor="end"
                fill="var(--bone-dim)"
                style={{ fontFamily: "ui-monospace, monospace", fontSize: 10 }}
              >
                {tv}
              </text>
            </g>
          );
        })}

        <line
          x1={padL}
          x2={vw - padR}
          y1={benchmarkY}
          y2={benchmarkY}
          stroke="var(--amber)"
          strokeWidth={1.5}
          strokeDasharray="6 5"
        />

        {segments.map((pts, si) =>
          pts.length > 1 ? (
            <polyline
              key={si}
              fill="none"
              stroke="var(--blue)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={pts.join(" ")}
            />
          ) : null
        )}

        {weeks.map((w, i) => {
          const m =
            w.avg_total_response_seconds !== null &&
            w.avg_total_response_seconds !== undefined
              ? w.avg_total_response_seconds / 60
              : null;
          if (m === null) return null;
          const cx = xAt(i);
          const cy = yAt(m);
          const title = `${abbrevWeekLabel(w.week_start)} · avg ${m.toFixed(
            1
          )} min · ${w.incident_count} incidents`;
          return (
            <circle
              key={w.week_start}
              cx={cx}
              cy={cy}
              r={4}
              fill="var(--blue)"
              stroke="var(--steel)"
              strokeWidth={1}
            >
              <title>{title}</title>
            </circle>
          );
        })}

        {weeks.map((w, i) => (
          <text
            key={`lbl-${w.week_start}`}
            x={xAt(i)}
            y={vh - 18}
            textAnchor="middle"
            fill="var(--bone-dim)"
            style={{ fontFamily: "ui-monospace, monospace", fontSize: 9 }}
          >
            {abbrevWeekLabel(w.week_start)}
          </text>
        ))}

        <text
          x={padL}
          y={20}
          fill="var(--bone)"
          style={{
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontSize: 11,
          }}
        >
          Minutes (avg total response)
        </text>

        <g transform={`translate(${vw - padR - 220}, 12)`}>
          <rect
            x={0}
            y={0}
            width={10}
            height={3}
            fill="var(--blue)"
            transform="translate(0, 4)"
          />
          <text
            x={16}
            y={10}
            fill="var(--bone-dim)"
            style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: 10 }}
          >
            Avg Response
          </text>
          <line
            x1={0}
            x2={14}
            y1={22}
            y2={22}
            stroke="var(--amber)"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <text
            x={16}
            y={26}
            fill="var(--bone-dim)"
            style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: 10 }}
          >
            NFPA 1720 Target
          </text>
        </g>
      </svg>
    </div>
  );
}
