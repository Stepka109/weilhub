"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import { ChevronDown, CopyPlus, NotebookPen, Plus } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/misc";
import { composeMaterialFromNotes } from "@/lib/actions/admin/notes";
import { formatDate, formatTimestampDate, todayIso } from "@/lib/dates";
import type { TiptapNode } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ComposerNote {
  id: string;
  title: string;
  author: string;
  subject: string | null;
  lessonDate: string | null;
  updatedAt: string;
  blocks: { html: string; node: TiptapNode }[];
}

function NoteCard({ note, onInsert }: { note: ComposerNote; onInsert: (nodes: TiptapNode[]) => void }) {
  const [open, setOpen] = React.useState(true);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className="flex items-center gap-1.5 font-semibold text-ink">
            <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", !open && "-rotate-90")} aria-hidden />
            <span className="truncate">{note.title || "Bez názvu"}</span>
          </span>
          <span className="mt-0.5 block pl-5.5 text-xs text-muted">
            {note.author} · {note.subject ?? "Bez předmětu"}
            {note.lessonDate && ` · hodina ${formatDate(note.lessonDate, "d. M.")}`} · upraveno {formatTimestampDate(note.updatedAt)}
          </span>
        </button>
        <Button size="sm" variant="outline" onClick={() => onInsert(note.blocks.map((b) => b.node))} disabled={!note.blocks.length}>
          <CopyPlus aria-hidden /> Celou
        </Button>
      </div>
      {open && (
        <div className="space-y-2 border-t border-line bg-bg/60 p-3">
          {note.blocks.length === 0 && <p className="px-2 py-3 text-sm text-muted">Poznámka je prázdná.</p>}
          {note.blocks.map((b, i) => (
            <div key={i} className="group relative rounded-2xl border border-line bg-card px-4 py-2 pr-24">
              <div className="prose-wh max-h-96 overflow-hidden text-[0.95rem]" dangerouslySetInnerHTML={{ __html: b.html }} />
              <button
                type="button"
                onClick={() => onInsert([b.node])}
                className="absolute top-2 right-2 inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-sm font-medium text-on-primary shadow-sm hover:bg-primary-hover"
              >
                <Plus className="size-4" aria-hidden /> Vložit
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Skládání zápisu: vlevo sdílené poznámky žáků po blocích, vpravo nový zápis. */
export function NotesComposer({
  notes,
  subjects,
  filter,
}: {
  notes: ComposerNote[];
  subjects: { id: string; name: string }[];
  filter: { subjectId: string | null; date: string | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const editor = React.useRef<Editor | null>(null);
  const [doc, setDoc] = React.useState<TiptapNode | null>(null);
  const [title, setTitle] = React.useState("");
  const [subjectId, setSubjectId] = React.useState(filter.subjectId ?? subjects[0]?.id ?? "");
  const [date, setDate] = React.useState(filter.date ?? todayIso());
  const [pending, start] = React.useTransition();
  const onReady = React.useCallback((e: Editor) => {
    editor.current = e;
  }, []);

  function setFilter(next: { subjectId?: string | null; date?: string | null }) {
    const f = { ...filter, ...next };
    const q = new URLSearchParams();
    if (f.subjectId) q.set("predmet", f.subjectId);
    if (f.date) q.set("datum", f.date);
    router.push(`${pathname}${q.size ? `?${q}` : ""}`);
  }

  function insert(nodes: TiptapNode[]) {
    const e = editor.current;
    if (!e) return;
    e.chain().focus("end").insertContent(nodes).run();
    toast.success(nodes.length === 1 ? "Vloženo do zápisu." : `Vloženo bloků: ${nodes.length}.`);
  }

  function create() {
    start(async () => {
      const res = await composeMaterialFromNotes({ subjectId, title, materialDate: date || null, content: doc ?? { type: "doc", content: [] } });
      if (!res.ok || !res.data) return void toast.error(res.ok ? "Zápis se nepodařilo vytvořit." : res.error);
      toast.success(res.message);
      router.push(`/admin/materialy/${res.data.id}`);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Předmět poznámek" htmlFor="np-subject">
          <Select id="np-subject" value={filter.subjectId ?? ""} onChange={(e) => setFilter({ subjectId: e.target.value || null })} className="min-w-48">
            <option value="">Všechny předměty</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Den hodiny" htmlFor="np-date">
          <Input id="np-date" type="date" value={filter.date ?? ""} onChange={(e) => setFilter({ date: e.target.value || null })} />
        </Field>
        {(filter.subjectId || filter.date) && (
          <Button variant="ghost" onClick={() => router.push(pathname)}>
            Zrušit filtr
          </Button>
        )}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section aria-label="Sdílené poznámky" className="space-y-4">
          {notes.length === 0 ? (
            <Card>
              <EmptyState
                icon={NotebookPen}
                title="Žádné sdílené poznámky"
                description="Až žáci u poznámky zapnou „Sdílet se správcem“, objeví se tady."
              />
            </Card>
          ) : (
            notes.map((n) => <NoteCard key={n.id} note={n} onInsert={insert} />)
          )}
        </section>

        <section aria-label="Nový zápis" className="space-y-3 xl:sticky xl:top-4">
          <Card className="space-y-3 p-4">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Název zápisu, např. Goniometrické funkce" aria-label="Název zápisu" maxLength={200} />
            <div className="flex flex-wrap gap-3">
              <Select aria-label="Předmět zápisu" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-auto min-w-44">
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Input type="date" aria-label="Datum zápisu" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
              <Button className="ml-auto" onClick={create} loading={pending} disabled={!title.trim() || !subjectId}>
                Vytvořit koncept materiálu
              </Button>
            </div>
            <p className="text-xs text-muted">Koncept se otevře v materiálech, kde ho doupravíš a zveřejníš. Obrázky z poznámek se přenesou s ním.</p>
          </Card>
          <RichTextEditor value={null} onChange={setDoc} onEditorReady={onReady} allowDrawing placeholder="Vkládej bloky z poznámek vlevo, nebo piš rovnou sem…" />
        </section>
      </div>
    </div>
  );
}
