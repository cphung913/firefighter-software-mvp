"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, CloudOff, Crosshair, Loader2, MapPin, Users, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ApparatusRecord, DepartmentUserRecord } from "@/lib/db";
import { db } from "@/lib/db";
import { hydrateIncidentBootstrap } from "@/lib/incidents/bootstrap";
import { NERIS_INCIDENT_TYPES } from "@/lib/incidents/options";
import { runSync } from "@/lib/sync/engine";
import { enqueueMutation } from "@/lib/sync/mutations";
import { cn } from "@/lib/utils";
import { useSyncStore } from "@/store/sync-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormState {
  incident_type: string;
  location_address: string;
  location_lat: string;
  location_lng: string;
  alarm_time: string;
  priority: string;
  units_responding: string[];
  personnel_on_scene: string[];
  narrative: string;
}

type StepId = 1 | 2 | 3;

const STEPS = [
  { id: 1 as StepId, label: "Call Info", icon: MapPin },
  { id: 2 as StepId, label: "Apparatus", icon: Truck },
  { id: 3 as StepId, label: "Personnel", icon: Users },
] as const;

const EMPTY_APPARATUS: ApparatusRecord[] = [];
const EMPTY_ROSTER: DepartmentUserRecord[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad(v: number) {
  return v.toString().padStart(2, "0");
}

function formatDateTimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toFloatOrNull(value: string): number | null {
  if (!value) return null;
  const n = parseFloat(value);
  return isFinite(n) ? n : null;
}

function apparatusKey(unit: ApparatusRecord): string {
  return unit.unit_id ?? unit.local_id ?? unit.server_id ?? "";
}

function FieldError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <p className="mt-1 font-body text-[13px] text-[var(--signal)]">{message}</p>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DispatchForm() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const online = useSyncStore((s) => s.online);

  const apparatus = useLiveQuery(() => db.apparatus.orderBy("unit_id").toArray(), []);
  const roster    = useLiveQuery(() => db.department_users.orderBy("name").toArray(), []);
  const apparatusList = apparatus ?? EMPTY_APPARATUS;
  const rosterList    = roster    ?? EMPTY_ROSTER;
  const hasCachedResources = apparatusList.length > 0 || rosterList.length > 0;

  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [form, setForm] = useState<FormState>(() => ({
    incident_type: "",
    location_address: "",
    location_lat: "",
    location_lng: "",
    alarm_time: formatDateTimeLocal(new Date()),
    priority: "medium",
    units_responding: [],
    personnel_on_scene: [],
    narrative: "",
  }));
  const [errors, setErrors]                 = useState<Partial<Record<keyof FormState | "location", string>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [isCapturingGps, setIsCapturingGps]   = useState(false);
  const [loadError, setLoadError]             = useState<string | null>(null);
  const [saveError, setSaveError]             = useState<string | null>(null);
  const [locationMsg, setLocationMsg]         = useState<string | null>(null);

  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    let cancelled = false;

    async function bootstrap() {
      setIsBootstrapping(true);
      if (navigator.onLine) {
        try {
          await hydrateIncidentBootstrap();
          if (!cancelled) setLoadError(null);
        } catch (err) {
          if (!cancelled) setLoadError(err instanceof Error ? err.message : "Unable to load apparatus and roster.");
        }
      }
      if (!cancelled) setIsBootstrapping(false);
    }

    void bootstrap();
    return () => { cancelled = true; };
  }, [sessionStatus]);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function validateLocation(f: FormState): string | null {
    const hasAddress = f.location_address.trim().length > 0;
    const hasCoords  = f.location_lat.trim().length > 0 && f.location_lng.trim().length > 0;
    return hasAddress || hasCoords ? null : "Enter an address or capture GPS coordinates.";
  }

  const allErrors = {
    incident_type:   form.incident_type ? null : "Select an incident type.",
    location:        validateLocation(form),
    units_responding: form.units_responding.length > 0 ? null : null, // optional but encouraged
  };

  const canSubmit = !allErrors.incident_type && !allErrors.location;

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (submitAttempted) {
      const next = { ...formRef.current, [field]: value };
      if (field === "incident_type") {
        setErrors((e) => ({ ...e, incident_type: next.incident_type ? undefined : "Select an incident type." }));
      }
      if (field === "location_address" || field === "location_lat" || field === "location_lng") {
        setErrors((e) => ({ ...e, location: validateLocation(next) ?? undefined }));
      }
    }
    setSaveError(null);
  }

  function toggle(field: "units_responding" | "personnel_on_scene", value: string) {
    setForm((prev) => {
      const existing = prev[field];
      return {
        ...prev,
        [field]: existing.includes(value) ? existing.filter((v) => v !== value) : [...existing, value],
      };
    });
  }

  async function captureGps() {
    if (!("geolocation" in navigator)) {
      setSaveError("GPS not available on this device.");
      return;
    }
    setIsCapturingGps(true);
    setSaveError(null);
    setLocationMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setForm((prev) => ({ ...prev, location_lat: lat, location_lng: lng }));
        setLocationMsg("GPS captured.");
        setIsCapturingGps(false);
      },
      (err) => {
        setSaveError(err.message || "Unable to capture GPS.");
        setIsCapturingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitAttempted(true);
    setErrors({
      incident_type: allErrors.incident_type ?? undefined,
      location:      allErrors.location ?? undefined,
    });

    if (!canSubmit) {
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);
    setSaveError(null);

    try {
      const selectedUnits     = apparatusList.filter((u) => form.units_responding.includes(apparatusKey(u)));
      const selectedPersonnel = rosterList.filter((m) => form.personnel_on_scene.includes(m.id));

      const dispatchNow = new Date().toISOString();

      await enqueueMutation({
        table: "incidents",
        operation: "upsert",
        data: {
          incident_type:      form.incident_type,
          location_address:   form.location_address.trim() || null,
          location_lat:       toFloatOrNull(form.location_lat),
          location_lng:       toFloatOrNull(form.location_lng),
          alarm_time:         toIsoOrNull(form.alarm_time),
          dispatch_time:      dispatchNow,
          units_responding:   selectedUnits.map((u) => u.unit_id ?? u.server_id ?? u.local_id),
          personnel_on_scene: selectedPersonnel.map((m) => m.id),
          narrative:          form.narrative.trim() || null,
          raw_data: {
            units_responding_labels:  selectedUnits.map((u) => u.unit_id ?? "Apparatus"),
            personnel_on_scene_names: selectedPersonnel.map((m) => m.name),
            priority: form.priority,
          },
        },
      });

      // Update assigned apparatus to "responding" — spread full record to avoid data loss
      const statusNow = new Date().toISOString();
      for (const unit of selectedUnits) {
        if (!unit.local_id) continue;
        const dirtyFields = Array.from(new Set([...(unit._dirty_fields ?? []), "service_status"]));
        await db.apparatus.put({
          ...unit,
          service_status: "responding",
          updated_at: statusNow,
          _sync_status: "pending",
          _dirty_fields: dirtyFields,
        });
        await db.pending_mutations.add({
          table: "apparatus",
          local_id: unit.local_id,
          operation: "upsert",
          data: { service_status: "responding" },
          updated_at: statusNow,
          client_timestamp: statusNow,
        });
      }

      if (online) void runSync();
      router.push("/dispatch");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to create dispatch.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isBootstrapping && !hasCachedResources) {
    return (
      <div className="flex min-h-[320px] items-center justify-center bg-[var(--bone)] border border-[#d6cfbf]">
        <div className="flex items-center gap-3 font-body text-[#4a4842]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading apparatus and roster...
        </div>
      </div>
    );
  }

  if (!isBootstrapping && !hasCachedResources) {
    return (
      <div className="bg-[var(--bone)] border border-[#d6cfbf] p-6 font-body text-[14px] text-[#4a4842]">
        <div className="flex items-start gap-3">
          <CloudOff className="mt-0.5 h-5 w-5 text-[var(--signal)]" />
          <div className="space-y-1">
            <p className="font-medium text-[var(--ink)]">Need one connected visit first.</p>
            <p>Apparatus and roster will be cached for offline use after you connect once.</p>
          </div>
        </div>
      </div>
    );
  }

  // Step nav
  const stepNav = (
    <nav aria-label="Form steps" className="mb-8">
      <ol className="flex items-center">
        {STEPS.map((step, index) => {
          const isActive   = currentStep === step.id;
          const isComplete = !isActive && step.id < currentStep;
          const isLast     = index === STEPS.length - 1;

          return (
            <Fragment key={step.id}>
              <li className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentStep(step.id)}
                  aria-current={isActive ? "step" : undefined}
                  className="flex flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--signal)]"
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center font-mono text-[12px] transition-colors",
                      isActive   && "bg-[var(--signal)] text-[var(--bone)]",
                      isComplete && "bg-green-600 text-white",
                      !isActive && !isComplete && "border border-[#d6cfbf] text-[#4a4842]"
                    )}
                  >
                    {isComplete ? <Check className="h-3.5 w-3.5" /> : step.id}
                  </span>
                  <span
                    className={cn(
                      "hidden font-mono text-[9px] uppercase tracking-[0.14em] sm:block",
                      isActive ? "text-[var(--ink)]" : "text-[#4a4842]"
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              </li>
              {!isLast && <div className="mx-2 h-px flex-1 bg-[#d6cfbf]" aria-hidden />}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );

  // Step 1: Call Info
  const step1 = currentStep === 1 && (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="incident-type">
          Incident type <span className="text-[var(--signal)]">*</span>
        </Label>
        <select
          id="incident-type"
          value={form.incident_type}
          onChange={(e) => update("incident_type", e.target.value)}
          className="h-11 w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2 font-body text-[15px] text-[var(--ink)] focus:outline-none focus:border-b-[var(--signal)]"
        >
          <option value="">Select incident type</option>
          {NERIS_INCIDENT_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <FieldError message={errors.incident_type} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dispatch-priority">Priority</Label>
        <select
          id="dispatch-priority"
          value={form.priority}
          onChange={(e) => update("priority", e.target.value)}
          className="h-11 w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2 font-body text-[15px] text-[var(--ink)] focus:outline-none focus:border-b-[var(--signal)]"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location-address">
          Address <span className="text-[var(--signal)]">*</span>
        </Label>
        <Input
          id="location-address"
          placeholder="123 Main St, district, landmark..."
          value={form.location_address}
          onChange={(e) => update("location_address", e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={captureGps}
          disabled={isCapturingGps}
          className="border-[#1a1d22] text-[var(--ink)] hover:bg-[#e5dfd0]"
        >
          {isCapturingGps ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Capturing GPS...</>
          ) : (
            <><Crosshair className="h-4 w-4" />Use current GPS</>
          )}
        </Button>
        {locationMsg && <span className="font-body text-[13px] text-green-700">{locationMsg}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lat">Latitude</Label>
          <Input
            id="lat"
            value={form.location_lat}
            onChange={(e) => update("location_lat", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lng">Longitude</Label>
          <Input
            id="lng"
            value={form.location_lng}
            onChange={(e) => update("location_lng", e.target.value)}
          />
        </div>
      </div>
      <FieldError message={errors.location} />

      <div className="space-y-2">
        <Label htmlFor="alarm-time">Alarm time</Label>
        <Input
          id="alarm-time"
          type="datetime-local"
          value={form.alarm_time}
          onChange={(e) => update("alarm_time", e.target.value)}
        />
      </div>
    </div>
  );

  // Step 2: Apparatus
  const STATUS_COLOR: Record<string, string> = {
    available:     "text-green-700",
    responding:    "text-amber-600",
    on_scene:      "text-teal-700",
    transporting:  "text-purple-700",
    out_of_service: "text-[var(--signal)]",
  };
  const STATUS_DISPLAY: Record<string, string> = {
    available:      "Available",
    responding:     "Responding",
    on_scene:       "On Scene",
    transporting:   "Transporting",
    out_of_service: "Out of Service",
  };

  const step2 = currentStep === 2 && (
    <div className="space-y-4">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#4a4842]">
        Select units to dispatch
      </p>
      {apparatusList.length === 0 ? (
        <p className="font-body text-[14px] text-[var(--bone-dim)]">No apparatus cached yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {apparatusList.map((unit) => {
            const key      = apparatusKey(unit);
            const selected = form.units_responding.includes(key);
            const statusVal = unit.service_status ?? "available";
            const isUnavailable =
              statusVal === "out_of_service" ||
              statusVal === "responding" ||
              statusVal === "on_scene" ||
              statusVal === "transporting";

            return (
              <button
                key={key}
                type="button"
                disabled={isUnavailable}
                onClick={() => toggle("units_responding", key)}
                className={cn(
                  "min-h-[72px] border px-4 py-3.5 text-left transition-colors",
                  isUnavailable
                    ? "cursor-not-allowed border-[#d6cfbf] opacity-40"
                    : selected
                    ? "border-[var(--signal)] bg-[rgba(200,54,44,0.05)]"
                    : "border-[#d6cfbf] hover:bg-[#ede8de]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-[13px] uppercase tracking-[0.08em] text-[var(--ink)]">
                    {unit.unit_id ?? "Apparatus"}
                  </div>
                  <span className={cn("font-mono text-[9px] uppercase tracking-[0.1em]", STATUS_COLOR[statusVal] ?? "text-[#4a4842]")}>
                    {STATUS_DISPLAY[statusVal] ?? statusVal}
                  </span>
                </div>
                <div className="mt-1 font-body text-[13px] text-[#4a4842]">
                  {[unit.type, unit.year].filter(Boolean).join(" · ") || "Department asset"}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // Step 3: Personnel + Notes
  const step3 = currentStep === 3 && (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#4a4842]">
          Personnel responding
        </p>
        {rosterList.length === 0 ? (
          <p className="font-body text-[14px] text-[var(--bone-dim)]">No roster cached yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rosterList.map((member) => {
              const selected = form.personnel_on_scene.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggle("personnel_on_scene", member.id)}
                  className={cn(
                    "min-h-[72px] border border-[#d6cfbf] px-4 py-3.5 text-left transition-colors",
                    selected ? "border-[var(--signal)] bg-[rgba(200,54,44,0.05)]" : "hover:bg-[#ede8de]"
                  )}
                >
                  <div className="font-body font-medium text-[var(--ink)]">{member.name}</div>
                  <div className="mt-1 font-body text-[13px] text-[#4a4842]">
                    {[member.role, member.badge_number].filter(Boolean).join(" · ") || "Responder"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-[#d6cfbf] pt-6">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#4a4842]">
          Dispatch notes
        </p>
        <Textarea
          placeholder="Initial notes, hazards, additional context..."
          value={form.narrative}
          onChange={(e) => update("narrative", e.target.value)}
          rows={4}
        />
      </div>
    </div>
  );

  // Action bar
  const isFirst = currentStep === 1;
  const isLast  = currentStep === 3;

  const actionBar = (
    <div className="flex items-center justify-end gap-3 border-t border-[#d6cfbf] pt-6">
      {!isFirst && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setCurrentStep((s) => (s - 1) as StepId)}
          className="border-[#1a1d22] text-[var(--ink)] hover:bg-[#e5dfd0]"
        >
          Back
        </Button>
      )}
      {!isLast && (
        <Button type="button" onClick={() => setCurrentStep((s) => (s + 1) as StepId)}>
          Next
        </Button>
      )}
      {isLast && (
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Dispatching...</>
          ) : (
            "Dispatch"
          )}
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[clamp(28px,4vw,40px)] uppercase tracking-[-0.005em] font-medium text-[var(--bone)]">
          New Dispatch
        </h1>
        <p className="font-body text-[var(--bone-dim)]">Create a dispatch event and assign apparatus and personnel.</p>
      </div>

      {loadError && (
        <div className="border border-amber-300 bg-amber-50 px-4 py-3 font-body text-[14px] text-amber-800">{loadError}</div>
      )}

      <Card className="bg-[var(--bone)] border-[#d6cfbf]">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            {stepNav}
            <div className="min-h-[320px]">
              {step1}
              {step2}
              {step3}
            </div>
            {saveError && (
              <div className="mt-4 border border-[var(--signal)] bg-[rgba(200,54,44,0.05)] px-4 py-3 font-body text-[14px] text-[var(--signal)]">
                {saveError}
              </div>
            )}
            {actionBar}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
