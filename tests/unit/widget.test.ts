import { describe, expect, it } from "vitest";
import { widgetDay, type WidgetRaw } from "@/lib/widget";
import { widgetScript } from "@/lib/widget-script";

const periods = [1, 2, 3].map((n) => ({ lesson_number: n, start_time: `0${7 + n}:00:00`, end_time: `0${7 + n}:45:00` }));
const slot = (day: number, lesson: number, code: string, study_group: "all" | "S1" | "S2" = "all") => ({
  cycle_week: "B", day_of_week: day, lesson_number: lesson, subject_code: code, subject_name: code, teacher: "Učitel", room: "S1" + lesson, study_group,
});
const raw = (over: Partial<WidgetRaw> = {}): WidgetRaw => ({
  group: "S2",
  settings: { classLabel: "I1.M", cycle: ["B"], referenceMonday: "2026-10-12", referenceWeek: "B", visibleFrom: "2026-09-01", visibleTo: "2027-06-30" },
  periods,
  slots: [slot(3, 1, "MAT"), slot(3, 2, "ANG", "S1"), slot(3, 3, "DIG", "S2"), slot(4, 2, "CJL")],
  overrides: [],
  dayOverrides: [],
  holidays: [],
  ...over,
});

describe("widget rozvrhu", () => {
  it("dnes do konce výuky, potom další školní den", () => {
    const morning = widgetDay(raw(), "2026-10-28", 7 * 60)!;
    expect(morning.relative).toBe("Dnes");
    // Skupina S2 nevidí hodinu S1
    expect(morning.lessons.map((l) => l.code)).toEqual(["MAT", "DIG"]);
    const evening = widgetDay(raw(), "2026-10-28", 11 * 60)!;
    expect([evening.date, evening.relative, evening.lessons.map((l) => l.code)]).toEqual(["2026-10-29", "Zítra", ["CJL"]]);
  });

  it("přeskočí víkend a volné dny, odpadlá hodina zůstane v seznamu", () => {
    const friday = raw({
      slots: [slot(1, 1, "EKA"), slot(5, 1, "MAT")],
      holidays: [{ id: "h", kind: "holiday", title: "Podzimní prázdniny", start_date: "2026-11-02", end_date: "2026-11-02" }],
      overrides: [{ id: "o", week_start: "2026-11-02", day_of_week: 5, lesson_number: 1, kind: "cancelled", subject_code: null, subject_name: null, title: null, teacher: null, room: null, note: "nemoc" }],
    });
    const day = widgetDay(friday, "2026-10-30", 12 * 60)!;
    expect(day.date).toBe("2026-11-06");
    expect(day.lessons[0]).toMatchObject({ code: "MAT", status: "cancelled", detail: "nemoc", start: "08:00", end: "08:45" });
  });

  it("bez zvolené skupiny ukáže obě skupiny zvlášť", () => {
    const day = widgetDay(raw({ group: null }), "2026-10-28", 7 * 60)!;
    expect(day.lessons.map((l) => `${l.code}/${l.group}`)).toEqual(["MAT/all", "ANG/S1", "DIG/S2"]);
  });

  it("skript pro Scriptable je platný JavaScript s doplněnou adresou a klíčem", () => {
    const code = widgetScript("https://weilhub.vercel.app/", "K".repeat(43));
    expect(code).toContain('const API = "https://weilhub.vercel.app/api/widget";');
    expect(code).toContain(`const KEY = "${"K".repeat(43)}";`);
    expect(code).not.toContain("__URL__");
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
    expect(() => new AsyncFunction(code)).not.toThrow();
  });
});
