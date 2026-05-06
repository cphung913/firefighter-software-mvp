"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface NarrativeBuilderProps {
  incidentType: string;
  narrative: string;
  onChange: (value: string) => void;
}

type TemplateField = { label: string; placeholder: string };

const DEFAULT_TEMPLATE: TemplateField[] = [
  {
    label: "Conditions on arrival:",
    placeholder: "Describe what you found on arrival...",
  },
  {
    label: "Actions taken:",
    placeholder: "Describe what actions were taken...",
  },
  { label: "Outcome:", placeholder: "Describe the outcome and disposition..." },
];

const TEMPLATES: Record<string, TemplateField[]> = {
  structure_fire: [
    {
      label: "Conditions on arrival:",
      placeholder: "e.g., Heavy smoke showing from alpha side, 2nd floor...",
    },
    {
      label: "Actions taken:",
      placeholder: 'e.g., Engine 1 established water supply. Crew 1 advanced 1¾" line...',
    },
    {
      label: "Fire control/overhaul:",
      placeholder: "e.g., Fire knocked down at 14:32. Overhaul completed...",
    },
    {
      label: "Injuries/casualties:",
      placeholder: "e.g., No civilian injuries. FF Smith treated for minor burns...",
    },
    {
      label: "Utilities/scene security:",
      placeholder: "e.g., Gas shut off at meter. Building secured...",
    },
  ],
  medical_assist: [
    {
      label: "Patient presentation:",
      placeholder: "e.g., 68-year-old male, unresponsive, reported by family...",
    },
    {
      label: "Assessment and treatment:",
      placeholder: "e.g., Patient found pulseless. CPR initiated. AED applied...",
    },
    {
      label: "Disposition:",
      placeholder: "e.g., Patient transported to Regional Medical by AMR unit...",
    },
  ],
  motor_vehicle_collision: [
    {
      label: "Scene conditions:",
      placeholder: "e.g., Two-vehicle collision, northbound lane of Hwy 12...",
    },
    {
      label: "Patient assessment:",
      placeholder: "e.g., Driver 1 ambulatory with complaints of neck pain...",
    },
    {
      label: "Actions taken:",
      placeholder: "e.g., Scene secured with apparatus. EMS notified and en route...",
    },
    {
      label: "Disposition:",
      placeholder: "e.g., Two patients transported by AMR. Scene cleared at...",
    },
  ],
  hazmat_gas_leak: [
    {
      label: "Hazard identified:",
      placeholder: "e.g., Natural gas odor reported from basement of structure...",
    },
    {
      label: "Isolation and actions:",
      placeholder: "e.g., 300ft isolation established. Gas company notified...",
    },
    {
      label: "Mitigation:",
      placeholder: "e.g., Utility company isolated supply at 15:12. Building ventilated...",
    },
    {
      label: "Scene clearance:",
      placeholder: "e.g., Readings confirmed 0 LEL. Structure released to owner...",
    },
  ],
  rescue_extrication: [
    {
      label: "Entrapment details:",
      placeholder: "e.g., Single occupant found trapped by steering wheel/dash...",
    },
    {
      label: "Extrication operations:",
      placeholder: "e.g., Hydraulic tools deployed. Roof removed...",
    },
    {
      label: "Patient outcome:",
      placeholder: "e.g., Patient extricated at 13:45, transferred to ALS care...",
    },
  ],
};

function templateForType(incidentType: string): TemplateField[] {
  if (!incidentType.trim()) return DEFAULT_TEMPLATE;
  return TEMPLATES[incidentType] ?? DEFAULT_TEMPLATE;
}

/** Compose narrative from guided fields: `[label] [value]\n\n` per non-empty trimmed value. */
function composeGuidedNarrative(fields: TemplateField[], values: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < fields.length; i++) {
    const v = values[i]?.trim() ?? "";
    if (!v) continue;
    parts.push(`${fields[i].label} ${v}`);
  }
  return parts.join("\n\n");
}

/**
 * Parse narrative into guided values using label prefixes; if not parseable,
 * put full text in the first field.
 */
