import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabasePublicKey, supabaseUrl } from "@/lib/supabase/config";
import { nowMinutes, schoolWeek, shiftDate, todayIso } from "@/lib/dates";
import { widgetDay, type WidgetRaw } from "@/lib/widget";
import { isWidgetToken, widgetTokenHash } from "@/lib/widget-token";
import { getCanteenMenu } from "@/lib/canteen";

const NO_STORE = { "Cache-Control": "private, no-store" };

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });
}

/**
 * Rozvrh pro widget na iPhonu (Scriptable). Ověřuje se osobním klíčem
 * v hlavičce `Authorization: Bearer …` – klíč si student vytvoří v Nastavení.
 * Vrací rozvrh jednoho dne a oběd ve školní jídelně (dnes, po obědech
 * nejbližší další dny), nic dalšího.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return fail(503, "Portál není nastavený.");
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!isWidgetToken(token)) return fail(401, "Chybí platný klíč widgetu.");

  const today = todayIso();
  const supabase = createClient(supabaseUrl, supabasePublicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const menuPromise = getCanteenMenu();
  const { data, error } = await supabase.rpc("widget_timetable", {
    p_token_hash: widgetTokenHash(token),
    p_from: schoolWeek(today)[0],
    p_to: shiftDate(today, 14),
  });
  if (error) return fail(502, "Rozvrh se nepodařilo načíst.");
  if (!data) return fail(401, "Klíč widgetu je neplatný nebo zrušený. Vytvoř nový v Nastavení WeilHubu.");

  const s = data.settings ?? {};
  const raw: WidgetRaw = {
    group: data.group === "S1" || data.group === "S2" ? data.group : null,
    settings: {
      classLabel: s.class_label ?? "",
      cycle: s.cycle ?? ["A", "E", "B", "F"],
      referenceMonday: s.reference_monday ?? "2026-09-14",
      referenceWeek: s.reference_week ?? "B",
      visibleFrom: s.visible_from ?? "2000-01-01",
      visibleTo: s.visible_to ?? "2100-01-01",
    },
    periods: data.periods ?? [],
    slots: data.slots ?? [],
    overrides: data.overrides ?? [],
    dayOverrides: data.day_overrides ?? [],
    holidays: data.holidays ?? [],
  };

  // Jídelna: dnes do 14:30, potom další dny (widget ukáže 1–2 dny)
  const nowMin = nowMinutes();
  const menu = await menuPromise;
  const canteen = (menu ?? [])
    .filter((d) => d.date > today || (d.date === today && nowMin < 14 * 60 + 30))
    .slice(0, 2)
    .map((d) => ({ date: d.date, dishes: d.dishes.map(({ kind, label, name }) => ({ kind, label, name })) }));

  return NextResponse.json(
    { ok: true, day: widgetDay(raw, today, nowMin), canteen, generatedAt: new Date().toISOString() },
    { headers: NO_STORE },
  );
}
