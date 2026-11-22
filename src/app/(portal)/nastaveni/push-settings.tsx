"use client";

import * as React from "react";
import { Bell, BellOff, BellRing, Send } from "lucide-react";
import { toast } from "sonner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { deletePushSubscription, savePushSubscription, sendTestPush, updatePushTopics } from "@/lib/actions/push";
import { PUSH_TOPICS, type PushTopic } from "@/lib/push-topics";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const ALL_TOPICS = PUSH_TOPICS.map((t) => t.key);

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

type Env = "loading" | "unsupported" | "ios-browser" | "ready";
const noop = () => () => {};

function detectEnv(): Env {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  // Na iPhonu fungují upozornění jen v aplikaci přidané na plochu
  if (ios && !standalone) return "ios-browser";
  return supported ? "ready" : "unsupported";
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
}

/**
 * Push upozornění na tomto zařízení: zapnutí, výběr druhů a zkouška.
 * Každé zařízení (telefon, počítač) se zapíná zvlášť.
 */
export function PushSettings({ subscriptions }: { subscriptions: { endpoint: string; topics: string[] }[] }) {
  // Schopnosti zařízení se zjistí až v prohlížeči (na serveru „loading“)
  const env = React.useSyncExternalStore(noop, detectEnv, () => "loading" as Env);
  const systemPermission = React.useSyncExternalStore(
    noop,
    () => ("Notification" in window ? Notification.permission : null),
    () => null,
  );
  const [askedPermission, setPermission] = React.useState<NotificationPermission | null>(null);
  const permission = askedPermission ?? systemPermission;
  const [endpoint, setEndpoint] = React.useState<string | null>(null);
  const [topics, setTopics] = React.useState<PushTopic[]>(ALL_TOPICS);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (env !== "ready") return;
    navigator.serviceWorker
      .getRegistration("/")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        if (!sub) return;
        const saved = subscriptions.find((s) => s.endpoint === sub.endpoint);
        // Odběr v prohlížeči bez záznamu na serveru (např. po zrušení) se bere jako vypnutý
        if (saved) {
          setEndpoint(sub.endpoint);
          setTopics(saved.topics.filter((t): t is PushTopic => (ALL_TOPICS as string[]).includes(t)));
        }
      })
      .catch(() => undefined);
  }, [env, subscriptions]);

  async function enable() {
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        toast.error("Upozornění nejsou povolená. Povol je v nastavení prohlížeče nebo telefonu.");
        return;
      }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await savePushSubscription(json, topics, navigator.userAgent);
      if (!res.ok) return void toast.error(res.error);
      setEndpoint(sub.endpoint);
      toast.success(res.message);
    } catch {
      toast.error("Upozornění se nepodařilo zapnout. Zkus to prosím znovu.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!endpoint) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      await (await reg?.pushManager.getSubscription())?.unsubscribe();
      const res = await deletePushSubscription(endpoint);
      if (!res.ok) return void toast.error(res.error);
      setEndpoint(null);
      toast.success(res.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleTopic(key: PushTopic, on: boolean) {
    const next = on ? [...topics, key] : topics.filter((t) => t !== key);
    const prev = topics;
    setTopics(next);
    if (!endpoint) return;
    const res = await updatePushTopics(endpoint, next);
    if (!res.ok) {
      setTopics(prev);
      toast.error(res.error);
    }
  }

  async function test() {
    if (!endpoint) return;
    const res = await sendTestPush(endpoint);
    if (res.ok) toast.success(res.message);
    else toast.error(res.error);
  }

  return (
    <Card id="upozorneni" className="mt-6 scroll-mt-28">
      <CardHeader
        title="Upozornění"
        description="Telefon ti dá vědět o novém testu, úkolu, oznámení nebo změně v rozvrhu. Zapíná se zvlášť na každém zařízení."
        icon={<Bell className="size-5 text-muted" aria-hidden />}
      />
      <CardBody className="space-y-5">
        {!PUBLIC_KEY ? (
          <p className="rounded-2xl bg-bg px-4 py-3 text-sm text-slate-ink">Upozornění zatím nejsou na serveru nastavená.</p>
        ) : env === "ios-browser" ? (
          <p className="rounded-2xl bg-bg px-4 py-3 text-sm text-slate-ink">
            Na iPhonu fungují upozornění jen v aplikaci na ploše: v Safari klepni na <strong>Sdílet</strong> → <strong>Přidat na plochu</strong>,
            otevři WeilHub z plochy a upozornění zapni tady v Nastavení (potřeba je iOS 16.4 nebo novější).
          </p>
        ) : env === "unsupported" ? (
          <p className="rounded-2xl bg-bg px-4 py-3 text-sm text-slate-ink">Tento prohlížeč upozornění nepodporuje. Zkus Chrome, Edge, Firefox nebo Safari.</p>
        ) : env === "loading" ? null : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              {endpoint ? (
                <>
                  <span className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1.5 text-sm font-medium text-mint-ink">
                    <BellRing className="size-4" aria-hidden /> Zapnuto na tomto zařízení
                  </span>
                  <Button variant="outline" size="sm" onClick={test}>
                    <Send aria-hidden /> Poslat zkušební upozornění
                  </Button>
                  <Button variant="ghost" size="sm" loading={busy} onClick={disable}>
                    <BellOff aria-hidden /> Vypnout
                  </Button>
                </>
              ) : (
                <Button loading={busy} onClick={enable}>
                  <Bell aria-hidden /> Zapnout upozornění
                </Button>
              )}
            </div>
            {permission === "denied" && !endpoint && (
              <p className="text-sm text-rose-ink">
                Upozornění máš pro WeilHub zakázaná. Povol je v nastavení prohlížeče (ikona zámku vedle adresy) nebo telefonu a zkus to znovu.
              </p>
            )}
            <fieldset className="space-y-3">
              <legend className="mb-1 text-sm font-medium text-ink">Chci dostávat</legend>
              {PUSH_TOPICS.map((t) => (
                <label key={t.key} className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-bg px-4 py-3">
                  <span>
                    <span className="block font-medium text-ink">{t.label}</span>
                    <span className="block text-sm text-muted">{t.hint}</span>
                  </span>
                  <Switch checked={topics.includes(t.key)} onCheckedChange={(v) => toggleTopic(t.key, v)} />
                </label>
              ))}
            </fieldset>
          </>
        )}
      </CardBody>
    </Card>
  );
}
