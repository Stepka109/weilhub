"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updatePreferences } from "@/lib/actions/student";
import { cn } from "@/lib/utils";

/** Výzva k výběru vlastní skupiny (S1 / S2) – uloží se do předvoleb účtu. */
export function GroupPicker({ className, text }: { className?: string; text?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  function pick(group: "S1" | "S2") {
    start(async () => {
      const res = await updatePreferences({ studyGroup: group });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Skupina ${group} uložena. Změníš ji v Nastavení.`);
      router.refresh();
    });
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-line bg-card px-4 py-3 shadow-card", className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-light-blue text-primary">
        <Users className="size-5" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-sm text-slate-ink">
        <strong className="block font-semibold text-ink">Do které skupiny patříš?</strong>
        {text ?? "U dělených předmětů pak uvidíš rovnou svůj rozvrh, materiály, úkoly a testy."}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" loading={pending} onClick={() => pick("S1")}>
          Skupina S1
        </Button>
        <Button size="sm" variant="outline" loading={pending} onClick={() => pick("S2")}>
          Skupina S2
        </Button>
      </div>
    </div>
  );
}
