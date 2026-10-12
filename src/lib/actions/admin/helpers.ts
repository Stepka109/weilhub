import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActionUser, type SessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Profile } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface DbError {
  code?: string;
  message?: string;
}

/** Převede chybu databáze na srozumitelnou českou hlášku. */
export function dbErrorMessage(error: DbError, fallback = "Uložení se nezdařilo. Zkuste to prosím znovu."): string {
  switch (error.code) {
    case "23505":
      return "Záznam se stejnými údaji už existuje.";
    case "23503":
      return "Záznam nelze smazat, protože ho používá jiný obsah. Zkuste ho raději archivovat.";
    case "23514":
      return error.message && !/violates check constraint/.test(error.message) ? error.message : "Některá hodnota není povolená.";
    case "42501":
      return "K této akci nemáte oprávnění.";
    case "P0001":
      return error.message ?? fallback;
    case "PGRST116":
      return "Záznam nebyl nalezen nebo k němu nemáte přístup.";
    default:
      return fallback;
  }
}

export function invalid(error: z.ZodError): Extract<ActionResult, { ok: false }> {
  const fieldErrors = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  const first = Object.values(fieldErrors).find((v) => v?.length)?.[0];
  return { ok: false, error: first ?? "Zkontrolujte vyplněné údaje.", fieldErrors };
}

/**
 * Spustí akci pouze pro oprávněného uživatele. Oprávnění se ověřuje vždy
 * na serveru; databáze je navíc chráněna RLS (dvojí kontrola).
 */
export async function withRole<T>(
  role: "staff" | "admin",
  fn: (ctx: { supabase: Supabase; user: SessionUser & { profile: Profile } }) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const auth = await getActionUser(role);
  if ("error" in auth) return { ok: false, error: auth.error };
  try {
    const supabase = await createClient();
    return await fn({ supabase, user: auth.user });
  } catch (e) {
    console.error("[admin action]", e);
    return { ok: false, error: "Došlo k neočekávané chybě. Zkuste to prosím znovu." };
  }
}

/** Obnoví všechny pohledy, kterých se změna může týkat (dashboard, kalendář, …). */
export function revalidateAll() {
  revalidatePath("/", "layout");
}

export const idSchema = z.uuid();
