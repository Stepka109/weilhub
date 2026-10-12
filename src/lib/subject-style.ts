import type { SubjectColor } from "./types";

/** Paleta pro předměty – pastelové pozadí + sytý text pro kontrast. */
export const SUBJECT_COLORS: Record<SubjectColor, { label: string; bg: string; ink: string; dot: string; bar: string; border: string }> = {
  blue: { label: "Modrá", bg: "bg-light-blue", ink: "text-primary", dot: "bg-primary", bar: "border-l-primary", border: "border-primary/30" },
  mint: { label: "Mátová", bg: "bg-mint", ink: "text-mint-ink", dot: "bg-mint-ink", bar: "border-l-mint-ink", border: "border-mint-ink/25" },
  yellow: { label: "Žlutá", bg: "bg-yellow", ink: "text-yellow-ink", dot: "bg-yellow-ink", bar: "border-l-yellow-ink", border: "border-yellow-ink/25" },
  lavender: {
    label: "Levandulová",
    bg: "bg-lavender",
    ink: "text-lavender-ink",
    dot: "bg-lavender-ink", bar: "border-l-lavender-ink",
    border: "border-lavender-ink/25",
  },
  red: { label: "Růžová", bg: "bg-rose", ink: "text-rose-ink", dot: "bg-rose-ink", bar: "border-l-rose-ink", border: "border-rose-ink/25" },
  sky: { label: "Nebesky modrá", bg: "bg-sky", ink: "text-sky-ink", dot: "bg-sky-ink", bar: "border-l-sky-ink", border: "border-sky-ink/25" },
  orange: { label: "Oranžová", bg: "bg-orange", ink: "text-orange-ink", dot: "bg-orange-ink", bar: "border-l-orange-ink", border: "border-orange-ink/25" },
  slate: { label: "Šedá", bg: "bg-slate-soft", ink: "text-slate-ink", dot: "bg-slate-ink", bar: "border-l-slate-ink", border: "border-slate-ink/20" },
};

export const SUBJECT_COLOR_KEYS = Object.keys(SUBJECT_COLORS) as SubjectColor[];

export function subjectColor(color: string | null | undefined) {
  return SUBJECT_COLORS[(color as SubjectColor) ?? "blue"] ?? SUBJECT_COLORS.blue;
}
