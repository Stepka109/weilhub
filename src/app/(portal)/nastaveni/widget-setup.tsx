"use client";

import { useState, useTransition } from "react";
import { Copy, ExternalLink, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createWidgetToken, deleteWidgetToken } from "@/lib/actions/student";
import { formatDateTime } from "@/lib/dates";
import { widgetScript } from "@/lib/widget-script";

const SCRIPTABLE_URL = "https://apps.apple.com/app/scriptable/id1405459188";

/**
 * Nastavení widgetu rozvrhu pro iPhone. Skript s osobním klíčem se ukáže
 * jen po vytvoření – klíč se nikde neukládá, při ztrátě se vytvoří nový.
 */
export function WidgetSetup({ status }: { status: { createdAt: string; lastUsedAt: string | null } | null }) {
  const [pending, start] = useTransition();
  const [script, setScript] = useState<string | null>(null);
  const [confirmDialog, ask] = useConfirm();

  function create() {
    start(async () => {
      const res = await createWidgetToken();
      if (!res.ok || !res.data) return void toast.error(res.ok ? "Klíč se nepodařilo vytvořit." : res.error);
      setScript(widgetScript(window.location.origin, res.data.token));
      toast.success(res.message);
    });
  }

  async function copy() {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      toast.success("Skript je zkopírovaný – vlož ho do Scriptable.");
    } catch {
      toast.error("Kopírování se nepovedlo. Označ text skriptu a zkopíruj ho ručně.");
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader
        title="Widget pro iPhone"
        description="Rozvrh na ploše i na zamčené obrazovce – přes aplikaci Scriptable (zdarma)."
        icon={<Smartphone className="size-5 text-muted" aria-hidden />}
      />
      <CardBody className="space-y-5">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-ink marker:font-semibold marker:text-ink">
          <li>
            Nainstaluj z App Storu aplikaci{" "}
            <a href={SCRIPTABLE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Scriptable <ExternalLink className="size-3.5" aria-hidden />
            </a>
            .
          </li>
          <li>
            Tady klepni na <strong>Vytvořit widget</strong> a potom na <strong>Zkopírovat skript</strong>.
          </li>
          <li>
            Ve Scriptable klepni vpravo nahoře na <strong>+</strong>, vlož skript a nahoře ho pojmenuj <strong>WeilHub</strong>. Tlačítkem ▶ uvidíš náhled.
          </li>
          <li>
            <strong>Plocha:</strong> podrž prst na ploše → Upravit → Přidat widget → Scriptable → velký nebo střední → klepni na widget → Script:{" "}
            <strong>WeilHub</strong>.
          </li>
          <li>
            <strong>Zamčená obrazovka:</strong> podrž prst na zamčené obrazovce → Přizpůsobit → Zamčená obrazovka → widgety → Scriptable → obdélník nebo
            kroužek → Script: <strong>WeilHub</strong>.
          </li>
        </ol>

        {script ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={copy}>
                <Copy aria-hidden /> Zkopírovat skript
              </Button>
              <p className="text-sm text-muted">Skript obsahuje tvůj osobní klíč – nikomu ho neposílej.</p>
            </div>
            <textarea
              readOnly
              value={script}
              aria-label="Skript widgetu pro Scriptable"
              onFocus={(e) => e.currentTarget.select()}
              className="h-40 w-full resize-y rounded-2xl border border-line bg-bg p-3 font-mono text-xs text-slate-ink"
            />
          </div>
        ) : status ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-bg px-4 py-3">
            <p className="text-sm text-slate-ink">
              <strong className="text-ink">Widget je aktivní.</strong> Vytvořen {formatDateTime(status.createdAt)}
              {status.lastUsedAt ? `, naposledy načten ${formatDateTime(status.lastUsedAt)}` : ", zatím nenačten"}.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                loading={pending}
                onClick={() =>
                  ask({
                    title: "Vytvořit nový skript?",
                    description: "Starý skript v telefonu přestane fungovat a bude potřeba ho nahradit novým.",
                    confirmLabel: "Vytvořit nový",
                    onConfirm: create,
                  })
                }
              >
                <RefreshCw aria-hidden /> Nový skript
              </Button>
              <Button
                variant="danger-soft"
                size="sm"
                onClick={() =>
                  ask({
                    title: "Zrušit widget?",
                    description: "Widget v telefonu přestane načítat rozvrh.",
                    confirmLabel: "Zrušit widget",
                    destructive: true,
                    onConfirm: async () => {
                      const res = await deleteWidgetToken();
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
            <Smartphone aria-hidden /> Vytvořit widget
          </Button>
        )}
        <p className="text-xs text-muted">
          Widget ukazuje rozvrh tvé skupiny (nastavíš výše). iPhone obnovuje widgety sám, změna probíhající hodiny se proto může o pár minut opozdit. Na
          zamčené obrazovce iOS zobrazuje widgety jednobarevně.
        </p>
      </CardBody>
      {confirmDialog}
    </Card>
  );
}
