import Link from "next/link";
import { BookOpen, Clock3, FileCheck, NotebookText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, PillTabs } from "@/components/ui/misc";
import { SubjectBadge } from "@/components/portal/shared";
import { getMyGroup } from "@/lib/auth";
import { GroupBadge } from "@/components/portal/group-badge";
import { getExams } from "@/lib/data/portal";
import { dueInfo, formatDate, formatTime } from "@/lib/dates";

export const metadata = { title: "Testy" };

export default async function ExamsPage({ searchParams }: PageProps<"/testy">) {
  const sp = await searchParams;
  const past = sp.zobrazit === "probehle";
  const exams = await getExams({ upcoming: !past, group: await getMyGroup() });

  return (
    <>
      <PageHeader title="Testy a písemky" description="Co a kdy se píše, jaká látka a z čeho se připravit." />
      <PillTabs
        label="Zobrazení testů"
        className="mb-6"
        items={[
          { href: "/testy", label: "Nadcházející", active: !past },
          { href: "/testy?zobrazit=probehle", label: "Proběhlé", active: past },
        ]}
      />
      {exams.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileCheck}
            title={past ? "Žádné proběhlé testy" : "Žádné nadcházející testy"}
            description={past ? undefined : "Až správce přidá nový test, objeví se tady."}
          />
        </Card>
      ) : (
        <ol className="relative space-y-4 border-l-2 border-line pl-6 sm:ml-2">
          {exams.map((e) => {
            const info = dueInfo(e.exam_date);
            return (
              <li key={e.id} id={`test-${e.id}`} className="relative scroll-mt-28 target:*:ring-2 target:*:ring-primary">
                <span
                  className={`absolute top-6 -left-[33px] size-4 rounded-full border-4 border-bg ${info.days <= 2 && info.days >= 0 ? "bg-orange-ink" : "bg-primary"}`}
                  aria-hidden
                />
                <Card className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex w-20 shrink-0 flex-col items-center rounded-2xl bg-bg py-3">
                      <span className="text-xs text-muted capitalize">{formatDate(e.exam_date, "EEEE")}</span>
                      <span className="font-display text-2xl font-bold text-ink">{formatDate(e.exam_date, "d.")}</span>
                      <span className="text-xs text-muted">{formatDate(e.exam_date, "LLLL")}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SubjectBadge subject={e.subject} link />
                        <GroupBadge group={e.study_group} className="h-6" />
                        {!past && <Badge tone={info.days <= 2 ? "orange" : "slate"}>{info.label}</Badge>}
                        {e.exam_time && (
                          <Badge tone="outline">
                            <Clock3 aria-hidden /> {formatTime(e.exam_time)}
                          </Badge>
                        )}
                      </div>
                      <h2 className="mt-2.5 text-lg font-semibold text-ink">{e.title}</h2>
                      {e.scope && (
                        <div className="mt-3">
                          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                            <BookOpen className="size-4 text-muted" aria-hidden /> Rozsah učiva
                          </p>
                          <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-slate-ink">{e.scope}</p>
                        </div>
                      )}
                      {e.notes && (
                        <div className="mt-3">
                          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                            <NotebookText className="size-4 text-muted" aria-hidden /> Poznámky
                          </p>
                          <p className="mt-1 text-sm whitespace-pre-line text-slate-ink">{e.notes}</p>
                        </div>
                      )}
                      {e.materials.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {e.materials.map(({ material }) => (
                            <Link
                              key={material!.id}
                              href={`/materialy/${material!.id}`}
                              className="inline-flex items-center gap-1.5 rounded-full bg-light-blue px-3 py-1.5 text-sm font-medium text-primary hover:bg-[#cfe0ff]"
                            >
                              <BookOpen className="size-3.5" aria-hidden />
                              {material!.title}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
