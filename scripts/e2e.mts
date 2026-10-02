/**
 * Behaviour checks in a real browser against a production build.
 *   npm run e2e            (starts `next start` itself if nothing answers on BASE_URL)
 * Covers what unit tests can't: deep links, keyboard control, unit switching, error copy.
 */
import { chromium } from "playwright-core";
import { spawn, type ChildProcess } from "node:child_process";
import assert from "node:assert/strict";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const BASE = process.env.BASE_URL ?? "http://localhost:3110";
const up = async () => { try { return (await fetch(BASE)).status < 500; } catch { return false; } };

let server: ChildProcess | undefined;
if (!(await up())) {
  server = spawn("npx", ["next", "start", "-p", new URL(BASE).port], { cwd: ROOT, stdio: "ignore", detached: true });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const results: string[] = [];
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name}\n     ${(e as Error).message.split("\n")[0]}`); }
}
try {
  const page = await browser.newPage();
  await page.addInitScript("globalThis.__name = (f) => f");
  const leftTension = () => page.locator("section[aria-label=Results] .text-title").first().innerText();

  await check("deep link loads the rig from the URL (2,000 lb off-center → 1,602 lb)", async () => {
    await page.goto(`${BASE}/workshop/bridle-calculator?span=12&load=2000&x=4&drop=6&rise=0&u=imperial`);
    await page.waitForFunction(() => document.querySelector("section[aria-label=Results] .text-title")?.textContent?.includes("1,602"));
  });

  await check("arrow keys on the bridle point move it 0.1 per press", async () => {
    const handle = page.getByRole("slider", { name: "Bridle point" });
    await handle.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
    assert.equal(await handle.getAttribute("aria-valuenow"), "5");
  });

  await check("switching to m · kg converts the rig (it doesn't just relabel it)", async () => {
    await page.goto(`${BASE}/workshop/bridle-calculator?span=12&load=2000&x=4&drop=6&rise=0&u=imperial`);
    await page.waitForFunction(() => document.querySelector("section[aria-label=Results] .text-title")?.textContent?.includes("1,602"));
    await page.getByRole("radio", { name: /m · kg/ }).click();
    assert.equal(await page.getByLabel("Span between beams").inputValue(), "3.7");
    assert.equal(await page.getByLabel("Load").inputValue(), "907");
    assert.match(await leftTension(), /^727/);
    assert.match(page.url(), /u=metric/);
  });

  await check("typing something that isn't a number explains it in words and keeps the last good result", async () => {
    const before = await leftTension();
    await page.getByLabel("Span between beams").fill("abc");
    await page.getByText("Enter a number.").waitFor();
    assert.equal(await leftTension(), before);
  });

  await check("impossible geometry is explained with ✕ and shows no fake tension", async () => {
    await page.goto(`${BASE}/workshop/bridle-calculator?span=10&load=500&x=0&drop=5&rise=0&u=imperial`);
    await page.getByText("Keep the bridle point between the two beams.").waitFor();
    assert.match(await leftTension(), /^–/);
  });

  await check("home: the primary action reaches the workshop", async () => {
    await page.goto(BASE);
    await page.getByRole("link", { name: /Enter the workshop/ }).click();
    await page.waitForURL(/\/workshop$/);
    await page.getByRole("heading", { name: "Tools", level: 1 }).waitFor();
  });
} finally {
  await browser.close();
  if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch {} }
}
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
