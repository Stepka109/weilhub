"use client";

import * as React from "react";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import { minutes } from "@/lib/timetable";
import type { WidgetLesson } from "@/lib/widget";

/** Čas v Praze: datum a minuty od půlnoci (přepočítá se každých 15 s). */
function readNow() {
  const [date, time] = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .split(" ");
  return `${date} ${time}`;
}
function subscribe(cb: () => void) {
  const t = window.setInterval(cb, 15_000);
  return () => window.clearInterval(t);
}

interface Slot {
  lesson: number;
  start: number;
  end: number;
  label: string;
}

/** Hodiny dne podle čísla (u obou skupin „ANG / DIG“), bez odpadlých. */
function slotsOf(lessons: WidgetLesson[]): Slot[] {
  const by = new Map<number, WidgetLesson[]>();
  for (const l of lessons) if (l.status !== "cancelled") by.set(l.lesson, [...(by.get(l.lesson) ?? []), l]);
  return [...by.values()]
    .map((list) => {
      const codes = [...new Set(list.map((l) => (l.status === "event" ? l.name || l.code : l.code)))].join(" / ");
      const rooms = [...new Set(list.map((l) => l.room).filter(Boolean))].join(" / ");
      return { lesson: list[0].lesson, start: minutes(list[0].start), end: minutes(list[0].end), label: rooms ? `${codes} v ${rooms}` : codes };
    })
    .sort((a, b) => a.start - b.start);
}

const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
const span = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

/**
 * Odpočet na nástěnce: „Probíhá 4. ANG v N312 · do konce zbývá 12 min ·
 * další: 5. DIG v S205“. Po skončení vyučování se skryje.
 */
export function LessonCountdown({ date, lessons }: { date: string; lessons: WidgetLesson[] }) {
  const now = React.useSyncExternalStore(subscribe, readNow, () => null);
  if (!now) return null;
  const [today, time] = now.split(" ");
  if (today !== date) return null;
  const nowMin = minutes(time);
  const slots = slotsOf(lessons);
  if (!slots.length || nowMin >= slots[slots.length - 1].end) return null;

  const current = slots.find((s) => nowMin >= s.start && nowMin < s.end);
  const next = slots.find((s) => s.start > nowMin);
  let text: React.ReactNode;
  if (current) {
    text = (
      <>
        Probíhá <strong>{current.lesson}. {current.label}</strong> · do konce zbývá <strong>{span(current.end - nowMin)}</strong>
        {next ? ` · další: ${next.lesson}. ${next.label}` : " · pak konec vyučování"}
      </>
    );
  } else if (next && next.start - nowMin <= 60) {
    const first = next === slots[0];
    text = (
      <>
        {first ? "Za" : "Přestávka · za"} <strong>{span(next.start - nowMin)}</strong> začíná <strong>{next.lesson}. {next.label}</strong>
      </>
    );
  } else if (next) {
    text = (
      <>
        Dnes začínáš v <strong>{fmt(next.start)}</strong> · {next.lesson}. {next.label}
      </>
    );
  } else return null;

  return (
    <Link
      href="/rozvrh"
      className="mt-4 inline-flex max-w-full items-start gap-2 rounded-2xl border border-[#ffd29a] bg-[#fff6eb] px-3.5 py-2 text-sm text-ink transition-colors hover:bg-[#ffecd4]"
    >
      <Clock3 className="mt-0.5 size-4 shrink-0 text-[#c86a00]" aria-hidden />
      <span>{text}</span>
    </Link>
  );
}
