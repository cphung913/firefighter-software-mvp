"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EquipmentDetailCard } from "@/components/equipment/equipment-detail-card";
import { db } from "@/lib/db";
import { enqueueMutation } from "@/lib/sync/mutations";
import { runSync } from "@/lib/sync/engine";
import { useSyncStore } from "@/store/sync-store";
import { EQUIPMENT_TYPES, EQUIPMENT_TYPE_LABEL } from "@/lib/equipment/nfpa";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "in_service",    label: "In Service" },
  { value: "out_of_service", label: "Out of Service" },
  { value: "retired",        label: "Retired" },
];

interface AddForm {
  equipment_type: string;
  identifier: string;
  name: string;
  manufacturer: string;
  model: string;
  year_manufactured: string;
  status: string;
  purchase_date: string;
  notes: string;
}

function blankForm(): AddForm {
  return {
    equipment_type: "other",
    identifier: "",
    name: "",
    manufacturer: "",
    model: "",
    year_manufactured: "",
    status: "in_service",
    purchase_date: "",
    notes: "",
  };
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const TYPE_FILTERS = ["all", ...EQUIPMENT_TYPES];

export function EquipmentList() {
  const online = useSyncStore((s) => s.online);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const syncStatus = useSyncStore((s) => s.status);
  const isSyncing = syncStatus === "syncing";

  const [typeFilter, setTypeFilter] = useState("all");

  const equipment = useLiveQuery(
    () =>
      typeFilter === "all"
        ? db.equipment.orderBy("name").toArray()
        : db.equipment.where("equipment_type").equals(typeFilter).sortBy("name"),
    [typeFilter]
  );

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<AddForm>(blankForm);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function set<K extends keyof AddForm>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "name") setNameError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() && !form.identifier.trim()) {
      setNameError("Enter a name or identifier.");
      return;
    }
    setIsSubmitting(true);
    try {
      await enqueueMutation({
        table: "equipment",
        operation: "upsert",
        data: {
          equipment_type: form.equipment_type,
          identifier:     form.identifier.trim() || null,
          name:           form.name.trim() || null,
          manufacturer:   form.manufacturer.trim() || null,
          model:          form.model.trim() || null,
          year_manufactured: form.year_manufactured ? Number.parseInt(form.year_manufactured, 10) : null,
          status:         form.status,
          purchase_date:  form.purchase_date || null,
          notes:          form.notes.trim() || null,
        },
      });
      if (online) void runSync();
      setShowModal(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-[clamp(28px,4vw,40px)] uppercase tracking-[-0.005em] font-medium text-[var(--bone)]">
            Equipment
          </h1>
          <p className="font-body text-[var(--bone-dim)]">
            Inventory, NFPA inspection schedules, and maintenance history.
          </p>
        </div>
        <Button onClick={() => { setForm(blankForm()); setNameError(null); setShowModal(true); }}>
          <Plus className="h-4 w-4" />
          Add equipment
        </Button>
      </div>

      {/* Sync status bar */}
      <div className="flex flex-wrap gap-2">
        <span className="border border-[var(--rule)] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">
          {pendingCount} pending sync
        </span>
        <span className="border border-[var(--rule)] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">
          {lastSyncAt ? `Last sync ${formatTimestamp(lastSyncAt)}` : "Waiting for first sync"}
        </span>
        {!online && (
          <span className="border border-[var(--amber)] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--amber)]">
            Offline — local data
          </span>
        )}
        {isSyncing && (
          <span className="flex items-center gap-1.5 border border-[var(--rule)] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--bone-dim)]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Syncing
          </span>
        )}
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={cn(
              "px-3 py-1 border font-mono text-[10.5px] uppercase tracking-[0.14em] transition-colors",
              typeFilter === t
                ? "border-[var(--bone)] text-[var(--bone)] bg-[var(--bone)]/10"
                : "border-[var(--rule)] text-[var(--bone-dim)] hover:border-[var(--bone-dim)] hover:text-[var(--bone)]"
            )}
          >
            {t === "all" ? "All" : EQUIPMENT_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* List */}
      {equipment === undefined ? (
        <div className="flex min-h-[240px] items-center justify-center border border-[var(--rule)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bone-dim)]" />
        </div>
      ) : equipment.length === 0 ? (
        <div className="border border-[var(--rule)] flex min-h-[240px] items-center justify-center">
          <div className="space-y-4 text-center px-6">
            <p className="font-body text-[var(--bone-dim)]">
              {typeFilter === "all"
                ? "No equipment registered. Add your first item."
                : `No ${EQUIPMENT_TYPE_LABEL[typeFilter] ?? typeFilter} equipment registered.`}
            </p>
            <Button size="sm" onClick={() => { setForm({ ...blankForm(), equipment_type: typeFilter === "all" ? "other" : typeFilter }); setNameError(null); setShowModal(true); }}>
              Add equipment
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {equipment.map((item) => (
            <EquipmentDetailCard key={item.local_id} item={item} isOffline={!online} />
          ))}
        </div>
      )}

      {/* Add equipment modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-md bg-[var(--bone)] border border-[#d6cfbf] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#d6cfbf] px-5 py-4 sticky top-0 bg-[var(--bone)]">
              <h2 className="font-display text-[18px] uppercase tracking-[0.04em] font-medium text-[var(--ink)]">
                Add equipment
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-[#4a4842] hover:text-[var(--ink)] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="eq-type">Type</Label>
                <select
                  id="eq-type"
                  value={form.equipment_type}
                  onChange={(e) => set("equipment_type", e.target.value)}
                  className="h-11 w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2 font-body text-[15px] text-[var(--ink)] focus:outline-none focus:border-b-[var(--signal)]"
                >
                  {EQUIPMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{EQUIPMENT_TYPE_LABEL[t]}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eq-name">
                    Name <span className="text-[var(--signal)]">*</span>
                  </Label>
                  <Input
                    id="eq-name"
                    placeholder="e.g. SCBA Unit 4"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    aria-invalid={!!nameError}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-id">Identifier / Serial</Label>
                  <Input
                    id="eq-id"
                    placeholder="Tag or serial #"
                    value={form.identifier}
                    onChange={(e) => set("identifier", e.target.value)}
                  />
                </div>
              </div>
              {nameError && <p className="font-body text-[13px] text-[var(--signal)]">{nameError}</p>}

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eq-make">Manufacturer</Label>
                  <Input id="eq-make" placeholder="e.g. Scott" value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-model">Model</Label>
                  <Input id="eq-model" placeholder="e.g. AP50" value={form.model} onChange={(e) => set("model", e.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eq-year">Year</Label>
                  <Input id="eq-year" inputMode="numeric" placeholder="e.g. 2020" value={form.year_manufactured} onChange={(e) => set("year_manufactured", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-status">Status</Label>
                  <select
                    id="eq-status"
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                    className="h-11 w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2 font-body text-[15px] text-[var(--ink)] focus:outline-none focus:border-b-[var(--signal)]"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="eq-purchase">Purchase date</Label>
                <Input id="eq-purchase" type="date" value={form.purchase_date} onChange={(e) => set("purchase_date", e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="eq-notes">Notes</Label>
                <Input id="eq-notes" placeholder="Optional notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>

              <div className="flex justify-end gap-3 border-t border-[#d6cfbf] pt-4">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)} className="text-[#4a4842]">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : "Save equipment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
