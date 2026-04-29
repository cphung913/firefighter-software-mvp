"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  Database,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useSession } from "next-auth/react";
import type {
  ImportCommitResponse,
  ImportEntityType,
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
import { hydrateIncidentBootstrap } from "@/lib/incidents/bootstrap";
import {
  commitImportPreview,
  fetchImportPreview,
  uploadImportFile,
} from "@/lib/imports/api";
import { runSync } from "@/lib/sync/engine";
import { cn } from "@/lib/utils";
import { useSyncStore } from "@/store/sync-store";

const ENTITY_LABELS: Record<ImportEntityType, string> = {
  apparatus: "Apparatus",
  personnel: "Personnel",
  incidents: "Incidents",
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
  on_scene_time: "On scene",
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

export function SettingsWorkspace() {
  const { status: sessionStatus } = useSession();
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
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResponse | null>(
    null
  );

  const selectedSection = preview?.sections[selectedSectionIndex] ?? null;
  const totals = useMemo(() => sectionTotals(preview), [preview]);

  useEffect(() => {
    if (!preview) {
      setSelectedSectionIndex(0);
      return;
    }
    if (selectedSectionIndex >= preview.sections.length) {
      setSelectedSectionIndex(0);
    }
  }, [preview, selectedSectionIndex]);

  async function loadPreview(uploadId: string) {
    setIsRefreshingPreview(true);
    try {
      const payload = await fetchImportPreview(uploadId);
      setPreview(payload);
      setCommitResult(null);
      setErrorMessage(null);
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
            disabled={!online || isUploading || sessionStatus !== "authenticated"}
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
                  onClick={() => void loadPreview(preview.upload_id)}
                  disabled={isRefreshingPreview || isUploading || isCommitting}
                >
                  {isRefreshingPreview ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Refresh
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleCommit()}
                  disabled={!hasActionableRows || isCommitting || !online}
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
                      {selectedSection.mappings.map((mapping) => (
                        <div
                          key={mapping.source_header}
                          className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {mapping.source_header}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {mapping.target_field
                                ? fieldLabel(mapping.target_field)
                                : "Unmapped"}
                            </div>
                          </div>
                          <div className="text-xs font-medium text-muted-foreground">
                            {Math.round(mapping.confidence * 100)}%
                          </div>
                        </div>
                      ))}
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
    </div>
  );
}
