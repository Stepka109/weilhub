import Link from "next/link";
import {
  BookOpen,
  ClipboardCheck,
  FileCheck,
  FilePlus2,
  FolderOpen,
  History,
  Megaphone,
  NotebookPen,
  Plus,
  Users,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { StatCard, StatusBadge } from "@/components/admin/common";
import { requireStaff } from "@/lib/auth";
import { getAdminMaterials, getAdminStats, getAuditLogs } from "@/lib/data/admin";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "Přehled" };

const ENTITY: Record<string, string> = {
  subjects: "Předmět",
  subject_topics: "Téma",
  materials: "Materiál",
  assignments: "Úkol",
  exams: "Test",
  timetable_slots: "Hodina rozvrhu",
  timetable_overrides: "Změna rozvrhu",
  timetable_day_overrides: "Celodenní záznam rozvrhu",
  timetable_subjects: "Předmět rozvrhu",
  timetable_teachers: "Vyučující",
  events: "Akce",
  announcements: "Oznámení",
  useful_links: "Odkaz",
  invitations: "Pozvánka",
  app_settings: "Nastavení",
  profiles: "Uživatel",
};
const ACTION: Record<string, string> = { insert: "vytvořil(a)", update: "upravil(a)", delete: "smazal(a)" };

const QUICK = [
  { href: "/admin/materialy/novy", label: "Nový materiál", icon: FilePlus2, anim: "bounce" as const },
  { href: "/admin/ukoly/novy", label: "Nový úkol", icon: ClipboardCheck, anim: "pop" as const },
  { href: "/admin/testy?novy=1", label: "Nový test", icon: FileCheck, anim: "wiggle" as const },
  { href: "/admin/oznameni?novy=1", label: "Nové oznámení", icon: Megaphone, anim: "wiggle" as const },
  { href: "/admin/predmety?novy=1", label: "Nový předmět", icon: BookOpen, anim: "pop" as const },
];

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const user = await requireStaff();
  const sp = await searchParams;
  const isAdmin = user.profile.role === "admin";
  const [stats, recent, logs] = await Promise.all([
    getAdminStats(),
    getAdminMaterials(8),
    isAdmin ? getAuditLogs(12) : Promise.resolve([]),
  ]);
  const drafts = recent.filter((m) => m.status === "draft");

  return (
    <>
      {sp.pristup === "odepren" && (
        <p className="mb-6 rounded-2xl bg-yellow px-4 py-3 text-sm text-yellow-ink" role="alert">
          Tuto sekci může spravovat pouze administrátor.
        </p>
      )}
      <PageHeader title="Administrace" description={`Vítej, ${user.profile.display_name}. Tady spravuješ veškerý obsah portálu.`} />

      <section aria-label="Statistiky" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Aktivní předměty" value={stats.subjects} icon={BookOpen} tone="bg-lavender text-lavender-ink" />
        <StatCard label="Publikované materiály" value={stats.materials} icon={FolderOpen} tone="bg-light-blue text-primary" />
        <StatCard label="Aktivní úkoly" value={stats.assignments} icon={ClipboardCheck} tone="bg-mint text-mint-ink" />
        <StatCard label="Nadcházející testy" value={stats.exams} icon={FileCheck} tone="bg-rose text-rose-ink" />
        <StatCard label="Schválení uživatelé" value={stats.users} icon={Users} tone="bg-yellow text-yellow-ink" />
      </section>

      <section aria-label="Rychlé akce" className="mt-6 flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="group inline-flex h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-medium text-ink shadow-card transition-colors hover:border-primary/40 hover:text-primary"
          >
            <AnimatedIcon icon={q.icon} animation={q.anim} className="size-[18px] text-primary" />
            {q.label}
          </Link>
        ))}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Naposledy upravené materiály"
            action={
              <Link href="/admin/materialy" className="text-sm font-medium text-primary hover:underline">
                Všechny
              </Link>
            }
          />
          <div className="px-3 pt-3 pb-4">
            {recent.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="Zatím žádné materiály"
                action={
                  <Link href="/admin/materialy/novy" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    <Plus className="size-4" /> Přidat první materiál
                  </Link>
                }
              />
            ) : (
              <ul>
                {recent.map((m) => (
                  <li key={m.id}>
                    <Link href={`/admin/materialy/${m.id}`} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-bg">
                      <NotebookPen className="size-4 shrink-0 text-muted" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{m.title}</span>
                        <span className="block text-xs text-muted">
                          {m.subject?.name} · {formatDateTime(m.updated_at)}
                        </span>
                      </span>
                      <StatusBadge status={m.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Rozpracované koncepty" description={`Celkem konceptů: ${stats.drafts}`} />
            <div className="px-3 pt-3 pb-4">
              {drafts.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">Žádné rozpracované koncepty mezi posledními úpravami.</p>
              ) : (
                <ul>
                  {drafts.map((m) => (
                    <li key={m.id}>
                      <Link href={`/admin/materialy/${m.id}`} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 hover:bg-bg">
                        <span className="truncate font-medium text-ink">{m.title}</span>
                        <span className="text-sm font-medium text-primary">Pokračovat</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {isAdmin && (
            <Card>
              <CardHeader title="Poslední administrativní akce" icon={<History className="size-5 text-muted" aria-hidden />} />
              <div className="px-5 pt-3 pb-5 sm:px-6">
                {logs.length === 0 ? (
                  <p className="text-sm text-muted">Zatím žádné záznamy.</p>
                ) : (
                  <ol className="space-y-3">
                    {logs.map((l) => (
                      <li key={l.id} className="text-sm">
                        <span className="font-medium text-ink">{l.actor?.display_name ?? "Systém"}</span>{" "}
                        <span className="text-muted">{ACTION[l.action]}</span>{" "}
                        <span className="text-ink">
                          {ENTITY[l.entity] ?? l.entity}
                          {l.summary ? ` „${l.summary}“` : ""}
                        </span>
                        <span className="block text-xs text-muted">{formatDateTime(l.created_at)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
