"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  LogOut,
  RefreshCw,
  Truck,
  Upload,
  UserPlus,
  Webhook,
  X,
  XCircle,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import type {
  ImportCommitResponse,
  ImportEntityType,
  ImportPreviewMappingOverride,
  ImportPreviewResponse,
  ImportPreviewSection,
  ImportRowAction,
  ImportUploadResponse,
} from "@vfd/shared-types";

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
import { hydrateIncidentBootstrap } from "@/lib/incidents/bootstrap";
import { createApparatus } from "@/lib/assets/api";
import { apiFetch } from "@/lib/api/client";
import {
  commitImportPreview,
  fetchImportPreview,
  uploadImportFile,
} from "@/lib/imports/api";
import { createPersonnel } from "@/lib/roster/api";
import { runSync } from "@/lib/sync/engine";
import { cn } from "@/lib/utils";
import { useSyncStore } from "@/store/sync-store";

import { PushNotificationSettings } from "./push-notification-settings";

const ENTITY_LABELS: Record<ImportEntityType, string> = {
  apparatus: "Apparatus",
  personnel: "Personnel",
  incidents: "Incidents",
};

const ENTITY_FIELDS: Record<ImportEntityType, string[]> = {
  apparatus: [
    "unit_id",
    "type",
    "year",
    "make",
    "model",
    "vin",
    "mileage",
    "service_status",
  ],
  personnel: ["name", "email", "role", "badge_number"],
  incidents: [
    "incident_number",
    "incident_type",
    "location_address",
    "location_lat",
    "location_lng",
    "alarm_time",
    "dispatch_time",
    "en_route_time",
    "on_scene_time",
    "controlled_time",
    "cleared_time",
    "narrative",
  ],
};

const FIELD_LABELS: Record<string, string> = {
  unit_id: "Unit",
  type: "Type",
  year: "Year",
  make: "Make",
  model: "Model",
  vin: "VIN",
  mileage: "Mileage",
  service_status: "Status",
  name: "Name",
  email: "Email",
  role: "Role",
  badge_number: "Badge",
  incident_number: "Incident #",
  incident_type: "Incident type",
  location_address: "Address",
  location_lat: "Latitude",
  location_lng: "Longitude",
  alarm_time: "Alarm time",
  dispatch_time: "Dispatch time",
  en_route_time: "En route",
  on_scene_time: "On scene",
  controlled_time: "Controlled",
  cleared_time: "Cleared",
  narrative: "Narrative",
};

function actionLabel(action: ImportRowAction): string {
  switch (action) {
    case "create":
      return "Create";
    case "update":
      return "Update";
    case "error":
      return "Needs review";
    default:
      return "Skip";
  }
}

