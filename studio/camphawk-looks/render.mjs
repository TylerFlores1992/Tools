// Renders the CampHawk look artwork to webp.
//   node studio/camphawk-looks/render.mjs [name ...]
// Writes public/private/camphawk/looks/<name>-<variant>.webp (desktop and phone crops).
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "..", "public", "private", "camphawk", "looks");
mkdirSync(out, { recursive: true });
const JOBS = {
  topo: [["desktop", 2400, 1500], ["phone", 1080, 1920]],
  ridgeline: [["desktop", 2400, 1100], ["phone", 1080, 1500]],
  engraving: [["desktop", 2400, 1100], ["phone", 1080, 1500]],
  poster: [["desktop", 2400, 1100], ["phone", 1080, 1500]],
  dusk: [["desktop", 2400, 1100], ["phone", 1080, 1500]],
  grain: [["tile", 512, 512]],
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
for (const name of names) for (const [variant, w, h] of JOBS[name]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const t0 = Date.now();
  await page.goto(`file://${join(here, "art.html")}?name=${name}&w=${w}&h=${h}`);
  await page.waitForFunction(() => window.__done, null, { timeout: 120000 });
  const png = join(here, `${name}-${variant}.png`), webp = join(out, `${name}-${variant}.webp`);
  await page.locator("canvas").screenshot({ path: png });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-c:v", "libwebp", "-quality", name === "grain" ? "80" : "74", "-compression_level", "6", webp]);
  rmSync(png);
  console.log(`${name}-${variant}: ${w}×${h} ${(statSync(webp).size / 1024).toFixed(0)} KB in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await page.close();
}
await browser.close();
