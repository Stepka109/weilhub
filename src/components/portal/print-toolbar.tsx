"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Počká na písma a obrázky, aby se do PDF dostalo všechno vykreslené. */
async function contentReady() {
  await document.fonts?.ready;
  const pending = [...document.images].filter((img) => !img.complete);
  await Promise.all(
    pending.map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
}

/**
 * Lišta tiskové stránky (v PDF se nezobrazí). Po načtení sama otevře okno
 * tisku, kde student zvolí „Uložit jako PDF“.
 */
export function PrintToolbar({ backHref }: { backHref: string }) {
  React.useEffect(() => {
    let cancelled = false;
    contentReady().then(() => {
      if (!cancelled) window.setTimeout(() => !cancelled && window.print(), 250);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="wh-print-toolbar">
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-3 px-4 py-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref}>
            <ArrowLeft aria-hidden /> Zpět
          </Link>
        </Button>
        <p className="min-w-0 flex-1 text-sm text-slate-ink">
          V okně tisku zvol <strong>Uložit jako PDF</strong> (na telefonu Tisk → Uložit jako PDF).
        </p>
        <Button size="sm" onClick={() => window.print()}>
          <FileDown aria-hidden /> Uložit jako PDF
        </Button>
      </div>
    </div>
  );
}
