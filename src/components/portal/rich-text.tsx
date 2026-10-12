import { renderTiptapHtml } from "@/lib/tiptap";
import type { TiptapNode } from "@/lib/types";

/**
 * Zobrazení zápisu. HTML vzniká výhradně vlastním rendererem z JSON
 * (veškerý text je escapovaný, povolené jsou jen známé uzly a bezpečné URL),
 * proto je dangerouslySetInnerHTML v tomto místě bezpečné.
 */
export function RichText({ doc, className }: { doc: TiptapNode | null; className?: string }) {
  const html = renderTiptapHtml(doc);
  if (!html) return <p className="text-muted">Zápis zatím nemá žádný obsah.</p>;
  return <div className={className ?? "prose-wh"} dangerouslySetInnerHTML={{ __html: html }} />;
}
