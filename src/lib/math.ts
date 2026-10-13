/**
 * Vykreslování vzorců (KaTeX). Používá se v editoru i při zobrazení zápisu.
 * `trust: false` zakazuje příkazy jako \href nebo \includegraphics, takže
 * výstup neobsahuje žádné odkazy ani skripty – je bezpečný pro vložení do HTML.
 */
import katex, { type KatexOptions } from "katex";

export const MAX_LATEX_LENGTH = 1000;

export const KATEX_OPTIONS: KatexOptions = {
  throwOnError: false,
  trust: false,
  strict: "ignore",
  output: "html",
  maxSize: 20,
  maxExpand: 200,
  // Zlomky v textu v plné velikosti (čitelnější než malé řádkové zlomky)
  macros: { "\\frac": "\\dfrac" },
};

export function renderLatex(latex: string, displayMode = false): string {
  const source = latex.slice(0, MAX_LATEX_LENGTH);
  try {
    return katex.renderToString(source, { ...KATEX_OPTIONS, displayMode });
  } catch {
    return "";
  }
}

/** `$…$` v obyčejném textu (stejný vzor jako převod v editoru; čisté „$5$“ se ignoruje). */
export const INLINE_MATH_IN_TEXT = /\$(?!\d+\$)([^$\n]+?)\$(?!\d)/g;

/** Rychlé vložení do editoru vzorců. `▢` označuje místo, kam se má psát. */
export const MATH_SNIPPETS: { label: string; latex: string; title: string }[] = [
  { label: "a/b", latex: "\\frac{▢}{▢}", title: "Zlomek" },
  { label: "x²", latex: "^{2}", title: "Na druhou" },
  { label: "x³", latex: "^{3}", title: "Na třetí" },
  { label: "xⁿ", latex: "^{▢}", title: "Mocnina" },
  { label: "x₂", latex: "_{▢}", title: "Dolní index" },
  { label: "√x", latex: "\\sqrt{▢}", title: "Odmocnina" },
  { label: "ⁿ√x", latex: "\\sqrt[▢]{▢}", title: "N-tá odmocnina" },
  { label: "·", latex: "\\cdot ", title: "Krát (tečka)" },
  { label: "×", latex: "\\times ", title: "Krát" },
  { label: "÷", latex: "\\div ", title: "Děleno" },
  { label: "±", latex: "\\pm ", title: "Plus minus" },
  { label: "≤", latex: "\\leq ", title: "Menší nebo rovno" },
  { label: "≥", latex: "\\geq ", title: "Větší nebo rovno" },
  { label: "≠", latex: "\\neq ", title: "Nerovná se" },
  { label: "≈", latex: "\\approx ", title: "Přibližně" },
  { label: "π", latex: "\\pi ", title: "Pí" },
  { label: "°", latex: "^{\\circ}", title: "Stupeň" },
  { label: "→", latex: "\\rightarrow ", title: "Šipka (reakce)" },
  { label: "⇌", latex: "\\rightleftharpoons ", title: "Rovnováha" },
  { label: "Δ", latex: "\\Delta ", title: "Delta" },
  { label: "α", latex: "\\alpha ", title: "Alfa" },
  { label: "β", latex: "\\beta ", title: "Beta" },
  { label: "∞", latex: "\\infty ", title: "Nekonečno" },
  { label: "( )", latex: "\\left( ▢ \\right)", title: "Závorky" },
];
