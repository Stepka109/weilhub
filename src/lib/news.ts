import { DARK_MODE_ENABLED } from "./theme";

/**
 * Novinky v aplikaci (okno „i“ v horní liště). Při každém vydání stačí
 * změnit `id` a seznam – ikonka se pak každému znovu ukáže, dokud novinky
 * neodklikne (uloží se k účtu v předvolbách jako `newsSeen`).
 */
export interface NewsItem {
  icon: "moon" | "bell" | "calendar" | "palette" | "shield" | "notebook" | "utensils" | "vote" | "clock" | "phone";
  title: string;
  text: string;
  href?: string;
  cta?: string;
}

export const NEWS: { id: string; title: string; items: NewsItem[] } = {
  id: "2026-12-prosinec",
  title: "Prosincová aktualizace",
  items: [
    {
      icon: "notebook",
      title: "Vlastní poznámkový blok",
      text: "Poznámky ke každému předmětu: piš na klávesnici, kresli perem (Apple Pencil) nebo prstem a vkládej obrázky. Jsou jen tvoje, dokud je nesdílíš.",
      href: "/poznamky",
      cta: "Otevřít poznámky",
    },
    {
      icon: "utensils",
      title: "Jídelna",
      text: "Co je k obědu najdeš rovnou na nástěnce, celý jídelníček v sekci Jídelna.",
      href: "/jidelna",
      cta: "Zobrazit jídelníček",
    },
    {
      icon: "calendar",
      title: "Testy a úkoly ve tvém kalendáři",
      text: "Propoj WeilHub s Google, Apple nebo Outlook kalendářem – testy, úkoly a akce se doplní samy, i s připomenutím večer předem.",
      href: "/nastaveni",
      cta: "Propojit kalendář",
    },
    {
      icon: "vote",
      title: "Hlasování",
      text: "Ankety pro třídu – hlasuješ přímo na nástěnce a hned vidíš výsledky.",
      href: "/hlasovani",
      cta: "Zobrazit hlasování",
    },
    {
      icon: "clock",
      title: "Úkoly, odpočet a rozvrh",
      text: "Úkol otevřeš v okně se zadáním a pruhem, kolik zbývá do termínu. Na nástěnce běží odpočet do konce hodiny a v rozvrhu je dnešní den i probíhající hodina zvýrazněná oranžově.",
      href: "/ukoly",
      cta: "Zobrazit úkoly",
    },
    {
      icon: "phone",
      title: "Widgety pro iPhone i Android",
      text: "Rozvrh a nově i jídelníček na ploše telefonu – v barvách Weilovky a i v tmavém vzhledu. Pro Android je aplikace WeilHub.",
      href: "/nastaveni",
      cta: "Nastavit widget",
    },
  ].filter((item) => DARK_MODE_ENABLED || item.icon !== "moon") as NewsItem[],
};
