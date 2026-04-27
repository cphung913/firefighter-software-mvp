"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  CloudOff,
  History,
  Loader2,
  Truck,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  ApparatusRecord,
  ChecklistCompletionRecord,
  ChecklistTemplateRecord,
} from "@/lib/db";
import { db } from "@/lib/db";
import { hydrateChecklistBootstrap } from "@/lib/checklists/bootstrap";
import { runSync } from "@/lib/sync/engine";
import { enqueueMutation } from "@/lib/sync/mutations";
import { cn } from "@/lib/utils";
import { useSyncStore } from "@/store/sync-store";

type ChecklistItemResponse = {
  id: string;
  label: string;
  checked: boolean;
  description?: string | null;
};

const EMPTY_TEMPLATE_LIST: ChecklistTemplateRecord[] = [];
const EMPTY_APPARATUS_LIST: ApparatusRecord[] = [];
const EMPTY_HISTORY_LIST: ChecklistCompletionRecord[] = [];

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

function readChecklistItems(
  responses?: Record<string, unknown>
): ChecklistItemResponse[] {
  const rawItems = responses?.items;
  if (!Array.isArray(rawItems)) return [];

  return rawItems.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== "string" || typeof candidate.label !== "string") {
      return [];
    }

    return [
      {
        id: candidate.id,
        label: candidate.label,
        checked: Boolean(candidate.checked),
        description:
          typeof candidate.description === "string"
            ? candidate.description
            : null,
      },
    ];
  });
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

