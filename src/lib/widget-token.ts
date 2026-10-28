import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Osobní klíč widgetu: 32 náhodných bajtů (base64url). V databázi je jen jeho otisk. */
export function newWidgetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function widgetTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const isWidgetToken = (v: string) => /^[A-Za-z0-9_-]{43}$/.test(v);
