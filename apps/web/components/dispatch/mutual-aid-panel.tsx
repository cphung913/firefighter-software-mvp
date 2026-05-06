"use client";

import { ChevronDown, ChevronRight, Loader2, Users } from "lucide-react";
import { useCallback, useEffect, useState, useTransition, type CSSProperties } from "react";

import { cn } from "@/lib/utils";
import {
  createAssignment,
  fetchAgencies,
  fetchAssignments,
  updateAssignment,
  type MutualAidAgency,
  type MutualAidAssignment,
} from "@/lib/mutual-aid/api";
import { useSyncStore } from "@/store/sync-store";

// ---------------------------------------------------------------------------
// Styles (match dispatch board dark theme)
// ---------------------------------------------------------------------------

const STATUS_PILL: Record<string, CSSProperties> = {
  requested: {
    background: "rgba(232,161,58,0.16)",
    color: "var(--amber)",
    borderColor: "rgba(232,161,58,0.4)",
  },
  en_route: {
    background: "rgba(74,143,181,0.16)",
    color: "var(--blue)",
    borderColor: "rgba(74,143,181,0.4)",
  },
  on_scene: {
    background: "rgba(232,92,26,0.16)",
    color: "#e87828",
    borderColor: "rgba(232,92,26,0.4)",
  },
  released: {
    background: "rgba(78,168,100,0.16)",
    color: "var(--green)",
    borderColor: "rgba(78,168,100,0.4)",
  },
};

function statusPillStyle(status: string): CSSProperties {
  return STATUS_PILL[status] ?? STATUS_PILL.requested;
}

function nextAdvance(
  status: string
): { next: string; label: string } | null {
  if (status === "requested") return { next: "en_route", label: "En Route" };
  if (status === "en_route") return { next: "on_scene", label: "On Scene" };
  if (status === "on_scene") return { next: "released", label: "Released" };
  return null;
}

function formatAgencyLabel(a: MutualAidAgency): string {
  let s = a.name;
  if (a.agency_type?.trim()) s += ` · ${a.agency_type}`;
  return s;
}

// ---------------------------------------------------------------------------

