import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import { makeSnippet } from "@/lib/utils";
import type { SearchGroup, SearchResult } from "@/lib/search-types";

const ORDER: SearchResult["kind"][] = ["subject", "material", "assignment", "exam"];

interface Row {
  kind: SearchResult["kind"];
  id: string;
  title: string;
  subject_name: string;
  subject_slug: string;
  subject_color: string;
  body: string | null;
  ref_date: string | null;
}

/**
 * Globální vyhledávání. Databázová funkce běží s právy uživatele (RLS)
 * a navíc filtruje pouze publikovaný obsah.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user?.profile || user.profile.status !== "approved") {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ groups: [] });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_content", { q, max_results: 8 });
  if (error) return NextResponse.json({ error: "Vyhledávání selhalo" }, { status: 500 });

  const groups: SearchGroup[] = ORDER.map((kind) => ({
    kind,
    items: ((data ?? []) as Row[])
      .filter((r) => r.kind === kind)
      .map((r) => ({
        kind: r.kind,
        id: r.id,
        title: r.title,
        subjectName: r.subject_name,
        subjectColor: r.subject_color,
        snippet: r.body ? makeSnippet(r.body, q) : "",
        meta:
          r.kind === "assignment" && r.ref_date
            ? `termín ${formatDate(r.ref_date)}`
            : r.kind === "exam" && r.ref_date
              ? formatDate(r.ref_date)
              : "",
        href:
          r.kind === "subject"
            ? `/predmety/${r.subject_slug}`
            : r.kind === "material"
              ? `/materialy/${r.id}`
              : r.kind === "assignment"
                ? `/ukoly/${r.id}`
                : `/testy#test-${r.id}`,
      })),
  })).filter((g) => g.items.length > 0);

  return NextResponse.json({ groups }, { headers: { "Cache-Control": "private, no-store" } });
}
