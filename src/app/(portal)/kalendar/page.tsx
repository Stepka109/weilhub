import Link from "next/link";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { cs } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PillTabs } from "@/components/ui/misc";
import { CalendarView } from "@/components/portal/calendar-view";
import { KIND_META } from "@/components/portal/calendar-meta";
import { getCalendarItems } from "@/lib/data/portal";
import { dateOnly, schoolWeek, shiftDate, todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Kalendář" };

const VIEWS = [
  { key: "mesic", label: "Měsíc" },
  { key: "tyden", label: "Týden" },
  { key: "seznam", label: "Seznam" },
] as const;

export default async function CalendarPage({ searchParams }: PageProps<"/kalendar">) {
  const sp = await searchParams;
  const today = todayIso();
  const view = VIEWS.find((v) => v.key === sp.zobrazeni)?.key ?? "mesic";
  const anchor = typeof sp.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.datum) ? sp.datum : today;
  const anchorDate = dateOnly(anchor);

  const monthStart = startOfMonth(anchorDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: gridStart, end: gridEnd }).map((d) => format(d, "yyyy-MM-dd"));
  const weekMonday = schoolWeek(anchor)[0];
  const weekDays = Array.from({ length: 7 }, (_, i) => shiftDate(weekMonday, i));

  let from: string, to: string, prev: string, next: string, title: string;
  if (view === "tyden") {
    from = weekDays[0];
    to = weekDays[6];
    prev = shiftDate(anchor, -7);
    next = shiftDate(anchor, 7);
    title = `${format(dateOnly(from), "d. M.", { locale: cs })} – ${format(dateOnly(to), "d. M. yyyy", { locale: cs })}`;
  } else {
    from = view === "seznam" ? format(monthStart, "yyyy-MM-dd") : monthDays[0];
    to = view === "seznam" ? format(endOfMonth(anchorDate), "yyyy-MM-dd") : monthDays.at(-1)!;
    prev = format(addMonths(monthStart, -1), "yyyy-MM-dd");
    next = format(addMonths(monthStart, 1), "yyyy-MM-dd");
    const m = format(monthStart, "LLLL yyyy", { locale: cs });
    title = m.charAt(0).toUpperCase() + m.slice(1);
  }
  const items = await getCalendarItems(from, to);
  const href = (params: Record<string, string>) => `/kalendar?${new URLSearchParams({ zobrazeni: view, ...params })}`;

  return (
    <>
      <PageHeader
        title="Kalendář"
        description="Testy, termíny úkolů, školní akce a volné dny na jednom místě."
        actions={
          <PillTabs
            label="Zobrazení kalendáře"
            items={VIEWS.map((v) => ({ href: `/kalendar?zobrazeni=${v.key}&datum=${anchor}`, label: v.label, active: view === v.key }))}
          />
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Předchozí">
            <Link href={href({ datum: prev })} scroll={false}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label="Další">
            <Link href={href({ datum: next })} scroll={false}>
              <ChevronRight />
            </Link>
          </Button>
          <h2 className="ml-2 text-xl font-semibold text-ink">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="secondary" size="sm">
            <Link href={href({ datum: today })} scroll={false}>
              Dnes
            </Link>
          </Button>
        </div>
      </div>
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted" aria-label="Legenda">
        {Object.entries(KIND_META).map(([k, m]) => (
          <li key={k} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", m.dot)} aria-hidden />
            {m.label}
          </li>
        ))}
      </ul>
      <CalendarView
        view={view}
        days={weekDays}
        monthDays={monthDays}
        items={items}
        today={today}
        month={format(monthStart, "yyyy-MM")}
      />
    </>
  );
}
