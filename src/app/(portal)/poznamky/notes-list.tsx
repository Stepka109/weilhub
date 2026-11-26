"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NotebookPen, PenLine, Plus, Search, Share2, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/misc";
import { SubjectIcon } from "@/components/portal/shared";
import { createNote } from "@/lib/actions/notes";
import { formatDate, formatTimestampDate } from "@/lib/dates";
import type { NoteListItem } from "@/lib/data/notes";
import type { SubjectRef } from "@/lib/types";
import { cn } from "@/lib/utils";

const NO_SUBJECT = "bez";

function NewNoteDialog({ subjects, open, onOpenChange }: { subjects: SubjectRef[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = React.useState(subjects[0]?.id ?? NO_SUBJECT);
  const [mode, setMode] = React.useState<"text" | "pen">("text");
  const [pending, start] = React.useTransition();

  function create() {
    start(async () => {
      const res = await createNote({ subjectId: subjectId === NO_SUBJECT ? null : subjectId, mode });
      if (!res.ok || !res.data) return void toast.error(res.ok ? "Poznámku se nepodařilo vytvořit." : res.error);
      router.push(`/poznamky/${res.data.id}`);
    });
  }

  const modes = [
    { key: "text" as const, label: "Psaní", hint: "Text na klávesnici, kresby a obrázky vkládáš kamkoliv", icon: Type },
    { key: "pen" as const, label: "Perem", hint: "Celá stránka na psaní rukou (Apple Pencil, prst)", icon: PenLine },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Nová poznámka">
        <div className="space-y-5">
          <Field label="Předmět" htmlFor="nn-subject">
            <Select id="nn-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value={NO_SUBJECT}>Bez předmětu</option>
            </Select>
          </Field>
          <div role="radiogroup" aria-label="Druh poznámky" className="grid grid-cols-2 gap-2">
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={mode === m.key}
                onClick={() => setMode(m.key)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition-colors",
                  mode === m.key ? "border-primary bg-light-blue/40" : "border-line hover:border-line-strong",
                )}
              >
                <m.icon className={cn("size-5", mode === m.key ? "text-primary" : "text-muted")} aria-hidden />
                <span className="font-semibold text-ink">{m.label}</span>
                <span className="text-xs text-muted">{m.hint}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">Text, kresby i obrázky jde kombinovat v každé poznámce – druh určuje jen, čím začneš.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
          <Button onClick={create} loading={pending}>
            Vytvořit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Seznam vlastních poznámek s filtrem podle předmětu a hledáním. */
export function NotesList({ notes, subjects }: { notes: NoteListItem[]; subjects: SubjectRef[] }) {
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<string>("all");
  const [query, setQuery] = React.useState("");

  const used = subjects.filter((s) => notes.some((n) => n.subject?.id === s.id));
  const q = query.trim().toLocaleLowerCase("cs");
  const shown = notes.filter(
    (n) =>
      (filter === "all" || (filter === NO_SUBJECT ? !n.subject : n.subject?.id === filter)) &&
      (!q || `${n.title} ${n.preview} ${n.subject?.name ?? ""}`.toLocaleLowerCase("cs").includes(q)),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setOpen(true)}>
          <Plus aria-hidden /> Nová poznámka
        </Button>
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Hledat v poznámkách</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat v poznámkách" className="pl-10" />
        </label>
      </div>

      {used.length > 0 && (
        <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Předmět">
          {[{ id: "all", name: "Vše" }, ...used, ...(notes.some((n) => !n.subject) ? [{ id: NO_SUBJECT, name: "Bez předmětu" }] : [])].map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={filter === s.id}
              onClick={() => setFilter(s.id)}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors",
                filter === s.id ? "bg-primary text-on-primary" : "bg-card text-muted ring-1 ring-line hover:text-ink",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {notes.length === 0 ? (
        <Card>
          <EmptyState
            icon={NotebookPen}
            title="Zatím žádné poznámky"
            description="Vytvoř si první poznámku – na klávesnici, perem, nebo obojí."
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus aria-hidden /> Nová poznámka
              </Button>
            }
          />
        </Card>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-muted">Nic nenalezeno.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((n) => (
            <li key={n.id}>
              <Link
                href={`/poznamky/${n.id}`}
                className="flex h-full flex-col gap-3 rounded-card border border-line/80 bg-card p-5 shadow-card transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3">
                  {n.subject ? <SubjectIcon subject={n.subject} size="sm" /> : <NotebookPen className="size-9 rounded-xl bg-slate-soft p-2 text-muted" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{n.title || "Bez názvu"}</p>
                    <p className="text-xs text-muted">
                      {n.subject?.name ?? "Bez předmětu"}
                      {n.lesson_date && ` · hodina ${formatDate(n.lesson_date, "d. M.")}`}
                    </p>
                  </div>
                  {n.shared && (
                    <Badge tone="mint" className="shrink-0">
                      <Share2 className="size-3" aria-hidden /> Sdíleno
                    </Badge>
                  )}
                </div>
                <p className="line-clamp-3 min-h-[3.75rem] text-sm text-slate-ink">{n.preview || <span className="text-muted">Kresba nebo prázdná poznámka</span>}</p>
                <p className="mt-auto text-xs text-muted">Upraveno {formatTimestampDate(n.updated_at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewNoteDialog subjects={subjects} open={open} onOpenChange={setOpen} />
    </div>
  );
}
