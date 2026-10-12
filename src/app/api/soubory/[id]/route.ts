import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MATERIALS_BUCKET } from "@/lib/supabase/config";
import { fileTypeOf, sanitizeFileName } from "@/lib/files";

/**
 * Autorizované stažení / zobrazení souboru.
 *  1. Ověří přihlášení a schválení účtu.
 *  2. Načte záznam souboru s právy uživatele → RLS pustí jen soubory
 *     publikovaných materiálů/úkolů (redaktorům i koncepty).
 *  3. Vystaví krátkodobý podepsaný odkaz (60 s) a přesměruje na něj.
 *     Storage RLS navíc znovu kontroluje oprávnění při podpisu.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/soubory/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Soubor nenalezen", { status: 404 });

  const user = await getSessionUser();
  if (!user) return new NextResponse("Pro stažení se přihlaste.", { status: 401 });
  if (user.profile?.status !== "approved") return new NextResponse("Účet není schválený.", { status: 403 });

  const supabase = await createClient();
  const [material, assignment] = await Promise.all([
    supabase.from("material_files").select("storage_path, file_name").eq("id", id).maybeSingle(),
    supabase.from("assignment_files").select("storage_path, file_name").eq("id", id).maybeSingle(),
  ]);
  const file = material.data ?? assignment.data;
  if (!file) return new NextResponse("Soubor nenalezen nebo k němu nemáte přístup.", { status: 404 });

  const inline = request.nextUrl.searchParams.get("inline") === "1" && Boolean(fileTypeOf(file.file_name)?.inline);
  const { data, error } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .createSignedUrl(file.storage_path, 60, inline ? undefined : { download: sanitizeFileName(file.file_name) });

  if (error || !data?.signedUrl) {
    return new NextResponse("Soubor se nepodařilo připravit ke stažení.", { status: 502 });
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
