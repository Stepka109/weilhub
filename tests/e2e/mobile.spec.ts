/** 20. Aplikace je použitelná na telefonu. */
import { expect, test } from "@playwright/test";
import { configured, login } from "./helpers";

test("přihlašovací stránka nepřetéká do strany", async ({ page }) => {
  await page.goto("/prihlaseni");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("mobilní navigace a dashboard", async ({ page }) => {
  test.skip(!configured, "Vyžaduje testovací Supabase (viz README).");
  await login(page, "student");
  const nav = page.getByRole("navigation", { name: "Mobilní navigace" });
  await expect(nav).toBeVisible();
  for (const path of ["/", "/predmety", "/ukoly", "/rozvrh", "/kalendar", "/materialy"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Stránka ${path} přetéká do strany`).toBeLessThanOrEqual(0);
  }
  await nav.getByRole("button", { name: "Více" }).click();
  await expect(page.getByRole("dialog", { name: "Další sekce" })).toBeVisible();
});
