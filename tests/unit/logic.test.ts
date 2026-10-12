import { describe, expect, it } from "vitest";
import { dueInfo, formatDue, schoolWeek } from "@/lib/dates";
import { buildTimetableWeek, cycleWeekFor, effectiveCell, isSpan } from "@/lib/timetable";
import { matchesSignature, validateFileMeta, sanitizeFileName } from "@/lib/files";
import { renderTiptapHtml, safeHref, safeImageSrc, tiptapToText, inlineFileIds } from "@/lib/tiptap";
import { isSafeExternalUrl, makeSnippet, slugify } from "@/lib/utils";


describe("termíny úkolů", () => {
  it("štítky Dnes / Zítra / Za N dní / Po termínu", () => {
    expect(dueInfo("2026-10-12", "2026-10-12").label).toBe("Dnes");
    expect(dueInfo("2026-10-13", "2026-10-12").label).toBe("Zítra");
    expect(dueInfo("2026-10-15", "2026-10-12").label).toBe("Za 3 dny");
    expect(dueInfo("2026-10-20", "2026-10-12").label).toBe("Za 8 dní");
    expect(dueInfo("2026-10-11", "2026-10-12")).toMatchObject({ tone: "overdue", label: "Po termínu (včera)" });
    expect(dueInfo("2026-10-02", "2026-10-12").label).toBe("Po termínu (10 dní)");
  });

  it("bez času se čas nevymýšlí (žádné 23:59)", () => {
    expect(formatDue("2026-10-13", null)).not.toMatch(/\d:\d\d/);
    expect(formatDue("2026-10-13", "08:00:00")).toMatch(/v 8:00$/);
  });
});

describe("rozvrh se střídáním týdnů", () => {
  const cfg = { cycle: ["A", "E", "B", "F"], referenceMonday: "2026-09-14", referenceWeek: "B" };
  const periods = [1, 2, 3, 4].map((n) => ({ lesson_number: n, start_time: `0${7 + n}:00:00`, end_time: `0${7 + n}:45:00` }));
  const slot = (cycle: string, day: number, lesson: number, code: string, room = "S113", teacher = "Ing. Vlasáková") => ({
    cycle_week: cycle, day_of_week: day, lesson_number: lesson, subject_code: code, subject_name: code, teacher, room,
  });
  const ov = (o: Partial<import("@/lib/timetable").Override>) => ({
    id: Math.random().toString(), week_start: "2026-10-12", day_of_week: 1, lesson_number: 1, kind: "changed" as const,
    subject_code: null, subject_name: null, title: null, teacher: null, room: null, note: null, ...o,
  });

  it("týdny se střídají A → E → B → F (14. 9. 2026 = B)", () => {
    expect(cycleWeekFor("2026-08-31", cfg)).toBe("A");
    expect(cycleWeekFor("2026-09-07", cfg)).toBe("E");
    expect(cycleWeekFor("2026-09-14", cfg)).toBe("B");
    expect(cycleWeekFor("2026-09-21", cfg)).toBe("F");
    expect(cycleWeekFor("2026-09-28", cfg)).toBe("A");
    expect(cycleWeekFor("2026-10-12", cfg)).toBe("B");
    expect(cycleWeekFor("2026-08-24", cfg)).toBe("F");
  });

  it("použije výchozí rozvrh správného týdne cyklu", () => {
    const week = buildTimetableWeek({
      monday: "2026-10-12", config: cfg, periods, overrides: [], dayOverrides: [],
      slots: [slot("B", 1, 1, "EKA"), slot("A", 1, 1, "MAT")],
    });
    expect(week.cycleWeek).toBe("B");
    const first = week.days[0].items[0];
    expect(isSpan(first) ? null : first.code).toBe("EKA");
  });

  it("rozliší suplování, změnu místnosti, novou hodinu a odpadlou hodinu", () => {
    const base = slot("B", 1, 1, "EKA");
    expect(effectiveCell(1, 1, base, ov({ kind: "changed", subject_code: "DIG", teacher: "Mgr. Studená" })).status).toBe("changed");
    const room = effectiveCell(1, 1, base, ov({ kind: "changed", subject_code: "EKA", room: "N206" }));
    expect(room).toMatchObject({ status: "roomchanged", room: "N206" });
    expect(effectiveCell(1, 2, null, ov({ kind: "new", subject_code: "HDW" })).status).toBe("new");
    expect(effectiveCell(1, 1, base, ov({ kind: "cancelled" })).status).toBe("cancelled");
    expect(effectiveCell(1, 1, null, ov({ kind: "cancelled" })).status).toBe("empty");
    expect(effectiveCell(1, 1, base, ov({ kind: "cancelled", accent: "green" })).override?.accent).toBe("green");
  });

  it("navazující stejné akce spojí do jedné karty", () => {
    const week = buildTimetableWeek({
      monday: "2026-10-12", config: cfg, periods, dayOverrides: [],
      slots: [1, 2, 3, 4].map((l) => slot("B", 1, l, "EKA")),
      overrides: [1, 2, 3].map((l) => ov({ lesson_number: l, kind: "event", subject_code: "AKT", title: "Akce třídy" })),
    });
    const items = week.days[0].items;
    expect(items).toHaveLength(2);
    expect(isSpan(items[0]) && items[0].length).toBe(3);
  });

  it("celodenní záznam a období zobrazení", () => {
    const week = buildTimetableWeek({
      monday: "2026-08-31", config: cfg, periods, overrides: [], slots: [slot("A", 1, 1, "EKA")],
      dayOverrides: [{ id: "d", date: "2026-08-31", kind: "holiday", title: "Hlavní prázdniny", room: null, teacher: null }],
      visibleFrom: "2026-09-01", visibleTo: "2027-06-30",
    });
    expect(week.days[0].dayOverride?.title).toBe("Hlavní prázdniny");
    expect(week.days[0].outsidePeriod).toBe(true);
    expect(week.days[1].outsidePeriod).toBe(false);
  });

  it("školní týden pondělí–pátek", () => {
    expect(schoolWeek("2026-10-15")).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
  });
});

