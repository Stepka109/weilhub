"use client";

import * as React from "react";
import { CheckCircle2, Clock3, Vote } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";
import { votePoll } from "@/lib/actions/student";
import type { PollView } from "@/lib/data/portal";
import { cn } from "@/lib/utils";

const closesLabel = (iso: string) =>
  new Intl.DateTimeFormat("cs-CZ", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" }).format(
    new Date(iso),
  );

/** Výsledky: pruh s počtem hlasů u každé možnosti, vlastní volba zvýrazněná. */
function Results({ poll }: { poll: PollView }) {
  const r = poll.results!;
  const max = Math.max(1, ...r.counts);
  return (
    <ul className="space-y-2">
      {poll.options.map((o, i) => {
        const n = r.counts[i] ?? 0;
        const mine = poll.myVote?.choices.includes(i);
        return (
          <li key={i}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className={cn("text-ink", mine && "font-semibold")}>
                {o}
                {mine && <CheckCircle2 className="ml-1.5 inline size-4 text-primary" aria-label="tvůj hlas" />}
              </span>
              <span className="shrink-0 text-muted">
                {n} {r.voters ? `(${Math.round((n / r.voters) * 100)} %)` : ""}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-soft">
              <span className={cn("block h-full rounded-full", mine ? "bg-primary" : "bg-primary/45")} style={{ width: `${(n / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Anketa: hlasování (jedna / více možností / krátká odpověď) a výsledky. */
export function PollCard({ poll, highlight = false }: { poll: PollView; highlight?: boolean }) {
  const voted = !!poll.myVote;
  const [editing, setEditing] = React.useState(!voted);
  const [choices, setChoices] = React.useState<number[]>(poll.myVote?.choices ?? []);
  const [answer, setAnswer] = React.useState(poll.myVote?.answer ?? "");
  const [pending, start] = React.useTransition();
  const canVote = poll.open && (editing || !voted);

  function toggle(i: number) {
    if (poll.kind === "single") setChoices([i]);
    else setChoices((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]));
  }

  function submit() {
    start(async () => {
      const res = await votePoll(poll.id, choices, answer);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      setEditing(false);
    });
  }

  return (
    <Card className={cn("p-5 sm:p-6", highlight && "border-primary/30 ring-1 ring-primary/20")}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-light-blue px-2.5 py-1 text-primary uppercase">
          <Vote className="size-3.5" aria-hidden /> Hlasování
        </span>
        {poll.open ? (
          poll.closes_at && (
            <span className="inline-flex items-center gap-1 text-muted">
              <Clock3 className="size-3.5" aria-hidden /> do {closesLabel(poll.closes_at)}
            </span>
          )
        ) : (
          <span className="rounded-full bg-slate-soft px-2.5 py-1 text-slate-ink">Uzavřeno</span>
        )}
        {voted && !editing && <span className="rounded-full bg-mint px-2.5 py-1 text-mint-ink">Odhlasováno</span>}
      </div>
      <h3 className="mt-3 text-lg font-semibold text-ink">{poll.question}</h3>
      {poll.description && <p className="mt-1 whitespace-pre-line text-slate-ink">{poll.description}</p>}

      <div className="mt-4">
        {canVote ? (
          poll.kind === "text" ? (
            <Textarea rows={3} maxLength={1000} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Tvoje odpověď" aria-label="Tvoje odpověď" />
          ) : (
            <fieldset className="space-y-2">
              <legend className="sr-only">{poll.question}</legend>
              {poll.kind === "multiple" && <p className="text-sm text-muted">Můžeš vybrat více možností.</p>}
              {poll.options.map((o, i) => (
                <label
                  key={i}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
                    choices.includes(i) ? "border-primary bg-light-blue/50" : "border-line hover:border-line-strong",
                  )}
                >
                  <input
                    type={poll.kind === "single" ? "radio" : "checkbox"}
                    name={`poll-${poll.id}`}
                    checked={choices.includes(i)}
                    onChange={() => toggle(i)}
                    className="size-4 accent-[var(--wh-blue)]"
                  />
                  <span className="text-ink">{o}</span>
                </label>
              ))}
            </fieldset>
          )
        ) : poll.kind === "text" ? (
          poll.myVote ? (
            <p className="rounded-2xl bg-bg px-4 py-3 text-slate-ink">
              <span className="block text-xs font-semibold text-muted uppercase">Tvoje odpověď</span>
              {poll.myVote.answer}
            </p>
          ) : (
            <p className="text-sm text-muted">Neodpověděl/a jsi.</p>
          )
        ) : poll.results ? (
          <>
            <Results poll={poll} />
            <p className="mt-3 text-sm text-muted">Hlasovalo {poll.results.voters}.</p>
          </>
        ) : (
          <p className="text-sm text-muted">{voted ? "Výsledky zatím nejsou zveřejněné." : "Hlasování skončilo."}</p>
        )}
      </div>

      {poll.open && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {canVote ? (
            <>
              {voted && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Zrušit změnu
                </Button>
              )}
              <Button size="sm" loading={pending} onClick={submit}>
                {voted ? "Uložit změnu" : poll.kind === "text" ? "Odeslat odpověď" : "Hlasovat"}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Změnit hlas
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
