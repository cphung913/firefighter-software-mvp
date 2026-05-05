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
import { NFPA_SCHEDULES, computeNextDue } from "@/lib/equipment/nfpa";

interface Props {
  item: EquipmentRecord;
  onClose: () => void;
}

interface InspectionForm {
  inspection_type: string;
  inspection_date: string;
  passed: string;
  inspector_name: string;
  notes: string;
}

export function LogInspectionModal({ item, onClose }: Props) {
  const online = useSyncStore((s) => s.online);

  const schedules = NFPA_SCHEDULES[item.equipment_type ?? "other"] ?? NFPA_SCHEDULES.other;

  const [form, setForm] = useState<InspectionForm>({
    inspection_type: schedules[0]?.type ?? "annual",
    inspection_date: new Date().toISOString().split("T")[0],
    passed: "true",
    inspector_name: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  function set<K extends keyof InspectionForm>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const nextDue = computeNextDue(
        item.equipment_type ?? "other",
        form.inspection_type,
        form.inspection_date
      );
      await enqueueMutation({
        table: "equipment_inspections",
        operation: "upsert",
        data: {
          equipment_local_id: item.local_id,
          equipment_id: item.server_id ?? null,
          inspection_type: form.inspection_type,
          inspection_date: form.inspection_date,
          passed: form.passed === "true",
          inspector_name: form.inspector_name.trim() || null,
          notes: form.notes.trim() || null,
          next_due: nextDue,
        },
      });
      // Update parent equipment's inspection timestamps
      if (item.local_id) {
        await enqueueMutation({
          table: "equipment",
          local_id: item.local_id,
          operation: "upsert",
          data: {
            last_inspection_date: form.inspection_date,
            next_inspection_due: nextDue,
          },
        });
      }
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
            Log Inspection
          </h2>
          <button type="button" onClick={onClose} className="text-[#4a4842] hover:text-[var(--ink)] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="insp-type">Inspection type</Label>
            <select
              id="insp-type"
              value={form.inspection_type}
              onChange={(e) => set("inspection_type", e.target.value)}
              className="h-11 w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2 font-body text-[15px] text-[var(--ink)] focus:outline-none focus:border-b-[var(--signal)]"
            >
              {schedules.map((s) => (
                <option key={s.type} value={s.type}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="insp-date">Date</Label>
              <Input
                id="insp-date"
                type="date"
                required
                value={form.inspection_date}
                onChange={(e) => set("inspection_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insp-result">Result</Label>
              <select
                id="insp-result"
                value={form.passed}
                onChange={(e) => set("passed", e.target.value)}
                className="h-11 w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2 font-body text-[15px] text-[var(--ink)] focus:outline-none focus:border-b-[var(--signal)]"
              >
                <option value="true">Passed</option>
                <option value="false">Failed</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="insp-inspector">Inspector name</Label>
            <Input
              id="insp-inspector"
              placeholder="Optional"
              value={form.inspector_name}
              onChange={(e) => set("inspector_name", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="insp-notes">Notes</Label>
            <Input
              id="insp-notes"
              placeholder="Optional"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-[#d6cfbf] pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="text-[#4a4842]">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : "Save inspection"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