function actionClasses(action: ImportRowAction): string {
  switch (action) {
    case "create":
      return "bg-emerald-100 text-emerald-800";
    case "update":
      return "bg-sky-100 text-sky-800";
    case "error":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function entityClasses(entity: ImportEntityType): string {
  switch (entity) {
    case "apparatus":
      return "bg-sky-100 text-sky-800";
    case "personnel":
      return "bg-violet-100 text-violet-800";
    default:
      return "bg-rose-100 text-rose-800";
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function fieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] ?? fieldName.replaceAll("_", " ");
}

function sectionTotals(preview: ImportPreviewResponse | null) {
  const rows = preview?.sections.flatMap((section) => section.rows) ?? [];
  return rows.reduce(
    (totals, row) => {
      totals[row.action] += 1;
      return totals;
    },
    { create: 0, update: 0, skip: 0, error: 0 }
  );
}

function topChangedFields(section: ImportPreviewSection): string[] {
  const ranked = new Map<string, number>();
  for (const row of section.rows) {
    for (const field of row.changed_fields) {
      ranked.set(field, (ranked.get(field) ?? 0) + 1);
    }
  }
  return Array.from(ranked.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([field]) => field);
}

function CadIntegrationSettings() {
  const { data: session, status: sessionStatus } = useSession();
  const online = useSyncStore((s) => s.online);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setWebhookUrl(`${window.location.origin}/api/proxy/api/v1/cad/webhook`);
  }, []);

  async function copyUrl() {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function testConnection() {
    if (!session?.departmentId) return;
    setTesting(true);
    setTestOk(null);
    setTestMessage(null);
    try {
      const res = await apiFetch<{ status: string; message: string }>(
        "/api/v1/cad/test",
        {
          headers: {
            "X-Department-ID": session.departmentId,
          },
        }
      );
      setTestOk(true);
      setTestMessage(res.message ?? "CAD webhook endpoint is active");
    } catch (error) {
      setTestOk(false);
      setTestMessage(
        error instanceof Error ? error.message : "Connection test failed."
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Webhook className="h-5 w-5 text-primary" />
          CAD Integration
        </CardTitle>
        <CardDescription>
          Configure your CAD system to POST dispatches to the webhook URL below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Webhook URL</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              readOnly
              value={webhookUrl || "—"}
              className="font-mono text-xs md:text-sm max-w-xl"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyUrl()}
              disabled={!webhookUrl}
            >
              <Copy className="h-4 w-4 mr-2" />
              {copied ? "Copied" : "Copy URL"}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Required headers</Label>
          <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs md:text-sm max-w-xl space-y-1.5">
            <div>X-Department-ID: {"<your-department-uuid>"}</div>
            <div className="text-muted-foreground">
              Or use X-Department-FDID with your department&apos;s FDID instead of the UUID.
            </div>
            <div>
              X-CAD-Secret: {"<secret>"}{" "}
              <span className="text-muted-foreground">(optional)</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          CAD integration uses these headers only (no Bearer token). Set{" "}
          <span className="font-mono">CAD_WEBHOOK_SECRET</span> in your API environment to require{" "}
          <span className="font-mono">X-CAD-Secret</span>.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void testConnection()}
            disabled={
              !online ||
              sessionStatus !== "authenticated" ||
              !session?.departmentId
            }
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Test connection
          </Button>
          {testOk === true ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {testMessage}
            </span>
          ) : null}
          {testOk === false ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />
              {testMessage}
            </span>
          ) : null}
        </div>
        {!online ? (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Connect to the network to test the CAD endpoint.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SettingsWorkspace() {
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.role === "admin";
  const online = useSyncStore((state) => state.online);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshingPreview, setIsRefreshingPreview] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<ImportUploadResponse | null>(
    null
  );
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [mappingOverrides, setMappingOverrides] = useState<
    Record<number, Record<string, string | null>>
  >({});
  const [hasMappingChanges, setHasMappingChanges] = useState(false);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResponse | null>(
    null
  );
  const [showPersonnelModal, setShowPersonnelModal] = useState(false);
  const [showApparatusModal, setShowApparatusModal] = useState(false);
  const [isSavingPersonnel, setIsSavingPersonnel] = useState(false);
  const [isSavingApparatus, setIsSavingApparatus] = useState(false);
  const [personnelError, setPersonnelError] = useState<string | null>(null);
  const [apparatusError, setApparatusError] = useState<string | null>(null);
  const [personnelForm, setPersonnelForm] = useState({
    name: "",
    email: "",
    role: "member",
    badge_number: "",
  });
  const [apparatusForm, setApparatusForm] = useState({
    unit_id: "",
    type: "",
    year: "",
    make: "",
    model: "",
    vin: "",
    mileage: "",
    service_status: "available",
  });

  const selectedSection = preview?.sections[selectedSectionIndex] ?? null;
  const totals = useMemo(() => sectionTotals(preview), [preview]);

  useEffect(() => {
    if (!preview) {
      setMappingOverrides({});
      setHasMappingChanges(false);
      return;
    }
    const nextOverrides: Record<number, Record<string, string | null>> = {};
    preview.sections.forEach((section) => {
      nextOverrides[section.section_index] = Object.fromEntries(
        section.mappings.map((mapping) => [
          mapping.source_header,
          mapping.target_field ?? null,
        ])
      );
    });
    setMappingOverrides(nextOverrides);
    setHasMappingChanges(false);
  }, [preview]);

  useEffect(() => {
    if (!preview) {
      setSelectedSectionIndex(0);
      return;
    }
    if (selectedSectionIndex >= preview.sections.length) {
      setSelectedSectionIndex(0);
    }
  }, [preview, selectedSectionIndex]);

  async function loadPreview(
    uploadId: string,
    overrides?: ImportPreviewMappingOverride[]
  ) {
    setIsRefreshingPreview(true);
    try {
      const payload = await fetchImportPreview(uploadId, overrides);
      setPreview(payload);
      setCommitResult(null);
      setErrorMessage(null);
      setHasMappingChanges(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load import preview."
      );
    } finally {
      setIsRefreshingPreview(false);
    }
  }

  async function handleFileSelection(file: File | null) {
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);
    setCommitResult(null);

    try {
      const summary = await uploadImportFile(file);
      setUploadSummary(summary);
      await loadPreview(summary.upload_id);
    } catch (error) {
      setUploadSummary(null);
      setPreview(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Upload failed. Try another file."
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleCommit() {
    if (!uploadSummary) return;

    setIsCommitting(true);
    setErrorMessage(null);

    try {
      const result = await commitImportPreview(uploadSummary.upload_id);
      setCommitResult(result);
      setPreview(null);
      setUploadSummary(null);
      await hydrateIncidentBootstrap();
      await runSync();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Import commit failed."
      );
    } finally {
      setIsCommitting(false);
    }
  }

  function buildMappingOverrides(): ImportPreviewMappingOverride[] {
    if (!preview) return [];
    return preview.sections.map((section) => ({
      section_index: section.section_index,
      mappings: section.mappings.map((mapping) => ({
        source_header: mapping.source_header,
        target_field:
          mappingOverrides[section.section_index]?.[mapping.source_header] ??
          mapping.target_field ??
          null,
      })),
    }));
  }

  function updateMapping(
    sectionIndex: number,
    sourceHeader: string,
    targetField: string | null
  ) {
    setMappingOverrides((prev) => ({
      ...prev,
      [sectionIndex]: {
        ...(prev[sectionIndex] ?? {}),
        [sourceHeader]: targetField,
      },
    }));
    setHasMappingChanges(true);
  }

  function resetPersonnelForm() {
    setPersonnelForm({
      name: "",
      email: "",
      role: "member",
      badge_number: "",
    });
    setPersonnelError(null);
  }

  function resetApparatusForm() {
    setApparatusForm({
      unit_id: "",
      type: "",
      year: "",
      make: "",
      model: "",
      vin: "",
      mileage: "",
      service_status: "available",
    });
    setApparatusError(null);
  }

  async function handleAddPersonnel() {
    if (!personnelForm.name.trim()) {
      setPersonnelError("Name is required.");
      return;
    }

    setIsSavingPersonnel(true);
    setPersonnelError(null);

    try {
      await createPersonnel({
        name: personnelForm.name.trim(),
        email: personnelForm.email.trim() || undefined,
        role: personnelForm.role || "member",
        badge_number: personnelForm.badge_number.trim() || undefined,
      });
      await hydrateIncidentBootstrap();
      await runSync();
      setShowPersonnelModal(false);
      resetPersonnelForm();
    } catch (error) {
      setPersonnelError(
        error instanceof Error
          ? error.message
          : "Unable to add personnel right now."
      );
    } finally {
      setIsSavingPersonnel(false);
    }
  }

  async function handleAddApparatus() {
    const unitId = apparatusForm.unit_id.trim();
    const vin = apparatusForm.vin.trim();
    if (!unitId && !vin) {
      setApparatusError("Unit ID or VIN is required.");
      return;
    }

    const yearValue = apparatusForm.year.trim()
      ? Number(apparatusForm.year)
      : undefined;
    const mileageValue = apparatusForm.mileage.trim()
      ? Number(apparatusForm.mileage)
      : undefined;

    setIsSavingApparatus(true);
    setApparatusError(null);

    try {
      await createApparatus({
        unit_id: unitId || undefined,
        type: apparatusForm.type.trim() || undefined,
        year: yearValue !== undefined && Number.isFinite(yearValue)
          ? yearValue
          : undefined,
        make: apparatusForm.make.trim() || undefined,
        model: apparatusForm.model.trim() || undefined,
        vin: vin || undefined,
        mileage: mileageValue !== undefined && Number.isFinite(mileageValue)
          ? mileageValue
          : undefined,
        service_status: apparatusForm.service_status || "available",
      });
      await hydrateIncidentBootstrap();
      await runSync();
      setShowApparatusModal(false);
      resetApparatusForm();
    } catch (error) {
      setApparatusError(
        error instanceof Error
          ? error.message
          : "Unable to add apparatus right now."
      );
    } finally {
      setIsSavingApparatus(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragActive(false);
    if (!online) return;
    void handleFileSelection(event.dataTransfer.files?.[0] ?? null);
  }

  const hasActionableRows = preview?.sections.some((section) =>
    section.rows.some((row) => row.action === "create" || row.action === "update")
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Department import tools and migration controls.
        </p>
      </div>

      <PushNotificationSettings />

      <CadIntegrationSettings />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Database className="h-5 w-5 text-primary" />
                Migration Engine
              </CardTitle>
              <CardDescription>
                Legacy roster, asset, and incident imports.
              </CardDescription>
            </div>
            {!online ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                <CloudOff className="h-3.5 w-3.5" />
                Online required
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={handleDrop}
            disabled={!online || isUploading || sessionStatus !== "authenticated" || !isAdmin}
            className={cn(
              "flex min-h-[12rem] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/20 hover:bg-muted/30",
              (!online || isUploading) && "cursor-not-allowed opacity-70"
            )}
          >
            {isUploading ? (
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            ) : (
              <Upload className="h-10 w-10 text-primary" />
            )}
            <div className="space-y-1">
              <div className="text-base font-semibold">
                {isUploading ? "Parsing import file" : "Drop CSV, XLSX, or PDF"}
              </div>
              <div className="text-sm text-muted-foreground">
                Or choose a file from disk.
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                CSV
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                XLSX
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1">
                <FileText className="h-3.5 w-3.5" />
                PDF
              </span>
            </div>
          </button>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.pdf"
            className="hidden"
            onChange={(event) =>
              void handleFileSelection(event.currentTarget.files?.[0] ?? null)
            }
          />

          {errorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMessage}
            </div>
          ) : null}

          {uploadSummary ? (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border bg-background px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  File
                </div>
                <div className="mt-1 truncate text-sm font-medium">
                  {uploadSummary.file_name}
                </div>
              </div>
              <div className="rounded-lg border bg-background px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tables Found
                </div>
                <div className="mt-1 text-sm font-medium">
                  {uploadSummary.sections.length}
                </div>
              </div>
              <div className="rounded-lg border bg-background px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Rows Parsed
                </div>
                <div className="mt-1 text-sm font-medium">
                  {uploadSummary.sections.reduce(
                    (total, section) => total + section.row_count,
                    0
                  )}
                </div>
              </div>
              <div className="rounded-lg border bg-background px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Warnings
                </div>
                <div className="mt-1 text-sm font-medium">
                  {uploadSummary.sections.reduce(
                    (total, section) => total + section.warnings.length,
                    0
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="text-sm font-medium">Templates</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href="/templates/roster-template.csv" download>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                    Roster template
                  </Button>
                </a>
                <a href="/templates/apparatus-template.csv" download>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                    Apparatus template
                  </Button>
                </a>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Use the templates as a starting point. Keep headers on the first
                row.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="text-sm font-medium">Manual entry</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowPersonnelModal(true);
                    setPersonnelError(null);
                  }}
                  disabled={!online || sessionStatus !== "authenticated" || !isAdmin}
                >
                  <UserPlus className="h-4 w-4" />
                  Add personnel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowApparatusModal(true);
                    setApparatusError(null);
                  }}
                  disabled={!online || sessionStatus !== "authenticated" || !isAdmin}
                >
                  <Truck className="h-4 w-4" />
                  Add apparatus
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Quick add a single record if the roster file is not ready.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">Preview Diff</CardTitle>
                <CardDescription>
                  Review detected table types, row actions, and field changes.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void loadPreview(preview.upload_id, buildMappingOverrides())
                  }
                  disabled={isRefreshingPreview || isUploading || isCommitting}
                >
                  {isRefreshingPreview ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {hasMappingChanges ? "Apply mappings" : "Refresh"}
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleCommit()}
                  disabled={
                    !hasActionableRows || isCommitting || !online || hasMappingChanges
                  }
                >
                  {isCommitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  Commit Import
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border bg-background px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Create
                </div>
                <div className="mt-1 text-sm font-medium">{totals.create}</div>
              </div>
              <div className="rounded-lg border bg-background px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Update
                </div>
                <div className="mt-1 text-sm font-medium">{totals.update}</div>
              </div>
              <div className="rounded-lg border bg-background px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Skip
                </div>
                <div className="mt-1 text-sm font-medium">{totals.skip}</div>
              </div>
              <div className="rounded-lg border bg-background px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Needs review
                </div>
                <div className="mt-1 text-sm font-medium">{totals.error}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {preview.sections.map((section, index) => (
                <button
                  key={`${section.dataset_label}-${index}`}
                  type="button"
                  onClick={() => setSelectedSectionIndex(index)}
                  className={cn(
                    "inline-flex min-h-[2.5rem] items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    index === selectedSectionIndex
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                  )}
                >
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      entityClasses(section.entity_type)
                    )}
                  >
                    {ENTITY_LABELS[section.entity_type]}
                  </span>
                  <span>{section.dataset_label}</span>
                  <span className="text-xs text-muted-foreground">
                    {section.rows.length}
                  </span>
                </button>
              ))}
            </div>
          </CardHeader>

          {selectedSection ? (
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[0.95fr_2fr]">
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          entityClasses(selectedSection.entity_type)
                        )}
                      >
                        {ENTITY_LABELS[selectedSection.entity_type]}
                      </span>
                      <span className="text-sm font-medium">
                        Header normalization
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                        {selectedSection.mappings.map((mapping) => {
                          const sectionIndex = selectedSection.section_index;
                          const currentValue =
                            mappingOverrides[sectionIndex]?.[
                              mapping.source_header
                            ] ?? mapping.target_field ?? "";
                          return (
                            <div
                              key={mapping.source_header}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium">
                                  {mapping.source_header}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {currentValue
                                    ? fieldLabel(currentValue)
                                    : "Unmapped"}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={currentValue}
                                  onChange={(event) =>
                                    updateMapping(
                                      sectionIndex,
                                      mapping.source_header,
                                      event.target.value || null
                                    )
                                  }
                                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                                >
                                  <option value="">Ignore</option>
                                  {ENTITY_FIELDS[selectedSection.entity_type].map(
                                    (fieldName) => (
                                      <option key={fieldName} value={fieldName}>
                                        {fieldLabel(fieldName)}
                                      </option>
                                    )
                                  )}
                                </select>
                                <div className="text-xs font-medium text-muted-foreground">
                                  {Math.round(mapping.confidence * 100)}%
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {hasMappingChanges ? (
                          <div className="text-xs text-muted-foreground">
                            Mapping changes are pending. Apply mappings to refresh the
                            preview.
                          </div>
                        ) : null}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-4">
                    <div className="text-sm font-medium">Most changed fields</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {topChangedFields(selectedSection).length > 0 ? (
                        topChangedFields(selectedSection).map((fieldName) => (
                          <span
                            key={fieldName}
                            className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground"
                          >
                            {fieldLabel(fieldName)}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No field deltas in this table.
                        </span>
                      )}
                    </div>
                  </div>

                  {selectedSection.warnings.length > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <div className="mb-2 flex items-center gap-2 font-medium">
                        <AlertTriangle className="h-4 w-4" />
                        Parser warnings
                      </div>
                      <ul className="space-y-1">
                        {selectedSection.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-lg border bg-background">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y text-sm">
                      <thead className="bg-muted/30 text-left">
                        <tr>
                          <th className="px-4 py-3 font-medium">Row</th>
                          <th className="px-4 py-3 font-medium">Action</th>
                          <th className="px-4 py-3 font-medium">Match</th>
                          <th className="px-4 py-3 font-medium">Incoming</th>
                          <th className="px-4 py-3 font-medium">Changes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedSection.rows.map((row) => (
                          <tr key={row.row_index} className="align-top">
                            <td className="px-4 py-4 text-muted-foreground">
                              {row.row_index}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
                                  actionClasses(row.action)
                                )}
                              >
                                {actionLabel(row.action)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-muted-foreground">
                              <div>{row.match_reason ?? "New record"}</div>
                              {row.warnings.length > 0 ? (
                                <div className="mt-2 space-y-1 text-xs text-red-700">
                                  {row.warnings.map((warning) => (
                                    <div
                                      key={`${row.row_index}-${warning}`}
                                      className="flex items-start gap-1.5"
                                    >
                                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                      <span>{warning}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-4">
                              <div className="space-y-1 text-sm">
                                {Object.entries(row.incoming).map(([fieldName, value]) => (
                                  <div key={fieldName} className="flex gap-2">
                                    <span className="min-w-24 text-muted-foreground">
                                      {fieldLabel(fieldName)}
                                    </span>
                                    <span className="font-medium">
                                      {formatValue(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {row.changed_fields.length > 0 ? (
                                <div className="space-y-2 text-sm">
                                  {row.changed_fields.map((fieldName) => {
                                    const diff = row.diff[fieldName];
                                    return (
                                      <div key={fieldName} className="space-y-1">
                                        <div className="font-medium">
                                          {fieldLabel(fieldName)}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                                          <span>{formatValue(diff?.current)}</span>
                                          <ArrowRight className="h-3.5 w-3.5" />
                                          <span className="font-medium text-foreground">
                                            {formatValue(diff?.incoming)}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  No changes
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      {commitResult ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Import committed
            </CardTitle>
            <CardDescription>
              {commitResult.file_name} imported at{" "}
              {new Date(commitResult.committed_at).toLocaleString()}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {commitResult.summaries.map((summary) => (
                <div
                  key={summary.entity_type}
                  className="rounded-lg border bg-background px-4 py-3"
                >
                  <div className="text-sm font-medium">
                    {ENTITY_LABELS[summary.entity_type]}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>Create: {summary.created}</div>
                    <div>Update: {summary.updated}</div>
                    <div>Skip: {summary.skipped}</div>
                    <div>Error: {summary.errors}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showPersonnelModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Add personnel</h2>
                <p className="text-sm text-muted-foreground">
                  Create a roster entry for this department.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPersonnelModal(false);
                  resetPersonnelForm();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="personnel-name">Name</Label>
                <Input
                  id="personnel-name"
                  value={personnelForm.name}
                  onChange={(event) =>
                    setPersonnelForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Alex Morgan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="personnel-email">Email (optional)</Label>
                <Input
                  id="personnel-email"
                  type="email"
                  value={personnelForm.email}
                  onChange={(event) =>
                    setPersonnelForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  placeholder="alex@example.com"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="personnel-role">Role</Label>
                  <select
                    id="personnel-role"
                    value={personnelForm.role}
                    onChange={(event) =>
                      setPersonnelForm((prev) => ({
                        ...prev,
                        role: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
                  >
                    <option value="member">Member</option>
                    <option value="officer">Officer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personnel-badge">Badge number</Label>
                  <Input
                    id="personnel-badge"
                    value={personnelForm.badge_number}
                    onChange={(event) =>
                      setPersonnelForm((prev) => ({
                        ...prev,
                        badge_number: event.target.value,
                      }))
                    }
                    placeholder="1024"
                  />
                </div>
              </div>
            </div>

            {personnelError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {personnelError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPersonnelModal(false);
                  resetPersonnelForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleAddPersonnel()}
                disabled={isSavingPersonnel}
              >
                {isSavingPersonnel ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Save personnel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showApparatusModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Add apparatus</h2>
                <p className="text-sm text-muted-foreground">
                  Add a single unit to the apparatus list.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowApparatusModal(false);
                  resetApparatusForm();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="apparatus-unit">Unit ID</Label>
                  <Input
                    id="apparatus-unit"
                    value={apparatusForm.unit_id}
                    onChange={(event) =>
                      setApparatusForm((prev) => ({
                        ...prev,
                        unit_id: event.target.value,
                      }))
                    }
                    placeholder="Engine 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apparatus-type">Type</Label>
                  <Input
                    id="apparatus-type"
                    value={apparatusForm.type}
                    onChange={(event) =>
                      setApparatusForm((prev) => ({
                        ...prev,
                        type: event.target.value,
                      }))
                    }
                    placeholder="Engine"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="apparatus-year">Year</Label>
                  <Input
                    id="apparatus-year"
                    type="number"
                    value={apparatusForm.year}
                    onChange={(event) =>
                      setApparatusForm((prev) => ({
                        ...prev,
                        year: event.target.value,
                      }))
                    }
                    placeholder="2019"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apparatus-make">Make</Label>
                  <Input
                    id="apparatus-make"
                    value={apparatusForm.make}
                    onChange={(event) =>
                      setApparatusForm((prev) => ({
                        ...prev,
                        make: event.target.value,
                      }))
                    }
                    placeholder="Pierce"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="apparatus-model">Model</Label>
                  <Input
                    id="apparatus-model"
                    value={apparatusForm.model}
                    onChange={(event) =>
                      setApparatusForm((prev) => ({
                        ...prev,
                        model: event.target.value,
                      }))
                    }
                    placeholder="Enforcer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apparatus-vin">VIN</Label>
                  <Input
                    id="apparatus-vin"
                    value={apparatusForm.vin}
                    onChange={(event) =>
                      setApparatusForm((prev) => ({
                        ...prev,
                        vin: event.target.value,
                      }))
                    }
                    placeholder="1FDUF5HT2LEA30707"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="apparatus-mileage">Mileage</Label>
                  <Input
                    id="apparatus-mileage"
                    type="number"
                    value={apparatusForm.mileage}
                    onChange={(event) =>
                      setApparatusForm((prev) => ({
                        ...prev,
                        mileage: event.target.value,
                      }))
                    }
                    placeholder="18000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apparatus-status">Service status</Label>
                  <select
                    id="apparatus-status"
                    value={apparatusForm.service_status}
                    onChange={(event) =>
                      setApparatusForm((prev) => ({
                        ...prev,
                        service_status: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
                  >
                    <option value="available">Available</option>
                    <option value="responding">Responding</option>
                    <option value="out_of_service">Out of service</option>
                  </select>
                </div>
              </div>
            </div>

            {apparatusError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {apparatusError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowApparatusModal(false);
                  resetApparatusForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleAddApparatus()}
                disabled={isSavingApparatus}
              >
                {isSavingApparatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Save apparatus
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="md:hidden pt-2 pb-4">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-3 text-sm font-medium text-destructive min-h-[44px] transition-colors hover:bg-destructive/5"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
