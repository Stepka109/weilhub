"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicKey, supabaseUrl } from "./config";

let client: ReturnType<typeof createBrowserClient> | undefined;

/** Supabase klient v prohlížeči (pouze veřejný klíč, vše chrání RLS). */
export function createClient() {
  client ??= createBrowserClient(supabaseUrl, supabasePublicKey);
  return client;
}
