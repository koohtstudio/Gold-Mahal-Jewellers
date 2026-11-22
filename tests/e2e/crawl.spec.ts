import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/** Visits every internal link it can find and fails on a 404, a failed request or a console error. */
async function crawl(page: Page, start: string[], skip: RegExp[] = []) {
  const seen = new Set<string>();
  const queue = [...start];
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console error on ${page.url()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`page error on ${page.url()}: ${e.message}`));
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.origin === new URL(page.url() || "http://localhost").origin && r.status() >= 400 && !u.pathname.endsWith("/favicon.ico")) problems.push(`${r.status()} for ${u.pathname}${u.search}`);
  });
  while (queue.length && seen.size < 60) {
    const path = queue.shift() as string;
    const key = path.split("#")[0] as string;
    if (seen.has(key) || skip.some((s) => s.test(key))) continue;
    seen.add(key);
    const res = await page.goto(key);
    if (!res || res.status() >= 400) problems.push(`${res?.status() ?? "no response"} for ${key}`);
    await page.waitForLoadState("networkidle");
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
    for (const h of hrefs) {
      if (!h.startsWith("/") || h.startsWith("//")) continue;
      queue.push(h);
    }
  }
  return { seen, problems };
}

test("every public link works and nothing logs an error", async ({ page }) => {
  const { seen, problems } = await crawl(page, ["/"], [/^\/admin/, /^\/api/]);
  expect([...seen].length).toBeGreaterThan(10);
  expect(problems).toEqual([]);
});

test("every admin link works and nothing logs an error", async ({ page }) => {
  await login(page, "owner");
  const { seen, problems } = await crawl(page, ["/admin"], [/^\/admin\/login/]);
  expect([...seen].length).toBeGreaterThanOrEqual(9);
  expect(problems).toEqual([]);
});
