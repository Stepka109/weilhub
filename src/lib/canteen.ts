import "server-only";
import { unstable_cache } from "next/cache";

/**
 * Jídelníček školní jídelny ze Strava.cz (veřejný, bez přihlášení).
 * Jídelna 5228 = Střední škola automobilní a informatiky. Stahuje se
 * nejvýš jednou za hodinu; když Strava.cz neodpoví, karta se jen nezobrazí.
 */
export const CANTEEN_ID = "5228";
export const CANTEEN_URL = `https://app.strava.cz/jidelnicky?jidelna=${CANTEEN_ID}`;
export const CANTEEN_ORDER_URL = "https://app.strava.cz/prihlasit-se";

export type DishKind = "soup" | "main" | "breakfast";

export interface Dish {
  kind: DishKind;
  /** „Polévka“, „Oběd 1“, „Snídaně“… */
  label: string;
  name: string;
  allergens: { code: string; name: string }[];
}

export interface CanteenDay {
  /** YYYY-MM-DD */
  date: string;
  dishes: Dish[];
}

interface RawItem {
  datum?: unknown;
  druh_popis?: unknown;
  druh_chod?: unknown;
  nazev?: unknown;
  polevka?: unknown;
  alergeny?: unknown;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const ORDER: Record<DishKind, number> = { soup: 0, main: 1, breakfast: 2 };

/** „26.11.2026“ → „2026-11-26“ */
function isoDate(v: string): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** Odpověď /api/jidelnickyPage → dny s obědy (seřazené, bez snídaní). Čistá funkce kvůli testům. */
export function parseMenu(json: unknown): CanteenDay[] {
  const meals = (json as { meals?: unknown })?.meals;
  if (!meals || typeof meals !== "object") return [];
  const days = new Map<string, Dish[]>();
  for (const table of Object.values(meals as Record<string, unknown>)) {
    if (!Array.isArray(table)) continue;
    for (const raw of table as RawItem[]) {
      const date = isoDate(str(raw.datum));
      const name = str(raw.nazev);
      if (!date || !name) continue;
      const course = str(raw.druh_chod).toLowerCase();
      const kind: DishKind = str(raw.polevka) === "A" ? "soup" : course.startsWith("sn") ? "breakfast" : "main";
      // Snídaně na WeilHubu neukazujeme, jen obědy
      if (kind === "breakfast") continue;
      const allergens = Array.isArray(raw.alergeny)
        ? (raw.alergeny as unknown[])
            .filter((a): a is [string, string] => Array.isArray(a) && typeof a[0] === "string")
            .map(([code, n]) => ({ code: code.trim(), name: String(n ?? "").trim() }))
        : [];
      const label = str(raw.druh_popis) || (kind === "soup" ? "Polévka" : "Oběd");
      const list = days.get(date) ?? [];
      list.push({ kind, label, name, allergens });
      days.set(date, list);
    }
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dishes]) => ({ date, dishes: dishes.sort((x, y) => ORDER[x.kind] - ORDER[y.kind] || x.label.localeCompare(y.label, "cs")) }));
}

async function load(): Promise<CanteenDay[]> {
  const res = await fetch("https://app.strava.cz/api/jidelnickyPage", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ cislo: CANTEEN_ID, lang: "CZ" }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Strava.cz ${res.status}`);
  const json = await res.json();
  if ((json as { state?: string })?.state === "error") throw new Error("Strava.cz error");
  return parseMenu(json);
}

const cachedMenu = unstable_cache(load, ["canteen-menu", CANTEEN_ID], { revalidate: 3600 });

/** Jídelníček na nejbližší dny, nebo null, když se nepodařilo načíst. */
export async function getCanteenMenu(): Promise<CanteenDay[] | null> {
  try {
    return await cachedMenu();
  } catch {
    return null;
  }
}

/** Den pro nástěnku: dnes do 14:30 (po obědech už zítřek), jinak nejbližší další. */
export function canteenDayFor(menu: CanteenDay[], today: string, nowMin: number): CanteenDay | null {
  return menu.find((d) => d.date > today || (d.date === today && nowMin < 14 * 60 + 30)) ?? null;
}
