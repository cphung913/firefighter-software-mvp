"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  ArrowLeftRight,
} from "lucide-react";
import {
  getCalendar,
  listLeaveRequests,
  createLeaveRequest,
  cancelLeaveRequest,
  reviewLeaveRequest,
  listTrades,
  createTrade,
  reviewTrade,
  listShiftPatterns,
  createShiftPattern,
  listShiftGroups,
  createShiftGroup,
  listAssignments,
  createAssignment,
} from "@/lib/scheduling/api";
import type {
  CalendarDay,
  LeaveRequest,
  ShiftTrade,
  ShiftPattern,
  ShiftGroup,
  ShiftAssignment,
} from "@vfd/shared-types";

// ─── Utilities ────────────────────────────────────────────────────────────────

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthStart(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function monthEnd(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildCalendarGrid(
  year: number,
  month: number
): Array<{ date: Date; inMonth: boolean }> {
  const first = monthStart(year, month);
  const last = monthEnd(year, month);
  const cells: Array<{ date: Date; inMonth: boolean }> = [];

  // Leading days from previous month
  for (let i = first.getDay() - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), inMonth: false });
  }

  // Current month days
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }

  // Trailing days to fill 42 cells
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) {
    cells.push({ date: new Date(year, month + 1, d), inMonth: false });
  }

  return cells;
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.70)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md mx-4 flex flex-col"
        style={{
          background: "var(--ink)",
          border: "1px solid var(--rule-2)",
          borderRadius: 2,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <h3 className="font-display font-semibold uppercase tracking-[0.14em] text-[14px] text-[var(--bone)]">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--bone-dim)] hover:text-[var(--bone)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="font-mono text-[11px] uppercase tracking-[0.14em]"
        style={{ color: "#7a786f" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function StyledSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement>
) {
  return (
    <select
      {...props}
      style={{
        background: "var(--steel)",
        border: "1px solid var(--rule-2)",
        color: "var(--bone)",
        padding: "8px 10px",
        fontSize: 13,
        fontFamily: "inherit",
        borderRadius: 2,
        width: "100%",
        appearance: "none",
        cursor: "pointer",
        ...props.style,
      }}
    />
  );
}

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        background: "var(--steel)",
        border: "1px solid var(--rule-2)",
        color: "var(--bone)",
        padding: "8px 10px",
        fontSize: 13,
        fontFamily: "inherit",
        borderRadius: 2,
        width: "100%",
        ...props.style,
      }}
    />
  );
}

function StyledTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      rows={3}
      {...props}
      style={{
        background: "var(--steel)",
        border: "1px solid var(--rule-2)",
        color: "var(--bone)",
        padding: "8px 10px",
        fontSize: 13,
        fontFamily: "inherit",
        borderRadius: 2,
        width: "100%",
        resize: "vertical",
        ...props.style,
      }}
    />
  );
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending: { bg: "rgba(232,161,58,0.16)", color: "var(--amber)" },
  approved: { bg: "rgba(78,168,100,0.16)", color: "var(--green)" },
  denied: { bg: "rgba(196,59,42,0.16)", color: "var(--signal)" },
  cancelled: { bg: "rgba(243,238,229,0.06)", color: "#7a786f" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: "rgba(243,238,229,0.06)", color: "#7a786f" };
  return (
    <span
      className="font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 shrink-0"
      style={{ background: s.bg, color: s.color, borderRadius: 2 }}
    >
      {status}
    </span>
  );
}

function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className="flex items-center gap-2 font-mono text-[11.5px] tracking-[0.04em] px-3 py-2.5"
      style={{
        background: "rgba(196,59,42,0.12)",
        border: "1px solid rgba(196,59,42,0.3)",
        color: "var(--signal)",
        borderRadius: 2,
      }}
    >
      <AlertTriangle size={13} className="shrink-0" />
      {message}
    </div>
  );
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────

