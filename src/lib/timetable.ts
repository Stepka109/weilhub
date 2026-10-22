/**
 * Rozvrh se střídáním týdnů (A → E → B → F) podle Family Station.
 * Čisté funkce bez přístupu k databázi – sestaví jeden týden z výchozího
 * rozvrhu daného týdne cyklu, týdenních změn a celodenních záznamů.
 */
import { differenceInCalendarDays } from "date-fns";
import { dateOnly, shiftDate } from "./dates";
import type { EventKind } from "./types";

export type OverrideKind = "changed" | "new" | "event" | "cancelled";
export type DayKind = "holiday" | "event";
export type CellStatus = "empty" | "default" | "changed" | "roomchanged" | "new" | "event" | "cancelled";

/** Skupina třídy u dělených předmětů. */
export type StudyGroup = "S1" | "S2";
/** Pro koho hodina platí: celá třída, nebo jen jedna skupina. */
export type SlotGroup = "all" | StudyGroup;
/** Zobrazení rozvrhu: jedna skupina, nebo obě vedle sebe. */
export type GroupView = StudyGroup | "both";
export const STUDY_GROUPS: StudyGroup[] = ["S1", "S2"];

export function parseGroupView(v: unknown): GroupView | null {
  const s = typeof v === "string" ? v.toUpperCase() : "";
  return s === "S1" || s === "S2" ? s : s === "OBE" ? "both" : null;
}

export interface Period {
  lesson_number: number;
  start_time: string;
  end_time: string;
}

export interface Slot {
  id?: string;
  cycle_week: string;
  day_of_week: number;
  lesson_number: number;
  subject_code: string;
  subject_name: string;
  teacher: string | null;
  room: string | null;
  study_group?: SlotGroup;
}

export interface Override {
  id: string;
  week_start: string;
  day_of_week: number;
  lesson_number: number;
  kind: OverrideKind;
  subject_code: string | null;
  subject_name: string | null;
  title: string | null;
  teacher: string | null;
  room: string | null;
  note: string | null;
  /** Barva ohraničení odpadlé hodiny */
  accent?: "red" | "green";
  study_group?: SlotGroup;
}

export interface DayOverride {
  id: string;
  date: string;
  kind: DayKind;
  title: string;
  room: string | null;
  teacher: string | null;
}

export interface CycleConfig {
  cycle: string[];
  referenceMonday: string;
  referenceWeek: string;
}

export interface Cell {
  day: number;
  lesson: number;
  status: CellStatus;
  code: string;
  name: string;
  teacher: string;
  room: string;
  note: string;
  base: Slot | null;
  override: Override | null;
  /** Pro koho buňka platí (u prázdné buňky skupina, do které by se hodina přidala) */
  group: SlotGroup;
  /** Sloučeno ze dvou skupin se stejným výsledkem (např. obě odpadají) */
  merged?: boolean;
}

/** Pozice, kde má každá skupina něco jiného – zobrazí se rozdělená na S1 a S2. */
export interface SplitCell {
  type: "split";
  day: number;
  lesson: number;
  s1: Cell;
  s2: Cell;
}

export interface EventSpan {
  type: "span";
  day: number;
  startLesson: number;
  endLesson: number;
  length: number;
  cell: Cell;
}

export interface DayRow {
  date: string;
  day: number;
  outsidePeriod: boolean;
  dayOverride: (Pick<DayOverride, "kind" | "title" | "room" | "teacher"> & { id: string | null; source: "timetable" | "calendar" }) | null;
  items: (Cell | EventSpan | SplitCell)[];
}

export interface TimetableWeek {
  monday: string;
  cycleWeek: string;
  lessons: Period[];
  days: DayRow[];
}

