import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { getSubjects } from "@/lib/data/portal";
import { getNote } from "@/lib/data/notes";
import { NoteEditor } from "./note-editor";

export const metadata: Metadata = { title: "Poznámka" };

export default async function NotePage({ params }: PageProps<"/poznamky/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const [note, subjects] = await Promise.all([getNote(id), getSubjects()]);
  // Upravovat jde jen vlastní poznámku (sdílené cizí si správce prohlíží v administraci)
  if (!note || note.user_id !== user.id) notFound();
  return (
    <>
      <PageHeader title={note.title || "Poznámka"} back={{ href: "/poznamky", label: "Poznámky" }} />
      <NoteEditor
        key={note.id}
        note={note}
        userId={user.id}
        subjects={subjects.map(({ id: sid, name, slug, abbreviation, color, icon }) => ({ id: sid, name, slug, abbreviation, color, icon }))}
      />
    </>
  );
}
