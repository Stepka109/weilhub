import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate, formatTime, schoolWeek, shiftDate, todayIso, WEEKDAYS } from "@/lib/dates";
import { notify, pushConfigured } from "@/lib/push";
import { cycleWeekFor } from "@/lib/timetable";

/**
 * Kdy posílat push upozornění: jen při zveřejnění (koncept → publikováno,
 * nebo rovnou publikovaný nový záznam). Úpravy už zveřejněného obsahu
 * upozornění neposílají, aby studenty nezahlcovaly.
 */
export type PushTable = "exams" | "assignments" | "materials" | "announcements";

/** Stav záznamu před uložením (null = nový záznam). */
export async function statusBefore(supabase: SupabaseClient, table: PushTable | "events", id: string | null) {
  if (!id || !pushConfigured()) return null;
  const { data } = await supabase.from(table).select("status").eq("id", id).maybeSingle();
  return (data?.status as string | undefined) ?? null;
}

const short = (date: string) => formatDate(date, "EEEEEE d. M.");
const group = (g: unknown) => (g === "S1" || g === "S2" ? g : null);

/** Po zveřejnění pošle upozornění odběratelům (až po odpovědi uživateli). */
export function notifyPublished(supabase: SupabaseClient, table: PushTable, id: string, before: string | null, now: string) {
  if (!pushConfigured() || now !== "published" || before === "published") return;
  after(async () => {
    if (table === "exams") {
      const { data: e } = await supabase.from("exams").select("title, exam_date, exam_time, study_group, subject:subjects(name)").eq("id", id).maybeSingle();
      if (!e) return;
      const subject = (e.subject as unknown as { name: string } | null)?.name ?? "Test";
      await notify(
        supabase,
        "tests",
        { title: `Nový test: ${subject}`, body: `${e.title} · ${short(e.exam_date)}${e.exam_time ? ` v ${formatTime(e.exam_time)}` : ""}`, url: `/testy#test-${id}`, tag: `test-${id}` },
        group(e.study_group),
      );
    } else if (table === "assignments") {
      const { data: a } = await supabase.from("assignments").select("title, due_date, study_group, subject:subjects(name)").eq("id", id).maybeSingle();
      if (!a) return;
      const subject = (a.subject as unknown as { name: string } | null)?.name ?? "Úkol";
      await notify(
        supabase,
        "assignments",
        { title: `Nový úkol: ${subject}`, body: `${a.title} · do ${short(a.due_date)}`, url: `/ukoly/${id}`, tag: `ukol-${id}` },
        group(a.study_group),
      );
    } else if (table === "materials") {
      const { data: m } = await supabase.from("materials").select("title, study_group, subject:subjects(name)").eq("id", id).maybeSingle();
      if (!m) return;
      const subject = (m.subject as unknown as { name: string } | null)?.name ?? "Materiál";
      await notify(supabase, "materials", { title: `Nový materiál: ${subject}`, body: m.title, url: `/materialy/${id}`, tag: `material-${id}` }, group(m.study_group));
    } else {
      const { data: n } = await supabase.from("announcements").select("title, body, kind, event_date, event_time").eq("id", id).maybeSingle();
      if (!n) return;
      const when = n.event_date ? `${short(n.event_date)}${n.event_time ? ` v ${formatTime(n.event_time)}` : ""}` : "";
      const title = n.kind === "event" ? `Událost: ${n.title}` : n.kind === "deadline" ? `Termín: ${n.title}` : n.title;
      const body = n.kind === "event" ? when : n.kind === "deadline" ? `do ${when}` : n.body.slice(0, 140) || "Nové oznámení ve WeilHubu";
      await notify(supabase, "announcements", { title, body, url: "/oznameni", tag: `oznameni-${id}` });
    }
  });
}

/**
 * Změna rozvrhu (odpadá, suplování, akce, nová hodina) – jen pro tento
 * a příští týden, ať upozornění chodí na to, co je aktuální.
 */
export function notifyTimetableChange(
  supabase: SupabaseClient,
  change: {
    week_start: string;
    day_of_week: number;
    lesson_number: number;
    lesson_to: number;
    kind: "changed" | "new" | "event" | "cancelled";
    label: string;
    study_group: "all" | "S1" | "S2";
  },
) {
  if (!pushConfigured()) return;
  const thisMonday = schoolWeek(todayIso())[0];
  if (change.week_start < thisMonday || change.week_start > shiftDate(thisMonday, 7)) return;
  const date = shiftDate(change.week_start, change.day_of_week - 1);
  if (date < todayIso()) return;
  const lessons = change.lesson_to > change.lesson_number ? `${change.lesson_number}.–${change.lesson_to}. hodina` : `${change.lesson_number}. hodina`;
  const groupLabel = change.study_group === "all" ? "" : ` (skupina ${change.study_group})`;
  after(async () => {
    let label = change.label;
    // U odpadlé hodiny dohledat předmět z výchozího rozvrhu
    if (change.kind === "cancelled" && !label) {
      const { data: cfg } = await supabase
        .from("app_settings")
        .select("timetable_cycle, timetable_reference_monday, timetable_reference_week")
        .maybeSingle();
      if (cfg) {
        const week = cycleWeekFor(change.week_start, {
          cycle: cfg.timetable_cycle,
          referenceMonday: cfg.timetable_reference_monday,
          referenceWeek: cfg.timetable_reference_week,
        });
        const { data: slots } = await supabase
          .from("timetable_slots")
          .select("subject_code, study_group")
          .eq("cycle_week", week)
          .eq("day_of_week", change.day_of_week)
          .eq("lesson_number", change.lesson_number);
        const own = (slots ?? []).find((x) => x.study_group === change.study_group) ?? (slots ?? []).find((x) => x.study_group === "all");
        label = own?.subject_code ?? "";
      }
    }
    const what = {
      cancelled: `${label ? `${label} ` : ""}odpadá`,
      changed: `změna: ${label}`,
      new: `navíc: ${label}`,
      event: `akce: ${label}`,
    }[change.kind];
    await notify(
      supabase,
      "timetable",
      {
        title: `Změna v rozvrhu${groupLabel}`,
        body: `${WEEKDAYS[change.day_of_week - 1]} ${formatDate(date, "d. M.")} · ${lessons}: ${what}`,
        url: `/rozvrh?tyden=${change.week_start}`,
        tag: `rozvrh-${date}-${change.lesson_number}-${change.study_group}`,
      },
      change.study_group === "all" ? null : change.study_group,
    );
  });
}
