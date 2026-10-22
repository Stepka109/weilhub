import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClipboardCheck, FileCheck, FolderOpen, Info, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, PillTabs } from "@/components/ui/misc";
import { DueBadge, MaterialRow, SubjectIcon } from "@/components/portal/shared";
import { MaterialFilters } from "@/components/portal/material-filters";
import { CompletionToggle } from "@/components/portal/toggles";
import { GroupBadge } from "@/components/portal/group-badge";
import { GroupPicker } from "@/components/portal/group-picker";
import { GroupSwitch, groupQuery } from "@/components/timetable/week-nav";
import { requireUser } from "@/lib/auth";
import { getAssignments, getExams, getMaterials, getSettings, getSubjectBySlug, getTopics } from "@/lib/data/portal";
import { formatDate, formatDue, formatTime } from "@/lib/dates";
import { subjectColor } from "@/lib/subject-style";
import { parseGroupView } from "@/lib/timetable";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/predmety/[slug]">) {
  const { slug } = await params;
  const subject = await getSubjectBySlug(slug);
  return { title: subject?.name ?? "Předmět" };
}

const TABS = [
  { key: "materialy", label: "Materiály" },
  { key: "ukoly", label: "Úkoly" },
  { key: "testy", label: "Testy" },
  { key: "informace", label: "Informace" },
] as const;

