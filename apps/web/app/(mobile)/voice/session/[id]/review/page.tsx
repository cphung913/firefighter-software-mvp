"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Check, AlertCircle, Loader2, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api/client"; // used for incidents list + PATCH/POST
import {
  extractSession,
  approveSession,
  type ExtractionOut,
  type ExtractionResult,
  type ExtractedNERISFields,
} from "@/lib/voice/api";
import type { IncidentOut } from "@vfd/shared-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}

// ---------------------------------------------------------------------------
// Inline-editable field row
// ---------------------------------------------------------------------------

function FieldRow({ label, value, onChange, placeholder = "—", multiline = false }: FieldRowProps) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const display = value.trim() || placeholder;
  const isEmpty = !value.trim();

  return (
    <div className="flex flex-col gap-1 py-3 border-b last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {editing ? (
        multiline ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            rows={3}
            className="text-sm leading-relaxed bg-muted/50 rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-primary"
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            className="text-sm bg-muted/50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
          />
        )
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={cn(
            "text-left text-sm leading-relaxed min-h-[44px] rounded-lg px-3 py-2 transition-colors hover:bg-muted",
            isEmpty ? "text-muted-foreground italic" : "text-foreground"
          )}
        >
          {display}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incident picker sheet
// ---------------------------------------------------------------------------

interface IncidentPickerProps {
  incidents: IncidentOut[];
  onPick: (id: string) => void;
  onCreateNew: () => void;
  onClose: () => void;
}

