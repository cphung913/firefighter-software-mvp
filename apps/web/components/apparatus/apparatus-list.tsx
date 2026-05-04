"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApparatusDetailCard } from "@/components/apparatus/apparatus-detail-card";
import { db } from "@/lib/db";
import { enqueueMutation } from "@/lib/sync/mutations";
import { runSync } from "@/lib/sync/engine";
import { useSyncStore } from "@/store/sync-store";

const APPARATUS_TYPES = ["Engine", "Ladder", "Tanker", "Rescue", "Brush", "Command", "Other"];

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "responding", label: "Responding" },
  { value: "out_of_service", label: "Out of Service" },
];

interface AddForm {
  unit_id: string;
  type: string;
  year: string;
  make: string;
  model: string;
  vin: string;
  mileage: string;
  service_status: string;
}

function blankForm(): AddForm {
  return {
    unit_id: "",
    type: "",
    year: "",
    make: "",
    model: "",
    vin: "",
    mileage: "",
    service_status: "available",
  };
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ApparatusList() {
  const online = useSyncStore((s) => s.online);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const syncStatus = useSyncStore((s) => s.status);
  const isSyncing = syncStatus === "syncing";

  const apparatus = useLiveQuery(
    () => db.apparatus.orderBy("unit_id").toArray(),
    []
  );

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<AddForm>(blankForm);
  const [unitIdError, setUnitIdError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function openModal() {
    setForm(blankForm());
    setUnitIdError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  function set<K extends keyof AddForm>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "unit_id") setUnitIdError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.unit_id.trim()) {
      setUnitIdError("Unit ID is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await enqueueMutation({
        table: "apparatus",
        operation: "upsert",
        data: {
          unit_id: form.unit_id.trim(),
          type: form.type || null,
          year: form.year ? Number.parseInt(form.year, 10) : null,
          make: form.make.trim() || null,
          model: form.model.trim() || null,
          vin: form.vin.trim() || null,
          mileage: form.mileage ? Number.parseInt(form.mileage, 10) : null,
          service_status: form.service_status,
        },
      });
      if (online) void runSync();
      closeModal();
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
            Apparatus
          </h1>
          <p className="font-body text-[var(--bone-dim)]">
            Fleet status and availability. Expand any unit to update its status.
          </p>
        </div>
        <Button onClick={openModal}>
          <Plus className="h-4 w-4" />
          Add unit
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

      {/* List */}
      {apparatus === undefined ? (
        <div className="flex min-h-[240px] items-center justify-center border border-[var(--rule)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bone-dim)]" />
        </div>
      ) : apparatus.length === 0 ? (
        <div className="border border-[var(--rule)] flex min-h-[240px] items-center justify-center">
          <div className="space-y-4 text-center px-6">
            <p className="font-body text-[var(--bone-dim)]">
              No apparatus registered. Add your first unit or sync to pull in existing records.
            </p>
            <Button size="sm" onClick={openModal}>
              Add first unit
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {apparatus.map((unit) => (
            <ApparatusDetailCard
              key={unit.local_id}
              unit={unit}
              isOffline={!online}
            />
          ))}
        </div>
      )}

      {/* Add unit modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-md bg-[var(--bone)] border border-[#d6cfbf]">
            <div className="flex items-center justify-between border-b border-[#d6cfbf] px-5 py-4">
              <h2 className="font-display text-[18px] uppercase tracking-[0.04em] font-medium text-[var(--ink)]">
                Add unit
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-[#4a4842] hover:text-[var(--ink)] transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-unit-id">
                  Unit ID <span className="text-[var(--signal)]">*</span>
                </Label>
                <Input
                  id="add-unit-id"
                  placeholder="e.g. Engine 5"
                  value={form.unit_id}
                  onChange={(e) => set("unit_id", e.target.value)}
                  aria-invalid={!!unitIdError}
                />
                {unitIdError && (
                  <p className="font-body text-[13px] text-[var(--signal)]">{unitIdError}</p>
                )}
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="add-type">Type</Label>
                  <select
                    id="add-type"
                    value={form.type}
                    onChange={(e) => set("type", e.target.value)}
                    className="h-11 w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2 font-body text-[15px] text-[var(--ink)] focus:outline-none focus:border-b-[var(--signal)]"
                  >
                    <option value="">Select type</option>
                    {APPARATUS_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-year">Year</Label>
                  <Input
                    id="add-year"
                    inputMode="numeric"
                    placeholder="e.g. 2022"
                    value={form.year}
                    onChange={(e) => set("year", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="add-make">Make</Label>
                  <Input
                    id="add-make"
                    placeholder="e.g. Pierce"
                    value={form.make}
                    onChange={(e) => set("make", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-model">Model</Label>
                  <Input
                    id="add-model"
                    placeholder="e.g. Enforcer"
                    value={form.model}
                    onChange={(e) => set("model", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-vin">VIN</Label>
                <Input
                  id="add-vin"
                  placeholder="Vehicle identification number"
                  value={form.vin}
                  onChange={(e) => set("vin", e.target.value)}
                />
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="add-mileage">Mileage</Label>
                  <Input
                    id="add-mileage"
                    inputMode="numeric"
                    placeholder="e.g. 18420"
                    value={form.mileage}
                    onChange={(e) => set("mileage", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-status">Initial status</Label>
                  <select
                    id="add-status"
                    value={form.service_status}
                    onChange={(e) => set("service_status", e.target.value)}
                    className="h-11 w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2 font-body text-[15px] text-[var(--ink)] focus:outline-none focus:border-b-[var(--signal)]"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#d6cfbf] pt-4">
                <Button type="button" variant="ghost" onClick={closeModal} className="text-[#4a4842]">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
                  ) : (
                    "Save unit"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
