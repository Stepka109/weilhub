/**
 * Novinky v aplikaci (okno „i“ v horní liště). Při každém vydání stačí
 * změnit `id` a seznam – ikonka se pak každému znovu ukáže, dokud novinky
 * neodklikne (uloží se k účtu v předvolbách jako `newsSeen`).
 */
export interface NewsItem {
  icon: "moon" | "bell" | "calendar" | "palette" | "shield";
  title: string;
  text: string;
  href?: string;
  cta?: string;
}

export const NEWS: { id: string; title: string; items: NewsItem[] } = {
  id: "2026-11-29",
  title: "Co je nového ve WeilHubu",
  items: [
    {
      icon: "moon",
      title: "Světlý a tmavý vzhled",
      text: "Přepínej tlačítkem se sluncem a měsícem vedle této ikonky, nebo nech vzhled podle nastavení zařízení.",
      href: "/nastaveni#vzhled",
      cta: "Nastavit vzhled",
    },
    {
      icon: "bell",
      title: "Upozornění do telefonu",
      text: "Dáme ti vědět o novém testu, úkolu, oznámení nebo změně v rozvrhu. Na iPhonu funguje ve WeilHubu přidaném na plochu.",
      href: "/nastaveni#upozorneni",
      cta: "Zapnout upozornění",
    },
    {
      icon: "calendar",
      title: "Události a termíny",
      text: "V oznámeních najdeš, co se kdy chystá (třeba hospitace) a co je potřeba do kdy udělat nebo rozhodnout.",
      href: "/oznameni",
      cta: "Zobrazit oznámení",
    },
    {
      icon: "palette",
      title: "Barvy Weilovky",
      text: "WeilHub má nové barvy podle loga školy. Rozvrh zůstal, jak ho znáš.",
    },
  ],
};
