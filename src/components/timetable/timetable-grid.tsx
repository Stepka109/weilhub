"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { ArrowLeft, Plus, X } from "lucide-react";
import { WEEKDAYS, WEEKDAYS_SHORT, formatDate, formatTime, TIME_ZONE } from "@/lib/dates";
import { STATUS_LABEL, isSpan, minutes, type Cell, type DayRow, type EventSpan, type TimetableWeek } from "@/lib/timetable";
import { cn } from "@/lib/utils";

const TAG: Partial<Record<Cell["status"], string>> = {
  changed: "S",
  roomchanged: "M",
  event: "A",
  cancelled: "O",
};

/* -------------------------------------------------------- aktuální čas (Praha) */

let nowCache = { key: "", value: { date: "", minutes: -1 } };
function readNow() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  if (parts !== nowCache.key) {
    const [date, time] = parts.split(" ");
    nowCache = { key: parts, value: { date, minutes: minutes(time) } };
  }
  return nowCache.value;
}
const serverNow = { date: "", minutes: -1 };
function useNow() {
  return React.useSyncExternalStore(
    (cb) => {
      const t = window.setInterval(cb, 30_000);
      return () => window.clearInterval(t);
    },
    readNow,
    () => serverNow,
  );
}

/* --------------------------------------------------------------- detail hodiny */

export interface DetailTarget {
  title: string;
  dayLabel: string;
  rows: [string, string][];
  note?: { text: string; tone: "red" | "green" | "purple" };
}

export function cellDetail(cell: Cell, row: DayRow, week: TimetableWeek, endLesson?: number): DetailTarget {
  const start = week.lessons.find((l) => l.lesson_number === cell.lesson);
  const end = week.lessons.find((l) => l.lesson_number === (endLesson ?? cell.lesson));
  const lessonLabel = endLesson && endLesson !== cell.lesson ? `${cell.lesson}.–${endLesson}. hodina` : `${cell.lesson}. hodina`;
  const rows: [string, string][] = [
    ["Předmět", cell.status === "event" ? cell.name : cell.name ? `${cell.name} (${cell.code})` : cell.code || "—"],
    ["Vyučující", cell.teacher || "—"],
    ["Čas", start && end ? `${formatTime(start.start_time)}–${formatTime(end.end_time)}` : "—"],
    ["Místnost", cell.room || "—"],
  ];
  if (cell.status === "roomchanged" && cell.base?.room) rows.push(["Původní místnost", cell.base.room]);
  if (cell.status === "changed" && cell.base) rows.push(["Původně", `${cell.base.subject_name} (${cell.base.subject_code})`]);
  rows.push(["Týden rozvrhu", week.cycleWeek]);

  let note: DetailTarget["note"];
  if (cell.status === "cancelled") note = { text: "HODINA ODPADÁ", tone: cell.override?.accent === "green" ? "green" : "red" };
  else if (cell.status === "changed") note = { text: "ZMĚNA / SUPLOVÁNÍ", tone: "red" };
  else if (cell.status === "roomchanged") note = { text: "ZMĚNA MÍSTNOSTI", tone: "red" };
  else if (cell.status === "event") note = { text: "AKCE TŘÍDY", tone: "green" };
  else if (cell.status === "new") note = { text: "NOVĚ PŘIDANÁ HODINA", tone: "green" };
  if (cell.note) note = { text: note ? `${note.text} · ${cell.note}` : cell.note, tone: note?.tone ?? "green" };

  return {
    title: cell.status === "event" ? cell.code || "Akce" : cell.name || cell.code,
    dayLabel: `${WEEKDAYS[row.day - 1]} ${formatDate(row.date)} · ${lessonLabel}`,
    rows,
    note,
  };
}

export function dayDetail(row: DayRow): DetailTarget {
  const o = row.dayOverride!;
  const rows: [string, string][] = [["Typ", o.kind === "event" ? "Celodenní akce" : "Volno / svátek"]];
  if (o.room) rows.push(["Místo", o.room]);
  if (o.teacher) rows.push(["Doprovod", o.teacher]);
  return {
    title: o.title,
    dayLabel: `${WEEKDAYS[row.day - 1]} ${formatDate(row.date)} · celý den`,
    rows,
    note: { text: o.kind === "event" ? "CELODENNÍ AKCE" : "VOLNO – NEUČÍ SE", tone: o.kind === "event" ? "green" : "purple" },
  };
}

