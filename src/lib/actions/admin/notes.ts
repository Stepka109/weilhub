"use server";

import { randomUUID } from "node:crypto";
import { MATERIALS_BUCKET } from "@/lib/supabase/config";
import { normalizeDrawing } from "@/lib/drawing";
import { isTiptapDoc, tiptapToText } from "@/lib/tiptap";
import type { ActionResult, TiptapNode } from "@/lib/types";
import { dbErrorMessage, idSchema, revalidateAll, withRole } from "./helpers";

const MAX_CONTENT_BYTES = 3_500_000;
const NOTE_IMG = /^\/api\/poznamky\/obrazek\/([0-9a-f-]{36})$/i;
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function mapNodes(node: TiptapNode, fn: (n: TiptapNode) => TiptapNode | null, depth = 0): TiptapNode | null {
  if (depth > 60) return null;
  const n = fn(node);
  if (!n) return null;
  if (!n.content) return n;
  return { ...n, content: n.content.map((c) => mapNodes(c, fn, depth + 1)).filter((c): c is TiptapNode => c !== null) };
}

/**
 * Sestavený zápis z poznámek žáků → nový koncept materiálu. Obrázky
 * z poznámek se zkopírují do úložiště materiálů (žáci by je jinak neviděli).
 */
export async function composeMaterialFromNotes(input: {
  subjectId: string;
  title: string;
  materialDate: string | null;
  content: unknown;
}): Promise<ActionResult<{ id: string; skipped: number }>> {
  return withRole("staff", async ({ supabase }) => {
    if (!idSchema.safeParse(input.subjectId).success) return { ok: false, error: "Vyber předmět." };
    const title = input.title.trim().slice(0, 200);
    if (!title) return { ok: false, error: "Zadej název zápisu." };
    if (input.materialDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.materialDate)) return { ok: false, error: "Neplatné datum." };
    if (!isTiptapDoc(input.content)) return { ok: false, error: "Obsah zápisu má neplatný formát." };
    if (JSON.stringify(input.content).length > MAX_CONTENT_BYTES) return { ok: false, error: "Zápis je moc velký. Rozděl ho prosím do více materiálů." };

    const { data: material, error } = await supabase
      .from("materials")
      .insert({ subject_id: input.subjectId, title, kind: "note", material_date: input.materialDate, status: "draft", content: null, content_text: "" })
      .select("id")
      .single();
    if (error) return { ok: false, error: dbErrorMessage(error) };

    // Obrázky z poznámek → soubory materiálu
    const srcMap = new Map<string, string | null>();
    const collect = (n: TiptapNode) => {
      const m = n.type === "image" && typeof n.attrs?.src === "string" ? NOTE_IMG.exec(n.attrs.src) : null;
      if (m) srcMap.set(n.attrs!.src as string, null);
      for (const c of n.content ?? []) collect(c);
    };
    collect(input.content);

    for (const src of srcMap.keys()) {
      const imageId = NOTE_IMG.exec(src)![1];
      const { data: img } = await supabase.from("note_images").select("storage_path, file_name, mime_type").eq("id", imageId).maybeSingle();
      const ext = img ? EXT[img.mime_type] : undefined;
      if (!img || !ext) continue;
      const { data: blob } = await supabase.storage.from("notes").download(img.storage_path);
      if (!blob) continue;
      const path = `materials/${material.id}/${randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(MATERIALS_BUCKET).upload(path, blob, { contentType: img.mime_type });
      if (upErr) continue;
      const { data: file } = await supabase
        .from("material_files")
        .insert({ material_id: material.id, role: "inline", storage_path: path, file_name: img.file_name, mime_type: img.mime_type, size_bytes: blob.size })
        .select("id")
        .single();
      if (file) srcMap.set(src, `/api/soubory/${file.id}`);
      else await supabase.storage.from(MATERIALS_BUCKET).remove([path]);
    }

    let skipped = 0;
    const doc = mapNodes(input.content, (n) => {
      if (n.type === "drawing") return { type: "drawing", attrs: { ...normalizeDrawing(n.attrs) } };
      if (n.type === "image" && typeof n.attrs?.src === "string" && srcMap.has(n.attrs.src)) {
        const next = srcMap.get(n.attrs.src);
        if (!next) {
          skipped++;
          return null;
        }
        return { ...n, attrs: { ...n.attrs, src: next } };
      }
      return n;
    }) ?? { type: "doc", content: [{ type: "paragraph" }] };

    const { error: updErr } = await supabase.from("materials").update({ content: doc, content_text: tiptapToText(doc) }).eq("id", material.id);
    if (updErr) return { ok: false, error: dbErrorMessage(updErr) };
    revalidateAll();
    return {
      ok: true,
      data: { id: material.id, skipped },
      message: skipped ? `Koncept je vytvořený. ${skipped} obrázků se nepodařilo přenést.` : "Koncept zápisu je vytvořený.",
    };
  });
}
