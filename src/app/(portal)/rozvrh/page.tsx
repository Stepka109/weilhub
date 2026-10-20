import { CalendarDays, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { TimetableGrid, TimetableLegend } from "@/components/timetable/timetable-grid";
import { WeekNav } from "@/components/timetable/week-nav";
import { getSettings } from "@/lib/data/portal";
import { getTimetableMarks, getTimetableWeek } from "@/lib/data/timetable";
import { formatDate, schoolWeek, shiftDate, todayIso } from "@/lib/dates";

export const metadata = { title: "Rozvrh" };

export default async function TimetablePage({ searchParams }: PageProps<"/rozvrh">) {
  const sp = await searchParams;
  const today = todayIso();
  // O víkendu se automaticky zobrazí následující týden
  const thisWeek = schoolWeek(today);
  const defaultMonday = today > thisWeek[4] ? shiftDate(thisWeek[0], 7) : thisWeek[0];
  const monday = typeof sp.tyden === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.tyden) ? schoolWeek(sp.tyden)[0] : defaultMonday;
  const [{ week, hasAnySlots }, settings, marks] = await Promise.all([getTimetableWeek(monday), getSettings(), getTimetableMarks(monday)]);
  const changes = week.days.reduce((n, d) => n + d.items.filter((i) => ("status" in i ? i.status !== "default" && i.status !== "empty" : true)).length, 0);

  return (
    <>
      <PageHeader
        title="Rozvrh hodin"
        description={settings ? `Třída ${settings.class_label} · týdny se střídají ${settings.timetable_cycle.join(" → ")}.` : undefined}
        eyebrow={
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">
              <CalendarDays aria-hidden /> Týden {week.cycleWeek}
            </Badge>
            {changes > 0 && <Badge tone="red">Změny v tomto týdnu: {changes}</Badge>}
          </div>
        }
      />

      <WeekNav
        basePath="/rozvrh"
        monday={week.monday}
        label={`${formatDate(week.monday, "d. M.")} – ${formatDate(week.days[4].date, "d. M. yyyy")}`}
        cycleWeek={week.cycleWeek}
        isCurrent={week.monday === defaultMonday}
      />

      {hasAnySlots ? (
        <TimetableGrid week={week} marks={marks} />
      ) : (
        <p className="rounded-card border border-line bg-card px-6 py-12 text-center text-muted">
          Rozvrh zatím nebyl vyplněn. Správce ho může nastavit v administraci.
        </p>
      )}

      <div className="mt-5 space-y-3">
        <TimetableLegend />
        <p className="flex items-start gap-2 text-sm text-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Rozvrh spravují studenti ručně – nejde o živá data ze systému Bakaláři. Oficiální změny vždy ověř ve škole.
        </p>
      </div>
    </>
  );
}
