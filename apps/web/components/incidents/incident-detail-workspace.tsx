"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, FileOutput, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLiveQuery } from "dexie-react-hooks";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AttachmentPanel } from "@/components/incidents/attachment-panel";
import { IncidentForm, incidentRecordToForm } from "@/components/incidents/incident-form";
import type { IncidentRecord } from "@/lib/db";
import { db } from "@/lib/db";
import {
  approveIncident,
  deleteIncident,
  fetchIncident,
  fetchNerisJson,
  rejectIncident,
  submitIncident,
} from "@/lib/incidents/api";
import { ApiError } from "@/lib/api/client";
import { printIncidentPdf } from "@/lib/incidents/export";
import {
  NERIS_INCIDENT_TYPES,
  PROPERTY_USE_OPTIONS,
} from "@/lib/incidents/options";
import type { IncidentOut } from "@vfd/shared-types";
import { cn } from "@/lib/utils";

interface Props {
  serverId: string;
}

function lookupLabel(options: ReadonlyArray<{ value: string; label: string }>, value?: string | null) {
  if (!value) return "Unspecified";
  return options.find((o) => o.value === value)?.label ?? value;
}

function formatTs(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function reportStatusLabel(status: string): string {
  switch (status) {
    case "draft": return "Draft";
    case "submitted": return "Pending review";
    case "approved": return "Approved";
    case "rejected": return "Rejected";
    default: return status;
  }
}

function reportHeaderBadgeClass(status: string): string {
  switch (status) {
    case "draft":
      return "border-[var(--rule-strong)] text-[var(--bone-dim)]";
    case "submitted":
      return "border-[var(--amber)] text-[var(--amber)]";
    case "approved":
      return "border-green-500/50 text-green-400";
    case "rejected":
      return "border-[var(--signal)]/60 text-[var(--signal)]";
    default:
      return "border-[var(--rule)] text-[var(--bone-dim)]";
  }
}

export function IncidentDetailWorkspace({ serverId }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.role === "admin";
  const roster = useLiveQuery(() => db.department_users.toArray(), []);
  const [incident, setIncident] = useState<IncidentRecord | null | undefined>(undefined);
  const [serverIncident, setServerIncident] = useState<IncidentOut | null | undefined>(undefined);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportingNeris, setIsExportingNeris] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refreshServerIncident() {
    try {
      const row = await fetchIncident(serverId);
      setServerIncident(row);
    } catch {
      setServerIncident(null);
    }
  }

  useEffect(() => {
    void refreshServerIncident();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when server id changes only
  }, [serverId]);

  useEffect(() => {
    let cancelled = false;
    db.incidents.where("server_id").equals(serverId).first().then((row) => {
      if (!cancelled) setIncident(row ?? null);
    });
    return () => { cancelled = true; };
  }, [serverId]);

  function resolveUserName(id: string | null | undefined): string | null {
    if (!id) return null;
    const u = roster?.find((r) => r.id === id);
    return u?.name ?? null;
  }

  function handlePdfExport() {
    if (!incident) return;
    setError(null);
    try {
      const raw = (incident.raw_data ?? {}) as Record<string, unknown>;
      printIncidentPdf(
        incident,
        lookupLabel(NERIS_INCIDENT_TYPES, incident.incident_type),
        lookupLabel(PROPERTY_USE_OPTIONS, typeof raw.property_use === "string" ? raw.property_use : null)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open PDF. Check your browser's popup settings.");
    }
  }

  async function handleNerisExport() {
    setIsExportingNeris(true);
    setError(null);
    try {
      const json = await fetchNerisJson(serverId);
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `neris-${incident?.incident_number ?? serverId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export NERIS JSON.");
    } finally {
      setIsExportingNeris(false);
    }
  }

  async function handleSubmitForReview() {
    setWorkflowBusy(true);
    setError(null);
    try {
      await submitIncident(serverId);
      setRejectOpen(false);
      setRejectNotes("");
      await refreshServerIncident();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit for review.");
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function handleApprove() {
    setWorkflowBusy(true);
    setError(null);
    try {
      await approveIncident(serverId, null);
      setRejectOpen(false);
      setRejectNotes("");
      await refreshServerIncident();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("Only admins can approve reports.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to approve.");
      }
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function handleConfirmReject() {
    setWorkflowBusy(true);
    setError(null);
    try {
      await rejectIncident(serverId, rejectNotes.trim() === "" ? null : rejectNotes.trim());
      setRejectOpen(false);
      setRejectNotes("");
      await refreshServerIncident();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("Only admins can reject reports.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to reject.");
      }
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this incident? This cannot be undone.")) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteIncident(serverId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("Only admins can delete incidents.");
        setIsDeleting(false);
        return;
      }
      // 404 means already gone on the server — still clean up locally
      if (!(err instanceof ApiError && err.status === 404)) {
        setError(err instanceof Error ? err.message : "Unable to delete incident.");
        setIsDeleting(false);
        return;
      }
    }
    await db.incidents.where("server_id").equals(serverId).delete();
    router.push("/incidents");
  }

  const reportStatus =
    serverIncident === undefined ? undefined : (serverIncident?.report_status ?? "draft");
  const reviewerName = resolveUserName(serverIncident?.reviewed_by ?? undefined);
  const approvedBannerMeta =
    serverIncident?.report_status === "approved"
      ? [
          reviewerName ? `by ${reviewerName}` : null,
          serverIncident.reviewed_at ? formatTs(serverIncident.reviewed_at) : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

  if (incident === undefined) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--bone-dim)]" />
      </div>
    );
  }

  if (incident === null) {
    return (
      <div className="space-y-6">
        <Link href="/incidents" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4" />All incidents
        </Link>
        <div className="border border-[var(--rule)] p-8 text-center font-body text-[var(--bone-dim)]">
          <p className="font-medium text-[var(--bone)]">Incident not found on this device.</p>
          <p className="mt-1">It may still be syncing. Pull to refresh or check your connection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/incidents" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft className="h-4 w-4" />All incidents
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[clamp(28px,4vw,40px)] uppercase tracking-[-0.005em] font-medium text-[var(--bone)]">
              {incident.incident_number ?? "Incident"}
            </h1>
            {reportStatus === undefined ? (
              <Loader2 className="h-5 w-5 animate-spin text-[var(--bone-dim)]" aria-label="Loading status" />
            ) : (
              <span
                className={cn(
                  "border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                  reportHeaderBadgeClass(reportStatus)
                )}
              >
                {reportStatusLabel(reportStatus)}
              </span>
            )}
          </div>
          <p className="font-body text-[var(--bone-dim)]">
            {lookupLabel(NERIS_INCIDENT_TYPES, incident.incident_type)}
          </p>
          {serverIncident === null ? (
            <p className="font-body text-[12px] text-[var(--bone-dim)]">
              Could not load review status — check your connection.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handlePdfExport}>
            <FileOutput className="h-4 w-4" />
            Export PDF
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleNerisExport} disabled={isExportingNeris}>
            {isExportingNeris ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            NERIS JSON
          </Button>
          {isAdmin ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="border border-[var(--signal)] bg-[rgba(200,54,44,0.08)] px-4 py-3 font-body text-[14px] text-[var(--signal)]">{error}</div>
      ) : null}

      {serverIncident?.report_status === "rejected" && serverIncident.review_notes ? (
        <div className="border border-[var(--amber)] bg-[rgba(232,161,58,0.1)] px-4 py-3 font-body text-[14px] text-[var(--amber)]">
          <span className="font-semibold">Returned for revision. </span>
          Officer notes: {serverIncident.review_notes}
        </div>
      ) : null}

      {serverIncident?.report_status === "approved" ? (
        <div className="flex flex-wrap items-center gap-2 border border-green-500/40 bg-[rgba(34,197,94,0.08)] px-4 py-3 font-body text-[14px] text-green-400">
          <span className="font-semibold">Approved</span>
          {approvedBannerMeta ? (
            <span className="text-[var(--bone-dim)]">{approvedBannerMeta}</span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(reportStatus === "draft" || reportStatus === "rejected") && serverIncident !== undefined ? (
            <Button
              type="button"
              size="sm"
              disabled={workflowBusy || serverIncident === null}
              onClick={() => void handleSubmitForReview()}
            >
              {workflowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {reportStatus === "rejected" ? "Re-submit for review" : "Submit for review"}
            </Button>
          ) : null}
          {reportStatus === "submitted" && isAdmin ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-green-500/50 text-green-400 hover:text-green-300"
                disabled={workflowBusy}
                onClick={() => void handleApprove()}
              >
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={workflowBusy}
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </Button>
            </>
          ) : null}
        </div>
        {rejectOpen && reportStatus === "submitted" && isAdmin ? (
          <div className="max-w-lg space-y-2 rounded border border-[var(--rule)] bg-[var(--ink)]/30 p-4">
            <label className="block font-body text-[13px] text-[var(--bone-dim)]" htmlFor="reject-notes">
              Rejection notes (optional)
            </label>
            <textarea
              id="reject-notes"
              rows={3}
              className="w-full resize-y rounded border border-[var(--rule)] bg-[var(--ink)] px-3 py-2 font-body text-[14px] text-[var(--bone)]"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              disabled={workflowBusy}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="destructive" disabled={workflowBusy} onClick={() => void handleConfirmReject()}>
                Confirm reject
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={workflowBusy}
                onClick={() => {
                  setRejectOpen(false);
                  setRejectNotes("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Card className="bg-[var(--bone)] border-[#d6cfbf] text-[var(--ink)] [&_input]:border-b-[#1a1d22] [&_input]:text-[var(--ink)] [&_input]:placeholder:text-[#a09a8e]">
        <CardHeader>
          <CardTitle className="text-[var(--ink)]">Edit incident</CardTitle>
          <CardDescription className="text-[#4a4842]">
            Changes enqueue for sync. Offline edits are safe — they sync on reconnect.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IncidentForm
            existingLocalId={incident.local_id}
            initialData={incidentRecordToForm(incident)}
            submitLabel="Save changes"
            onSubmitSuccess={() => router.push("/incidents")}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-[clamp(18px,2.5vw,22px)] uppercase tracking-[0.06em] font-medium text-[var(--bone)]">
          Attachments
        </h2>
        <AttachmentPanel incidentServerId={serverId} />
      </section>
    </div>
  );
}
