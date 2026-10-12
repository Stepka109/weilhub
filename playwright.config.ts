import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end testy běží proti skutečné (testovací!) instanci Supabase.
 * Potřebné proměnné prostředí jsou popsané v README (sekce Testy).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "cs-CZ",
    timezoneId: "Europe/Prague",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobil", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000/prihlaseni", reuseExistingServer: true, timeout: 120_000 },
});
