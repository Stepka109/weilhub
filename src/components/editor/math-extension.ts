import { InputRule } from "@tiptap/core";
import { InlineMath } from "@tiptap/extension-mathematics";
import { KATEX_OPTIONS } from "@/lib/math";

/**
 * Vzorec v řádku. Kromě výchozího `$$…$$` se převádí i zápis `$…$`
 * (napíšete `$\frac{1}{2}$` a po uzavírajícím `$` se vzorec vykreslí).
 */
export function createInlineMath(onEdit: (latex: string, pos: number) => void) {
  return InlineMath.extend({
    addInputRules() {
      return [
        ...(this.parent?.() ?? []),
        new InputRule({
          find: /(?:^|[^$\\])(\$([^$\n]+?)\$)$/,
          handler: ({ state, range, match }) => {
            const latex = match[2]?.trim();
            if (!latex || /^\d+$/.test(latex)) return null;
            const full = match[1];
            const start = range.to - full.length;
            state.tr.replaceWith(start, range.to, this.type.create({ latex }));
          },
        }),
      ];
    },
  }).configure({
    katexOptions: KATEX_OPTIONS,
    onClick: (node, pos) => onEdit(String(node.attrs.latex ?? ""), pos),
  });
}
