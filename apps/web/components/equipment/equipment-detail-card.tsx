"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";

import type { EquipmentRecord } from "@/lib/db";
import { db } from "@/lib/db";
import { EQUIPMENT_TYPE_LABEL, NFPA_SCHEDULES, formatDate, getComplianceStatus } from "@/lib/equipment/nfpa";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogInspectionModal } from "./log-inspection-modal";
import { LogMaintenanceModal } from "./log-maintenance-modal";

interface Props {
  item: EquipmentRecord;
  isOffline: boolean;
}

type Tab = "details" | "inspections" | "maintenance";
type EquipmentStatus = "in_service" | "out_of_service" | "retired";

const STATUS_LABEL: Record<EquipmentStatus, string> = {
  in_service: "In Service",
  out_of_service: "Out of Service",
  retired: "Retired",
};

const STATUS_DOT: Record<EquipmentStatus, string> = {
  in_service: "bg-green-500",
  out_of_service: "bg-[var(--signal)]",
  retired: "bg-[var(--bone-dim)]",
};

const STATUS_TEXT: Record<EquipmentStatus, string> = {
  in_service: "text-green-400",
  out_of_service: "text-[var(--signal)]",
  retired: "text-[var(--bone-dim)]",
};

const COMPLIANCE_LABEL: Record<ReturnType<typeof getComplianceStatus>, string> = {
  ok: "OK",
  "due-soon": "Due soon",
  overdue: "Overdue",
  unknown: "No inspections",
};

const COMPLIANCE_TEXT: Record<ReturnType<typeof getComplianceStatus>, string> = {
  ok: "text-green-400",
  "due-soon": "text-[var(--amber)]",
  overdue: "text-[var(--signal)]",
  unknown: "text-[var(--bone-dim)]",
};

function normalizeStatus(value?: string | null): EquipmentStatus {
  if (value === "out_of_service" || value === "retired") return value;
  return "in_service";
}

function displayName(item: EquipmentRecord): string {
  const name = item.name?.trim();
  const identifier = item.identifier?.trim();
  if (name && identifier) return `${name} (${identifier})`;
  return name || identifier || "Unnamed equipment";
}

function inspectionTypeLabel(equipmentType: string, inspType: string): string {
  const schedules = NFPA_SCHEDULES[equipmentType] ?? [];
  return schedules.find((s) => s.type === inspType)?.label ?? inspType;
}

const MAINT_TYPE_LABEL: Record<string, string> = {
  repair: "Repair",
  service: "Service",
  replacement: "Replacement",
  hydro_test: "Hydro Test",
  retirement: "Retirement",
};

