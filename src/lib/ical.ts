/**
 * Kalendář WeilHubu ve formátu iCalendar (RFC 5545) pro odběr v Google,
 * Apple či Outlook kalendáři. Čistá funkce – data dodá /api/kalendar.
 */

export interface CalendarFeed {
  class_label?: string | null;
  exams: { id: string; title: string; date: string; time: string | null; scope: string; subject: string; group: string | null; updated_at: string }[];
  assignments: {
    id: string;
    title: string;
    date: string;
    time: string | null;
    instructions: string;
    subject: string;
    group: string | null;
    updated_at: string;
    done: boolean;
  }[];
  events: { id: string; title: string; kind: string; start_date: string; end_date: string; time: string | null; description: string; updated_at: string }[];
  notices: { id: string; title: string; kind: string; date: string; time: string | null; body: string; updated_at: string }[];
}

const TZ = "Europe/Prague";
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZ}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Escapování textu (\\ ; , a nové řádky). */
export function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Zalomení řádku po 75 bajtech (pokračování začíná mezerou), nedělí znaky UTF-8. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + b > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const ymd = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
const hms = (t: string) => t.slice(0, 5).replace(":", "") + "00";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMinutes(time: string, mins: number): { dayShift: number; time: string } {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const t = ((total % 1440) + 1440) % 1440;
  return { dayShift: Math.floor(total / 1440), time: `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}` };
}

function stamp(iso: string): string {
  const d = new Date(iso);
  const v = Number.isNaN(d.getTime()) ? new Date(0) : d;
  return v.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

interface Item {
  uid: string;
  summary: string;
  description?: string;
  url?: string;
  date: string;
  endDate?: string;
  time?: string | null;
  minutes?: number;
  updatedAt: string;
  /** Připomenutí večer předem v 18:00 */
  remind?: boolean;
  categories?: string;
}

function vevent(it: Item): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${it.uid}`, `DTSTAMP:${stamp(it.updatedAt)}`, `LAST-MODIFIED:${stamp(it.updatedAt)}`];
  let startMin = 0;
  if (it.time) {
    const end = addMinutes(it.time, it.minutes ?? 45);
    lines.push(`DTSTART;TZID=${TZ}:${ymd(it.date)}T${hms(it.time)}`);
    lines.push(`DTEND;TZID=${TZ}:${ymd(addDays(it.date, end.dayShift))}T${hms(end.time)}`);
    const [h, m] = it.time.split(":").map(Number);
    startMin = h * 60 + m;
  } else {
    lines.push(`DTSTART;VALUE=DATE:${ymd(it.date)}`);
    lines.push(`DTEND;VALUE=DATE:${ymd(addDays(it.endDate ?? it.date, 1))}`);
    lines.push("TRANSP:TRANSPARENT");
  }
  lines.push(`SUMMARY:${icsText(it.summary)}`);
  if (it.description) lines.push(`DESCRIPTION:${icsText(it.description)}`);
  if (it.url) lines.push(`URL:${it.url}`);
  if (it.categories) lines.push(`CATEGORIES:${icsText(it.categories)}`);
  if (it.remind) {
    const before = startMin + 6 * 60;
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(it.summary)}`,
      `TRIGGER:-PT${Math.floor(before / 60)}H${before % 60 ? `${before % 60}M` : ""}`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT");
  return lines;
}

const groupSuffix = (g: string | null) => (g ? ` (${g})` : "");

export function buildCalendar(feed: CalendarFeed, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const items: Item[] = [];

  for (const e of feed.exams) {
    items.push({
      uid: `test-${e.id}@weilhub`,
      summary: `Test ${e.subject}: ${e.title}${groupSuffix(e.group)}`,
      description: [e.scope, `${base}/testy`].filter(Boolean).join("\n\n"),
      url: `${base}/testy`,
      date: e.date,
      time: e.time,
      updatedAt: e.updated_at,
      remind: true,
      categories: "Test",
    });
  }
  for (const a of feed.assignments) {
    items.push({
      uid: `ukol-${a.id}@weilhub`,
      summary: `${a.done ? "✓ " : ""}Úkol ${a.subject}: ${a.title}${groupSuffix(a.group)}`,
      description: [a.instructions, `${base}/ukoly/${a.id}`].filter(Boolean).join("\n\n"),
      url: `${base}/ukoly/${a.id}`,
      date: a.date,
      time: a.time,
      minutes: 15,
      updatedAt: a.updated_at,
      remind: !a.done,
      categories: "Úkol",
    });
  }
  for (const e of feed.events) {
    const single = e.start_date === e.end_date;
    items.push({
      uid: `akce-${e.id}@weilhub`,
      summary: e.kind === "holiday" ? `Volno: ${e.title}` : e.title,
      description: [e.description, `${base}/kalendar`].filter(Boolean).join("\n\n"),
      url: `${base}/kalendar`,
      date: e.start_date,
      endDate: e.end_date,
      time: single ? e.time : null,
      minutes: 60,
      updatedAt: e.updated_at,
      categories: e.kind === "holiday" ? "Volno" : "Akce",
    });
  }
  for (const n of feed.notices) {
    items.push({
      uid: `oznameni-${n.id}@weilhub`,
      summary: n.kind === "deadline" ? `Termín: ${n.title}` : n.title,
      description: [n.body, `${base}/oznameni`].filter(Boolean).join("\n\n"),
      url: `${base}/oznameni`,
      date: n.date,
      time: n.time,
      minutes: n.kind === "deadline" ? 15 : 60,
      updatedAt: n.updated_at,
      categories: n.kind === "deadline" ? "Termín" : "Událost",
    });
  }

  const name = `WeilHub${feed.class_label ? ` · ${feed.class_label}` : ""}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WeilHub//Kalendar//CS",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(name)}`,
    "X-WR-CALDESC:Testy\\, úkoly a akce z WeilHubu",
    `X-WR-TIMEZONE:${TZ}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE,
    ...items.sort((a, b) => a.date.localeCompare(b.date)).flatMap(vevent),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
