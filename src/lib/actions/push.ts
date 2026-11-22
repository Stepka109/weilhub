"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pushConfigured, sendToSubscription } from "@/lib/push";
import type { ActionResult } from "@/lib/types";

const topics = z.array(z.enum(["tests", "assignments", "announcements", "timetable", "materials"])).max(5);
const endpoint = z.url().startsWith("https://").max(1000);
const subscription = z.object({
  endpoint,
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

/** Zapne upozornění na tomto zařízení (uloží odběr prohlížeče). */
export async function savePushSubscription(
  sub: z.input<typeof subscription>,
  selected: string[],
  userAgent: string,
): Promise<ActionResult> {
  const auth = await getActionUser();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!pushConfigured()) return { ok: false, error: "Upozornění zatím nejsou na serveru nastavená." };
  const s = subscription.safeParse(sub);
  const t = topics.safeParse(selected);
  if (!s.success || !t.success) return { ok: false, error: "Neplatný odběr upozornění." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("push_subscribe", {
    p_endpoint: s.data.endpoint,
    p_p256dh: s.data.keys.p256dh,
    p_auth: s.data.keys.auth,
    p_topics: t.data,
    p_user_agent: userAgent.slice(0, 300),
  });
  if (error) return { ok: false, error: "Upozornění se nepodařilo zapnout." };
  revalidatePath("/nastaveni");
  return { ok: true, message: "Upozornění jsou zapnutá." };
}

/** Změní, o čem chce student na tomto zařízení dostávat upozornění. */
export async function updatePushTopics(ep: string, selected: string[]): Promise<ActionResult> {
  const auth = await getActionUser();
  if ("error" in auth) return { ok: false, error: auth.error };
  const e = endpoint.safeParse(ep);
  const t = topics.safeParse(selected);
  if (!e.success || !t.success) return { ok: false, error: "Neplatné nastavení." };
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").update({ topics: t.data }).eq("endpoint", e.data).eq("user_id", auth.user.id);
  if (error) return { ok: false, error: "Nastavení se nepodařilo uložit." };
  revalidatePath("/nastaveni");
  return { ok: true, message: "Uloženo." };
}

/** Vypne upozornění na tomto zařízení. */
export async function deletePushSubscription(ep: string): Promise<ActionResult> {
  const auth = await getActionUser();
  if ("error" in auth) return { ok: false, error: auth.error };
  const e = endpoint.safeParse(ep);
  if (!e.success) return { ok: false, error: "Neplatný odběr." };
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", e.data).eq("user_id", auth.user.id);
  if (error) return { ok: false, error: "Upozornění se nepodařilo vypnout." };
  revalidatePath("/nastaveni");
  return { ok: true, message: "Upozornění na tomto zařízení jsou vypnutá." };
}

/** Pošle zkušební upozornění na toto zařízení. */
export async function sendTestPush(ep: string): Promise<ActionResult> {
  const auth = await getActionUser();
  if ("error" in auth) return { ok: false, error: auth.error };
  const e = endpoint.safeParse(ep);
  if (!e.success || !pushConfigured()) return { ok: false, error: "Upozornění nejsou nastavená." };
  const supabase = await createClient();
  const { data } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("endpoint", e.data).eq("user_id", auth.user.id).maybeSingle();
  if (!data) return { ok: false, error: "Toto zařízení nemá upozornění zapnutá." };
  try {
    await sendToSubscription(data, { title: "WeilHub", body: "Upozornění fungují. Takhle ti dáme vědět o novinkách.", url: "/nastaveni", tag: "test" });
  } catch {
    return { ok: false, error: "Zkušební upozornění se nepodařilo odeslat. Zkus upozornění vypnout a znovu zapnout." };
  }
  return { ok: true, message: "Zkušební upozornění je na cestě." };
}
