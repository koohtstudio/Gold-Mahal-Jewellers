import { defineConfig, devices } from "@playwright/test";

/** Runs against a deployed or local site that is in demo mode (shared Neon data). No web server is started.
 *  DEMO_URL=https://... pnpm exec playwright test -c playwright.demo.config.ts */
export default defineConfig({
  testDir: "./tests/demo",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: "list",
  use: { baseURL: process.env.DEMO_URL ?? "http://localhost:3138", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
