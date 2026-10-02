// Renders the hero film frame by frame.
//   node studio/film/film.mjs <width> <height> <frames> <outdir>
// e.g. node studio/film/film.mjs 1920 1080 192 studio/film/frames
// Then encode with ffmpeg (see .claude/skills/hero-film/SKILL.md).
import { chromium } from "playwright-core";
import { dirname, join, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [w = "1920", h = "1080", n = "192", dir = join(here, "frames")] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
await page.goto("file://" + join(here, "film.html"));
await page.waitForFunction(() => window.__ready);
const t0 = Date.now();
for (let i = 0; i < +n; i++) {
  await page.evaluate((phase) => window.frame(phase), i / +n);
  await page.screenshot({ path: resolve(dir, `f${String(i).padStart(4, "0")}.png`) });
  if (i % 12 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000 / (i + 1)).toFixed(1)}s/frame`);
}
await browser.close();
console.log("done", ((Date.now() - t0) / 1000).toFixed(0) + "s");
