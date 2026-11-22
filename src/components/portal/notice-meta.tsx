import { CalendarClock, CalendarHeart } from "lucide-react";
import { dueInfo, formatDate, formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Announcement } from "@/lib/types";

/** Události (co se kdy děje) a termíny (co je potřeba do kdy) z oznámení. */
export const NOTICE_KIND = {
  event: { label: "Událost", icon: CalendarHeart, tile: "bg-cyan-soft text-cyan-ink", badge: "bg-cyan-soft text-cyan-ink" },
  deadline: { label: "Termín", icon: CalendarClock, tile: "bg-lime-soft text-lime-ink", badge: "bg-lime-soft text-lime-ink" },
} as const;

type Notice = Pick<Announcement, "kind" | "event_date" | "event_time">;

export const isDated = (a: Notice): a is Notice & { kind: "event" | "deadline"; event_date: string } =>
  a.kind !== "info" && !!a.event_date;

/** „St 25. 11. v 10:00“ u události, „do Po 23. 11. (10:00)“ u termínu. */
export function noticeWhen(a: Notice): string {
  if (!isDated(a)) return "";
  const day = formatDate(a.event_date, "EEEEEE d. M.");
  const time = a.event_time ? formatTime(a.event_time) : "";
  return a.kind === "deadline" ? `do ${day}${time ? ` (${time})` : ""}` : `${day}${time ? ` v ${time}` : ""}`;
}

/** „Dnes“, „Zítra“, „Za 3 dny“ – nebo „Proběhlo“ / „Termín uplynul“. */
export function noticeRelative(a: Notice): { label: string; soon: boolean; past: boolean } {
  if (!isDated(a)) return { label: "", soon: false, past: false };
  const info = dueInfo(a.event_date);
  if (info.days < 0) return { label: a.kind === "deadline" ? "Termín uplynul" : "Proběhlo", soon: false, past: true };
  return { label: info.label, soon: info.days <= 2, past: false };
}

/** Dlaždice s datem (den v týdnu, číslo, měsíc) v barvě typu. */
export function NoticeDateTile({ notice, className }: { notice: Notice; className?: string }) {
  if (!isDated(notice)) return null;
  const meta = NOTICE_KIND[notice.kind];
  return (
    <span className={cn("flex w-16 shrink-0 flex-col items-center rounded-2xl py-2", meta.tile, className)}>
      <span className="text-[11px] font-semibold uppercase">{formatDate(notice.event_date, "EEEEEE")}</span>
      <span className="font-display text-2xl leading-none font-bold">{formatDate(notice.event_date, "d.")}</span>
      <span className="text-[11px]">{formatDate(notice.event_date, "LLL")}</span>
    </span>
  );
}
