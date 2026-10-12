import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfISOWeek,
} from "date-fns";
import { cs } from "date-fns/locale";

export const TIME_ZONE = "Europe/Prague";

/** Dnešní datum v Praze jako „yyyy-MM-dd“ (nezávisle na časové zóně serveru). */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE }).format(now);
}

/** Datum (yyyy-MM-dd) jako lokální půlnoc – bez posunu časové zóny. */
export function dateOnly(iso: string): Date {
  return parseISO(iso.slice(0, 10));
}

export function formatDate(iso: string, pattern = "d. M. yyyy"): string {
  return format(dateOnly(iso), pattern, { locale: cs });
}

export function formatLongDate(iso: string): string {
  return format(dateOnly(iso), "EEEE d. MMMM yyyy", { locale: cs });
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** Datum vytvoření/úpravy (timestamptz) jako „12. 10. 2026“ v pražském čase. */
export function formatTimestampDate(iso: string): string {
  return formatDate(todayIso(new Date(iso)));
}

/** „08:00:00“ → „8:00“ */
export function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  return `${Number(h)}:${m}`;
}

/** Termín: datum a volitelně čas. Bez času se čas nevymýšlí. */
export function formatDue(date: string, time: string | null | undefined): string {
  const d = formatDate(date, "EEEEEE d. M.");
  return time ? `${d} v ${formatTime(time)}` : d;
}

export type DueTone = "overdue" | "today" | "soon" | "later";

export interface DueInfo {
  label: string;
  tone: DueTone;
  days: number;
}

/** Relativní štítek termínu: Dnes / Zítra / Za 3 dny / Po termínu. */
export function dueInfo(dueDate: string, today: string = todayIso()): DueInfo {
  const days = differenceInCalendarDays(dateOnly(dueDate), dateOnly(today));
  if (days < 0) {
    const late = Math.abs(days);
    const label = late === 1 ? "Po termínu (včera)" : `Po termínu (${late} ${late < 5 ? "dny" : "dní"})`;
    return { days, tone: "overdue", label };
  }
  if (days === 0) return { days, tone: "today", label: "Dnes" };
  if (days === 1) return { days, tone: "soon", label: "Zítra" };
  if (days <= 4) return { days, tone: "soon", label: `Za ${days} dny` };
  return { days, tone: "later", label: `Za ${days} dní` };
}

/** Pondělí až pátek týdne obsahujícího dané datum. */
export function schoolWeek(iso: string): string[] {
  const monday = startOfISOWeek(dateOnly(iso));
  return Array.from({ length: 5 }, (_, i) => format(addDays(monday, i), "yyyy-MM-dd"));
}

export function shiftDate(iso: string, days: number): string {
  return format(addDays(dateOnly(iso), days), "yyyy-MM-dd");
}

/** 1 = pondělí … 7 = neděle */
export function isoWeekday(iso: string): number {
  const d = dateOnly(iso).getDay();
  return d === 0 ? 7 : d;
}

export const WEEKDAYS = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"];
export const WEEKDAYS_SHORT = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

export function greetingDate(today: string = todayIso()): string {
  const s = formatLongDate(today);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