/** Písmeno týdne cyklu pro týden začínající daným pondělím. */
export function cycleWeekFor(monday: string, cfg: CycleConfig): string {
  const n = cfg.cycle.length;
  if (!n) return "";
  const ref = Math.max(0, cfg.cycle.indexOf(cfg.referenceWeek));
  const diff = Math.round(differenceInCalendarDays(dateOnly(monday), dateOnly(cfg.referenceMonday)) / 7);
  return cfg.cycle[(((ref + diff) % n) + n) % n];
}

const clean = (v: string | null | undefined) => (v ?? "").trim();

/** Výsledný stav jedné hodiny: výchozí hodina + případná změna pro tento týden. */
export function effectiveCell(day: number, lesson: number, base: Slot | null, override: Override | null): Cell {
  const cell: Cell = {
    day,
    lesson,
    status: base ? "default" : "empty",
    code: base?.subject_code ?? "",
    name: base?.subject_name ?? "",
    teacher: clean(base?.teacher),
    room: clean(base?.room),
    note: "",
    base,
    override,
    group: "all",
  };
  if (!override) return cell;
  const note = clean(override.note);

  switch (override.kind) {
    case "cancelled":
      return { ...cell, status: base ? "cancelled" : "empty", note };
    case "event":
      return {
        ...cell,
        status: "event",
        code: clean(override.subject_code) || "AKT",
        name: clean(override.title) || "Akce třídy",
        teacher: clean(override.teacher),
        room: clean(override.room),
        note,
      };
    case "new":
      return {
        ...cell,
        status: "new",
        code: clean(override.subject_code),
        name: clean(override.subject_name) || clean(override.subject_code),
        teacher: clean(override.teacher),
        room: clean(override.room),
        note,
      };
    case "changed": {
      const code = clean(override.subject_code) || cell.code;
      const teacher = clean(override.teacher) || cell.teacher;
      const room = clean(override.room) || cell.room;
      // Pouze jiná učebna (stejný předmět i vyučující) = „změna místnosti“
      const roomOnly = !!base && code === base.subject_code && teacher === clean(base.teacher) && room !== clean(base.room);
      return {
        ...cell,
        status: roomOnly ? "roomchanged" : "changed",
        code,
        name: clean(override.subject_name) || (code === cell.code ? cell.name : code),
        teacher,
        room,
        note,
      };
    }
  }
}

const groupOf = (x: { study_group?: SlotGroup } | null) => x?.study_group ?? "all";

/** Hodina nebo změna pro danou skupinu: vlastní skupiny má přednost před celou třídou. */
function pickFor<T extends { study_group?: SlotGroup }>(items: T[], g: StudyGroup): T | null {
  return items.find((i) => groupOf(i) === g) ?? items.find((i) => groupOf(i) === "all") ?? null;
}

function groupCell(day: number, lesson: number, slots: Slot[], overrides: Override[], g: StudyGroup): Cell {
  const base = pickFor(slots, g);
  const override = pickFor(overrides, g);
  const cell = effectiveCell(day, lesson, base, override);
  const specific = groupOf(base) !== "all" || groupOf(override) !== "all";
  return { ...cell, group: specific || cell.status === "empty" ? g : "all" };
}

const signature = (c: Cell) => [c.code, c.name, c.teacher, c.room].join("¦");

/** Obě skupiny mají na místě totéž – zobrazí se jako jedna karta celé třídy. */
function sameForBoth(a: Cell, b: Cell) {
  if (a.status !== b.status || a.status === "empty" || a.note !== b.note) return false;
  // Odpadlé hodiny se sloučí i při různých předmětech (karta je uprostřed prázdná)
  if (a.status === "cancelled") return (a.override?.accent ?? "red") === (b.override?.accent ?? "red");
  return signature(a) === signature(b);
}

function mergeCells(a: Cell, b: Cell): Cell {
  const join = (x: string, y: string) => (x === y ? x : [x, y].filter(Boolean).join(" / "));
  return { ...a, group: "all", merged: true, code: join(a.code, b.code), name: join(a.name, b.name), teacher: join(a.teacher, b.teacher), room: join(a.room, b.room) };
}

