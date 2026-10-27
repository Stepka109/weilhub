"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const uuid = z.uuid();

/** Osobní označení úkolu jako splněného – soukromé pro daného uživatele. */
/**
 * `refresh: false` – stránku obnoví až klient (seznam úkolů nechá splněný
 * úkol pár sekund na místě a teprve potom ho přesune do splněných).
 */
export async function setAssignmentCompleted(
  assignmentId: string,
  completed: boolean,
  opts: { refresh?: boolean } = {},
): Promise<ActionResult> {
  const auth = await getActionUser();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!uuid.safeParse(assignmentId).success) return { ok: false, error: "Neplatný úkol." };

  const supabase = await createClient();
  const { error } = completed
    ? await supabase
        .from("assignment_completions")
        .upsert({ assignment_id: assignmentId, user_id: auth.user.id }, { onConflict: "user_id,assignment_id", ignoreDuplicates: true })
    : await supabase.from("assignment_completions").delete().eq("assignment_id", assignmentId).eq("user_id", auth.user.id);

  if (error) return { ok: false, error: "Stav úkolu se nepodařilo uložit." };
  if (opts.refresh !== false) revalidatePath("/", "layout");
  return { ok: true };
}

export async function setFavorite(materialId: string, favorite: boolean): Promise<ActionResult> {
  const auth = await getActionUser();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!uuid.safeParse(materialId).success) return { ok: false, error: "Neplatný materiál." };

  const supabase = await createClient();
  const { error } = favorite
    ? await supabase
        .from("material_favorites")
        .upsert({ material_id: materialId, user_id: auth.user.id }, { onConflict: "user_id,material_id", ignoreDuplicates: true })
    : await supabase.from("material_favorites").delete().eq("material_id", materialId).eq("user_id", auth.user.id);
  if (error) return { ok: false, error: "Oblíbené se nepodařilo uložit." };
  revalidatePath("/materialy", "layout");
  return { ok: true };
}

export async function markAnnouncementsRead(ids: string[]): Promise<ActionResult> {
  const auth = await getActionUser();
  if ("error" in auth) return { ok: false, error: auth.error };
  const parsed = z.array(uuid).max(500).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Neplatná oznámení." };
  if (!parsed.data.length) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase
    .from("announcement_reads")
    .upsert(
      parsed.data.map((id) => ({ announcement_id: id, user_id: auth.user.id })),
      { onConflict: "user_id,announcement_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: "Oznámení se nepodařilo označit jako přečtená." };
  revalidatePath("/", "layout");
  return { ok: true };
}

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Jméno musí mít alespoň 2 znaky.").max(80, "Jméno je příliš dlouhé."),
});

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const auth = await getActionUser();
  if ("error" in auth) return { ok: false, error: auth.error };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte údaje.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: parsed.data.displayName }).eq("id", auth.user.id);
  if (error) return { ok: false, error: "Profil se nepodařilo uložit." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Profil byl uložen." };
}

/** Cesta k avataru musí ležet ve vlastní složce uživatele (kontroluje i Storage RLS). */
export async function setAvatar(path: string | null): Promise<ActionResult> {
  const auth = await getActionUser();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (path !== null && !new RegExp(`^${auth.user.id}/[a-z0-9._-]+$`).test(path)) {
    return { ok: false, error: "Neplatný soubor avataru." };
  }
  const supabase = await createClient();
  const old = auth.user.profile.avatar_path;
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", auth.user.id);
  if (error) return { ok: false, error: "Avatar se nepodařilo uložit." };
  if (old && old !== path) await supabase.storage.from("avatars").remove([old]);
  revalidatePath("/", "layout");
  return { ok: true, message: path ? "Avatar byl změněn." : "Avatar byl odebrán." };
}

const prefsSchema = z.object({
  hideCompleted: z.boolean().optional(),
  compactLists: z.boolean().optional(),
  studyGroup: z.enum(["S1", "S2"]).nullable().optional(),
});

export async function updatePreferences(input: z.input<typeof prefsSchema>): Promise<ActionResult> {
  const auth = await getActionUser();
  if ("error" in auth) return { ok: false, error: auth.error };
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatné nastavení." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ preferences: { ...auth.user.profile.preferences, ...parsed.data } })
    .eq("id", auth.user.id);
  if (error) return { ok: false, error: "Nastavení se nepodařilo uložit." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Nastavení bylo uloženo." };
}
