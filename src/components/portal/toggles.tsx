"use client";

import { useOptimistic, useTransition } from "react";
import { Check, Heart } from "lucide-react";
import { toast } from "sonner";
import { setAssignmentCompleted, setFavorite } from "@/lib/actions/student";
import { cn } from "@/lib/utils";

/** Zaškrtávátko „splněno“ s okamžitou (optimistickou) odezvou. */
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

  if (variant === "button") {
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

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      role="checkbox"
      aria-checked={optimistic}
      aria-label={`${optimistic ? "Zrušit splnění" : "Označit jako splněné"}: ${title}`}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-150",
        optimistic
          ? "border-mint-ink bg-mint-ink text-white"
          : "border-[#c7d0de] bg-card text-transparent hover:border-primary hover:text-primary/40",
      )}
    >
      <Check className="size-4" strokeWidth={3} aria-hidden />
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
