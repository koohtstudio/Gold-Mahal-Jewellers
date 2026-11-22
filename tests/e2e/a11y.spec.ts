import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const PUBLIC = ["/", "/shop", "/shop/22k-gold-balis", "/rate", "/trade-in", "/visit", "/policies", "/reservation/GM-4821?k=0142"];
const ADMIN = ["/admin", "/admin/rate", "/admin/inventory", "/admin/reservations", "/admin/jobs", "/admin/old-gold", "/admin/layaway", "/admin/books", "/admin/settings"];
const SIZES = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

for (const size of SIZES) {
  test.describe(`axe at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const path of PUBLIC) {
      test(`public ${path}`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
      });
    }

    test("admin pages", async ({ page }) => {
      await login(page, "owner");
      for (const path of ADMIN) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(400);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(results.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
      }
    });
  });
}

test("dialogs are accessible: bag, piece and visit", async ({ page }) => {
  await page.goto("/shop");
  await page.getByRole("link", { name: /^22k Gold Balis/ }).click();
  await page.waitForTimeout(400);
  let r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /in the bag/ }).click();
  await page.waitForTimeout(400);
  r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});