function IncidentPicker({ incidents, onPick, onCreateNew, onClose }: IncidentPickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">Attach to incident</span>
        <button onClick={onClose} className="text-sm text-muted-foreground min-h-[44px] px-2">
          Cancel
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        <button
          onClick={onCreateNew}
          className="flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 px-4 py-3 min-h-[56px] text-primary font-medium hover:bg-primary/5 transition-colors"
        >
          <Plus size={18} />
          Create new incident
        </button>
        {incidents.map((inc) => (
          <button
            key={inc.id}
            onClick={() => onPick(inc.id)}
            className="flex flex-col items-start rounded-xl border px-4 py-3 min-h-[56px] text-left hover:bg-muted transition-colors"
          >
            <span className="font-medium text-sm">
              {inc.incident_number ?? "Draft"} — {inc.incident_type ?? "Unknown type"}
            </span>
            <span className="text-xs text-muted-foreground mt-0.5">
              {inc.location_address ?? "No address"} · {inc.alarm_time ? new Date(inc.alarm_time).toLocaleDateString() : "—"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function ExtractionBadge({ status }: { status: string }) {
  if (status === "extracting") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
        <Loader2 size={12} className="animate-spin" /> Analysing…
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-full px-3 py-1">
        <AlertCircle size={12} /> Extraction failed
      </span>
    );
  }
  if (status === "done" || status === "approved") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
        <Check size={12} /> AI draft ready
      </span>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asStr(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

/** Unwrap {value, confidence} ExtractionField objects into flat editable values. */
function unwrap(f: ExtractionResult): ExtractedNERISFields {
  const val = (field: { value: unknown | null }) =>
    field.value == null ? null : field.value;
  return {
    incident_type: val(f.incident_type) as string | null,
    location_address: val(f.location_address) as string | null,
    alarm_time: val(f.alarm_time) as string | null,
    dispatch_time: val(f.dispatch_time) as string | null,
    en_route_time: val(f.en_route_time) as string | null,
    on_scene_time: val(f.on_scene_time) as string | null,
    controlled_time: val(f.controlled_time) as string | null,
    cleared_time: val(f.cleared_time) as string | null,
    units_responding: val(f.units_responding) as string[] | null,
    personnel_on_scene: val(f.personnel_on_scene) as string[] | null,
    casualty_civilian: val(f.casualty_civilian) as number | null,
    casualty_ff: val(f.casualty_ff) as number | null,
    actions_taken: val(f.actions_taken) as string[] | null,
    property_use: val(f.property_use) as string | null,
    narrative: val(f.narrative) as string | null,
  };
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function VoiceReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;

  const [extractionStatus, setExtractionStatus] = useState<string>("pending");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  // Editable local state for each NERIS field
  const [fields, setFields] = useState<ExtractedNERISFields>({
    incident_type: null,
    location_address: null,
    alarm_time: null,
    dispatch_time: null,
    en_route_time: null,
    on_scene_time: null,
    controlled_time: null,
    cleared_time: null,
    units_responding: null,
    personnel_on_scene: null,
    casualty_civilian: null,
    casualty_ff: null,
    actions_taken: null,
    property_use: null,
    narrative: null,
  });

  const [incidents, setIncidents] = useState<IncidentOut[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [targetIncidentId, setTargetIncidentId] = useState<string | null>(null);
  const [targetIncidentLabel, setTargetIncidentLabel] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyExtraction = useCallback((result: ExtractionOut) => {
    // review_status on the log: "extracting" | "pending" | "approved" | "failed"
    // map to our local extractionStatus: "extracting" | "done" | "failed"
    const status =
      result.review_status === "extracting" ? "extracting"
      : result.review_status === "failed" ? "failed"
      : "done";
    setExtractionStatus(status);
    if (status === "done") {
      setFields(unwrap(result.fields));
    }
  }, []);

  // Kick off extraction immediately on mount
  useEffect(() => {
    extractSession(sessionId)
      .then(applyExtraction)
      .catch(() => setLoadError("Could not start extraction. Check connection and try again."));
  }, [sessionId, applyExtraction]);

  // Poll while extracting — re-POST is idempotent (router short-circuits on "extracting" status)
  useEffect(() => {
    if (extractionStatus !== "extracting") return;

    pollRef.current = setTimeout(async () => {
      try {
        const result = await extractSession(sessionId);
        applyExtraction(result);
      } catch {
        setExtractionStatus("failed");
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [extractionStatus, sessionId, applyExtraction]);

  // Load recent incidents for the picker
  useEffect(() => {
    apiFetch<IncidentOut[]>("/api/v1/incidents?limit=20")
      .then(setIncidents)
      .catch(() => {});
  }, []);

  const setField = (key: keyof ExtractedNERISFields) => (value: string) => {
    setFields((prev) => ({ ...prev, [key]: value || null }));
  };

  const handlePickIncident = (id: string) => {
    const inc = incidents.find((i) => i.id === id);
    setTargetIncidentId(id);
    setTargetIncidentLabel(
      inc ? `${inc.incident_number ?? "Draft"} — ${inc.incident_type ?? "Unknown"}` : id
    );
    setShowPicker(false);
  };

  const handleCreateNew = () => {
    setTargetIncidentId("new");
    setTargetIncidentLabel("New incident");
    setShowPicker(false);
  };

  const handleApply = async () => {
    if (!targetIncidentId) {
      setShowPicker(true);
      return;
    }
    setApplying(true);
    try {
      const payload = {
        incident_type: fields.incident_type ?? undefined,
        location_address: fields.location_address ?? undefined,
        alarm_time: fields.alarm_time ?? undefined,
        dispatch_time: fields.dispatch_time ?? undefined,
        en_route_time: fields.en_route_time ?? undefined,
        on_scene_time: fields.on_scene_time ?? undefined,
        controlled_time: fields.controlled_time ?? undefined,
        cleared_time: fields.cleared_time ?? undefined,
        units_responding: fields.units_responding ?? undefined,
        personnel_on_scene: fields.personnel_on_scene ?? undefined,
        casualty_civilian: fields.casualty_civilian ?? undefined,
        casualty_ff: fields.casualty_ff ?? undefined,
        actions_taken: fields.actions_taken ?? undefined,
        property_use: fields.property_use ?? undefined,
        narrative: fields.narrative ?? undefined,
      };

      if (targetIncidentId === "new") {
        await apiFetch("/api/v1/incidents", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await apiFetch(`/api/v1/incidents/${targetIncidentId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }

      await approveSession(sessionId);
      setApplied(true);
    } catch {
      // leave applying=false so user can retry
    } finally {
      setApplying(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render: applied success state
  // ---------------------------------------------------------------------------

  if (applied) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <Check size={32} className="text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-lg">Incident updated</p>
          <p className="text-sm text-muted-foreground mt-1">
            AI draft applied to {targetIncidentLabel ?? "incident"}.
          </p>
        </div>
        <button
          onClick={() => router.push("/incidents")}
          className="rounded-xl bg-primary text-primary-foreground px-6 py-3 font-medium min-h-[44px] transition-colors hover:bg-primary/90"
        >
          View incidents
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: error state
  // ---------------------------------------------------------------------------

  if (loadError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-6">
        <AlertCircle size={32} className="text-destructive" />
        <p className="text-destructive font-medium">{loadError}</p>
        <button onClick={() => router.back()} className="text-sm text-primary underline min-h-[44px]">
          Go back
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: main review card
  // ---------------------------------------------------------------------------

  const isExtracting = extractionStatus === "extracting" || extractionStatus === "pending";

  return (
    <div className="flex flex-col gap-4 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground min-h-[44px] -ml-1"
        >
          <ChevronLeft size={18} /> Back
        </button>
        <ExtractionBadge status={extractionStatus} />
      </div>

      <h1 className="text-xl font-bold">Review AI draft</h1>
      <p className="text-sm text-muted-foreground -mt-2">
        Check every field — tap any value to edit before applying.
      </p>

      {/* Extracting skeleton */}
      {isExtracting && (
        <div className="rounded-2xl border bg-card p-4 flex flex-col gap-3 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {/* Fields card */}
      {!isExtracting && (
        <div className="rounded-2xl border bg-card px-4 py-1">
          <FieldRow
            label="Incident type"
            value={asStr(fields.incident_type)}
            onChange={setField("incident_type")}
            placeholder="Not detected"
          />
          <FieldRow
            label="Address"
            value={asStr(fields.location_address)}
            onChange={setField("location_address")}
            placeholder="Not detected"
          />
          <FieldRow
            label="Alarm time"
            value={asStr(fields.alarm_time)}
            onChange={setField("alarm_time")}
            placeholder="Not detected"
          />
          <FieldRow
            label="On scene"
            value={asStr(fields.on_scene_time)}
            onChange={setField("on_scene_time")}
            placeholder="Not detected"
          />
          <FieldRow
            label="Controlled"
            value={asStr(fields.controlled_time)}
            onChange={setField("controlled_time")}
            placeholder="Not detected"
          />
          <FieldRow
            label="Cleared"
            value={asStr(fields.cleared_time)}
            onChange={setField("cleared_time")}
            placeholder="Not detected"
          />
          <FieldRow
            label="Units responding"
            value={asStr(fields.units_responding)}
            onChange={setField("units_responding")}
            placeholder="Not detected"
          />
          <FieldRow
            label="Personnel on scene"
            value={asStr(fields.personnel_on_scene)}
            onChange={setField("personnel_on_scene")}
            placeholder="Not detected"
          />
          <FieldRow
            label="Civilian casualties"
            value={asStr(fields.casualty_civilian)}
            onChange={setField("casualty_civilian")}
            placeholder="None"
          />
          <FieldRow
            label="FF casualties"
            value={asStr(fields.casualty_ff)}
            onChange={setField("casualty_ff")}
            placeholder="None"
          />
          <FieldRow
            label="Actions taken"
            value={asStr(fields.actions_taken)}
            onChange={setField("actions_taken")}
            placeholder="Not detected"
          />
          <FieldRow
            label="Property use"
            value={asStr(fields.property_use)}
            onChange={setField("property_use")}
            placeholder="Not detected"
          />
          <FieldRow
            label="Narrative"
            value={asStr(fields.narrative)}
            onChange={setField("narrative")}
            placeholder="Not detected"
            multiline
          />
        </div>
      )}

      {/* Target incident selector */}
      {!isExtracting && (
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-3 rounded-xl border bg-card px-4 min-h-[56px] transition-colors hover:bg-muted"
        >
          <FileText size={18} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium flex-1 text-left">
            {targetIncidentLabel ?? "Select or create incident…"}
          </span>
          {targetIncidentId && (
            <Check size={16} className="text-green-500 shrink-0" />
          )}
        </button>
      )}

      {/* Apply CTA */}
      {!isExtracting && (
        <button
          onClick={handleApply}
          disabled={applying}
          className={cn(
            "flex items-center justify-center gap-2 rounded-2xl py-4 font-semibold text-base min-h-[56px] transition-colors",
            applying
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {applying ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Applying…
            </>
          ) : (
            <>
              <Check size={18} /> Apply to incident
            </>
          )}
        </button>
      )}

      {extractionStatus === "failed" && (
        <p className="text-sm text-destructive text-center">
          AI extraction failed — you can still fill in fields manually above.
        </p>
      )}

      {/* Incident picker sheet */}
      {showPicker && (
        <IncidentPicker
          incidents={incidents}
          onPick={handlePickIncident}
          onCreateNew={handleCreateNew}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
