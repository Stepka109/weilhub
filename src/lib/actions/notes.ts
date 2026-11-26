"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeDrawing } from "@/lib/drawing";
import { matchesSignature, sanitizeFileName } from "@/lib/files";
import { isTiptapDoc, tiptapToText } from "@/lib/tiptap";
import { todayIso } from "@/lib/dates";
import type { ActionResult, TiptapNode } from "@/lib/types";

const NOTES_BUCKET = "notes";
/** Vercel přijme nejvýš 4,5 MB – poznámka s kresbami musí být menší */
const MAX_NOTE_BYTES = 3_500_000;
const uuid = z.uuid();

const patchSchema = z.object({
  title: z.string().trim().max(200).optional(),
  subjectId: z.uuid().nullable().optional(),
  lessonDate: z.iso.date().nullable().optional(),
  shared: z.boolean().optional(),
  content: z.unknown().optional(),
});

/** Kresby v obsahu projdou kontrolou a ořezáním (barvy, počty bodů…). */
function cleanDoc(node: TiptapNode, depth = 0): TiptapNode {
  if (depth > 60) return { type: "paragraph" };
  if (node.type === "drawing") return { type: "drawing", attrs: { ...normalizeDrawing(node.attrs) } };
  return node.content ? { ...node, content: node.content.map((c) => cleanDoc(c, depth + 1)) } : node;
}

/** Nová poznámka: „text“ (psaní na klávesnici) nebo „pen“ (celá stránka perem). */
export async function createNote(input: { subjectId: string | null; mode: "text" | "pen" }): Promise<ActionResult<{ id: string }>> {
  const auth = await getActionUser();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (input.subjectId !== null && !uuid.safeParse(input.subjectId).success) return { ok: false, error: "Neplatný předmět." };
  const content: TiptapNode =
    input.mode === "pen"
      ? { type: "doc", content: [{ type: "drawing", attrs: { height: 1400, paper: "lines", strokes: [] } }, { type: "paragraph" }] }
      : { type: "doc", content: [{ type: "paragraph" }] };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .insert({ subject_id: input.subjectId, content, lesson_date: todayIso() })
    .select("id")
    .single();
  if (error) return { ok: false, error: "Poznámku se nepodařilo vytvořit." };
  revalidatePath("/poznamky");
  return { ok: true, data: { id: data.id } };
}

/** Průběžné ukládání poznámky (volá se automaticky při psaní). */
export async function saveNote(id: string, patch: z.input<typeof patchSchema>): Promise<ActionResult<{ updatedAt: string }>> {
  const auth = await getActionUser();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Neplatná poznámka." };
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Neplatná data poznámky." };
  const p = parsed.data;

  const row: Record<string, unknown> = {};
  if (p.title !== undefined) row.title = p.title;
  if (p.subjectId !== undefined) row.subject_id = p.subjectId;
  if (p.lessonDate !== undefined) row.lesson_date = p.lessonDate;
  if (p.shared !== undefined) row.shared = p.shared;
  if (p.content !== undefined) {
    if (!isTiptapDoc(p.content)) return { ok: false, error: "Obsah poznámky má neplatný formát." };
    const doc = cleanDoc(p.content);
    if (JSON.stringify(doc).length > MAX_NOTE_BYTES) {
      return { ok: false, error: "Poznámka je moc velká. Rozděl ji prosím do více poznámek." };
    }
    row.content = doc;
    row.content_text = tiptapToText(doc, 60_000);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("notes").update(row).eq("id", id).eq("user_id", auth.user.id).select("updated_at").maybeSingle();
  if (error || !data) return { ok: false, error: "Poznámku se nepodařilo uložit." };
  if (p.shared !== undefined || p.title !== undefined || p.subjectId !== undefined) revalidatePath("/poznamky");
  return { ok: true, data: { updatedAt: data.updated_at } };
}

/** Smaže poznámku i s obrázky v úložišti. */
export async function deleteNote(id: string): Promise<ActionResult> {
  const auth = await getActionUser();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Neplatná poznámka." };
  const supabase = await createClient();
  const { data: images } = await supabase.from("note_images").select("storage_path").eq("note_id", id).eq("user_id", auth.user.id);
  const { error } = await supabase.from("notes").delete().eq("id", id).eq("user_id", auth.user.id);
  if (error) return { ok: false, error: "Poznámku se nepodařilo smazat." };
  if (images?.length) await supabase.storage.from(NOTES_BUCKET).remove(images.map((i) => i.storage_path));
  revalidatePath("/poznamky");
  return { ok: true, message: "Poznámka byla smazána." };
}

const IMAGE_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

/**
 * Po nahrání obrázku (prohlížeč ho nahraje rovnou do vlastní složky v úložišti)
 * ověří skutečný obsah souboru a velikost a zapíše ho k poznámce.
 */
export async function registerNoteImage(noteId: string, path: string, fileName: string): Promise<ActionResult<{ src: string }>> {
  const auth = await getActionUser();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!uuid.safeParse(noteId).success) return { ok: false, error: "Neplatná poznámka." };
  const m = /^([0-9a-f-]{36})\/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$/.exec(path);
  if (!m || m[1] !== auth.user.id) return { ok: false, error: "Neplatná cesta obrázku." };
  const ext = m[2];

  const supabase = await createClient();
  const bucket = supabase.storage.from(NOTES_BUCKET);
  const remove = () => bucket.remove([path]);
  const { data: signed } = await bucket.createSignedUrl(path, 60);
  if (!signed) return { ok: false, error: "Nahraný obrázek nebyl nalezen. Zkus to znovu." };
  const res = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-63" } });
  if (!res.ok) {
    await remove();
    return { ok: false, error: "Obrázek se nepodařilo ověřit." };
  }
  const head = new Uint8Array(await res.arrayBuffer());
  const size = Number(res.headers.get("content-range")?.split("/")[1] ?? head.byteLength);
  const okType = ext === "gif" ? head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 : matchesSignature(ext === "jpeg" ? "jpg" : ext, head);
  if (!okType || size > 10 * 1024 * 1024) {
    await remove();
    return { ok: false, error: okType ? "Obrázek je větší než 10 MB." : "Soubor není platný obrázek." };
  }

  const { data, error } = await supabase
    .from("note_images")
    .insert({ note_id: noteId, storage_path: path, file_name: sanitizeFileName(fileName) || "obrazek", mime_type: IMAGE_MIME[ext], size_bytes: size })
    .select("id")
    .single();
  if (error) {
    await remove();
    return { ok: false, error: "Obrázek se nepodařilo uložit k poznámce." };
  }
  return { ok: true, data: { src: `/api/poznamky/obrazek/${data.id}` } };
}
