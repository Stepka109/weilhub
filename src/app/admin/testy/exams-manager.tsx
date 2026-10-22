"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { FileCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { AdminTable, StatusBadge, Td, Tr } from "@/components/admin/common";
import { RowMenu, StatusSelect } from "@/components/admin/row-menu";
import { MaterialPicker, type MaterialOption } from "@/components/admin/material-picker";
import { StudyGroupField } from "@/components/admin/study-group-field";
import { GroupBadge } from "@/components/portal/group-badge";
import { deleteRow, saveExam, setStatus } from "@/lib/actions/admin/content";
import { useAction } from "@/lib/use-action";
import { formatDate, formatTime, todayIso } from "@/lib/dates";
import type { Exam, PublicationStatus, SubjectRef } from "@/lib/types";

type Row = Exam & { subject: SubjectRef | null; materials: { material_id: string }[] };

interface Values {
  title: string;
  subject_id: string;
  exam_date: string;
  exam_time: string;
  scope: string;
  notes: string;
  study_group: "" | "S1" | "S2";
  status: PublicationStatus;
  material_ids: string[];
}

function ExamDialog({
  exam,
  open,
  onOpenChange,
  subjects,
  materials,
}: {
  exam: Row | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  subjects: { id: string; name: string; has_groups: boolean }[];
  materials: MaterialOption[];
}) {
  const { pending, run } = useAction();
  const { register, handleSubmit, control, formState, setError, watch } = useForm<Values>({
    values: {
      title: exam?.title ?? "",
      subject_id: exam?.subject_id ?? "",
      exam_date: exam?.exam_date ?? "",
      exam_time: exam?.exam_time?.slice(0, 5) ?? "",
      scope: exam?.scope ?? "",
      notes: exam?.notes ?? "",
      study_group: exam?.study_group ?? "",
      status: exam?.status ?? "published",
      material_ids: exam?.materials.map((m) => m.material_id) ?? [],
    },
  });
  const e = formState.errors;

  const onSubmit = handleSubmit(async (v) => {
    const study_group = subjects.find((s) => s.id === v.subject_id)?.has_groups ? v.study_group : null;
    const res = await run(() => saveExam(exam?.id ?? null, { ...v, study_group }), { onSuccess: () => onOpenChange(false) });
    if (!res.ok) for (const [k, m] of Object.entries(res.fieldErrors ?? {})) if (m?.[0]) setError(k as keyof Values, { message: m[0] });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={exam ? "Upravit test" : "Nový test"} wide>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <Field label="Název testu" htmlFor="e-title" required error={e.title?.message}>
            <Input id="e-title" placeholder="např. Test – číselné soustavy" {...register("title", { required: "Zadejte název." })} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-[1fr_170px_120px]">
            <Field label="Předmět" htmlFor="e-subject" required error={e.subject_id?.message}>
              <Select id="e-subject" {...register("subject_id", { required: "Vyberte předmět." })}>
                <option value="">Vyberte…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Datum" htmlFor="e-date" required error={e.exam_date?.message}>
              <Input id="e-date" type="date" {...register("exam_date", { required: "Zadejte datum." })} />
            </Field>
            <Field label="Čas" htmlFor="e-time" hint="Nepovinné" error={e.exam_time?.message}>
              <Input id="e-time" type="time" {...register("exam_time")} />
            </Field>
          </div>
          {subjects.find((s) => s.id === watch("subject_id"))?.has_groups && (
            <StudyGroupField id="e-group" what="Test" {...register("study_group")} />
          )}
          <Field label="Rozsah učiva" htmlFor="e-scope">
            <Textarea id="e-scope" rows={3} {...register("scope")} />
          </Field>
          <Field label="Poznámky" htmlFor="e-notes" hint="Např. povolené pomůcky.">
            <Textarea id="e-notes" rows={2} {...register("notes")} />
          </Field>
          <Field label="Doporučené materiály pro přípravu">
            <Controller
              control={control}
              name="material_ids"
              render={({ field }) => <MaterialPicker options={materials} value={field.value} onChange={field.onChange} subjectId={watch("subject_id")} />}
            />
          </Field>
          <Field label="Stav zveřejnění">
            <Controller control={control} name="status" render={({ field }) => <StatusSelect value={field.value} onChange={field.onChange} />} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Zrušit
            </Button>
            <Button type="submit" loading={pending}>
              {exam ? "Uložit změny" : "Vytvořit test"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ExamsManager({
  exams,
  subjects,
  materials,
  openNew,
}: {
  exams: Row[];
  subjects: { id: string; name: string; has_groups: boolean }[];
  materials: MaterialOption[];
  openNew: boolean;
}) {
  const { run } = useAction();
  const [confirmDialog, ask] = useConfirm();
  const [dialog, setDialog] = React.useState<{ open: boolean; exam: Row | null }>({ open: openNew, exam: null });
  const [showPast, setShowPast] = React.useState(false);
  const today = todayIso();
  const rows = exams.filter((x) => (showPast ? x.exam_date < today : x.exam_date >= today));
  if (!showPast) rows.sort((a, b) => a.exam_date.localeCompare(b.exam_date));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-full border border-line bg-card p-1 shadow-card">
          {[false, true].map((past) => (
            <button
              key={String(past)}
              type="button"
              aria-pressed={showPast === past}
              onClick={() => setShowPast(past)}
              className={`h-9 rounded-full px-4 text-sm font-medium ${showPast === past ? "bg-primary text-white" : "text-muted hover:bg-slate-soft"}`}
            >
              {past ? "Proběhlé" : "Nadcházející"}
            </button>
          ))}
        </div>
        <Button onClick={() => setDialog({ open: true, exam: null })}>
          <Plus /> Nový test
        </Button>
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={FileCheck} title={showPast ? "Žádné proběhlé testy" : "Žádné nadcházející testy"} />
        </Card>
      ) : (
        <AdminTable head={["Datum", "Název", "Předmět", "Stav", "Akce"]}>
          {rows.map((x) => (
            <Tr key={x.id}>
              <Td className="font-medium whitespace-nowrap text-ink">
                {formatDate(x.exam_date, "EEEEEE d. M. yyyy")}
                {x.exam_time && <span className="text-muted"> · {formatTime(x.exam_time)}</span>}
              </Td>
              <Td>
                <button type="button" onClick={() => setDialog({ open: true, exam: x })} className="text-left font-medium text-ink hover:text-primary">
                  {x.title}
                </button>
              </Td>
              <Td label="Předmět" className="text-muted">
                {x.subject?.name}
                <GroupBadge group={x.study_group} className="ml-1.5" />
              </Td>
              <Td>
                <StatusBadge status={x.status} />
              </Td>
              <Td className="md:text-right">
                <RowMenu
                  label={x.title}
                  status={x.status}
                  onEdit={() => setDialog({ open: true, exam: x })}
                  onStatus={(s) => run(() => setStatus("exams", x.id, s))}
                  onDelete={() =>
                    ask({
                      title: "Smazat test?",
                      description: `Test „${x.title}“ bude trvale smazán a zmizí z kalendáře.`,
                      confirmLabel: "Smazat",
                      onConfirm: () => run(() => deleteRow("exams", x.id)),
                    })
                  }
                />
              </Td>
            </Tr>
          ))}
        </AdminTable>
      )}
      {confirmDialog}
      <ExamDialog
        exam={dialog.exam}
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        subjects={subjects}
        materials={materials}
      />
    </>
  );
}
