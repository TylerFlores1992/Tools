/**
 * Print /work/resume to public/work/tyler-flores-resume.pdf (the "Download résumé" button on /work).
 * Run after changing src/lib/work.ts, against any running copy of the site:
 *
 *   BASE_URL=http://localhost:3000 npm run resume
 *
 * Printed in the light theme on US Letter. Fails if the page doesn't answer 200 or logs an error.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = join(ROOT, "public", "work", "tyler-flores-resume.pdf");

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ colorScheme: "light" });
const errors: string[] = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
const res = await page.goto(`${BASE}/work/resume`, { waitUntil: "networkidle" });
if (res?.status() !== 200) errors.push(`status ${res?.status()}`);
await page.evaluate(() => document.fonts.ready);
// The site's dev badge and header aren't part of the paper.
await page.addStyleTag({ content: "nextjs-portal{display:none!important} html,body{background:#fff!important;min-height:0!important}" });
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
mkdirSync(join(ROOT, "public", "work"), { recursive: true });
await page.pdf({ path: OUT, format: "Letter", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
await browser.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`wrote ${OUT}`);
