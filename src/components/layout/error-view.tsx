"use client";

import { useEffect } from "react";
import { RefreshCw, ServerCrash, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Společné zobrazení chyby (výpadek serveru, ztráta připojení…). */
export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 py-10">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-rose text-rose-ink">
          {offline ? <WifiOff className="size-9" aria-hidden /> : <ServerCrash className="size-9" aria-hidden />}
        </div>
        <h1 className="mt-6 text-2xl font-bold text-ink">{offline ? "Jste offline" : "Něco se pokazilo"}</h1>
        <p className="mt-2 text-muted">
          {offline
            ? "Zkontrolujte připojení k internetu. WeilHub z bezpečnostních důvodů neukládá soukromá data pro offline použití."
            : "Server je momentálně nedostupný nebo došlo k neočekávané chybě. Zkuste to prosím za chvíli znovu."}
        </p>
        {error.digest && <p className="mt-2 text-xs text-muted">Kód chyby: {error.digest}</p>}
        <Button className="mt-8" onClick={reset}>
          <RefreshCw /> Zkusit znovu
        </Button>
      </div>
    </div>
  );
}
