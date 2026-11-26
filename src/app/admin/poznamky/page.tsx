import { PageHeader } from "@/components/ui/misc";
import { getSubjects } from "@/lib/data/portal";
import { getSharedNotes } from "@/lib/data/notes";
import { renderTiptapHtml } from "@/lib/tiptap";
import type { TiptapNode } from "@/lib/types";
import { NotesComposer, type ComposerNote } from "./notes-composer";

export const metadata = { title: "Poznámky žáků" };

export default async function AdminNotesPage({ searchParams }: PageProps<"/admin/poznamky">) {
  const sp = await searchParams;
  const subjectId = typeof sp.predmet === "string" && /^[0-9a-f-]{36}$/i.test(sp.predmet) ? sp.predmet : null;
  const date = typeof sp.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.datum) ? sp.datum : null;
  const [notes, subjects] = await Promise.all([getSharedNotes({ subjectId, date }), getSubjects()]);

  // Každý blok poznámky zvlášť: náhled (bezpečné HTML) + data pro vložení do zápisu
  const items: ComposerNote[] = notes.map((n) => ({
    id: n.id,
    title: n.title,
    author: n.author,
    subject: n.subject?.name ?? null,
    lessonDate: n.lesson_date,
    updatedAt: n.updated_at,
    blocks: (n.content.content ?? [])
      .filter((b: TiptapNode) => b.type !== "paragraph" || (b.content?.length ?? 0) > 0)
      .map((b: TiptapNode) => ({ html: renderTiptapHtml({ type: "doc", content: [b] }), node: b })),
  }));

  return (
    <>
      <PageHeader
        title="Poznámky žáků"
        description="Poznámky, které žáci sdíleli se správcem. Vyber z nich odstavce, kresby a obrázky a sestav kompletní zápis – uloží se jako koncept materiálu."
      />
      <NotesComposer
        notes={items}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        filter={{ subjectId, date }}
      />
    </>
  );
}
