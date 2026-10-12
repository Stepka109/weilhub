"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ExternalLink,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog, useConfirm } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/misc";
import { SubjectIcon } from "@/components/portal/shared";
import { ColorPicker, IconPicker } from "@/components/admin/pickers";
import { deleteSubject, deleteTopic, reorder, saveSubject, saveTopic, setSubjectArchived } from "@/lib/actions/admin/content";
import { useAction } from "@/lib/use-action";
import { slugify, cn } from "@/lib/utils";
import type { Subject, SubjectTopic } from "@/lib/types";

type Row = Subject & { topics: SubjectTopic[] };

interface SubjectValues {
  name: string;
  abbreviation: string;
  slug: string;
  teacher: string;
  color: string;
  icon: string;
  description: string;
  is_archived: boolean;
}

function SubjectDialog({ subject, open, onOpenChange }: { subject: Row | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { pending, run } = useAction();
  const form = useForm<SubjectValues>({
    values: {
      name: subject?.name ?? "",
      abbreviation: subject?.abbreviation ?? "",
      slug: subject?.slug ?? "",
      teacher: subject?.teacher ?? "",
      color: subject?.color ?? "blue",
      icon: subject?.icon ?? "book-open",
      description: subject?.description ?? "",
      is_archived: subject?.is_archived ?? false,
    },
  });
  const { register, handleSubmit, control, formState, setError, watch } = form;
  const name = watch("name");

  const onSubmit = handleSubmit(async (v) => {
    const res = await run(() => saveSubject(subject?.id ?? null, { ...v, slug: v.slug || slugify(v.name) }), {
      onSuccess: () => onOpenChange(false),
    });
    if (!res.ok) for (const [k, msg] of Object.entries(res.fieldErrors ?? {})) if (msg?.[0]) setError(k as keyof SubjectValues, { message: msg[0] });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={subject ? "Upravit předmět" : "Nový předmět"} description="Aktivní předměty se hned zobrazí studentům." wide>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
            <Field label="Název předmětu" htmlFor="s-name" required error={formState.errors.name?.message}>
              <Input id="s-name" placeholder="např. Hardware" {...register("name", { required: "Zadejte název." })} />
            </Field>
            <Field label="Zkratka" htmlFor="s-abbr" required error={formState.errors.abbreviation?.message}>
              <Input id="s-abbr" placeholder="HW" maxLength={10} {...register("abbreviation", { required: "Zadejte zkratku." })} />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Vyučující" htmlFor="s-teacher" hint="Nepovinné">
              <Input id="s-teacher" placeholder="např. Ing. Svoboda" {...register("teacher")} />
            </Field>
            <Field label="Adresa (slug)" htmlFor="s-slug" hint={`Prázdné = ${slugify(name) || "automaticky"}`} error={formState.errors.slug?.message}>
              <Input id="s-slug" placeholder={slugify(name)} {...register("slug")} />
            </Field>
          </div>
          <Field label="Barva">
            <Controller control={control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />} />
          </Field>
          <Field label="Ikonka">
            <Controller
              control={control}
              name="icon"
              render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} color={watch("color")} />}
            />
          </Field>
          <Field label="Popis" htmlFor="s-desc" hint="Nepovinné – zobrazí se v detailu předmětu.">
            <Textarea id="s-desc" rows={3} {...register("description")} />
          </Field>
          <Controller
            control={control}
            name="is_archived"
            render={({ field }) => (
              <label className="flex items-center justify-between gap-4 rounded-2xl bg-bg px-4 py-3">
                <span>
                  <span className="block font-medium text-ink">Archivovaný</span>
                  <span className="block text-sm text-muted">Archivovaný předmět studenti nevidí, obsah zůstává zachován.</span>
                </span>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </label>
            )}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Zrušit
            </Button>
            <Button type="submit" loading={pending}>
              {subject ? "Uložit změny" : "Vytvořit předmět"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TopicsPanel({ subject }: { subject: Row }) {
  const { pending, run } = useAction();
  const [name, setName] = React.useState("");
  const [editing, setEditing] = React.useState<{ id: string; name: string } | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await run(() => saveTopic(null, { subject_id: subject.id, name }));
    if (res.ok) setName("");
  }

  function move(index: number, dir: -1 | 1) {
    const ids = subject.topics.map((t) => t.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void run(() => reorder("subject_topics", ids), { success: "Pořadí uloženo." });
  }

  return (
    <div className="border-t border-line/80 bg-bg/50 px-5 py-4 sm:px-6">
      <p className="mb-3 text-sm font-semibold text-ink">Tematické okruhy ({subject.topics.length})</p>
      {subject.topics.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {subject.topics.map((t, i) => (
            <li key={t.id} className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-sm">
              {editing?.id === t.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await run(() => saveTopic(t.id, { subject_id: subject.id, name: editing.name }));
                    if (res.ok) setEditing(null);
                  }}
                >
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-9" autoFocus aria-label="Název tématu" />
                  <Button type="submit" size="sm" loading={pending}>
                    Uložit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Zrušit
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm text-ink">{t.name}</span>
                  <Button size="icon-sm" variant="ghost" aria-label={`Posunout ${t.name} nahoru`} disabled={i === 0 || pending} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Posunout ${t.name} dolů`} disabled={i === subject.topics.length - 1 || pending} onClick={() => move(i, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Přejmenovat ${t.name}`} onClick={() => setEditing({ id: t.id, name: t.name })}>
                    <Pencil />
                  </Button>
                  <ConfirmDialog
                    title="Smazat téma?"
                    description={`Téma „${t.name}“ bude smazáno. Materiály v něm zůstanou, jen nebudou zařazené do tématu.`}
                    confirmLabel="Smazat téma"
                    onConfirm={() => run(() => deleteTopic(t.id))}
                    trigger={
                      <Button size="icon-sm" variant="ghost" aria-label={`Smazat ${t.name}`}>
                        <Trash2 />
                      </Button>
                    }
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nové téma, např. Číselné soustavy" className="h-10" aria-label="Název nového tématu" maxLength={120} />
        <Button type="submit" size="sm" variant="secondary" className="h-10" loading={pending}>
          {!pending && <FolderPlus />} Přidat
        </Button>
      </form>
    </div>
  );
}

export function SubjectsManager({ subjects, openNew }: { subjects: Row[]; openNew: boolean }) {
  const [dialog, setDialog] = React.useState<{ open: boolean; subject: Row | null }>({ open: openNew, subject: null });
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const { pending, run } = useAction();
  const [confirmDialog, ask] = useConfirm();

  function move(index: number, dir: -1 | 1) {
    const ids = subjects.map((s) => s.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void run(() => reorder("subjects", ids), { success: "Pořadí uloženo." });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialog({ open: true, subject: null })}>
          <Plus /> Nový předmět
        </Button>
      </div>

      {subjects.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpen} title="Zatím žádné předměty" description="Přidejte první předmět – například Matematiku." />
        </Card>
      ) : (
        <ul className="space-y-3">
          {subjects.map((s, i) => (
            <li key={s.id}>
              <Card className={cn("overflow-hidden", s.is_archived && "opacity-70")}>
                <div className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6">
                  <div className="hidden flex-col sm:flex">
                    <button type="button" className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-30" aria-label={`Posunout ${s.name} nahoru`} disabled={i === 0 || pending} onClick={() => move(i, -1)}>
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-30" aria-label={`Posunout ${s.name} dolů`} disabled={i === subjects.length - 1 || pending} onClick={() => move(i, 1)}>
                      <ArrowDown className="size-4" />
                    </button>
                  </div>
                  <SubjectIcon subject={s} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      {s.name}
                      <Badge tone="outline">{s.abbreviation}</Badge>
                      {s.is_archived ? <Badge tone="slate">Archivovaný</Badge> : <Badge tone="mint">Aktivní</Badge>}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {s.teacher ?? "Vyučující neuveden"} · /{s.slug}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={expanded === s.id}
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    className="hidden sm:inline-flex"
                  >
                    Témata ({s.topics.length})
                    <ChevronDown className={cn("transition-transform", expanded === s.id && "rotate-180")} />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" aria-label={`Akce pro ${s.name}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => setDialog({ open: true, subject: s })}>
                        <Pencil /> Upravit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setExpanded(expanded === s.id ? null : s.id)}>
                        <FolderPlus /> Tematické okruhy
                      </DropdownMenuItem>
                      {!s.is_archived && (
                        <DropdownMenuItem asChild>
                          <Link href={`/predmety/${s.slug}`} target="_blank">
                            <ExternalLink /> Zobrazit v portálu
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => run(() => setSubjectArchived(s.id, !s.is_archived))}>
                        {s.is_archived ? <ArchiveRestore /> : <Archive />} {s.is_archived ? "Obnovit" : "Archivovat"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onSelect={() =>
                          ask({
                            title: "Smazat předmět?",
                            description: `Předmět „${s.name}“ bude trvale smazán i s tématy a hodinami v rozvrhu. Předmět s materiály, úkoly nebo testy smazat nelze – takový předmět archivujte.`,
                            confirmLabel: "Smazat předmět",
                            onConfirm: () => run(() => deleteSubject(s.id)),
                          })
                        }
                      >
                        <Trash2 /> Smazat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {expanded === s.id && <TopicsPanel subject={s} />}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {confirmDialog}
      <SubjectDialog subject={dialog.subject} open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} />
    </>
  );
}
