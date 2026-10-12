"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "./types";

/**
 * Spustí server action s indikátorem průběhu, toast notifikací
 * a obnovením dat. Vrací výsledek pro další zpracování.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run<T>(action: () => Promise<ActionResult<T>>, opts: { success?: string; onSuccess?: (data?: T) => void } = {}) {
    return new Promise<ActionResult<T>>((resolve) => {
      startTransition(async () => {
        let res: ActionResult<T>;
        try {
          res = await action();
        } catch {
          res = { ok: false, error: "Server je nedostupný. Zkontrolujte připojení a zkuste to znovu." };
        }
        if (res.ok) {
          toast.success(opts.success ?? res.message ?? "Uloženo.");
          opts.onSuccess?.(res.data);
          router.refresh();
        } else {
          toast.error(res.error);
        }
        resolve(res);
      });
    });
  }

  return { pending, run };
}
