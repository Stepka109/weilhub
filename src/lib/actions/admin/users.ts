"use server";

import { randomBytes } from "node:crypto";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { invitationSchema, settingsSchema } from "@/lib/validation/admin";
import type { AccountStatus, ActionResult, AppRole } from "@/lib/types";
import { dbErrorMessage, idSchema, invalid, revalidateAll, withRole } from "./helpers";

const ROLES: AppRole[] = ["admin", "editor", "student"];
const STATUSES: AccountStatus[] = ["pending", "approved", "blocked"];

/**
 * Změna role / stavu účtu. Pouze administrátor; databáze to vynucuje
 * triggerem guard_profile_update (včetně ochrany posledního admina).
 */
export async function updateUserAccess(
  userId: string,
  changes: { role?: AppRole; status?: AccountStatus },
): Promise<ActionResult> {
  return withRole("admin", async ({ supabase, user }) => {
    if (!idSchema.safeParse(userId).success) return { ok: false, error: "Neplatný uživatel." };
    if (changes.role && !ROLES.includes(changes.role)) return { ok: false, error: "Neplatná role." };
    if (changes.status && !STATUSES.includes(changes.status)) return { ok: false, error: "Neplatný stav." };
    if (userId === user.id && (changes.status === "blocked" || (changes.role && changes.role !== "admin"))) {
      return { ok: false, error: "Vlastní administrátorský účet nelze omezit. Požádejte jiného administrátora." };
    }
    const { error, count } = await supabase
      .from("profiles")
      .update(changes, { count: "exact" })
      .eq("id", userId);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    if (!count) return { ok: false, error: "Uživatel nebyl nalezen." };
    revalidateAll();
    return { ok: true, message: "Oprávnění bylo změněno." };
  });
}

/** Trvalé smazání účtu (vyžaduje servisní klíč na serveru). */
export async function deleteUser(userId: string): Promise<ActionResult> {
  return withRole("admin", async ({ supabase, user }) => {
    if (!idSchema.safeParse(userId).success) return { ok: false, error: "Neplatný uživatel." };
    if (userId === user.id) return { ok: false, error: "Vlastní účet nelze smazat z administrace." };
    const { data: target } = await supabase.from("profiles").select("role, status").eq("id", userId).maybeSingle();
    if (!target) return { ok: false, error: "Uživatel nebyl nalezen." };
    if (target.role === "admin") return { ok: false, error: "Administrátora nejprve změňte na jinou roli." };

    const admin = createAdminClient();
    if (!admin) return { ok: false, error: "Mazání účtů vyžaduje nastavený SUPABASE_SECRET_KEY na serveru." };
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return { ok: false, error: "Účet se nepodařilo smazat." };
    revalidateAll();
    return { ok: true, message: "Účet byl smazán." };
  });
}

/* ---------------------------------------------------------------- Pozvánky */

function inviteCode() {
  // Bez zaměnitelných znaků (0/O, 1/I)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  const raw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export async function createInvitation(input: z.input<typeof invitationSchema>): Promise<ActionResult<{ code: string }>> {
  return withRole("admin", async ({ supabase }) => {
    const parsed = invitationSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { expires_in_days, ...rest } = parsed.data;
    const code = inviteCode();
    const { error } = await supabase.from("invitations").insert({
      ...rest,
      code,
      expires_at: expires_in_days > 0 ? new Date(Date.now() + expires_in_days * 86_400_000).toISOString() : null,
    });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, data: { code }, message: "Pozvánka byla vytvořena." };
  });
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  return withRole("admin", async ({ supabase }) => {
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Neplatná pozvánka." };
    const { error } = await supabase.from("invitations").update({ revoked: true }).eq("id", id);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: "Pozvánka byla zrušena." };
  });
}

/* ---------------------------------------------------------------- Nastavení */

export async function saveSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  return withRole("admin", async ({ supabase }) => {
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { error } = await supabase.from("app_settings").update(parsed.data).eq("id", true);
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidateAll();
    return { ok: true, message: "Nastavení bylo uloženo." };
  });
}
