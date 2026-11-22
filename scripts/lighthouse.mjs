// Lighthouse, mobile emulation, on the pages that matter. Usage: URL=https://your-site pnpm lighthouse
// Fails if performance, accessibility or best practices drop under 95, or layout shift is over 0.05.
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { chromium } from "@playwright/test";

const base = (process.env.URL ?? "http://localhost:3137").replace(/\/$/, "");
const pages = ["/", "/shop", "/shop/22k-gold-balis", "/visit"];
const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless=new", "--no-sandbox"] });
let failed = false;
const rows = [];
try {
  for (const p of pages) {
    const r = await lighthouse(base + p, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices"] });
    const c = r.lhr.categories;
    const score = (k) => Math.round((c[k]?.score ?? 0) * 100);
    const cls = r.lhr.audits["cumulative-layout-shift"]?.numericValue ?? 0;
    const lcp = (r.lhr.audits["largest-contentful-paint"]?.numericValue ?? 0) / 1000;
    const row = { page: p, performance: score("performance"), accessibility: score("accessibility"), bestPractices: score("best-practices"), cls: Number(cls.toFixed(3)), lcpSeconds: Number(lcp.toFixed(2)) };
    rows.push(row);
    if (row.performance < 95 || row.accessibility < 95 || row.bestPractices < 95 || cls > 0.05) failed = true;
  }
} finally {
  await chrome.kill();
}
console.table(rows);
if (failed) {
  console.error("Below the bar (95 and CLS 0.05) on at least one page.");
  process.exit(1);
}
console.log("All pages meet the bar.");
