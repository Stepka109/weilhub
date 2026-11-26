"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Copy, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createCalendarToken, deleteCalendarToken } from "@/lib/actions/student";
import { formatDateTime } from "@/lib/dates";

/**
 * Testy, úkoly a akce ve vlastním kalendáři (Google, Apple, Outlook).
 * Odkaz s osobním klíčem se ukáže jen po vytvoření.
 */
export function CalendarSetup({ status }: { status: { createdAt: string; lastUsedAt: string | null } | null }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [confirmDialog, ask] = useConfirm();

  function create() {
    start(async () => {
      const res = await createCalendarToken();
      if (!res.ok || !res.data) return void toast.error(res.ok ? "Odkaz se nepodařilo vytvořit." : res.error);
      setUrl(`${window.location.origin}/api/kalendar/${res.data.token}.ics`);
      toast.success(res.message);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Odkaz je zkopírovaný.");
    } catch {
      toast.error("Kopírování se nepovedlo. Označ odkaz a zkopíruj ho ručně.");
    }
  }

  const webcal = url?.replace(/^https?:\/\//, "webcal://");

  return (
    <Card className="mt-6">
      <CardHeader
        title="Kalendář v telefonu"
        description="Testy, úkoly, akce a termíny se samy objeví v Google, Apple nebo Outlook kalendáři."
        icon={<CalendarPlus className="size-5 text-muted" aria-hidden />}
      />
      <CardBody className="space-y-5">
        {url ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal!)}`} target="_blank" rel="noopener noreferrer">
                  Přidat do Google kalendáře
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={webcal}>Přidat do Apple kalendáře</a>
              </Button>
              <Button variant="outline" onClick={copy}>
                <Copy aria-hidden /> Zkopírovat odkaz
              </Button>
            </div>
            <input
              readOnly
              value={url}
              aria-label="Odkaz kalendáře"
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-2xl border border-line bg-bg px-3 py-2.5 font-mono text-xs text-slate-ink"
            />
            <p className="text-sm text-muted">
              Odkaz je soukromý – kdo ho má, uvidí tvoje testy a úkoly. Nikomu ho neposílej. V Outlooku: Přidat kalendář → Z internetu → vlož odkaz.
            </p>
          </div>
        ) : status ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-bg px-4 py-3">
            <p className="text-sm text-slate-ink">
              <strong className="text-ink">Kalendář je propojený.</strong> Vytvořen {formatDateTime(status.createdAt)}
              {status.lastUsedAt ? `, naposledy načten ${formatDateTime(status.lastUsedAt)}` : ", zatím nenačten"}.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                loading={pending}
                onClick={() =>
                  ask({
                    title: "Vytvořit nový odkaz?",
                    description: "Starý odkaz přestane fungovat a kalendář bude potřeba v telefonu přidat znovu.",
                    confirmLabel: "Vytvořit nový",
                    onConfirm: create,
                  })
                }
              >
                <RefreshCw aria-hidden /> Nový odkaz
              </Button>
              <Button
                variant="danger-soft"
                size="sm"
                onClick={() =>
                  ask({
                    title: "Zrušit odkaz kalendáře?",
                    description: "Kalendář v telefonu se přestane aktualizovat. Z kalendářové aplikace ho pak odeber ručně.",
                    confirmLabel: "Zrušit odkaz",
                    destructive: true,
                    onConfirm: async () => {
                      const res = await deleteCalendarToken();
                      if (res.ok) toast.success(res.message);
                      else toast.error(res.error);
                    },
                  })
                }
              >
                <Trash2 aria-hidden /> Zrušit
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={create} loading={pending}>
            <CalendarPlus aria-hidden /> Vytvořit odkaz kalendáře
          </Button>
        )}
        <p className="text-xs text-muted">
          Kalendář ukazuje věci tvé skupiny. U testů a úkolů přijde připomenutí večer předem v 18:00 (Apple a Outlook; Google u odebíraných kalendářů
          připomenutí nepodporuje). Kalendářové aplikace si změny stahují samy, obvykle během několika hodin.
        </p>
      </CardBody>
      {confirmDialog}
    </Card>
  );
}
