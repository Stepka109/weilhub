"use client";

import { useEffect } from "react";

/** Registruje service worker (pouze statické soubory, žádná soukromá data). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* PWA je volitelné vylepšení – chyba registrace nesmí rozbít aplikaci */
    });
  }, []);
  return null;
}
