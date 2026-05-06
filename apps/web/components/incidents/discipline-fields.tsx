"use client";

import { Label } from "@/components/ui/label";
import { DISCIPLINE_SECTIONS } from "@/lib/incidents/options";
import { cn } from "@/lib/utils";

type DisciplineFieldsProps = {
  incidentType: string;
  values: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
};

function fieldDomId(sectionIndex: number, fieldKey: string) {
  return `discipline-${sectionIndex}-${fieldKey}`;
}

export function DisciplineFields({ incidentType, values, onChange }: DisciplineFieldsProps) {
  const sections = DISCIPLINE_SECTIONS[incidentType];
  if (!sections?.length) return null;

  return (
    <div className="space-y-6">
      {sections.map((section, sectionIndex) => (
        <div
          key={section.title}
          className="space-y-4 border border-[#d6cfbf] px-4 py-5 sm:px-5"
        >
          <div className="flex items-center gap-3">
            <div className="h-[2px] w-7 shrink-0 bg-[var(--signal)]" aria-hidden />
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#4a4842]">
              {section.title}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map((field) => {
              const id = fieldDomId(sectionIndex, field.key);
              const raw = values[field.key];

              if (field.type === "select") {
                const selectValue = typeof raw === "string" ? raw : "";
                return (
                  <div key={field.key} className="space-y-2 sm:col-span-2">
                    <Label htmlFor={id}>{field.label}</Label>
                    <select
                      id={id}
                      value={selectValue}
                      onChange={(e) => onChange(field.key, e.target.value)}
                      className={cn(
                        "h-11 w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2",
                        "font-body text-[15px] text-[var(--ink)] focus:outline-none focus:border-b-[var(--signal)]"
                      )}
                    >
                      <option value="">Select…</option>
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (field.type === "number") {
                const display =
                  typeof raw === "number" && Number.isFinite(raw)
                    ? String(raw)
                    : typeof raw === "string"
                      ? raw
                      : "";
                return (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={id}>{field.label}</Label>
                    <input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      value={display}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") {
                          onChange(field.key, undefined);
                          return;
                        }
                        const n = Number(v);
                        onChange(field.key, Number.isFinite(n) ? n : v);
                      }}
                      className={cn(
                        "flex h-11 w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2",
                        "font-body text-[15px] text-[var(--ink)] placeholder:text-[#4a4842]/60",
                        "focus-visible:outline-none focus-visible:border-b-[var(--signal)]"
                      )}
                    />
                  </div>
                );
              }

              const textValue = raw != null && typeof raw !== "object" ? String(raw) : "";
              return (
                <div key={field.key} className="space-y-2 sm:col-span-2">
                  <Label htmlFor={id}>{field.label}</Label>
                  <input
                    id={id}
                    type="text"
                    value={textValue}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    className={cn(
                      "flex h-11 w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2",
                      "font-body text-[15px] text-[var(--ink)] placeholder:text-[#4a4842]/60",
                      "focus-visible:outline-none focus-visible:border-b-[var(--signal)]"
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
