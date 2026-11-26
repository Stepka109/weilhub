/**
 * Kresby v poznámkách (Apple Pencil, prst, myš). Kresba je uzel „drawing“
 * v obsahu TipTap: plocha široká 1000 jednotek (na každém zařízení se
 * zmenší / zvětší na šířku stránky), výška podle obsahu, a seznam tahů.
 *
 * Tah = nástroj, barva, tloušťka a body [x, y, tlak] uložené úsporně jako
 * celá čísla (souřadnice × 10, tlak × 100) v jednom poli.
 */
import { getStroke } from "perfect-freehand";

export const DRAWING_WIDTH = 1000;
export const MIN_HEIGHT = 200;
export const MAX_HEIGHT = 20000;
export const MAX_STROKES = 6000;
export const MAX_POINTS = 4000;

export type DrawingTool = "pen" | "hl";
export type Paper = "plain" | "lines" | "grid" | "dots";

export interface Stroke {
  /** pen = pero, hl = zvýrazňovač */
  t: DrawingTool;
  /** barva #rrggbb */
  c: string;
  /** tloušťka v jednotkách plochy */
  s: number;
  /** [x·10, y·10, tlak·100, …] */
  p: number[];
}

export interface DrawingAttrs {
  height: number;
  paper: Paper;
  strokes: Stroke[];
}

export const PAPERS: { key: Paper; label: string }[] = [
  { key: "plain", label: "Čistý" },
  { key: "lines", label: "Linky" },
  { key: "grid", label: "Čtverečky" },
  { key: "dots", label: "Tečky" },
];

const COLOR = /^#[0-9a-f]{6}$/i;
const PAPER_KEYS = new Set<Paper>(["plain", "lines", "grid", "dots"]);

/** Bezpečné, ořezané atributy kresby (z databáze nebo od klienta). */
export function normalizeDrawing(raw: unknown): DrawingAttrs {
  const r = (raw ?? {}) as Partial<DrawingAttrs>;
  const height = Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Number(r.height) || 500)));
  const paper = PAPER_KEYS.has(r.paper as Paper) ? (r.paper as Paper) : "plain";
  const strokes: Stroke[] = [];
  for (const s of Array.isArray(r.strokes) ? r.strokes.slice(0, MAX_STROKES) : []) {
    if (!s || (s.t !== "pen" && s.t !== "hl") || typeof s.c !== "string" || !COLOR.test(s.c) || !Array.isArray(s.p)) continue;
    const p = s.p.slice(0, MAX_POINTS * 3).map((v) => Math.round(Number(v) || 0));
    if (p.length < 3) continue;
    strokes.push({ t: s.t, c: s.c.toLowerCase(), s: Math.min(80, Math.max(1, Number(s.s) || 4)), p: p.slice(0, p.length - (p.length % 3)) });
  }
  return { height, paper, strokes };
}

/** Body tahu ve tvaru pro perfect-freehand: [x, y, tlak] */
export function strokePoints(s: Stroke): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i + 2 < s.p.length; i += 3) out.push([s.p[i] / 10, s.p[i + 1] / 10, s.p[i + 2] / 100]);
  return out;
}

/** Obrys tahu jako cesta SVG (vyplněný mnohoúhelník podle tlaku pera). */
export function strokePath(s: Stroke, live = false): string {
  const pts = strokePoints(s);
  if (!pts.length) return "";
  const pressure = pts.some((p) => p[2] > 0 && p[2] !== 0.5);
  const outline = getStroke(pts, {
    size: s.s,
    thinning: s.t === "hl" ? 0 : 0.55,
    smoothing: 0.5,
    streamline: s.t === "hl" ? 0.35 : 0.45,
    simulatePressure: !pressure,
    last: !live,
    start: { cap: true },
    end: { cap: true },
  });
  return svgPath(outline);
}

const avg = (a: number, b: number) => (a + b) / 2;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Plynulá uzavřená cesta z bodů obrysu (kvadratické křivky). */
export function svgPath(points: number[][]): string {
  const len = points.length;
  if (len < 4) return "";
  let a = points[0];
  let b = points[1];
  const c = points[2];
  let d = `M${r1(a[0])},${r1(a[1])} Q${r1(b[0])},${r1(b[1])} ${r1(avg(b[0], c[0]))},${r1(avg(b[1], c[1]))} T`;
  for (let i = 2; i < len - 1; i++) {
    a = points[i];
    b = points[i + 1];
    d += `${r1(avg(a[0], b[0]))},${r1(avg(a[1], b[1]))} `;
  }
  return d + "Z";
}

export const strokeOpacity = (s: Stroke) => (s.t === "hl" ? 0.35 : 1);

/** Pozadí plochy (linky, čtverečky, tečky) jako vzor SVG. */
export function paperPattern(paper: Paper, id: string, line = "#c9d6e3"): string {
  switch (paper) {
    case "lines":
      return `<pattern id="${id}" width="1000" height="40" patternUnits="userSpaceOnUse"><path d="M0 39.5H1000" stroke="${line}" stroke-width="1"/></pattern>`;
    case "grid":
      return `<pattern id="${id}" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0V25M0 25H25" fill="none" stroke="${line}" stroke-width="0.8"/></pattern>`;
    case "dots":
      return `<pattern id="${id}" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="12.5" cy="12.5" r="1.4" fill="${line}"/></pattern>`;
    default:
      return "";
  }
}

let seq = 0;

/** Celá kresba jako SVG (pro zobrazení poznámky a materiálu na serveru). */
export function renderDrawingSvg(raw: unknown): string {
  const d = normalizeDrawing(raw);
  const id = `wh-paper-${++seq}`;
  const pattern = paperPattern(d.paper, id);
  const paths = d.strokes
    .map((s) => {
      const path = strokePath(s);
      if (!path) return "";
      // Barva je ověřená v normalizeDrawing (#rrggbb), cesta jsou jen čísla
      const op = strokeOpacity(s);
      return `<path d="${path}" fill="${s.c}"${op < 1 ? ` fill-opacity="${op}"` : ""}/>`;
    })
    .join("");
  return (
    `<figure class="wh-drawing"><svg viewBox="0 0 ${DRAWING_WIDTH} ${d.height}" role="img" aria-label="Kresba" xmlns="http://www.w3.org/2000/svg">` +
    (pattern ? `<defs>${pattern}</defs><rect width="100%" height="100%" fill="url(#${id})"/>` : "") +
    paths +
    `</svg></figure>`
  );
}

/** Tah, který prochází blízko bodu (pro gumu) – měří vzdálenost od úseček mezi body. */
export function strokeHit(s: Stroke, x: number, y: number, radius: number): boolean {
  const rr = (radius + s.s / 2) ** 2;
  const n = s.p.length;
  for (let i = 0; i + 2 < n; i += 3) {
    const ax = s.p[i] / 10;
    const ay = s.p[i + 1] / 10;
    const bx = i + 5 < n ? s.p[i + 3] / 10 : ax;
    const by = i + 5 < n ? s.p[i + 4] / 10 : ay;
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    const cx = ax + t * dx - x;
    const cy = ay + t * dy - y;
    if (cx * cx + cy * cy <= rr) return true;
  }
  return false;
}
