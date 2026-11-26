import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Obrázek z poznámky. Vidí ho jen autor, nebo redaktor u sdílené poznámky
 * (hlídá RLS tabulky note_images i pravidla úložiště). Vystaví krátkodobý
 * podepsaný odkaz a přesměruje na něj.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/poznamky/obrazek/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Obrázek nenalezen", { status: 404 });
  const user = await getSessionUser();
  if (!user) return new NextResponse("Pro zobrazení se přihlaste.", { status: 401 });
  if (user.profile?.status !== "approved") return new NextResponse("Účet není schválený.", { status: 403 });

  const supabase = await createClient();
  const { data: img } = await supabase.from("note_images").select("storage_path").eq("id", id).maybeSingle();
  if (!img) return new NextResponse("Obrázek nenalezen nebo k němu nemáte přístup.", { status: 404 });
  const { data, error } = await supabase.storage.from("notes").createSignedUrl(img.storage_path, 300);
  if (error || !data?.signedUrl) return new NextResponse("Obrázek se nepodařilo načíst.", { status: 502 });
  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, max-age=240", "Referrer-Policy": "no-referrer" },
  });
}
