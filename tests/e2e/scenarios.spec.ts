/**
 * Hlavní uživatelské scénáře (zadání, kap. 31). Testy vytvářejí vlastní
 * data s unikátním názvem, takže je lze pouštět opakovaně.
 */
import path from "node:path";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { configured, env, login, unique } from "./helpers";

test.skip(!configured, "E2E testy vyžadují testovací Supabase a účty (viz README).");
test.describe.configure({ mode: "serial" });

const subjectName = unique("E2E předmět");
const noteTitle = unique("E2E zápis");
const pdfTitle = unique("E2E PDF");
const assignmentTitle = unique("E2E úkol");
const examTitle = unique("E2E test");

function isoInDays(days: number) {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

test("7. admin přidá předmět", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/predmety");
  await page.getByRole("button", { name: "Nový předmět" }).click();
  await page.getByLabel("Název předmětu").fill(subjectName);
  await page.getByLabel("Zkratka").fill("E2E");
  await page.getByRole("button", { name: "Vytvořit předmět" }).click();
  await expect(page.getByText(subjectName)).toBeVisible();
});

test("8 + 10. admin vytvoří zápis a publikuje ho", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/materialy/novy");
  await page.getByLabel("Název materiálu").fill(noteTitle);
  await page.getByLabel("Předmět").selectOption({ label: subjectName });
  await page.getByRole("textbox", { name: "Obsah zápisu" }).click();
  await page.keyboard.type("Hledatelný obsah zápisu: kvantový procesor.");
  await page.getByRole("button", { name: "Publikovat" }).click();
  await expect(page.getByText("Materiál byl publikován.")).toBeVisible();
});

test("9. admin nahraje PDF", async ({ page }) => {
  const dir = mkdtempSync(path.join(tmpdir(), "weilhub-"));
  const file = path.join(dir, "ukazka.pdf");
  writeFileSync(file, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

  await login(page, "admin");
  await page.goto("/admin/materialy/novy");
  await page.getByLabel("Název materiálu").fill(pdfTitle);
  await page.getByLabel("Předmět").selectOption({ label: subjectName });
  await page.getByRole("radio", { name: /Soubor/ }).click();
  await page.getByLabel("Nahrajte soubor materiálu").setInputFiles(file);
  await expect(page.getByText("ukazka.pdf")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Publikovat" }).click();
  await expect(page.getByText("Materiál byl publikován.")).toBeVisible();
});

test("9b. podvržený soubor (HTML s příponou .pdf) je odmítnut", async ({ page }) => {
  const dir = mkdtempSync(path.join(tmpdir(), "weilhub-"));
  const file = path.join(dir, "podvrh.pdf");
  writeFileSync(file, "<html><script>alert(1)</script></html>");

  await login(page, "admin");
  await page.goto("/admin/materialy/novy");
  await page.getByLabel("Název materiálu").fill(unique("E2E podvrh"));
  await page.getByLabel("Předmět").selectOption({ label: subjectName });
  await page.getByRole("radio", { name: /Soubor/ }).click();
  await page.getByLabel("Nahrajte soubor materiálu").setInputFiles(file);
  await expect(page.getByText(/neodpovídá typu/)).toBeVisible({ timeout: 20_000 });
});

test("12. admin vytvoří úkol s termínem", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/ukoly/novy");
  await page.getByLabel("Název úkolu").fill(assignmentTitle);
  await page.getByLabel("Předmět").selectOption({ label: subjectName });
  await page.getByLabel("Termín odevzdání").fill(isoInDays(2));
  await page.getByRole("button", { name: "Publikovat" }).click();
  await expect(page.getByText("Úkol je publikovaný.")).toBeVisible();
});

test("14. admin vytvoří a upraví termín testu", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/testy");
  await page.getByRole("button", { name: "Nový test" }).click();
  await page.getByLabel("Název testu").fill(examTitle);
  await page.getByLabel("Předmět").selectOption({ label: subjectName });
  await page.getByLabel("Datum").fill(isoInDays(5));
  await page.getByRole("button", { name: "Vytvořit test" }).click();
  await expect(page.getByRole("button", { name: examTitle })).toBeVisible();

  await page.getByRole("button", { name: examTitle }).click();
  await page.getByLabel("Datum").fill(isoInDays(3));
  await page.getByRole("button", { name: "Uložit změny" }).click();
  await expect(page.getByText("Test byl uložen.")).toBeVisible();
});

