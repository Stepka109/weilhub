import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabasePublicKey, supabaseUrl } from "@/lib/supabase/config";
import { buildCalendar, type CalendarFeed } from "@/lib/ical";
import { isWidgetToken, widgetTokenHash } from "@/lib/widget-token";

/**
 * Soukromý kalendář (iCalendar) pro Google, Apple či Outlook kalendář.
 * Adresa obsahuje osobní klíč: /api/kalendar/<klíč>.ics – klíč si student
 * vytvoří v Nastavení. Vydá jen testy, úkoly, akce a termíny z oznámení.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const token = file.replace(/\.ics$/i, "");
  if (!isSupabaseConfigured()) return new NextResponse("Portál není nastavený.", { status: 503 });
  if (!isWidgetToken(token)) return new NextResponse("Neplatný odkaz kalendáře.", { status: 404 });

  const supabase = createClient(supabaseUrl, supabasePublicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("calendar_feed", { p_token_hash: widgetTokenHash(token) });
  if (error) return new NextResponse("Kalendář se nepodařilo načíst.", { status: 502 });
  if (!data) return new NextResponse("Odkaz kalendáře je neplatný nebo zrušený. Vytvoř nový v Nastavení WeilHubu.", { status: 404 });

  const body = buildCalendar(data as CalendarFeed, request.nextUrl.origin);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="weilhub.ics"',
      "Cache-Control": "private, max-age=600",
    },
  });
}
