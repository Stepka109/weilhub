import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicKey, supabaseUrl } from "./config";

/**
 * Supabase klient pro Server Components, Server Actions a Route Handlery.
 * Pracuje s relací přihlášeného uživatele → všechny dotazy podléhají RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublicKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Volání ze Server Component – relaci obnovuje proxy.ts
        }
      },
    },
  });
}
