"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  Check,
  Clock3,
  CloudOff,
  Crosshair,
  FileText,
  Loader2,
  MapPin,
  Truck,
  Users,
} from "lucide-react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ApparatusRecord, DepartmentUserRecord, IncidentRecord } from "@/lib/db";
import { db } from "@/lib/db";
import { hydrateIncidentBootstrap } from "@/lib/incidents/bootstrap";
import {
  ACTION_TAKEN_OPTIONS,
  NERIS_INCIDENT_TYPES,
  PROPERTY_USE_OPTIONS,
} from "@/lib/incidents/options";
import { runSync } from "@/lib/sync/engine";
import { enqueueMutation } from "@/lib/sync/mutations";
import { cn } from "@/lib/utils";
import { useSyncStore } from "@/store/sync-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IncidentFormState {
  incident_number: string;
  incident_type: string;
  location_address: string;
  location_lat: string;
  location_lng: string;
  alarm_time: string;
  dispatch_time: string;
  en_route_time: string;
  on_scene_time: string;
  controlled_time: string;
  cleared_time: string;
  units_responding: string[];
  personnel_on_scene: string[];
  civilian_casualties: string;
  firefighter_casualties: string;
  exposures: string;
  narrative: string;
  actions_taken: string[];
  property_use: string;
}

export interface IncidentFormProps {
  existingLocalId?: string;
  initialData?: Partial<IncidentFormState>;
  draftId?: string;
  onSubmitSuccess?: (localId: string) => void;
  submitLabel?: string;
}

// ---------------------------------------------------------------------------
// Wizard config
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 1, label: "Basics",    icon: FileText },
  { id: 2, label: "Location",  icon: MapPin },
  { id: 3, label: "Responders",icon: Truck },
  { id: 4, label: "Details",   icon: AlertTriangle },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// Required fields per step — used for step-level error indicators
const STEP_REQUIRED: Record<StepId, (keyof IncidentFormState)[]> = {
  1: ["incident_number", "incident_type"],
  2: ["alarm_time"],          // location checked via custom logic
  3: ["units_responding"],
  4: [],
};

const TIMELINE_ROWS = [
  { id: "alarm-time",      label: "Alarm time",      field: "alarm_time"      as const, required: true  },
  { id: "dispatch-time",   label: "Dispatch time",   field: "dispatch_time"   as const, required: false },
  { id: "en-route-time",   label: "En route time",   field: "en_route_time"   as const, required: false },
  { id: "on-scene-time",   label: "On scene time",   field: "on_scene_time"   as const, required: false },
  { id: "controlled-time", label: "Controlled time", field: "controlled_time" as const, required: false },
  { id: "cleared-time",    label: "Cleared time",    field: "cleared_time"    as const, required: false },
];

// ---------------------------------------------------------------------------
// Field validation
// ---------------------------------------------------------------------------

function validateField(field: keyof IncidentFormState, form: IncidentFormState): string | null {
  switch (field) {
    case "incident_number":
      return form.incident_number.trim() ? null : "Incident number is required.";
    case "incident_type":
      return form.incident_type ? null : "Select an incident type.";
    case "alarm_time":
      return form.alarm_time ? null : "Alarm time is required.";
    case "units_responding":
      return form.units_responding.length > 0 ? null : "Select at least one unit.";
    default:
      return null;
  }
}

