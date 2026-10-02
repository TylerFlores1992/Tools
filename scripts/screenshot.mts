/**
 * Screenshot real pages at every breakpoint in both themes, so work gets LOOKED at.
 *
 *   npm run shots                     # default routes
 *   npm run shots -- / /workshop      # chosen routes
 *   BASE_URL=http://localhost:3000 npm run shots
 *
 * If nothing answers at BASE_URL it builds (unless .next exists) and starts `next start`.
 * Fails (exit 1) on any page error, console error, or non-200 response — a screenshot of a
 * broken page is not evidence.
 */
import { chromium, type ConsoleMessage } from "playwright-core";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "screenshots");
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const ROUTES = process.argv.slice(2).filter((a) => a.startsWith("/"));
const routes = ROUTES.length ? ROUTES : ["/", "/workshop", "/workshop/bridle-calculator", "/workshop/etcp-rigger-study", "/workshop/etcp-rigger-study/practice/a", "/workshop/etcp-rigger-study/flashcards", "/workshop/etcp-rigger-study/formulas", "/private/sign-in", "/lab", "/does-not-exist"];
const WIDTHS = [375, 768, 1440, 2560];
const HEIGHT: Record<number, number> = { 375: 812, 768: 1024, 1440: 900, 2560: 1440 };
const SCHEMES = ["dark", "light"] as const;

async function up(url: string) {
  try { const r = await fetch(url); return r.status < 500; } catch { return false; }
}

let server: ChildProcess | undefined;
const stop = () => { if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } };
if (!(await up(BASE))) {
  if (!existsSync(join(ROOT, ".next", "BUILD_ID"))) {
    console.log("building…");
    const b = spawn("npx", ["next", "build"], { cwd: ROOT, stdio: "inherit" });
    const code: number = await new Promise((r) => b.on("exit", r));
    if (code !== 0) process.exit(code);
  }
  const port = new URL(BASE).port || "3100";
  // Own process group, so stopping it also stops the next-server child that npx spawns.
  server = spawn("npx", ["next", "start", "-p", port], { cwd: ROOT, stdio: "ignore", detached: true });
  for (let i = 0; i < 60 && !(await up(BASE)); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await up(BASE))) { console.error(`server did not start at ${BASE}`); stop(); process.exit(1); }
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const problems: string[] = [];
try {
for (const route of routes) {
  for (const w of WIDTHS) {
    for (const scheme of SCHEMES) {
      const page = await browser.newPage({ viewport: { width: w, height: HEIGHT[w] }, colorScheme: scheme, deviceScaleFactor: w <= 400 ? 2 : 1 });
      // tsx/esbuild wraps named functions in __name(); code sent to page.evaluate needs it too.
      await page.addInitScript("globalThis.__name = (f) => f");
      const tag = `${route} @${w} ${scheme}`;
      page.on("pageerror", (e) => problems.push(`${tag}: page error: ${e.message}`));
      const expect404 = route === "/does-not-exist";
      page.on("console", (m: ConsoleMessage) => {
        if (m.type() !== "error") return;
        // The 404 route's own document answering 404 is the point of that route.
        if (expect404 && m.location().url === BASE + route) return;
        problems.push(`${tag}: console: ${m.text()} (${m.location().url})`);
      });
      const res = await page.goto(BASE + route, { waitUntil: "networkidle" });
      if (!res || res.status() !== (expect404 ? 404 : 200)) problems.push(`${tag}: HTTP ${res?.status()}`);
      await page.evaluate(() => document.fonts.ready);
      // Let entrance animations finish: a mid-animation screenshot (or contrast reading) lies.
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity), null, { timeout: 8000 }).catch(() => problems.push(`${tag}: animations still running after 8s`));
      const name = (route === "/" ? "home" : route.slice(1).replace(/\//g, "_")) + `-${w}-${scheme}.png`;
      await page.screenshot({ path: join(OUT, name), fullPage: true });
      for (const line of await checkContrastOverMedia(page)) problems.push(`${tag}: ${line}`);
      await page.close();
    }
  }
}
} finally {
  await browser.close();
  stop();
}

/**
 * Text over imagery (the hero film) can't be checked from tokens, so measure it: for each
 * element marked data-contrast-check, hide all text, take the 98th-percentile luminance of the
 * pixels behind it, and compare with the text colour. Large text (≥24px) needs 3:1, else 4.5:1.
 */
async function checkContrastOverMedia(page: import("playwright-core").Page): Promise<string[]> {
  const targets = await page.$$eval("[data-contrast-check]", (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { text: (el.textContent ?? "").trim().slice(0, 32), x: r.x, y: r.y, w: r.width, h: r.height, color: cs.color, size: parseFloat(cs.fontSize) };
    }).filter((t) => t.w > 0 && t.h > 0 && t.y < innerHeight),
  );
  if (!targets.length) return [];
  await page.addStyleTag({ content: "*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}" });
  await page.waitForTimeout(100);
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(async ({ png, targets }) => {
    const img = new Image(); img.src = "data:image/png;base64," + png; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
    const sx = img.width / innerWidth;
    const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = (r: number, gg: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
    const out: string[] = [];
    for (const t of targets) {
      const d = g.getImageData(Math.max(0, Math.floor(t.x * sx)), Math.max(0, Math.floor(t.y * sx)), Math.max(1, Math.floor(t.w * sx)), Math.max(1, Math.floor(t.h * sx))).data;
      const lum: number[] = [];
      for (let i = 0; i < d.length; i += 4) lum.push(L(d[i], d[i + 1], d[i + 2]));
      lum.sort((a, b) => a - b);
      const bg = lum[Math.floor(lum.length * 0.98)];
      const m = t.color.match(/[\d.]+/g)!.map(Number);
      const fg = L(m[0], m[1], m[2]);
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      const need = t.size >= 24 ? 3 : 4.5;
      if (ratio < need) out.push(`contrast over media ${ratio.toFixed(2)}:1 < ${need}:1 for "${t.text}"`);
    }
    return out;
  }, { png, targets });
}
console.log(`${routes.length * WIDTHS.length * SCHEMES.length} screenshots → screenshots/`);
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
