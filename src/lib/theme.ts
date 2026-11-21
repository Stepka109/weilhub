/**
 * Světlý / tmavý vzhled. Volba se ukládá jen v zařízení (localStorage);
 * bez volby se vzhled řídí nastavením zařízení (prefers-color-scheme).
 * Atribut data-theme na <html> nastaví skript ještě před vykreslením,
 * aby stránka při načtení neproblikla světle.
 */
export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "wh-theme";
export const THEME_EVENT = "wh-theme-change";

export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
