import Link from "next/link";
import { BookOpen, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { SubjectIcon } from "@/components/portal/shared";
import { getSubjects } from "@/lib/data/portal";
import { subjectColor } from "@/lib/subject-style";
import { cn, plural } from "@/lib/utils";

export const metadata = { title: "Předměty" };

export default async function SubjectsPage() {
  const subjects = await getSubjects();

  return (
    <>
      <PageHeader title="Předměty" description="Materiály, úkoly a testy rozdělené podle předmětů." />
      {subjects.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpen} title="Zatím tu nejsou žádné předměty" description="Předměty přidává správce v administraci." />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => {
            const c = subjectColor(s.color);
            return (
              <li key={s.id}>
                <Link href={`/predmety/${s.slug}`} className="group block h-full">
                  <Card interactive className="relative flex h-full flex-col overflow-hidden p-5 sm:p-6">
                    <span className={cn("absolute inset-x-0 top-0 h-1.5", c.dot)} aria-hidden />
                    <div className="flex items-start justify-between gap-3">
                      <SubjectIcon subject={s} size="lg" />
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", c.bg, c.ink)}>{s.abbreviation}</span>
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-ink transition-colors group-hover:text-primary">{s.name}</h2>
                    {s.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{s.description}</p>}
                    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-5 text-sm text-muted">
                      <span className="font-medium text-ink">
                        {s.material_count} {plural(s.material_count, ["materiál", "materiály", "materiálů"])}
                      </span>
                      {s.teacher && (
                        <span className="inline-flex items-center gap-1.5">
                          <UserRound className="size-4" aria-hidden />
                          {s.teacher}
                        </span>
                      )}
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
