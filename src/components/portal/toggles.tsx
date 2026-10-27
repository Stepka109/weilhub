"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Heart } from "lucide-react";
import { toast } from "sonner";
import { setAssignmentCompleted, setFavorite } from "@/lib/actions/student";
import { cn } from "@/lib/utils";

/** Za jak dlouho se odškrtnutý úkol přesune ze seznamu do splněných */
const MOVE_DELAY_MS = 3000;

/**
 * Zaškrtávátko „splněno“ s okamžitou odezvou. V seznamech (kolečko) zůstane
 * úkol po změně ještě 3 s na místě (lze to vrátit) a pak se seznam obnoví –
 * splněný úkol se tak přesune do „Splněné“ a nedělá v přehledu nepořádek.
 */
export function CompletionToggle({
  assignmentId,
  completed,
  title,
  variant = "circle",
}: {
  assignmentId: string;
  completed: boolean;
  title: string;
  variant?: "circle" | "button";
}) {
  if (variant === "button") return <CompletionButton assignmentId={assignmentId} completed={completed} />;
  return <CompletionCircle assignmentId={assignmentId} completed={completed} title={title} />;
}

function CompletionCircle({ assignmentId, completed, title }: { assignmentId: string; completed: boolean; title: string }) {
  const router = useRouter();
  const [done, setDone] = useState(completed);
  const [moving, setMoving] = useState(false);
  const [pending, setPending] = useState(false);
  const timer = useRef<number | null>(null);

  // Po obnovení stránky převzít stav ze serveru
  const [lastProp, setLastProp] = useState(completed);
  if (completed !== lastProp) {
    setLastProp(completed);
    setDone(completed);
    setMoving(false);
  }

  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  async function toggle() {
    const next = !done;
    if (timer.current) window.clearTimeout(timer.current);
    setDone(next);
    setPending(true);
    const res = await setAssignmentCompleted(assignmentId, next, { refresh: false });
    setPending(false);
    if (!res.ok) {
      setDone(!next);
      setMoving(false);
      return void toast.error(res.error);
    }
    // Vrácení během odpočtu: úkol zůstane, kde byl
    if (next === completed) {
      setMoving(false);
      toast.success(next ? "Úkol označen jako splněný" : "Úkol označen jako nesplněný", { duration: 2000 });
      return;
    }
    setMoving(true);
    toast.success(next ? "Splněno – přesune se do Splněných" : "Vráceno mezi nesplněné", { duration: MOVE_DELAY_MS });
    timer.current = window.setTimeout(() => router.refresh(), MOVE_DELAY_MS);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      role="checkbox"
      aria-checked={done}
      aria-label={`${done ? "Zrušit splnění" : "Označit jako splněné"}: ${title}`}
      data-completing={moving ? "" : undefined}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-150",
        done ? "border-mint-ink bg-mint-ink text-white" : "border-[#c7d0de] bg-card text-transparent hover:border-primary hover:text-primary/40",
      )}
    >
      <Check className="size-4" strokeWidth={3} aria-hidden />
    </button>
  );
}

function CompletionButton({ assignmentId, completed }: { assignmentId: string; completed: boolean }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(completed);

  function toggle() {
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      const res = await setAssignmentCompleted(assignmentId, next);
      if (!res.ok) toast.error(res.error);
      else toast.success(next ? "Úkol označen jako splněný" : "Úkol označen jako nesplněný", { duration: 2000 });
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={optimistic}
      className={cn(
        "group inline-flex h-11 items-center gap-2 rounded-full px-5 text-[0.95rem] font-medium transition-colors duration-150 disabled:opacity-70",
        optimistic ? "bg-mint text-mint-ink hover:bg-[#bdf0dc]" : "bg-primary text-white hover:bg-primary-hover",
      )}
    >
      <Check className="size-[18px]" aria-hidden />
      {optimistic ? "Splněno – vrátit" : "Označit jako splněné"}
    </button>
  );
}

export function FavoriteButton({ materialId, favorite }: { materialId: string; favorite: boolean }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(favorite);

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={optimistic}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          const res = await setFavorite(materialId, !optimistic);
          if (!res.ok) toast.error(res.error);
        })
      }
      className={cn(
        "group inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[0.95rem] font-medium transition-colors duration-150",
        optimistic ? "border-rose bg-rose text-rose-ink" : "border-line bg-card text-ink hover:bg-bg",
      )}
    >
      <Heart className={cn("anim-icon size-[18px]", optimistic && "fill-current")} data-anim="pop" aria-hidden />
      {optimistic ? "V oblíbených" : "Přidat do oblíbených"}
    </button>
  );
}
