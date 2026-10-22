import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AppRole, Profile } from "@/lib/types";

export interface SessionUser {
  id: string;
  email: string | null;
  profile: Profile | null;
}

/**
 * Data Access Layer: jediné místo, kde se čte přihlášený uživatel.
 * getUser() ověřuje token u Supabase Auth (nevěří pouze cookie).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_path, role, status, preferences, approved_at, created_at")
    .eq("id", data.user.id)
    .maybeSingle();

  return { id: data.user.id, email: data.user.email ?? null, profile: (profile as Profile | null) ?? null };
});

/** Přihlášený a schválený uživatel; jinak přesměrování. */
export async function requireUser(): Promise<SessionUser & { profile: Profile }> {
  const user = await getSessionUser();
  if (!user) redirect("/prihlaseni");
  if (!user.profile || user.profile.status !== "approved") redirect("/cekani");
  return user as SessionUser & { profile: Profile };
}

export function isStaffRole(role: AppRole | undefined | null) {
  return role === "admin" || role === "editor";
}

/** Admin nebo editor. */
export async function requireStaff() {
  const user = await requireUser();
  if (!isStaffRole(user.profile.role)) redirect("/?pristup=odepren");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.profile.role !== "admin") redirect("/admin?pristup=odepren");
  return user;
}

/**
 * Varianta pro server actions – nevolá redirect, vrací chybu.
 * Akce tak vrátí srozumitelnou hlášku místo přesměrování.
 */
export type ActionAuth = { error: string } | { user: SessionUser & { profile: Profile } };

export async function getActionUser(minRole: "student" | "staff" | "admin" = "student"): Promise<ActionAuth> {
  const user = await getSessionUser();
  if (!user) return { error: "Nejste přihlášeni. Přihlaste se prosím znovu." };
  if (!user.profile || user.profile.status !== "approved") {
    return { error: "Váš účet zatím není schválený." };
  }
  if (minRole === "staff" && !isStaffRole(user.profile.role)) {
    return { error: "K této akci nemáte oprávnění." };
  }
  if (minRole === "admin" && user.profile.role !== "admin") {
    return { error: "Tuto akci smí provést pouze administrátor." };
  }
  return { user: user as SessionUser & { profile: Profile } };
}

/** Skupina studenta u dělených předmětů (S1 / S2) z jeho předvoleb; null = nezvolena. */
export async function getMyGroup() {
  const user = await getSessionUser();
  return user?.profile?.preferences?.studyGroup ?? null;
}