export function ChecklistsWorkspace() {
  const { status: sessionStatus } = useSession();
  const online = useSyncStore((state) => state.online);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const lastSyncAt = useSyncStore((state) => state.lastSyncAt);

  const templates = useLiveQuery(() => db.checklist_templates.toArray(), []);
  const apparatus = useLiveQuery(() => db.apparatus.orderBy("unit_id").toArray(), []);
  const history = useLiveQuery(
    () =>
      db.checklist_completions
        .orderBy("completed_at")
        .reverse()
        .limit(8)
        .toArray(),
    []
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedApparatusKey, setSelectedApparatusKey] = useState<string>("");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const templateList = templates ?? EMPTY_TEMPLATE_LIST;
  const apparatusList = apparatus ?? EMPTY_APPARATUS_LIST;
  const historyList = history ?? EMPTY_HISTORY_LIST;
  const selectedTemplate =
    templateList.find((template) => template.id === selectedTemplateId) ?? null;
  const selectedApparatus =
    apparatusList.find((unit) => unit.local_id === selectedApparatusKey) ?? null;

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    let cancelled = false;

    async function bootstrap() {
      if (!navigator.onLine) {
        if (!cancelled) setIsBootstrapping(false);
        return;
      }

      if (!cancelled) setIsBootstrapping(true);

      try {
        await hydrateChecklistBootstrap();
        if (!cancelled) setLoadError(null);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to refresh checklist templates right now."
          );
        }
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [online, sessionStatus]);

  useEffect(() => {
    if (selectedTemplateId || templateList.length === 0) return;

    const firstTemplate = templateList[0];
    const initialCheckedState = Object.fromEntries(
      firstTemplate.items.map((item) => [item.id, false])
    );

    setSelectedTemplateId(firstTemplate.id);
    setCheckedItems(initialCheckedState);
  }, [selectedTemplateId, templateList]);

  useEffect(() => {
    if (selectedApparatusKey || apparatusList.length === 0) return;
    setSelectedApparatusKey(apparatusList[0].local_id ?? "");
  }, [apparatusList, selectedApparatusKey]);

  function handleTemplateChange(templateId: string) {
    const template = templateList.find((item) => item.id === templateId);
    if (!template) return;

    setSelectedTemplateId(templateId);
    setCheckedItems(
      Object.fromEntries(template.items.map((item) => [item.id, false]))
    );
    setNotes("");
    setSaveMessage(null);
    setSaveError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTemplate || !selectedApparatus) {
      setSaveError("Select a checklist and apparatus before saving.");
      return;
    }

    const apparatusId = selectedApparatus.server_id ?? selectedApparatus.local_id;
    if (!apparatusId) {
      setSaveError("This apparatus needs to sync once before it can accept checks.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const completedAt = new Date().toISOString();

      await enqueueMutation({
        table: "checklist_completions",
        data: {
          template_id: selectedTemplate.id,
          apparatus_id: apparatusId,
          completed_at: completedAt,
          responses: {
            items: selectedTemplate.items.map((item) => ({
              id: item.id,
              label: item.label,
              description: item.description ?? null,
              checked: Boolean(checkedItems[item.id]),
            })),
            notes: notes.trim() || null,
          },
        },
      });

      setCheckedItems(
        Object.fromEntries(selectedTemplate.items.map((item) => [item.id, false]))
      );
      setNotes("");
      setSaveMessage(
        online
          ? "Checklist saved on this device and queued for sync."
          : "Checklist saved offline. It will sync when the connection returns."
      );

      if (online) {
        void runSync();
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "We couldn't save this checklist. Try again in a moment."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const completedCount = selectedTemplate
    ? selectedTemplate.items.filter((item) => checkedItems[item.id]).length
    : 0;
  const hasCachedData = templateList.length > 0 && apparatusList.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Checklists</h1>
        <p className="text-muted-foreground">
          Daily rig checks stay on the device first, then sync up when service is
          back.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Daily apparatus check</CardTitle>
                <CardDescription>
                  Big tap targets, quick notes, and one-save offline capture.
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                {completedCount} of {selectedTemplate?.items.length ?? 0} complete
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                {pendingCount} pending sync
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                {lastSyncAt ? `Last sync ${formatTimestamp(lastSyncAt)}` : "Waiting for first sync"}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {isBootstrapping && !hasCachedData ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading saved checklist data...
                </div>
              </div>
            ) : null}

            {!isBootstrapping && !hasCachedData ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <CloudOff className="mt-0.5 h-5 w-5 text-primary" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      No checklist cache on this device yet.
                    </p>
                    <p>
                      Connect once to load the department template and apparatus
                      roster, then this page will keep working offline.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {hasCachedData ? (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-3">
                  <Label>Checklist</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {templateList.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => handleTemplateChange(template.id)}
                        className={cn(
                          "min-h-[72px] rounded-lg border px-4 py-4 text-left transition-colors",
                          selectedTemplateId === template.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted"
                        )}
                      >
                        <div className="font-medium">{template.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {template.items.length} steps
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Apparatus</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {apparatusList.map((unit) => (
                      <button
                        key={unit.local_id ?? unit.server_id ?? unit.unit_id ?? "apparatus"}
                        type="button"
                        onClick={() => setSelectedApparatusKey(unit.local_id ?? "")}
                        className={cn(
                          "min-h-[80px] rounded-lg border px-4 py-4 text-left transition-colors",
                          selectedApparatusKey === unit.local_id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Truck className="h-5 w-5 text-primary" />
                          <div>
                            <div className="font-medium">
                              {unit.unit_id ?? "Unnamed apparatus"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {[unit.type, unit.year].filter(Boolean).join(" • ") ||
                                "Department asset"}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Checklist items</Label>
                  <div className="space-y-3">
                    {selectedTemplate?.items.map((item) => {
                      const checked = Boolean(checkedItems[item.id]);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setCheckedItems((current) => ({
                              ...current,
                              [item.id]: !current[item.id],
                            }))
                          }
                          className={cn(
                            "flex min-h-[84px] w-full items-start gap-4 rounded-lg border px-4 py-4 text-left transition-colors",
                            checked
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted"
                          )}
                          aria-pressed={checked}
                        >
                          <span
                            className={cn(
                              "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2",
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/30 bg-background text-transparent"
                            )}
                          >
                            <Check className="h-5 w-5" />
                          </span>
                          <span className="space-y-1">
                            <span className="block text-base font-medium leading-snug">
                              {item.label}
                            </span>
                            {item.description ? (
                              <span className="block text-sm text-muted-foreground">
                                {item.description}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="checklist-notes">Notes for duty officer</Label>
                  <Textarea
                    id="checklist-notes"
                    placeholder="Anything to fix before the next call?"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>

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

                <Button className="w-full sm:w-auto" disabled={isSaving} size="lg" type="submit">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving checklist...
                    </>
                  ) : (
                    "Save daily check"
                  )}
                </Button>
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
                <CardTitle>Completion history</CardTitle>
                <CardDescription>
                  Recent checks saved on this device, with sync state attached.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {historyList.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Your saved rig checks will show up here as soon as the first one is
                completed.
              </div>
            ) : (
              <div className="space-y-3">
                {historyList.map((entry) => {
                  const template =
                    templateList.find((item) => item.id === entry.template_id) ?? null;
                  const unit =
                    apparatusList.find(
                      (item) =>
                        item.server_id === entry.apparatus_id ||
                        item.local_id === entry.apparatus_id
                    ) ?? null;
                  const items = readChecklistItems(entry.responses);
                  const checkedCount = items.filter((item) => item.checked).length;

                  return (
                    <div key={entry.local_id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="font-medium">
                            {unit?.unit_id ?? "Department apparatus"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {template?.name ?? "Checklist"} • {checkedCount} of{" "}
                            {items.length} complete
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-medium",
                            statusClasses(entry._sync_status)
                          )}
                        >
                          {statusLabel(entry._sync_status)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertTriangle className="h-4 w-4" />
                        {formatTimestamp(entry.completed_at)}
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
