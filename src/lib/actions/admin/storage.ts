import "server-only";
import { MATERIALS_BUCKET } from "@/lib/supabase/config";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const FILE_TABLES = { material: "material_files", assignment: "assignment_files" } as const;

/**
 * Úklid úložiště: fyzický soubor smaže jen tehdy, když na stejnou cestu
 * neodkazuje žádný jiný záznam (např. u duplikovaného materiálu).
 */
export async function cleanupStoragePaths(supabase: Supabase, paths: string[]) {
  const orphaned: string[] = [];
  for (const path of new Set(paths)) {
    const { data: usage } = await supabase.rpc("storage_path_usage", { object_path: path });
    if (usage === 0) orphaned.push(path);
  }
  if (orphaned.length) await supabase.storage.from(MATERIALS_BUCKET).remove(orphaned);
}

/** Smaže záznam souboru a případně i fyzický soubor. */
export async function deleteFileRow(supabase: Supabase, target: keyof typeof FILE_TABLES, id: string, storagePath: string) {
  const { error } = await supabase.from(FILE_TABLES[target]).delete().eq("id", id);
  if (error) return error;
  await cleanupStoragePaths(supabase, [storagePath]);
  return null;
}
