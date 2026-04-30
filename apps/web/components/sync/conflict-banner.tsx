"use client";

import { useState } from "react";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type IncidentRecord } from "@/lib/db";
import { ConflictResolver } from "./conflict-resolver";

export function ConflictBanner() {
  const conflicted = useLiveQuery(
    () => db.incidents.where("_sync_status").equals("conflict").toArray(),
    []
  );
  const [resolving, setResolving] = useState<IncidentRecord | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (!conflicted || conflicted.length === 0 || dismissed) return null;

  return (
    <>
      <div
        role="alert"
        className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <span className="flex-1">
          {conflicted.length === 1
            ? "1 incident has a sync conflict."
            : `${conflicted.length} incidents have sync conflicts.`}{" "}
          Your changes are safe — review and resolve.
        </span>
        <button
          onClick={() => setResolving(conflicted[0])}
          className="flex items-center gap-1 font-medium underline underline-offset-2 hover:text-amber-700"
          aria-label="Review conflicts"
        >
          Review
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-amber-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {resolving && (
        <ConflictResolver
          record={resolving}
          allConflicted={conflicted}
          onClose={() => setResolving(null)}
          onNext={(next) => setResolving(next)}
        />
      )}
    </>
  );
}
