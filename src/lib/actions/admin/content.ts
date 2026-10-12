"use server";

import { z } from "zod";
import { slugify } from "@/lib/utils";
import {
  announcementSchema,
  eventSchema,
  examSchema,
  linkSchema,
  publicationStatus,
  subjectSchema,
  topicSchema,
} from "@/lib/validation/admin";
import type { ActionResult } from "@/lib/types";
import { dbErrorMessage, idSchema, invalid, revalidateAll, withRole } from "./helpers";

type Input<T extends z.ZodType> = z.input<T>;


/* ------------------------------------------------------------------ Předměty */

export async function saveSubject(id: string | null, input: Input<typeof subjectSchema>): Promise<ActionResult<{ id: string }>> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = subjectSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    if (id && !idSchema.safeParse(id).success) return { ok: false, error: "Neplatný předmět." };
    const { slug: rawSlug, ...data } = parsed.data;
    const slug = rawSlug || slugify(data.name) || `predmet-${Date.now()}`;

    if (id) {
      const { error } = await supabase.from("subjects").update({ ...data, slug }).eq("id", id);
      if (error) return { ok: false, error: error.code === "23505" ? "Adresa (slug) už je použita u jiného předmětu." : dbErrorMessage(error) };
      revalidateAll();
      return { ok: true, data: { id }, message: "Předmět byl uložen." };
    }
    const { data: max } = await supabase.from("subjects").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data: row, error } = await supabase
      .from("subjects")
      .insert({ ...data, slug, sort_order: (max?.sort_order ?? 0) + 1 })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.code === "23505" ? "Předmět se stejnou adresou (slug) už existuje." : dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, data: { id: row.id }, message: "Předmět byl vytvořen." };
  });
}

export async function setSubjectArchived(id: string, archived: boolean): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Neplatný předmět." };
    const { error } = await supabase.from("subjects").update({ is_archived: archived }).eq("id", id);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: archived ? "Předmět byl archivován." : "Předmět je opět aktivní." };
  });
}

/** Smazání je povoleno jen pro předmět bez materiálů, úkolů a testů. */
export async function deleteSubject(id: string): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Neplatný předmět." };
    const counts = await Promise.all(
      (["materials", "assignments", "exams"] as const).map((t) =>
        supabase.from(t).select("id", { count: "exact", head: true }).eq("subject_id", id),
      ),
    );
    const used = counts.reduce((n, r) => n + (r.count ?? 0), 0);
    if (used > 0) {
      return { ok: false, error: `Předmět nelze smazat – obsahuje ${used} položek (materiály, úkoly nebo testy). Můžete ho archivovat.` };
    }
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: "Předmět byl smazán." };
  });
}

/** Uloží nové pořadí (pole ID v požadovaném pořadí). */
export async function reorder(table: "subjects" | "subject_topics" | "useful_links", ids: string[]): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    if (!["subjects", "subject_topics", "useful_links"].includes(table)) return { ok: false, error: "Neplatná tabulka." };
    const parsed = z.array(idSchema).max(500).safeParse(ids);
    if (!parsed.success) return { ok: false, error: "Neplatné pořadí." };
    const results = await Promise.all(
      parsed.data.map((id, i) => supabase.from(table).update({ sort_order: i + 1 }).eq("id", id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) return { ok: false, error: dbErrorMessage(failed.error) };
    revalidateAll();
    return { ok: true };
  });
}

/* --------------------------------------------------------- Tematické okruhy */

export async function saveTopic(id: string | null, input: Input<typeof topicSchema>): Promise<ActionResult<{ id: string }>> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = topicSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    if (id) {
      const { error } = await supabase.from("subject_topics").update({ name: parsed.data.name, description: parsed.data.description }).eq("id", id);
      if (error) return { ok: false, error: dbErrorMessage(error) };
      revalidateAll();
      return { ok: true, data: { id }, message: "Téma bylo uloženo." };
    }
    const { data: max } = await supabase
      .from("subject_topics")
      .select("sort_order")
      .eq("subject_id", parsed.data.subject_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await supabase
      .from("subject_topics")
      .insert({ ...parsed.data, sort_order: (max?.sort_order ?? 0) + 1 })
      .select("id")
      .single();
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, data: { id: data.id }, message: "Téma bylo přidáno." };
  });
}

export async function deleteTopic(id: string): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Neplatné téma." };
    // Materiály zůstanou zachovány, jen ztratí zařazení (ON DELETE SET NULL)
    const { error } = await supabase.from("subject_topics").delete().eq("id", id);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: "Téma bylo smazáno. Jeho materiály zůstaly zachovány." };
  });
}

/* -------------------------------------------------------------------- Testy */