describe("soubory", () => {
  it("ověřuje skutečný typ souboru podle obsahu", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7\n");
    expect(matchesSignature("pdf", pdf)).toBe(true);
    expect(matchesSignature("png", pdf)).toBe(false);
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    expect(matchesSignature("pdf", html)).toBe(false);
    expect(matchesSignature("docx", new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
    expect(matchesSignature("txt", new Uint8Array([0x41, 0x00, 0x42]))).toBe(false);
    expect(matchesSignature("txt", new TextEncoder().encode("Příliš žluťoučký kůň"))).toBe(true);
  });

  it("kontroluje příponu a velikost", () => {
    const allowed = ["pdf", "png"];
    expect(validateFileMeta("a.pdf", 100, allowed, 10)).toBeNull();
    expect(validateFileMeta("a.exe", 100, allowed, 10)).toMatch(/není povolený/);
    expect(validateFileMeta("a.docx", 100, allowed, 10)).toMatch(/není povolený/);
    expect(validateFileMeta("a.pdf", 11 * 1024 * 1024, allowed, 10)).toMatch(/příliš velký/);
  });

  it("čistí název souboru", () => {
    expect(sanitizeFileName('..\\..\\x"<y>.pdf')).toBe(".._.._x__y_.pdf");
  });
});

describe("bezpečné vykreslení zápisů", () => {
  it("escapuje text a zahazuje nebezpečné odkazy a obrázky", () => {
    const html = renderTiptapHtml({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "<img src=x onerror=alert(1)>" }] },
        { type: "paragraph", content: [{ type: "text", text: "klik", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
        { type: "image", attrs: { src: "javascript:alert(1)" } },
        { type: "image", attrs: { src: "http://evil.cz/a.png\" onerror=\"x" } },
        { type: "evilNode", content: [{ type: "text", text: "ok" }] },
      ],
    });
    expect(html).not.toMatch(/<img/);
    expect(html).not.toMatch(/javascript:/);
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("ok");
  });

  it("povolí bezpečné odkazy a interní obrázky", () => {
    expect(safeHref("https://bakalari.cz")).toBe("https://bakalari.cz");
    expect(safeHref("/materialy")).toBe("/materialy");
    expect(safeHref("//evil.cz")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeImageSrc("/api/soubory/123e4567-e89b-12d3-a456-426614174000")).not.toBeNull();
    expect(safeImageSrc("/api/jine/123")).toBeNull();
  });

  it("vytáhne prostý text a vložené soubory", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Nadpis" }] },
        { type: "paragraph", content: [{ type: "text", text: "Text" }] },
        { type: "image", attrs: { src: "/api/soubory/123e4567-e89b-12d3-a456-426614174000" } },
      ],
    };
    expect(tiptapToText(doc)).toBe("Nadpis Text");
    expect(inlineFileIds(doc)).toEqual(["123e4567-e89b-12d3-a456-426614174000"]);
  });
});

describe("pomocné funkce", () => {
  it("slug bez diakritiky", () => {
    expect(slugify("Tvorba webových stránek")).toBe("tvorba-webovych-stranek");
    expect(slugify("Český jazyk")).toBe("cesky-jazyk");
  });
  it("validace externích odkazů", () => {
    expect(isSafeExternalUrl("https://www.bakalari.cz/")).toBe(true);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("https://user:pass@evil.cz")).toBe(false);
    expect(isSafeExternalUrl("ftp://x.cz")).toBe(false);
  });
  it("úryvek najde výraz bez ohledu na diakritiku", () => {
    expect(makeSnippet("Převody mezi číselnými soustavami", "ciselnymi", 5)).toContain("číselnými");
  });
});