function parseGuidedNarrative(
  narrative: string,
  fields: TemplateField[]
): string[] {
  const empty = fields.map(() => "");
  const trimmed = narrative.trim();
  if (!trimmed) return empty;

  const labels = fields.map((f) => f.label);

  // Find earliest occurrence of any label in template order (skip empty finds).
  function indexOfLabelFrom(pos: number): { idx: number; at: number } | null {
    let best: { idx: number; at: number } | null = null;
    for (let li = 0; li < labels.length; li++) {
      const L = labels[li];
      const at = narrative.indexOf(L, pos);
      if (at === -1) continue;
      const nextChar = narrative.at(at + L.length);
      if (nextChar !== undefined && nextChar !== " " && nextChar !== "\n") continue;
      if (best === null || at < best.at) best = { idx: li, at };
    }
    return best;
  }

  const first = indexOfLabelFrom(0);
  // Require first semantic label at start (after trim) for "parseable" structured narrative
  if (
    first === null ||
    trimmed.slice(0, labels[first.idx].length) !== labels[first.idx]
  ) {
    const next = empty.slice();
    next[0] = narrative;
    return next;
  }

  const values = empty.slice();
  let pos = 0;

  while (pos < narrative.length) {
    const match = indexOfLabelFrom(pos);
    if (!match) break;

    const { idx: li, at } = match;
    const L = labels[li];
    let contentStart = at + L.length;
    while (narrative[contentStart] === " ") contentStart++;

    let nextPos = narrative.length;
    for (let lj = 0; lj < labels.length; lj++) {
      const L2 = labels[lj];
      const searchFrom = contentStart;
      const found = narrative.indexOf(L2, searchFrom);
      if (found === -1) continue;
      const after = narrative.at(found + L2.length);
      if (after !== undefined && after !== " " && after !== "\n") continue;
      if (found < nextPos) nextPos = found;
    }

    const rawValue = narrative.slice(contentStart, nextPos).trim();
    const prev = values[li]?.trim() ?? "";
    values[li] = prev ? `${prev}\n\n${rawValue}` : rawValue;
    pos = nextPos;
  }

  return values;
}

type Mode = "free" | "guided";

export function NarrativeBuilder({
  incidentType,
  narrative,
  onChange,
}: NarrativeBuilderProps) {
  const fields = useMemo(() => templateForType(incidentType), [incidentType]);

  const [mode, setMode] = useState<Mode>("free");
  const [guidedValues, setGuidedValues] = useState<string[]>(() =>
    fields.map(() => "")
  );

  const narrativePropRef = useRef(narrative);
  narrativePropRef.current = narrative;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const syncGuidedFromNarrative = useCallback((text: string, tmpl: TemplateField[]) => {
    const parsed = parseGuidedNarrative(text, tmpl);
    setGuidedValues(
      parsed.length === tmpl.length ? parsed : tmpl.map((_, i) => parsed[i] ?? "")
    );
  }, []);

  // When the template shape changes (incident type), refresh guided fields from the latest narrative.
  useEffect(() => {
    if (mode !== "guided") return;
    syncGuidedFromNarrative(narrativePropRef.current, fields);
  }, [fields, mode, syncGuidedFromNarrative]);

  useLayoutEffect(() => {
    if (mode !== "guided") return;
    const composed = composeGuidedNarrative(fields, guidedValues);
    if (composed !== narrativePropRef.current) {
      onChangeRef.current(composed);
    }
  }, [mode, fields, guidedValues]);

  function switchToGuided() {
    syncGuidedFromNarrative(narrativePropRef.current, fields);
    setMode("guided");
  }

  function switchToFree() {
    const composed = composeGuidedNarrative(fields, guidedValues);
    onChange(composed);
    setMode("free");
  }

  function updateGuidedField(index: number, value: string) {
    setGuidedValues((prev) => {
      const len = fields.length;
      const base = prev.length === len ? prev : fields.map((_, i) => prev[i] ?? "");
      const next = [...base];
      next[index] = value;
      return next;
    });
  }

  const tabButtons = (
    <div
      className="inline-flex gap-1 rounded-full border border-[#d6cfbf] bg-[#ede8de]/80 p-1"
      role="tablist"
      aria-label="Narrative mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "free"}
        className={cn(
          "rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
          mode === "free"
            ? "bg-[var(--signal)] text-[var(--bone)]"
            : "text-[#4a4842] hover:bg-[#f7f4ec]"
        )}
        onClick={() => {
          if (mode === "guided") switchToFree();
        }}
      >
        Free Text
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "guided"}
        className={cn(
          "rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
          mode === "guided"
            ? "bg-[var(--signal)] text-[var(--bone)]"
            : "text-[#4a4842] hover:bg-[#f7f4ec]"
        )}
        onClick={() => {
          if (mode === "free") switchToGuided();
        }}
      >
        Guided
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {tabButtons}
      {mode === "free" ? (
        <div className="rounded-md border border-[#d6cfbf] bg-[#f7f4ec]/90 px-3 py-2">
          <Textarea
            placeholder="Describe what happened: conditions on arrival, actions taken, outcomes, and any outstanding follow-up."
            value={narrative}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            className="border-0 bg-transparent px-0 focus-visible:border-b-transparent"
          />
        </div>
      ) : (
        <div className="space-y-4 rounded-md border border-[#d6cfbf] bg-[#f7f4ec]/90 px-3 py-4">
          {fields.map((field, index) => (
            <div key={`${field.label}-${index}`} className="space-y-1.5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#4a4842]">
                {field.label}
              </p>
              <Textarea
                aria-label={field.label}
                placeholder={field.placeholder}
                value={guidedValues[index] ?? ""}
                onChange={(e) => updateGuidedField(index, e.target.value)}
                rows={2}
                className="border border-[#d6cfbf] bg-white/70 px-2 py-2 focus-visible:border-b-[var(--signal)]"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
