import { describe, expect, it } from "vitest";
import { normalizeDrawing, renderDrawingSvg, strokeHit, strokePath } from "@/lib/drawing";
import { renderTiptapHtml, safeImageSrc } from "@/lib/tiptap";

const stroke = (extra: Record<string, unknown> = {}) => ({ t: "pen", c: "#1F2937", s: 4, p: [100, 100, 50, 500, 500, 60, 900, 300, 70], ...extra });

describe("kresby v poznámkách", () => {
  it("normalizace ořeže a zahodí neplatné tahy", () => {
    const d = normalizeDrawing({
      height: 99999999,
      paper: "evil",
      strokes: [stroke(), stroke({ c: "red;onload=alert(1)" }), stroke({ t: "brush" }), stroke({ p: [1, 2] }), "x"],
    });
    expect(d.height).toBe(20000);
    expect(d.paper).toBe("plain");
    expect(d.strokes).toHaveLength(1);
    expect(d.strokes[0].c).toBe("#1f2937");
  });

  it("tah se vykreslí jako uzavřená cesta SVG", () => {
    const path = strokePath(normalizeDrawing({ strokes: [stroke()] }).strokes[0]);
    expect(path.startsWith("M")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
    expect(path).toMatch(/^[MQTZ0-9.,\s-]+$/);
  });

  it("guma najde tah blízko bodu", () => {
    const s = normalizeDrawing({ strokes: [stroke()] }).strokes[0];
    expect(strokeHit(s, 50, 50, 10)).toBe(true);
    expect(strokeHit(s, 300, 900, 10)).toBe(false);
  });

  it("v zápisu se kresba vykreslí bezpečně jako SVG s papírem", () => {
    const html = renderTiptapHtml({
      type: "doc",
      content: [{ type: "drawing", attrs: { height: 400, paper: "grid", strokes: [stroke(), stroke({ c: "#000\"/><script>" })] } }],
    });
    expect(html).toContain('<figure class="wh-drawing"><svg viewBox="0 0 1000 400"');
    expect(html).toContain("<pattern");
    expect(html).toContain('fill="#1f2937"');
    expect(html).not.toContain("<script");
    expect(renderDrawingSvg(null)).toContain('viewBox="0 0 1000 500"');
  });

  it("obrázky z poznámek mají povolenou vlastní adresu", () => {
    expect(safeImageSrc("/api/poznamky/obrazek/0d24486e-d873-4f63-8550-f7879d705d96")).not.toBeNull();
    expect(safeImageSrc("/api/poznamky/obrazek/../../etc")).toBeNull();
  });
});