/** Detail: na počítači dialog, na telefonu celá obrazovka (jako ve Family Station). */
export function TimetableDetail({ target, onClose }: { target: DetailTarget | null; onClose: () => void }) {
  return (
    <D.Root open={!!target} onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-navy/35 backdrop-blur-[2px] data-[state=open]:animate-fade-in max-sm:hidden" />
        <D.Content className="fixed z-50 flex flex-col overflow-hidden bg-card shadow-pop data-[state=open]:animate-fade-in max-sm:inset-0 max-sm:bg-bg sm:top-1/2 sm:left-1/2 sm:w-[min(540px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-dialog">
          {target && (
            <>
              <div className="flex items-start gap-3 bg-bg px-5 pt-[max(20px,var(--safe-top))] pb-5 sm:px-6 sm:pt-6">
                <D.Close className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-card sm:hidden" aria-label="Zpět">
                  <ArrowLeft className="size-6" />
                </D.Close>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-ink">{target.dayLabel}</p>
                  <D.Title className="mt-1 font-display text-2xl font-bold break-words text-ink sm:text-[1.65rem]">{target.title}</D.Title>
                  <D.Description className="sr-only">Detail vyučovací hodiny</D.Description>
                </div>
                <D.Close className="hidden size-10 shrink-0 place-items-center rounded-full bg-card text-muted hover:text-ink sm:grid" aria-label="Zavřít">
                  <X className="size-5" />
                </D.Close>
              </div>
              <dl className="mx-4 mb-4 overflow-hidden rounded-2xl bg-card sm:mx-0 sm:mb-0 sm:rounded-none">
                {target.rows.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[120px_1fr] gap-4 border-t border-line/80 px-5 py-4 first:border-t-0 sm:grid-cols-[150px_1fr] sm:px-6 sm:first:border-t">
                    <dt className="text-sm text-muted">{k}</dt>
                    <dd className="text-right font-semibold break-words text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              {target.note && (
                <p
                  className={cn(
                    "mx-4 mb-6 w-fit rounded-lg px-3.5 py-2 text-sm font-bold text-white sm:mx-6 sm:mt-1",
                    { red: "bg-[#db2d2d]", green: "bg-[#4f9a12]", purple: "bg-[#7c4ddc]" }[target.note.tone],
                  )}
                >
                  {target.note.text}
                </p>
              )}
            </>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/* ------------------------------------------------------------------- mřížka */

export function TimetableGrid({
  week,
  editable = false,
  onCellClick,
  onDayClick,
}: {
  week: TimetableWeek;
  editable?: boolean;
  onCellClick?: (cell: Cell, row: DayRow) => void;
  onDayClick?: (row: DayRow) => void;
}) {
  const now = useNow();
  const [detail, setDetail] = React.useState<DetailTarget | null>(null);
  const today = now.date;
  const nowLesson = week.lessons.find((l) => now.minutes >= minutes(l.start_time) && now.minutes < minutes(l.end_time))?.lesson_number;

  function openCell(cell: Cell, row: DayRow, span?: EventSpan) {
    if (editable) return onCellClick?.(cell, row);
    if (cell.status === "empty") return;
    setDetail(cellDetail(cell, row, week, span?.endLesson));
  }

  function renderCell(cell: Cell, row: DayRow) {
    const isNow = row.date === today && cell.lesson === nowLesson;
    const label = `${WEEKDAYS[row.day - 1]}, ${cell.lesson}. hodina`;
    if (cell.status === "empty") {
      return editable ? (
        <button type="button" className="tt-empty-add" onClick={() => openCell(cell, row)} aria-label={`Přidat hodinu – ${label}`}>
          <Plus className="size-5" aria-hidden />
        </button>
      ) : null;
    }
    const tag = TAG[cell.status];
    const cancelled = cell.status === "cancelled";
    const greenCancel = cancelled && cell.override?.accent === "green";
    return (
      <button
        type="button"
        className={cn("tt-card", `st-${cell.status}`, greenCancel && "st-cancelled-green", isNow && "is-now")}
        onClick={() => openCell(cell, row)}
        aria-label={`${label}: ${cell.name || cell.code}${cell.status !== "default" ? ` – ${STATUS_LABEL[cell.status as keyof typeof STATUS_LABEL]}` : ""}`}
      >
        {tag && <span className="tt-tag">{tag}</span>}
        {cell.status === "new" && <span className="tt-badge-n">N</span>}
        {/* Odpadlá hodina je uprostřed prázdná – jen ohraničení a odznak O */}
        {!cancelled && <span className="tt-code">{cell.code}</span>}
        {!cancelled && cell.room && <span className="tt-room">{cell.room}</span>}
      </button>
    );
  }

  return (
    <div className="wh-tt">
      <div className="wh-tt-scroll">
        {/* Sloupce se na širokém displeji roztáhnou, na úzkém se rozvrh posouvá do strany */}
        <table style={{ minWidth: `calc(var(--tt-day) + ${week.lessons.length} * var(--tt-col))` }}>
          <thead>
            <tr>
              <th className="tt-day" scope="col">
                <span className="sr-only">Den</span>
              </th>
              {week.lessons.map((l) => (
                <th key={l.lesson_number} scope="col">
                  {l.lesson_number}.
                  <small>
                    {formatTime(l.start_time)}–{formatTime(l.end_time)}
                  </small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {week.days.map((row) => {
              const isToday = row.date === today;
              const dayHead = (
                <>
                  {WEEKDAYS_SHORT[row.day - 1]}
                  <small>{formatDate(row.date, "d. M.")}</small>
                </>
              );
              return (
                <tr key={row.date}>
                  <th scope="row" className={cn("tt-day", isToday && "is-today")}>
                    {editable ? (
                      <button
                        type="button"
                        className="tt-day-btn"
                        onClick={() => onDayClick?.(row)}
                        title="Upravit celý den (volno, akce)"
                        aria-label={`Upravit celý den – ${WEEKDAYS[row.day - 1]} ${formatDate(row.date)}`}
                      >
                        {dayHead}
                      </button>
                    ) : (
                      dayHead
                    )}
                  </th>

                  {row.outsidePeriod && !editable ? (
                    week.lessons.map((l) => <td key={l.lesson_number} className="tt-cell tt-outside" />)
                  ) : row.dayOverride ? (
                    <td className="tt-wide" colSpan={week.lessons.length}>
                      <button
                        type="button"
                        className={cn("tt-wide-card", row.dayOverride.kind === "event" && "is-event")}
                        onClick={() => (editable ? onDayClick?.(row) : setDetail(dayDetail(row)))}
                      >
                        <span className="tt-tag">{row.dayOverride.kind === "event" ? "A" : "V"}</span>
                        <span className="tt-wide-label is-sticky">
                          <strong>{row.dayOverride.title}</strong>
                          {(row.dayOverride.room || row.dayOverride.teacher) && (
                            <span>{[row.dayOverride.room, row.dayOverride.teacher].filter(Boolean).join(" · ")}</span>
                          )}
                          {row.dayOverride.source === "calendar" && editable && <span>z kalendáře akcí</span>}
                        </span>
                      </button>
                    </td>
                  ) : (
                    row.items.map((item) =>
                      isSpan(item) ? (
                        <td key={`s${item.startLesson}`} className="tt-wide" colSpan={item.length}>
                          <button type="button" className="tt-wide-card is-event" onClick={() => openCell(item.cell, row, item)}>
                            <span className="tt-tag">A</span>
                            <span className="tt-wide-label">
                              <strong>{item.cell.code || "AKT"}</strong>
                              {item.cell.name && item.cell.name !== item.cell.code && <span>{item.cell.name}</span>}
                            </span>
                          </button>
                        </td>
                      ) : (
                        <td key={item.lesson} className={cn("tt-cell", isToday && "is-today")}>
                          {renderCell(item, row)}
                        </td>
                      ),
                    )
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TimetableDetail target={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export function TimetableLegend() {
  const items = [
    ["", "Výchozí hodina"],
    ["st-changed", "S – změna / suplování"],
    ["st-roomchanged", "M – změna místnosti"],
    ["st-new", "N – nová hodina"],
    ["st-event", "A – akce třídy"],
    ["st-cancelled", "O – odpadá"],
    ["st-holiday", "V – volno / svátek"],
  ];
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted" aria-label="Legenda rozvrhu">
      {items.map(([cls, label]) => (
        <li key={label} className="inline-flex items-center gap-2">
          <span className={cn("tt-legend-dot", cls)} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}
