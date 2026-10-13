/**
 * Bezpečná práce s obsahem zápisů (TipTap JSON).
 *
 * Obsah se ukládá strukturovaně jako JSON. Při zobrazení jej NEpřevádíme
 * přes `dangerouslySetInnerHTML` z neznámého HTML – vlastní renderer
 * escapuje veškerý text, propouští jen povolené uzly/značky a validuje URL.
 */
import type { TiptapNode } from "./types";
import { INLINE_MATH_IN_TEXT, renderLatex } from "./math";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Povolené odkazy: http(s), mailto, nebo relativní cesty v aplikaci. */
export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const v = href.trim();
  if (/^(https?:|mailto:)/i.test(v)) return v;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return null;
}

/** Obrázky smějí pocházet pouze z interního úložiště (přes autorizovanou routu) nebo https. */
export function safeImageSrc(src: unknown): string | null {
  if (typeof src !== "string") return null;
  const v = src.trim();
  if (/^\/api\/soubory\/[0-9a-f-]{36}(\?[a-z=&0-9]*)?$/i.test(v)) return v;
  if (/^https:\/\//i.test(v)) return v;
  return null;
}

const ALIGN = new Set(["left", "center", "right", "justify"]);

/** Text s případnými vzorci „$…$“ – text se escapuje, vzorce vykreslí KaTeX (bez skriptů a odkazů). */
function renderTextWithMath(text: string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(INLINE_MATH_IN_TEXT)) {
    const rendered = renderLatex(m[1]);
    if (!rendered) continue;
    out += escapeHtml(text.slice(last, m.index)) + rendered;
    last = m.index! + m[0].length;
  }
  return out + escapeHtml(text.slice(last));
}

function renderMarks(text: string, marks: TiptapNode["marks"]): string {
  const isCode = (marks ?? []).some((m) => m.type === "code");
  let html = isCode ? escapeHtml(text) : renderTextWithMath(text);
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case "bold":
        html = `<strong>${html}</strong>`;
        break;
      case "italic":
        html = `<em>${html}</em>`;
        break;
      case "underline":
        html = `<u>${html}</u>`;
        break;
      case "strike":
        html = `<s>${html}</s>`;
        break;
      case "code":
        html = `<code>${html}</code>`;
        break;
      case "highlight":
        html = `<mark>${html}</mark>`;
        break;
      case "superscript":
        html = `<sup>${html}</sup>`;
        break;
      case "subscript":
        html = `<sub>${html}</sub>`;
        break;
      case "link": {
        const href = safeHref(mark.attrs?.href);
        if (href) {
          const external = /^https?:/i.test(href);
          html = `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer nofollow"' : ""}>${html}</a>`;
        }
        break;
      }
      default:
        break; // neznámé značky ignorujeme
    }
  }
  return html;
}

function children(node: TiptapNode, depth: number): string {
  return (node.content ?? []).map((c) => renderNode(c, depth + 1)).join("");
}

function alignStyle(node: TiptapNode): string {
  const a = node.attrs?.textAlign;
  return typeof a === "string" && ALIGN.has(a) && a !== "left" ? ` style="text-align:${a}"` : "";
}

function cellAttrs(node: TiptapNode): string {
  const colspan = Number(node.attrs?.colspan ?? 1);
  const rowspan = Number(node.attrs?.rowspan ?? 1);
  let out = "";
  if (Number.isInteger(colspan) && colspan > 1 && colspan < 50) out += ` colspan="${colspan}"`;
  if (Number.isInteger(rowspan) && rowspan > 1 && rowspan < 50) out += ` rowspan="${rowspan}"`;
  return out;
}

