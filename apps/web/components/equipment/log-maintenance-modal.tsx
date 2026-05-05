"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EquipmentRecord } from "@/lib/db";
import { enqueueMutation } from "@/lib/sync/mutations";
import { runSync } from "@/lib/sync/engine";
import { useSyncStore } from "@/store/sync-store";

interface Props {
  item: EquipmentRecord;
  onClose: () => void;
}

interface MaintenanceForm {
  maintenance_type: string;
  maintenance_date: string;
  performed_by: string;
  cost: string;
  description: string;
  out_of_service_start: string;
  out_of_service_end: string;
}

const MAINTENANCE_TYPES = [
  { value: "repair",      label: "Repair" },
  { value: "service",     label: "Service" },
  { value: "replacement", label: "Replacement" },
  { value: "hydro_test",  label: "Hydro Test" },
  { value: "retirement",  label: "Retirement" },
];

export function LogMaintenanceModal({ item, onClose }: Props) {
  const online = useSyncStore((s) => s.online);

  const [form, setForm] = useState<MaintenanceForm>({
    maintenance_type: "service",
    maintenance_date: new Date().toISOString().split("T")[0],
    performed_by: "",
    cost: "",
    description: "",
    out_of_service_start: "",
    out_of_service_end: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  function set<K extends keyof MaintenanceForm>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await enqueueMutation({
        table: "equipment_maintenance",
        operation: "upsert",
        data: {
          equipment_local_id: item.local_id,
          equipment_id: item.server_id ?? null,
          maintenance_type: form.maintenance_type,
          maintenance_date: form.maintenance_date,
          performed_by: form.performed_by.trim() || null,
          cost: form.cost ? parseFloat(form.cost) : null,
          description: form.description.trim() || null,
          out_of_service_start: form.out_of_service_start || null,
          out_of_service_end: form.out_of_service_end || null,
        },
      });
      if (online) void runSync();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-[var(--bone)] border border-[#d6cfbf] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#d6cfbf] px-5 py-4 sticky top-0 bg-[var(--bone)]">
          <h2 className="font-display text-[18px] uppercase tracking-[0.04em] font-medium text-[var(--ink)]">
            Log Maintenance
          </h2>
          <button type="button" onClick={onClose} className="text-[#4a4842] hover:text-[var(--ink)] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maint-type">Type</Label>
              <select
                id="maint-type"
                value={form.maintenance_type}
                onChange={(e) => set("maintenance_type", e.target.value)}
                className="h-11 w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2 font-body text-[15px] text-[var(--ink)] focus:outline-none focus:border-b-[var(--signal)]"
              >
                {MAINTENANCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maint-date">Date</Label>
              <Input
                id="maint-date"
                type="date"
                required
                value={form.maintenance_date}
                onChange={(e) => set("maintenance_date", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maint-by">Performed by</Label>
              <Input
                id="maint-by"
                placeholder="Name or vendor"
                value={form.performed_by}
                onChange={(e) => set("performed_by", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maint-cost">Cost ($)</Label>
              <Input
                id="maint-cost"
                inputMode="decimal"
                placeholder="0.00"
                value={form.cost}
                onChange={(e) => set("cost", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maint-desc">Description</Label>
            <Input
              id="maint-desc"
              placeholder="Optional"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maint-oos-start">Out of service start</Label>
              <Input
                id="maint-oos-start"
                type="date"
                value={form.out_of_service_start}
                onChange={(e) => set("out_of_service_start", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maint-oos-end">Out of service end</Label>
              <Input
                id="maint-oos-end"
                type="date"
                value={form.out_of_service_end}
                onChange={(e) => set("out_of_service_end", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#d6cfbf] pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="text-[#4a4842]">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : "Save maintenance"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
