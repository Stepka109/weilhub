"use server";

import type { z } from "zod";
import { inlineFileIds, isTiptapDoc, tiptapToText } from "@/lib/tiptap";
import { assignmentSchema, materialSchema } from "@/lib/validation/admin";
import type { ActionResult, TiptapNode } from "@/lib/types";
import { dbErrorMessage, idSchema, invalid, revalidateAll, withRole } from "./helpers";
import { cleanupStoragePaths, deleteFileRow } from "./storage";

const MAX_CONTENT_BYTES = 1_000_000;

/** Vytvoří nebo upraví materiál. Obsah zápisu se ukládá strukturovaně (JSON). */
export async function saveMaterial(
  id: string | null,
  input: z.input<typeof materialSchema>,
): Promise<ActionResult<{ id: string; updatedAt: string }>> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = materialSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    if (id && !idSchema.safeParse(id).success) return { ok: false, error: "Neplatný materiál." };
    const { content, ...data } = parsed.data;

    let doc: TiptapNode | null = null;
    if (data.kind === "note") {
      if (content !== undefined && content !== null && !isTiptapDoc(content)) {
        return { ok: false, error: "Obsah zápisu má neplatný formát." };
      }
      doc = (content as TiptapNode | undefined) ?? null;
      if (doc && JSON.stringify(doc).length > MAX_CONTENT_BYTES) {
        return { ok: false, error: "Zápis je příliš dlouhý. Rozdělte ho prosím do více materiálů." };
      }
    }

    if (data.status === "published" && data.kind === "file" && id) {
      const { count } = await supabase.from("material_files").select("id", { count: "exact", head: true }).eq("material_id", id).eq("role", "main");
      if (!count) return { ok: false, error: "Před publikováním nahrajte hlavní soubor." };
    }
    if (data.status === "published" && data.kind === "file" && !id) {
      return { ok: false, error: "Nejprve uložte koncept a nahrajte soubor, potom materiál publikujte." };
    }

    const row = {
      ...data,
      topic_id: data.topic_id ?? null,
      content: doc,
      content_text: doc ? tiptapToText(doc) : "",
    };

    const q = id
      ? supabase.from("materials").update(row).eq("id", id).select("id, updated_at").single()
      : supabase.from("materials").insert(row).select("id, updated_at").single();
    const { data: saved, error } = await q;
    if (error) return { ok: false, error: dbErrorMessage(error) };

    // Úklid vložených obrázků, které už v zápisu nejsou
    if (id) {
      const keep = new Set(inlineFileIds(doc));
      const { data: inline } = await supabase.from("material_files").select("id, storage_path").eq("material_id", id).eq("role", "inline");
      for (const f of inline ?? []) if (!keep.has(f.id)) await deleteFileRow(supabase, "material", f.id, f.storage_path);
    }

    revalidateAll();
    const message = data.status === "published" ? "Materiál je publikovaný." : data.status === "archived" ? "Materiál byl archivován." : "Koncept byl uložen.";
    return { ok: true, data: { id: saved.id, updatedAt: saved.updated_at }, message };
  });
}

/** Kopie materiálu jako koncept. Soubory se sdílí (bez kopírování dat v úložišti). */
export async function duplicateMaterial(id: string): Promise<ActionResult<{ id: string }>> {
  return withRole("staff", async ({ supabase }) => {
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Neplatný materiál." };
    const { data: src } = await supabase.from("materials").select("*, files:material_files(*)").eq("id", id).maybeSingle();
    if (!src) return { ok: false, error: "Materiál nebyl nalezen." };

    const { data: copy, error } = await supabase
      .from("materials")
      .insert({
        subject_id: src.subject_id,
        topic_id: src.topic_id,
        title: `${src.title} (kopie)`.slice(0, 200),
        kind: src.kind,
        description: src.description,
        content: src.content,
        content_text: src.content_text,
        material_date: src.material_date,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: dbErrorMessage(error) };

    // Zkopírujeme záznamy souborů a přemapujeme odkazy na vložené obrázky
    let contentJson = src.content ? JSON.stringify(src.content) : null;
    for (const f of (src.files ?? []) as { id: string; role: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number }[]) {
      const { data: nf } = await supabase
        .from("material_files")
        .insert({ material_id: copy.id, role: f.role, storage_path: f.storage_path, file_name: f.file_name, mime_type: f.mime_type, size_bytes: f.size_bytes })
        .select("id")
        .single();
      if (nf && contentJson) contentJson = contentJson.replaceAll(`/api/soubory/${f.id}`, `/api/soubory/${nf.id}`);
    }
    if (contentJson && contentJson !== JSON.stringify(src.content)) {
      await supabase.from("materials").update({ content: JSON.parse(contentJson) }).eq("id", copy.id);
    }

    revalidateAll();
    return { ok: true, data: { id: copy.id }, message: "Vznikla kopie materiálu jako koncept." };
  });
}

export async function deleteMaterial(id: string): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Neplatný materiál." };
    const { data: files } = await supabase.from("material_files").select("storage_path").eq("material_id", id);
    const { error, count } = await supabase.from("materials").delete({ count: "exact" }).eq("id", id);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    if (!count) return { ok: false, error: "Materiál nebyl nalezen." };
    await cleanupStoragePaths(supabase, (files ?? []).map((f) => f.storage_path));
    revalidateAll();
    return { ok: true, message: "Materiál byl smazán." };
  });
}

/* -------------------------------------------------------------------- Úkoly */

export async function saveAssignment(
  id: string | null,
  input: z.input<typeof assignmentSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withRole("staff", async ({ supabase }) => {
    const parsed = assignmentSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    if (id && !idSchema.safeParse(id).success) return { ok: false, error: "Neplatný úkol." };
    const { material_ids, ...data } = parsed.data;

    const q = id
      ? supabase.from("assignments").update(data).eq("id", id).select("id").single()
      : supabase.from("assignments").insert(data).select("id").single();
    const { data: saved, error } = await q;
    if (error) return { ok: false, error: dbErrorMessage(error) };

    const del = await supabase.from("assignment_materials").delete().eq("assignment_id", saved.id);
    if (!del.error && material_ids.length) {
      const ins = await supabase
        .from("assignment_materials")
        .insert([...new Set(material_ids)].map((m) => ({ assignment_id: saved.id, material_id: m })));
      if (ins.error) return { ok: false, error: "Úkol byl uložen, ale související materiály se nepodařilo propojit." };
    }
    revalidateAll();
    return { ok: true, data: { id: saved.id }, message: id ? "Úkol byl uložen." : "Úkol byl vytvořen." };
  });
}

export async function deleteAssignment(id: string): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Neplatný úkol." };
    const { data: files } = await supabase.from("assignment_files").select("storage_path").eq("assignment_id", id);
    const { error, count } = await supabase.from("assignments").delete({ count: "exact" }).eq("id", id);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    if (!count) return { ok: false, error: "Úkol nebyl nalezen." };
    await cleanupStoragePaths(supabase, (files ?? []).map((f) => f.storage_path));
    revalidateAll();
    return { ok: true, message: "Úkol byl smazán." };
  });
}
