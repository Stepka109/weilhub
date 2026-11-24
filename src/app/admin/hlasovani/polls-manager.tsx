"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { CheckSquare, CircleDot, MessageSquareText, Plus, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/admin/common";
import { RowMenu, StatusSelect } from "@/components/admin/row-menu";
import { ActivityButton } from "@/components/admin/activity-button";
import { deleteRow, savePoll, setStatus } from "@/lib/actions/admin/content";
import { useAction } from "@/lib/use-action";
import { formatDateTime } from "@/lib/dates";
import type { AdminPoll } from "@/lib/data/admin";
import type { PollKind, PublicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const KINDS: { key: PollKind; label: string; hint: string; icon: typeof Vote }[] = [
  { key: "single", label: "Jedna možnost", hint: "Výběr jedné odpovědi", icon: CircleDot },
  { key: "multiple", label: "Více možností", hint: "Lze zaškrtnout více", icon: CheckSquare },
  { key: "text", label: "Krátká odpověď", hint: "Vlastní text", icon: MessageSquareText },
];

interface Values {
  question: string;
  description: string;
  kind: PollKind;
  options: string;
  closes_at: string;
  show_results: boolean;
  anonymous: boolean;
  status: PublicationStatus;
}

/** ISO → hodnota pro <input type="datetime-local"> v místním čase */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PollDialog({ item, open, onOpenChange }: { item: AdminPoll | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { pending, run } = useAction();
  const { register, handleSubmit, control, formState, setError, watch } = useForm<Values>({
    values: {
      question: item?.question ?? "",
      description: item?.description ?? "",
      kind: item?.kind ?? "single",
      options: item?.options.join("\n") ?? "",
      closes_at: toLocalInput(item?.closes_at ?? null),
      show_results: item?.show_results ?? true,
      anonymous: item?.anonymous ?? false,
      status: item?.status ?? "published",
    },
  });
  const kind = watch("kind");
  const voted = (item?.results?.voters ?? 0) > 0;

  const onSubmit = handleSubmit(async (v) => {
    const payload = { ...v, closes_at: v.closes_at ? new Date(v.closes_at).toISOString() : "" };
    const res = await run(() => savePoll(item?.id ?? null, payload), { onSuccess: () => onOpenChange(false) });
    if (!res.ok) for (const [k, m] of Object.entries(res.fieldErrors ?? {})) if (m?.[0]) setError(k as keyof Values, { message: m[0] });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={item ? "Upravit hlasování" : "Nové hlasování"} wide>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <div role="radiogroup" aria-label="Druh hlasování" className="grid grid-cols-3 gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    role="radio"
                    aria-checked={field.value === k.key}
                    disabled={voted}
                    onClick={() => field.onChange(k.key)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition-colors disabled:opacity-60",
                      field.value === k.key ? "border-primary bg-light-blue/40" : "border-line hover:border-line-strong",
                    )}
                  >
                    <k.icon className={cn("size-[18px]", field.value === k.key ? "text-primary" : "text-muted")} aria-hidden />
                    <span className="text-sm font-semibold text-ink">{k.label}</span>
                    <span className="text-xs text-muted max-sm:hidden">{k.hint}</span>
                  </button>
                ))}
              </div>
            )}
          />
          <Field label="Otázka" htmlFor="pl-q" required error={formState.errors.question?.message}>
            <Input id="pl-q" placeholder="např. Kam pojedeme na třídní výlet?" {...register("question", { required: "Zadejte otázku." })} />
          </Field>
          <Field label="Popis" htmlFor="pl-d" hint="Nepovinné – podrobnosti, termíny, ceny…">
            <Textarea id="pl-d" rows={2} {...register("description")} />
          </Field>
          {kind !== "text" && (
            <Field
              label="Možnosti"
              htmlFor="pl-o"
              required
              hint={voted ? "Už se hlasovalo – při změně pořadí možností by se hlasy posunuly." : "Každou možnost na nový řádek (2–12)."}
              error={formState.errors.options?.message}
            >
              <Textarea id="pl-o" rows={5} placeholder={"Praha\nBrno\nOstrava"} {...register("options")} />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Uzavřít" htmlFor="pl-c" hint="Nepovinné – bez data zůstane otevřené.">
              <Input id="pl-c" type="datetime-local" {...register("closes_at")} />
            </Field>
            <Field label="Stav">
              <Controller control={control} name="status" render={({ field }) => <StatusSelect value={field.value} onChange={field.onChange} />} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              control={control}
              name="show_results"
              render={({ field }) => (
                <label className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-4 py-3">
                  <span>
                    <span className="block font-medium text-ink">Ukázat výsledky</span>
                    <span className="block text-xs text-muted">Studentům po odhlasování</span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
            <Controller
              control={control}
              name="anonymous"
              render={({ field }) => (
                <label className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-4 py-3">
                  <span>
                    <span className="block font-medium text-ink">Anonymní</span>
                    <span className="block text-xs text-muted">Ani správce neuvidí jména</span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
          </div>
          <p className="text-xs text-muted">Zveřejněné hlasování se studentům ukáže na nástěnce jako důležité, dokud nehlasují.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Zrušit
            </Button>
            <Button type="submit" loading={pending}>
              Uložit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PollResultsView({ poll }: { poll: AdminPoll }) {
  if (poll.kind === "text") {
    if (!poll.answers.length) return <p className="text-sm text-muted">Zatím žádné odpovědi.</p>;
    return (
      <ul className="space-y-2">
        {poll.answers.map((a, i) => (
          <li key={i} className="rounded-2xl bg-bg px-4 py-2.5 text-sm">
            <span className="whitespace-pre-line text-ink">{a.answer}</span>
            <span className="mt-0.5 block text-xs text-muted">
              {a.person ?? "anonymně"} · {formatDateTime(a.created_at)}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  const r = poll.results;
  if (!r) return null;
  const max = Math.max(1, ...r.counts);
  return (
    <ul className="space-y-2">
      {poll.options.map((o, i) => (
        <li key={i}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="text-ink">{o}</span>
            <span className="shrink-0 text-muted">
              {r.counts[i] ?? 0}
              {r.voters ? ` (${Math.round(((r.counts[i] ?? 0) / r.voters) * 100)} %)` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-soft">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${((r.counts[i] ?? 0) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PollsManager({ items, people }: { items: AdminPoll[]; people: number }) {
  const { run } = useAction();
  const [confirmDialog, ask] = useConfirm();
  const [dialog, setDialog] = React.useState<{ open: boolean; item: AdminPoll | null }>({ open: false, item: null });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialog({ open: true, item: null })}>
          <Plus /> Nové hlasování
        </Button>
      </div>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={Vote} title="Zatím žádné hlasování" description="Vytvoř anketu – studenti ji uvidí na nástěnce." />
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => {
            const open = p.open;
            return (
              <li key={p.id}>
                <Card className="flex items-start gap-4 p-5">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={p.status} />
                      <Badge tone="outline">{KINDS.find((k) => k.key === p.kind)?.label}</Badge>
                      {p.anonymous && <Badge tone="slate">Anonymní</Badge>}
                      {p.status === "published" && (open ? <Badge tone="mint">Otevřené</Badge> : <Badge tone="slate">Uzavřené</Badge>)}
                      {p.closes_at && <span className="text-xs text-muted">do {formatDateTime(p.closes_at)}</span>}
                      {p.status === "published" && (
                        <ActivityButton kind="poll" id={p.id} count={p.results?.voters ?? 0} total={people} anonymous={p.anonymous} />
                      )}
                    </div>
                    <button type="button" onClick={() => setDialog({ open: true, item: p })} className="block text-left font-semibold text-ink hover:text-primary">
                      {p.question}
                    </button>
                    <PollResultsView poll={p} />
                  </div>
                  <RowMenu
                    label={p.question}
                    status={p.status}
                    onEdit={() => setDialog({ open: true, item: p })}
                    onStatus={(s) => run(() => setStatus("polls", p.id, s))}
                    onDelete={() =>
                      ask({
                        title: "Smazat hlasování?",
                        description: `„${p.question}“ se smaže i se všemi hlasy. Tuto akci nelze vrátit.`,
                        confirmLabel: "Smazat",
                        destructive: true,
                        onConfirm: () => run(() => deleteRow("polls", p.id)),
                      })
                    }
                  />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <PollDialog key={dialog.item?.id ?? "novy"} item={dialog.item} open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} />
      {confirmDialog}
    </>
  );
}
