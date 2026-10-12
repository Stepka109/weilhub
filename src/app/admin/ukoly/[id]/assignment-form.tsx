"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { FileUploader } from "@/components/upload/file-uploader";
import { MaterialPicker, type MaterialOption } from "@/components/admin/material-picker";
import { deleteFile } from "@/lib/actions/admin/files";
import { saveAssignment } from "@/lib/actions/admin/materials";
import { todayIso } from "@/lib/dates";
import type { Assignment, AssignmentFile, PublicationStatus } from "@/lib/types";

interface Values {
  title: string;
  subject_id: string;
  instructions: string;
  assigned_on: string;
  due_date: string;
  due_time: string;
  material_ids: string[];
}

export function AssignmentForm({
  assignment,
  subjects,
  materials,
  allowedTypes,
  maxMb,
}: {
  assignment: (Assignment & { files: AssignmentFile[]; materials: { material_id: string }[] }) | null;
  subjects: { id: string; name: string }[];
  materials: MaterialOption[];
  allowedTypes: string[];
  maxMb: number;
}) {
  const router = useRouter();
  const [id, setId] = React.useState(assignment?.id ?? null);
  const [status, setStatus] = React.useState<PublicationStatus>(assignment?.status ?? "draft");
  const [files, setFiles] = React.useState(assignment?.files ?? []);
  const [saving, setSaving] = React.useState(false);
  const { register, handleSubmit, control, formState, setError, watch, getValues, trigger, reset } = useForm<Values>({
    defaultValues: {
      title: assignment?.title ?? "",
      subject_id: assignment?.subject_id ?? "",
      instructions: assignment?.instructions ?? "",
      assigned_on: assignment?.assigned_on ?? todayIso(),
      due_date: assignment?.due_date ?? "",
      due_time: assignment?.due_time?.slice(0, 5) ?? "",
      material_ids: assignment?.materials.map((m) => m.material_id) ?? [],
    },
  });
  const e = formState.errors;

  async function persist(next: PublicationStatus) {
    setSaving(true);
    const values = getValues();
    const res = await saveAssignment(id, { ...values, status: next }).catch(() => ({ ok: false as const, error: "Server je nedostupný." }));
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      for (const [k, msg] of Object.entries(("fieldErrors" in res && res.fieldErrors) || {})) if (msg?.[0]) setError(k as keyof Values, { message: msg[0] });
      return null;
    }
    reset(values);
    setStatus(next);
    if (!id) {
      setId(res.data!.id);
      window.history.replaceState(null, "", `/admin/ukoly/${res.data!.id}`);
    }
    return res.data!.id;
  }

  const submit = (next: PublicationStatus) =>
    handleSubmit(async () => {
      const ok = await persist(next);
      if (ok) toast.success(next === "published" ? "Úkol je publikovaný." : "Úkol byl uložen jako koncept.");
    });

  async function ensureSaved() {
    if (id) return id;
    if (!(await trigger(["title", "subject_id", "due_date"]))) {
      toast.error("Před nahráním přílohy vyplňte název, předmět a termín.");
      return null;
    }
    return persist("draft");
  }

  return (
    <form onSubmit={(ev) => ev.preventDefault()} noValidate className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardBody className="space-y-5">
            <Field label="Název úkolu" htmlFor="a-title" required error={e.title?.message}>
              <Input id="a-title" aria-invalid={!!e.title} {...register("title", { required: "Zadejte název úkolu." })} />
            </Field>
            <Field label="Zadání" htmlFor="a-instr" error={e.instructions?.message} hint="Co přesně je potřeba udělat. Odstavce oddělte prázdným řádkem.">
              <Textarea id="a-instr" rows={8} maxLength={10000} {...register("instructions")} />
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Přílohy" description="Například pracovní list nebo zadání v PDF." />
          <CardBody>
            <FileUploader
              target="assignment"
              parentId={id}
              ensureParent={ensureSaved}
              files={files}
              onUploaded={(u) =>
                setFiles((f) => [
                  ...f,
                  { id: u.id, assignment_id: id ?? "", file_name: u.fileName, size_bytes: u.size, mime_type: u.mime, storage_path: "", created_at: new Date().toISOString() },
                ])
              }
              onDelete={async (fileId) => {
                const res = await deleteFile("assignment", fileId);
                if (res.ok) setFiles((f) => f.filter((x) => x.id !== fileId));
                else toast.error(res.error);
              }}
              allowedTypes={allowedTypes}
              maxMb={maxMb}
              label="Přidat přílohy k úkolu"
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Související materiály" description="Studenti je uvidí v detailu úkolu." />
          <CardBody>
            <Controller
              control={control}
              name="material_ids"
              render={({ field }) => <MaterialPicker options={materials} value={field.value} onChange={field.onChange} subjectId={watch("subject_id")} />}
            />
          </CardBody>
        </Card>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-8 xl:self-start">
        <Card>
          <CardBody className="space-y-5">
            <Field label="Předmět" htmlFor="a-subject" required error={e.subject_id?.message}>
              <Select id="a-subject" aria-invalid={!!e.subject_id} {...register("subject_id", { required: "Vyberte předmět." })}>
                <option value="">Vyberte předmět…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Datum zadání" htmlFor="a-assigned" required error={e.assigned_on?.message}>
              <Input id="a-assigned" type="date" {...register("assigned_on", { required: "Zadejte datum." })} />
            </Field>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label="Termín odevzdání" htmlFor="a-due" required error={e.due_date?.message}>
                <Input id="a-due" type="date" aria-invalid={!!e.due_date} {...register("due_date", { required: "Zadejte termín." })} />
              </Field>
              <Field label="Čas" htmlFor="a-time" error={e.due_time?.message}>
                <Input id="a-time" type="time" {...register("due_time")} />
              </Field>
            </div>
            <p className="-mt-2 text-xs text-muted">Čas je nepovinný. Bez času se zobrazí jen datum.</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="grid gap-2">
            <p className="mb-1 flex justify-between text-sm">
              <span className="text-muted">Stav</span>
              <span className="font-medium text-ink">{{ draft: "Koncept", published: "Publikováno", archived: "Archivováno" }[status]}</span>
            </p>
            <Button onClick={submit("published")} loading={saving}>
              {!saving && <Send />} {status === "published" ? "Uložit změny" : "Publikovat"}
            </Button>
            {status !== "published" && (
              <Button variant="outline" onClick={submit("draft")} disabled={saving}>
                <Save /> Uložit koncept
              </Button>
            )}
            {status === "published" && (
              <Button variant="ghost" onClick={submit("draft")} disabled={saving}>
                Stáhnout z publikace
              </Button>
            )}
            <Button variant="ghost" onClick={() => router.push("/admin/ukoly")}>
              Zpět na seznam
            </Button>
          </CardBody>
        </Card>
      </aside>
    </form>
  );
}
