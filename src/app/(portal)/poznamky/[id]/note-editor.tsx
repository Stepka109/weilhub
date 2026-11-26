"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CloudOff, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteNote, registerNoteImage, saveNote } from "@/lib/actions/notes";
import { createClient } from "@/lib/supabase/client";
import type { NoteFull } from "@/lib/data/notes";
import type { SubjectRef, TiptapNode } from "@/lib/types";

type Patch = { title?: string; subjectId?: string | null; lessonDate?: string | null; shared?: boolean; content?: TiptapNode };
type Status = "saved" | "dirty" | "saving" | "error";

const MAX_EDGE = 2000;

/** Fotky z telefonu zmenší a převede na JPEG (rychlejší nahrání, menší úložiště). */
async function prepareImage(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  if (file.type === "image/gif") return { blob: file, ext: "gif", type: file.type };
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("Tenhle obrázek neumím otevřít. Zkus PNG nebo JPG.");
  const small = Math.max(bitmap.width, bitmap.height) <= 2400;
  if (file.type === "image/png" && file.size <= 1_500_000 && small) return { blob: file, ext: "png", type: file.type };
  if ((file.type === "image/jpeg" || file.type === "image/webp") && file.size <= 1_000_000 && small) {
    return { blob: file, ext: file.type === "image/webp" ? "webp" : "jpg", type: file.type };
  }
  const k = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("Obrázek se nepodařilo zpracovat.");
  return { blob, ext: "jpg", type: "image/jpeg" };
}

export function NoteEditor({ note, subjects, userId }: { note: NoteFull; subjects: SubjectRef[]; userId: string }) {
  const router = useRouter();
  const [confirmDialog, ask] = useConfirm();
  const [title, setTitle] = React.useState(note.title);
  const [subjectId, setSubjectId] = React.useState(note.subject_id ?? "");
  const [lessonDate, setLessonDate] = React.useState(note.lesson_date ?? "");
  const [shared, setShared] = React.useState(note.shared);
  const [status, setStatus] = React.useState<Status>("saved");

  const pending = React.useRef<Patch>({});
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const inflight = React.useRef<Promise<void> | null>(null);

  const flush = React.useCallback(async () => {
    clearTimeout(timer.current);
    if (inflight.current) await inflight.current;
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    pending.current = {};
    setStatus("saving");
    const run = (async () => {
      const res = await saveNote(note.id, patch);
      if (res.ok) {
        setStatus(Object.keys(pending.current).length ? "dirty" : "saved");
      } else {
        // Nepodařené změny vrátíme do fronty, příště se zkusí znovu
        pending.current = { ...patch, ...pending.current };
        setStatus("error");
        toast.error(res.error);
      }
    })();
    inflight.current = run;
    await run;
    inflight.current = null;
  }, [note.id]);

  const queue = React.useCallback(
    (patch: Patch, delay = 1200) => {
      pending.current = { ...pending.current, ...patch };
      setStatus("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [flush],
  );

  // Neuložené změny při zavření stránky / odchodu
  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length || inflight.current) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      void flush();
    };
  }, [flush]);

  async function uploadImage(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) throw new Error("Vlož prosím obrázek (PNG, JPG, WEBP nebo GIF).");
    if (file.size > 25 * 1024 * 1024) throw new Error("Obrázek je moc velký (víc než 25 MB).");
    const { blob, ext, type } = await prepareImage(file);
    if (blob.size > 10 * 1024 * 1024) throw new Error("Obrázek je i po zmenšení větší než 10 MB.");
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient().storage.from("notes").upload(path, blob, { contentType: type, upsert: false });
    if (error) throw new Error("Obrázek se nepodařilo nahrát. Zkus to znovu.");
    const res = await registerNoteImage(note.id, path, file.name);
    if (!res.ok || !res.data) throw new Error(res.ok ? "Obrázek se nepodařilo uložit." : res.error);
    return res.data.src;
  }

  const statusView = {
    saved: { icon: Check, text: "Uloženo", cls: "text-mint-ink" },
    dirty: { icon: Loader2, text: "Neuloženo…", cls: "text-muted" },
    saving: { icon: Loader2, text: "Ukládám…", cls: "text-muted" },
    error: { icon: CloudOff, text: "Neuloženo – zkusím znovu", cls: "text-rose-ink" },
  }[status];

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-card border border-line/80 bg-card p-4 shadow-card sm:p-5">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            queue({ title: e.target.value });
          }}
          placeholder="Název poznámky"
          aria-label="Název poznámky"
          maxLength={200}
          className="h-12 border-transparent bg-transparent px-1 text-xl font-bold shadow-none focus-visible:border-line"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Select
            aria-label="Předmět"
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              queue({ subjectId: e.target.value || null }, 0);
            }}
            className="h-10 w-auto min-w-40"
          >
            <option value="">Bez předmětu</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            aria-label="Den hodiny"
            title="Den hodiny, ke které poznámka patří"
            value={lessonDate}
            onChange={(e) => {
              setLessonDate(e.target.value);
              queue({ lessonDate: e.target.value || null }, 0);
            }}
            className="h-10 w-auto"
          />
          <label className="flex items-center gap-2.5 rounded-full bg-bg py-1.5 pr-4 pl-2">
            <Switch
              checked={shared}
              onCheckedChange={(v) => {
                setShared(v);
                queue({ shared: v }, 0);
                toast.success(v ? "Poznámka je sdílená – správce ji uvidí." : "Poznámka je zase jen tvoje.");
              }}
            />
            <span className="text-sm font-medium text-ink">Sdílet se správcem</span>
          </label>
          <span className={`ml-auto inline-flex items-center gap-1.5 text-sm ${statusView.cls}`} role="status" aria-live="polite">
            <statusView.icon className={`size-4 ${status === "saving" ? "animate-spin" : ""}`} aria-hidden />
            {statusView.text}
          </span>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Smazat poznámku"
            onClick={() =>
              ask({
                title: "Smazat poznámku?",
                description: "Poznámka se smaže i s kresbami a obrázky. Tuto akci nelze vrátit.",
                confirmLabel: "Smazat",
                destructive: true,
                onConfirm: async () => {
                  clearTimeout(timer.current);
                  pending.current = {};
                  const res = await deleteNote(note.id);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(res.message);
                  router.push("/poznamky");
                },
              })
            }
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
        <p className="text-xs text-muted">
          {shared
            ? "Sdíleno: správce poznámku vidí a může z ní sestavit zápis pro třídu. Spolužáci ji nevidí."
            : "Soukromé: poznámku vidíš jen ty."}{" "}
          Kresli perem (Apple Pencil) nebo myší, prstem se stránka posouvá – kreslení prstem zapneš ikonou ruky u kresby.
        </p>
      </div>

      <RichTextEditor
        value={note.content}
        onChange={(doc) => queue({ content: doc })}
        onUploadImage={uploadImage}
        allowDrawing
        ariaLabel="Obsah poznámky"
        placeholder="Piš poznámky… Kreslicí plochu vložíš tlačítkem s perem na liště, obrázek tlačítkem s obrázkem nebo vložením ze schránky."
      />
      {confirmDialog}
    </div>
  );
}
