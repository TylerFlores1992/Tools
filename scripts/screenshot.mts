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
const routes = ROUTES.length ? ROUTES : ["/", "/workshop", "/lab", "/does-not-exist"];
const WIDTHS = [375, 768, 1440, 2560];
const HEIGHT: Record<number, number> = { 375: 812, 768: 1024, 1440: 900, 2560: 1440 };
const SCHEMES = ["dark", "light"] as const;

async function up(url: string) {
  try { const r = await fetch(url); return r.status < 500; } catch { return false; }
}

let server: ChildProcess | undefined;
if (!(await up(BASE))) {
  if (!existsSync(join(ROOT, ".next", "BUILD_ID"))) {
    console.log("building…");
    const b = spawn("npx", ["next", "build"], { cwd: ROOT, stdio: "inherit" });
    const code: number = await new Promise((r) => b.on("exit", r));
    if (code !== 0) process.exit(code);
  }
  const port = new URL(BASE).port || "3100";
  server = spawn("npx", ["next", "start", "-p", port], { cwd: ROOT, stdio: "ignore" });
  for (let i = 0; i < 60 && !(await up(BASE)); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await up(BASE))) { console.error(`server did not start at ${BASE}`); server.kill(); process.exit(1); }
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const problems: string[] = [];
for (const route of routes) {
  for (const w of WIDTHS) {
    for (const scheme of SCHEMES) {
      const page = await browser.newPage({ viewport: { width: w, height: HEIGHT[w] }, colorScheme: scheme, deviceScaleFactor: w <= 400 ? 2 : 1 });
      const tag = `${route} @${w} ${scheme}`;
      page.on("pageerror", (e) => problems.push(`${tag}: page error: ${e.message}`));
      page.on("console", (m: ConsoleMessage) => { if (m.type() === "error") problems.push(`${tag}: console: ${m.text()}`); });
      const res = await page.goto(BASE + route, { waitUntil: "networkidle" });
      const expect404 = route === "/does-not-exist";
      if (!res || res.status() !== (expect404 ? 404 : 200)) problems.push(`${tag}: HTTP ${res?.status()}`);
      await page.evaluate(() => document.fonts.ready);
      const name = (route === "/" ? "home" : route.slice(1).replace(/\//g, "_")) + `-${w}-${scheme}.png`;
      await page.screenshot({ path: join(OUT, name), fullPage: true });
      await page.close();
    }
  }
}
await browser.close();
server?.kill();
console.log(`${routes.length * WIDTHS.length * SCHEMES.length} screenshots → screenshots/`);
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
