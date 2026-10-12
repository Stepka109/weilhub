"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { BookOpen, Check, Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { addTimetableTeacher, deleteTimetableSubject, deleteTimetableTeacher, saveTimetableSubject } from "@/lib/actions/admin/timetable";
import { useAction } from "@/lib/use-action";
import type { TimetableSubject, TimetableTeacher } from "@/lib/data/timetable";

interface SubjectValues {
  code: string;
  name: string;
  default_teacher: string;
}

function SubjectRow({ subject, teachers }: { subject: TimetableSubject; teachers: string[] }) {
  const { pending, run } = useAction();
  const [confirmDialog, ask] = useConfirm();
  const [editing, setEditing] = React.useState(false);
  const { register, handleSubmit } = useForm<SubjectValues>({
    values: { code: subject.code, name: subject.name, default_teacher: subject.default_teacher ?? "" },
  });

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form
          className="grid gap-2 sm:grid-cols-[90px_1fr_1fr_auto]"
          onSubmit={handleSubmit(async (v) => {
            const res = await run(() => saveTimetableSubject(subject.id, v));
            if (res.ok) setEditing(false);
          })}
        >
          <Input aria-label="Zkratka" className="h-10 uppercase" maxLength={10} {...register("code")} />
          <Input aria-label="Název" className="h-10" {...register("name")} />
          <Input aria-label="Výchozí učitel" className="h-10" list="cat-teachers" {...register("default_teacher")} />
          <div className="flex gap-1">
            <Button type="submit" size="icon" loading={pending} aria-label="Uložit">
              {!pending && <Check />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setEditing(false)} aria-label="Zrušit">
              <X />
            </Button>
          </div>
        </form>
        <datalist id="cat-teachers">
          {teachers.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-bg/60">
      <span className="grid h-9 min-w-14 place-items-center rounded-xl bg-light-blue px-2 font-display text-sm font-bold text-primary">{subject.code}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{subject.name}</span>
        <span className="block truncate text-sm text-muted">{subject.default_teacher ?? "bez výchozího učitele"}</span>
      </span>
      <Button variant="ghost" size="icon-sm" aria-label={`Upravit ${subject.name}`} onClick={() => setEditing(true)}>
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Odebrat ${subject.name}`}
        onClick={() =>
          ask({
            title: "Odebrat předmět z nabídky?",
            description: `${subject.code} – ${subject.name} zmizí z nabídky při úpravách rozvrhu. Hodiny, které už v rozvrhu jsou, zůstanou beze změny.`,
            confirmLabel: "Odebrat",
            onConfirm: () => run(() => deleteTimetableSubject(subject.id)),
          })
        }
      >
        <Trash2 />
      </Button>
      {confirmDialog}
    </li>
  );
}

export function CatalogManager({ subjects, teachers }: { subjects: TimetableSubject[]; teachers: TimetableTeacher[] }) {
  const { pending, run } = useAction();
  const [confirmDialog, ask] = useConfirm();
  const [teacherName, setTeacherName] = React.useState("");
  const subjectForm = useForm<SubjectValues>({ defaultValues: { code: "", name: "", default_teacher: "" } });
  const names = teachers.map((t) => t.name);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
      <Card>
        <CardHeader title="Předměty" description="Nabídka předmětů při úpravě rozvrhu (zkratka, název, výchozí učitel)." icon={<BookOpen className="size-5 text-muted" aria-hidden />} />
        <form
          className="grid gap-3 border-b border-line/80 px-5 py-4 sm:grid-cols-[90px_1fr_1fr_auto] sm:items-end sm:px-6"
          noValidate
          onSubmit={subjectForm.handleSubmit(async (v) => {
            const res = await run(() => saveTimetableSubject(null, v));
            if (res.ok) subjectForm.reset();
          })}
        >
          <Field label="Zkratka" htmlFor="ns-code">
            <Input id="ns-code" className="h-10 uppercase" maxLength={10} placeholder="HDW" {...subjectForm.register("code")} />
          </Field>
          <Field label="Název" htmlFor="ns-name">
            <Input id="ns-name" className="h-10" placeholder="Hardware" {...subjectForm.register("name")} />
          </Field>
          <Field label="Výchozí učitel" htmlFor="ns-teacher">
            <Input id="ns-teacher" className="h-10" list="cat-teachers-new" {...subjectForm.register("default_teacher")} />
          </Field>
          <Button type="submit" loading={pending} className="h-10">
            {!pending && <Plus />} Přidat
          </Button>
          <datalist id="cat-teachers-new">
            {names.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </form>
        {subjects.length === 0 ? (
          <EmptyState icon={BookOpen} title="Zatím žádné předměty" />
        ) : (
          <ul className="divide-y divide-line/80 pb-2">
            {subjects.map((s) => (
              <SubjectRow key={s.id} subject={s} teachers={names} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Učitelé" description="Seznam pro rychlý výběr v rozvrhu." icon={<UserRound className="size-5 text-muted" aria-hidden />} />
        <form
          className="flex gap-2 border-b border-line/80 px-5 py-4 sm:px-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await run(() => addTimetableTeacher(teacherName));
            if (res.ok) setTeacherName("");
          }}
        >
          <Input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Jméno učitele" className="h-10" aria-label="Jméno učitele" />
          <Button type="submit" loading={pending} className="h-10">
            {!pending && <Plus />} Přidat
          </Button>
        </form>
        {teachers.length === 0 ? (
          <EmptyState icon={UserRound} title="Zatím žádní učitelé" />
        ) : (
          <ul className="divide-y divide-line/80 pb-2">
            {teachers.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 sm:px-6">
                <span className="flex-1 text-ink">{t.name}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Odebrat ${t.name}`}
                  onClick={() =>
                    ask({
                      title: "Odebrat učitele ze seznamu?",
                      description: `${t.name} zmizí z nabídky. Hodiny v rozvrhu zůstanou beze změny.`,
                      confirmLabel: "Odebrat",
                      onConfirm: () => run(() => deleteTimetableTeacher(t.id)),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {confirmDialog}
    </div>
  );
}
