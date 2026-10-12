import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileCheck,
  FolderOpen,
  Megaphone,
  Pin,
  PartyPopper,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { WelcomeIllustration } from "@/components/portal/welcome-illustration";
import { DueBadge, MaterialRow, SubjectBadge, SubjectIcon } from "@/components/portal/shared";
import { CompletionToggle } from "@/components/portal/toggles";
import { requireUser } from "@/lib/auth";
import { getAnnouncements, getAssignments, getExams, getMaterials, getSettings } from "@/lib/data/portal";
import { dueInfo, formatDate, formatDue, formatTime, greetingDate, shiftDate, todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Domů" };

const QUICK = [
  { href: "/materialy", title: "Studijní materiály", text: "Zápisy, prezentace a dokumenty", icon: FolderOpen, tone: "bg-light-blue text-primary", card: "bg-[#eef4ff]", anim: "bounce" as const },
  { href: "/ukoly", title: "Úkoly", text: "Co je potřeba odevzdat", icon: ClipboardCheck, tone: "bg-mint text-mint-ink", card: "bg-[#ecfbf4]", anim: "pop" as const },
  { href: "/rozvrh", title: "Rozvrh", text: "Hodiny a změny tento týden", icon: CalendarDays, tone: "bg-yellow text-yellow-ink", card: "bg-[#fff8e0]", anim: "bounce" as const },
  { href: "/predmety", title: "Předměty", text: "Všechno podle předmětů", icon: BookOpen, tone: "bg-lavender text-lavender-ink", card: "bg-[#f6f1ff]", anim: "pop" as const },
];

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayIso();
  const [assignments, exams, materials, announcements, settings] = await Promise.all([
    // Nesplněné úkoly včetně těch po termínu (za poslední 2 týdny)
    getAssignments(user.id, { from: shiftDate(today, -14), onlyOpen: true, limit: 6 }),
    getExams({ upcoming: true, limit: 4 }),
    getMaterials({ limit: 6 }),
    getAnnouncements({ limit: 4 }),
    getSettings(),
  ]);
  const pinned = announcements.filter((a) => a.pinned);
  const firstName = user.profile.display_name.split(" ")[0];

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Uvítací panel */}
      <section className="relative overflow-hidden rounded-card border border-line/80 bg-card shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(47,104,255,0.08),transparent_55%)]" aria-hidden />
        <div className="relative flex items-center justify-between gap-6 p-6 sm:p-8">
          <div>
            <p className="text-sm font-medium text-primary">{greetingDate(today)}</p>
            <h1 className="mt-2 text-[1.9rem] leading-tight font-bold text-ink sm:text-[2.4rem]">Ahoj, {firstName}!</h1>
            <p className="mt-2 max-w-md text-[1.02rem] text-muted">Všechno důležité ke studiu na jednom místě.</p>
            {settings && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge tone="blue">Třída {settings.class_label}</Badge>
                <Badge tone="outline">Školní rok {settings.school_year}</Badge>
              </div>
            )}
          </div>
          <WelcomeIllustration className="hidden h-40 w-auto shrink-0 sm:block lg:h-44" />
        </div>
      </section>

      {/* Připnutá oznámení */}
      {pinned.map((a) => (
        <Link
          key={a.id}
          href="/oznameni"
          className={cn(
            "group flex items-start gap-4 rounded-card border p-5 transition-shadow hover:shadow-hover",
            a.priority === "important" ? "border-rose-ink/15 bg-rose" : "border-primary/15 bg-light-blue/70",
          )}
        >
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl bg-card",
              a.priority === "important" ? "text-rose-ink" : "text-primary",
            )}
          >
            <AnimatedIcon icon={a.priority === "important" ? Megaphone : Pin} animation="wiggle" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
              {a.title}
              {a.priority === "important" && <Badge tone="red">Důležité</Badge>}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-slate-ink">{a.body}</p>
          </div>
        </Link>
      ))}

      {/* Rychlé akce */}
      <section aria-label="Rychlé akce" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {QUICK.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className={cn(
              "group relative flex flex-col gap-4 rounded-card border border-line/60 p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-hover sm:p-5",
              q.card,
            )}
          >
            <span className={cn("grid size-11 place-items-center rounded-[14px]", q.tone)}>
              <AnimatedIcon icon={q.icon} animation={q.anim} className="size-5" />
            </span>
            <span>
              <span className="block font-display text-[1.02rem] font-semibold text-ink">{q.title}</span>
              <span className="mt-0.5 hidden text-sm text-muted sm:block">{q.text}</span>
            </span>
            <ArrowRight
              className="absolute top-5 right-5 size-5 text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
              aria-hidden
            />
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        {/* Nadcházející úkoly */}
        <Card>
          <CardHeader
            title="Nadcházející úkoly"
            description="Nesplněné úkoly seřazené podle termínu"
            action={
              <Link href="/ukoly" className="text-sm font-medium text-primary hover:underline">
                Všechny
              </Link>
            }
          />
          <div className="px-3 pt-3 pb-4 sm:px-4">
            {assignments.length === 0 ? (
              <EmptyState icon={PartyPopper} title="Žádné nesplněné úkoly" description="Máš hotovo. Užij si volno!" />
            ) : (
              <ul>
                {assignments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-bg sm:px-3">
                    <CompletionToggle assignmentId={a.id} completed={a.completed} title={a.title} />
                    <Link href={`/ukoly/${a.id}`} className="min-w-0 flex-1">
                      <span className="line-clamp-2 block font-medium text-ink hover:text-primary sm:truncate">{a.title}</span>
                      <span className="block truncate text-sm text-muted">
                        {a.subject.name} · {formatDue(a.due_date, a.due_time)}
                      </span>
                    </Link>
                    <DueBadge date={a.due_date} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Nadcházející testy */}
        <Card>
          <CardHeader
            title="Nadcházející testy"
            description="Písemky a testy v nejbližších dnech"
            action={
              <Link href="/testy" className="text-sm font-medium text-primary hover:underline">
                Všechny
              </Link>
            }
          />
          <div className="space-y-3 px-5 pt-4 pb-5 sm:px-6">
            {exams.length === 0 ? (
              <EmptyState icon={FileCheck} title="Žádné testy v plánu" description="Jakmile se objeví, uvidíš je tady." />
            ) : (
              exams.map((e) => {
                const info = dueInfo(e.exam_date, today);
                return (
                  <div key={e.id} className="flex gap-4 rounded-2xl border border-line/80 p-4">
                    <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-bg py-2 text-center">
                      <span className="font-display text-xl leading-none font-bold text-ink">{formatDate(e.exam_date, "d.")}</span>
                      <span className="mt-1 text-xs text-muted">{formatDate(e.exam_date, "LLL")}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SubjectBadge subject={e.subject} />
                        <Badge tone={info.days <= 1 ? "orange" : "slate"}>
                          {info.label}
                          {e.exam_time ? ` · ${formatTime(e.exam_time)}` : ""}
                        </Badge>
                      </div>
                      <p className="mt-2 font-semibold text-ink">{e.title}</p>
                      {e.scope && <p className="mt-1 line-clamp-2 text-sm text-muted">{e.scope}</p>}
                      {e.materials.length > 0 && (
                        <Link
                          href={`/materialy/${e.materials[0].material!.id}`}
                          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          Materiály k přípravě <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        {/* Poslední materiály */}
        <Card>
          <CardHeader
            title="Poslední přidané materiály"
            action={
              <Link href="/materialy" className="text-sm font-medium text-primary hover:underline">
                Všechny
              </Link>
            }
          />
          <div className="px-2 pt-3 pb-4 sm:px-3">
            {materials.length === 0 ? (
              <EmptyState icon={FolderOpen} title="Zatím žádné materiály" description="Nové materiály se zobrazí hned po zveřejnění." />
            ) : (
              materials.map((m) => <MaterialRow key={m.id} material={m} />)
            )}
          </div>
        </Card>

        {/* Oznámení */}
        <Card>
          <CardHeader
            title="Oznámení a novinky"
            action={
              <Link href="/oznameni" className="text-sm font-medium text-primary hover:underline">
                Všechna
              </Link>
            }
          />
          <div className="space-y-1 px-3 pt-3 pb-4 sm:px-4">
            {announcements.length === 0 ? (
              <EmptyState icon={Megaphone} title="Žádná oznámení" />
            ) : (
              announcements.map((a) => (
                <Link key={a.id} href="/oznameni" className="flex gap-3 rounded-2xl px-2 py-3 hover:bg-bg sm:px-3">
                  <SubjectIcon subject={{ color: a.priority === "important" ? "red" : "blue", icon: "mail" }} size="sm" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <span className="truncate">{a.title}</span>
                      {a.pinned && <Pin className="size-3.5 shrink-0 text-muted" aria-label="Připnuto" />}
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-sm text-muted">{a.body}</span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