export function EquipmentDetailCard({ item, isOffline }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>("details");
  const [showInspModal, setShowInspModal] = useState(false);
  const [showMaintModal, setShowMaintModal] = useState(false);

  const status = normalizeStatus(item.status);
  const typeLabel = item.equipment_type ? (EQUIPMENT_TYPE_LABEL[item.equipment_type] ?? item.equipment_type) : "Equipment";
  const compliance = getComplianceStatus(item.next_inspection_due);

  const inspections = useLiveQuery(
    () =>
      expanded && tab === "inspections"
        ? db.equipment_inspections
            .where("equipment_local_id")
            .equals(item.local_id ?? "")
            .sortBy("inspection_date")
            .then((rows) => rows.reverse())
        : Promise.resolve([] as import("@/lib/db").EquipmentInspectionRecord[]),
    [expanded, tab, item.local_id]
  );

  const maintenance = useLiveQuery(
    () =>
      expanded && tab === "maintenance"
        ? db.equipment_maintenance
            .where("equipment_local_id")
            .equals(item.local_id ?? "")
            .sortBy("maintenance_date")
            .then((rows) => rows.reverse())
        : Promise.resolve([] as import("@/lib/db").EquipmentMaintenanceRecord[]),
    [expanded, tab, item.local_id]
  );

  const detailRows = [
    item.manufacturer ? { label: "Manufacturer", value: item.manufacturer } : null,
    item.model ? { label: "Model", value: item.model } : null,
    item.year_manufactured ? { label: "Year", value: String(item.year_manufactured) } : null,
    item.purchase_date ? { label: "Purchased", value: formatDate(item.purchase_date) } : null,
    item.next_inspection_due ? { label: "Next inspection", value: formatDate(item.next_inspection_due) } : null,
    item.last_inspection_date ? { label: "Last inspection", value: formatDate(item.last_inspection_date) } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const primarySchedule = NFPA_SCHEDULES[item.equipment_type ?? "other"]?.[0];

  return (
    <>
      <div className={cn("border border-[var(--rule)] bg-[var(--steel-2)]", isOffline && "opacity-90")}>
        {/* Row header — always visible */}
        <button
          type="button"
          className="w-full flex flex-wrap items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", STATUS_DOT[status])} />
          <div className="flex-1 min-w-0">
            <p className="truncate font-mono text-[13px] uppercase tracking-[0.14em] text-[var(--bone)]">
              {displayName(item)}
            </p>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">
              {typeLabel}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={cn("font-mono text-[10.5px] uppercase tracking-[0.14em]", STATUS_TEXT[status])}>
              {STATUS_LABEL[status]}
            </span>
            <span className={cn("font-mono text-[10px] uppercase tracking-[0.12em]", COMPLIANCE_TEXT[compliance])}>
              {COMPLIANCE_LABEL[compliance]}
            </span>
          </div>
          <span className="text-[var(--bone-dim)] ml-1">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-[var(--rule)]">
            {/* Tabs */}
            <div className="flex border-b border-[var(--rule)]">
              {(["details", "inspections", "maintenance"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] transition-colors border-b-2",
                    tab === t
                      ? "border-[var(--bone)] text-[var(--bone)]"
                      : "border-transparent text-[var(--bone-dim)] hover:text-[var(--bone)]"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Details tab */}
            {tab === "details" && (
              <div className="p-4 space-y-4">
                {detailRows.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {detailRows.map((row) => (
                      <div key={row.label}>
                        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">
                          {row.label}
                        </p>
                        <p className="font-body text-[13px] text-[var(--bone)]">{row.value}</p>
                      </div>
                    ))}
                  </div>
                )}
                {primarySchedule && (
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">
                      NFPA Standard
                    </p>
                    <p className="font-body text-[13px] text-[var(--bone)]">
                      {primarySchedule.nfpaStandard}
                    </p>
                  </div>
                )}
                {item.notes && (
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">Notes</p>
                    <p className="font-body text-[13px] text-[var(--bone)]">{item.notes}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={() => setShowInspModal(true)}>
                    Log Inspection
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowMaintModal(true)}>
                    Log Maintenance
                  </Button>
                </div>
              </div>
            )}

            {/* Inspections tab */}
            {tab === "inspections" && (
              <div className="p-4 space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setShowInspModal(true)}>
                    Log Inspection
                  </Button>
                </div>
                {!inspections ? (
                  <p className="font-mono text-[10.5px] text-[var(--bone-dim)]">Loading…</p>
                ) : inspections.length === 0 ? (
                  <p className="font-mono text-[10.5px] text-[var(--bone-dim)] uppercase tracking-[0.12em]">
                    No inspections logged yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {inspections.map((insp) => (
                      <div key={insp.local_id} className="border border-[var(--rule)] px-3 py-2 flex items-start gap-3">
                        {insp.passed
                          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400 mt-0.5" />
                          : <XCircle className="h-4 w-4 shrink-0 text-[var(--signal)] mt-0.5" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--bone)]">
                            {inspectionTypeLabel(item.equipment_type ?? "other", insp.inspection_type ?? "")}
                            {" · "}
                            {formatDate(insp.inspection_date)}
                          </p>
                          {insp.inspector_name && (
                            <p className="font-body text-[12px] text-[var(--bone-dim)]">{insp.inspector_name}</p>
                          )}
                          {insp.notes && (
                            <p className="font-body text-[12px] text-[var(--bone-dim)]">{insp.notes}</p>
                          )}
                          {insp.next_due && (
                            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bone-dim)]">
                              Next due: {formatDate(insp.next_due)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Maintenance tab */}
            {tab === "maintenance" && (
              <div className="p-4 space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setShowMaintModal(true)}>
                    Log Maintenance
                  </Button>
                </div>
                {!maintenance ? (
                  <p className="font-mono text-[10.5px] text-[var(--bone-dim)]">Loading…</p>
                ) : maintenance.length === 0 ? (
                  <p className="font-mono text-[10.5px] text-[var(--bone-dim)] uppercase tracking-[0.12em]">
                    No maintenance records yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {maintenance.map((m) => (
                      <div key={m.local_id} className="border border-[var(--rule)] px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--bone)]">
                            {MAINT_TYPE_LABEL[m.maintenance_type ?? ""] ?? m.maintenance_type}
                            {" · "}
                            {formatDate(m.maintenance_date)}
                          </p>
                          {m.cost != null && (
                            <span className="font-mono text-[11px] text-[var(--bone-dim)] shrink-0">
                              ${Number(m.cost).toFixed(2)}
                            </span>
                          )}
                        </div>
                        {m.performed_by && (
                          <p className="font-body text-[12px] text-[var(--bone-dim)]">{m.performed_by}</p>
                        )}
                        {m.description && (
                          <p className="font-body text-[12px] text-[var(--bone-dim)]">{m.description}</p>
                        )}
                        {m.out_of_service_start && (
                          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bone-dim)]">
                            OOS: {formatDate(m.out_of_service_start)}
                            {m.out_of_service_end ? ` → ${formatDate(m.out_of_service_end)}` : " (ongoing)"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showInspModal && (
        <LogInspectionModal item={item} onClose={() => setShowInspModal(false)} />
      )}
      {showMaintModal && (
        <LogMaintenanceModal item={item} onClose={() => setShowMaintModal(false)} />
      )}
    </>
  );
}