function CalendarGrid({
  year,
  month,
  calendarData,
  onDayClick,
}: {
  year: number;
  month: number;
  calendarData: Map<string, CalendarDay>;
  onDayClick: (day: CalendarDay | null, date: string) => void;
}) {
  const today = isoDate(new Date());
  const cells = buildCalendarGrid(year, month);

  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-center py-2"
            style={{ color: "#7a786f" }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px" style={{ background: "var(--rule)" }}>
        {cells.map(({ date, inMonth }, idx) => {
          const dateStr = isoDate(date);
          const dayData = inMonth ? calendarData.get(dateStr) : undefined;
          const isToday = dateStr === today;
          const staffingBad = dayData && !dayData.staffing_ok;

          // Collect unique group colors for on-duty dots
          const groupColors: string[] = [];
          const seenGroups = new Set<string>();
          if (dayData) {
            for (const u of dayData.on_duty) {
              if (!seenGroups.has(u.group_name)) {
                seenGroups.add(u.group_name);
                groupColors.push(u.group_color);
              }
            }
          }

          return (
            <div
              key={idx}
              onClick={() => {
                if (!inMonth) return;
                onDayClick(dayData ?? null, dateStr);
              }}
              style={{
                background: staffingBad
                  ? "rgba(196,59,42,0.08)"
                  : "var(--steel)",
                border: staffingBad
                  ? "1px solid rgba(196,59,42,0.35)"
                  : "1px solid transparent",
                minHeight: 76,
                padding: "8px 6px 22px",
                cursor: inMonth ? "pointer" : "default",
                opacity: inMonth ? 1 : 0.3,
                position: "relative",
                transition: "background 120ms",
              }}
              className={inMonth ? "hover:brightness-110" : ""}
            >
              {/* Day number */}
              <div className="flex items-start justify-between gap-1 mb-1.5">
                <span
                  style={
                    isToday
                      ? {
                          background: "var(--signal)",
                          color: "#fff",
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontFamily: "var(--font-mono, monospace)",
                          fontWeight: 700,
                          flexShrink: 0,
                        }
                      : {
                          fontFamily: "var(--font-mono, monospace)",
                          fontSize: 12,
                          color: inMonth ? "var(--bone)" : "#7a786f",
                        }
                  }
                >
                  {date.getDate()}
                </span>

                {/* L / T badges */}
                <div className="flex items-center gap-0.5 flex-wrap justify-end">
                  {dayData && dayData.leave_count > 0 && (
                    <span
                      className="font-mono text-[8px] font-semibold leading-none px-1 py-0.5"
                      style={{
                        background: "rgba(232,161,58,0.28)",
                        color: "var(--amber)",
                        borderRadius: 2,
                      }}
                    >
                      L{dayData.leave_count}
                    </span>
                  )}
                  {dayData && dayData.trade_count > 0 && (
                    <span
                      className="font-mono text-[8px] font-semibold leading-none px-1 py-0.5"
                      style={{
                        background: "rgba(74,143,181,0.28)",
                        color: "var(--blue)",
                        borderRadius: 2,
                      }}
                    >
                      T{dayData.trade_count}
                    </span>
                  )}
                </div>
              </div>

              {/* Group color dots */}
              {groupColors.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {groupColors.map((color, ci) => (
                    <span
                      key={ci}
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              )}

              {/* On-duty count */}
              {dayData && dayData.on_duty.length > 0 && (
                <span
                  className="absolute bottom-1.5 left-1.5 font-mono text-[9px] tracking-[0.04em]"
                  style={{ color: "#7a786f" }}
                >
                  {dayData.on_duty.length}
                </span>
              )}

              {/* Staffing alert icon */}
              {staffingBad && (
                <span className="absolute bottom-1.5 right-1.5">
                  <AlertTriangle size={10} style={{ color: "var(--signal)" }} />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day Detail Modal ─────────────────────────────────────────────────────────

function DayDetailModal({
  open,
  onClose,
  date,
  dayData,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  dayData: CalendarDay | null;
}) {
  const displayDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <Modal open={open} onClose={onClose} title={displayDate}>
      {!dayData ? (
        <p
          className="font-mono text-[12px] tracking-[0.06em]"
          style={{ color: "#7a786f" }}
        >
          No scheduling data for this day.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {!dayData.staffing_ok && (
            <div
              className="flex items-center gap-2 font-mono text-[11px] tracking-[0.04em] px-3 py-2"
              style={{
                background: "rgba(196,59,42,0.12)",
                border: "1px solid rgba(196,59,42,0.3)",
                color: "var(--signal)",
                borderRadius: 2,
              }}
            >
              <AlertTriangle size={13} />
              Below minimum staffing level
            </div>
          )}

          <div>
            <p
              className="font-mono text-[10px] uppercase tracking-[0.14em] mb-3"
              style={{ color: "#7a786f" }}
            >
              On Duty ({dayData.on_duty.length})
            </p>
            {dayData.on_duty.length === 0 ? (
              <p
                className="font-mono text-[12px]"
                style={{ color: "#7a786f" }}
              >
                No personnel scheduled
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {dayData.on_duty.map((u) => (
                  <div key={u.id} className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: u.group_color }}
                    />
                    <span className="font-mono text-[13px] text-[var(--bone)] flex-1 min-w-0 truncate">
                      {u.name}
                    </span>
                    {u.badge_number && (
                      <span
                        className="font-mono text-[10px] shrink-0"
                        style={{ color: "#7a786f" }}
                      >
                        #{u.badge_number}
                      </span>
                    )}
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.08em] shrink-0"
                      style={{ color: u.group_color, opacity: 0.85 }}
                    >
                      {u.group_name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(dayData.leave_count > 0 || dayData.trade_count > 0) && (
            <div
              className="grid grid-cols-2 gap-3"
              style={{
                background: "var(--steel)",
                border: "1px solid var(--rule-2)",
                padding: "14px",
                borderRadius: 2,
              }}
            >
              <div className="text-center">
                <p
                  className="font-display font-semibold text-[24px] leading-none"
                  style={{ color: "var(--amber)" }}
                >
                  {dayData.leave_count}
                </p>
                <p
                  className="font-mono text-[10px] uppercase tracking-[0.12em] mt-1"
                  style={{ color: "#7a786f" }}
                >
                  Leave
                </p>
              </div>
              <div className="text-center">
                <p
                  className="font-display font-semibold text-[24px] leading-none"
                  style={{ color: "var(--blue)" }}
                >
                  {dayData.trade_count}
                </p>
                <p
                  className="font-mono text-[10px] uppercase tracking-[0.12em] mt-1"
                  style={{ color: "#7a786f" }}
                >
                  Trades
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Leave Request Modal ──────────────────────────────────────────────────────

function LeaveRequestModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [leaveType, setLeaveType] = useState("vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setLeaveType("vacation");
    setStartDate("");
    setEndDate("");
    setNotes("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError("Start and end dates are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createLeaveRequest({
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        notes: notes.trim() || null,
      });
      reset();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to submit request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Request Time Off"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <InlineError message={error} />
        <FormField label="Leave Type">
          <StyledSelect
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
          >
            <option value="vacation">Vacation</option>
            <option value="sick">Sick</option>
            <option value="personal">Personal</option>
            <option value="fmla">FMLA</option>
            <option value="bereavement">Bereavement</option>
            <option value="other">Other</option>
          </StyledSelect>
        </FormField>
        <FormField label="Start Date">
          <StyledInput
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </FormField>
        <FormField label="End Date">
          <StyledInput
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Notes (optional)">
          <StyledTextarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional context..."
          />
        </FormField>
        <Button type="submit" disabled={submitting} className="mt-1">
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Submit Request
        </Button>
      </form>
    </Modal>
  );
}

// ─── Shift Trade Modal ────────────────────────────────────────────────────────

function ShiftTradeModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const users = useLiveQuery(
    () => db.department_users.orderBy("name").toArray(),
    []
  );
  const [recipientId, setRecipientId] = useState("");
  const [tradeDate, setTradeDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setRecipientId("");
    setTradeDate("");
    setReturnDate("");
    setNotes("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientId || !tradeDate) {
      setError("Recipient and trade date are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createTrade({
        recipient_id: recipientId,
        trade_date: tradeDate,
        return_date: returnDate.trim() || null,
        notes: notes.trim() || null,
      });
      reset();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit trade.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Request Shift Trade"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <InlineError message={error} />
        <FormField label="Trade With">
          <StyledSelect
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            required
          >
            <option value="">Select personnel...</option>
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.badge_number ? ` (#${u.badge_number})` : ""}
              </option>
            ))}
          </StyledSelect>
        </FormField>
        <FormField label="Trade Date">
          <StyledInput
            type="date"
            value={tradeDate}
            onChange={(e) => setTradeDate(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Return Date (optional)">
          <StyledInput
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
          />
        </FormField>
        <FormField label="Notes (optional)">
          <StyledTextarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional context..."
          />
        </FormField>
        <Button type="submit" disabled={submitting} className="mt-1">
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Submit Trade Request
        </Button>
      </form>
    </Modal>
  );
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

function CalendarTab({ isAdmin }: { isAdmin: boolean }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [calendarData, setCalendarData] = useState<Map<string, CalendarDay>>(
    new Map()
  );
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [trades, setTrades] = useState<ShiftTrade[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [tradesLoading, setTradesLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);

  const fetchCalendar = useCallback(async () => {
    setCalLoading(true);
    setCalError(null);
    try {
      const start = isoDate(monthStart(year, month));
      const end = isoDate(monthEnd(year, month));
      const data = await getCalendar(start, end);
      const map = new Map<string, CalendarDay>();
      for (const d of data) map.set(d.date, d);
      setCalendarData(map);
    } catch {
      setCalError("Could not load calendar. Showing cached data if available.");
    } finally {
      setCalLoading(false);
    }
  }, [year, month]);

  const fetchLeave = useCallback(async () => {
    setLeaveLoading(true);
    try {
      setLeaveRequests(await listLeaveRequests());
    } catch {
      // silently keep previous state
    } finally {
      setLeaveLoading(false);
    }
  }, []);

  const fetchTrades = useCallback(async () => {
    setTradesLoading(true);
    try {
      setTrades(await listTrades());
    } catch {
      // silently keep previous state
    } finally {
      setTradesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  useEffect(() => {
    fetchLeave();
    fetchTrades();
  }, [fetchLeave, fetchTrades]);

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const activeLeave = leaveRequests.filter(
    (r) => r.status === "pending" || r.status === "approved"
  );
  const activeTrades = trades.filter(
    (t) => t.status === "pending" || t.status === "approved"
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ── Calendar card ────────────────────────────────────── */}
      <div
        style={{
          background: "var(--steel)",
          border: "1px solid var(--rule-2)",
          borderRadius: 2,
        }}
      >
        {/* Month navigation */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <div className="flex items-center gap-3">
            <CalendarDays size={15} style={{ color: "var(--signal)" }} />
            <h2 className="font-display font-semibold uppercase tracking-[0.14em] text-[15px] text-[var(--bone)]">
              {MONTH_NAMES[month]} {year}
            </h2>
            {calLoading && (
              <Loader2
                size={13}
                className="animate-spin"
                style={{ color: "#7a786f" }}
              />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={prevMonth}
              className="flex items-center justify-center w-8 h-8 text-[var(--bone-dim)] hover:text-[var(--bone)] transition-colors"
              style={{ border: "1px solid var(--rule-2)", borderRadius: 2 }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={nextMonth}
              className="flex items-center justify-center w-8 h-8 text-[var(--bone-dim)] hover:text-[var(--bone)] transition-colors"
              style={{ border: "1px solid var(--rule-2)", borderRadius: 2 }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {calError && (
          <div className="px-5 pt-4">
            <InlineError message={calError} />
          </div>
        )}

        <div className="p-4">
          <CalendarGrid
            year={year}
            month={month}
            calendarData={calendarData}
            onDayClick={(day, date) => {
              setSelectedDay(day);
              setSelectedDate(date);
              setDayDetailOpen(true);
            }}
          />
        </div>

        {/* Legend */}
        <div
          className="flex flex-wrap items-center gap-5 px-5 py-3"
          style={{ borderTop: "1px solid var(--rule)" }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="font-mono text-[9px] font-semibold px-1 py-0.5"
              style={{
                background: "rgba(232,161,58,0.28)",
                color: "var(--amber)",
                borderRadius: 2,
              }}
            >
              L
            </span>
            <span
              className="font-mono text-[10px] tracking-[0.06em]"
              style={{ color: "#7a786f" }}
            >
              Leave
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="font-mono text-[9px] font-semibold px-1 py-0.5"
              style={{
                background: "rgba(74,143,181,0.28)",
                color: "var(--blue)",
                borderRadius: 2,
              }}
            >
              T
            </span>
            <span
              className="font-mono text-[10px] tracking-[0.06em]"
              style={{ color: "#7a786f" }}
            >
              Trade
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={10} style={{ color: "var(--signal)" }} />
            <span
              className="font-mono text-[10px] tracking-[0.06em]"
              style={{ color: "#7a786f" }}
            >
              Low staffing
            </span>
          </div>
          <span
            className="ml-auto font-mono text-[10px] tracking-[0.06em]"
            style={{ color: "#7a786f" }}
          >
            Click a day for details
          </span>
        </div>
      </div>

      {/* ── Leave Requests panel ──────────────────────────────── */}
      <div
        style={{
          background: "var(--steel)",
          border: "1px solid var(--rule-2)",
          borderRadius: 2,
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <div className="flex items-center gap-2.5">
            <Clock size={14} style={{ color: "var(--signal)" }} />
            <h3 className="font-display font-semibold uppercase tracking-[0.14em] text-[14px] text-[var(--bone)]">
              My Leave Requests
            </h3>
            {leaveLoading && (
              <Loader2
                size={13}
                className="animate-spin"
                style={{ color: "#7a786f" }}
              />
            )}
          </div>
          <Button size="sm" onClick={() => setLeaveModalOpen(true)}>
            <Plus size={13} />
            Request Time Off
          </Button>
        </div>

        {activeLeave.length === 0 ? (
          <div className="flex items-center justify-center px-5 py-8">
            <span
              className="font-mono text-[11px] tracking-[0.14em] uppercase"
              style={{ color: "#7a786f" }}
            >
              No leave requests
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            {activeLeave.map((req, i) => (
              <div
                key={req.id}
                className="flex items-center gap-3 px-5 py-3.5"
                style={{
                  borderBottom:
                    i < activeLeave.length - 1
                      ? "1px solid var(--rule)"
                      : undefined,
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[13px] text-[var(--bone)] capitalize">
                    {req.leave_type.replace(/_/g, " ")}
                  </p>
                  <p
                    className="font-mono text-[11px] mt-0.5"
                    style={{ color: "#7a786f" }}
                  >
                    {req.start_date} → {req.end_date}
                    {req.notes ? ` · ${req.notes}` : ""}
                  </p>
                </div>
                <StatusBadge status={req.status} />
                {isAdmin && req.status === "pending" && (
                  <button
                    onClick={async () => {
                      try {
                        await reviewLeaveRequest(req.id, "approved");
                        await fetchLeave();
                      } catch {
                        // silently fail
                      }
                    }}
                    title="Approve"
                    className="transition-opacity hover:opacity-70"
                  >
                    <CheckCircle2 size={15} style={{ color: "var(--green)" }} />
                  </button>
                )}
                {req.status === "pending" && (
                  <button
                    onClick={async () => {
                      try {
                        await cancelLeaveRequest(req.id);
                        await fetchLeave();
                      } catch {
                        // silently fail
                      }
                    }}
                    title="Cancel"
                    className="text-[var(--bone-dim)] hover:text-[var(--signal)] transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Shift Trades panel ────────────────────────────────── */}
      <div
        style={{
          background: "var(--steel)",
          border: "1px solid var(--rule-2)",
          borderRadius: 2,
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <div className="flex items-center gap-2.5">
            <ArrowLeftRight size={14} style={{ color: "var(--signal)" }} />
            <h3 className="font-display font-semibold uppercase tracking-[0.14em] text-[14px] text-[var(--bone)]">
              My Trades
            </h3>
            {tradesLoading && (
              <Loader2
                size={13}
                className="animate-spin"
                style={{ color: "#7a786f" }}
              />
            )}
          </div>
          <Button size="sm" onClick={() => setTradeModalOpen(true)}>
            <Plus size={13} />
            Request Trade
          </Button>
        </div>

        {activeTrades.length === 0 ? (
          <div className="flex items-center justify-center px-5 py-8">
            <span
              className="font-mono text-[11px] tracking-[0.14em] uppercase"
              style={{ color: "#7a786f" }}
            >
              No shift trades
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            {activeTrades.map((trade, i) => (
              <div
                key={trade.id}
                className="flex items-center gap-3 px-5 py-3.5"
                style={{
                  borderBottom:
                    i < activeTrades.length - 1
                      ? "1px solid var(--rule)"
                      : undefined,
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[13px] text-[var(--bone)]">
                    Trade on {trade.trade_date}
                    {trade.return_date ? ` · return ${trade.return_date}` : ""}
                  </p>
                  {trade.notes && (
                    <p
                      className="font-mono text-[11px] mt-0.5 truncate"
                      style={{ color: "#7a786f" }}
                    >
                      {trade.notes}
                    </p>
                  )}
                </div>
                <StatusBadge status={trade.status} />
                {isAdmin && trade.status === "pending" && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={async () => {
                        try {
                          await reviewTrade(trade.id, "approved");
                          await fetchTrades();
                        } catch {
                          // silently fail
                        }
                      }}
                      title="Approve"
                      className="transition-opacity hover:opacity-70"
                    >
                      <CheckCircle2 size={15} style={{ color: "var(--green)" }} />
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await reviewTrade(trade.id, "denied");
                          await fetchTrades();
                        } catch {
                          // silently fail
                        }
                      }}
                      title="Deny"
                      className="text-[var(--bone-dim)] hover:text-[var(--signal)] transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <DayDetailModal
        open={dayDetailOpen}
        onClose={() => setDayDetailOpen(false)}
        date={selectedDate}
        dayData={selectedDay}
      />
      <LeaveRequestModal
        open={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        onSuccess={fetchLeave}
      />
      <ShiftTradeModal
        open={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        onSuccess={fetchTrades}
      />
    </div>
  );
}

// ─── Management Tab ───────────────────────────────────────────────────────────

function AdminCard({
  tag,
  title,
  meta,
  action,
  children,
}: {
  tag: string;
  title: string;
  meta?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex flex-col"
      style={{
        background: "var(--steel)",
        border: "1px solid var(--rule-2)",
        borderRadius: 2,
      }}
    >
      <span
        className="absolute top-0 right-3.5 -translate-y-1/2 px-2 font-mono text-[9.5px] tracking-[0.16em] uppercase pointer-events-none select-none"
        style={{ background: "var(--ink)", color: "#7a786f" }}
      >
        {tag}
      </span>
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--rule)" }}
      >
        <div className="flex items-center gap-2.5">
          <h3 className="font-display font-semibold uppercase tracking-[0.14em] text-[14px] text-[var(--bone)]">
            {title}
          </h3>
          {meta && (
            <span
              className="font-mono text-[11px] tracking-[0.06em]"
              style={{ color: "#7a786f" }}
            >
              {meta}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// New Pattern Modal
function NewPatternModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [patternType, setPatternType] = useState("24_48");
  const [cycleLengthDays, setCycleLengthDays] = useState("3");
  const [onDays, setOnDays] = useState("1");
  const [offDays, setOffDays] = useState("2");
  const [startDate, setStartDate] = useState("");
  const [kellyDayInterval, setKellyDayInterval] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setPatternType("24_48");
    setCycleLengthDays("3");
    setOnDays("1");
    setOffDays("2");
    setStartDate("");
    setKellyDayInterval("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate) {
      setError("Name and start date are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createShiftPattern({
        name: name.trim(),
        pattern_type: patternType,
        cycle_length_days: parseInt(cycleLengthDays) || 3,
        on_days: parseInt(onDays) || 1,
        off_days: parseInt(offDays) || 2,
        start_date: startDate,
        kelly_day_interval: kellyDayInterval
          ? parseInt(kellyDayInterval)
          : null,
      });
      reset();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create pattern."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New Shift Pattern"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <InlineError message={error} />
        <FormField label="Name">
          <StyledInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. A/B/C Rotation"
            required
          />
        </FormField>
        <FormField label="Pattern Type">
          <StyledSelect
            value={patternType}
            onChange={(e) => setPatternType(e.target.value)}
          >
            <option value="24_48">24/48</option>
            <option value="48_96">48/96</option>
            <option value="california_swing">California Swing</option>
            <option value="kelly">Kelly</option>
            <option value="custom">Custom</option>
          </StyledSelect>
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Cycle Days">
            <StyledInput
              type="number"
              min="1"
              value={cycleLengthDays}
              onChange={(e) => setCycleLengthDays(e.target.value)}
              required
            />
          </FormField>
          <FormField label="On Days">
            <StyledInput
              type="number"
              min="1"
              value={onDays}
              onChange={(e) => setOnDays(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Off Days">
            <StyledInput
              type="number"
              min="1"
              value={offDays}
              onChange={(e) => setOffDays(e.target.value)}
              required
            />
          </FormField>
        </div>
        <FormField label="Start Date">
          <StyledInput
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Kelly Day Interval (optional)">
          <StyledInput
            type="number"
            min="1"
            value={kellyDayInterval}
            onChange={(e) => setKellyDayInterval(e.target.value)}
            placeholder="e.g. 9"
          />
        </FormField>
        <Button type="submit" disabled={submitting} className="mt-1">
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Create Pattern
        </Button>
      </form>
    </Modal>
  );
}

// New Group Modal
function NewGroupModal({
  open,
  onClose,
  onSuccess,
  patterns,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patterns: ShiftPattern[];
}) {
  const [name, setName] = useState("");
  const [patternId, setPatternId] = useState("");
  const [color, setColor] = useState("#e84141");
  const [cycleOffsetDays, setCycleOffsetDays] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patterns.length > 0 && !patternId) {
      setPatternId(patterns[0].id);
    }
  }, [patterns, patternId]);

  function reset() {
    setName("");
    setPatternId(patterns[0]?.id ?? "");
    setColor("#e84141");
    setCycleOffsetDays("0");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !patternId) {
      setError("Name and pattern are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createShiftGroup({
        name: name.trim(),
        pattern_id: patternId,
        color,
        cycle_offset_days: parseInt(cycleOffsetDays) || 0,
      });
      reset();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create group."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New Shift Group"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <InlineError message={error} />
        <FormField label="Name">
          <StyledInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Shift A"
            required
          />
        </FormField>
        <FormField label="Pattern">
          <StyledSelect
            value={patternId}
            onChange={(e) => setPatternId(e.target.value)}
            required
          >
            <option value="">Select pattern...</option>
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </StyledSelect>
        </FormField>
        <FormField label="Color">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: 44,
                height: 36,
                border: "1px solid var(--rule-2)",
                borderRadius: 2,
                background: "var(--steel)",
                cursor: "pointer",
                padding: 2,
              }}
            />
            <span
              className="font-mono text-[12px]"
              style={{ color: "var(--bone-dim)" }}
            >
              {color}
            </span>
            <span
              className="w-5 h-5 rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
        </FormField>
        <FormField label="Cycle Offset Days">
          <StyledInput
            type="number"
            min="0"
            value={cycleOffsetDays}
            onChange={(e) => setCycleOffsetDays(e.target.value)}
          />
        </FormField>
        <Button type="submit" disabled={submitting} className="mt-1">
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Create Group
        </Button>
      </form>
    </Modal>
  );
}

// Assign Modal
function AssignModal({
  open,
  onClose,
  onSuccess,
  groups,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  groups: ShiftGroup[];
}) {
  const users = useLiveQuery(
    () => db.department_users.orderBy("name").toArray(),
    []
  );
  const [userId, setUserId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (groups.length > 0 && !groupId) {
      setGroupId(groups[0].id);
    }
  }, [groups, groupId]);

  function reset() {
    setUserId("");
    setGroupId(groups[0]?.id ?? "");
    setStartDate("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !groupId || !startDate) {
      setError("All fields are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createAssignment({
        user_id: userId,
        group_id: groupId,
        start_date: startDate,
      });
      reset();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create assignment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Assign to Shift Group"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <InlineError message={error} />
        <FormField label="Personnel">
          <StyledSelect
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          >
            <option value="">Select personnel...</option>
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.badge_number ? ` (#${u.badge_number})` : ""}
              </option>
            ))}
          </StyledSelect>
        </FormField>
        <FormField label="Shift Group">
          <StyledSelect
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            required
          >
            <option value="">Select group...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </StyledSelect>
        </FormField>
        <FormField label="Start Date">
          <StyledInput
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </FormField>
        <Button type="submit" disabled={submitting} className="mt-1">
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Assign
        </Button>
      </form>
    </Modal>
  );
}

// Management Tab Component
function ManagementTab() {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [groups, setGroups] = useState<ShiftGroup[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [newPatternOpen, setNewPatternOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const users = useLiveQuery(
    () => db.department_users.orderBy("name").toArray(),
    []
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, g, a] = await Promise.all([
        listShiftPatterns(),
        listShiftGroups(),
        listAssignments(),
      ]);
      setPatterns(p);
      setGroups(g);
      setAssignments(a);
    } catch {
      setError("Failed to load management data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const patternMap = new Map(patterns.map((p) => [p.id, p]));

  // Latest assignment per user
  const latestAssignmentByUser = new Map<string, ShiftAssignment>();
  for (const a of assignments) {
    const existing = latestAssignmentByUser.get(a.user_id);
    if (!existing || a.start_date > existing.start_date) {
      latestAssignmentByUser.set(a.user_id, a);
    }
  }

  const filteredUsers = (users ?? []).filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.badge_number ?? "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin" style={{ color: "#7a786f" }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <InlineError message={error} />

      {/* ── Patterns card ─────────────────────────────────────── */}
      <AdminCard
        tag="ADMIN"
        title="Shift Patterns"
        meta={patterns.length > 0 ? `— ${patterns.length}` : undefined}
        action={
          <Button size="sm" onClick={() => setNewPatternOpen(true)}>
            <Plus size={13} />
            New Pattern
          </Button>
        }
      >
        {patterns.length === 0 ? (
          <div className="flex items-center justify-center px-5 py-8">
            <span
              className="font-mono text-[11px] tracking-[0.14em] uppercase"
              style={{ color: "#7a786f" }}
            >
              No shift patterns configured
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            {patterns.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-4 px-5 py-3.5"
                style={{
                  borderBottom:
                    i < patterns.length - 1
                      ? "1px solid var(--rule)"
                      : undefined,
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[13px] text-[var(--bone)] truncate">
                    {p.name}
                  </p>
                  <p
                    className="font-mono text-[11px] mt-0.5"
                    style={{ color: "#7a786f" }}
                  >
                    {p.pattern_type.replace(/_/g, "/")} · {p.on_days}on/
                    {p.off_days}off · {p.cycle_length_days}d cycle
                    {p.kelly_day_interval
                      ? ` · Kelly /${p.kelly_day_interval}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5"
                    style={{
                      background: p.is_active
                        ? "rgba(78,168,100,0.16)"
                        : "rgba(243,238,229,0.06)",
                      color: p.is_active ? "var(--green)" : "#7a786f",
                      borderRadius: 2,
                    }}
                  >
                    {p.is_active ? "active" : "inactive"}
                  </span>
                  <span
                    className="font-mono text-[10px]"
                    style={{ color: "#7a786f" }}
                  >
                    starts {p.start_date}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {/* ── Groups card ────────────────────────────────────────── */}
      <AdminCard
        tag="ADMIN"
        title="Shift Groups"
        meta={groups.length > 0 ? `— ${groups.length}` : undefined}
        action={
          <Button
            size="sm"
            onClick={() => setNewGroupOpen(true)}
            disabled={patterns.length === 0}
            title={
              patterns.length === 0 ? "Create a pattern first" : undefined
            }
          >
            <Plus size={13} />
            New Group
          </Button>
        }
      >
        {groups.length === 0 ? (
          <div className="flex items-center justify-center px-5 py-8">
            <span
              className="font-mono text-[11px] tracking-[0.14em] uppercase"
              style={{ color: "#7a786f" }}
            >
              No shift groups configured
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            {groups.map((g, i) => (
              <div
                key={g.id}
                className="flex items-center gap-3 px-5 py-3.5"
                style={{
                  borderBottom:
                    i < groups.length - 1 ? "1px solid var(--rule)" : undefined,
                }}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: g.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[13px] text-[var(--bone)]">
                    {g.name}
                  </p>
                  <p
                    className="font-mono text-[11px] mt-0.5"
                    style={{ color: "#7a786f" }}
                  >
                    {patternMap.get(g.pattern_id)?.name ?? "Unknown pattern"}{" "}
                    · +{g.cycle_offset_days}d offset
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {/* ── Assignments card ───────────────────────────────────── */}
      <AdminCard
        tag="ADMIN"
        title="Assignments"
        meta={
          assignments.length > 0 ? `— ${assignments.length}` : undefined
        }
        action={
          <Button
            size="sm"
            onClick={() => setAssignOpen(true)}
            disabled={groups.length === 0}
            title={groups.length === 0 ? "Create a group first" : undefined}
          >
            <Plus size={13} />
            Assign
          </Button>
        }
      >
        {/* Search bar */}
        <div
          className="px-5 py-3"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <Input
            placeholder="Search by name or badge number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center px-5 py-8">
            <span
              className="font-mono text-[11px] tracking-[0.14em] uppercase"
              style={{ color: "#7a786f" }}
            >
              {searchQuery ? "No matching personnel" : "No personnel found"}
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredUsers.map((u, i) => {
              const assignment = latestAssignmentByUser.get(u.id);
              const group = assignment
                ? groupMap.get(assignment.group_id)
                : undefined;

              return (
                <div
                  key={u.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                  style={{
                    borderBottom:
                      i < filteredUsers.length - 1
                        ? "1px solid var(--rule)"
                        : undefined,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[13px] text-[var(--bone)]">
                      {u.name}
                      {u.badge_number && (
                        <span
                          className="ml-2 font-mono text-[11px]"
                          style={{ color: "#7a786f" }}
                        >
                          #{u.badge_number}
                        </span>
                      )}
                    </p>
                    <p
                      className="font-mono text-[10px] uppercase tracking-[0.08em] mt-0.5"
                      style={{ color: "#7a786f" }}
                    >
                      {u.role}
                    </p>
                  </div>

                  {group ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="font-mono text-[12px] text-[var(--bone-dim)]">
                        {group.name}
                      </span>
                      <span
                        className="font-mono text-[10px]"
                        style={{ color: "#7a786f" }}
                      >
                        since {assignment!.start_date}
                      </span>
                    </div>
                  ) : (
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.1em] shrink-0"
                      style={{ color: "#7a786f" }}
                    >
                      Unassigned
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AdminCard>

      {/* Modals */}
      <NewPatternModal
        open={newPatternOpen}
        onClose={() => setNewPatternOpen(false)}
        onSuccess={fetchAll}
      />
      <NewGroupModal
        open={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        onSuccess={fetchAll}
        patterns={patterns}
      />
      <AssignModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onSuccess={fetchAll}
        groups={groups}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabId = "calendar" | "management";

export default function SchedulePage() {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<TabId>("calendar");

  const isAdmin = session?.role === "admin";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div
            className="h-8 w-40 animate-pulse"
            style={{ background: "var(--steel)", borderRadius: 2 }}
          />
        </div>
        <div
          className="h-96 animate-pulse"
          style={{ background: "var(--steel)", borderRadius: 2 }}
        />
      </div>
    );
  }

  const tabs: TabId[] = ["calendar", ...(isAdmin ? (["management"] as TabId[]) : [])];

  const TAB_ICON: Record<TabId, React.ReactNode> = {
    calendar: <CalendarDays size={13} />,
    management: <Users size={13} />,
  };

  return (
    <div>
      {/* Page heading */}
      <div style={{ marginBottom: 24 }}>
        <h1
          className="font-display font-semibold uppercase leading-none text-[var(--bone)]"
          style={{ fontSize: 32, letterSpacing: "0.04em", marginBottom: 6 }}
        >
          schedule
        </h1>
      </div>

      {/* Tab navigation */}
      <div
        className="flex items-end gap-0 mb-6"
        style={{ borderBottom: "1px solid var(--rule-2)" }}
      >
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex items-center gap-1.5 font-display font-semibold uppercase tracking-[0.14em] text-[12px] px-4 py-2.5 transition-colors"
            style={{
              color: tab === t ? "var(--bone)" : "#7a786f",
              borderBottom:
                tab === t
                  ? "2px solid var(--signal)"
                  : "2px solid transparent",
              marginBottom: -1,
              background: "transparent",
              cursor: "pointer",
            }}
          >
            {TAB_ICON[t]}
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "calendar" && <CalendarTab isAdmin={isAdmin} />}
      {tab === "management" && isAdmin && <ManagementTab />}
    </div>
  );
}
