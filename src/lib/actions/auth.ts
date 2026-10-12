"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema, registerSchema, resetRequestSchema, newPasswordSchema } from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/types";

const NOT_CONFIGURED: ActionResult = {
  ok: false,
  error: "Aplikace zatím není propojená se Supabase. Doplňte proměnné prostředí podle README.",
};

const UNAVAILABLE: ActionResult = { ok: false, error: "Přihlašovací server je momentálně nedostupný. Zkuste to prosím za chvíli." };

/** Skutečný výpadek spojení (Supabase vrací chyby databáze také jako „retryable“ se stavem 500). */
function isNetworkError(error: { status?: number; name?: string; message?: string }) {
  if (/database error/i.test(error.message ?? "")) return false;
  return !error.status || error.status >= 502;
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "neznama";
}

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Povolené přesměrování po přihlášení: pouze interní cesty. */
function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/";
}

export async function signIn(input: z.input<typeof loginSchema> & { next?: string }): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte zadané údaje.", fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 10, 60_000) || !rateLimit(`login:${parsed.data.email}`, 8, 5 * 60_000)) {
    return { ok: false, error: "Příliš mnoho pokusů o přihlášení. Zkuste to prosím za pár minut." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (isNetworkError(error)) return UNAVAILABLE;
    if (error.code === "email_not_confirmed") {
      return { ok: false, error: "E-mail ještě nebyl potvrzen. Klikněte na odkaz, který jsme vám poslali." };
    }
    return { ok: false, error: "Nesprávný e-mail nebo heslo." };
  }
  redirect(safeNext(input.next));
}

export async function signUp(input: z.input<typeof registerSchema>): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte zadané údaje.", fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const ip = await clientIp();
  if (!rateLimit(`signup:${ip}`, 5, 10 * 60_000)) {
    return { ok: false, error: "Příliš mnoho registrací z tohoto zařízení. Zkuste to později." };
  }

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("app_settings")
    .select("registration_enabled, registration_requires_invite")
    .single();

  const code = parsed.data.inviteCode?.trim() || undefined;
  if (settings && !code) {
    if (!settings.registration_enabled) return { ok: false, error: "Registrace jsou momentálně vypnuté." };
    if (settings.registration_requires_invite) {
      return { ok: false, error: "Pro registraci potřebujete kód pozvánky.", fieldErrors: { inviteCode: ["Zadejte kód pozvánky."] } };
    }
  }

  // Role se nikdy nepředává z klienta – určuje ji databázový trigger z pozvánky.
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
      data: { display_name: parsed.data.displayName, invite_code: code ?? null },
    },
  });

  if (error) {
    if (isNetworkError(error)) return UNAVAILABLE;
    if (/database error/i.test(error.message)) {
      return {
        ok: false,
        error: "Kód pozvánky je neplatný, vypršel nebo už byl vyčerpán.",
        fieldErrors: { inviteCode: ["Neplatná pozvánka."] },
      };
    }
    if (error.code === "user_already_exists") return { ok: false, error: "Účet s tímto e-mailem už existuje." };
    if (error.code === "weak_password") return { ok: false, error: "Heslo je příliš slabé." };
    return { ok: false, error: "Registrace se nezdařila. Zkuste to prosím znovu." };
  }

  if (data.session) redirect("/");
  return { ok: true, message: "Účet byl vytvořen. Potvrďte prosím e-mail kliknutím na odkaz, který jsme vám poslali." };
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/prihlaseni");
}

export async function requestPasswordReset(input: z.input<typeof resetRequestSchema>): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zadejte platný e-mail.", fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const ip = await clientIp();
  if (!rateLimit(`reset:${ip}`, 3, 10 * 60_000)) {
    return { ok: false, error: "Příliš mnoho žádostí. Zkuste to prosím později." };
  }
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/obnova-hesla`,
  });
  // Neprozrazujeme, zda účet existuje
  return { ok: true, message: "Pokud účet s tímto e-mailem existuje, poslali jsme na něj odkaz pro obnovu hesla." };
}

export async function updatePassword(input: z.input<typeof newPasswordSchema>): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte heslo.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Odkaz vypršel. Požádejte o obnovu hesla znovu." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { ok: false, error: "Nové heslo musí být jiné než současné." };
    return { ok: false, error: "Heslo se nepodařilo změnit." };
  }
  return { ok: true, message: "Heslo bylo změněno." };
}
