"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MATERIALS_BUCKET } from "@/lib/supabase/config";
import { FILE_TYPES, extensionOf, matchesSignature, sanitizeFileName, validateFileMeta } from "@/lib/files";
import type { ActionResult } from "@/lib/types";
import { dbErrorMessage, idSchema, revalidateAll, withRole } from "./helpers";
import { deleteFileRow } from "./storage";

type Target = "material" | "assignment";
const targetSchema = z.enum(["material", "assignment"]);
const roleSchema = z.enum(["main", "attachment", "inline"]);

const PARENT = {
  material: { table: "materials", files: "material_files", fk: "material_id", folder: "materials" },
  assignment: { table: "assignments", files: "assignment_files", fk: "assignment_id", folder: "assignments" },
} as const;

/**
 * Krok 1: ověří oprávnění, typ a velikost a vystaví podepsanou adresu
 * pro přímé nahrání do soukromého bucketu (s průběhem v prohlížeči).
 */
export async function prepareUpload(input: {
  target: Target;
  parentId: string;
  fileName: string;
  size: number;
}): Promise<ActionResult<{ path: string; signedUrl: string; contentType: string }>> {
  return withRole("staff", async ({ supabase }) => {
    if (!targetSchema.safeParse(input.target).success || !idSchema.safeParse(input.parentId).success) {
      return { ok: false, error: "Neplatný cíl nahrávání." };
    }
    const { data: settings } = await supabase.from("app_settings").select("allowed_file_types, max_upload_mb").single();
    const allowed = settings?.allowed_file_types ?? Object.keys(FILE_TYPES);
    const maxMb = settings?.max_upload_mb ?? 25;
    const problem = validateFileMeta(input.fileName, input.size, allowed, maxMb);
    if (problem) return { ok: false, error: problem };

    const p = PARENT[input.target];
    const { data: parent } = await supabase.from(p.table).select("id").eq("id", input.parentId).maybeSingle();
    if (!parent) return { ok: false, error: "Záznam, ke kterému nahráváte, neexistuje." };

    const ext = extensionOf(input.fileName);
    const path = `${p.folder}/${input.parentId}/${randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage.from(MATERIALS_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: "Nahrávání se nepodařilo připravit. Zkontrolujte nastavení úložiště." };
    return { ok: true, data: { path, signedUrl: data.signedUrl, contentType: FILE_TYPES[ext].mime } };
  });
}

/**
 * Krok 2: po nahrání ověří skutečný obsah souboru (magické bajty) a velikost.
 * Neplatný soubor okamžitě odstraní z úložiště. Teprve potom vznikne záznam.
 */
export async function registerUpload(input: {
  target: Target;
  parentId: string;
  path: string;
  fileName: string;
  role?: "main" | "attachment" | "inline";
}): Promise<ActionResult<{ id: string; fileName: string; size: number; mime: string }>> {
  return withRole("staff", async ({ supabase }) => {
    if (!targetSchema.safeParse(input.target).success || !idSchema.safeParse(input.parentId).success) {
      return { ok: false, error: "Neplatný cíl nahrávání." };
    }
    const role = roleSchema.parse(input.role ?? "attachment");
    const p = PARENT[input.target];
    const expectedPrefix = `${p.folder}/${input.parentId}/`;
    if (!input.path.startsWith(expectedPrefix) || !/^[a-z]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z]+$/.test(input.path)) {
      return { ok: false, error: "Neplatná cesta souboru." };
    }
    const ext = input.path.split(".").pop()!;
    const type = FILE_TYPES[ext];
    if (!type) return { ok: false, error: "Nepodporovaný typ souboru." };

    const bucket = supabase.storage.from(MATERIALS_BUCKET);
    const remove = () => bucket.remove([input.path]);

    // Přečteme jen začátek souboru – hlavička Content-Range prozradí skutečnou velikost
    const { data: signed } = await bucket.createSignedUrl(input.path, 60);
    if (!signed) return { ok: false, error: "Nahraný soubor nebyl nalezen. Zkuste to znovu." };
    const res = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-4095" } });
    if (!res.ok) {
      await remove();
      return { ok: false, error: "Nahraný soubor se nepodařilo ověřit." };
    }
    const head = new Uint8Array(await res.arrayBuffer());
    const total = Number(res.headers.get("content-range")?.split("/")[1] ?? head.byteLength);

    const { data: settings } = await supabase.from("app_settings").select("allowed_file_types, max_upload_mb").single();
    const problem = validateFileMeta(`x.${ext}`, total, settings?.allowed_file_types ?? Object.keys(FILE_TYPES), settings?.max_upload_mb ?? 25);
    if (problem || !matchesSignature(ext, head.slice(0, ext === "txt" ? 4096 : 16))) {
      await remove();
      return {
        ok: false,
        error: problem ?? `Obsah souboru neodpovídá typu ${type.label}. Soubor byl odmítnut z bezpečnostních důvodů.`,
      };
    }

    const fileName = sanitizeFileName(input.fileName);
    const row: Record<string, unknown> = {
      [p.fk]: input.parentId,
      storage_path: input.path,
      file_name: fileName,
      mime_type: type.mime,
      size_bytes: total,
    };
    if (input.target === "material") row.role = role;

    const { data, error } = await supabase.from(p.files).insert(row).select("id").single();
    if (error) {
      await remove();
      return { ok: false, error: dbErrorMessage(error) };
    }

    // Nový hlavní soubor nahrazuje předchozí
    if (input.target === "material" && role === "main") {
      const { data: oldMain } = await supabase
        .from("material_files")
        .select("id, storage_path")
        .eq("material_id", input.parentId)
        .eq("role", "main")
        .neq("id", data.id);
      for (const f of oldMain ?? []) await deleteFileRow(supabase, "material", f.id, f.storage_path);
    }

    revalidateAll();
    return { ok: true, data: { id: data.id, fileName, size: total, mime: type.mime } };
  });
}

export async function deleteFile(target: Target, id: string): Promise<ActionResult> {
  return withRole("staff", async ({ supabase }) => {
    if (!targetSchema.safeParse(target).success || !idSchema.safeParse(id).success) return { ok: false, error: "Neplatný soubor." };
    const { data: file } = await supabase.from(PARENT[target].files).select("id, storage_path").eq("id", id).maybeSingle();
    if (!file) return { ok: false, error: "Soubor nebyl nalezen." };
    const error = await deleteFileRow(supabase, target, file.id, file.storage_path);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: "Soubor byl odebrán." };
  });
}

