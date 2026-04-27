"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  Clock3,
  CloudOff,
  Crosshair,
  FileText,
  FileOutput,
  History,
  Loader2,
  MapPin,
  Siren,
  Truck,
  Users,
} from "lucide-react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  ApparatusRecord,
  DepartmentUserRecord,
  IncidentDraftRecord,
  IncidentRecord,
} from "@/lib/db";
import { db } from "@/lib/db";
import { printIncidentPdf } from "@/lib/incidents/export";
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

interface IncidentFormState {
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
  narrative: string;
  exposures: string;
  actions_taken: string[];
  property_use: string;
}

const AUTOSAVE_INTERVAL_MS = 30_000;
const ACTIVE_DRAFT_ID = "active-incident-draft";
const EMPTY_APPARATUS_LIST: ApparatusRecord[] = [];
const EMPTY_ROSTER_LIST: DepartmentUserRecord[] = [];
const EMPTY_INCIDENT_LIST: IncidentRecord[] = [];

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatDateTimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function generateIncidentNumber(date = new Date()): string {
  return `INC-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
    date.getDate()
  )}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function createBlankIncidentForm(): IncidentFormState {
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
    narrative: "",
    exposures: "",
    actions_taken: [],
    property_use: "",
  };
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "Pending timestamp";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Pending timestamp";

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

function toFloatOrNull(value: string): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIntOrNull(value: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readStringArray(
  value: unknown,
  fallback: string[] = []
): string[] {
  if (!Array.isArray(value)) return fallback;

  return value.flatMap((item) => (typeof item === "string" ? [item] : []));
}

function draftToForm(draft: IncidentDraftRecord): IncidentFormState {
  return {
    incident_number: draft.incident_number,
    incident_type: draft.incident_type ?? "",
    location_address: draft.location_address ?? "",
    location_lat: draft.location_lat ?? "",
    location_lng: draft.location_lng ?? "",
    alarm_time: draft.alarm_time ?? "",
    dispatch_time:
      typeof draft.raw_data.dispatch_time === "string"
        ? draft.raw_data.dispatch_time
        : "",
    en_route_time:
      typeof draft.raw_data.en_route_time === "string"
        ? draft.raw_data.en_route_time
        : "",
    on_scene_time: draft.on_scene_time ?? "",
    controlled_time:
      typeof draft.raw_data.controlled_time === "string"
        ? draft.raw_data.controlled_time
        : "",
    cleared_time: draft.cleared_time ?? "",
    units_responding: readStringArray(draft.raw_data.units_responding),
    personnel_on_scene: readStringArray(draft.raw_data.personnel_on_scene),
    civilian_casualties:
      typeof draft.raw_data.civilian_casualties === "string"
        ? draft.raw_data.civilian_casualties
        : "",
    firefighter_casualties:
      typeof draft.raw_data.firefighter_casualties === "string"
        ? draft.raw_data.firefighter_casualties
        : "",
    narrative: draft.narrative ?? "",
    exposures:
      typeof draft.raw_data.exposures === "string" ? draft.raw_data.exposures : "",
    actions_taken: readStringArray(draft.raw_data.actions_taken),
    property_use:
      typeof draft.raw_data.property_use === "string"
        ? draft.raw_data.property_use
        : "",
  };
}

function formToDraft(form: IncidentFormState, updatedAt: string): IncidentDraftRecord {
  return {
    id: ACTIVE_DRAFT_ID,
    incident_number: form.incident_number,
    incident_type: form.incident_type || null,
    location_address: form.location_address || null,
    location_lat: form.location_lat || null,
    location_lng: form.location_lng || null,
    alarm_time: form.alarm_time || null,
    on_scene_time: form.on_scene_time || null,
    cleared_time: form.cleared_time || null,
    narrative: form.narrative || null,
    raw_data: {
      dispatch_time: form.dispatch_time || null,
      en_route_time: form.en_route_time || null,
      controlled_time: form.controlled_time || null,
      units_responding: form.units_responding,
      personnel_on_scene: form.personnel_on_scene,
      civilian_casualties: form.civilian_casualties,
      firefighter_casualties: form.firefighter_casualties,
      exposures: form.exposures,
      actions_taken: form.actions_taken,
      property_use: form.property_use || null,
    },
    updated_at: updatedAt,
  };
}

function statusLabel(status?: string): string {
  switch (status) {
    case "conflict":
      return "Needs review";
    case "synced":
      return "Synced";
    case "syncing":
      return "Syncing";
    default:
      return "Queued";
  }
}

function statusClasses(status?: string): string {
  switch (status) {
    case "conflict":
      return "bg-amber-100 text-amber-800";
    case "synced":
      return "bg-emerald-100 text-emerald-800";
    case "syncing":
      return "bg-sky-100 text-sky-800";
    default:
      return "bg-orange-100 text-orange-800";
  }
}

function apparatusKey(unit: ApparatusRecord): string {
  return unit.local_id ?? unit.server_id ?? unit.unit_id ?? "";
}

function lookupOptionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value?: string | null
): string {
  if (!value) return "Unspecified";
  return options.find((option) => option.value === value)?.label ?? value;
}

export function IncidentsWorkspace() {
  const { status: sessionStatus } = useSession();
  const online = useSyncStore((state) => state.online);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const lastSyncAt = useSyncStore((state) => state.lastSyncAt);

  const apparatus = useLiveQuery(() => db.apparatus.orderBy("unit_id").toArray(), []);
  const roster = useLiveQuery(
    () => db.department_users.orderBy("name").toArray(),
    []
  );
  const incidents = useLiveQuery(
    () => db.incidents.orderBy("updated_at").reverse().limit(10).toArray(),
    []
  );

  const [form, setForm] = useState<IncidentFormState>(() => createBlankIncidentForm());
  const [draftLoaded, setDraftLoaded] = useState(false);
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
  const [exportError, setExportError] = useState<string | null>(null);

  const latestFormRef = useRef(form);
  const draftDirtyRef = useRef(draftDirty);

  const apparatusList = apparatus ?? EMPTY_APPARATUS_LIST;
  const rosterList = roster ?? EMPTY_ROSTER_LIST;
  const incidentList = incidents ?? EMPTY_INCIDENT_LIST;
  const hasCachedResources = apparatusList.length > 0 && rosterList.length > 0;

  useEffect(() => {
    latestFormRef.current = form;
  }, [form]);

  useEffect(() => {
    draftDirtyRef.current = draftDirty;
  }, [draftDirty]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    let cancelled = false;

    async function bootstrap() {
      setIsBootstrapping(true);

      try {
        const draft = await db.incident_drafts.get(ACTIVE_DRAFT_ID);
        if (!cancelled && draft) {
          setForm(draftToForm(draft));
          setDraftSavedAt(draft.updated_at);
        }
      } finally {
        if (!cancelled) setDraftLoaded(true);
      }

      if (navigator.onLine) {
        try {
          await hydrateIncidentBootstrap();
          if (!cancelled) setLoadError(null);
        } catch (error) {
          if (!cancelled) {
            setLoadError(
              error instanceof Error
                ? error.message
                : "Unable to refresh incident resources right now."
            );
          }
        }
      }

      if (!cancelled) setIsBootstrapping(false);
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [online, sessionStatus]);

  useEffect(() => {
    if (!draftLoaded) return;

    const interval = window.setInterval(() => {
      if (!draftDirtyRef.current) return;

      void saveDraft(false);
    }, AUTOSAVE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [draftLoaded]);

  function updateForm<K extends keyof IncidentFormState>(
    field: K,
    value: IncidentFormState[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setDraftDirty(true);
    setSaveError(null);
    setExportError(null);
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

      return { ...current, [field]: next };
    });
    setDraftDirty(true);
    setSaveError(null);
    setExportError(null);
  }

  async function saveDraft(showMessage: boolean) {
    const snapshot = latestFormRef.current;
    const updatedAt = new Date().toISOString();

    setIsSavingDraft(true);

    try {
      await db.incident_drafts.put(formToDraft(snapshot, updatedAt));
      setDraftDirty(false);
      setDraftSavedAt(updatedAt);
      if (showMessage) {
        setSaveMessage("Draft saved on this device.");
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Unable to save the draft right now."
      );
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function captureLocation() {
    if (!("geolocation" in navigator)) {
      setSaveError("This device does not support GPS capture.");
      return;
    }

    setIsCapturingLocation(true);
    setSaveError(null);
    setLocationMessage(null);
    setExportError(null);

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
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      }
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.incident_number.trim()) {
      setSaveError("Incident number is required.");
      return;
    }

    if (!form.incident_type) {
      setSaveError("Select an incident type.");
      return;
    }

    if (!form.location_address.trim() && (!form.location_lat || !form.location_lng)) {
      setSaveError("Enter an address or capture GPS coordinates.");
      return;
    }

    if (!form.alarm_time) {
      setSaveError("Alarm time is required.");
      return;
    }

    if (form.units_responding.length === 0) {
      setSaveError("Select at least one responding unit.");
      return;
    }

    setIsSubmitting(true);
    setSaveError(null);
    setSaveMessage(null);
    setExportError(null);

    try {
      const selectedUnits = apparatusList.filter((unit) =>
        form.units_responding.includes(apparatusKey(unit))
      );
      const selectedPersonnel = rosterList.filter((member) =>
        form.personnel_on_scene.includes(member.id)
      );

      await enqueueMutation({
        table: "incidents",
        data: {
          incident_number: form.incident_number.trim(),
          incident_type: form.incident_type,
          location_address: form.location_address.trim() || null,
          location_lat: toFloatOrNull(form.location_lat),
          location_lng: toFloatOrNull(form.location_lng),
          alarm_time: toIsoOrNull(form.alarm_time),
          on_scene_time: toIsoOrNull(form.on_scene_time),
          cleared_time: toIsoOrNull(form.cleared_time),
          narrative: form.narrative.trim() || null,
          raw_data: {
            dispatch_time: toIsoOrNull(form.dispatch_time),
            en_route_time: toIsoOrNull(form.en_route_time),
            controlled_time: toIsoOrNull(form.controlled_time),
            units_responding: selectedUnits.map(
              (unit) => unit.server_id ?? unit.local_id ?? unit.unit_id
            ),
            units_responding_labels: selectedUnits.map(
              (unit) => unit.unit_id ?? "Department apparatus"
            ),
            personnel_on_scene: selectedPersonnel.map((member) => member.id),
            personnel_on_scene_names: selectedPersonnel.map((member) => member.name),
            casualty_info: {
              civilian: toIntOrNull(form.civilian_casualties),
              firefighter: toIntOrNull(form.firefighter_casualties),
            },
            exposures: toIntOrNull(form.exposures),
            actions_taken: form.actions_taken,
            property_use: form.property_use || null,
          },
        },
      });

      await db.incident_drafts.delete(ACTIVE_DRAFT_ID);
      setForm(createBlankIncidentForm());
      setDraftDirty(false);
      setDraftSavedAt(null);
      setLocationMessage(null);
      setSaveMessage(
        online
          ? "Incident saved locally and queued for sync."
          : "Incident saved offline. It will sync when service returns."
      );

      if (online) {
        void runSync();
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Unable to save the incident right now."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleExport(incident: IncidentRecord) {
    try {
      const rawData = (incident.raw_data ?? {}) as Record<string, unknown>;
      const propertyUseValue =
        typeof rawData.property_use === "string" ? rawData.property_use : null;

      printIncidentPdf(
        incident,
        lookupOptionLabel(NERIS_INCIDENT_TYPES, incident.incident_type),
        lookupOptionLabel(PROPERTY_USE_OPTIONS, propertyUseValue)
      );
      setExportError(null);
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "Unable to open the PDF export on this device."
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Incidents</h1>
        <p className="text-muted-foreground">
          NERIS-ready incident logging with GPS capture, local drafts, and sync
          when the signal comes back.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
          {pendingCount} pending sync
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
          {lastSyncAt ? `Last sync ${formatTimestamp(lastSyncAt)}` : "Waiting for first sync"}
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
          {draftSavedAt ? `Draft saved ${formatTimestamp(draftSavedAt)}` : "Draft not saved yet"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.7fr,1fr]">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Siren className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Log incident</CardTitle>
                <CardDescription>
                  Large controls for the rig, timed autosave every 30 seconds, and
                  one-tap GPS capture.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isBootstrapping && !hasCachedResources ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading apparatus and roster...
                </div>
              </div>
            ) : null}

            {!isBootstrapping && !hasCachedResources ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <CloudOff className="mt-0.5 h-5 w-5 text-primary" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      This device needs one connected visit first.
                    </p>
                    <p>
                      Once the apparatus roster and responders are cached here, the
                      incident form will keep working offline.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {hasCachedResources ? (
              <form className="space-y-8" onSubmit={handleSubmit}>
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
                        onChange={(event) =>
                          updateForm("incident_number", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="incident-type">Incident type</Label>
                      <select
                        id="incident-type"
                        value={form.incident_type}
                        onChange={(event) =>
                          updateForm("incident_type", event.target.value)
                        }
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Select incident type</option>
                        {NERIS_INCIDENT_TYPES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

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
                      onChange={(event) =>
                        updateForm("location_address", event.target.value)
                      }
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={captureLocation}
                      disabled={isCapturingLocation}
                    >
                      {isCapturingLocation ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Capturing GPS...
                        </>
                      ) : (
                        <>
                          <Crosshair className="h-4 w-4" />
                          Use current GPS
                        </>
                      )}
                    </Button>
                    {locationMessage ? (
                      <span className="text-sm text-emerald-700">{locationMessage}</span>
                    ) : null}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="location-lat">Latitude</Label>
                      <Input
                        id="location-lat"
                        value={form.location_lat}
                        onChange={(event) =>
                          updateForm("location_lat", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location-lng">Longitude</Label>
                      <Input
                        id="location-lng"
                        value={form.location_lng}
                        onChange={(event) =>
                          updateForm("location_lng", event.target.value)
                        }
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4 border-t pt-6">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Clock3 className="h-4 w-4 text-primary" />
                    Timeline
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="alarm-time">Alarm time</Label>
                      <Input
                        id="alarm-time"
                        type="datetime-local"
                        value={form.alarm_time}
                        onChange={(event) => updateForm("alarm_time", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dispatch-time">Dispatch time</Label>
                      <Input
                        id="dispatch-time"
                        type="datetime-local"
                        value={form.dispatch_time}
                        onChange={(event) =>
                          updateForm("dispatch_time", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="en-route-time">En route time</Label>
                      <Input
                        id="en-route-time"
                        type="datetime-local"
                        value={form.en_route_time}
                        onChange={(event) =>
                          updateForm("en_route_time", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="on-scene-time">On scene time</Label>
                      <Input
                        id="on-scene-time"
                        type="datetime-local"
                        value={form.on_scene_time}
                        onChange={(event) =>
                          updateForm("on_scene_time", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="controlled-time">Controlled time</Label>
                      <Input
                        id="controlled-time"
                        type="datetime-local"
                        value={form.controlled_time}
                        onChange={(event) =>
                          updateForm("controlled_time", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cleared-time">Cleared time</Label>
                      <Input
                        id="cleared-time"
                        type="datetime-local"
                        value={form.cleared_time}
                        onChange={(event) =>
                          updateForm("cleared_time", event.target.value)
                        }
                      />
                    </div>
                  </div>
                </section>

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
                          <div className="font-medium">
                            {unit.unit_id ?? "Department apparatus"}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {[unit.type, unit.year].filter(Boolean).join(" • ") ||
                              "Department asset"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

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
                            {[member.role, member.badge_number].filter(Boolean).join(" • ") ||
                              "Department responder"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-4 border-t pt-6">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                    Casualties and classification
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="civilian-casualties">Civilian casualties</Label>
                      <Input
                        id="civilian-casualties"
                        inputMode="numeric"
                        value={form.civilian_casualties}
                        onChange={(event) =>
                          updateForm("civilian_casualties", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="firefighter-casualties">FF casualties</Label>
                      <Input
                        id="firefighter-casualties"
                        inputMode="numeric"
                        value={form.firefighter_casualties}
                        onChange={(event) =>
                          updateForm("firefighter_casualties", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exposures">Exposures</Label>
                      <Input
                        id="exposures"
                        inputMode="numeric"
                        value={form.exposures}
                        onChange={(event) => updateForm("exposures", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="property-use">Property use</Label>
                      <select
                        id="property-use"
                        value={form.property_use}
                        onChange={(event) =>
                          updateForm("property_use", event.target.value)
                        }
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Select property use</option>
                        {PROPERTY_USE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section className="space-y-4 border-t pt-6">
                  <div className="text-sm font-medium text-foreground">
                    Actions taken
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {ACTION_TAKEN_OPTIONS.map((option) => {
                      const selected = form.actions_taken.includes(option.value);

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleSelection("actions_taken", option.value)}
                          className={cn(
                            "min-h-[44px] rounded-full border px-4 py-2 text-sm transition-colors",
                            selected ? "border-primary bg-primary/5 text-foreground" : "hover:bg-muted"
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-4 border-t pt-6">
                  <div className="text-sm font-medium text-foreground">Narrative</div>
                  <Textarea
                    placeholder="Clear scene summary, actions taken, and outstanding follow-up."
                    value={form.narrative}
                    onChange={(event) => updateForm("narrative", event.target.value)}
                  />
                </section>

                {loadError ? (
                  <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {loadError}
                  </div>
                ) : null}

                {saveError ? (
                  <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                    {saveError}
                  </div>
                ) : null}

                {saveMessage ? (
                  <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {saveMessage}
                  </div>
                ) : null}

                {exportError ? (
                  <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {exportError}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void saveDraft(true)}
                    disabled={isSavingDraft}
                    className="sm:w-auto"
                  >
                    {isSavingDraft ? "Saving draft..." : "Save draft now"}
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="sm:w-auto">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving incident...
                      </>
                    ) : (
                      "Log incident"
                    )}
                  </Button>
                </div>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <History className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Recent incidents</CardTitle>
                <CardDescription>
                  Local incident history with sync status and quick scene context.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {incidentList.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Logged incidents will appear here after the first report is saved.
              </div>
            ) : (
              <div className="space-y-3">
                {incidentList.map((incident) => {
                  const rawData = (incident.raw_data ?? {}) as Record<string, unknown>;
                  const respondingUnits = readStringArray(
                    rawData.units_responding_labels
                  );
                  const personnel = readStringArray(rawData.personnel_on_scene_names);

                  return (
                    <div key={incident.local_id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="font-medium">
                            {incident.incident_number ?? "Pending incident number"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {lookupOptionLabel(
                              NERIS_INCIDENT_TYPES,
                              incident.incident_type
                            )}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-medium",
                            statusClasses(incident._sync_status)
                          )}
                        >
                          {statusLabel(incident._sync_status)}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <div>{incident.location_address ?? "Location not entered"}</div>
                        <div>
                          Alarm {formatTimestamp(incident.alarm_time)} • Property{" "}
                          {lookupOptionLabel(
                            PROPERTY_USE_OPTIONS,
                            typeof rawData.property_use === "string"
                              ? rawData.property_use
                              : null
                          )}
                        </div>
                        <div>
                          Units: {respondingUnits.join(", ") || "None selected"}
                        </div>
                        <div>
                          Personnel: {personnel.join(", ") || "None selected"}
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleExport(incident)}
                        >
                          <FileOutput className="h-4 w-4" />
                          Export PDF
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
