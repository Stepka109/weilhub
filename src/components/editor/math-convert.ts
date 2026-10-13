import type { Editor } from "@tiptap/core";
import { INLINE_MATH_IN_TEXT } from "@/lib/math";

interface Found {
  from: number;
  to: number;
  latex: string;
}

/** Najde v zápisu vzorce napsané jako text „$…$“ (mimo bloky a značky kódu). */
export function findTextFormulas(editor: Editor): Found[] {
  const found: Found[] = [];
  editor.state.doc.descendants((node, pos, parent) => {
    if (parent?.type.name === "codeBlock") return false;
    if (!node.isText || !node.text?.includes("$")) return;
    if (node.marks.some((m) => m.type.name === "code")) return;
    for (const m of node.text.matchAll(INLINE_MATH_IN_TEXT)) {
      const latex = m[1].trim();
      if (!latex) continue;
      found.push({ from: pos + m.index!, to: pos + m.index! + m[0].length, latex });
    }
  });
  return found;
}

/** Převede nalezené „$…$“ na vykreslené vzorce (od konce, aby se neposunuly pozice). */
export function convertTextFormulas(editor: Editor): number {
  const found = findTextFormulas(editor);
  const type = editor.schema.nodes.inlineMath;
  if (!found.length || !type) return 0;
  const tr = editor.state.tr;
  for (const f of [...found].reverse()) {
    tr.replaceWith(f.from, f.to, type.create({ latex: f.latex }));
  }
  editor.view.dispatch(tr);
  return found.length;
}
