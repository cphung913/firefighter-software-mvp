"use client";

import type { IncidentRecord } from "@/lib/db";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(value?: string | null): string {
  if (!value) return "Not recorded";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not recorded";

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => (typeof item === "string" ? [item] : []));
}

function readNumber(value: unknown): string {
  return typeof value === "number" ? String(value) : "0";
}

export function printIncidentPdf(
  incident: IncidentRecord,
  incidentTypeLabel: string,
  propertyUseLabel: string
): void {
  const rawData = (incident.raw_data ?? {}) as Record<string, unknown>;
  const casualtyInfo =
    rawData.casualty_info && typeof rawData.casualty_info === "object"
      ? (rawData.casualty_info as Record<string, unknown>)
      : {};

  const units = readStringArray(rawData.units_responding_labels).join(", ") || "None listed";
  const personnel =
    readStringArray(rawData.personnel_on_scene_names).join(", ") || "None listed";
  const actions = readStringArray(rawData.actions_taken).join(", ") || "None listed";

  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!printWindow) {
    throw new Error("Unable to open the print window on this device.");
  }

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(incident.incident_number ?? "Incident report")}</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #111827;
        margin: 32px;
        line-height: 1.45;
      }
      h1, h2 {
        margin: 0 0 12px;
      }
      h1 {
        font-size: 28px;
      }
      h2 {
        font-size: 16px;
        margin-top: 28px;
        padding-top: 12px;
        border-top: 1px solid #e5e7eb;
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px 24px;
      }
      .row {
        margin-bottom: 8px;
      }
      .label {
        font-size: 12px;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .value {
        font-size: 15px;
        margin-top: 2px;
      }
      .box {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
      }
      .paragraph {
        white-space: pre-wrap;
      }
      @media print {
        body {
          margin: 20px;
        }
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(incident.incident_number ?? "Incident report")}</h1>
    <div class="meta">
      <div class="row">
        <div class="label">Incident type</div>
        <div class="value">${escapeHtml(incidentTypeLabel)}</div>
      </div>
      <div class="row">
        <div class="label">Property use</div>
        <div class="value">${escapeHtml(propertyUseLabel)}</div>
      </div>
      <div class="row">
        <div class="label">Address</div>
        <div class="value">${escapeHtml(incident.location_address ?? "Not recorded")}</div>
      </div>
      <div class="row">
        <div class="label">GPS</div>
        <div class="value">${escapeHtml(
          incident.location_lat != null && incident.location_lng != null
            ? `${incident.location_lat}, ${incident.location_lng}`
            : "Not recorded"
        )}</div>
      </div>
    </div>

    <h2>Timeline</h2>
    <div class="box meta">
      <div class="row"><div class="label">Alarm</div><div class="value">${escapeHtml(
        formatDateTime(incident.alarm_time)
      )}</div></div>
      <div class="row"><div class="label">Dispatch</div><div class="value">${escapeHtml(
        formatDateTime(typeof rawData.dispatch_time === "string" ? rawData.dispatch_time : null)
      )}</div></div>
      <div class="row"><div class="label">En route</div><div class="value">${escapeHtml(
        formatDateTime(typeof rawData.en_route_time === "string" ? rawData.en_route_time : null)
      )}</div></div>
      <div class="row"><div class="label">On scene</div><div class="value">${escapeHtml(
        formatDateTime(incident.on_scene_time)
      )}</div></div>
      <div class="row"><div class="label">Controlled</div><div class="value">${escapeHtml(
        formatDateTime(typeof rawData.controlled_time === "string" ? rawData.controlled_time : null)
      )}</div></div>
      <div class="row"><div class="label">Cleared</div><div class="value">${escapeHtml(
        formatDateTime(incident.cleared_time)
      )}</div></div>
    </div>

    <h2>Resources</h2>
    <div class="box">
      <div class="row"><div class="label">Units responding</div><div class="value">${escapeHtml(units)}</div></div>
      <div class="row"><div class="label">Personnel on scene</div><div class="value">${escapeHtml(personnel)}</div></div>
      <div class="row"><div class="label">Actions taken</div><div class="value">${escapeHtml(actions)}</div></div>
    </div>

    <h2>Casualties And Exposures</h2>
    <div class="box meta">
      <div class="row"><div class="label">Civilian casualties</div><div class="value">${escapeHtml(
        readNumber(casualtyInfo.civilian)
      )}</div></div>
      <div class="row"><div class="label">Firefighter casualties</div><div class="value">${escapeHtml(
        readNumber(casualtyInfo.firefighter)
      )}</div></div>
      <div class="row"><div class="label">Exposures</div><div class="value">${escapeHtml(
        readNumber(rawData.exposures)
      )}</div></div>
    </div>

    <h2>Narrative</h2>
    <div class="box paragraph">${escapeHtml(incident.narrative ?? "No narrative recorded.")}</div>
  </body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
