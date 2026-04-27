"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Boxes,
  Gauge,
  History,
  Loader2,
  Shield,
  Truck,
  Wrench,
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
import type {
  ApparatusRecord,
  ChecklistCompletionRecord,
  DepartmentUserRecord,
  PpeItemRecord,
  ScbaUnitRecord,
} from "@/lib/db";
import { db } from "@/lib/db";
import { hydrateAssetsBootstrap } from "@/lib/assets/bootstrap";
import { cn } from "@/lib/utils";
import { useSyncStore } from "@/store/sync-store";

type AssetTab = "apparatus" | "ppe" | "scba";
type WarningTone = "good" | "due" | "overdue" | "retired" | "unknown";

const EMPTY_APPARATUS_LIST: ApparatusRecord[] = [];
const EMPTY_PPE_LIST: PpeItemRecord[] = [];
const EMPTY_SCBA_LIST: ScbaUnitRecord[] = [];
const EMPTY_USER_LIST: DepartmentUserRecord[] = [];
const EMPTY_CHECKLIST_LIST: ChecklistCompletionRecord[] = [];

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function startOfToday(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function daysUntil(date: Date): number {
  const diffMs = date.getTime() - startOfToday().getTime();
  return Math.floor(diffMs / 86_400_000);
}

function formatDate(value?: string | null): string {
  const parsed = parseDateOnly(value);
  if (!parsed) return "Not recorded";

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

function toneClasses(tone: WarningTone): string {
  switch (tone) {
    case "overdue":
      return "bg-red-100 text-red-800";
    case "due":
      return "bg-amber-100 text-amber-800";
    case "retired":
      return "bg-slate-200 text-slate-700";
    case "good":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function toneLabel(tone: WarningTone): string {
  switch (tone) {
    case "overdue":
      return "Overdue";
    case "due":
      return "Due in 30 days";
    case "retired":
      return "Retired";
    case "good":
      return "Current";
    default:
      return "Needs date";
  }
}

function ppeInspectionStatus(item: PpeItemRecord) {
  if (item.retired_at) {
    return {
      tone: "retired" as const,
      dueDate: item.retired_at,
      label: "Retired",
    };
  }

  const lastInspection = parseDateOnly(item.last_inspection);
  if (!lastInspection) {
    return { tone: "unknown" as const, dueDate: null, label: "Needs inspection date" };
  }

  const dueDate = addDays(lastInspection, 365);
  const days = daysUntil(dueDate);

  if (days < 0) {
    return { tone: "overdue" as const, dueDate, label: "Inspection overdue" };
  }
  if (days <= 30) {
    return { tone: "due" as const, dueDate, label: "Inspection due soon" };
  }
  return { tone: "good" as const, dueDate, label: "Inspection current" };
}

function scbaDateStatus(
  value: string | null | undefined,
  intervalYears: number,
  missingLabel: string
) {
  const lastService = parseDateOnly(value);
  if (!lastService) {
    return { tone: "unknown" as const, dueDate: null, label: missingLabel };
  }

  const dueDate = addYears(lastService, intervalYears);
  const days = daysUntil(dueDate);

  if (days < 0) {
    return { tone: "overdue" as const, dueDate, label: "Overdue" };
  }
  if (days <= 30) {
    return { tone: "due" as const, dueDate, label: "Due soon" };
  }
  return { tone: "good" as const, dueDate, label: "Current" };
}

function worstTone(...tones: WarningTone[]): WarningTone {
  if (tones.includes("overdue")) return "overdue";
  if (tones.includes("due")) return "due";
  if (tones.includes("unknown")) return "unknown";
  if (tones.includes("retired")) return "retired";
  return "good";
}

function apparatusKey(unit: ApparatusRecord): string {
  return unit.local_id ?? unit.server_id ?? unit.unit_id ?? "";
}

function countCheckedItems(responses?: Record<string, unknown>): number {
  const items = responses?.items;
  if (!Array.isArray(items)) return 0;

  return items.reduce((count, item) => {
    if (!item || typeof item !== "object") return count;
    return (item as Record<string, unknown>).checked ? count + 1 : count;
  }, 0);
}

function statusChipClasses(status?: string): string {
  switch (status) {
    case "out_of_service":
      return "bg-red-100 text-red-800";
    case "reserve":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-emerald-100 text-emerald-800";
  }
}

function statusChipLabel(status?: string): string {
  switch (status) {
    case "out_of_service":
      return "Out of service";
    case "reserve":
      return "Reserve";
    default:
      return "In service";
  }
}

function sortByUrgency<T>(
  items: T[],
  getTone: (item: T) => WarningTone
): T[] {
  const weight: Record<WarningTone, number> = {
    overdue: 0,
    due: 1,
    unknown: 2,
    retired: 3,
    good: 4,
  };

  return [...items].sort((a, b) => weight[getTone(a)] - weight[getTone(b)]);
}

export function AssetsWorkspace() {
  const { status: sessionStatus } = useSession();
  const online = useSyncStore((state) => state.online);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const lastSyncAt = useSyncStore((state) => state.lastSyncAt);

  const apparatus = useLiveQuery(() => db.apparatus.orderBy("unit_id").toArray(), []);
  const ppeItems = useLiveQuery(() => db.ppe_items.toArray(), []);
  const scbaUnits = useLiveQuery(() => db.scba_units.toArray(), []);
  const users = useLiveQuery(() => db.department_users.orderBy("name").toArray(), []);
  const checklistCompletions = useLiveQuery(
    () =>
      db.checklist_completions
        .orderBy("completed_at")
        .reverse()
        .limit(24)
        .toArray(),
    []
  );

  const [activeTab, setActiveTab] = useState<AssetTab>("apparatus");
  const [selectedApparatusKey, setSelectedApparatusKey] = useState<string>("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apparatusList = apparatus ?? EMPTY_APPARATUS_LIST;
  const ppeList = ppeItems ?? EMPTY_PPE_LIST;
  const scbaList = scbaUnits ?? EMPTY_SCBA_LIST;
  const userList = users ?? EMPTY_USER_LIST;
  const completionList = checklistCompletions ?? EMPTY_CHECKLIST_LIST;
  const hasCachedAssets =
    apparatusList.length > 0 || ppeList.length > 0 || scbaList.length > 0;

  const userNameById = new Map(userList.map((user) => [user.id, user.name]));
  const ppeSorted = sortByUrgency(ppeList, (item) => ppeInspectionStatus(item).tone);
  const scbaSorted = sortByUrgency(scbaList, (unit) =>
    worstTone(
      scbaDateStatus(unit.cylinder_hydro_date, 5, "Needs hydro date").tone,
      scbaDateStatus(unit.regulator_service_date, 1, "Needs service date").tone
    )
  );

  const selectedApparatus =
    apparatusList.find((unit) => apparatusKey(unit) === selectedApparatusKey) ?? null;

  const relatedChecks = selectedApparatus
    ? completionList.filter(
        (entry) =>
          entry.apparatus_id === selectedApparatus.server_id ||
          entry.apparatus_id === selectedApparatus.local_id
      )
    : [];

  const overduePpeCount = ppeList.filter(
    (item) => ppeInspectionStatus(item).tone === "overdue"
  ).length;
  const dueSoonPpeCount = ppeList.filter(
    (item) => ppeInspectionStatus(item).tone === "due"
  ).length;
  const overdueScbaCount = scbaList.filter((unit) =>
    worstTone(
      scbaDateStatus(unit.cylinder_hydro_date, 5, "Needs hydro date").tone,
      scbaDateStatus(unit.regulator_service_date, 1, "Needs service date").tone
    ) === "overdue"
  ).length;

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
        await hydrateAssetsBootstrap();
        if (!cancelled) setLoadError(null);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to refresh asset records right now."
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
    if (selectedApparatusKey || apparatusList.length === 0) return;
    setSelectedApparatusKey(apparatusKey(apparatusList[0]));
  }, [apparatusList, selectedApparatusKey]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
        <p className="text-muted-foreground">
          Apparatus, PPE, and SCBA records with fast warning flags for anything
          that needs attention.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
          {apparatusList.length} apparatus
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
          {overduePpeCount} PPE overdue
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
          {dueSoonPpeCount} PPE due soon
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
          {overdueScbaCount} SCBA overdue
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
          {pendingCount} pending sync
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
          {lastSyncAt ? `Last sync ${formatTimestamp(lastSyncAt)}` : "Waiting for first sync"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "apparatus", label: "Apparatus", icon: Truck },
          { key: "ppe", label: "PPE", icon: Shield },
          { key: "scba", label: "SCBA", icon: Gauge },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;

          return (
            <Button
              key={tab.key}
              type="button"
              variant={active ? "default" : "outline"}
              onClick={() => setActiveTab(tab.key as AssetTab)}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {isBootstrapping && !hasCachedAssets ? (
        <Card>
          <CardContent className="flex min-h-[280px] items-center justify-center">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading asset records...
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!isBootstrapping && !hasCachedAssets ? (
        <Card>
          <CardContent className="py-10">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Boxes className="mt-0.5 h-5 w-5 text-primary" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  This device needs one connected visit first.
                </p>
                <p>
                  Once the department asset records are cached here, this page stays
                  readable even when the station drops offline.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loadError ? (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      ) : null}

      {hasCachedAssets && activeTab === "apparatus" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr,1.2fr]">
          <section className="space-y-3">
            {apparatusList.map((unit) => {
              const selected = apparatusKey(unit) === selectedApparatusKey;

              return (
                <button
                  key={apparatusKey(unit)}
                  type="button"
                  onClick={() => setSelectedApparatusKey(apparatusKey(unit))}
                  className={cn(
                    "w-full rounded-lg border px-4 py-4 text-left transition-colors",
                    selected ? "border-primary bg-primary/5" : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {unit.unit_id ?? "Department apparatus"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {[unit.type, unit.year, unit.make].filter(Boolean).join(" • ") ||
                          "Fleet asset"}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        statusChipClasses(unit.service_status)
                      )}
                    >
                      {statusChipLabel(unit.service_status)}
                    </span>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    Mileage {unit.mileage?.toLocaleString() ?? "Not recorded"}
                  </div>
                </button>
              );
            })}
          </section>

          <section>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>
                      {selectedApparatus?.unit_id ?? "Select an apparatus"}
                    </CardTitle>
                    <CardDescription>
                      Detail view for the current rig, with recent readiness checks.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedApparatus ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-sm text-muted-foreground">Status</div>
                        <div className="mt-1">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-medium",
                              statusChipClasses(selectedApparatus.service_status)
                            )}
                          >
                            {statusChipLabel(selectedApparatus.service_status)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Mileage</div>
                        <div className="mt-1 font-medium">
                          {selectedApparatus.mileage?.toLocaleString() ?? "Not recorded"}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Make / model</div>
                        <div className="mt-1 font-medium">
                          {[selectedApparatus.make, selectedApparatus.model]
                            .filter(Boolean)
                            .join(" ") || "Not recorded"}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">VIN</div>
                        <div className="mt-1 font-medium">
                          {selectedApparatus.vin ?? "Not recorded"}
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                        <History className="h-4 w-4 text-primary" />
                        Recent readiness checks
                      </div>
                      {relatedChecks.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          No apparatus checks have been logged for this unit yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {relatedChecks.slice(0, 3).map((entry) => (
                            <div key={entry.local_id} className="rounded-lg border p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-medium">
                                  {countCheckedItems(entry.responses)} items completed
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {formatTimestamp(entry.completed_at)}
                                </span>
                              </div>
                              <div className="mt-2 text-sm text-muted-foreground">
                                {typeof entry.responses?.notes === "string" &&
                                entry.responses.notes.trim()
                                  ? entry.responses.notes
                                  : "No notes recorded."}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    Pick an apparatus from the left to see its details.
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      ) : null}

      {hasCachedAssets && activeTab === "ppe" ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>PPE inventory</CardTitle>
                <CardDescription>
                  Inspection status rolls forward from the last inspection date.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">Item</th>
                    <th className="pb-3 pr-4 font-medium">Assigned to</th>
                    <th className="pb-3 pr-4 font-medium">Last inspection</th>
                    <th className="pb-3 pr-4 font-medium">Next due</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ppeSorted.map((item) => {
                    const status = ppeInspectionStatus(item);

                    return (
                      <tr key={item.local_id} className="border-b last:border-0">
                        <td className="py-4 pr-4">
                          <div className="font-medium">{item.item_type}</div>
                          <div className="text-muted-foreground">
                            {item.serial_number ?? "No serial recorded"}
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-muted-foreground">
                          {item.assigned_to
                            ? userNameById.get(item.assigned_to) ?? "Unknown member"
                            : "Unassigned"}
                        </td>
                        <td className="py-4 pr-4 text-muted-foreground">
                          {formatDate(item.last_inspection)}
                        </td>
                        <td className="py-4 pr-4 text-muted-foreground">
                          {status.dueDate instanceof Date
                            ? status.dueDate.toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "Needs date"}
                        </td>
                        <td className="py-4">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-medium",
                              toneClasses(status.tone)
                            )}
                          >
                            {toneLabel(status.tone)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hasCachedAssets && activeTab === "scba" ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>SCBA log</CardTitle>
                <CardDescription>
                  Hydro and regulator service dates are color-coded when they get close.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">Unit</th>
                    <th className="pb-3 pr-4 font-medium">Assigned to</th>
                    <th className="pb-3 pr-4 font-medium">Hydro test</th>
                    <th className="pb-3 pr-4 font-medium">Regulator service</th>
                    <th className="pb-3 font-medium">Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {scbaSorted.map((unit) => {
                    const hydro = scbaDateStatus(
                      unit.cylinder_hydro_date,
                      5,
                      "Needs hydro date"
                    );
                    const regulator = scbaDateStatus(
                      unit.regulator_service_date,
                      1,
                      "Needs service date"
                    );
                    const tone = worstTone(hydro.tone, regulator.tone);

                    return (
                      <tr key={unit.local_id} className="border-b last:border-0">
                        <td className="py-4 pr-4">
                          <div className="font-medium">
                            {unit.serial_number ?? "Unnamed SCBA"}
                          </div>
                          <div className="text-muted-foreground">
                            {unit.manufacturer ?? "Manufacturer not recorded"}
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-muted-foreground">
                          {unit.assigned_to
                            ? userNameById.get(unit.assigned_to) ?? "Unknown member"
                            : "Unassigned"}
                        </td>
                        <td className="py-4 pr-4 text-muted-foreground">
                          <div>{formatDate(unit.cylinder_hydro_date)}</div>
                          <div className="mt-1 text-xs">
                            {hydro.dueDate instanceof Date
                              ? `Due ${hydro.dueDate.toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}`
                              : hydro.label}
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-muted-foreground">
                          <div>{formatDate(unit.regulator_service_date)}</div>
                          <div className="mt-1 text-xs">
                            {regulator.dueDate instanceof Date
                              ? `Due ${regulator.dueDate.toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}`
                              : regulator.label}
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-xs font-medium",
                                toneClasses(tone)
                              )}
                            >
                              {toneLabel(tone)}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-xs font-medium",
                                toneClasses(hydro.tone)
                              )}
                            >
                              Hydro
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-xs font-medium",
                                toneClasses(regulator.tone)
                              )}
                            >
                              Regulator
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
