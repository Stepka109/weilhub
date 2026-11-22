import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import type { PushTopic } from "./push-topics";

/**
 * Push upozornění (Web Push). Odesílá se po zveřejnění obsahu – až po
 * odeslání odpovědi uživateli (after), takže uložení se nezdrží.
 * Bez klíčů VAPID v prostředí se nic neodesílá.
 */
export type { PushTopic };

export interface PushPayload {
  title: string;
  body: string;
  /** Kam upozornění po klepnutí vede (cesta v rámci WeilHubu) */
  url: string;
  /** Stejný tag nahradí starší upozornění (např. více změn jedné hodiny) */
  tag?: string;
}

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "https://weilhub.vercel.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export async function sendToSubscription(sub: { endpoint: string; p256dh: string; auth: string }, payload: PushPayload) {
  configure();
  await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
    TTL: 12 * 60 * 60,
    urgency: "normal",
  });
}

/** Odešle upozornění všem, kdo odebírají daný druh (případně jen dané skupině). */
export async function notify(supabase: SupabaseClient, topic: PushTopic, payload: PushPayload, group: "S1" | "S2" | null = null) {
  if (!pushConfigured()) return;
  const { data, error } = await supabase.rpc("push_targets", { p_topic: topic, p_group: group });
  if (error || !data?.length) return;
  const dead: string[] = [];
  await Promise.allSettled(
    (data as { target_endpoint: string; target_p256dh: string; target_auth: string }[]).map(async (t) => {
      try {
        await sendToSubscription({ endpoint: t.target_endpoint, p256dh: t.target_p256dh, auth: t.target_auth }, payload);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // Prohlížeč odběr zrušil → smazat
        if (status === 404 || status === 410) dead.push(t.target_endpoint);
      }
    }),
  );
  if (dead.length) await supabase.rpc("push_forget", { p_endpoints: dead });
}

/** Upozornění odešle až po odpovědi (neblokuje uložení). */
export function notifyLater(supabase: SupabaseClient, topic: PushTopic, payload: PushPayload, group: "S1" | "S2" | null = null) {
  if (!pushConfigured()) return;
  after(() => notify(supabase, topic, payload, group));
}