export default async function SubjectPage({ params, searchParams }: PageProps<"/predmety/[slug]">) {
  const [{ slug }, sp, user] = await Promise.all([params, searchParams, requireUser()]);
  const subject = await getSubjectBySlug(slug);
  if (!subject) notFound();

  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "materialy";
  const c = subjectColor(subject.color);
  const settings = await getSettings();
  const sort = (["newest", "oldest", "title"] as const).find((s) => s === sp.razeni) ?? settings?.default_material_sort ?? "newest";
  const kind = sp.typ === "note" || sp.typ === "file" ? sp.typ : undefined;
  const topicId = typeof sp.tema === "string" ? sp.tema : undefined;

  // Dělený předmět: obsah skupiny S1, S2, nebo obou (výchozí = vlastní skupina)
  const myGroup = user.profile.preferences?.studyGroup ?? null;
  const view = subject.has_groups ? (parseGroupView(sp.skupina) ?? myGroup ?? "both") : "both";
  const group = view === "both" ? null : view;
  const href = (q: { tab?: string; tema?: string; skupina?: string }) => {
    const params = new URLSearchParams();
    if (q.tab && q.tab !== "materialy") params.set("tab", q.tab);
    if (q.tema) params.set("tema", q.tema);
    if (subject.has_groups) params.set("skupina", q.skupina ?? groupQuery(view));
    const s = params.toString();
    return `/predmety/${subject.slug}${s ? `?${s}` : ""}`;
  };

  const [topics, materials, assignments, exams] = await Promise.all([
    getTopics(subject.id),
    tab === "materialy" ? getMaterials({ subjectId: subject.id, sort, kind, topicId, group }) : Promise.resolve([]),
    tab === "ukoly" ? getAssignments(user.id, { subjectId: subject.id, group }) : Promise.resolve([]),
    tab === "testy" ? getExams({ subjectId: subject.id, upcoming: true, group }) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        back={{ href: "/predmety", label: "Předměty" }}
        title={
          <span className="flex items-center gap-4">
            <SubjectIcon subject={subject} size="lg" />
            <span>{subject.name}</span>
          </span>
        }
        description={subject.description ?? undefined}
        eyebrow={
          <div className="flex flex-wrap gap-2">
            <Badge className={cn(c.bg, c.ink)}>{subject.abbreviation}</Badge>
            {subject.has_groups && <Badge tone="lavender">Dělený předmět · S1 / S2</Badge>}
            {subject.has_groups && (subject.teacher_s1 || subject.teacher_s2) ? (
              (["S1", "S2"] as const).map((g) => {
                const t = (g === "S1" ? subject.teacher_s1 : subject.teacher_s2) ?? subject.teacher;
                return t ? (
                  <Badge key={g} tone="outline">
                    <UserRound aria-hidden /> {g}: {t}
                  </Badge>
                ) : null;
              })
            ) : subject.teacher ? (
              <Badge tone="outline">
                <UserRound aria-hidden /> {subject.teacher}
              </Badge>
            ) : null}
          </div>
        }
      />

      {subject.has_groups && (
        <>
          <GroupSwitch
            view={view}
            myGroup={myGroup}
            label="Skupina předmětu"
            hrefFor={(q) => href({ tab, tema: tab === "materialy" ? topicId : undefined, skupina: q })}
          />
          {!myGroup && <GroupPicker className="mb-4" />}
          <p className="mb-4 text-center text-sm text-muted">
            {view === "both"
              ? "Zobrazen obsah obou skupin – u každé položky je štítek skupiny."
              : `Obsah skupiny ${view} a společný obsah pro obě skupiny.`}
          </p>
        </>
      )}

      <PillTabs
        label="Sekce předmětu"
        className="mb-6"
        items={TABS.map((t) => ({
          href: href({ tab: t.key }),
          label: t.label,
          active: tab === t.key,
        }))}
      />

      {tab === "materialy" && (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {topics.length > 0 && (
            <nav aria-label="Tematické okruhy" className="lg:sticky lg:top-28 lg:self-start">
              <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-muted uppercase">Témata</p>
              <ul className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
                {[{ id: "", name: "Všechna témata" }, ...topics].map((t) => {
                  const active = (topicId ?? "") === t.id;
                  return (
                    <li key={t.id || "all"} className="shrink-0">
                      <Link
                        href={href({ tema: t.id || undefined })}
                        scroll={false}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex items-center gap-2 rounded-nav px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                          active ? "bg-light-blue text-primary" : "text-slate-ink hover:bg-card",
                        )}
                      >
                        <FolderOpen className="size-4 shrink-0" aria-hidden />
                        {t.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
          <Card className={cn(topics.length === 0 && "lg:col-span-2")}>
            <div className="border-b border-line/80 p-4 sm:p-5">
              <Suspense>
                <MaterialFilters />
              </Suspense>
            </div>
            <div className="p-2 sm:p-3">
              {materials.length === 0 ? (
                <EmptyState icon={FolderOpen} title="Žádné materiály" description="V tomto výběru zatím nejsou žádné publikované materiály." />
              ) : (
                materials.map((m) => <MaterialRow key={m.id} material={m} showSubject={false} />)
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "ukoly" && (
        <Card className="p-2 sm:p-3">
          {assignments.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="Žádné úkoly" description="K tomuto předmětu zatím nejsou zadané úkoly." />
          ) : (
            <ul>
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-bg">
                  <CompletionToggle assignmentId={a.id} completed={a.completed} title={a.title} />
                  <Link href={`/ukoly/${a.id}`} className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <GroupBadge group={a.study_group} />
                      <span className="truncate font-medium text-ink">{a.title}</span>
                    </span>
                    <span className="block text-sm text-muted">Termín: {formatDue(a.due_date, a.due_time)}</span>
                  </Link>
                  <DueBadge date={a.due_date} completed={a.completed} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "testy" && (
        <Card className="p-2 sm:p-3">
          {exams.length === 0 ? (
            <EmptyState icon={FileCheck} title="Žádné nadcházející testy" />
          ) : (
            <ul>
              {exams.map((e) => (
                <li key={e.id}>
                  <Link href={`/testy#test-${e.id}`} className="flex items-center gap-4 rounded-2xl px-3 py-3 hover:bg-bg">
                    <span className="w-24 shrink-0 text-sm font-semibold text-ink">
                      {formatDate(e.exam_date, "EEEEEE d. M.")}
                      {e.exam_time && <span className="block font-normal text-muted">{formatTime(e.exam_time)}</span>}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <GroupBadge group={e.study_group} />
                        <span className="truncate font-medium text-ink">{e.title}</span>
                      </span>
                      {e.scope && <span className="block truncate text-sm text-muted">{e.scope}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "informace" && (
        <Card className="p-6">
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Název</dt>
              <dd className="mt-1 font-medium text-ink">{subject.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Zkratka</dt>
              <dd className="mt-1 font-medium text-ink">{subject.abbreviation}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Vyučující</dt>
              <dd className="mt-1 font-medium text-ink">
                {subject.has_groups && (subject.teacher_s1 || subject.teacher_s2) ? (
                  <>
                    <span className="block">S1: {subject.teacher_s1 ?? subject.teacher ?? "Neuvedeno"}</span>
                    <span className="block">S2: {subject.teacher_s2 ?? subject.teacher ?? "Neuvedeno"}</span>
                  </>
                ) : (
                  (subject.teacher ?? "Neuvedeno")
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Počet témat</dt>
              <dd className="mt-1 font-medium text-ink">{topics.length}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted">Popis</dt>
              <dd className="mt-1 whitespace-pre-line text-ink">{subject.description || "Bez popisu."}</dd>
            </div>
          </dl>
          {topics.length > 0 && (
            <div className="mt-6 border-t border-line pt-6">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-ink">
                <Info className="size-4 text-muted" aria-hidden /> Tematické okruhy
              </h2>
              <ol className="list-decimal space-y-1 pl-5 text-ink">
                {topics.map((t) => (
                  <li key={t.id}>{t.name}</li>
                ))}
              </ol>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
