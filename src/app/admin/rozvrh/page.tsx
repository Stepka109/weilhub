import { PageHeader, PillTabs } from "@/components/ui/misc";
import { WeekNav } from "@/components/timetable/week-nav";
import { TimetableLegend } from "@/components/timetable/timetable-grid";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/data/portal";
import { getTimetableCatalog, getTimetableWeek } from "@/lib/data/timetable";
import { formatDate, schoolWeek, shiftDate, todayIso } from "@/lib/dates";
import { cycleWeekFor } from "@/lib/timetable";
import { TimetableEditor } from "./timetable-editor";
import { CatalogManager } from "./catalog-manager";
import { PeriodForm } from "./period-form";

export const metadata = { title: "Rozvrh" };

const SECTIONS = [
  { key: "rozvrh", label: "Rozvrh" },
  { key: "predmety", label: "Předměty a učitelé" },
  { key: "obdobi", label: "Období zobrazení" },
] as const;

export default async function AdminTimetablePage({ searchParams }: PageProps<"/admin/rozvrh">) {
  const [sp, user] = await Promise.all([searchParams, requireStaff()]);
  const section = SECTIONS.find((s) => s.key === sp.sekce)?.key ?? "rozvrh";
  const allLessons = sp.vse === "1";
  const today = todayIso();
  const thisWeek = schoolWeek(today);
  const defaultMonday = today > thisWeek[4] ? shiftDate(thisWeek[0], 7) : thisWeek[0];
  const monday = typeof sp.tyden === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.tyden) ? schoolWeek(sp.tyden)[0] : defaultMonday;

  const [{ week, settings }, catalog, appSettings] = await Promise.all([
    getTimetableWeek(monday, { allLessons }),
    getTimetableCatalog(),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Správa rozvrhu"
        description={`Rozvrh třídy ${appSettings?.class_label ?? ""} se střídá po týdnech ${settings.cycle.join(" → ")}. Výchozí rozvrh a změny pro konkrétní týden jsou oddělené.`}
      />
      <PillTabs
        label="Sekce rozvrhu"
        className="mb-6"
        items={SECTIONS.map((s) => ({ href: `/admin/rozvrh${s.key === "rozvrh" ? "" : `?sekce=${s.key}`}`, label: s.label, active: section === s.key }))}
      />

      {section === "rozvrh" && (
        <>
          <WeekNav
            basePath="/admin/rozvrh"
            monday={week.monday}
            label={`${formatDate(week.monday, "d. M.")} – ${formatDate(week.days[4].date, "d. M. yyyy")}`}
            cycleWeek={week.cycleWeek}
            isCurrent={week.monday === defaultMonday}
            extraQuery={allLessons ? "&vse=1" : ""}
          />
          <TimetableEditor week={week} catalog={catalog} allLessons={allLessons} />
          <div className="mt-5">
            <TimetableLegend />
          </div>
        </>
      )}

      {section === "predmety" && <CatalogManager subjects={catalog.subjects} teachers={catalog.teachers} />}

      {section === "obdobi" && (
        <PeriodForm
          canEdit={user.profile.role === "admin"}
          settings={settings}
          currentWeek={cycleWeekFor(defaultMonday, settings)}
        />
      )}
    </>
  );
}