function renderNode(node: TiptapNode, depth = 0): string {
  if (depth > 60) return ""; // ochrana proti extrémně zanořeným dokumentům
  switch (node.type) {
    case "doc":
      return children(node, depth);
    case "text":
      return renderMarks(node.text ?? "", node.marks);
    case "paragraph":
      return `<p${alignStyle(node)}>${children(node, depth)}</p>`;
    case "heading": {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 2)));
      return `<h${level}${alignStyle(node)}>${children(node, depth)}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${children(node, depth)}</ul>`;
    case "orderedList": {
      const start = Number(node.attrs?.start ?? 1);
      return `<ol${Number.isInteger(start) && start !== 1 ? ` start="${start}"` : ""}>${children(node, depth)}</ol>`;
    }
    case "listItem":
      return `<li>${children(node, depth)}</li>`;
    case "blockquote":
      return `<blockquote>${children(node, depth)}</blockquote>`;
    case "codeBlock": {
      const text = (node.content ?? []).map((c) => c.text ?? "").join("");
      return `<pre><code>${escapeHtml(text)}</code></pre>`;
    }
    case "horizontalRule":
      return "<hr />";
    case "hardBreak":
      return "<br />";
    case "inlineMath": {
      const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex : "";
      return `<span class="wh-math">${renderLatex(latex) || escapeHtml(latex)}</span>`;
    }
    case "blockMath": {
      const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex : "";
      return `<div class="wh-math-block">${renderLatex(latex, true) || escapeHtml(latex)}</div>`;
    }
    case "image": {
      const src = safeImageSrc(node.attrs?.src);
      if (!src) return "";
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" />`;
    }
    case "table":
      return `<table><tbody>${children(node, depth)}</tbody></table>`;
    case "tableRow":
      return `<tr>${children(node, depth)}</tr>`;
    case "tableHeader":
      return `<th${cellAttrs(node)}>${children(node, depth)}</th>`;
    case "tableCell":
      return `<td${cellAttrs(node)}>${children(node, depth)}</td>`;
    default:
      // Neznámý uzel: vykreslíme jen jeho obsah (text zůstane escapovaný)
      return children(node, depth);
  }
}

export function renderTiptapHtml(doc: TiptapNode | null | undefined): string {
  if (!doc || typeof doc !== "object") return "";
  return renderNode(doc);
}

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "listItem",
  "blockquote",
  "codeBlock",
  "tableCell",
  "tableHeader",
]);

/** Prostý text pro vyhledávání a náhledy. */
export function tiptapToText(doc: TiptapNode | null | undefined, limit = 50_000): string {
  if (!doc) return "";
  const parts: string[] = [];
  const walk = (n: TiptapNode, depth: number) => {
    if (depth > 60) return;
    if (n.type === "text" && n.text) parts.push(n.text);
    if (n.type === "hardBreak") parts.push(" ");
    if ((n.type === "inlineMath" || n.type === "blockMath") && typeof n.attrs?.latex === "string") parts.push(` ${n.attrs.latex} `);
    for (const c of n.content ?? []) walk(c, depth + 1);
    if (BLOCK_TYPES.has(n.type)) parts.push(" ");
  };
  walk(doc, 0);
  return parts.join("").replace(/\s+/g, " ").trim().slice(0, limit);
}

/** ID souborů vložených do zápisu jako obrázky (/api/soubory/<id>). */
export function inlineFileIds(doc: TiptapNode | null | undefined): string[] {
  const ids = new Set<string>();
  const walk = (n: TiptapNode, depth: number) => {
    if (depth > 60) return;
    if (n.type === "image" && typeof n.attrs?.src === "string") {
      const m = /^\/api\/soubory\/([0-9a-f-]{36})/i.exec(n.attrs.src);
      if (m) ids.add(m[1].toLowerCase());
    }
    for (const c of n.content ?? []) walk(c, depth + 1);
  };
  if (doc) walk(doc, 0);
  return [...ids];
}

/** Hrubá kontrola struktury před uložením. */
export function isTiptapDoc(value: unknown): value is TiptapNode {
  if (!value || typeof value !== "object") return false;
  const v = value as TiptapNode;
  return v.type === "doc" && (v.content === undefined || Array.isArray(v.content));
}