async function syncRelations(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  table: "exam_materials" | "assignment_materials",
  column: "exam_id" | "assignment_id",
  id: string,
  materialIds: string[],
) {
  const del = await supabase.from(table).delete().eq(column, id);
  if (del.error) return del.error;
  if (!materialIds.length) return null;
  const ins = await supabase.from(table).insert([...new Set(materialIds)].map((m) => ({ [column]: id, material_id: m })));
  return ins.error;
}

export async function saveExam(id: string | null, input: Input<typeof examSchema>): Promise<ActionResult<{ id: string }>> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = examSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { material_ids, ...data } = parsed.data;
    let examId = id;
    if (id) {
      const { error } = await supabase.from("exams").update(data).eq("id", id);
      if (error) return { ok: false, error: dbErrorMessage(error) };
    } else {
      const { data: row, error } = await supabase.from("exams").insert(data).select("id").single();
      if (error) return { ok: false, error: dbErrorMessage(error) };
      examId = row.id;
    }
    const relErr = await syncRelations(supabase, "exam_materials", "exam_id", examId!, material_ids);
    if (relErr) return { ok: false, error: "Test byl uložen, ale související materiály se nepodařilo propojit." };
    revalidateAll();
    return { ok: true, data: { id: examId! }, message: id ? "Test byl uložen." : "Test byl vytvořen." };
  });
}

/* ------------------------------------------------- Obecné: stav a mazání */

const STATUS_TABLES = ["materials", "assignments", "exams", "events", "announcements"] as const;
type StatusTable = (typeof STATUS_TABLES)[number];

export async function setStatus(table: StatusTable, id: string, status: z.infer<typeof publicationStatus>): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    if (!STATUS_TABLES.includes(table) || !idSchema.safeParse(id).success || !publicationStatus.safeParse(status).success) {
      return { ok: false, error: "Neplatný požadavek." };
    }
    const { error } = await supabase.from(table).update({ status }).eq("id", id);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    const msg = { draft: "Staženo z publikace (koncept).", published: "Publikováno.", archived: "Archivováno." }[status];
    return { ok: true, message: msg };
  });
}

const DELETE_TABLES = ["exams", "events", "announcements", "useful_links"] as const;

export async function deleteRow(table: (typeof DELETE_TABLES)[number], id: string): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    if (!DELETE_TABLES.includes(table) || !idSchema.safeParse(id).success) return { ok: false, error: "Neplatný požadavek." };
    const { error, count } = await supabase.from(table).delete({ count: "exact" }).eq("id", id);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    if (!count) return { ok: false, error: "Záznam nebyl nalezen." };
    revalidateAll();
    return { ok: true, message: "Smazáno." };
  });
}

/* -------------------------------------------------------------------- Akce */

export async function saveEvent(id: string | null, input: Input<typeof eventSchema>): Promise<ActionResult<{ id: string }>> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = eventSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const q = id
      ? supabase.from("events").update(parsed.data).eq("id", id).select("id").single()
      : supabase.from("events").insert(parsed.data).select("id").single();
    const { data, error } = await q;
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, data: { id: data.id }, message: "Událost byla uložena." };
  });
}

/* ----------------------------------------------------------------- Oznámení */

export async function saveAnnouncement(id: string | null, input: Input<typeof announcementSchema>): Promise<ActionResult<{ id: string }>> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = announcementSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const q = id
      ? supabase.from("announcements").update(parsed.data).eq("id", id).select("id").single()
      : supabase.from("announcements").insert(parsed.data).select("id").single();
    const { data, error } = await q;
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, data: { id: data.id }, message: "Oznámení bylo uloženo." };
  });
}

export async function setPinned(id: string, pinned: boolean): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Neplatné oznámení." };
    const { error } = await supabase.from("announcements").update({ pinned }).eq("id", id);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: pinned ? "Oznámení bylo připnuto." : "Oznámení bylo odepnuto." };
  });
}

/* ------------------------------------------------------------------- Odkazy */

export async function saveLink(id: string | null, input: Input<typeof linkSchema>): Promise<ActionResult<{ id: string }>> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = linkSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    if (id) {
      const { error } = await supabase.from("useful_links").update(parsed.data).eq("id", id);
      if (error) return { ok: false, error: dbErrorMessage(error) };
      revalidateAll();
      return { ok: true, data: { id }, message: "Odkaz byl uložen." };
    }
    const { data: max } = await supabase.from("useful_links").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await supabase
      .from("useful_links")
      .insert({ ...parsed.data, sort_order: (max?.sort_order ?? 0) + 1 })
      .select("id")
      .single();
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, data: { id: data.id }, message: "Odkaz byl přidán." };
  });
}
