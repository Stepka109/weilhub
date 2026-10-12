import { CalendarOff, ClipboardCheck, FileCheck, PartyPopper, Sparkles } from "lucide-react";
import type { CalendarItem } from "@/lib/data/portal";

/** Barvy a ikonky typů událostí v kalendáři (barva je vždy doplněna textem). */
export const KIND_META: Record<CalendarItem["kind"], { label: string; icon: typeof FileCheck; chip: string; dot: string }> = {
  exam: { label: "Test", icon: FileCheck, chip: "bg-rose text-rose-ink", dot: "bg-rose-ink" },
  assignment: { label: "Termín úkolu", icon: ClipboardCheck, chip: "bg-light-blue text-primary", dot: "bg-primary" },
  school_event: { label: "Školní akce", icon: PartyPopper, chip: "bg-lavender text-lavender-ink", dot: "bg-lavender-ink" },
  holiday: { label: "Volno", icon: CalendarOff, chip: "bg-mint text-mint-ink", dot: "bg-mint-ink" },
  other: { label: "Událost", icon: Sparkles, chip: "bg-yellow text-yellow-ink", dot: "bg-yellow-ink" },
};
