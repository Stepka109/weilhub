import "server-only";
import { createClient } from "@/lib/supabase/server";
import { shiftDate } from "@/lib/dates";
import {
  buildTimetableWeek,
  type CycleConfig,
  type DayOverride,
  type GroupView,
  type Override,
  type Period,
  type Slot,
  type StudyGroup,
  type TimetableMark,
  type TimetableWeek,
} from "@/lib/timetable";
import type { EventKind } from "@/lib/types";

export interface TimetableSubject {
  id: string;
  code: string;
  name: string;
  default_teacher: string | null;
  /** Učitel skupiny S1 / S2 (null = stejný jako výchozí) */
  teacher_s1: string | null;
  teacher_s2: string | null;
}

export interface TimetableTeacher {
  id: string;
  name: string;
}

export interface TimetableSettings extends CycleConfig {
  visibleFrom: string;
  visibleTo: string;
}

export interface TimetablePageData {
  week: TimetableWeek;
  settings: TimetableSettings;
  hasAnySlots: boolean;
}

/** Rozvrh jednoho týdne (čtení přes RLS – jen pro schválené uživatele). */
export async function getTimetableWeek(
  monday: string,
  opts: { allLessons?: boolean; group?: GroupView } = {},
): Promise<TimetablePageData> {
  const supabase = await createClient();
  const friday = shiftDate(monday, 4);
  const [settingsRes, periods, slots, overrides, dayOverrides, events] = await Promise.all([
    supabase
      .from("app_settings")
      .select("timetable_cycle, timetable_reference_monday, timetable_reference_week, timetable_visible_from, timetable_visible_to")
      .single(),
    supabase.from("timetable_periods").select("lesson_number, start_time, end_time").order("lesson_number"),
    supabase.from("timetable_slots").select("id, cycle_week, day_of_week, lesson_number, subject_code, subject_name, teacher, room, study_group"),
    supabase.from("timetable_overrides").select("*").eq("week_start", monday),
    supabase.from("timetable_day_overrides").select("*").gte("date", monday).lte("date", friday),
    supabase
      .from("events")
      .select("id, kind, title, start_date, end_date")
      .eq("status", "published")
      .lte("start_date", friday)
      .gte("end_date", monday),
  ]);
  if (periods.error) throw periods.error;
  if (slots.error) throw slots.error;

  const s = settingsRes.data;
  const settings: TimetableSettings = {
    cycle: s?.timetable_cycle ?? ["A", "E", "B", "F"],
    referenceMonday: s?.timetable_reference_monday ?? "2026-09-14",
    referenceWeek: s?.timetable_reference_week ?? "B",
    visibleFrom: s?.timetable_visible_from ?? "2026-09-01",
    visibleTo: s?.timetable_visible_to ?? "2027-06-30",
  };

  const week = buildTimetableWeek({
    monday,
    config: settings,
    periods: (periods.data ?? []) as Period[],
    slots: (slots.data ?? []) as Slot[],
    overrides: (overrides.data ?? []) as Override[],
    dayOverrides: (dayOverrides.data ?? []) as DayOverride[],
    calendarEvents: (events.data ?? []) as { id: string; kind: EventKind; title: string; start_date: string; end_date: string }[],
    visibleFrom: settings.visibleFrom,
    visibleTo: settings.visibleTo,
    allLessons: opts.allLessons,
    group: opts.group,
  });

  return { week, settings, hasAnySlots: (slots.data ?? []).length > 0 };
}

export async function getTimetableCatalog() {
  const supabase = await createClient();
  const [subjects, teachers] = await Promise.all([
    supabase.from("timetable_subjects").select("id, code, name, default_teacher, teacher_s1, teacher_s2").order("code"),
    supabase.from("timetable_teachers").select("id, name").order("name"),
  ]);
  return {
    subjects: (subjects.data ?? []) as TimetableSubject[],
    teachers: (teachers.data ?? []) as TimetableTeacher[],
  };
}

/** Celodenní záznamy rozvrhu pro kalendář portálu. */
export async function getTimetableDayOverrides(from: string, to: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("timetable_day_overrides").select("*").gte("date", from).lte("date", to);
  return (data ?? []) as DayOverride[];
}

/** Zveřejněné testy a termíny úkolů v daném týdnu – pro odznaky T / U v rozvrhu. */
export async function getTimetableMarks(monday: string): Promise<TimetableMark[]> {
  const supabase = await createClient();
  const friday = shiftDate(monday, 4);
  const subject = "subject:subjects!inner(name, abbreviation)";
  const [exams, assignments] = await Promise.all([
    supabase.from("exams").select(`id, title, exam_date, study_group, ${subject}`).eq("status", "published").gte("exam_date", monday).lte("exam_date", friday),
    supabase.from("assignments").select(`id, title, due_date, study_group, ${subject}`).eq("status", "published").gte("due_date", monday).lte("due_date", friday),
  ]);
  type Ref = { name: string; abbreviation: string };
  type Group = { study_group: StudyGroup | null };
  const marks: TimetableMark[] = [];
  for (const e of (exams.data ?? []) as unknown as ({ id: string; title: string; exam_date: string; subject: Ref } & Group)[]) {
    marks.push({ kind: "test", id: e.id, title: e.title, date: e.exam_date, subjectName: e.subject.name, subjectAbbr: e.subject.abbreviation, href: `/testy#test-${e.id}`, group: e.study_group });
  }
  for (const a of (assignments.data ?? []) as unknown as ({ id: string; title: string; due_date: string; subject: Ref } & Group)[]) {
    marks.push({ kind: "assignment", id: a.id, title: a.title, date: a.due_date, subjectName: a.subject.name, subjectAbbr: a.subject.abbreviation, href: `/ukoly/${a.id}`, group: a.study_group });
  }
  return marks;
}
