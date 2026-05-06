"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useSession } from "next-auth/react";
import {
  Award,
  ChevronRight,
  Edit2,
  Filter,
  GraduationCap,
  Loader2,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/db";
import type { CertificationRecord } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import {
  createPersonnel,
  deleteMember,
  getMemberDetail,
  listRoster,
  updateMember,
  type MemberDetail,
  type MemberUpdateRequest,
  type RosterMember,
} from "@/lib/roster/api";

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> =
    {
      admin: {
        bg: "rgba(232,161,58,0.14)",
        color: "var(--amber, #e8a13a)",
        border: "rgba(232,161,58,0.35)",
      },
      officer: {
        bg: "rgba(74,143,181,0.14)",
        color: "var(--blue, #4a8fb5)",
        border: "rgba(74,143,181,0.35)",
      },
      member: {
        bg: "rgba(243,238,229,0.06)",
        color: "#9a9891",
        border: "rgba(243,238,229,0.12)",
      },
    };
  const s = styles[role] ?? styles.member;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 font-display font-semibold text-[10px] tracking-[0.16em] uppercase"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {role}
    </span>
  );
}

// ─── Cert status badge ────────────────────────────────────────────────────────

function CertStatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: "Active", color: "var(--green, #4ea864)", bg: "rgba(78,168,100,0.14)" },
    expiring_soon: { label: "Expiring", color: "var(--amber, #e8a13a)", bg: "rgba(232,161,58,0.14)" },
    expired: { label: "Expired", color: "var(--signal, #d94141)", bg: "rgba(217,65,65,0.14)" },
  };
  const cfg = map[status ?? ""] ?? { label: status ?? "—", color: "#9a9891", bg: "rgba(243,238,229,0.06)" };
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] uppercase"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div
      className="relative flex flex-col gap-1 px-5 py-4"
      style={{
        background: "var(--steel)",
        border: "1px solid var(--rule-2)",
        borderRadius: 2,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="font-mono text-[10px] tracking-[0.16em] uppercase"
          style={{ color: "#7a786f" }}
        >
          {label}
        </span>
        <Icon
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: accent ?? "#7a786f" }}
        />
      </div>
      <span
        className="font-display font-semibold leading-none"
        style={{
          fontSize: 28,
          color: accent ?? "var(--bone)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.02em",
        }}
      >
        {value}
      </span>
      {sub && (
        <span className="font-mono text-[10px] tracking-[0.1em]" style={{ color: "#7a786f" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ─── Add member modal ─────────────────────────────────────────────────────────

interface AddMemberModalProps {
  onClose: () => void;
  onSaved: () => void;
}

function AddMemberModal({ onClose, onSaved }: AddMemberModalProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "member",
    badge_number: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function patch(key: keyof typeof form, val: string) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createPersonnel({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        role: form.role || "member",
        badge_number: form.badge_number.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-lg rounded p-6 shadow-2xl"
        style={{ background: "var(--steel)", border: "1px solid var(--rule-2)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="font-display font-semibold uppercase tracking-[0.1em]"
              style={{ fontSize: 16, color: "var(--bone)" }}
            >
              Add member
            </h2>
            <p className="mt-0.5 font-mono text-[11px] tracking-[0.06em]" style={{ color: "#7a786f" }}>
              Create a roster entry for this department.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/8"
            aria-label="Close"
          >
            <X className="h-4 w-4" style={{ color: "#7a786f" }} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-name" className="font-mono text-[11px] tracking-[0.1em] uppercase" style={{ color: "#9a9891" }}>
              Name
            </Label>
            <Input
              id="add-name"
              value={form.name}
              onChange={(e) => patch("name", e.target.value)}
              placeholder="Alex Morgan"
              onKeyDown={(e) => e.key === "Enter" && void handleSave()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-email" className="font-mono text-[11px] tracking-[0.1em] uppercase" style={{ color: "#9a9891" }}>
              Email (optional)
            </Label>
            <Input
              id="add-email"
              type="email"
              value={form.email}
              onChange={(e) => patch("email", e.target.value)}
              placeholder="alex@example.com"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="add-role" className="font-mono text-[11px] tracking-[0.1em] uppercase" style={{ color: "#9a9891" }}>
                Role
              </Label>
              <select
                id="add-role"
                value={form.role}
                onChange={(e) => patch("role", e.target.value)}
                className="h-11 w-full px-0 py-2 text-[15px] font-body bg-transparent border-0 border-b focus-visible:outline-none"
                style={{ color: "var(--bone)", borderBottomColor: "var(--rule-strong)" }}
              >
                <option value="member">Member</option>
                <option value="officer">Officer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-badge" className="font-mono text-[11px] tracking-[0.1em] uppercase" style={{ color: "#9a9891" }}>
                Badge number
              </Label>
              <Input
                id="add-badge"
                value={form.badge_number}
                onChange={(e) => patch("badge_number", e.target.value)}
                placeholder="1024"
              />
            </div>
          </div>
        </div>

        {error && (
          <div
            className="mt-4 rounded px-4 py-3 font-mono text-[12px]"
            style={{ background: "rgba(217,65,65,0.12)", color: "var(--signal)", border: "1px solid rgba(217,65,65,0.3)" }}
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Save member
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Member detail drawer ─────────────────────────────────────────────────────

interface MemberDetailDrawerProps {
  memberId: string;
  isAdmin: boolean;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: (updated: RosterMember) => void;
}

function MemberDetailDrawer({
  memberId,
  isAdmin,
  onClose,
  onDeleted,
  onUpdated,
}: MemberDetailDrawerProps) {
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<MemberUpdateRequest>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const memberCerts = useLiveQuery(
    () =>
      detail?.id
        ? db.certifications.where("user_id").equals(detail.id).toArray()
        : Promise.resolve([] as CertificationRecord[]),
    [detail?.id]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    setDetail(null);

    getMemberDetail(memberId)
      .then((d) => {
        if (!cancelled) {
          setDetail(d);
          setEditForm({ name: d.name, email: d.email, role: d.role, badge_number: d.badge_number });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Failed to load member.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [memberId]);

  async function handleSaveEdit() {
    if (!detail) return;
    setIsSaving(true);
    setEditError(null);
    try {
      const updated = await updateMember(detail.id, editForm);
      setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update member.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!detail) return;
    setIsDeleting(true);
    try {
      await deleteMember(detail.id);
      onDeleted();
      onClose();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to delete member.");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  const certs = memberCerts ?? [];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto shadow-2xl"
        style={{ background: "var(--ink)", borderLeft: "1px solid var(--rule-2)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <span
            className="font-mono text-[10px] tracking-[0.18em] uppercase"
            style={{ color: "#7a786f" }}
          >
            Member profile
          </span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/8"
            aria-label="Close"
          >
            <X className="h-4 w-4" style={{ color: "#7a786f" }} />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#7a786f" }} />
          </div>
        ) : fetchError ? (
          <div className="px-5 py-6">
            <p
              className="font-mono text-[12px] tracking-[0.06em]"
              style={{ color: "var(--signal)" }}
            >
              {fetchError}
            </p>
          </div>
        ) : detail ? (
          <div className="flex flex-1 flex-col gap-0">
            {/* Identity section */}
            <div className="px-5 py-5" style={{ borderBottom: "1px solid var(--rule)" }}>
              {editing ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: "#7a786f" }}>
                      Name
                    </label>
                    <Input
                      value={editForm.name ?? ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: "#7a786f" }}>
                      Email
                    </label>
                    <Input
                      type="email"
                      value={editForm.email ?? ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="Email"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: "#7a786f" }}>
                        Role
                      </label>
                      <select
                        value={editForm.role ?? "member"}
                        onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                        className="h-10 w-full px-0 py-2 text-[15px] font-body bg-transparent border-0 border-b focus-visible:outline-none"
                        style={{ color: "var(--bone)", borderBottomColor: "var(--rule-strong)" }}
                      >
                        <option value="member">Member</option>
                        <option value="officer">Officer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: "#7a786f" }}>
                        Badge
                      </label>
                      <Input
                        value={editForm.badge_number ?? ""}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, badge_number: e.target.value || null }))
                        }
                        placeholder="Badge #"
                      />
                    </div>
                  </div>

                  {editError && (
                    <div
                      className="rounded px-3 py-2 font-mono text-[11px]"
                      style={{ background: "rgba(217,65,65,0.12)", color: "var(--signal)", border: "1px solid rgba(217,65,65,0.3)" }}
                    >
                      {editError}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(false);
                        setEditError(null);
                        setEditForm({
                          name: detail.name,
                          email: detail.email,
                          role: detail.role,
                          badge_number: detail.badge_number,
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => void handleSaveEdit()} disabled={isSaving}>
                      {isSaving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                      Save changes
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3
                        className="truncate font-display font-semibold uppercase leading-none tracking-[0.06em]"
                        style={{ fontSize: 20, color: "var(--bone)" }}
                      >
                        {detail.name}
                      </h3>
                      <p
                        className="mt-1 truncate font-mono text-[12px] tracking-[0.04em]"
                        style={{ color: "#7a786f" }}
                      >
                        {detail.email || "—"}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setEditing(true)}
                        className="flex items-center gap-1.5 rounded px-2.5 py-1.5 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors hover:bg-white/8"
                        style={{ color: "#9a9891", border: "1px solid var(--rule-2)" }}
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    <RoleBadge role={detail.role} />
                    {detail.badge_number && (
                      <span
                        className="font-mono text-[11px] tracking-[0.1em]"
                        style={{ color: "#7a786f" }}
                      >
                        #{detail.badge_number}
                      </span>
                    )}
                    <span
                      className="font-mono text-[10px] tracking-[0.08em]"
                      style={{ color: "#5a5854" }}
                    >
                      Joined {formatDate(detail.created_at)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Shift assignment */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--rule)" }}>
              <div
                className="mb-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase"
                style={{ color: "#7a786f" }}
              >
                <Shield className="h-3 w-3" />
                Shift group
              </div>
              {detail.shift_assignment ? (
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{ background: detail.shift_assignment.group_color }}
                  />
                  <span
                    className="font-display font-semibold text-[13px] uppercase tracking-[0.1em]"
                    style={{ color: "var(--bone)" }}
                  >
                    {detail.shift_assignment.group_name}
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: "#7a786f" }}>
                    Since {formatDate(detail.shift_assignment.start_date)}
                  </span>
                </div>
              ) : (
                <span className="font-mono text-[11px] tracking-[0.06em]" style={{ color: "#5a5854" }}>
                  No shift assignment
                </span>
              )}
            </div>

            {/* Training */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--rule)" }}>
              <div
                className="mb-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase"
                style={{ color: "#7a786f" }}
              >
                <GraduationCap className="h-3 w-3" />
                Training
              </div>
              <div className="flex items-baseline gap-4">
                <div>
                  <span
                    className="font-display font-semibold leading-none"
                    style={{ fontSize: 22, color: "var(--bone)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {detail.training_hours_ytd}
                  </span>
                  <span className="ml-1 font-mono text-[10px] tracking-[0.1em] uppercase" style={{ color: "#7a786f" }}>
                    hrs YTD
                  </span>
                </div>
              </div>
            </div>

            {/* Certifications */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--rule)" }}>
              <div
                className="mb-3 flex items-center justify-between"
              >
                <div
                  className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase"
                  style={{ color: "#7a786f" }}
                >
                  <Award className="h-3 w-3" />
                  Certifications
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px]" style={{ color: "#7a786f" }}>
                    {detail.cert_count} total
                  </span>
                  {detail.expiring_cert_count > 0 && (
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[10px]"
                      style={{ background: "rgba(232,161,58,0.14)", color: "var(--amber, #e8a13a)" }}
                    >
                      {detail.expiring_cert_count} expiring
                    </span>
                  )}
                </div>
              </div>

              {certs.length === 0 ? (
                <span className="font-mono text-[11px] tracking-[0.06em]" style={{ color: "#5a5854" }}>
                  No certifications on file
                </span>
              ) : (
                <div className="space-y-2">
                  {certs.map((cert) => (
                    <div
                      key={cert.local_id}
                      className="flex items-center justify-between rounded px-3 py-2"
                      style={{ background: "rgba(243,238,229,0.04)", border: "1px solid var(--rule)" }}
                    >
                      <div className="min-w-0">
                        <p
                          className="truncate font-mono text-[12px] tracking-[0.04em]"
                          style={{ color: "var(--bone)" }}
                        >
                          {cert.cert_type}
                        </p>
                        {cert.expiry_date && (
                          <p className="font-mono text-[10px] tracking-[0.04em]" style={{ color: "#7a786f" }}>
                            Expires {formatDate(cert.expiry_date)}
                          </p>
                        )}
                      </div>
                      <CertStatusBadge status={cert.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Admin delete */}
            {isAdmin && (
              <div className="mt-auto px-5 py-5">
                {showDeleteConfirm ? (
                  <div
                    className="rounded p-4"
                    style={{ background: "rgba(217,65,65,0.08)", border: "1px solid rgba(217,65,65,0.25)" }}
                  >
                    <p
                      className="mb-3 font-mono text-[12px] tracking-[0.04em]"
                      style={{ color: "var(--bone)" }}
                    >
                      Remove <strong>{detail.name}</strong> from the roster? This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void handleDelete()}
                        disabled={isDeleting}
                        className="bg-red-600 text-white hover:bg-red-700"
                      >
                        {isDeleting && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                        Confirm remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] uppercase transition-opacity hover:opacity-80"
                    style={{ color: "var(--signal, #d94141)" }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove from roster
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}

// ─── Main workspace ───────────────────────────────────────────────────────────

function RosterWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.role === "admin";

  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Member detail drawer — driven by ?member= search param
  const selectedMemberId = searchParams.get("member");

  function openMember(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("member", id);
    router.replace(`/roster?${params.toString()}`, { scroll: false });
  }

  function closeMember() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("member");
    const qs = params.toString();
    router.replace(qs ? `/roster?${qs}` : "/roster", { scroll: false });
  }

  // Live cert count from Dexie
  const expiringCertCount = useLiveQuery(
    () =>
      db.certifications
        .filter((c) => c.status === "expiring_soon" || c.status === "expired")
        .count(),
    []
  );

  // Active shift assignments count (on-duty today proxy)
  const activeAssignmentCount = useLiveQuery(
    () => db.shift_assignments.count(),
    []
  );

  const loadRoster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRoster();
      setRoster(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roster.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const filteredRoster = useMemo(() => {
    let list = roster;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.email ?? "").toLowerCase().includes(q) ||
          (m.badge_number ?? "").includes(q)
      );
    }
    if (roleFilter) {
      list = list.filter((m) => m.role === roleFilter);
    }
    return list;
  }, [roster, search, roleFilter]);

  function handleMemberUpdated(updated: RosterMember) {
    setRoster((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  function handleMemberDeleted() {
    setRoster((prev) => prev.filter((m) => m.id !== selectedMemberId));
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        style={{ marginBottom: 24 }}
      >
        <div>
          <h1
            className="font-display font-semibold uppercase leading-none text-[var(--bone)]"
            style={{ fontSize: 32, letterSpacing: "0.04em", marginBottom: 6 }}
          >
            roster
          </h1>
          <p
            className="font-mono text-[11px] tracking-[0.1em] uppercase"
            style={{ color: "#7a786f" }}
          >
            {roster.length > 0 ? `${roster.length} members` : "Department personnel"}
          </p>
        </div>
        {isAdmin && (
          <Button
            type="button"
            onClick={() => setShowAddModal(true)}
            disabled={sessionStatus !== "authenticated"}
            className="shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            Add member
          </Button>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total members"
          value={loading ? "—" : roster.length}
          icon={Users}
          sub={roleFilter ? `${filteredRoster.length} shown` : undefined}
        />
        <StatCard
          label="On duty today"
          value={activeAssignmentCount ?? "—"}
          icon={Shield}
          sub="Active assignments"
          accent="var(--green, #4ea864)"
        />
        <StatCard
          label="Expiring certs"
          value={expiringCertCount ?? "—"}
          icon={Award}
          sub="Action required"
          accent={
            (expiringCertCount ?? 0) > 0
              ? "var(--amber, #e8a13a)"
              : undefined
          }
        />
      </div>

      {/* ── Filter bar ── */}
      <div
        className="mb-4 flex flex-col gap-2 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "#7a786f" }}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, badge..."
            className="pl-9"
          />
        </div>
          <div className="relative">
          <Filter
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "#7a786f" }}
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 rounded-md pl-9 pr-4 text-sm sm:w-44 focus-visible:outline-none"
            style={{
              color: "var(--bone)",
              background: "var(--steel)",
              border: "1px solid var(--rule-2)",
            }}
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="officer">Officer</option>
            <option value="member">Member</option>
          </select>
        </div>
      </div>

      {/* ── Roster table ── */}
      {loading ? (
        <div
          className="flex items-center justify-center"
          style={{
            border: "1px solid var(--rule-2)",
            background: "var(--steel)",
            padding: "64px 24px",
            borderRadius: 2,
          }}
        >
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#7a786f" }} />
        </div>
      ) : error ? (
        <div
          className="flex flex-col items-center justify-center gap-2"
          style={{
            border: "1px solid rgba(217,65,65,0.3)",
            background: "rgba(217,65,65,0.06)",
            padding: "40px 24px",
            borderRadius: 2,
          }}
        >
          <span className="font-mono text-[12px] tracking-[0.06em]" style={{ color: "var(--signal)" }}>
            {error}
          </span>
          <Button size="sm" variant="outline" onClick={() => void loadRoster()}>
            Retry
          </Button>
        </div>
      ) : filteredRoster.length === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{
            border: "1px solid var(--rule-2)",
            background: "var(--steel)",
            padding: "64px 24px",
            borderRadius: 2,
          }}
        >
          <span className="font-mono text-[11px] tracking-[0.14em] uppercase" style={{ color: "#7a786f" }}>
            {roster.length === 0 ? "No members on roster" : "No results match your filters"}
          </span>
        </div>
      ) : (
        <div
          className="overflow-hidden"
          style={{
            border: "1px solid var(--rule-2)",
            background: "var(--steel)",
            borderRadius: 2,
          }}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--rule)" }}>
                  {["Name", "Badge", "Role", "Shift group", "Training hrs", "Certs", ""].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left font-mono text-[10px] tracking-[0.16em] uppercase"
                        style={{ color: "#7a786f" }}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredRoster.map((member, i) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isLast={i === filteredRoster.length - 1}
                    isSelected={member.id === selectedMemberId}
                    onClick={() => openMember(member.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add member modal ── */}
      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => void loadRoster()}
        />
      )}

      {/* ── Member detail drawer ── */}
      {selectedMemberId && (
        <MemberDetailDrawer
          memberId={selectedMemberId}
          isAdmin={isAdmin}
          onClose={closeMember}
          onDeleted={handleMemberDeleted}
          onUpdated={handleMemberUpdated}
        />
      )}
    </div>
  );
}

// ─── Member row (separate component to avoid closure issues) ──────────────────

function MemberRow({
  member,
  isLast,
  isSelected,
  onClick,
}: {
  member: RosterMember;
  isLast: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  // Pull per-member data from Dexie
  const shiftAssignment = useLiveQuery(
    () => db.shift_assignments.where("user_id").equals(member.id).first(),
    [member.id]
  );
  const shiftGroup = useLiveQuery(
    async () => {
      if (!shiftAssignment?.group_id) return undefined;
      return db.shift_groups.get(shiftAssignment.group_id);
    },
    [shiftAssignment?.group_id]
  );
  const trainingAttendees = useLiveQuery(
    () => db.training_attendees.where("user_id").equals(member.id).toArray(),
    [member.id]
  );
  const certifications = useLiveQuery(
    () => db.certifications.where("user_id").equals(member.id).toArray(),
    [member.id]
  );

  const drillCount = trainingAttendees?.length ?? 0;
  const certCount = certifications?.length ?? 0;
  const expiringCount =
    certifications?.filter(
      (c) => c.status === "expiring_soon" || c.status === "expired"
    ).length ?? 0;

  return (
    <tr
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-colors",
        isSelected ? "bg-white/6" : "hover:bg-white/4"
      )}
      style={{ borderBottom: isLast ? undefined : "1px solid var(--rule)" }}
    >
      {/* Name */}
      <td className="px-4 py-3">
        <span
          className="font-display font-semibold text-[13px] uppercase tracking-[0.06em]"
          style={{ color: "var(--bone)" }}
        >
          {member.name}
        </span>
        <p className="font-mono text-[10px] tracking-[0.04em]" style={{ color: "#7a786f" }}>
          {member.email}
        </p>
      </td>

      {/* Badge */}
      <td className="px-4 py-3">
        <span className="font-mono text-[12px] tracking-[0.06em]" style={{ color: "#9a9891" }}>
          {member.badge_number ? `#${member.badge_number}` : "—"}
        </span>
      </td>

      {/* Role */}
      <td className="px-4 py-3">
        <RoleBadge role={member.role} />
      </td>

      {/* Shift group */}
      <td className="px-4 py-3">
        {shiftGroup ? (
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: shiftGroup.color }}
            />
            <span
              className="font-mono text-[11px] tracking-[0.06em]"
              style={{ color: "var(--bone)" }}
            >
              {shiftGroup.name}
            </span>
          </div>
        ) : (
          <span className="font-mono text-[11px]" style={{ color: "#5a5854" }}>
            —
          </span>
        )}
      </td>

      {/* Training hrs */}
      <td className="px-4 py-3">
        <span
          className="font-mono text-[12px]"
          style={{ color: drillCount > 0 ? "var(--bone)" : "#5a5854", fontVariantNumeric: "tabular-nums" }}
        >
          {drillCount > 0 ? `${drillCount} drills` : "—"}
        </span>
      </td>

      {/* Certs */}
      <td className="px-4 py-3">
        {certCount > 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[12px]" style={{ color: "var(--bone)", fontVariantNumeric: "tabular-nums" }}>
              {certCount}
            </span>
            {expiringCount > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 font-mono text-[9px] tracking-[0.08em]"
                style={{ background: "rgba(232,161,58,0.14)", color: "var(--amber, #e8a13a)" }}
              >
                {expiringCount} exp
              </span>
            )}
          </div>
        ) : (
          <span className="font-mono text-[12px]" style={{ color: "#5a5854" }}>
            —
          </span>
        )}
      </td>

      {/* Action chevron */}
      <td className="px-4 py-3">
        <ChevronRight className="h-4 w-4 ml-auto" style={{ color: "#5a5854" }} />
      </td>
    </tr>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function RosterPage() {
  return (
    <Suspense fallback={null}>
      <RosterWorkspace />
    </Suspense>
  );
}
