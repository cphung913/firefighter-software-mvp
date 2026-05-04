export type ComplianceStatus = "overdue" | "due-soon" | "ok" | "unknown";

export interface InspectionSchedule {
  type: string;
  label: string;
  intervalDays: number;
  nfpaStandard: string;
}

export const NFPA_SCHEDULES: Record<string, InspectionSchedule[]> = {
  scba: [
    { type: "visual",     label: "Monthly Visual",       intervalDays: 30,   nfpaStandard: "NFPA 1852" },
    { type: "annual",     label: "Annual Flow Test",      intervalDays: 365,  nfpaStandard: "NFPA 1852" },
    { type: "hydro_test", label: "Cylinder Hydro Test",   intervalDays: 1825, nfpaStandard: "NFPA 1852" },
  ],
  hose: [
    { type: "annual",     label: "Annual Service Test",   intervalDays: 365,  nfpaStandard: "NFPA 1962" },
  ],
  ladder: [
    { type: "visual",     label: "Quarterly Visual",      intervalDays: 90,   nfpaStandard: "NFPA 1931" },
    { type: "annual",     label: "Annual Load Test",      intervalDays: 365,  nfpaStandard: "NFPA 1931" },
  ],
  ppe: [
    { type: "annual",     label: "Annual Inspection",     intervalDays: 365,  nfpaStandard: "NFPA 1851" },
  ],
  extinguisher: [
    { type: "visual",     label: "Monthly Visual",        intervalDays: 30,   nfpaStandard: "NFPA 10" },
    { type: "annual",     label: "Annual Service",        intervalDays: 365,  nfpaStandard: "NFPA 10" },
  ],
  tool:  [{ type: "annual", label: "Annual Visual", intervalDays: 365, nfpaStandard: "—" }],
  other: [{ type: "annual", label: "Annual Visual", intervalDays: 365, nfpaStandard: "—" }],
};

export const EQUIPMENT_TYPE_LABEL: Record<string, string> = {
  scba:         "SCBA",
  hose:         "Hose",
  ladder:       "Ladder",
  ppe:          "PPE",
  extinguisher: "Extinguisher",
  tool:         "Tool",
  other:        "Other",
};

export const EQUIPMENT_TYPES = Object.keys(EQUIPMENT_TYPE_LABEL);

/** Returns the most frequent (shortest-interval) schedule for a type. */
export function getPrimarySchedule(equipmentType: string): InspectionSchedule | null {
  const schedules = NFPA_SCHEDULES[equipmentType];
  if (!schedules?.length) return null;
  return schedules.reduce((a, b) => (a.intervalDays <= b.intervalDays ? a : b));
}

/**
 * Compute next due date for an inspection type given the inspection date.
 * Returns ISO date string (YYYY-MM-DD).
 */
export function computeNextDue(
  equipmentType: string,
  inspectionType: string,
  inspectionDate: string
): string | null {
  const schedules = NFPA_SCHEDULES[equipmentType];
  if (!schedules) return null;
  const schedule = schedules.find((s) => s.type === inspectionType);
  if (!schedule) return null;
  const d = new Date(inspectionDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + schedule.intervalDays);
  return d.toISOString().split("T")[0];
}

/** Returns compliance status based on next_inspection_due date. */
export function getComplianceStatus(nextDue: string | null | undefined): ComplianceStatus {
  if (!nextDue) return "unknown";
  const due = new Date(nextDue);
  if (Number.isNaN(due.getTime())) return "unknown";
  const now = new Date();
  const msUntilDue = due.getTime() - now.getTime();
  const daysUntilDue = msUntilDue / (1000 * 60 * 60 * 24);
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= 30) return "due-soon";
  return "ok";
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
