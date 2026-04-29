"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

interface PendingDrawerProps {
  open: boolean;
  onClose: () => void;
}

const TABLE_LABELS: Record<string, string> = {
  incidents: "Incidents",
  apparatus: "Apparatus",
  voice_logs: "Voice logs",
};

export function PendingDrawer({ open, onClose }: PendingDrawerProps) {
  const mutations = useLiveQuery(() => db.pending_mutations.toArray(), []);

  // Group by table
  const grouped: Record<string, { upsert: number; delete: number }> = {};
  for (const m of mutations ?? []) {
    if (!grouped[m.table]) grouped[m.table] = { upsert: 0, delete: 0 };
    if (m.operation === "delete") grouped[m.table].delete++;
    else grouped[m.table].upsert++;
  }

  const tableNames = Object.keys(grouped);

  // Trap focus and handle Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        aria-hidden
        onClick={onClose}
      />
      {/* Drawer — slides up from bottom on mobile, right panel on md+ */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pending changes"
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t bg-background p-5 shadow-xl md:bottom-auto md:left-auto md:right-4 md:top-20 md:w-80 md:rounded-2xl md:border"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Pending changes</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {tableNames.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pending changes — all caught up.
          </p>
        ) : (
          <ul className="space-y-3">
            {tableNames.map((table) => {
              const { upsert, delete: del } = grouped[table];
              const label = TABLE_LABELS[table] ?? table;
              return (
                <li key={table} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <span className="text-xs font-bold">
                      {upsert + del}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        upsert > 0 && `${upsert} save${upsert !== 1 ? "s" : ""}`,
                        del > 0 && `${del} delete${del !== 1 ? "s" : ""}`,
                      ]
                        .filter(Boolean)
                        .join(", ")}{" "}
                      waiting to sync
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-5 text-xs text-muted-foreground">
          These changes are saved on this device and will sync automatically
          when you reconnect.
        </p>
      </div>
    </>
  );
}