export function buildTimetableWeek(input: {
  monday: string;
  config: CycleConfig;
  periods: Period[];
  slots: Slot[];
  overrides: Override[];
  dayOverrides: DayOverride[];
  /** Školní akce a volné dny z kalendáře portálu */
  calendarEvents?: { id: string; kind: EventKind; title: string; start_date: string; end_date: string }[];
  visibleFrom?: string;
  visibleTo?: string;
  /** Administrace může zobrazit všechny hodiny 0.–15. */
  allLessons?: boolean;
  /** Skupina S1, S2, nebo obě (rozdělené buňky). Výchozí jsou obě. */
  group?: GroupView;
}): TimetableWeek {
  const view = input.group ?? "both";
  const { monday, config, periods } = input;
  const cycleWeek = cycleWeekFor(monday, config);
  const weekSlots = input.slots.filter((s) => s.cycle_week === cycleWeek);
  const weekOverrides = input.overrides.filter((o) => o.week_start === monday);

  // Rozsah sloupců: hodiny výchozího rozvrhu (všech týdnů cyklu) a nové/změněné hodiny tohoto týdne.
  const used = new Set<number>(input.slots.map((s) => s.lesson_number));
  for (const o of weekOverrides) if (o.kind === "changed" || o.kind === "new") used.add(o.lesson_number);
  let lessons = [...periods].sort((a, b) => a.lesson_number - b.lesson_number);
  if (!input.allLessons && used.size) {
    const min = Math.min(...used);
    const max = Math.max(...used);
    lessons = lessons.filter((p) => p.lesson_number >= min && p.lesson_number <= max);
  } else if (!input.allLessons) {
    lessons = lessons.filter((p) => p.lesson_number >= 1 && p.lesson_number <= 6);
  }

  const days: DayRow[] = [1, 2, 3, 4, 5].map((day) => {
    const date = shiftDate(monday, day - 1);
    const outsidePeriod =
      (!!input.visibleFrom && date < input.visibleFrom) || (!!input.visibleTo && date > input.visibleTo);

    const dOv = input.dayOverrides.find((d) => d.date === date);
    const calendarDay = (input.calendarEvents ?? []).find(
      (e) => e.kind === "holiday" && e.start_date <= date && e.end_date >= date,
    );
    const dayOverride: DayRow["dayOverride"] = dOv
      ? { id: dOv.id, kind: dOv.kind, title: dOv.title, room: dOv.room, teacher: dOv.teacher, source: "timetable" }
      : calendarDay
        ? { id: null, kind: "holiday", title: calendarDay.title, room: null, teacher: null, source: "calendar" }
        : null;

    const cells = lessons.map((p): Cell | SplitCell => {
      const at = <T extends { day_of_week: number; lesson_number: number }>(list: T[]) =>
        list.filter((x) => x.day_of_week === day && x.lesson_number === p.lesson_number);
      const slots = at(weekSlots);
      const overrides = at(weekOverrides);
      if (view !== "both") return groupCell(day, p.lesson_number, slots, overrides, view);
      const s1 = groupCell(day, p.lesson_number, slots, overrides, "S1");
      const s2 = groupCell(day, p.lesson_number, slots, overrides, "S2");
      const shared = (s1.group === "all" && s2.group === "all") || (s1.status === "empty" && s2.status === "empty");
      if (shared) return { ...s1, group: "all" };
      if (sameForBoth(s1, s2)) return mergeCells(s1, s2);
      return { type: "split", day, lesson: p.lesson_number, s1: { ...s1, group: "S1" }, s2: { ...s2, group: "S2" } };
    });

    // Navazující stejné akce se sloučí do jedné karty
    const items: (Cell | EventSpan | SplitCell)[] = [];
    for (let i = 0; i < cells.length; ) {
      const c = cells[i];
      if (isSplit(c) || c.status !== "event") {
        items.push(c);
        i++;
        continue;
      }
      let j = i + 1;
      while (j < cells.length) {
        const next = cells[j];
        const prev = cells[j - 1] as Cell;
        if (isSplit(next) || next.status !== "event" || next.lesson !== prev.lesson + 1 || signature(next) !== signature(c)) break;
        j++;
      }
      if (j - i > 1) {
        items.push({ type: "span", day, startLesson: c.lesson, endLesson: (cells[j - 1] as Cell).lesson, length: j - i, cell: c });
      } else {
        items.push(c);
      }
      i = j;
    }

    return { date, day, outsidePeriod, dayOverride, items };
  });

  return { monday, cycleWeek, lessons, days };
}

