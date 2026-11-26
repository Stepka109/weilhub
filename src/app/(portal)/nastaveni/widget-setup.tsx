"use client";

import { useState, useTransition } from "react";
import { Copy, Download, ExternalLink, Link2, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createWidgetToken, deleteWidgetToken } from "@/lib/actions/student";
import { formatDateTime } from "@/lib/dates";
import { widgetScript } from "@/lib/widget-script";
import { ANDROID_APK } from "@/lib/android";
import { cn } from "@/lib/utils";

const SCRIPTABLE_URL = "https://apps.apple.com/app/scriptable/id1405459188";

type Platform = "ios" | "android";

/**
 * Nastavení widgetu rozvrhu na telefon. iPhone: skript pro Scriptable.
 * Android: aplikace WeilHub (APK) a propojení odkazem. Klíč je jeden pro
 * oba telefony a ukáže se jen po vytvoření – při ztrátě se vytvoří nový.
 */
export function WidgetSetup({ status }: { status: { createdAt: string; lastUsedAt: string | null } | null }) {
  const [pending, start] = useTransition();
  const [platform, setPlatform] = useState<Platform>("ios");
  const [token, setToken] = useState<string | null>(null);
  const [confirmDialog, ask] = useConfirm();
  const script = token ? widgetScript(window.location.origin, token) : null;

  function create() {
    start(async () => {
      const res = await createWidgetToken();
      if (!res.ok || !res.data) return void toast.error(res.ok ? "Klíč se nepodařilo vytvořit." : res.error);
      setToken(res.data.token);
      toast.success(res.message);
    });
  }

  async function copy(value: string, done: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(done);
    } catch {
      toast.error("Kopírování se nepovedlo. Označ text a zkopíruj ho ručně.");
    }
  }

  const createButton = (
    <Button onClick={create} loading={pending}>
      <Smartphone aria-hidden /> Vytvořit widget
    </Button>
  );

  return (
    <Card className="mt-6">
      <CardHeader
        title="Widget na telefon"
        description="Rozvrh a oběd v jídelně přímo na ploše telefonu – na iPhonu i na Androidu."
        icon={<Smartphone className="size-5 text-muted" aria-hidden />}
      />
      <CardBody className="space-y-5">
        <div role="radiogroup" aria-label="Telefon" className="inline-flex gap-1 rounded-full border border-line bg-card p-1">
          {(
            [
              ["ios", "iPhone"],
              ["android", "Android"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={platform === key}
              onClick={() => setPlatform(key)}
              className={cn(
                "h-9 rounded-full px-5 text-sm font-medium whitespace-nowrap transition-colors",
                platform === key ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:bg-slate-soft hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {platform === "ios" ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-ink marker:font-semibold marker:text-ink">
            <li>
              Nainstaluj z App Storu aplikaci{" "}
              <a href={SCRIPTABLE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                Scriptable <ExternalLink className="size-3.5" aria-hidden />
              </a>{" "}
              (zdarma).
            </li>
            <li>
              Tady klepni na <strong>Vytvořit widget</strong> a potom na <strong>Zkopírovat skript</strong>.
            </li>
            <li>
              Ve Scriptable klepni vpravo nahoře na <strong>+</strong>, vlož skript a nahoře ho pojmenuj <strong>WeilHub</strong>. Tlačítkem ▶ uvidíš náhled
              všech velikostí.
            </li>
            <li>
              <strong>Plocha:</strong> podrž prst na ploše → Upravit → Přidat widget → Scriptable → malý, střední nebo velký → klepni na widget → Script:{" "}
              <strong>WeilHub</strong>.
            </li>
            <li>
              <strong>Widget jídelny:</strong> přidej další widget Scriptable, vyber Script: <strong>WeilHub</strong> a do pole <strong>Parameter</strong> napiš{" "}
              <strong>jidelna</strong>. Ukáže dnešní oběd (po obědech zítřejší), velký widget dva dny.
            </li>
            <li>
              <strong>Zamčená obrazovka:</strong> podrž prst na zamčené obrazovce → Přizpůsobit → Zamčená obrazovka → widgety → Scriptable → obdélník nebo
              kroužek → Script: <strong>WeilHub</strong>.
            </li>
          </ol>
        ) : (
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-ink marker:font-semibold marker:text-ink">
            <li>
              V telefonu stáhni a nainstaluj aplikaci <strong>WeilHub</strong> ({ANDROID_APK.sizeLabel}). Android se zeptá, jestli smí prohlížeč instalovat
              aplikace – povol to.
            </li>
            <li>
              Tady klepni na <strong>Vytvořit widget</strong> a potom na <strong>Propojit aplikaci</strong>. Otevře se aplikace WeilHub a sama se propojí.
            </li>
            <li>
              V aplikaci klepni na <strong>Velký widget</strong>, <strong>Malý widget</strong> nebo <strong>Widget jídelny</strong> – nebo podrž prst na ploše →
              Widgety → WeilHub.
            </li>
          </ol>
        )}

        {platform === "android" && (
          <Button asChild variant="outline">
            <a href={ANDROID_APK.url} download="WeilHub.apk">
              <Download aria-hidden /> Stáhnout aplikaci pro Android
            </a>
          </Button>
        )}

        {token ? (
          platform === "ios" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => copy(script!, "Skript je zkopírovaný – vlož ho do Scriptable.")}>
                  <Copy aria-hidden /> Zkopírovat skript
                </Button>
                <p className="text-sm text-muted">Skript obsahuje tvůj osobní klíč – nikomu ho neposílej.</p>
              </div>
              <textarea
                readOnly
                value={script!}
                aria-label="Skript widgetu pro Scriptable"
                onFocus={(e) => e.currentTarget.select()}
                className="h-40 w-full resize-y rounded-2xl border border-line bg-bg p-3 font-mono text-xs text-slate-ink"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild>
                  <a href={`weilhub://pripojit?key=${encodeURIComponent(token)}`}>
                    <Link2 aria-hidden /> Propojit aplikaci
                  </a>
                </Button>
                <Button variant="outline" onClick={() => copy(token, "Klíč je zkopírovaný – vlož ho v aplikaci WeilHub.")}>
                  <Copy aria-hidden /> Zkopírovat klíč
                </Button>
              </div>
              <p className="text-sm text-muted">
                Tlačítko funguje v telefonu s nainstalovanou aplikací. Na počítači zkopíruj klíč a vlož ho v aplikaci ručně. Klíč nikomu neposílej.
              </p>
            </div>
          )
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
                    title: "Vytvořit nový klíč?",
                    description: "Widget, který už máš v telefonu, přestane fungovat a bude potřeba ho nastavit znovu (na iPhonu nový skript, na Androidu znovu propojit).",
                    confirmLabel: "Vytvořit nový",
                    onConfirm: create,
                  })
                }
              >
                <RefreshCw aria-hidden /> {platform === "ios" ? "Nový skript" : "Propojit znovu"}
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
          createButton
        )}
        <p className="text-xs text-muted">
          Widget ukazuje rozvrh tvé skupiny (nastavíš výše). Klíč je jeden pro oba telefony – když vytvoříš nový, starý widget přestane fungovat. Telefon
          obnovuje widgety sám, změna hodiny se proto může o pár minut opozdit.
          {platform === "ios" && " Na zamčené obrazovce iOS zobrazuje widgety jednobarevně."}
        </p>
      </CardBody>
      {confirmDialog}
    </Card>
  );
}
