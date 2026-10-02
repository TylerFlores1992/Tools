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
// The CampHawk lab's password for a server this script starts. Against a running server, set it
// to whatever that server uses.
const LAB_PASSWORD = process.env.LAB_PASSWORD ?? "e2e-lab-password";
const up = async () => { try { return (await fetch(BASE)).status < 500; } catch { return false; } };

let server: ChildProcess | undefined;
if (!(await up())) {
  server = spawn("npx", ["next", "start", "-p", new URL(BASE).port], { cwd: ROOT, stdio: "ignore", detached: true, env: { ...process.env, LAB_PASSWORD } });
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

  await check("study: a wrong answer says so in words, shows the key and the working, and survives a reload", async () => {
    await page.goto(`${BASE}/workshop/etcp-rigger-study/practice/a`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const q2 = page.locator("#a02");
    await q2.getByRole("button", { name: /60°/ }).click();
    await q2.getByText("Not quite. The answer is C.").waitFor();
    await q2.getByText(/Problem: Your answer/).waitFor(); // icon + word, with the state name for screen readers
    await q2.getByText("Correct answer").waitFor();
    await page.getByText("1 of 25 answered").waitFor();
    await page.reload();
    await page.locator("#a02").getByText("Not quite. The answer is C.").waitFor();
    await page.getByText("1 of 25 answered").waitFor();
  });

  await check("study: an answer can't be changed once it's locked in", async () => {
    const q2 = page.locator("#a02");
    await q2.getByRole("button", { name: /120°/ }).click({ force: true }); // aria-disabled, so Playwright would refuse
    await page.getByText("1 of 25 answered").waitFor();
    assert.equal(await q2.getByText("Not quite. The answer is C.").count(), 1);
  });

  await check("lab: /lab/camphawk is locked without the password, wrong password, and for its images", async () => {
    const basic = (pw: string) => ({ Authorization: `Basic ${Buffer.from(`anyone:${pw}`).toString("base64")}` });
    for (const [path, headers] of [["/lab/camphawk", {}], ["/lab/camphawk", basic("wrong")], ["/lab/camphawk/hero-bg.webp", {}]] as const) {
      const res = await fetch(BASE + path, { headers });
      assert.equal(res.status, 401, `${path} answered ${res.status}`);
      assert.match(res.headers.get("www-authenticate") ?? "", /^Basic /);
    }
    const ok = await fetch(`${BASE}/lab/camphawk`, { headers: basic(LAB_PASSWORD) });
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get("x-robots-tag") ?? "", /noindex/);
    assert.match(await ok.text(), /The campsite you wanted is already booked/);
  });

  await check("study: a flashcard flips from the keyboard and “Got it” counts it learned", async () => {
    await page.goto(`${BASE}/workshop/etcp-rigger-study/flashcards`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: "Show answer" }).focus();
    await page.keyboard.press("Space");
    await page.getByText("WLL = Breaking strength ÷ DF").waitFor();
    await page.getByRole("button", { name: /Got it/ }).click();
    await page.getByText("1 of 73 learned").waitFor();
    await page.getByRole("button", { name: /Arena/ }).click();
    await page.getByText("0 of 15 learned").waitFor();
  });
} finally {
  await browser.close();
  if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch {} }
}
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
