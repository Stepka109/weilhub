import { expect, type Page } from "@playwright/test";

/**
 * Testovací účty musí existovat v TESTOVACÍ instanci Supabase:
 *  - E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD   (role admin, schválený)
 *  - E2E_STUDENT_EMAIL / E2E_STUDENT_PASSWORD (role student, schválený)
 */
export const env = {
  adminEmail: process.env.E2E_ADMIN_EMAIL ?? "",
  adminPassword: process.env.E2E_ADMIN_PASSWORD ?? "",
  studentEmail: process.env.E2E_STUDENT_EMAIL ?? "",
  studentPassword: process.env.E2E_STUDENT_PASSWORD ?? "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

export const configured = Boolean(env.adminEmail && env.studentEmail && env.supabaseUrl);

export async function login(page: Page, who: "admin" | "student") {
  await page.goto("/prihlaseni");
  await page.getByLabel("E-mail").fill(who === "admin" ? env.adminEmail : env.studentEmail);
  await page.getByLabel("Heslo").fill(who === "admin" ? env.adminPassword : env.studentPassword);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page.getByRole("heading", { name: /^Ahoj,/ })).toBeVisible();
}

export const unique = (prefix: string) => `${prefix} ${Date.now().toString(36)}`;
