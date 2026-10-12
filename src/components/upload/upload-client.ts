"use client";

import { prepareUpload, registerUpload } from "@/lib/actions/admin/files";
import { supabasePublicKey } from "@/lib/supabase/config";

export interface UploadedFile {
  id: string;
  fileName: string;
  size: number;
  mime: string;
}

/**
 * Nahraje soubor ve třech krocích:
 *  1) server ověří oprávnění, typ a velikost a vydá podepsanou adresu,
 *  2) prohlížeč nahraje soubor přímo do soukromého bucketu (s průběhem),
 *  3) server ověří skutečný obsah souboru a teprve pak vytvoří záznam.
 */
export async function uploadFile(
  file: File,
  opts: { target: "material" | "assignment"; parentId: string; role?: "main" | "attachment" | "inline" },
  onProgress?: (pct: number) => void,
): Promise<UploadedFile> {
  const prep = await prepareUpload({ target: opts.target, parentId: opts.parentId, fileName: file.name, size: file.size });
  if (!prep.ok) throw new Error(prep.error);
  const { path, signedUrl, contentType } = prep.data!;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("apikey", supabasePublicKey);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(xhr.status === 413 ? "Soubor je pro úložiště příliš velký." : "Nahrávání se nezdařilo."));
    xhr.onerror = () => reject(new Error("Nahrávání přerušeno – zkontrolujte připojení."));
    xhr.send(file);
  });

  const reg = await registerUpload({ target: opts.target, parentId: opts.parentId, path, fileName: file.name, role: opts.role });
  if (!reg.ok) throw new Error(reg.error);
  return reg.data!;
}
