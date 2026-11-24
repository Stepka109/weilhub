"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function subscribe(cb: () => void) {
  const t = window.setInterval(cb, 60_000);
  return () => window.clearInterval(t);
}
/** Aktuální čas zaokrouhlený na minutu (stabilní hodnota pro useSyncExternalStore) */
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;

/** Termín odevzdání v místním čase (bez času = do konce dne). */
export function dueInstant(dueDate: string, dueTime: string | null) {
  return new Date(`${dueDate}T${(dueTime ?? "23:59").slice(0, 5)}:00`).getTime();
}

function remaining(ms: number) {
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `zbývá ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `zbývá ${h} h ${min % 60} min`;
  const d = Math.floor(h / 24);
  if (d >= 3) return `zbývá ${d} ${d < 5 ? "dny" : "dní"}`;
  return `zbývá ${d} ${d === 1 ? "den" : "dny"} ${h % 24} h`;
}

/**
 * Časová lišta úkolu: na začátku (den zadání) celá zelená, jak ubíhá čas
 * do odevzdání, barví se zleva doprava do červena. Obnovuje se každou minutu.
 */
export function DueBar({
  assignedOn,
  dueDate,
  dueTime,
  completed = false,
  className,
}: {
  assignedOn: string;
  dueDate: string;
  dueTime: string | null;
  completed?: boolean;
  className?: string;
}) {
  const now = React.useSyncExternalStore(subscribe, minuteNow, () => null);
  const end = dueInstant(dueDate, dueTime);
  let start = new Date(`${assignedOn}T00:00:00`).getTime();
  if (start >= end) start = end - 24 * 60 * 60_000;

  const ratio = now === null ? 0 : Math.min(1, Math.max(0, (now - start) / (end - start)));
  const overdue = now !== null && now >= end;
  const label = completed ? "Splněno" : now === null ? "" : overdue ? "Po termínu" : remaining(end - now);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        role="progressbar"
        aria-label="Uplynulý čas do odevzdání"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(completed ? 0 : ratio * 100)}
        className="relative h-2 overflow-hidden rounded-full bg-[#34c759]"
      >
        {!completed && (
          <span className="absolute inset-y-0 left-0 rounded-full bg-[#e5484d] transition-[width] duration-700" style={{ width: `${ratio * 100}%` }} />
        )}
      </div>
      {label && (
        <p className={cn("text-xs font-medium", completed ? "text-mint-ink" : overdue || ratio > 0.8 ? "text-rose-ink" : "text-muted")}>{label}</p>
      )}
    </div>
  );
}
