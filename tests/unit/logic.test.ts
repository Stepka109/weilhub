import { describe, expect, it } from "vitest";
import { dueInfo, formatDue, schoolWeek } from "@/lib/dates";
import { buildTimetableWeek, cycleWeekFor, effectiveCell, examLessonEnd, isSpan, isSplit, markMatchesCell, placeMarks, rowCells } from "@/lib/timetable";
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

  it("test a úkol se ukážou u první hodiny předmětu v daný den", () => {
    const week = buildTimetableWeek({
      monday: "2026-10-12", config: cfg, periods, overrides: [], dayOverrides: [],
      slots: [slot("B", 1, 1, "EKA"), { ...slot("B", 1, 3, "CHE"), subject_name: "Chemie" }, { ...slot("B", 1, 4, "CHE"), subject_name: "Chemie" }],
    });
    const mark = (kind: "test" | "assignment", subjectAbbr: string, subjectName: string, date = "2026-10-12") =>
      ({ kind, id: subjectAbbr, title: "x", date, subjectAbbr, subjectName, href: "/" });
    const placed = placeMarks(week, [mark("test", "CHE", "Chemie"), mark("assignment", "Ch", "Chemie"), mark("test", "M", "Matematika")]);
    expect(placed.get("2026-10-12:3:all")?.map((m) => m.kind)).toEqual(["test", "assignment"]);
    expect(placed.has("2026-10-12:4:all")).toBe(false);
    expect(placed.size).toBe(1);
    expect(markMatchesCell({ subjectAbbr: "ČJ", subjectName: "Český jazyk" }, { code: "CJL", name: "Český jazyk a literatura" })).toBe(true);
    expect(markMatchesCell({ subjectAbbr: "AJ", subjectName: "Anglický jazyk" }, { code: "CJL", name: "Český jazyk a literatura" })).toBe(false);
  });

  it("skupiny S1 a S2: vlastní hodina má přednost, obě skupiny se zobrazí rozděleně", () => {
    const g = (x: ReturnType<typeof slot>, study_group: "all" | "S1" | "S2") => ({ ...x, study_group });
    const slots = [g(slot("B", 1, 1, "MAT"), "all"), g(slot("B", 1, 2, "DIG", "S205"), "S2"), g(slot("B", 1, 2, "DIG", "S310"), "S1"), g(slot("B", 1, 3, "HDW"), "S2")];
    const overrides = [ov({ week_start: "2026-10-12", day_of_week: 1, lesson_number: 1, kind: "cancelled", study_group: "S2" })];
    const base = { monday: "2026-10-12", config: cfg, periods, slots, overrides, dayOverrides: [] };

    const s1 = buildTimetableWeek({ ...base, group: "S1" }).days[0].items;
    expect(s1.map((i) => (isSpan(i) || isSplit(i) ? "?" : `${i.code || "-"}/${i.group}/${i.status}`))).toEqual([
      "MAT/all/default", "DIG/S1/default", "-/S1/empty",
    ]);
    const s2 = buildTimetableWeek({ ...base, group: "S2" }).days[0].items;
    expect(s2.map((i) => (isSpan(i) || isSplit(i) ? "?" : `${i.code || "-"}/${i.group}/${i.status}`))).toEqual([
      "MAT/S2/cancelled", "DIG/S2/default", "HDW/S2/default",
    ]);

    const both = buildTimetableWeek({ ...base, group: "both" }).days[0];
    expect(both.items.map((i) => (isSplit(i) ? "split" : isSpan(i) ? "span" : i.status))).toEqual(["split", "split", "split"]);
    const [mat, dig, hdw] = both.items.filter(isSplit);
    expect([mat.s1.status, mat.s2.status]).toEqual(["default", "cancelled"]);
    expect([dig.s1.room, dig.s2.room]).toEqual(["S310", "S205"]);
    expect([hdw.s1.status, hdw.s2.code]).toEqual(["empty", "HDW"]);
    expect(rowCells(both)).toHaveLength(6);

    // Bez změny jen pro jednu skupinu je hodina celé třídy jedna karta
    const plain = buildTimetableWeek({ ...base, overrides: [], group: "both" }).days[0].items[0];
    expect(isSplit(plain) || isSpan(plain) ? null : plain.group).toBe("all");
  });

  it("když obě skupiny odpadají nebo mají stejnou akci, je to jedna karta", () => {
    const g = (x: ReturnType<typeof slot>, study_group: "S1" | "S2") => ({ ...x, study_group });
    const slots = [g(slot("B", 1, 1, "DIP"), "S1"), g(slot("B", 1, 1, "WWW"), "S2"), g(slot("B", 1, 2, "DIG"), "S1"), g(slot("B", 1, 2, "DIG", "S205"), "S2"), slot("B", 1, 3, "MAT")];
    const overrides = [
      ov({ week_start: "2026-10-12", day_of_week: 1, lesson_number: 1, kind: "cancelled", study_group: "all" }),
      ov({ week_start: "2026-10-12", day_of_week: 1, lesson_number: 2, kind: "event", subject_code: "TH", title: "Třídnická hodina", study_group: "all" }),
      ov({ week_start: "2026-10-12", day_of_week: 1, lesson_number: 3, kind: "event", subject_code: "TH", title: "Třídnická hodina", study_group: "all" }),
    ];
    const items = buildTimetableWeek({ monday: "2026-10-12", config: cfg, periods, slots, overrides, dayOverrides: [], group: "both" }).days[0].items;
    const [first, second] = items;
    expect(isSplit(first) || isSpan(first) ? null : [first.status, first.group, first.merged]).toEqual(["cancelled", "all", true]);
    // Akce obou skupin navazuje na akci celé třídy → jedna karta přes 2.–3. hodinu
    expect(isSpan(second) && [second.startLesson, second.endLesson]).toEqual([2, 3]);
  });

  it("test proběhne po konci hodiny předmětu (nebo hodiny se zadaným časem)", () => {
    const slots = [slot("B", 1, 1, "EKA"), { ...slot("B", 1, 3, "CHE"), subject_name: "Chemie" }];
    const week = buildTimetableWeek({ monday: "2026-10-12", config: cfg, periods, slots, overrides: [], dayOverrides: [] });
    const exam = { date: "2026-10-12", subjectAbbr: "CH", subjectName: "Chemie", group: null };
    const end3 = week.lessons.find((l) => l.lesson_number === 3)!.end_time;
    expect(examLessonEnd(week, exam)).toBe(end3);
    expect(examLessonEnd(week, { ...exam, time: "08:10" })).toBe("08:45:00");
    // Předmět ten den nemá hodinu → konec posledního vyučování
    expect(examLessonEnd(week, { ...exam, subjectAbbr: "M", subjectName: "Matematika" })).toBe(end3);
    expect(examLessonEnd(week, { ...exam, date: "2026-10-13" })).toBeNull();
  });

  it("značka testu skupiny S1 patří jen k hodině S1", () => {
    const slots = [{ ...slot("B", 1, 2, "ANG", "N108"), subject_name: "Anglický jazyk", study_group: "S1" as const }, { ...slot("B", 1, 3, "ANG", "N312"), subject_name: "Anglický jazyk", study_group: "S2" as const }];
    const week = buildTimetableWeek({ monday: "2026-10-12", config: cfg, periods, slots, overrides: [], dayOverrides: [], group: "both" });
    const mark = (group: "S1" | "S2" | null) => ({ kind: "test" as const, id: String(group), title: "x", date: "2026-10-12", subjectAbbr: "AJ", subjectName: "Anglický jazyk", href: "/", group });
    const placed = placeMarks(week, [mark("S2"), mark(null)]);
    expect([...placed.keys()].sort()).toEqual(["2026-10-12:2:S1", "2026-10-12:3:S2"]);
    expect(placed.get("2026-10-12:3:S2")?.map((m) => m.id)).toEqual(["S2"]);
  });

  it("použije výchozí rozvrh správného týdne cyklu", () => {
    const week = buildTimetableWeek({
      monday: "2026-10-12", config: cfg, periods, overrides: [], dayOverrides: [],
      slots: [slot("B", 1, 1, "EKA"), slot("A", 1, 1, "MAT")],
    });
    expect(week.cycleWeek).toBe("B");
    const first = week.days[0].items[0];
    expect(isSpan(first) || isSplit(first) ? null : first.code).toBe("EKA");
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

describe("vzorce, horní a dolní index", () => {
  it("vykreslí zlomek z uzlu i z textu $…$ a horní/dolní index", () => {
    const html = renderTiptapHtml({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "inlineMath", attrs: { latex: "\\frac{m_s}{m}" } }] },
        { type: "paragraph", content: [{ type: "text", text: "w = $\\frac{250}{1250}$ = 0,2" }] },
        { type: "paragraph", content: [{ type: "text", text: "H" }, { type: "text", text: "2", marks: [{ type: "subscript" }] }, { type: "text", text: "O, x" }, { type: "text", text: "2", marks: [{ type: "superscript" }] }] },
      ],
    });
    expect(html).toContain('class="katex"');
    expect(html).toContain("mfrac");
    expect(html).toContain("<sub>2</sub>");
    expect(html).toContain("<sup>2</sup>");
    expect(html).toContain("w = ");
  });

  it("vzorec nesmí vložit odkaz ani skript", () => {
    const html = renderTiptapHtml({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "inlineMath", attrs: { latex: "\\href{javascript:alert(1)}{x}" } }] },
        { type: "paragraph", content: [{ type: "text", text: "$<img src=x onerror=alert(1)>$" }] },
      ],
    });
    expect(html).not.toMatch(/<a |javascript:|<img/);
  });

  it("částky typu $5$ nechá jako text", () => {
    expect(renderTiptapHtml({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Cena $5$" }] }] })).toBe("<p>Cena $5$</p>");
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