function locationError(form: IncidentFormState): string | null {
  const hasAddress = form.location_address.trim().length > 0;
  const hasCoords  = form.location_lat.trim().length > 0 && form.location_lng.trim().length > 0;
  return hasAddress || hasCoords ? null : "Enter an address or capture GPS coordinates.";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTOSAVE_INTERVAL_MS = 30_000;
const EMPTY_APPARATUS_LIST: ApparatusRecord[] = [];
const EMPTY_ROSTER_LIST: DepartmentUserRecord[] = [];

function pad(v: number) {
  return v.toString().padStart(2, "0");
}

export function formatDateTimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function generateIncidentNumber(date = new Date()): string {
  return `INC-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function createBlankForm(): IncidentFormState {
  return {
    incident_number: generateIncidentNumber(),
    incident_type: "",
    location_address: "",
    location_lat: "",
    location_lng: "",
    alarm_time: formatDateTimeLocal(new Date()),
    dispatch_time: "",
    en_route_time: "",
    on_scene_time: "",
    controlled_time: "",
    cleared_time: "",
    units_responding: [],
    personnel_on_scene: [],
    civilian_casualties: "",
    firefighter_casualties: "",
    exposures: "",
    narrative: "",
    actions_taken: [],
    property_use: "",
  };
}

export function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function toFloatOrNull(value: string): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toIntOrNull(value: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function readStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.flatMap((item) => (typeof item === "string" ? [item] : []));
}

function apparatusKey(unit: ApparatusRecord): string {
  return unit.local_id ?? unit.server_id ?? unit.unit_id ?? "";
}

export function incidentRecordToForm(record: IncidentRecord): IncidentFormState {
  const raw = (record.raw_data ?? {}) as Record<string, unknown>;
  return {
    incident_number: record.incident_number ?? generateIncidentNumber(),
    incident_type: record.incident_type ?? "",
    location_address: record.location_address ?? "",
    location_lat: record.location_lat != null ? String(record.location_lat) : "",
    location_lng: record.location_lng != null ? String(record.location_lng) : "",
    alarm_time: record.alarm_time ? formatDateTimeLocal(new Date(record.alarm_time)) : "",
    dispatch_time: record.dispatch_time ? formatDateTimeLocal(new Date(record.dispatch_time)) : typeof raw.dispatch_time === "string" ? raw.dispatch_time : "",
    en_route_time: record.en_route_time ? formatDateTimeLocal(new Date(record.en_route_time)) : typeof raw.en_route_time === "string" ? raw.en_route_time : "",
    on_scene_time: record.on_scene_time ? formatDateTimeLocal(new Date(record.on_scene_time)) : "",
    controlled_time: record.controlled_time ? formatDateTimeLocal(new Date(record.controlled_time)) : typeof raw.controlled_time === "string" ? raw.controlled_time : "",
    cleared_time: record.cleared_time ? formatDateTimeLocal(new Date(record.cleared_time)) : "",
    units_responding: record.units_responding ?? readStringArray(raw.units_responding),
    personnel_on_scene: record.personnel_on_scene ?? readStringArray(raw.personnel_on_scene),
    civilian_casualties: record.casualty_civilian != null ? String(record.casualty_civilian) : typeof raw.civilian_casualties === "string" ? raw.civilian_casualties : "",
    firefighter_casualties: record.casualty_ff != null ? String(record.casualty_ff) : typeof raw.firefighter_casualties === "string" ? raw.firefighter_casualties : "",
    exposures: typeof raw.exposures === "string" ? raw.exposures : "",
    narrative: record.narrative ?? "",
    actions_taken: record.actions_taken ?? readStringArray(raw.actions_taken),
    property_use: record.property_use ?? (typeof raw.property_use === "string" ? raw.property_use : ""),
  };
}

// ---------------------------------------------------------------------------
// Inline error component
// ---------------------------------------------------------------------------

function FieldError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-destructive">{message}</p>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IncidentForm({
  existingLocalId,
  initialData,
  draftId,
  onSubmitSuccess,
  submitLabel = "Log incident",
}: IncidentFormProps) {
  const { status: sessionStatus } = useSession();
  const online = useSyncStore((state) => state.online);

  const apparatus = useLiveQuery(() => db.apparatus.orderBy("unit_id").toArray(), []);
  const roster    = useLiveQuery(() => db.department_users.orderBy("name").toArray(), []);

  const apparatusList = apparatus ?? EMPTY_APPARATUS_LIST;
  const rosterList    = roster    ?? EMPTY_ROSTER_LIST;
  const hasCachedResources = apparatusList.length > 0 && rosterList.length > 0;

  const [form, setForm] = useState<IncidentFormState>(() => ({
    ...createBlankForm(),
    ...initialData,
  }));
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof IncidentFormState | "location", string>>>({});
  const [touched,     setTouched]     = useState<Partial<Record<keyof IncidentFormState | "location", true>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [draftLoaded,       setDraftLoaded]       = useState(!draftId);
  const [draftDirty,        setDraftDirty]        = useState(false);
  const [draftSavedAt,      setDraftSavedAt]      = useState<string | null>(null);
  const [savedFlash,        setSavedFlash]        = useState(false);
  const [isBootstrapping,   setIsBootstrapping]   = useState(true);
  const [isSavingDraft,     setIsSavingDraft]     = useState(false);
  const [isSubmitting,      setIsSubmitting]      = useState(false);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [loadError,         setLoadError]         = useState<string | null>(null);
  const [saveError,         setSaveError]         = useState<string | null>(null);
  const [locationMessage,   setLocationMessage]   = useState<string | null>(null);

  const latestFormRef  = useRef(form);
  const draftDirtyRef  = useRef(draftDirty);
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { latestFormRef.current = form; }, [form]);
  useEffect(() => { draftDirtyRef.current = draftDirty; }, [draftDirty]);

  // Bootstrap
  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    let cancelled = false;

    async function bootstrap() {
      setIsBootstrapping(true);

      if (draftId) {
        try {
          const draft = await db.incident_drafts.get(draftId);
          if (!cancelled && draft) {
            setForm((current) => ({
              ...current,
              incident_number: draft.incident_number,
              incident_type: draft.incident_type ?? "",
              location_address: draft.location_address ?? "",
              location_lat: draft.location_lat ?? "",
              location_lng: draft.location_lng ?? "",
              alarm_time: draft.alarm_time ?? "",
              on_scene_time: draft.on_scene_time ?? "",
              cleared_time: draft.cleared_time ?? "",
              narrative: draft.narrative ?? "",
              dispatch_time: typeof draft.raw_data.dispatch_time === "string" ? draft.raw_data.dispatch_time : "",
              en_route_time: typeof draft.raw_data.en_route_time === "string" ? draft.raw_data.en_route_time : "",
              controlled_time: typeof draft.raw_data.controlled_time === "string" ? draft.raw_data.controlled_time : "",
              units_responding: readStringArray(draft.raw_data.units_responding),
              personnel_on_scene: readStringArray(draft.raw_data.personnel_on_scene),
              civilian_casualties: typeof draft.raw_data.civilian_casualties === "string" ? draft.raw_data.civilian_casualties : "",
              firefighter_casualties: typeof draft.raw_data.firefighter_casualties === "string" ? draft.raw_data.firefighter_casualties : "",
              exposures: typeof draft.raw_data.exposures === "string" ? draft.raw_data.exposures : "",
              actions_taken: readStringArray(draft.raw_data.actions_taken),
              property_use: typeof draft.raw_data.property_use === "string" ? draft.raw_data.property_use : "",
            }));
            setDraftSavedAt(draft.updated_at);
          }
        } finally {
          if (!cancelled) setDraftLoaded(true);
        }
      }

      if (navigator.onLine) {
        try {
          await hydrateIncidentBootstrap();
          if (!cancelled) setLoadError(null);
        } catch (error) {
          if (!cancelled) {
            setLoadError(error instanceof Error ? error.message : "Unable to refresh resources.");
          }
        }
      }

      if (!cancelled) setIsBootstrapping(false);
    }

    void bootstrap();
    return () => { cancelled = true; };
  }, [sessionStatus, draftId]);

  const saveDraft = useCallback(async (showFlash: boolean) => {
    if (!draftId) return;
    const snapshot   = latestFormRef.current;
    const updatedAt  = new Date().toISOString();
    setIsSavingDraft(true);
    try {
      await db.incident_drafts.put({
        id: draftId,
        incident_number: snapshot.incident_number,
        incident_type: snapshot.incident_type || null,
        location_address: snapshot.location_address || null,
        location_lat: snapshot.location_lat || null,
        location_lng: snapshot.location_lng || null,
        alarm_time: snapshot.alarm_time || null,
        on_scene_time: snapshot.on_scene_time || null,
        cleared_time: snapshot.cleared_time || null,
        narrative: snapshot.narrative || null,
        raw_data: {
          dispatch_time: snapshot.dispatch_time || null,
          en_route_time: snapshot.en_route_time || null,
          controlled_time: snapshot.controlled_time || null,
          units_responding: snapshot.units_responding,
          personnel_on_scene: snapshot.personnel_on_scene,
          civilian_casualties: snapshot.civilian_casualties,
          firefighter_casualties: snapshot.firefighter_casualties,
          exposures: snapshot.exposures,
          actions_taken: snapshot.actions_taken,
          property_use: snapshot.property_use || null,
        },
        updated_at: updatedAt,
      });
      setDraftDirty(false);
      setDraftSavedAt(updatedAt);
      if (showFlash) {
        setSavedFlash(true);
        if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
        savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 2000);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save draft.");
    } finally {
      setIsSavingDraft(false);
    }
  }, [draftId]);

  useEffect(() => {
    if (!draftLoaded || !draftId) return;
    const interval = window.setInterval(() => {
      if (!draftDirtyRef.current) return;
      void saveDraft(false);
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [draftLoaded, draftId, saveDraft]);

  // Re-validate touched fields whenever form changes
  function updateForm<K extends keyof IncidentFormState>(field: K, value: IncidentFormState[K]) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (touched[field] || submitAttempted) {
        const err = validateField(field, next);
        setFieldErrors((prev) => ({ ...prev, [field]: err ?? undefined }));
      }
      if ((field === "location_address" || field === "location_lat" || field === "location_lng") && (touched.location || submitAttempted)) {
        const err = locationError(next);
        setFieldErrors((prev) => ({ ...prev, location: err ?? undefined }));
      }
      return next;
    });
    setDraftDirty(true);
    setSaveError(null);
  }

  function handleBlur(field: keyof IncidentFormState) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field, form);
    setFieldErrors((prev) => ({ ...prev, [field]: err ?? undefined }));
  }

  function handleLocationBlur() {
    setTouched((prev) => ({ ...prev, location: true }));
    const err = locationError(form);
    setFieldErrors((prev) => ({ ...prev, location: err ?? undefined }));
  }

  function toggleSelection(
    field: "units_responding" | "personnel_on_scene" | "actions_taken",
    value: string
  ) {
    setForm((current) => {
      const existing = current[field];
      const next = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value];
      const updated = { ...current, [field]: next };
      if (touched[field] || submitAttempted) {
        const err = validateField(field, updated);
        setFieldErrors((prev) => ({ ...prev, [field]: err ?? undefined }));
      }
      return updated;
    });
    setDraftDirty(true);
    setSaveError(null);
  }

  async function captureLocation() {
    if (!("geolocation" in navigator)) {
      setSaveError("This device does not support GPS capture.");
      return;
    }
    setIsCapturingLocation(true);
    setSaveError(null);
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        setForm((current) => {
          const next = { ...current, location_lat: lat, location_lng: lng };
          if (touched.location || submitAttempted) {
            const err = locationError(next);
            setFieldErrors((prev) => ({ ...prev, location: err ?? undefined }));
          }
          return next;
        });
        setDraftDirty(true);
        setLocationMessage("GPS coordinates captured.");
        setIsCapturingLocation(false);
      },
      (error) => {
        setSaveError(error.message || "Unable to capture location.");
        setIsCapturingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  }

  // ---------------------------------------------------------------------------
  // Validation state
  // ---------------------------------------------------------------------------

  const allErrors = {
    incident_number: validateField("incident_number", form),
    incident_type:   validateField("incident_type",   form),
    alarm_time:      validateField("alarm_time",       form),
    units_responding: validateField("units_responding", form),
    location:        locationError(form),
  };

  const canSubmit =
    !allErrors.incident_number &&
    !allErrors.incident_type &&
    !allErrors.alarm_time &&
    !allErrors.units_responding &&
    !allErrors.location;

  const missingCount = Object.values(allErrors).filter(Boolean).length;

  function stepHasError(stepId: StepId): boolean {
    const requiredFields = STEP_REQUIRED[stepId];
    const hasFieldError = requiredFields.some(
      (f) => !!allErrors[f as keyof typeof allErrors]
    );
    if (stepId === 2) return hasFieldError || !!allErrors.location;
    return hasFieldError;
  }

  function stepIsComplete(stepId: StepId): boolean {
    return submitAttempted && !stepHasError(stepId);
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);

    // Surface all errors
    setFieldErrors({
      incident_number:  allErrors.incident_number  ?? undefined,
      incident_type:    allErrors.incident_type    ?? undefined,
      alarm_time:       allErrors.alarm_time       ?? undefined,
      units_responding: allErrors.units_responding ?? undefined,
      location:         allErrors.location         ?? undefined,
    });
    setTouched({
      incident_number: true,
      incident_type:   true,
      alarm_time:      true,
      units_responding: true,
      location:        true,
    });

    if (!canSubmit) {
      // Navigate to first step with an error
      const errorStep = ([1, 2, 3] as StepId[]).find((s) => stepHasError(s));
      if (errorStep) setCurrentStep(errorStep);
      return;
    }

    setIsSubmitting(true);
    setSaveError(null);

    try {
      const selectedUnits     = apparatusList.filter((unit)   => form.units_responding.includes(apparatusKey(unit)));
      const selectedPersonnel = rosterList.filter((member) => form.personnel_on_scene.includes(member.id));

      const localId = await enqueueMutation({
        table: "incidents",
        local_id: existingLocalId,
        operation: "upsert",
        data: {
          incident_number:    form.incident_number.trim(),
          incident_type:      form.incident_type,
          location_address:   form.location_address.trim() || null,
          location_lat:       toFloatOrNull(form.location_lat),
          location_lng:       toFloatOrNull(form.location_lng),
          alarm_time:         toIsoOrNull(form.alarm_time),
          dispatch_time:      toIsoOrNull(form.dispatch_time),
          en_route_time:      toIsoOrNull(form.en_route_time),
          on_scene_time:      toIsoOrNull(form.on_scene_time),
          controlled_time:    toIsoOrNull(form.controlled_time),
          cleared_time:       toIsoOrNull(form.cleared_time),
          units_responding:   selectedUnits.map((u) => u.server_id ?? u.local_id ?? u.unit_id),
          personnel_on_scene: selectedPersonnel.map((m) => m.id),
          casualty_civilian:  toIntOrNull(form.civilian_casualties) ?? 0,
          casualty_ff:        toIntOrNull(form.firefighter_casualties) ?? 0,
          actions_taken:      form.actions_taken,
          property_use:       form.property_use || null,
          narrative:          form.narrative.trim() || null,
          raw_data: {
            units_responding_labels:   selectedUnits.map((u) => u.unit_id ?? "Department apparatus"),
            personnel_on_scene_names:  selectedPersonnel.map((m) => m.name),
            exposures:                 toIntOrNull(form.exposures),
            property_use:              form.property_use || null,
          },
        },
      });

      if (draftId) {
        await db.incident_drafts.delete(draftId);
      }

      if (online) void runSync();
      onSubmitSuccess?.(localId);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save the incident.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (isBootstrapping && !hasCachedResources) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading apparatus and roster...
        </div>
      </div>
    );
  }

  if (!isBootstrapping && !hasCachedResources) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <CloudOff className="mt-0.5 h-5 w-5 text-primary" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">This device needs one connected visit first.</p>
            <p>Once apparatus and responders are cached, the form works offline.</p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Step nav
  // ---------------------------------------------------------------------------

  const stepNav = (
    <nav aria-label="Form steps" className="mb-8">
      <ol className="flex items-center">
        {STEPS.map((step, index) => {
          const isActive   = currentStep === step.id;
          const isComplete = !isActive && submitAttempted && !stepHasError(step.id as StepId);
          const hasError   = submitAttempted && stepHasError(step.id as StepId);
          const isLast     = index === STEPS.length - 1;

          return (
            <Fragment key={step.id}>
              <li className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentStep(step.id as StepId)}
                  aria-current={isActive ? "step" : undefined}
                  className="flex flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                      isActive  && "border-primary bg-primary text-primary-foreground",
                      isComplete && "border-green-600 bg-green-600 text-white",
                      hasError   && "border-destructive bg-destructive text-destructive-foreground",
                      !isActive && !isComplete && !hasError && "border-border bg-background text-muted-foreground"
                    )}
                  >
                    {isComplete ? <Check className="h-3.5 w-3.5" /> : step.id}
                  </span>
                  <span
                    className={cn(
                      "hidden text-xs sm:block",
                      isActive   ? "font-medium text-foreground" : "text-muted-foreground",
                      hasError   && "text-destructive"
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              </li>
              {!isLast && (
                <div className="mx-2 h-0.5 flex-1 bg-border" aria-hidden />
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );

  // ---------------------------------------------------------------------------
  // Step content
  // ---------------------------------------------------------------------------

  const step1 = currentStep === 1 && (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="incident-number">
            Incident number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="incident-number"
            value={form.incident_number}
            onChange={(e) => updateForm("incident_number", e.target.value)}
            onBlur={() => handleBlur("incident_number")}
            aria-invalid={!!fieldErrors.incident_number}
            aria-describedby={fieldErrors.incident_number ? "err-incident-number" : undefined}
            className={cn("h-11", fieldErrors.incident_number && "border-destructive focus-visible:ring-destructive")}
          />
          <FieldError message={fieldErrors.incident_number} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="incident-type">
            Incident type <span className="text-destructive">*</span>
          </Label>
          <select
            id="incident-type"
            value={form.incident_type}
            onChange={(e) => updateForm("incident_type", e.target.value)}
            onBlur={() => handleBlur("incident_type")}
            aria-invalid={!!fieldErrors.incident_type}
            className={cn(
              "flex h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              fieldErrors.incident_type && "border-destructive focus-visible:ring-destructive"
            )}
          >
            <option value="">Select incident type</option>
            {NERIS_INCIDENT_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <FieldError message={fieldErrors.incident_type} />
        </div>
      </div>
    </div>
  );

  const step2 = currentStep === 2 && (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground">
          Location <span className="text-destructive">*</span>
        </p>
        <div className="space-y-2">
          <Label htmlFor="location-address">Address</Label>
          <Input
            id="location-address"
            placeholder="123 Main St, district, landmark..."
            value={form.location_address}
            onChange={(e) => updateForm("location_address", e.target.value)}
            onBlur={handleLocationBlur}
            aria-invalid={!!fieldErrors.location}
            className={cn("h-11", fieldErrors.location && "border-destructive focus-visible:ring-destructive")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={captureLocation} disabled={isCapturingLocation}>
            {isCapturingLocation ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Capturing GPS...</>
            ) : (
              <><Crosshair className="h-4 w-4" />Use current GPS</>
            )}
          </Button>
          {locationMessage ? <span className="text-sm text-emerald-700">{locationMessage}</span> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="location-lat">Latitude</Label>
            <Input
              id="location-lat"
              value={form.location_lat}
              onChange={(e) => updateForm("location_lat", e.target.value)}
              onBlur={handleLocationBlur}
              className={cn("h-11", fieldErrors.location && "border-destructive")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location-lng">Longitude</Label>
            <Input
              id="location-lng"
              value={form.location_lng}
              onChange={(e) => updateForm("location_lng", e.target.value)}
              onBlur={handleLocationBlur}
              className={cn("h-11", fieldErrors.location && "border-destructive")}
            />
          </div>
        </div>
        <FieldError message={fieldErrors.location} />
      </div>

      <div className="space-y-4 border-t pt-6">
        <p className="text-sm font-medium text-foreground">Timeline</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {TIMELINE_ROWS.map(({ id, label, field, required }) => (
            <div key={id} className="space-y-2">
              <Label htmlFor={id}>
                {label}
                {required && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                id={id}
                type="datetime-local"
                value={form[field]}
                onChange={(e) => updateForm(field, e.target.value)}
                onBlur={required ? () => handleBlur(field) : undefined}
                aria-invalid={required ? !!fieldErrors[field] : undefined}
                className={cn("h-11", required && fieldErrors[field] && "border-destructive focus-visible:ring-destructive")}
              />
              {required && <FieldError message={fieldErrors[field] as string | null} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const step3 = currentStep === 3 && (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground">
          Units responding <span className="text-destructive">*</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {apparatusList.map((unit) => {
            const key      = apparatusKey(unit);
            const selected = form.units_responding.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSelection("units_responding", key)}
                className={cn(
                  "min-h-[76px] rounded-lg border px-4 py-4 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : fieldErrors.units_responding
                    ? "border-destructive/40 hover:bg-muted"
                    : "hover:bg-muted"
                )}
              >
                <div className="font-medium">{unit.unit_id ?? "Department apparatus"}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {[unit.type, unit.year].filter(Boolean).join(" • ") || "Department asset"}
                </div>
              </button>
            );
          })}
        </div>
        <FieldError message={fieldErrors.units_responding} />
      </div>

      <div className="space-y-4 border-t pt-6">
        <p className="text-sm font-medium text-foreground">Personnel on scene</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {rosterList.map((member) => {
            const selected = form.personnel_on_scene.includes(member.id);
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => toggleSelection("personnel_on_scene", member.id)}
                className={cn(
                  "min-h-[76px] rounded-lg border px-4 py-4 text-left transition-colors",
                  selected ? "border-primary bg-primary/5" : "hover:bg-muted"
                )}
              >
                <div className="font-medium">{member.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {[member.role, member.badge_number].filter(Boolean).join(" • ") || "Department responder"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const step4 = currentStep === 4 && (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground">Casualties</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="civilian-casualties">Civilian casualties</Label>
            <Input
              id="civilian-casualties"
              inputMode="numeric"
              value={form.civilian_casualties}
              onChange={(e) => updateForm("civilian_casualties", e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ff-casualties">Firefighter casualties</Label>
            <Input
              id="ff-casualties"
              inputMode="numeric"
              value={form.firefighter_casualties}
              onChange={(e) => updateForm("firefighter_casualties", e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exposures">Exposures</Label>
            <Input
              id="exposures"
              inputMode="numeric"
              value={form.exposures}
              onChange={(e) => updateForm("exposures", e.target.value)}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">Structures exposed, not involved</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <p className="text-sm font-medium text-foreground">Property use</p>
        <select
          id="property-use"
          value={form.property_use}
          onChange={(e) => updateForm("property_use", e.target.value)}
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select property use</option>
          {PROPERTY_USE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4 border-t pt-6">
        <p className="text-sm font-medium text-foreground">Actions taken</p>
        <div className="flex flex-wrap gap-3">
          {ACTION_TAKEN_OPTIONS.map((opt) => {
            const selected = form.actions_taken.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleSelection("actions_taken", opt.value)}
                className={cn(
                  "min-h-[44px] rounded-full border px-4 py-2 text-sm transition-colors",
                  selected ? "border-primary bg-primary/5 text-foreground" : "hover:bg-muted"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <p className="text-sm font-medium text-foreground">Narrative</p>
        <Textarea
          placeholder="Describe what happened: conditions on arrival, actions taken, outcomes, and any outstanding follow-up."
          value={form.narrative}
          onChange={(e) => updateForm("narrative", e.target.value)}
          rows={5}
        />
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Action bar
  // ---------------------------------------------------------------------------

  const isFirstStep = currentStep === 1;
  const isLastStep  = currentStep === 4;

  const actionBar = (
    <div className="flex items-center justify-between gap-3 border-t pt-6">
      <div className="flex items-center gap-3">
        {draftId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void saveDraft(true)}
            disabled={isSavingDraft}
            className="text-muted-foreground"
          >
            {savedFlash ? (
              <><Check className="h-3.5 w-3.5 text-green-600" /><span className="text-green-600">Saved</span></>
            ) : isSavingDraft ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving...</>
            ) : (
              "Save draft"
            )}
          </Button>
        ) : null}
        {draftSavedAt && !savedFlash ? (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Last saved {new Date(draftSavedAt).toLocaleTimeString()}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        {!isFirstStep && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setCurrentStep((s) => (s - 1) as StepId)}
          >
            Back
          </Button>
        )}
        {!isLastStep && (
          <Button
            type="button"
            onClick={() => setCurrentStep((s) => (s + 1) as StepId)}
          >
            Next
          </Button>
        )}
        {isLastStep && (
          canSubmit ? (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
              ) : (
                submitLabel
              )}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={isSubmitting}
              title={`${missingCount} required field${missingCount !== 1 ? "s" : ""} incomplete`}
            >
              {submitLabel}
              {missingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
                  {missingCount}
                </span>
              )}
            </Button>
          )
        )}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Error banner
  // ---------------------------------------------------------------------------

  const errorBanner = (
    <>
      {loadError ? (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 border border-amber-200">{loadError}</div>
      ) : null}
      {saveError ? (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{saveError}</div>
      ) : null}
    </>
  );

  return (
    <form onSubmit={handleSubmit}>
      {stepNav}
      <div className="min-h-[320px]">
        {step1}
        {step2}
        {step3}
        {step4}
      </div>
      {errorBanner}
      {actionBar}
    </form>
  );
}
