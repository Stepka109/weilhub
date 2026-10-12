/**
 * Konfigurace Supabase z proměnných prostředí.
 * Veřejné hodnoty (URL + publishable/anon klíč) smějí být v klientském kódu,
 * tajný klíč (service role) se načítá výhradně na serveru – viz admin.ts.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return /^https?:\/\//.test(supabaseUrl) && supabasePublicKey.length > 20;
}

export const MATERIALS_BUCKET = "materials";
export const AVATARS_BUCKET = "avatars";
