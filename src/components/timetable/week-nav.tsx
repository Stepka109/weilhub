import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { shiftDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Přepínání týdnů – šipky a pilulka s datem (styl Family Station). */
export function WeekNav({
  basePath,
  monday,
  label,
  cycleWeek,
  isCurrent,
  extraQuery = "",
}: {
  basePath: string;
  monday: string;
  label: string;
  cycleWeek: string;
  isCurrent: boolean;
  extraQuery?: string;
}) {
  const href = (d: string) => `${basePath}?tyden=${d}${extraQuery}`;
  const btn =
    "grid h-12 place-items-center rounded-[14px] bg-bg text-slate-ink transition-colors hover:bg-light-blue hover:text-primary [&_svg]:size-6";
  return (
    <div className="mb-4 grid grid-cols-[52px_minmax(0,1fr)_52px] gap-2 rounded-card border border-line/80 bg-card p-2 shadow-card sm:grid-cols-[72px_minmax(0,1fr)_72px]">
      <Link href={href(shiftDate(monday, -7))} scroll={false} className={btn} aria-label="Předchozí týden">
        <ChevronLeft />
      </Link>
      <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 text-center">
        <span className="inline-flex items-center gap-2 font-display font-semibold text-ink">
          <CalendarDays className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{label}</span>
        </span>
        <span className="rounded-full bg-light-blue px-2.5 py-0.5 text-xs font-bold text-primary">týden {cycleWeek}</span>
        {!isCurrent && (
          <Link href={`${basePath}${extraQuery ? `?${extraQuery.slice(1)}` : ""}`} scroll={false} className={cn("text-xs font-medium text-primary hover:underline")}>
            Dnes
          </Link>
        )}
      </div>
      <Link href={href(shiftDate(monday, 7))} scroll={false} className={btn} aria-label="Další týden">
        <ChevronRight />
      </Link>
    </div>
  );
}
