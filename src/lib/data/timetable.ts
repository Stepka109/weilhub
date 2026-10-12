import "server-only";
import { createClient } from "@/lib/supabase/server";
import { shiftDate } from "@/lib/dates";
import {
  buildTimetableWeek,
  type CycleConfig,
  type DayOverride,
  type Override,
  type Period,
  type Slot,
  type TimetableWeek,
} from "@/lib/timetable";
import type { EventKind } from "@/lib/types";

export interface TimetableSubject {
  id: string;
  code: string;
  name: string;
  default_teacher: string | null;
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
export async function getTimetableWeek(monday: string, opts: { allLessons?: boolean } = {}): Promise<TimetablePageData> {
  const supabase = await createClient();
  const friday = shiftDate(monday, 4);
  const [settingsRes, periods, slots, overrides, dayOverrides, events] = await Promise.all([
    supabase
      .from("app_settings")
      .select("timetable_cycle, timetable_reference_monday, timetable_reference_week, timetable_visible_from, timetable_visible_to")
      .single(),
    supabase.from("timetable_periods").select("lesson_number, start_time, end_time").order("lesson_number"),
    supabase.from("timetable_slots").select("id, cycle_week, day_of_week, lesson_number, subject_code, subject_name, teacher, room"),
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
  });

  return { week, settings, hasAnySlots: (slots.data ?? []).length > 0 };
}

export async function getTimetableCatalog() {
  const supabase = await createClient();
  const [subjects, teachers] = await Promise.all([
    supabase.from("timetable_subjects").select("id, code, name, default_teacher").order("code"),
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
