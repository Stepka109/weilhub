"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { dbErrorMessage, idSchema, invalid, revalidateAll, withRole } from "./helpers";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Neplatné datum.");
const monday = date.refine((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 1, "Týden musí začínat pondělím.");
const day = z.coerce.number().int().min(1).max(5);
const lesson = z.coerce.number().int().min(0).max(15);
const cycleWeek = z.string().regex(/^[A-Z]$/, "Neplatný týden cyklu.");
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maximálně ${max} znaků.`)
    .transform((v) => (v === "" || v === "-" ? null : v))
    .nullable()
    .optional();
const code = z
  .string()
  .trim()
  .min(1, "Vyberte předmět.")
  .max(10, "Zkratka může mít nejvýše 10 znaků.")
  .transform((v) => v.toUpperCase());

/* ------------------------------------------------------------ výchozí hodina */

const slotSchema = z.object({
  cycle_week: cycleWeek,
  day_of_week: day,
  lesson_number: lesson,
  subject_code: code,
  subject_name: z.string().trim().min(1, "Zadejte název předmětu.").max(120),
  teacher: text(120),
  room: text(40),
});

/** Uloží trvalou hodinu výchozího rozvrhu pro daný týden cyklu. */
export async function saveSlot(input: z.input<typeof slotSchema>): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = slotSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { error } = await supabase
      .from("timetable_slots")
      .upsert(parsed.data, { onConflict: "cycle_week,day_of_week,lesson_number" });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: `Výchozí hodina pro týden ${parsed.data.cycle_week} byla uložena.` };
  });
}

export async function deleteSlot(input: { cycle_week: string; day_of_week: number; lesson_number: number }): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = z.object({ cycle_week: cycleWeek, day_of_week: day, lesson_number: lesson }).safeParse(input);
    if (!parsed.success) return { ok: false, error: "Neplatná hodina." };
    const { error } = await supabase
      .from("timetable_slots")
      .delete()
      .eq("cycle_week", parsed.data.cycle_week)
      .eq("day_of_week", parsed.data.day_of_week)
      .eq("lesson_number", parsed.data.lesson_number);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: "Hodina byla odebrána z výchozího rozvrhu." };
  });
}

/* --------------------------------------------------------------- týdenní změna */

const overrideSchema = z
  .object({
    week_start: monday,
    day_of_week: day,
    lesson_number: lesson,
    /** Akce může pokrýt více navazujících hodin */
    lesson_to: lesson.optional(),
    kind: z.enum(["changed", "new", "event", "cancelled"]),
    subject_code: text(10),
    subject_name: text(120),
    title: text(120),
    teacher: text(120),
    room: text(40),
    note: text(300),
    accent: z.enum(["red", "green"]).optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.kind === "changed" || v.kind === "new") && !v.subject_code) {
      ctx.addIssue({ code: "custom", message: "Vyberte předmět.", path: ["subject_code"] });
    }
    if (v.lesson_to !== undefined && v.lesson_to < v.lesson_number) {
      ctx.addIssue({ code: "custom", message: "Konec nemůže být před začátkem.", path: ["lesson_to"] });
    }
  });

/** Změna jen pro jeden týden – výchozí rozvrh se nemění. */
export async function saveOverride(input: z.input<typeof overrideSchema>): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = overrideSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { lesson_to, ...d } = parsed.data;
    const last = d.kind === "event" && lesson_to !== undefined ? lesson_to : d.lesson_number;
    const rows = [];
    for (let l = d.lesson_number; l <= last; l++) {
      rows.push({
        ...d,
        lesson_number: l,
        subject_code: d.kind === "cancelled" ? null : d.kind === "event" ? (d.subject_code ?? "AKT") : d.subject_code?.toUpperCase(),
        subject_name: d.kind === "changed" || d.kind === "new" ? d.subject_name : null,
        title: d.kind === "event" ? (d.title ?? "Akce třídy") : null,
        teacher: d.kind === "cancelled" ? null : d.teacher,
        room: d.kind === "cancelled" ? null : d.room,
        accent: d.kind === "cancelled" ? (d.accent ?? "red") : "red",
      });
    }
    const { error } = await supabase.from("timetable_overrides").upsert(rows, { onConflict: "week_start,day_of_week,lesson_number" });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    const label = { changed: "Změna", new: "Nová hodina", event: "Akce", cancelled: "Zrušení hodiny" }[d.kind];
    return { ok: true, message: `${label} pro tento týden byla uložena.` };
  });
}

/** Vrátí hodinu do běžného stavu (smaže změnu pro daný týden). */
export async function clearOverride(input: { week_start: string; day_of_week: number; lesson_number: number }): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = z.object({ week_start: monday, day_of_week: day, lesson_number: lesson }).safeParse(input);
    if (!parsed.success) return { ok: false, error: "Neplatná hodina." };
    const { error } = await supabase
      .from("timetable_overrides")
      .delete()
      .eq("week_start", parsed.data.week_start)
      .eq("day_of_week", parsed.data.day_of_week)
      .eq("lesson_number", parsed.data.lesson_number);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: "Hodina je zase podle výchozího rozvrhu." };
  });
}

/* ---------------------------------------------------------- celodenní záznam */

const daySchema = z.object({
  date: date.refine((d) => {
    const w = new Date(`${d}T12:00:00Z`).getUTCDay();
    return w >= 1 && w <= 5;
  }, "Celodenní záznam lze zadat jen pro pracovní den."),
  kind: z.enum(["holiday", "event"]),
  title: z.string().trim().min(1, "Zadejte text dne.").max(120),
  room: text(40),
  teacher: text(120),
});

export async function saveDayOverride(input: z.input<typeof daySchema>): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = daySchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { error } = await supabase.from("timetable_day_overrides").upsert(parsed.data, { onConflict: "date" });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: parsed.data.kind === "event" ? "Celodenní akce byla uložena." : "Volný den byl uložen." };
  });
}

export async function deleteDayOverride(d: string): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    if (!date.safeParse(d).success) return { ok: false, error: "Neplatné datum." };
    const { error } = await supabase.from("timetable_day_overrides").delete().eq("date", d);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: "Celodenní záznam byl smazán." };
  });
}

/* -------------------------------------------------- předměty a vyučující */

const subjectSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ0-9]{1,10}$/, "Zkratka: 1–10 velkých písmen nebo číslic.")),
  name: z.string().trim().min(1, "Zadejte název.").max(120),
  default_teacher: text(120),
});

export async function saveTimetableSubject(id: string | null, input: z.input<typeof subjectSchema>): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = subjectSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    if (id && !idSchema.safeParse(id).success) return { ok: false, error: "Neplatný předmět." };
    const { error } = id
      ? await supabase.from("timetable_subjects").update(parsed.data).eq("id", id)
      : await supabase.from("timetable_subjects").insert(parsed.data);
    if (error) return { ok: false, error: error.code === "23505" ? "Předmět s touto zkratkou už existuje." : dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: id ? "Předmět byl uložen." : "Předmět byl přidán." };
  });
}

export async function deleteTimetableSubject(id: string): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Neplatný předmět." };
    const { error } = await supabase.from("timetable_subjects").delete().eq("id", id);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: "Předmět byl odebrán z nabídky. Hodiny v rozvrhu zůstaly beze změny." };
  });
}

export async function addTimetableTeacher(name: string): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = z.string().trim().min(2, "Zadejte jméno.").max(120).safeParse(name);
    if (!parsed.success) return invalid(parsed.error);
    const { error } = await supabase.from("timetable_teachers").insert({ name: parsed.data });
    if (error) return { ok: false, error: error.code === "23505" ? "Tento vyučující už v seznamu je." : dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: "Vyučující byl přidán." };
  });
}

export async function deleteTimetableTeacher(id: string): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Neplatný vyučující." };
    const { error } = await supabase.from("timetable_teachers").delete().eq("id", id);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: "Vyučující byl odebrán ze seznamu." };
  });
}

/* ------------------------------------------------------- období a cyklus */

const periodSchema = z
  .object({
    timetable_visible_from: date,
    timetable_visible_to: date,
    timetable_cycle: z
      .string()
      .transform((v) =>
        v
          .toUpperCase()
          .split(/[^A-Z]+/)
          .filter(Boolean),
      )
      .pipe(
        z
          .array(z.string().regex(/^[A-Z]$/))
          .min(1, "Zadejte alespoň jeden týden.")
          .max(8)
          .refine((a) => new Set(a).size === a.length, "Písmena týdnů se nesmí opakovat."),
      ),
    timetable_reference_monday: monday,
    timetable_reference_week: cycleWeek,
  })
  .refine((v) => v.timetable_visible_to >= v.timetable_visible_from, {
    message: "Konec nemůže být před začátkem.",
    path: ["timetable_visible_to"],
  })
  .refine((v) => v.timetable_cycle.includes(v.timetable_reference_week), {
    message: "Týden musí být součástí cyklu.",
    path: ["timetable_reference_week"],
  });

/** Období zobrazení a nastavení střídání týdnů (smí jen administrátor). */
export async function saveTimetablePeriod(input: z.input<typeof periodSchema>): Promise<ActionResult> {
  return withRole("admin", async ({ supabase }) => {
    const parsed = periodSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { error } = await supabase.from("app_settings").update(parsed.data).eq("id", true);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: "Období zobrazení bylo uloženo." };
  });
}
