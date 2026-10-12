import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";

/**
 * Klient se servisním klíčem – obchází RLS. Používá se VÝHRADNĚ na serveru
 * pro operace s auth.users (seznam e-mailů, smazání účtu) a vždy až po
 * ověření, že volající je administrátor (requireAdmin).
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