export function MutualAidPanel({
  incidentLocalId,
  incidentServerId,
}: {
  incidentLocalId: string;
  incidentServerId: string | null;
}) {
  const online = useSyncStore((s) => s.online);
  const [expanded, setExpanded] = useState(false);
  const [assignments, setAssignments] = useState<MutualAidAssignment[]>([]);
  const [agencies, setAgencies] = useState<MutualAidAgency[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listErr, setListErr] = useState<string | null>(null);

  const [useDirectory, setUseDirectory] = useState(true);
  const [agencyId, setAgencyId] = useState("");
  const [adHocName, setAdHocName] = useState("");
  const [units, setUnits] = useState("");
  const [formStatus, setFormStatus] = useState("requested");
  const [notes, setNotes] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadAssignments = useCallback(async () => {
    if (!online || !incidentServerId) return;
    setLoadingList(true);
    setListErr(null);
    try {
      const rows = await fetchAssignments(incidentServerId);
      setAssignments(rows);
    } catch (e) {
      setListErr(e instanceof Error ? e.message : "Could not load mutual aid");
      setAssignments([]);
    } finally {
      setLoadingList(false);
    }
  }, [online, incidentServerId]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    if (!expanded || !online) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchAgencies();
        if (!cancelled) setAgencies(list);
      } catch {
        if (!cancelled) setAgencies([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, online]);

  if (!online) {
    return (
      <div className="mt-3 rounded-sm border border-[var(--rule)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--bone-dim)]">
        Connect to manage mutual aid
      </div>
    );
  }

  if (!incidentServerId) {
    return (
      <div className="mt-3 rounded-sm border border-[var(--rule)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--bone-dim)]">
        Sync to server first
      </div>
    );
  }

  const count = assignments.length;

  return (
    <div className="mt-3 border border-[var(--rule)] rounded-sm overflow-hidden">
      <button
        type="button"
        id={`mutual-aid-toggle-${incidentLocalId}`}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors",
          "text-[var(--bone-dim)] hover:text-[var(--bone)] hover:bg-[var(--bone)]/5"
        )}
      >
        <span className="inline-flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          )}
          <Users className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          Mutual Aid
          {count > 0 ? (
            <span
              className="inline-flex min-w-[1.25rem] justify-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold"
              style={{
                borderColor: "rgba(74,143,181,0.45)",
                color: "var(--blue)",
                background: "rgba(74,143,181,0.12)",
              }}
            >
              {count}
            </span>
          ) : null}
        </span>
        {loadingList ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin opacity-50" aria-hidden />
        ) : null}
      </button>

      {expanded ? (
        <div className="border-t border-[var(--rule)] px-3 py-3 space-y-4 bg-[var(--bone)]/[0.02]">
          {listErr ? (
            <p className="font-body text-[12px] text-[var(--signal)]">{listErr}</p>
          ) : null}

          {assignments.length === 0 ? (
            <p className="font-body text-[12px] text-[var(--bone-dim)]">
              No mutual aid assigned yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {assignments.map((a) => {
                const adv = nextAdvance(a.status);
                return (
                  <li
                    key={a.id}
                    className="rounded-sm border border-[var(--rule)] p-2.5 space-y-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-body text-[13px] text-[var(--bone)] font-medium truncate">
                          {a.agency_name ?? "Agency"}
                        </p>
                        {a.units_assigned?.trim() ? (
                          <p className="font-mono text-[10px] tracking-[0.06em] text-[var(--bone-dim)] mt-0.5">
                            {a.units_assigned}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border"
                        style={statusPillStyle(a.status)}
                      >
                        {a.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    {adv ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(async () => {
                              await updateAssignment(incidentServerId, a.id, {
                                status: adv.next,
                              });
                              await loadAssignments();
                            })
                          }
                          className={cn(
                            "px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] border border-[var(--rule)] transition-colors",
                            "text-[var(--bone-dim)] hover:border-[var(--blue)] hover:text-[var(--blue)]",
                            isPending && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {adv.label} →
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bone-dim)] mb-2">
              Add Mutual Aid
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setUseDirectory(true);
                  setAdHocName("");
                  setFormErr(null);
                }}
                className={cn(
                  "px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] border rounded-sm",
                  useDirectory
                    ? "border-[var(--blue)] text-[var(--blue)]"
                    : "border-[var(--rule)] text-[var(--bone-dim)]"
                )}
              >
                Directory
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseDirectory(false);
                  setAgencyId("");
                  setFormErr(null);
                }}
                className={cn(
                  "px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] border rounded-sm",
                  !useDirectory
                    ? "border-[var(--blue)] text-[var(--blue)]"
                    : "border-[var(--rule)] text-[var(--bone-dim)]"
                )}
              >
                Ad hoc name
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {useDirectory ? (
                <div className="sm:col-span-2">
                  <label className="sr-only" htmlFor={`ma-agency-${incidentLocalId}`}>
                    Agency
                  </label>
                  <select
                    id={`ma-agency-${incidentLocalId}`}
                    value={agencyId}
                    onChange={(e) => setAgencyId(e.target.value)}
                    className="w-full h-9 rounded-sm border border-[var(--rule)] bg-transparent px-2 font-body text-[13px] text-[var(--bone)]"
                  >
                    <option value="">Select agency…</option>
                    {agencies.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {formatAgencyLabel(ag)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <label className="sr-only" htmlFor={`ma-adhoc-${incidentLocalId}`}>
                    Agency name
                  </label>
                  <input
                    id={`ma-adhoc-${incidentLocalId}`}
                    value={adHocName}
                    onChange={(e) => setAdHocName(e.target.value)}
                    placeholder="Agency name"
                    className="w-full h-9 rounded-sm border border-[var(--rule)] bg-transparent px-2 font-body text-[13px] text-[var(--bone)] placeholder:text-[var(--bone-dim)]"
                  />
                </div>
              )}
              <div>
                <label className="sr-only" htmlFor={`ma-units-${incidentLocalId}`}>
                  Units
                </label>
                <input
                  id={`ma-units-${incidentLocalId}`}
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  placeholder="Units (e.g. E-12, T-6)"
                  className="w-full h-9 rounded-sm border border-[var(--rule)] bg-transparent px-2 font-body text-[13px] text-[var(--bone)] placeholder:text-[var(--bone-dim)]"
                />
              </div>
              <div>
                <label className="sr-only" htmlFor={`ma-status-${incidentLocalId}`}>
                  Status
                </label>
                <select
                  id={`ma-status-${incidentLocalId}`}
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full h-9 rounded-sm border border-[var(--rule)] bg-transparent px-2 font-body text-[13px] text-[var(--bone)]"
                >
                  <option value="requested">Requested</option>
                  <option value="en_route">En route</option>
                  <option value="on_scene">On scene</option>
                  <option value="released">Released</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="sr-only" htmlFor={`ma-notes-${incidentLocalId}`}>
                  Notes
                </label>
                <input
                  id={`ma-notes-${incidentLocalId}`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full h-9 rounded-sm border border-[var(--rule)] bg-transparent px-2 font-body text-[13px] text-[var(--bone)] placeholder:text-[var(--bone-dim)]"
                />
              </div>
            </div>

            {formErr ? (
              <p className="mt-2 font-body text-[12px] text-[var(--signal)]">{formErr}</p>
            ) : null}

            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setFormErr(null);
                  if (useDirectory) {
                    if (!agencyId) {
                      setFormErr("Select an agency.");
                      return;
                    }
                    await createAssignment(incidentServerId, {
                      agency_id: agencyId,
                      units_assigned: units.trim() || undefined,
                      status: formStatus,
                      notes: notes.trim() || undefined,
                    });
                  } else {
                    const name = adHocName.trim();
                    if (!name) {
                      setFormErr("Enter an agency name.");
                      return;
                    }
                    await createAssignment(incidentServerId, {
                      agency_name_override: name,
                      units_assigned: units.trim() || undefined,
                      status: formStatus,
                      notes: notes.trim() || undefined,
                    });
                  }
                  setUnits("");
                  setNotes("");
                  setAdHocName("");
                  await loadAssignments();
                })
              }
              className={cn(
                "mt-3 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] border border-[var(--rule)] transition-colors",
                "text-[var(--bone-dim)] hover:border-[var(--green)] hover:text-[var(--green)]",
                isPending && "opacity-50 cursor-not-allowed"
              )}
            >
              {isPending ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Submit
                </span>
              ) : (
                "Add assignment"
              )}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
