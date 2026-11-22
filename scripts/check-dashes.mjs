// Fails if an em dash or en dash appears in source, copy or docs. Plain, warm, human.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const roots = ["app", "components", "lib", "docs", "db", "tests", "scripts", "README.md", "PLAN.md", "TODO-LIVE.md"];
const skip = new Set(["node_modules", ".next", "screenshots"]);
const exts = new Set([".ts", ".tsx", ".css", ".md", ".sql", ".mjs", ".json", ".yml"]);
const bad = /[—–]/;
let failures = 0;

function walk(p) {
  let s;
  try { s = statSync(p); } catch { return; }
  if (s.isDirectory()) {
    for (const f of readdirSync(p)) if (!skip.has(f)) walk(join(p, f));
  } else if (exts.has(extname(p)) && !p.endsWith("check-dashes.mjs")) {
    readFileSync(p, "utf8").split("\n").forEach((line, i) => {
      if (bad.test(line)) { console.error(`${p}:${i + 1}: dash character found`); failures++; }
    });
  }
}
roots.forEach(walk);
if (failures) { console.error(`\n${failures} dash character(s). Use a comma, colon or full stop.`); process.exit(1); }
console.log("No em or en dashes found.");
