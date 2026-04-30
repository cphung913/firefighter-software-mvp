"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { db, type IncidentRecord } from "@/lib/db";
import { cn } from "@/lib/utils";

interface Props {
  record: IncidentRecord;
  allConflicted: IncidentRecord[];
  onClose: () => void;
  onNext: (next: IncidentRecord | null) => void;
}

// Fields shown in the diff (ordered)
const DIFF_FIELDS: { key: keyof IncidentRecord; label: string }[] = [
  { key: "incident_type", label: "Incident type" },
  { key: "location_address", label: "Address" },
  { key: "alarm_time", label: "Alarm time" },
  { key: "dispatch_time", label: "Dispatch time" },
  { key: "en_route_time", label: "En route time" },
  { key: "on_scene_time", label: "On scene time" },
  { key: "controlled_time", label: "Controlled time" },
  { key: "cleared_time", label: "Cleared time" },
  { key: "narrative", label: "Narrative" },
  { key: "property_use", label: "Property use" },
  { key: "casualty_civilian", label: "Civilian casualties" },
  { key: "casualty_ff", label: "FF casualties" },
];

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ") || "—";
  return String(v);
}

export function ConflictResolver({ record, allConflicted, onClose, onNext }: Props) {
  const serverSnapshot = (record._conflict_server_snapshot ?? {}) as Record<string, unknown>;
  const [saving, setSaving] = useState(false);

  const idx = allConflicted.findIndex((r) => r.local_id === record.local_id);
  const remaining = allConflicted.length;

  async function resolve(side: "mine" | "server") {
    setSaving(true);
    try {
      if (side === "server") {
        // Apply server fields to local record, clear conflict
        const merged: IncidentRecord = {
          ...record,
          ...(serverSnapshot as Partial<IncidentRecord>),
          local_id: record.local_id,
          server_id: record.server_id,
          _sync_status: "synced",
          _dirty_fields: [],
          _conflict_server_snapshot: null,
        };
        await db.incidents.put(merged);
        // Remove any queued mutations for this record — server wins
        await db.pending_mutations
          .where({ table: "incidents", local_id: record.local_id })
          .delete();
      } else {
        // Keep local, mark as pending so it re-pushes
        await db.incidents.update(record.local_id, {
          _sync_status: "pending",
          _conflict_server_snapshot: null,
        });
      }

      const nextConflict =
        allConflicted.find((r, i) => i > idx) ??
        allConflicted.find((r, i) => i < idx && r.local_id !== record.local_id) ??
        null;
      onNext(nextConflict);
    } finally {
      setSaving(false);
    }
  }

  // Find fields that differ
  const diffedFields = DIFF_FIELDS.filter(({ key }) => {
    const mine = formatValue(record[key]);
    const server = formatValue(serverSnapshot[key as string]);
    return mine !== server;
  });

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Resolve sync conflict"
        className="fixed inset-x-4 top-1/2 z-50 max-h-[80vh] -translate-y-1/2 overflow-y-auto rounded-2xl border bg-background shadow-2xl md:inset-x-auto md:left-1/2 md:w-[640px] md:-translate-x-1/2"
      >
        <div className="sticky top-0 flex items-center justify-between border-b bg-background px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Sync conflict</h2>
            <p className="text-xs text-muted-foreground">
              Incident {record.incident_number ?? record.local_id.slice(0, 8)} ·{" "}
              {remaining > 1 ? `${idx + 1} of ${remaining}` : "1 conflict"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="mb-4 text-sm text-muted-foreground">
            This device and the server both have changes. Pick which version to
            keep — your data won&apos;t be lost.
          </p>

          {/* Column headers */}
          <div className="mb-2 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
              Your version (this device)
            </div>
            <div className="rounded-lg bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-800">
              Server version
            </div>
          </div>

          {diffedFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No visible field differences — the conflict may be in metadata
              only.
            </p>
          ) : (
            <ul className="space-y-2">
              {diffedFields.map(({ key, label }) => (
                <li key={key} className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded border border-blue-200 bg-blue-50/50 px-3 py-2">
                    <p className="mb-0.5 text-xs font-medium text-muted-foreground">
                      {label}
                    </p>
                    <p className="break-words">{formatValue(record[key])}</p>
                  </div>
                  <div className="rounded border border-purple-200 bg-purple-50/50 px-3 py-2">
                    <p className="mb-0.5 text-xs font-medium text-muted-foreground">
                      {label}
                    </p>
                    <p className="break-words">
                      {formatValue(serverSnapshot[key as string])}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t bg-background px-5 py-4">
          <button
            onClick={() => resolve("mine")}
            disabled={saving}
            className={cn(
              "flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-blue-600 bg-blue-50 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
            )}
          >
            Keep mine
          </button>
          <button
            onClick={() => resolve("server")}
            disabled={saving}
            className={cn(
              "flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-purple-600 bg-purple-50 text-sm font-semibold text-purple-700 transition hover:bg-purple-100 disabled:opacity-50"
            )}
          >
            Use server version
          </button>
        </div>
      </div>
    </>
  );
}
