"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime, WEEKDAYS_SHORT } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { CalendarItem } from "@/lib/data/portal";

import { KIND_META } from "./calendar-meta";

function itemsOn(items: CalendarItem[], date: string) {
  return items.filter((i) => i.date <= date && i.endDate >= date);
}

function Chip({ item, onOpen }: { item: CalendarItem; onOpen: (i: CalendarItem) => void }) {
  const m = KIND_META[item.kind];
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn("flex w-full items-center gap-1.5 truncate rounded-lg px-2 py-1 text-left text-xs font-medium transition-opacity hover:opacity-80", m.chip)}
    >
      <m.icon className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">{m.label}: </span>
      <span className="truncate">{item.title}</span>
    </button>
  );
}

export function CalendarView({
  view,
  days,
  monthDays,
  items,
  today,
  month,
}: {
  view: "mesic" | "tyden" | "seznam";
  days: string[];
  monthDays: string[];
  items: CalendarItem[];
  today: string;
  month: string;
}) {
  const [open, setOpen] = React.useState<CalendarItem | null>(null);

  return (
    <>
      {view === "mesic" && (
        <div className="overflow-hidden rounded-card border border-line/80 bg-card shadow-card">
          <div className="grid grid-cols-7 border-b border-line bg-bg/60">
            {WEEKDAYS_SHORT.map((d) => (
              <div key={d} className="py-2.5 text-center text-xs font-semibold text-muted uppercase">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((d) => {
              const dayItems = itemsOn(items, d);
              const inMonth = d.startsWith(month);
              return (
                <div
                  key={d}
                  className={cn(
                    "min-h-20 border-r border-b border-line/70 p-1 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0",
                    !inMonth && "bg-bg/60",
                  )}
                >
                  <span
                    className={cn(
                      "mb-1 grid size-7 place-items-center rounded-full text-xs font-semibold",
                      d === today ? "bg-primary text-white" : inMonth ? "text-ink" : "text-muted/60",
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {/* Mobil: jen barevné tečky */}
                  <div className="flex flex-wrap gap-1 px-1 sm:hidden">
                    {dayItems.slice(0, 4).map((i) => (
                      <button
                        key={`${i.kind}-${i.id}`}
                        type="button"
                        onClick={() => setOpen(i)}
                        className={cn("size-2.5 rounded-full", KIND_META[i.kind].dot)}
                        aria-label={`${KIND_META[i.kind].label}: ${i.title}`}
                      />
                    ))}
                  </div>
                  <div className="hidden space-y-1 sm:block">
                    {dayItems.slice(0, 3).map((i) => (
                      <Chip key={`${i.kind}-${i.id}`} item={i} onOpen={setOpen} />
                    ))}
                    {dayItems.length > 3 && <p className="px-2 text-xs text-muted">+{dayItems.length - 3} další</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "tyden" && (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((d) => {
            const dayItems = itemsOn(items, d);
            return (
              <div key={d} className={cn("rounded-card border border-line/80 bg-card p-3 shadow-card", d === today && "ring-2 ring-primary/40")}>
                <p className={cn("text-sm font-semibold capitalize", d === today ? "text-primary" : "text-ink")}>
                  {formatDate(d, "EEEE d. M.")}
                </p>
                <div className="mt-2 space-y-1.5">
                  {dayItems.length === 0 ? (
                    <p className="text-xs text-muted">Nic naplánováno</p>
                  ) : (
                    dayItems.map((i) => <Chip key={`${i.kind}-${i.id}`} item={i} onOpen={setOpen} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "seznam" && (
        <div className="rounded-card border border-line/80 bg-card p-2 shadow-card sm:p-3">
          {items.length === 0 ? (
            <p className="px-4 py-12 text-center text-muted">V tomto období nejsou žádné události.</p>
          ) : (
            <ul>
              {items.map((i) => {
                const m = KIND_META[i.kind];
                return (
                  <li key={`${i.kind}-${i.id}`}>
                    <button type="button" onClick={() => setOpen(i)} className="flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left hover:bg-bg">
                      <span className="w-20 shrink-0 text-sm">
                        <span className="block font-semibold text-ink capitalize">{formatDate(i.date, "EEEEEE d. M.")}</span>
                        {i.time && <span className="text-muted">{formatTime(i.time)}</span>}
                      </span>
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", m.chip)}>
                        <m.icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{i.title}</span>
                        <span className="block truncate text-sm text-muted">
                          {m.label}
                          {i.subject ? ` · ${i.subject.name}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        {open && (
          <DialogContent title={open.title}>
            <div className="flex flex-wrap gap-2">
              <Badge className={KIND_META[open.kind].chip}>{KIND_META[open.kind].label}</Badge>
              {open.subject && <Badge tone="outline">{open.subject.name}</Badge>}
            </div>
            <p className="mt-4 text-sm font-medium text-ink capitalize">
              {formatDate(open.date, "EEEE d. MMMM yyyy")}
              {open.endDate !== open.date && ` – ${formatDate(open.endDate, "EEEE d. MMMM yyyy")}`}
              {open.time && `, ${formatTime(open.time)}`}
            </p>
            {open.description && <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-ink">{open.description}</p>}
            {open.href && (
              <Button asChild className="mt-6">
                <Link href={open.href} onClick={() => setOpen(null)}>
                  Zobrazit detail <ArrowRight aria-hidden />
                </Link>
              </Button>
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
