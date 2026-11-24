"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getActivityPeople, type ActivityPerson } from "@/lib/actions/admin/activity";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

const VERB = {
  announcement: { done: "Přečetli", label: "Přečetlo" },
  material: { done: "Otevřeli", label: "Otevřelo" },
  poll: { done: "Hlasovali", label: "Hlasovalo" },
} as const;

/**
 * Přehled aktivity: „Přečetlo 12 z 28“. Po kliknutí seznam, kdo už a kdo
 * ještě ne (u anonymní ankety jen počet).
 */
export function ActivityButton({
  kind,
  id,
  count,
  total,
  anonymous = false,
  className,
}: {
  kind: keyof typeof VERB;
  id: string;
  count: number;
  total: number;
  anonymous?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [people, setPeople] = React.useState<ActivityPerson[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const verb = VERB[kind];
  const pct = total ? Math.round((count / total) * 100) : 0;

  async function show() {
    setOpen(true);
    if (anonymous || people) return;
    const res = await getActivityPeople(kind, id);
    if (res.ok) setPeople(res.data ?? []);
    else setError(res.error);
  }

  const seen = people?.filter((p) => p.seen_at) ?? [];
  const notYet = people?.filter((p) => !p.seen_at) ?? [];

  return (
    <>
      <button
        type="button"
        onClick={show}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-slate-soft px-2.5 py-1 text-xs font-medium text-slate-ink transition-colors hover:bg-light-blue hover:text-primary",
          className,
        )}
        title={`${verb.label} ${count} z ${total} (${pct} %)`}
      >
        <Eye className="size-3.5" aria-hidden />
        {verb.label} {count} z {total}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <DialogContent title={`${verb.label} ${count} z ${total}`} description={`${pct} % schválených uživatelů`}>
            {anonymous ? (
              <p className="text-sm text-muted">Anketa je anonymní – vidíš jen počet hlasujících.</p>
            ) : error ? (
              <p className="text-sm text-rose-ink">{error}</p>
            ) : !people ? (
              <p className="text-sm text-muted">Načítám…</p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-ink">
                    {verb.done} ({seen.length})
                  </h3>
                  <ul className="space-y-1.5 text-sm">
                    {seen.map((p, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="truncate text-ink">{p.person}</span>
                        <span className="shrink-0 text-muted">{formatDateTime(p.seen_at!)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-ink">Zatím ne ({notYet.length})</h3>
                  <ul className="space-y-1.5 text-sm text-muted">
                    {notYet.map((p, i) => (
                      <li key={i} className="truncate">
                        {p.person}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
