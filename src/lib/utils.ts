import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** „Tvorba webových stránek“ → „tvorba-webovych-stranek“ */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} MB`;
}

/** České skloňování: plural(3, ["materiál", "materiály", "materiálů"]) */
export function plural(n: number, forms: [string, string, string]): string {
  if (n === 1) return forms[0];
  if (n >= 2 && n <= 4) return forms[1];
  return forms[2];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Bezpečná validace externí URL (jen http/https, bez přihlašovacích údajů). */
export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password && !!url.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Úryvek textu kolem hledaného výrazu (bez ohledu na diakritiku). */
export function makeSnippet(text: string, query: string, radius = 70): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  // Odstranění diakritiky zachovává délku řetězce u běžných českých znaků
  const idx = fold(clean).indexOf(fold(query.trim()));
  if (idx < 0) return clean.slice(0, radius * 2) + (clean.length > radius * 2 ? "…" : "");
  const start = Math.max(0, idx - radius);
  const end = Math.min(clean.length, idx + query.length + radius);
  return (start > 0 ? "…" : "") + clean.slice(start, end) + (end < clean.length ? "…" : "");
}

export function firstError(fieldErrors: Record<string, string[] | undefined> | undefined): string | undefined {
  if (!fieldErrors) return undefined;
  for (const v of Object.values(fieldErrors)) if (v?.length) return v[0];
  return undefined;
}
