import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { getSubjects } from "@/lib/data/portal";
import { getMyNotes } from "@/lib/data/notes";
import { NotesList } from "./notes-list";

export const metadata: Metadata = { title: "Poznámky" };

export default async function NotesPage() {
  const user = await requireUser();
  const [notes, subjects] = await Promise.all([getMyNotes(user.id), getSubjects()]);
  return (
    <>
      <PageHeader
        title="Poznámky"
        description="Tvůj vlastní poznámkový blok – piš na klávesnici, kresli perem (Apple Pencil) nebo prstem a vkládej obrázky. Poznámky jsou soukromé, dokud je nesdílíš se správcem."
      />
      <NotesList notes={notes} subjects={subjects.map(({ id, name, slug, abbreviation, color, icon }) => ({ id, name, slug, abbreviation, color, icon }))} />
    </>
  );
}
