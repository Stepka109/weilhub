"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_EVENT, THEME_KEY, type ThemePref } from "@/lib/theme";
import { cn } from "@/lib/utils";

function readPref(): ThemePref {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  window.addEventListener(THEME_EVENT, cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener(THEME_EVENT, cb);
  };
}

/** Uložená volba a skutečně použitý vzhled (u „system“ podle zařízení). */
function useTheme() {
  const snapshot = React.useSyncExternalStore(
    subscribe,
    () => `${readPref()}:${window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"}`,
    () => "system:light",
  );
  const [pref, system] = snapshot.split(":") as [ThemePref, "light" | "dark"];
  return { pref, effective: pref === "system" ? system : pref };
}

export function setThemePref(pref: ThemePref) {
  const root = document.documentElement;
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Bez úložiště platí volba jen do zavření stránky
  }
  if (pref === "system") delete root.dataset.theme;
  else root.dataset.theme = pref;
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Tlačítko v liště: přepne mezi světlým a tmavým vzhledem. */
export function ThemeToggle({ className }: { className?: string }) {
  const { effective } = useTheme();
  const dark = effective === "dark";
  return (
    <button
      type="button"
      onClick={() => setThemePref(dark ? "light" : "dark")}
      className={cn(
        "group grid size-10 place-items-center rounded-full border border-line bg-card text-slate-ink shadow-card transition-colors hover:text-primary sm:size-11",
        className,
      )}
      aria-label={dark ? "Přepnout na světlý vzhled" : "Přepnout na tmavý vzhled"}
      title={dark ? "Světlý vzhled" : "Tmavý vzhled"}
    >
      {dark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}

const OPTIONS: { pref: ThemePref; label: string; icon: typeof Sun }[] = [
  { pref: "system", label: "Podle zařízení", icon: Monitor },
  { pref: "light", label: "Světlý", icon: Sun },
  { pref: "dark", label: "Tmavý", icon: Moon },
];

/** Volba vzhledu v Nastavení. */
export function ThemeChoice() {
  const { pref } = useTheme();
  return (
    <div role="radiogroup" aria-label="Vzhled" className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-card p-1">
      {OPTIONS.map((o) => {
        const active = pref === o.pref;
        return (
          <button
            key={o.pref}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setThemePref(o.pref)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:bg-slate-soft hover:text-ink",
            )}
          >
            <o.icon className="size-4" aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
