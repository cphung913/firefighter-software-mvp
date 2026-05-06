"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Loader2,
  Plus,
  Search,
  Users,
  X,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import {
  createCertification,
  createDrill,
  getDrill,
  getISOReport,
  listCertifications,
  listDrills,
  updateCertification,
} from "@/lib/training/api";
import type { Certification, CertificationCreate, ISOReport, TrainingDrill, TrainingDrillCreate } from "@vfd/shared-types";

// ─── Constants ─────────────────────────────────────────────────────────────────

type Tab = "drills" | "certifications" | "iso";

const DRILL_TYPE_OPTIONS = [
  "Live Fire",
  "Hazmat",
  "EMS",
  "Truck Ops",
  "Multi-Company",
  "Pump Ops",
  "Rescue",
  "Other",
] as const;

const CERT_TYPES = [
  "EMT-B",
  "EMT-P",
  "CPR",
  "FF1",
  "FF2",
  "Hazmat Ops",
  "Driver/Operator",
  "Fit Test",
] as const;

const CERT_STATUS_OPTIONS = ["active", "expired", "renewed"] as const;

const ISO_YEARS = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

const DRILL_TYPE_COLORS: Record<string, string> = {
  "Live Fire":      "text-[var(--signal)] border-[rgba(220,50,50,0.35)] bg-[rgba(220,50,50,0.08)]",
  "Hazmat":         "text-[var(--amber)] border-[rgba(232,161,58,0.35)] bg-[rgba(232,161,58,0.08)]",
  "EMS":            "text-[var(--blue)] border-[rgba(74,143,181,0.35)] bg-[rgba(74,143,181,0.08)]",
  "Truck Ops":      "text-green-400 border-[rgba(74,222,128,0.35)] bg-[rgba(74,222,128,0.08)]",
  "Multi-Company":  "text-purple-400 border-[rgba(192,132,252,0.35)] bg-[rgba(192,132,252,0.08)]",
  "Pump Ops":       "text-[var(--bone-dim)] border-[var(--rule)] bg-[rgba(243,238,229,0.05)]",
  "Rescue":         "text-[var(--amber)] border-[rgba(232,161,58,0.35)] bg-[rgba(232,161,58,0.08)]",
  "Other":          "text-[var(--bone-dim)] border-[var(--rule)] bg-[rgba(243,238,229,0.05)]",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  const parts = s.substring(0, 10).split("-");
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function certExpStatus(expiry: string): "active" | "expiring_soon" | "expired" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry);
  const diffDays = (exp.getTime() - today.getTime()) / 86400000;
  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "expiring_soon";
  return "active";
}

function currentYear(): number {
  return new Date().getFullYear();
}

function currentYearStr(): string {
  return String(currentYear());
}

function currentMonthPrefix(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nowLocalDatetime(): string {
  const now = new Date();
  return (
    `${now.getFullYear()}-` +
    `${String(now.getMonth() + 1).padStart(2, "0")}-` +
    `${String(now.getDate()).padStart(2, "0")}T` +
    `${String(now.getHours()).padStart(2, "0")}:` +
    `${String(now.getMinutes()).padStart(2, "0")}`
  );
}

const INPUT_CLS =
  "h-10 w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2 font-body text-[14px] text-[var(--ink)] focus:outline-none focus:border-b-[var(--signal)] placeholder:text-[#9a9893]";
const SELECT_CLS =
  "h-10 w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2 font-body text-[14px] text-[var(--ink)] focus:outline-none focus:border-b-[var(--signal)]";

// ─── Error banner ──────────────────────────────────────────────────────────────

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 border border-[rgba(220,50,50,0.3)] bg-[rgba(220,50,50,0.08)] px-3 py-2">
      <AlertTriangle className="h-4 w-4 text-[var(--signal)] shrink-0" />
      <p className="font-body text-[13px] text-[var(--signal)]">{msg}</p>
    </div>
  );
}

// ─── Log Drill Modal ───────────────────────────────────────────────────────────

interface DrillForm {
  title: string;
  drill_type: string;
  drill_date: string;
  hours: string;
  location: string;
  instructor: string;
  iso_category: string;
  description: string;
}

function blankDrillForm(): DrillForm {
  return {
    title: "",
    drill_type: "Live Fire",
    drill_date: nowLocalDatetime(),
    hours: "1",
    location: "",
    instructor: "",
    iso_category: "",
    description: "",
  };
}

function LogDrillModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (drill: TrainingDrill) => void;
}) {
  const [form, setForm] = useState<DrillForm>(blankDrillForm());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deptUsers = useLiveQuery(() => db.department_users.orderBy("name").toArray(), []);
  const users = deptUsers ?? [];

  function setField<K extends keyof DrillForm>(k: K, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function toggleUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(users.map((u) => u.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!form.drill_date) {
      setError("Date is required.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const payload: TrainingDrillCreate = {
        drill_type: form.drill_type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        drill_date: new Date(form.drill_date).toISOString(),
        hours: parseFloat(form.hours) || 1,
        instructor: form.instructor.trim() || null,
        location: form.location.trim() || null,
        iso_category: form.iso_category.trim() || null,
        attendee_ids: Array.from(selectedIds),
      };
      const drill = await createDrill(payload);
      onCreated(drill);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create drill.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-[var(--bone)] border border-[#d6cfbf] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#d6cfbf] px-5 py-4 sticky top-0 bg-[var(--bone)] z-10">
          <h2 className="font-display text-[18px] uppercase tracking-[0.04em] font-medium text-[var(--ink)]">
            Log Drill
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#4a4842] hover:text-[var(--ink)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <ErrorBanner msg={error} />}

          <div className="space-y-1.5">
            <Label htmlFor="drill-title">
              Title <span className="text-[var(--signal)]">*</span>
            </Label>
            <input
              id="drill-title"
              className={INPUT_CLS}
              placeholder="e.g. Structure Fire Evolution"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="drill-type">Drill Type</Label>
              <select
                id="drill-type"
                className={SELECT_CLS}
                value={form.drill_type}
                onChange={(e) => setField("drill_type", e.target.value)}
              >
                {DRILL_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="drill-hours">Hours</Label>
              <input
                id="drill-hours"
                type="number"
                step="0.5"
                min="0.5"
                className={INPUT_CLS}
                value={form.hours}
                onChange={(e) => setField("hours", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="drill-date">
              Date &amp; Time <span className="text-[var(--signal)]">*</span>
            </Label>
            <input
              id="drill-date"
              type="datetime-local"
              className={INPUT_CLS}
              value={form.drill_date}
              onChange={(e) => setField("drill_date", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="drill-location">Location</Label>
              <input
                id="drill-location"
                className={INPUT_CLS}
                placeholder="Optional"
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="drill-instructor">Instructor</Label>
              <input
                id="drill-instructor"
                className={INPUT_CLS}
                placeholder="Optional"
                value={form.instructor}
                onChange={(e) => setField("instructor", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="drill-iso">ISO Category</Label>
            <input
              id="drill-iso"
              className={INPUT_CLS}
              placeholder="Optional — e.g. 3B (Advanced)"
              value={form.iso_category}
              onChange={(e) => setField("iso_category", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Attendees{" "}
                <span className="text-[#7a786f] font-normal">({selectedIds.size} selected)</span>
              </Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={selectAll}
                  className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--signal)] hover:underline"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#4a4842] hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto border border-[#d6cfbf] divide-y divide-[#e8e4db]">
              {users.length === 0 ? (
                <p className="px-3 py-4 font-mono text-[11px] tracking-[0.1em] uppercase text-[#9a9893] text-center">
                  No members loaded
                </p>
              ) : (
                users.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[rgba(0,0,0,0.03)] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="accent-[var(--signal)]"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-body text-[14px] text-[var(--ink)] block truncate">
                        {u.name}
                      </span>
                      {u.badge_number && (
                        <span className="font-mono text-[10.5px] text-[#9a9893] uppercase tracking-[0.1em]">
                          #{u.badge_number}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-[#9a9893] uppercase tracking-[0.1em] shrink-0">
                      {u.role}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#d6cfbf] pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="text-[#4a4842]">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Saving...
                </>
              ) : (
                "Log Drill"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Certification Modal ───────────────────────────────────────────────────────

interface CertForm {
  user_id: string;
  cert_type: string;
  cert_number: string;
  issuing_body: string;
  issued_date: string;
  expiry_date: string;
  status: string;
}

function blankCertForm(userId?: string, certType?: string): CertForm {
  return {
    user_id: userId ?? "",
    cert_type: certType ?? CERT_TYPES[0],
    cert_number: "",
    issuing_body: "",
    issued_date: "",
    expiry_date: "",
    status: "active",
  };
}

function certFromExisting(c: Certification): CertForm {
  return {
    user_id: c.user_id,
    cert_type: c.cert_type,
    cert_number: c.cert_number ?? "",
    issuing_body: c.issuing_body ?? "",
    issued_date: c.issued_date ?? "",
    expiry_date: c.expiry_date ?? "",
    status: c.status ?? "active",
  };
}

function CertModal({
  editingCert,
  prefillUserId,
  prefillCertType,
  onClose,
  onSaved,
}: {
  editingCert: Certification | null;
  prefillUserId?: string;
  prefillCertType?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CertForm>(
    editingCert
      ? certFromExisting(editingCert)
      : blankCertForm(prefillUserId, prefillCertType),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deptUsers = useLiveQuery(() => db.department_users.orderBy("name").toArray(), []);
  const users = deptUsers ?? [];

  function setField<K extends keyof CertForm>(k: K, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.user_id) {
      setError("Member is required.");
      return;
    }
    if (!form.expiry_date) {
      setError("Expiry date is required.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const payload: CertificationCreate = {
        user_id: form.user_id,
        cert_type: form.cert_type,
        cert_number: form.cert_number.trim() || null,
        issuing_body: form.issuing_body.trim() || null,
        issued_date: form.issued_date,
        expiry_date: form.expiry_date,
        status: form.status,
      };
      if (editingCert) {
        await updateCertification(editingCert.id, payload);
      } else {
        await createCertification(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save certification.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-[var(--bone)] border border-[#d6cfbf] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#d6cfbf] px-5 py-4 sticky top-0 bg-[var(--bone)] z-10">
          <h2 className="font-display text-[18px] uppercase tracking-[0.04em] font-medium text-[var(--ink)]">
            {editingCert ? "Edit Certification" : "Add Certification"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#4a4842] hover:text-[var(--ink)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <ErrorBanner msg={error} />}

          <div className="space-y-1.5">
            <Label htmlFor="cert-member">
              Member <span className="text-[var(--signal)]">*</span>
            </Label>
            <select
              id="cert-member"
              className={SELECT_CLS}
              value={form.user_id}
              onChange={(e) => setField("user_id", e.target.value)}
              disabled={!!editingCert}
            >
              <option value="">Select member...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.badge_number ? ` (#${u.badge_number})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cert-type">Certification Type</Label>
            <select
              id="cert-type"
              className={SELECT_CLS}
              value={form.cert_type}
              onChange={(e) => setField("cert_type", e.target.value)}
            >
              {CERT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cert-number">Cert Number</Label>
              <input
                id="cert-number"
                className={INPUT_CLS}
                placeholder="Optional"
                value={form.cert_number}
                onChange={(e) => setField("cert_number", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert-issuer">Issuing Body</Label>
              <input
                id="cert-issuer"
                className={INPUT_CLS}
                placeholder="Optional"
                value={form.issuing_body}
                onChange={(e) => setField("issuing_body", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cert-issued">Issued Date</Label>
              <input
                id="cert-issued"
                type="date"
                className={INPUT_CLS}
                value={form.issued_date}
                onChange={(e) => setField("issued_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert-expiry">
                Expiry Date <span className="text-[var(--signal)]">*</span>
              </Label>
              <input
                id="cert-expiry"
                type="date"
                className={INPUT_CLS}
                value={form.expiry_date}
                onChange={(e) => setField("expiry_date", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cert-status">Status</Label>
            <select
              id="cert-status"
              className={SELECT_CLS}
              value={form.status}
              onChange={(e) => setField("status", e.target.value)}
            >
              {CERT_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#d6cfbf] pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="text-[#4a4842]">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Saving...
                </>
              ) : editingCert ? (
                "Update"
              ) : (
                "Add Certification"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Drills Tab ────────────────────────────────────────────────────────────────

function DrillsTab({ isOfficer }: { isOfficer: boolean }) {
  const [drills, setDrills] = useState<TrainingDrill[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDrill, setExpandedDrill] = useState<TrainingDrill | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchDrills = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await listDrills();
      setDrills(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load drills.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDrills();
  }, [fetchDrills]);

  async function handleExpand(drill: TrainingDrill) {
    if (expandedId === drill.id) {
      setExpandedId(null);
      setExpandedDrill(null);
      return;
    }
    setExpandedId(drill.id);
    setExpandedDrill(null);
    if (drill.attendees) {
      setExpandedDrill(drill);
    } else {
      setLoadingDetail(true);
      try {
        const full = await getDrill(drill.id);
        setExpandedDrill(full);
      } catch {
        setExpandedDrill(drill);
      } finally {
        setLoadingDetail(false);
      }
    }
  }

  const yearStr = currentYearStr();
  const monthPrefix = currentMonthPrefix();

  const ytdDrills = drills.filter((d) => d.drill_date.startsWith(yearStr));
  const totalDrillsYTD = ytdDrills.length;
  const totalHoursYTD = ytdDrills.reduce((s, d) => s + d.hours, 0);
  const attendeesThisMonth = drills
    .filter((d) => d.drill_date.startsWith(monthPrefix))
    .reduce((s, d) => s + d.attendee_count, 0);

  const filtered = useMemo(() => {
    let list = drills;
    if (typeFilter !== "All") list = list.filter((d) => d.drill_type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.title.toLowerCase().includes(q));
    }
    return list;
  }, [drills, typeFilter, search]);

  return (
    <div className="space-y-5">
      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Drills YTD",
            value: String(totalDrillsYTD),
            icon: <BookOpen className="h-4 w-4" />,
            color: "var(--bone)",
          },
          {
            label: "Hours YTD",
            value: totalHoursYTD.toFixed(1),
            icon: <Clock className="h-4 w-4" />,
            color: "var(--amber)",
          },
          {
            label: "Attendees This Month",
            value: String(attendeesThisMonth),
            icon: <Users className="h-4 w-4" />,
            color: "var(--blue)",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="relative flex flex-col gap-2 px-4 py-3"
            style={{ background: "var(--steel)", border: "1px solid var(--rule-2)" }}
          >
            <div className="flex items-center gap-2" style={{ color: "#7a786f" }}>
              {stat.icon}
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em]">
                {stat.label}
              </span>
            </div>
            <span
              className="font-display font-semibold text-[28px] leading-none tracking-[0.02em]"
              style={{ color: stat.color, fontVariantNumeric: "tabular-nums" }}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Filter + Action Bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#7a786f] pointer-events-none" />
            <input
              placeholder="Search drills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 pr-3 bg-transparent border border-[var(--rule-2)] font-body text-[13.5px] text-[var(--bone)] placeholder:text-[#7a786f] focus:outline-none focus:border-[var(--bone-dim)] transition-colors w-52"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 px-3 bg-transparent border border-[var(--rule-2)] font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--bone-dim)] focus:outline-none focus:border-[var(--bone-dim)] transition-colors cursor-pointer"
          >
            {["All", ...DRILL_TYPE_OPTIONS].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        {isOfficer && (
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Log Drill
          </Button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center border border-[var(--rule-2)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bone-dim)]" />
        </div>
      ) : fetchError ? (
        <div className="flex min-h-[200px] items-center justify-center border border-[var(--rule-2)]">
          <div className="text-center space-y-3 px-6">
            <AlertTriangle className="h-5 w-5 text-[var(--signal)] mx-auto" />
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--bone-dim)]">
              {fetchError}
            </p>
            <Button size="sm" variant="outline" onClick={() => void fetchDrills()}>
              Retry
            </Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center border border-[var(--rule-2)]">
          <div className="text-center space-y-3 px-6">
            <BookOpen className="h-8 w-8 text-[#7a786f] mx-auto" />
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--bone-dim)]">
              {drills.length === 0 ? "No drills logged yet" : "No drills match the current filter"}
            </p>
            {isOfficer && drills.length === 0 && (
              <Button size="sm" onClick={() => setShowModal(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Log First Drill
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((drill) => {
            const isExpanded = expandedId === drill.id;
            const typeCls =
              DRILL_TYPE_COLORS[drill.drill_type] ??
              "text-[var(--bone-dim)] border-[var(--rule)] bg-[rgba(243,238,229,0.05)]";

            return (
              <div
                key={drill.id}
                style={{
                  border: "1px solid var(--rule-2)",
                  background: isExpanded ? "var(--steel)" : "transparent",
                }}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => void handleExpand(drill)}
                >
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-[#7a786f] transition-transform duration-200 shrink-0",
                        isExpanded ? "" : "-rotate-90",
                      )}
                    />
                    <span className="font-mono text-[11.5px] tracking-[0.05em] text-[var(--bone-dim)] whitespace-nowrap shrink-0">
                      {fmtDate(drill.drill_date)}
                    </span>
                    <span className="font-display font-medium text-[14.5px] tracking-[0.02em] text-[var(--bone)] flex-1 min-w-0 truncate">
                      {drill.title}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "inline-flex items-center border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em]",
                          typeCls,
                        )}
                      >
                        {drill.drill_type}
                      </span>
                      <span className="inline-flex items-center gap-1 border border-[var(--rule-2)] px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--bone-dim)]">
                        <Clock className="h-3 w-3" />
                        {drill.hours.toFixed(1)} hrs
                      </span>
                      <span className="inline-flex items-center gap-1 border border-[var(--rule-2)] px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--bone-dim)]">
                        <Users className="h-3 w-3" />
                        {drill.attendee_count} members
                      </span>
                      {drill.iso_category && (
                        <span className="inline-flex items-center border border-[rgba(74,143,181,0.35)] bg-[rgba(74,143,181,0.08)] px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--blue)]">
                          ISO: {drill.iso_category}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div
                    className="border-t border-[var(--rule)] px-5 py-4 space-y-4"
                    style={{ background: "rgba(0,0,0,0.12)" }}
                  >
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      {drill.location && (
                        <div>
                          <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#7a786f] mb-0.5">
                            Location
                          </p>
                          <p className="font-body text-[13px] text-[var(--bone-dim)]">
                            {drill.location}
                          </p>
                        </div>
                      )}
                      {drill.instructor && (
                        <div>
                          <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#7a786f] mb-0.5">
                            Instructor
                          </p>
                          <p className="font-body text-[13px] text-[var(--bone-dim)]">
                            {drill.instructor}
                          </p>
                        </div>
                      )}
                    </div>
                    {drill.description && (
                      <p className="font-body text-[13px] text-[var(--bone-dim)]">
                        {drill.description}
                      </p>
                    )}
                    <div className="space-y-2">
                      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#7a786f]">
                        Attendees
                      </p>
                      {loadingDetail ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[var(--bone-dim)]" />
                      ) : expandedDrill?.attendees && expandedDrill.attendees.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {expandedDrill.attendees.map((a) => (
                            <span
                              key={a.id}
                              className="inline-flex items-center gap-1.5 border border-[var(--rule-2)] px-2.5 py-1 font-mono text-[11px] tracking-[0.06em] text-[var(--bone-dim)]"
                            >
                              {a.name}
                              {a.badge_number && (
                                <small style={{ color: "#7a786f" }}>#{a.badge_number}</small>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="font-mono text-[11px] tracking-[0.08em] text-[#7a786f]">
                          No attendees recorded
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <LogDrillModal
          onClose={() => setShowModal(false)}
          onCreated={(drill) => {
            setDrills((prev) => [drill, ...prev]);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Certifications Tab ────────────────────────────────────────────────────────

interface CertModalState {
  editing: Certification | null;
  prefillUserId?: string;
  prefillCertType?: string;
}

function CertificationsTab({ isOfficer }: { isOfficer: boolean }) {
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [certModal, setCertModal] = useState<CertModalState | null>(null);

  const deptUsers = useLiveQuery(() => db.department_users.orderBy("name").toArray(), []);
  const users = deptUsers ?? [];

  const fetchCerts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await listCertifications();
      setCerts(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load certifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCerts();
  }, [fetchCerts]);

  const expiring = useMemo(
    () => certs.filter((c) => certExpStatus(c.expiry_date) === "expiring_soon"),
    [certs],
  );

  const certMap = useMemo(() => {
    const map = new Map<string, Map<string, Certification>>();
    for (const c of certs) {
      if (!map.has(c.user_id)) map.set(c.user_id, new Map());
      map.get(c.user_id)!.set(c.cert_type, c);
    }
    return map;
  }, [certs]);

  function getCert(userId: string, certType: string): Certification | undefined {
    return certMap.get(userId)?.get(certType);
  }

  function handleCellClick(userId: string, certType: string) {
    const existing = getCert(userId, certType);
    setCertModal({
      editing: existing ?? null,
      prefillUserId: userId,
      prefillCertType: certType,
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center border border-[var(--rule-2)]">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--bone-dim)]" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex min-h-[300px] items-center justify-center border border-[var(--rule-2)]">
        <div className="text-center space-y-3 px-6">
          <AlertTriangle className="h-5 w-5 text-[var(--signal)] mx-auto" />
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--bone-dim)]">
            {fetchError}
          </p>
          <Button size="sm" variant="outline" onClick={() => void fetchCerts()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Expiration Alert Banner */}
      {expiring.length > 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3"
          style={{
            background: "rgba(232,161,58,0.10)",
            border: "1px solid rgba(232,161,58,0.35)",
          }}
        >
          <AlertTriangle
            className="text-[var(--amber)] shrink-0 mt-0.5"
            style={{ width: 16, height: 16 }}
          />
          <div className="space-y-1.5">
            <p className="font-display font-semibold text-[12.5px] uppercase tracking-[0.1em] text-[var(--amber)]">
              {expiring.length} certification{expiring.length > 1 ? "s" : ""} expiring within 90
              days
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {expiring.map((c) => {
                const user = users.find((u) => u.id === c.user_id);
                return (
                  <span key={c.id} className="font-mono text-[11px] tracking-[0.04em] text-[var(--amber)]">
                    {user?.name ?? "Unknown"} · {c.cert_type} — exp. {fmtDate(c.expiry_date)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#7a786f]">
          Click any cell to add or edit a certification record
        </p>
        {isOfficer && (
          <Button size="sm" onClick={() => setCertModal({ editing: null })}>
            <Plus className="h-4 w-4 mr-1" />
            Add Certification
          </Button>
        )}
      </div>

      {/* Cert Matrix */}
      {users.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center border border-[var(--rule-2)]">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--bone-dim)]">
            No department members loaded
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto" style={{ border: "1px solid var(--rule-2)" }}>
          <table className="w-full border-collapse" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-10 text-left px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#7a786f]"
                  style={{
                    background: "var(--steel)",
                    borderBottom: "1px solid var(--rule-2)",
                    borderRight: "1px solid var(--rule-2)",
                    minWidth: 160,
                  }}
                >
                  Member
                </th>
                {CERT_TYPES.map((ct) => (
                  <th
                    key={ct}
                    className="px-2 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#7a786f] text-center"
                    style={{
                      background: "var(--steel)",
                      borderBottom: "1px solid var(--rule-2)",
                      whiteSpace: "nowrap",
                      minWidth: 86,
                    }}
                  >
                    {ct}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, rowIdx) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom:
                      rowIdx < users.length - 1 ? "1px solid var(--rule)" : undefined,
                  }}
                >
                  <td
                    className="sticky left-0 z-10 px-3 py-2.5"
                    style={{
                      background: "var(--ink)",
                      borderRight: "1px solid var(--rule-2)",
                    }}
                  >
                    <p className="font-mono text-[12px] tracking-[0.04em] text-[var(--bone)] truncate max-w-[148px]">
                      {user.name}
                    </p>
                    {user.badge_number && (
                      <p className="font-mono text-[9.5px] tracking-[0.1em] uppercase text-[#7a786f]">
                        #{user.badge_number}
                      </p>
                    )}
                  </td>
                  {CERT_TYPES.map((ct) => {
                    const cert = getCert(user.id, ct);
                    if (!cert) {
                      return (
                        <td
                          key={ct}
                          className="px-2 py-2.5 text-center cursor-pointer hover:bg-[rgba(243,238,229,0.05)] transition-colors"
                          onClick={() => handleCellClick(user.id, ct)}
                        >
                          <span
                            className="font-mono text-[15px] leading-none"
                            style={{ color: "#4a4842" }}
                          >
                            —
                          </span>
                        </td>
                      );
                    }
                    const status = certExpStatus(cert.expiry_date);
                    const dateColor =
                      status === "active"
                        ? "#4ade80"
                        : status === "expiring_soon"
                          ? "var(--amber)"
                          : "var(--signal)";
                    return (
                      <td
                        key={ct}
                        className="px-2 py-2.5 text-center cursor-pointer hover:bg-[rgba(243,238,229,0.05)] transition-colors"
                        onClick={() => handleCellClick(user.id, ct)}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          {status === "active" && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                          )}
                          {status === "expiring_soon" && (
                            <Clock className="h-3.5 w-3.5 text-[var(--amber)]" />
                          )}
                          {status === "expired" && (
                            <XCircle className="h-3.5 w-3.5 text-[var(--signal)]" />
                          )}
                          <span
                            className="font-mono leading-tight"
                            style={{ fontSize: 9, color: dateColor }}
                          >
                            {fmtDate(cert.expiry_date)}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {[
          {
            icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
            label: "Active",
          },
          {
            icon: <Clock className="h-3.5 w-3.5 text-[var(--amber)]" />,
            label: "Expiring within 90d",
          },
          {
            icon: <XCircle className="h-3.5 w-3.5 text-[var(--signal)]" />,
            label: "Expired",
          },
          {
            icon: (
              <span className="font-mono text-[13px] leading-none" style={{ color: "#4a4842" }}>
                —
              </span>
            ),
            label: "Not on record",
          },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {item.icon}
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#7a786f]">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {certModal && (
        <CertModal
          editingCert={certModal.editing}
          prefillUserId={certModal.prefillUserId}
          prefillCertType={certModal.prefillCertType}
          onClose={() => setCertModal(null)}
          onSaved={() => {
            setCertModal(null);
            void fetchCerts();
          }}
        />
      )}
    </div>
  );
}

// ─── ISO Report Tab ────────────────────────────────────────────────────────────

function ISOTab() {
  const [selectedYear, setSelectedYear] = useState(currentYear());
  const [report, setReport] = useState<ISOReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const data = await getISOReport(selectedYear);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report.");
    } finally {
      setLoading(false);
    }
  }

  const maxHours = report ? Math.max(...report.categories.map((c) => c.total_hours), 1) : 1;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#7a786f]" />
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value));
              setReport(null);
            }}
            className="h-9 px-3 bg-transparent border border-[var(--rule-2)] font-mono text-[12px] uppercase tracking-[0.1em] text-[var(--bone-dim)] focus:outline-none focus:border-[var(--bone-dim)] transition-colors cursor-pointer"
          >
            {ISO_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => void handleGenerate()} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              Generating...
            </>
          ) : (
            <>
              <BarChart3 className="h-4 w-4 mr-1" />
              Generate Report
            </>
          )}
        </Button>
        {report && (
          <Button variant="outline" onClick={() => window.print()}>
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        )}
      </div>

      {error && <ErrorBanner msg={error} />}

      {!report && !loading && !error && (
        <div
          className="flex min-h-[280px] items-center justify-center"
          style={{ border: "1px solid var(--rule-2)", background: "var(--steel)" }}
        >
          <div className="text-center space-y-3">
            <BarChart3 className="h-10 w-10 text-[#7a786f] mx-auto" />
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--bone-dim)]">
              Select a year and click Generate to view the ISO training report
            </p>
          </div>
        </div>
      )}

      {loading && !report && (
        <div
          className="flex min-h-[200px] items-center justify-center"
          style={{ border: "1px solid var(--rule-2)", background: "var(--steel)" }}
        >
          <Loader2 className="h-6 w-6 animate-spin text-[var(--bone-dim)]" />
        </div>
      )}

      {report && (
        <div className="space-y-5 print:space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Total Hours",
                value: report.total_training_hours.toFixed(1),
                color: "var(--amber)",
              },
              {
                label: "Total Drills",
                value: String(report.total_drills),
                color: "var(--bone)",
              },
              {
                label: "Member Compliance",
                value: `${report.member_compliance_pct.toFixed(1)}%`,
                color:
                  report.member_compliance_pct >= 80 ? "var(--green)" : "var(--signal)",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="px-4 py-3 space-y-1.5"
                style={{ background: "var(--steel)", border: "1px solid var(--rule-2)" }}
              >
                <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#7a786f]">
                  {stat.label}
                </p>
                <p
                  className="font-display font-semibold text-[28px] leading-none tracking-[0.02em]"
                  style={{ color: stat.color, fontVariantNumeric: "tabular-nums" }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Category Table */}
          <div style={{ border: "1px solid var(--rule-2)" }}>
            <div
              className="px-4 py-3"
              style={{
                borderBottom: "1px solid var(--rule-2)",
                background: "var(--steel)",
              }}
            >
              <h3 className="font-display font-semibold text-[13px] uppercase tracking-[0.12em] text-[var(--bone)]">
                Categories — {selectedYear}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--rule-2)" }}>
                    {["Category", "Hours", "Drills", "Members Trained"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a786f]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.categories.map((cat, i) => (
                    <tr
                      key={cat.category}
                      style={{
                        borderBottom:
                          i < report.categories.length - 1
                            ? "1px solid var(--rule)"
                            : undefined,
                      }}
                    >
                      <td className="px-4 py-2.5 font-mono text-[12.5px] tracking-[0.04em] text-[var(--bone)]">
                        {cat.category}
                      </td>
                      <td
                        className="px-4 py-2.5 font-mono text-[12.5px] text-[var(--bone-dim)]"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {cat.total_hours.toFixed(1)}
                      </td>
                      <td
                        className="px-4 py-2.5 font-mono text-[12.5px] text-[var(--bone-dim)]"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {cat.drill_count}
                      </td>
                      <td
                        className="px-4 py-2.5 font-mono text-[12.5px] text-[var(--bone-dim)]"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {cat.member_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Hours by Category Bar Chart */}
          {report.categories.length > 0 && (
            <div
              className="p-4 space-y-3"
              style={{ border: "1px solid var(--rule-2)", background: "var(--steel)" }}
            >
              <div className="flex items-center gap-2 pb-2" style={{ borderBottom: "1px solid var(--rule)" }}>
                <BarChart3 className="h-4 w-4 text-[#7a786f]" />
                <h3 className="font-display font-semibold text-[13px] uppercase tracking-[0.12em] text-[var(--bone)]">
                  Hours by Category
                </h3>
              </div>
              {report.categories.map((cat) => {
                const pct = Math.round((cat.total_hours / maxHours) * 100);
                return (
                  <div
                    key={cat.category}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px 1fr 56px",
                      gap: "12px",
                      alignItems: "center",
                    }}
                  >
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--bone-dim)] truncate">
                      {cat.category}
                    </span>
                    <div
                      className="relative overflow-hidden"
                      style={{
                        height: 18,
                        background: "rgba(243,238,229,0.04)",
                        border: "1px solid var(--rule)",
                      }}
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0"
                        style={{ width: `${pct}%`, background: "var(--amber)" }}
                      >
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(90deg, transparent 0 6px, rgba(0,0,0,0.18) 6px 7px)",
                          }}
                        />
                      </div>
                    </div>
                    <span
                      className="font-mono text-[11.5px] text-right text-[var(--bone)]"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {cat.total_hours.toFixed(1)}h
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#7a786f]">
            Generated {fmtDate(report.generated_at)} · Dept {report.department_id.slice(0, 8)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── TrainingDashboard ─────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "drills", label: "Drills", icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "certifications", label: "Certifications", icon: <Award className="h-3.5 w-3.5" /> },
  { id: "iso", label: "ISO Report", icon: <BarChart3 className="h-3.5 w-3.5" /> },
];

export function TrainingDashboard() {
  const { data: session } = useSession();
  const isOfficer = ["officer", "admin"].includes(session?.role ?? "");
  const [activeTab, setActiveTab] = useState<Tab>("drills");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="font-display font-semibold uppercase leading-none text-[var(--bone)]"
          style={{ fontSize: 32, letterSpacing: "0.04em", marginBottom: 6 }}
        >
          training
        </h1>
        <p className="font-body text-[var(--bone-dim)] text-[13.5px]">
          Drills, certifications, and ISO compliance reporting.
        </p>
      </div>

      {/* Tab Row */}
      <div
        className="flex gap-0.5"
        style={{ borderBottom: "1px solid var(--rule-2)" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-b-[var(--bone)] text-[var(--bone)]"
                : "border-b-transparent text-[var(--bone-dim)] hover:text-[var(--bone)]",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "drills" && <DrillsTab isOfficer={isOfficer} />}
        {activeTab === "certifications" && <CertificationsTab isOfficer={isOfficer} />}
        {activeTab === "iso" && <ISOTab />}
      </div>
    </div>
  );
}
