"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { CheckCircle2, CircleAlert, Eye, FileText, Loader2, NotebookPen, Save, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { FileUploader } from "@/components/upload/file-uploader";
import { uploadFile } from "@/components/upload/upload-client";
import { deleteFile } from "@/lib/actions/admin/files";
import { saveMaterial } from "@/lib/actions/admin/materials";
import { renderTiptapHtml } from "@/lib/tiptap";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Material, MaterialFile, PublicationStatus, Subject, SubjectTopic, TiptapNode } from "@/lib/types";

interface Values {
  title: string;
  subject_id: string;
  topic_id: string;
  kind: "note" | "file";
  description: string;
  material_date: string;
  content: TiptapNode | null;
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string } | { kind: "error"; message: string };

const DRAFT_KEY = (id: string | null) => `wh-material-draft:${id ?? "novy"}`;

export function MaterialForm({
  material,
  subjects,
  allowedTypes,
  maxMb,
  defaultSubject,
}: {
  material: (Material & { files: MaterialFile[] }) | null;
  subjects: (Subject & { topics: SubjectTopic[] })[];
  allowedTypes: string[];
  maxMb: number;
  defaultSubject?: string;
}) {
  const [id, setId] = React.useState<string | null>(material?.id ?? null);
  const [status, setStatus] = React.useState<PublicationStatus>(material?.status ?? "draft");
  const [files, setFiles] = React.useState<MaterialFile[]>(material?.files ?? []);
  const [save, setSave] = React.useState<SaveState>(material ? { kind: "saved", at: material.updated_at } : { kind: "idle" });
  const [preview, setPreview] = React.useState(false);
  const [restore, setRestore] = React.useState<{ values: Values; at: string } | null>(null);
  const [editorKey, setEditorKey] = React.useState(0);

  const defaults: Values = {
    title: material?.title ?? "",
    subject_id: material?.subject_id ?? subjects.find((s) => s.slug === defaultSubject)?.id ?? "",
    topic_id: material?.topic_id ?? "",
    kind: material?.kind ?? "note",
    description: material?.description ?? "",
    material_date: material?.material_date ?? "",
    content: material?.content ?? null,
  };
  const form = useForm<Values>({ defaultValues: defaults });
  const { register, control, handleSubmit, watch, formState, setError, getValues, reset, trigger } = form;
  const subjectId = watch("subject_id");
  const kind = watch("kind");
  const topics = subjects.find((s) => s.id === subjectId)?.topics ?? [];
  const mainFile = files.find((f) => f.role === "main");
  const attachments = files.filter((f) => f.role === "attachment");

  // Obnovení rozepsaného obsahu po pádu prohlížeče / ztrátě spojení
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY(material?.id ?? null));
      if (!raw) return;
      const saved = JSON.parse(raw) as { values: Values; at: string };
      if (!material || saved.at > material.updated_at) setRestore(saved);
      else localStorage.removeItem(DRAFT_KEY(material.id));
    } catch {
      /* úložiště nedostupné */
    }
  }, [material]);

  // Průběžná záloha rozepsaných změn do prohlížeče
  React.useEffect(() => {
    const sub = watch((values) => {
      if (!formState.isDirty) return;
      try {
        localStorage.setItem(DRAFT_KEY(id), JSON.stringify({ values, at: new Date().toISOString() }));
      } catch {
        /* nic */
      }
    });
    return () => sub.unsubscribe();
  }, [watch, id, formState.isDirty]);

  // Varování před opuštěním stránky s neuloženými změnami
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (formState.isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [formState.isDirty]);

  async function persist(next: PublicationStatus): Promise<string | null> {
    const values = getValues();
    setSave({ kind: "saving" });
    let res;
    try {
      res = await saveMaterial(id, {
        title: values.title,
        subject_id: values.subject_id,
        topic_id: values.topic_id,
        kind: values.kind,
        description: values.description,
        material_date: values.material_date,
        // Čistá kopie dat – uzly editoru (např. vzorce) nejsou obyčejné objekty a server
        // by je dostal jen jako „temporary client reference“
        content: values.kind === "note" && values.content ? JSON.parse(JSON.stringify(values.content)) : undefined,
        status: next,
      });
    } catch {
      res = { ok: false as const, error: "Server je nedostupný. Obsah zůstal uložený v prohlížeči – zkuste to znovu." };
    }
    if (!res.ok) {
      setSave({ kind: "error", message: res.error });
      toast.error(res.error);
      for (const [k, msg] of Object.entries(res.fieldErrors ?? {})) if (msg?.[0]) setError(k as keyof Values, { message: msg[0] });
      return null;
    }
    const newId = res.data!.id;
    try {
      localStorage.removeItem(DRAFT_KEY(id));
      localStorage.removeItem(DRAFT_KEY(newId));
    } catch {
      /* nic */
    }
    reset(values);
    setStatus(next);
    setSave({ kind: "saved", at: res.data!.updatedAt });
    if (!id) {
      // Bez přenačtení stránky – rozpracované nahrávání tak nepřijde o stav
      setId(newId);
      window.history.replaceState(null, "", `/admin/materialy/${newId}`);
    }
    return newId;
  }

  const submit = (next: PublicationStatus) =>
    handleSubmit(async () => {
      const ok = await persist(next);
      if (ok) toast.success(next === "published" ? "Materiál byl publikován." : next === "archived" ? "Materiál byl archivován." : "Koncept byl uložen.");
    });

  /** Pro nahrání souboru musí materiál existovat – uložíme koncept. */
  async function ensureSaved(): Promise<string | null> {
    if (id) return id;
    const valid = await trigger(["title", "subject_id"]);
    if (!valid) {
      toast.error("Před nahráním souboru vyplňte název a předmět.");
      return null;
    }
    return persist("draft");
  }

  async function uploadImage(file: File) {
    const parent = await ensureSaved();
    if (!parent) return null;
    const uploaded = await uploadFile(file, { target: "material", parentId: parent, role: "inline" });
    return `/api/soubory/${uploaded.id}`;
  }

  async function removeFile(fileId: string) {
    const res = await deleteFile("material", fileId);
    if (res.ok) {
      setFiles((f) => f.filter((x) => x.id !== fileId));
      toast.success("Soubor byl odebrán.");
    } else toast.error(res.error);
  }

  function addFile(role: "main" | "attachment") {
    return (u: { id: string; fileName: string; size: number; mime: string }) =>
      setFiles((f) => [
        ...(role === "main" ? f.filter((x) => x.role !== "main") : f),
        {
          id: u.id,
          material_id: id ?? "",
          role,
          file_name: u.fileName,
          size_bytes: u.size,
          mime_type: u.mime,
          storage_path: "",
          created_at: new Date().toISOString(),
        },
      ]);
  }

  const e = formState.errors;

  return (
    <form onSubmit={(ev) => ev.preventDefault()} noValidate>
      {restore && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-yellow-ink/20 bg-yellow px-5 py-4 text-yellow-ink" role="status">
          <span className="flex items-center gap-2 text-sm font-medium">
            <CircleAlert className="size-5 shrink-0" aria-hidden />
            Našli jsme neuložené změny z {formatDateTime(restore.at)}.
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                reset(restore.values, { keepDefaultValues: true });
                setEditorKey((k) => k + 1);
                setRestore(null);
                toast.success("Neuložené změny byly obnoveny. Nezapomeňte je uložit.");
              }}
            >
              <Undo2 /> Obnovit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                localStorage.removeItem(DRAFT_KEY(id));
                setRestore(null);
              }}
            >
              Zahodit
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardBody className="space-y-5">
              <Field label="Název materiálu" htmlFor="m-title" required error={e.title?.message}>
                <Input id="m-title" placeholder="např. Převody mezi číselnými soustavami" aria-invalid={!!e.title} {...register("title", { required: "Zadejte název materiálu." })} />
              </Field>
              <Field label="Krátký popis" htmlFor="m-desc" hint="Zobrazí se v seznamu materiálů a ve výsledcích vyhledávání.">
                <Textarea id="m-desc" rows={2} maxLength={1000} {...register("description")} />
              </Field>
              <Field label="Typ materiálu">
                <Controller
                  control={control}
                  name="kind"
                  render={({ field }) => (
                    <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                      {(
                        [
                          { v: "note", label: "Interní zápis", text: "Text napsaný přímo ve WeilHubu", icon: NotebookPen },
                          { v: "file", label: "Soubor", text: "PDF, Word, prezentace, obrázek…", icon: FileText },
                        ] as const
                      ).map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          role="radio"
                          aria-checked={field.value === o.v}
                          onClick={() => field.onChange(o.v)}
                          className={cn(
                            "flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
                            field.value === o.v ? "border-primary bg-light-blue/40" : "border-line hover:border-[#cfd7e4]",
                          )}
                        >
                          <o.icon className={cn("mt-0.5 size-5", field.value === o.v ? "text-primary" : "text-muted")} aria-hidden />
                          <span>
                            <span className="block font-medium text-ink">{o.label}</span>
                            <span className="block text-sm text-muted">{o.text}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                />
              </Field>
            </CardBody>
          </Card>

          {kind === "note" ? (
            <Controller
              control={control}
              name="content"
              render={({ field }) => <RichTextEditor key={editorKey} value={field.value} onChange={field.onChange} onUploadImage={uploadImage} />}
            />
          ) : (
            <Card>
              <CardHeader title="Hlavní soubor" description="PDF se studentům zobrazí přímo v aplikaci, ostatní formáty ke stažení." />
              <CardBody>
                <FileUploader
                  target="material"
                  role="main"
                  multiple={false}
                  parentId={id}
                  ensureParent={ensureSaved}
                  files={mainFile ? [mainFile] : []}
                  onUploaded={addFile("main")}
                  onDelete={removeFile}
                  allowedTypes={allowedTypes}
                  maxMb={maxMb}
                  label={mainFile ? "Nahrát nový soubor (nahradí stávající)" : "Nahrajte soubor materiálu"}
                />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Přílohy" description="Doplňující soubory ke stažení (nepovinné)." />
            <CardBody>
              <FileUploader
                target="material"
                role="attachment"
                parentId={id}
                ensureParent={ensureSaved}
                files={attachments}
                onUploaded={addFile("attachment")}
                onDelete={removeFile}
                allowedTypes={allowedTypes}
                maxMb={maxMb}
                label="Přidat přílohy"
              />
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-8 xl:self-start">
          <Card>
            <CardBody className="space-y-5">
              <Field label="Předmět" htmlFor="m-subject" required error={e.subject_id?.message}>
                <Select id="m-subject" aria-invalid={!!e.subject_id} {...register("subject_id", { required: "Vyberte předmět." })}>
                  <option value="">Vyberte předmět…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.is_archived ? " (archivovaný)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tematický okruh" htmlFor="m-topic" hint={subjectId && topics.length === 0 ? "Předmět zatím nemá témata (lze přidat ve správě předmětů)." : undefined}>
                <Select id="m-topic" disabled={!topics.length} {...register("topic_id")}>
                  <option value="">Bez tématu</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Datum materiálu" htmlFor="m-date" hint="Nepovinné, např. datum hodiny.">
                <Input id="m-date" type="date" {...register("material_date")} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <p className="flex items-center justify-between text-sm">
                <span className="text-muted">Stav</span>
                <span className="font-medium text-ink">{{ draft: "Koncept", published: "Publikováno", archived: "Archivováno" }[status]}</span>
              </p>
              <p className="flex min-h-5 items-center gap-1.5 text-sm" aria-live="polite">
                {save.kind === "saving" && (
                  <>
                    <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> <span className="text-muted">Ukládám…</span>
                  </>
                )}
                {save.kind === "saved" && !formState.isDirty && (
                  <>
                    <CheckCircle2 className="size-4 text-mint-ink" aria-hidden /> <span className="text-muted">Uloženo {formatDateTime(save.at)}</span>
                  </>
                )}
                {formState.isDirty && save.kind !== "saving" && (
                  <>
                    <CircleAlert className="size-4 text-yellow-ink" aria-hidden /> <span className="text-muted">Neuložené změny (záloha v prohlížeči)</span>
                  </>
                )}
                {save.kind === "error" && !formState.isDirty && <span className="text-rose-ink">{save.message}</span>}
              </p>
              <div className="grid gap-2 pt-2">
                <Button onClick={submit("published")} loading={save.kind === "saving"}>
                  {save.kind !== "saving" && <Send />} {status === "published" ? "Uložit a ponechat publikované" : "Publikovat"}
                </Button>
                <Button variant="outline" onClick={submit(status === "published" ? "published" : "draft")} disabled={save.kind === "saving"}>
                  <Save /> {status === "published" ? "Uložit změny" : "Uložit koncept"}
                </Button>
                {status === "published" && (
                  <Button variant="ghost" onClick={submit("draft")} disabled={save.kind === "saving"}>
                    Stáhnout z publikace
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setPreview(true)}>
                  <Eye /> Náhled
                </Button>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent title={watch("title") || "Bez názvu"} description="Náhled – takto materiál uvidí studenti." wide>
          {watch("description") && <p className="mb-4 text-muted">{watch("description")}</p>}
          {kind === "note" ? (
            <div className="prose-wh" dangerouslySetInnerHTML={{ __html: renderTiptapHtml(watch("content")) || "<p>Prázdný zápis.</p>" }} />
          ) : (
            <p className="text-muted">{mainFile ? `Soubor: ${mainFile.file_name}` : "Zatím nebyl nahrán žádný soubor."}</p>
          )}
          {attachments.length > 0 && <p className="mt-4 text-sm text-muted">Přílohy: {attachments.map((a) => a.file_name).join(", ")}</p>}
        </DialogContent>
      </Dialog>
    </form>
  );
}