export function isSpan(item: Cell | EventSpan | SplitCell): item is EventSpan {
  return (item as EventSpan).type === "span";
}

export function isSplit(item: Cell | EventSpan | SplitCell): item is SplitCell {
  return (item as SplitCell).type === "split";
}

/** Všechny buňky řádku (rozdělené pozice jako dvě buňky, bez vícehodinových akcí). */
export function rowCells(row: DayRow): Cell[] {
  return row.items.flatMap((i) => (isSpan(i) ? [] : isSplit(i) ? [i.s1, i.s2] : [i]));
}

export const STATUS_LABEL: Record<Exclude<CellStatus, "empty" | "default">, string> = {
  changed: "Změna (suplování)",
  roomchanged: "Změna místnosti",
  new: "Nová hodina",
  event: "Akce třídy",
  cancelled: "Odpadá",
};

export function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/* ------------------------------------------------- úkoly a testy v rozvrhu */

/** Test nebo termín úkolu, který se v rozvrhu ukáže jako odznak T / U. */
export interface TimetableMark {
  kind: "test" | "assignment";
  id: string;
  title: string;
  date: string;
  subjectName: string;
  subjectAbbr: string;
  href: string;
  /** Jen pro jednu skupinu (null = obě) */
  group?: StudyGroup | null;
}

function normSubject(s: string | null | undefined) {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Předmět portálu odpovídá hodině, když se shoduje zkratka s kódem v rozvrhu
 * (CHE = CHE), nebo název (i zkrácený: „Český jazyk“ ~ „Český jazyk a literatura“).
 */
export function markMatchesCell(mark: Pick<TimetableMark, "subjectName" | "subjectAbbr">, cell: Pick<Cell, "code" | "name">) {
  const abbr = normSubject(mark.subjectAbbr);
  if (abbr && abbr === normSubject(cell.code)) return true;
  const a = normSubject(mark.subjectName);
  const b = normSubject(cell.name);
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(`${short} `);
}

export const markKey = (date: string, cell: Pick<Cell, "lesson" | "group">) => `${date}:${cell.lesson}:${cell.group}`;

/**
 * Klíč `datum:hodina:skupina` → značky. Značka patří k první hodině daného
 * předmětu v ten den (u rozdělené hodiny k části správné skupiny).
 */
export function placeMarks(week: TimetableWeek, marks: TimetableMark[]): Map<string, TimetableMark[]> {
  const placed = new Map<string, TimetableMark[]>();
  for (const mark of marks) {
    const row = week.days.find((d) => d.date === mark.date);
    if (!row || row.outsidePeriod || row.dayOverride) continue;
    const fits = rowCells(row).filter(
      (c) =>
        c.status !== "empty" &&
        c.status !== "event" &&
        (!mark.group || c.group === "all" || c.group === mark.group) &&
        markMatchesCell(mark, c),
    );
    if (!fits.length) continue;
    for (const cell of fits.filter((c) => c.lesson === fits[0].lesson)) {
      const key = markKey(row.date, cell);
      placed.set(key, [...(placed.get(key) ?? []), mark]);
    }
  }
  return placed;
}
