"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
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
  /** When editing an existing synced record. Omit to create new. */
  existingLocalId?: string;
  initialData?: Partial<IncidentFormState>;
  /** Autosave draft key — omit to skip draft persistence */
  draftId?: string;
  onSubmitSuccess?: (localId: string) => void;
  submitLabel?: string;
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
  const roster = useLiveQuery(() => db.department_users.orderBy("name").toArray(), []);

  const apparatusList = apparatus ?? EMPTY_APPARATUS_LIST;
  const rosterList = roster ?? EMPTY_ROSTER_LIST;
  const hasCachedResources = apparatusList.length > 0 && rosterList.length > 0;

  const [form, setForm] = useState<IncidentFormState>(() => ({
    ...createBlankForm(),
    ...initialData,
  }));
  const [draftLoaded, setDraftLoaded] = useState(!draftId);
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const latestFormRef = useRef(form);
  const draftDirtyRef = useRef(draftDirty);

  useEffect(() => { latestFormRef.current = form; }, [form]);
  useEffect(() => { draftDirtyRef.current = draftDirty; }, [draftDirty]);

  // Bootstrap: load draft + hydrate roster/apparatus
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

  useEffect(() => {
    if (!draftLoaded || !draftId) return;
    const interval = window.setInterval(() => {
      if (!draftDirtyRef.current) return;
      void saveDraft(false);
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [draftLoaded, draftId, saveDraft]);

  function updateForm<K extends keyof IncidentFormState>(field: K, value: IncidentFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setDraftDirty(true);
    setSaveError(null);
  }

  function toggleSelection(
    field: "units_responding" | "personnel_on_scene" | "actions_taken",
    value: string
  ) {
    setForm((current) => {
      const existing = current[field];
      const next = existing.includes(value) ? existing.filter((item) => item !== value) : [...existing, value];
      return { ...current, [field]: next };
    });
    setDraftDirty(true);
    setSaveError(null);
  }

  const saveDraft = useCallback(async (showMessage: boolean) => {
    if (!draftId) return;
    const snapshot = latestFormRef.current;
    const updatedAt = new Date().toISOString();
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
      if (showMessage) setSaveMessage("Draft saved on this device.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save draft.");
    } finally {
      setIsSavingDraft(false);
    }
  }, [draftId]);

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
        setForm((current) => ({
          ...current,
          location_lat: position.coords.latitude.toFixed(6),
          location_lng: position.coords.longitude.toFixed(6),
        }));
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.incident_number.trim()) { setSaveError("Incident number is required."); return; }
    if (!form.incident_type) { setSaveError("Select an incident type."); return; }
    if (!form.location_address.trim() && (!form.location_lat || !form.location_lng)) {
      setSaveError("Enter an address or capture GPS coordinates."); return;
    }
    if (!form.alarm_time) { setSaveError("Alarm time is required."); return; }
    if (form.units_responding.length === 0) { setSaveError("Select at least one responding unit."); return; }

    setIsSubmitting(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const selectedUnits = apparatusList.filter((unit) => form.units_responding.includes(apparatusKey(unit)));
      const selectedPersonnel = rosterList.filter((member) => form.personnel_on_scene.includes(member.id));

      const localId = await enqueueMutation({
        table: "incidents",
        local_id: existingLocalId,
        operation: "upsert",
        data: {
          incident_number: form.incident_number.trim(),
          incident_type: form.incident_type,
          location_address: form.location_address.trim() || null,
          location_lat: toFloatOrNull(form.location_lat),
          location_lng: toFloatOrNull(form.location_lng),
          alarm_time: toIsoOrNull(form.alarm_time),
          dispatch_time: toIsoOrNull(form.dispatch_time),
          en_route_time: toIsoOrNull(form.en_route_time),
          on_scene_time: toIsoOrNull(form.on_scene_time),
          controlled_time: toIsoOrNull(form.controlled_time),
          cleared_time: toIsoOrNull(form.cleared_time),
          units_responding: selectedUnits.map((u) => u.server_id ?? u.local_id ?? u.unit_id),
          personnel_on_scene: selectedPersonnel.map((m) => m.id),
          casualty_civilian: toIntOrNull(form.civilian_casualties) ?? 0,
          casualty_ff: toIntOrNull(form.firefighter_casualties) ?? 0,
          actions_taken: form.actions_taken,
          property_use: form.property_use || null,
          narrative: form.narrative.trim() || null,
          raw_data: {
            units_responding_labels: selectedUnits.map((u) => u.unit_id ?? "Department apparatus"),
            personnel_on_scene_names: selectedPersonnel.map((m) => m.name),
            exposures: toIntOrNull(form.exposures),
            property_use: form.property_use || null,
          },
        },
      });

      if (draftId) {
        await db.incident_drafts.delete(draftId);
      }

      setSaveMessage(
        online
          ? "Incident saved and queued for sync."
          : "Incident saved offline. Will sync when service returns."
      );

      if (online) void runSync();
      onSubmitSuccess?.(localId);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save the incident.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render states
  // -------------------------------------------------------------------------

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

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      {/* Basics */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText className="h-4 w-4 text-primary" />
          Incident basics
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="incident-number">Incident number</Label>
            <Input
              id="incident-number"
              value={form.incident_number}
              onChange={(e) => updateForm("incident_number", e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="incident-type">Incident type</Label>
            <select
              id="incident-type"
              value={form.incident_type}
              onChange={(e) => updateForm("incident_type", e.target.value)}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select incident type</option>
              {NERIS_INCIDENT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="space-y-4 border-t pt-6">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          Location
        </div>
        <div className="space-y-2">
          <Label htmlFor="location-address">Address</Label>
          <Input
            id="location-address"
            placeholder="123 Main St, district, landmark..."
            value={form.location_address}
            onChange={(e) => updateForm("location_address", e.target.value)}
            className="h-11"
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
            <Input id="location-lat" value={form.location_lat} onChange={(e) => updateForm("location_lat", e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location-lng">Longitude</Label>
            <Input id="location-lng" value={form.location_lng} onChange={(e) => updateForm("location_lng", e.target.value)} className="h-11" />
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="space-y-4 border-t pt-6">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock3 className="h-4 w-4 text-primary" />
          Timeline
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["alarm-time", "Alarm time", "alarm_time"],
              ["dispatch-time", "Dispatch time", "dispatch_time"],
              ["en-route-time", "En route time", "en_route_time"],
              ["on-scene-time", "On scene time", "on_scene_time"],
              ["controlled-time", "Controlled time", "controlled_time"],
              ["cleared-time", "Cleared time", "cleared_time"],
            ] as const
          ).map(([id, label, field]) => (
            <div key={id} className="space-y-2">
              <Label htmlFor={id}>{label}</Label>
              <Input
                id={id}
                type="datetime-local"
                value={form[field]}
                onChange={(e) => updateForm(field, e.target.value)}
                className="h-11"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Units responding */}
      <section className="space-y-4 border-t pt-6">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Truck className="h-4 w-4 text-primary" />
          Units responding
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {apparatusList.map((unit) => {
            const key = apparatusKey(unit);
            const selected = form.units_responding.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSelection("units_responding", key)}
                className={cn(
                  "min-h-[76px] rounded-lg border px-4 py-4 text-left transition-colors",
                  selected ? "border-primary bg-primary/5" : "hover:bg-muted"
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
      </section>

      {/* Personnel */}
      <section className="space-y-4 border-t pt-6">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Users className="h-4 w-4 text-primary" />
          Personnel on scene
        </div>
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
      </section>

      {/* Casualties & classification */}
      <section className="space-y-4 border-t pt-6">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <AlertTriangle className="h-4 w-4 text-primary" />
          Casualties and classification
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="civilian-casualties">Civilian casualties</Label>
            <Input id="civilian-casualties" inputMode="numeric" value={form.civilian_casualties} onChange={(e) => updateForm("civilian_casualties", e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ff-casualties">FF casualties</Label>
            <Input id="ff-casualties" inputMode="numeric" value={form.firefighter_casualties} onChange={(e) => updateForm("firefighter_casualties", e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exposures">Exposures</Label>
            <Input id="exposures" inputMode="numeric" value={form.exposures} onChange={(e) => updateForm("exposures", e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-use">Property use</Label>
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
        </div>
      </section>

      {/* Actions taken */}
      <section className="space-y-4 border-t pt-6">
        <div className="text-sm font-medium text-foreground">Actions taken</div>
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
      </section>

      {/* Narrative */}
      <section className="space-y-4 border-t pt-6">
        <div className="text-sm font-medium text-foreground">Narrative</div>
        <Textarea
          placeholder="Clear scene summary, actions taken, and outstanding follow-up."
          value={form.narrative}
          onChange={(e) => updateForm("narrative", e.target.value)}
          rows={5}
        />
      </section>

      {/* Status messages */}
      {loadError ? (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError}</div>
      ) : null}
      {saveError ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
      ) : null}
      {saveMessage ? (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{saveMessage}</div>
      ) : null}

      {/* Draft saved hint */}
      {draftId && draftSavedAt ? (
        <p className="text-xs text-muted-foreground">
          Draft saved {new Date(draftSavedAt).toLocaleTimeString()}
        </p>
      ) : null}

      {/* Action row */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {draftId ? (
          <Button type="button" variant="outline" onClick={() => void saveDraft(true)} disabled={isSavingDraft}>
            {isSavingDraft ? "Saving draft..." : "Save draft now"}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
          ) : submitLabel}
        </Button>
      </div>
    </form>
  );
}
