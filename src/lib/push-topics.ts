/** Druhy push upozornění, které si student může zapnout či vypnout. */
export type PushTopic = "tests" | "assignments" | "announcements" | "timetable" | "materials";

export const PUSH_TOPICS: { key: PushTopic; label: string; hint: string }[] = [
  { key: "tests", label: "Testy", hint: "Nový test nebo písemka" },
  { key: "assignments", label: "Úkoly", hint: "Nový domácí úkol" },
  { key: "announcements", label: "Oznámení a události", hint: "Oznámení, události a termíny" },
  { key: "timetable", label: "Změny v rozvrhu", hint: "Odpadlé hodiny, suplování, akce (tento a příští týden)" },
  { key: "materials", label: "Materiály", hint: "Nový zápis nebo soubor" },
];
