import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { buildCalendar, foldLine, icsText } from "@/lib/ical";
import { canteenDayFor, parseMenu } from "@/lib/canteen";

describe("kalendář iCalendar", () => {
  const feed = {
    class_label: "I1.M",
    exams: [{ id: "e1", title: "Goniometrie", date: "2026-11-27", time: "08:00", scope: "sin, cos; tabulky", subject: "MAT", group: null, updated_at: "2026-11-20T10:00:00Z" }],
    assignments: [
      { id: "a1", title: "Rozbor Máje", date: "2026-11-28", time: null, instructions: "Jedna strana A4", subject: "ČJL", group: "S2", updated_at: "2026-11-20T10:00:00Z", done: true },
    ],
    events: [{ id: "v1", title: "Vánoční prázdniny", kind: "holiday", start_date: "2026-12-23", end_date: "2027-01-03", time: null, description: "", updated_at: "2026-11-01T00:00:00Z" }],
    notices: [],
  };
  const ics = buildCalendar(feed, "https://weilhub.vercel.app/");

  it("vytvoří platný kalendář s testem, úkolem a volnem", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:WeilHub · I1.M");
    // Test v 8:00 trvá 45 min, připomenutí v 18:00 předchozího dne (14 h předem)
    expect(ics).toContain("DTSTART;TZID=Europe/Prague:20261127T080000");
    expect(ics).toContain("DTEND;TZID=Europe/Prague:20261127T084500");
    expect(ics).toContain("TRIGGER:-PT14H");
    expect(ics).toContain(String.raw`DESCRIPTION:sin\, cos\; tabulky`);
    // Splněný úkol celodenní, se zatržítkem a bez připomenutí
    expect(ics).toContain("SUMMARY:✓ Úkol ČJL: Rozbor Máje (S2)");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261128");
    expect(ics).toContain("DTEND;VALUE=DATE:20261129");
    // Volno přes více dní: konec je den po posledním dni
    expect(ics).toContain("SUMMARY:Volno: Vánoční prázdniny");
    expect(ics).toContain("DTEND;VALUE=DATE:20270104");
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(3);
    expect((ics.match(/BEGIN:VALARM/g) ?? []).length).toBe(1);
  });

  it("řádky nejsou delší než 75 bajtů a text je escapovaný", () => {
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(icsText(String.raw`a,b;c\d` + "\ne")).toBe(String.raw`a\,b\;c\\d\ne`);
    const long = foldLine("SUMMARY:" + "ž".repeat(60));
    expect(long.split("\r\n ").join("")).toBe("SUMMARY:" + "ž".repeat(60));
  });
});

describe("jídelníček ze Strava.cz", () => {
  const raw = {
    meals: {
      table0: [
        { datum: "26.11.2026", druh_popis: "Oběd 1 ", druh_chod: "Oběd", nazev: "Vepřové nudličky", polevka: "N", alergeny: [["03", "Vejce"]] },
        { datum: "26.11.2026", druh_popis: "Polévka ", druh_chod: "Oběd", nazev: "Žampionový krém", polevka: "A", alergeny: [["01", "Lepek"]] },
        { datum: "26.11.2026", druh_popis: "Snídaně ", druh_chod: "Snídaně", nazev: "Ořechový pletenec", polevka: "N", alergeny: [] },
      ],
      table1: [{ datum: "27.11.2026", druh_popis: "Oběd 1 ", druh_chod: "Oběd", nazev: "Guláš", polevka: "N", alergeny: [] }],
    },
  };

  it("seřadí dny a jídla (polévka, obědy, snídaně)", () => {
    const menu = parseMenu(raw);
    expect(menu.map((d) => d.date)).toEqual(["2026-11-26", "2026-11-27"]);
    expect(menu[0].dishes.map((d) => [d.kind, d.label, d.name])).toEqual([
      ["soup", "Polévka", "Žampionový krém"],
      ["main", "Oběd 1", "Vepřové nudličky"],
      ["breakfast", "Snídaně", "Ořechový pletenec"],
    ]);
    expect(menu[0].dishes[1].allergens).toEqual([{ code: "03", name: "Vejce" }]);
    expect(parseMenu({ state: "error" })).toEqual([]);
  });

  it("na nástěnce dnešek do 14:30, potom další den", () => {
    const menu = parseMenu(raw);
    expect(canteenDayFor(menu, "2026-11-26", 11 * 60)?.date).toBe("2026-11-26");
    expect(canteenDayFor(menu, "2026-11-26", 15 * 60)?.date).toBe("2026-11-27");
    expect(canteenDayFor(menu, "2026-11-28", 9 * 60)).toBeNull();
  });
});
