import Link from "next/link";
import { Suspense } from "react";
import { CalendarPlus, ClipboardCheck, Paperclip } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, PillTabs } from "@/components/ui/misc";
import { DueBadge, SubjectBadge } from "@/components/portal/shared";
import { CompletionToggle } from "@/components/portal/toggles";
import { SubjectSelectFilter } from "@/components/portal/subject-select-filter";
import { requireUser } from "@/lib/auth";
import { GroupBadge } from "@/components/portal/group-badge";
import { getAssignments, getSubjects } from "@/lib/data/portal";
import { dueInfo, formatDate, formatDue } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Úkoly" };

const FILTERS = [
  { key: "", label: "Všechny" },
  { key: "nesplnene", label: "Nesplněné" },
  { key: "splnene", label: "Splněné" },
  { key: "po-terminu", label: "Po termínu" },
] as const;

export default async function AssignmentsPage({ searchParams }: PageProps<"/ukoly">) {
  const [sp, user, subjects] = await Promise.all([searchParams, requireUser(), getSubjects()]);
  const filter = FILTERS.find((f) => f.key === sp.filtr)?.key ?? "";
  const subject = subjects.find((s) => s.slug === sp.predmet);
  const all = await getAssignments(user.id, { subjectId: subject?.id, group: user.profile.preferences?.studyGroup ?? null });

  const isOverdue = (a: (typeof all)[number]) => !a.completed && dueInfo(a.due_date).tone === "overdue";
  const counts = {
    "": all.length,
    nesplnene: all.filter((a) => !a.completed).length,
    splnene: all.filter((a) => a.completed).length,
    "po-terminu": all.filter(isOverdue).length,
  };
  let items = all.filter((a) =>
    filter === "nesplnene" ? !a.completed : filter === "splnene" ? a.completed : filter === "po-terminu" ? isOverdue(a) : true,
  );
  if (filter === "" && user.profile.preferences?.hideCompleted) items = items.filter((a) => !a.completed);
  // Nadcházející nejdřív, proběhlé termíny na konec (nejnovější nahoře)
  const today = items.filter((a) => dueInfo(a.due_date).days >= 0);
  const past = items.filter((a) => dueInfo(a.due_date).days < 0).reverse();
  items = [...today, ...past];

  const qs = (f: string) => {
    const p = new URLSearchParams();
    if (f) p.set("filtr", f);
    if (subject) p.set("predmet", subject.slug);
    const s = p.toString();
    return s ? `/ukoly?${s}` : "/ukoly";
  };

  return (
    <>
      <PageHeader
        title="Domácí úkoly"
        description="Přehled zadaných úkolů. Označení „splněno“ vidíš jen ty."
        actions={
          <Suspense>
            <SubjectSelectFilter subjects={subjects.map((s) => ({ slug: s.slug, name: s.name }))} />
          </Suspense>
        }
      />
      <PillTabs
        label="Filtr úkolů"
        className="mb-6"
        items={FILTERS.map((f) => ({ href: qs(f.key), label: f.label, active: filter === f.key, count: counts[f.key] }))}
      />

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title={filter === "po-terminu" ? "Nic po termínu" : "Žádné úkoly"}
            description={filter === "splnene" ? "Zatím nemáš žádný úkol označený jako splněný." : "V tomto výběru nejsou žádné úkoly."}
          />
        </Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {items.map((a) => (
            <li key={a.id}>
              <Card className={cn("flex h-full gap-4 p-5", a.completed && "bg-card/70")}>
                <CompletionToggle assignmentId={a.id} completed={a.completed} title={a.title} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SubjectBadge subject={a.subject} />
                    <GroupBadge group={a.study_group} className="h-6" />
                    <DueBadge date={a.due_date} completed={a.completed} />
                  </div>
                  <Link href={`/ukoly/${a.id}`} className="mt-2.5 block">
                    <h2 className={cn("text-[1.05rem] font-semibold text-ink hover:text-primary", a.completed && "text-muted line-through decoration-1")}>
                      {a.title}
                    </h2>
                  </Link>
                  {a.instructions && <p className="mt-1 line-clamp-2 text-sm text-muted">{a.instructions}</p>}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarPlus className="size-4" aria-hidden /> Zadáno {formatDate(a.assigned_on)}
                    </span>
                    <span className="font-medium text-ink">Termín: {formatDue(a.due_date, a.due_time)}</span>
                    {a.files.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="size-4" aria-hidden /> {a.files.length}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
