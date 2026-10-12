import { notFound } from "next/navigation";
import { CalendarClock, CalendarPlus, CircleCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { FileList } from "@/components/portal/file-list";
import { DueBadge, MaterialRow, SubjectBadge } from "@/components/portal/shared";
import { CompletionToggle } from "@/components/portal/toggles";
import { requireUser } from "@/lib/auth";
import { getAssignment } from "@/lib/data/portal";
import { formatDate, formatDateTime, formatDue } from "@/lib/dates";

export const metadata = { title: "Úkol" };

export default async function AssignmentDetailPage({ params }: PageProps<"/ukoly/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser();
  const a = await getAssignment(id, user.id);
  if (!a) notFound();
  const completed = Boolean(a.completedAt);

  return (
    <>
      <PageHeader
        back={{ href: "/ukoly", label: "Úkoly" }}
        title={a.title}
        eyebrow={
          <div className="flex flex-wrap gap-2">
            <SubjectBadge subject={a.subject} link />
            <DueBadge date={a.due_date} completed={completed} />
          </div>
        }
        actions={<CompletionToggle assignmentId={a.id} completed={completed} title={a.title} variant="button" />}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Card className="p-5 sm:p-8">
            <h2 className="mb-3 text-base font-semibold text-ink">Zadání</h2>
            {a.instructions ? (
              <p className="leading-relaxed whitespace-pre-line text-ink">{a.instructions}</p>
            ) : (
              <p className="text-muted">Zadání nebylo vyplněno.</p>
            )}
          </Card>
          {a.files.length > 0 && (
            <Card className="p-5 sm:p-6">
              <FileList files={a.files} />
            </Card>
          )}
          {a.materials.length > 0 && (
            <Card className="p-3">
              <h2 className="px-3 pt-2 pb-1 text-base font-semibold text-ink">Související materiály</h2>
              {a.materials.map((m) => (
                <MaterialRow key={m.id} material={m} />
              ))}
            </Card>
          )}
        </div>
        <aside>
          <Card className="p-5 sm:p-6">
            <dl className="space-y-4 text-sm">
              <div className="flex gap-3">
                <CalendarPlus className="mt-0.5 size-4 text-muted" aria-hidden />
                <div>
                  <dt className="text-muted">Zadáno</dt>
                  <dd className="font-medium text-ink">{formatDate(a.assigned_on)}</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <CalendarClock className="mt-0.5 size-4 text-muted" aria-hidden />
                <div>
                  <dt className="text-muted">Termín odevzdání</dt>
                  <dd className="font-medium text-ink">{formatDue(a.due_date, a.due_time)}</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <CircleCheck className="mt-0.5 size-4 text-muted" aria-hidden />
                <div>
                  <dt className="text-muted">Můj stav</dt>
                  <dd className="font-medium text-ink">
                    {completed ? `Splněno (${formatDateTime(a.completedAt!)})` : "Nesplněno"}
                  </dd>
                </div>
              </div>
            </dl>
            <p className="mt-5 rounded-2xl bg-bg p-3 text-xs text-muted">
              WeilHub slouží k evidenci úkolů. Úkol odevzdej podle pokynů vyučujícího.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
