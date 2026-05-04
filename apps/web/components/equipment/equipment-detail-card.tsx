"use client";

import type { EquipmentRecord } from "@/lib/db";
import { EQUIPMENT_TYPE_LABEL, formatDate, getComplianceStatus } from "@/lib/equipment/nfpa";
import { cn } from "@/lib/utils";

interface Props {
  item: EquipmentRecord;
  isOffline: boolean;
}

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
  unknown: "Unknown",
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

export function EquipmentDetailCard({ item, isOffline }: Props) {
  const status = normalizeStatus(item.status);
  const typeLabel = item.equipment_type ? (EQUIPMENT_TYPE_LABEL[item.equipment_type] ?? item.equipment_type) : "Equipment";
  const compliance = getComplianceStatus(item.next_inspection_due);

  const detailRows = [
    item.manufacturer ? { label: "Manufacturer", value: item.manufacturer } : null,
    item.model ? { label: "Model", value: item.model } : null,
    item.year_manufactured ? { label: "Year", value: String(item.year_manufactured) } : null,
    item.purchase_date ? { label: "Purchased", value: formatDate(item.purchase_date) } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className={cn("border border-[var(--rule)] bg-[var(--steel-2)]", isOffline && "opacity-90")}>
      <div className="flex flex-wrap items-center gap-3 p-4">
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
      </div>

      {(detailRows.length > 0 || item.notes) && (
        <div className="border-t border-[var(--rule)] px-4 py-3">
          {detailRows.length > 0 && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
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
          {item.notes && (
            <div className={cn(detailRows.length > 0 && "pt-3")}> 
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">
                Notes
              </p>
              <p className="font-body text-[13px] text-[var(--bone)]">
                {item.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
