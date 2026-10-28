/**
 * Data pro widget rozvrhu (Scriptable na iPhonu). Čisté funkce bez přístupu
 * k databázi: z dat rozvrhu sestaví jeden den – dnešní, dokud neskončí
 * výuka, jinak nejbližší další školní den.
 */
import { WEEKDAYS, formatDate, schoolWeek, shiftDate } from "./dates";
import {
  buildTimetableWeek,
  isSpan,
  isSplit,
  minutes,
  type Cell,
  type CycleConfig,
  type DayOverride,
  type DayRow,
  type GroupView,
  type Override,
  type Period,
  type Slot,
  type StudyGroup,
  type TimetableWeek,
} from "./timetable";
import type { EventKind } from "./types";

export interface WidgetRaw {
  group: StudyGroup | null;
  settings: CycleConfig & { classLabel: string; visibleFrom: string; visibleTo: string };
  periods: Period[];
  slots: Slot[];
  overrides: Override[];
  dayOverrides: DayOverride[];
  holidays: { id: string; kind: EventKind; title: string; start_date: string; end_date: string }[];
}

export interface WidgetLesson {
  /** Číslo hodiny (u vícehodinové akce první) a poslední hodina */
  lesson: number;
  lessonTo: number;
  start: string;
  end: string;
  status: Exclude<Cell["status"], "empty">;
  code: string;
  name: string;
  teacher: string;
  room: string;
  /** Doplňující text: poznámka, suplující učitel apod. */
  detail: string;
  group: "all" | StudyGroup;
  accent: "red" | "green";
}

export interface WidgetDay {
  date: string;
  /** „Dnes“, „Zítra“ nebo název dne */
  relative: string;
  label: string;
  cycleWeek: string;
  group: StudyGroup | null;
  classLabel: string;
  dayOverride: { kind: "holiday" | "event"; title: string; room: string | null; teacher: string | null } | null;
  lessons: WidgetLesson[];
}

const hhmm = (t: string) => t.slice(0, 5);

function toLesson(cell: Cell, week: TimetableWeek, lessonTo = cell.lesson): WidgetLesson | null {
  if (cell.status === "empty") return null;
  const start = week.lessons.find((l) => l.lesson_number === cell.lesson);
  const end = week.lessons.find((l) => l.lesson_number === lessonTo);
  if (!start || !end) return null;
  let detail = cell.note;
  if (!detail && cell.status === "changed" && cell.base && cell.teacher && cell.teacher !== (cell.base.teacher ?? "")) {
    detail = `supl. ${cell.teacher}`;
  }
  if (!detail && cell.status === "roomchanged" && cell.base?.room) detail = `místo ${cell.base.room}`;
  return {
    lesson: cell.lesson,
    lessonTo,
    start: hhmm(start.start_time),
    end: hhmm(end.end_time),
    status: cell.status,
    code: cell.code,
    name: cell.name,
    teacher: cell.teacher,
    room: cell.room,
    detail: detail || cell.teacher,
    group: cell.group,
    accent: cell.override?.accent === "green" ? "green" : "red",
  };
}

/** Hodiny jednoho dne jako seznam (rozdělená hodina = dva řádky S1 a S2). */
export function dayLessons(row: DayRow, week: TimetableWeek): WidgetLesson[] {
  if (row.outsidePeriod || row.dayOverride) return [];
  const out: WidgetLesson[] = [];
  for (const item of row.items) {
    const parts = isSpan(item) ? [toLesson(item.cell, week, item.endLesson)] : isSplit(item) ? [toLesson(item.s1, week), toLesson(item.s2, week)] : [toLesson(item, week)];
    for (const p of parts) if (p) out.push(p);
  }
  return out;
}

function buildWeek(raw: WidgetRaw, monday: string, group: GroupView) {
  return buildTimetableWeek({
    monday,
    config: raw.settings,
    periods: raw.periods,
    slots: raw.slots,
    overrides: raw.overrides,
    dayOverrides: raw.dayOverrides,
    calendarEvents: raw.holidays,
    visibleFrom: raw.settings.visibleFrom,
    visibleTo: raw.settings.visibleTo,
    group,
  });
}

/**
 * Den pro widget: dnes, dokud neskončí poslední hodina, jinak nejbližší
 * další den s výukou nebo celodenní akcí (víkendy a volné dny se přeskočí).
 */
export function widgetDay(raw: WidgetRaw, today: string, nowMin: number): WidgetDay | null {
  const group: GroupView = raw.group ?? "both";
  const weeks = new Map<string, TimetableWeek>();
  const weekFor = (date: string) => {
    const monday = schoolWeek(date)[0];
    if (!weeks.has(monday)) weeks.set(monday, buildWeek(raw, monday, group));
    return weeks.get(monday)!;
  };

  for (let i = 0; i <= 14; i++) {
    const date = shiftDate(today, i);
    const week = weekFor(date);
    const row = week.days.find((d) => d.date === date);
    if (!row || row.outsidePeriod) continue;
    const lessons = dayLessons(row, week);
    const event = row.dayOverride?.kind === "event";
    if (!lessons.length && !event) continue;
    // Dnes už po vyučování → další den
    if (i === 0 && lessons.length && nowMin >= Math.max(...lessons.map((l) => minutes(l.end)))) continue;
    if (i === 0 && !lessons.length && event && nowMin >= 15 * 60) continue;

    const dayIndex = row.day - 1;
    return {
      date,
      relative: i === 0 ? "Dnes" : i === 1 ? "Zítra" : WEEKDAYS[dayIndex],
      label: `${WEEKDAYS[dayIndex]} ${formatDate(date, "d. M.")}`,
      cycleWeek: week.cycleWeek,
      group: raw.group,
      classLabel: raw.settings.classLabel,
      dayOverride: row.dayOverride
        ? { kind: row.dayOverride.kind, title: row.dayOverride.title, room: row.dayOverride.room, teacher: row.dayOverride.teacher }
        : null,
      lessons,
    };
  }
  return null;
}
