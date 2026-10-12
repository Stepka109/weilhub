import { Suspense } from "react";
import { FolderOpen, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, PillTabs } from "@/components/ui/misc";
import { MaterialRow } from "@/components/portal/shared";
import { MaterialFilters } from "@/components/portal/material-filters";
import { requireUser } from "@/lib/auth";
import { getFavoriteIds, getMaterials, getSettings, getSubjects, getTopics } from "@/lib/data/portal";

export const metadata = { title: "Materiály" };

export default async function MaterialsPage({ searchParams }: PageProps<"/materialy">) {
  const [sp, user, subjects, settings] = await Promise.all([searchParams, requireUser(), getSubjects(), getSettings()]);
  const subject = subjects.find((s) => s.slug === sp.predmet);
  const sort = (["newest", "oldest", "title"] as const).find((s) => s === sp.razeni) ?? settings?.default_material_sort ?? "newest";
  const kind = sp.typ === "note" || sp.typ === "file" ? sp.typ : undefined;
  const favoritesOnly = sp.oblibene === "1";
  const topicId = subject && typeof sp.tema === "string" ? sp.tema : undefined;

  const [favorites, topics] = await Promise.all([
    getFavoriteIds(user.id),
    subject ? getTopics(subject.id) : Promise.resolve([]),
  ]);
  const materials = await getMaterials({
    subjectId: subject?.id,
    topicId,
    kind,
    sort,
    ids: favoritesOnly ? [...favorites] : undefined,
  });

  return (
    <>
      <PageHeader title="Studijní materiály" description="Zápisy z hodin, prezentace, pracovní listy a další dokumenty." />
      <PillTabs
        label="Zobrazení"
        className="mb-4"
        items={[
          { href: "/materialy", label: "Všechny", active: !favoritesOnly },
          { href: "/materialy?oblibene=1", label: "Oblíbené", active: favoritesOnly, count: favorites.size },
        ]}
      />
      <Card>
        <div className="border-b border-line/80 p-4 sm:p-5">
          <Suspense>
            <MaterialFilters subjects={subjects.map((s) => ({ slug: s.slug, name: s.name }))} topics={topics} />
          </Suspense>
        </div>
        <div className="p-2 sm:p-3">
          {materials.length === 0 ? (
            favoritesOnly ? (
              <EmptyState icon={Heart} title="Zatím nemáš oblíbené materiály" description="V detailu materiálu klikni na „Přidat do oblíbených“." />
            ) : (
              <EmptyState icon={FolderOpen} title="Žádné materiály" description="Zkus změnit filtry, nebo počkej, až přibudou nové materiály." />
            )
          ) : (
            materials.map((m) => <MaterialRow key={m.id} material={m} />)
          )}
        </div>
      </Card>
    </>
  );
}
