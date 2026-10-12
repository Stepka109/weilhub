"use client";

import { Check } from "lucide-react";
import { PICKABLE_ICONS } from "@/components/icons/icon-registry";
import { SUBJECT_COLORS, SUBJECT_COLOR_KEYS } from "@/lib/subject-style";
import { cn } from "@/lib/utils";

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Barva" className="flex flex-wrap gap-2">
      {SUBJECT_COLOR_KEYS.map((key) => {
        const c = SUBJECT_COLORS[key];
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.label}
            title={c.label}
            onClick={() => onChange(key)}
            className={cn(
              "grid size-10 place-items-center rounded-full border-2 transition-transform hover:scale-105",
              c.bg,
              c.ink,
              selected ? "border-current" : "border-transparent",
            )}
          >
            {selected && <Check className="size-4" strokeWidth={3} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

export function IconPicker({ value, onChange, color = "blue" }: { value: string; onChange: (v: string) => void; color?: string }) {
  const c = SUBJECT_COLORS[color as keyof typeof SUBJECT_COLORS] ?? SUBJECT_COLORS.blue;
  return (
    <div role="radiogroup" aria-label="Ikonka" className="grid max-h-56 grid-cols-6 gap-2 overflow-y-auto rounded-2xl border border-line p-2 sm:grid-cols-8">
      {Object.entries(PICKABLE_ICONS).map(([key, { icon: Icon, label }]) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => onChange(key)}
            className={cn(
              "grid aspect-square place-items-center rounded-xl transition-colors",
              selected ? cn(c.bg, c.ink, "ring-2 ring-current") : "text-slate-ink hover:bg-bg",
            )}
          >
            <Icon className="size-5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
