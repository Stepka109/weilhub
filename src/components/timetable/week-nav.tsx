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

const GROUP_OPTIONS = [
  { view: "S1", q: "s1", label: "Skupina S1", short: "S1" },
  { view: "both", q: "obe", label: "Obě skupiny", short: "Obě" },
  { view: "S2", q: "s2", label: "Skupina S2", short: "S2" },
] as const;

export const groupQuery = (view: "S1" | "S2" | "both") => GROUP_OPTIONS.find((o) => o.view === view)!.q;

/** Přepínač skupin: vlevo S1, uprostřed obě skupiny, vpravo S2. */
export function GroupSwitch({
  view,
  myGroup,
  hrefFor,
  label = "Skupina",
}: {
  view: "S1" | "S2" | "both";
  myGroup?: "S1" | "S2" | null;
  /** Adresa pro hodnotu parametru `skupina` (s1 / obe / s2) */
  hrefFor: (q: string) => string;
  label?: string;
}) {
  return (
    <nav aria-label={label} className="mb-3">
      <ul className="mx-auto grid max-w-lg grid-cols-3 gap-1 rounded-full border border-line bg-card p-1 shadow-card">
        {GROUP_OPTIONS.map((o) => {
          const active = view === o.view;
          return (
            <li key={o.q}>
              <Link
                href={hrefFor(o.q)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold whitespace-nowrap transition-colors duration-150",
                  active ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-slate-soft hover:text-ink",
                )}
              >
                {o.view !== "both" && (
                  <span className={cn("size-2 shrink-0 rounded-full", o.view === "S1" ? "bg-[#0b7d73]" : "bg-[#4b3fd1]", active && "ring-2 ring-white/70")} aria-hidden />
                )}
                <span className="sm:hidden">{o.short}</span>
                <span className="max-sm:hidden">{o.label}</span>
                {myGroup === o.view && <span className={cn("text-[11px] font-medium", active ? "text-white/80" : "text-muted")}>(moje)</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