test("1–6, 11, 13, 15. student vidí publikovaný obsah a pracuje s ním", async ({ page }) => {
  await login(page, "student");

  // 2. seznam předmětů
  await page.goto("/predmety");
  await page.getByRole("link", { name: new RegExp(subjectName) }).click();

  // 11. publikovaný materiál je vidět, 3. otevře materiál
  await page.getByRole("link", { name: new RegExp(noteTitle) }).click();
  await expect(page.getByText("kvantový procesor")).toBeVisible();

  // 4. stáhne povolený soubor
  await page.goto("/materialy");
  await page.getByRole("link", { name: new RegExp(pdfTitle) }).click();
  const response = await page.request.get(await page.getByRole("link", { name: "Stáhnout" }).first().getAttribute("href") ?? "", { maxRedirects: 0 });
  expect(response.status()).toBe(302);

  // 5. vyhledávání (bez diakritiky)
  await page.keyboard.press("Control+k");
  await page.getByLabel("Hledaný výraz").fill("kvantovy procesor");
  await expect(page.getByRole("option", { name: new RegExp(noteTitle) })).toBeVisible();
  await page.keyboard.press("Escape");

  // 13. úkol na dashboardu i v kalendáři
  await page.goto("/");
  await expect(page.getByText(assignmentTitle)).toBeVisible();
  await page.goto(`/kalendar?zobrazeni=seznam&datum=${isoInDays(2)}`);
  await expect(page.getByText(assignmentTitle)).toBeVisible();

  // 15. upravený termín testu se projeví v přehledu testů
  await page.goto("/testy");
  await expect(page.getByText(examTitle)).toBeVisible();

  // 6. označí úkol jako splněný
  await page.goto("/ukoly");
  await page.getByRole("checkbox", { name: new RegExp(assignmentTitle) }).click();
  await expect(page.getByText("Úkol označen jako splněný")).toBeVisible();
  await page.goto("/ukoly?filtr=splnene");
  await expect(page.getByText(assignmentTitle)).toBeVisible();
});

test("16. student se nedostane do administrace", async ({ page }) => {
  await login(page, "student");
  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin/);
});

test("17. student nemůže přímo přes API změnit obsah", async () => {
  const supabase = createClient(env.supabaseUrl, env.supabaseKey);
  const { error: loginError } = await supabase.auth.signInWithPassword({ email: env.studentEmail, password: env.studentPassword });
  expect(loginError).toBeNull();
  const { data: subject } = await supabase.from("subjects").select("id").limit(1).single();

  const insert = await supabase.from("materials").insert({ subject_id: subject!.id, title: "Hack", status: "published" });
  expect(insert.error).not.toBeNull();

  const update = await supabase.from("materials").update({ title: "Hack" }).neq("id", "00000000-0000-0000-0000-000000000000").select();
  expect(update.data ?? []).toHaveLength(0);

  const role = await supabase.from("profiles").update({ role: "admin" }).eq("id", (await supabase.auth.getUser()).data.user!.id);
  expect(role.error).not.toBeNull();
});

test("18. neověřený uživatel nemůže stáhnout soukromý soubor", async ({ request }) => {
  const res = await request.get("/api/soubory/00000000-0000-4000-8000-000000000000", { maxRedirects: 0 });
  expect([401, 302, 307]).toContain(res.status());
  const supabase = createClient(env.supabaseUrl, env.supabaseKey);
  const { data } = await supabase.storage.from("materials").list("materials");
  expect(data ?? []).toHaveLength(0);
});

test("19. koncepty nejsou viditelné studentům", async ({ page }) => {
  const draft = unique("E2E koncept");
  await login(page, "admin");
  await page.goto("/admin/materialy/novy");
  await page.getByLabel("Název materiálu").fill(draft);
  await page.getByLabel("Předmět").selectOption({ label: subjectName });
  await page.getByRole("button", { name: "Uložit koncept" }).click();
  await expect(page.getByText("Koncept byl uložen.")).toBeVisible();
  const url = page.url();
  const id = url.split("/").pop();

  await page.context().clearCookies();
  await login(page, "student");
  await page.goto(`/materialy/${id}`);
  await expect(page.getByRole("heading", { name: "Stránka nebyla nalezena" })).toBeVisible();
});
