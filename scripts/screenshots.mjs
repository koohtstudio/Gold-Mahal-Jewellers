// Captures the screenshots in docs/screenshots. Usage: BASE_URL=https://your-site pnpm screenshots
// In demo mode it uses its own room (?room=shots) so it never touches the pitch data.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = (process.env.BASE_URL ?? "http://localhost:3137").replace(/\/$/, "");
const room = process.env.ROOM ?? "shots";
const out = "docs/screenshots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

async function session(kind) {
  const isPhone = kind === "phone";
  const ctx = await browser.newContext(isPhone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const shot = async (name) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/${kind}-${name}.png` });
    console.log("saved", `${kind}-${name}.png`);
  };
  const scrollTo = async (sel) => {
    await page.evaluate((s) => { document.documentElement.style.scrollBehavior = "auto"; const e = document.querySelector(s); if (e) window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 56); }, sel);
  };

  await page.goto(`${base}/?room=${room}`);
  await page.waitForLoadState("networkidle");
  await shot("home");
  await scrollTo("#rate");
  await shot("calculator");
  await page.goto(`${base}/shop`);
  await page.getByRole("link", { name: /Large Light-Weight Tops/ }).first().click();
  await shot("piece-modal");
  await page.getByRole("dialog").getByRole("button", { name: "Reserve this piece" }).click();
  const drawer = page.getByRole("dialog", { name: "Reserve bag" });
  await drawer.getByRole("button", { name: "Choose a visit time" }).click();
  await drawer.locator('[aria-label="Visit time"] button:not([disabled])').first().click();
  await drawer.getByLabel("Name").fill("Sample Customer");
  await drawer.getByLabel("Mobile").fill("416 555 0100");
  await shot("reserve-step");
  await page.keyboard.press("Escape");

  await page.goto(`${base}/admin/login?room=${room}`);
  await page.getByRole("button", { name: /Continue as the owner/ }).click();
  await page.waitForURL(/\/admin$/);
  for (const [path, name] of [["/admin/rate", "admin-rate"], ["/admin/inventory", "admin-inventory"], ["/admin/old-gold", "admin-old-gold"], ["/admin/books", "admin-books"]]) {
    await page.goto(`${base}${path}`);
    await page.waitForLoadState("networkidle");
    await shot(name);
  }
  await ctx.close();
}

await session("desktop");
await session("phone");
await browser.close();
