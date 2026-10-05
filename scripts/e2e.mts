/**
 * Behaviour checks in a real browser against a production build.
 *   npm run e2e            (starts `next start` itself if nothing answers on BASE_URL)
 * Covers what unit tests can't: deep links, keyboard control, unit switching, error copy.
 */
import { chromium } from "playwright-core";
import { spawn, type ChildProcess } from "node:child_process";
import { LOOKS } from "../src/lab/camphawk/looks.ts";
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

  // ---- Private area: password-only sign-in, session cookie, lock on every path and file ----
  type Opts = Parameters<typeof browser.newContext>[0];
  async function fresh(opts: Opts = {}) {
    const ctx = await browser.newContext(opts);
    const p = await ctx.newPage();
    await p.addInitScript("globalThis.__name = (f) => f");
    return { ctx, p };
  }
  async function signIn(p: import("playwright-core").Page, password = LAB_PASSWORD) {
    await p.getByLabel("Password", { exact: true }).fill(password);
    await p.getByLabel("Password", { exact: true }).press("Enter");
  }

  await check("private: the Private tab sits next to Home and Workshop, and is marked current on private pages", async () => {
    const { ctx, p } = await fresh();
    for (const path of ["/", "/workshop"]) {
      await p.goto(BASE + path);
      const nav = p.getByRole("navigation", { name: "Main" });
      assert.deepEqual(await nav.getByRole("link").allInnerTexts(), ["Home", "Workshop", "Private"]);
      assert.equal(await nav.getByRole("link", { name: "Private" }).getAttribute("aria-current"), null);
    }
    await p.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Private" }).click();
    await p.waitForURL(/\/private\/sign-in\?next=%2Fprivate$/);
    assert.equal(await p.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Private" }).getAttribute("aria-current"), "page");
    await ctx.close();
  });

  await check("private: the sign-in page asks for a password and nothing else, in the site's own design", async () => {
    const { ctx, p } = await fresh();
    await p.goto(`${BASE}/private`);
    await p.waitForURL(/\/private\/sign-in/);
    await p.getByRole("heading", { level: 1, name: "Enter the password" }).waitFor();
    const fields = p.locator("input:not([type=hidden])");
    assert.equal(await fields.count(), 1, "exactly one visible field");
    assert.equal(await fields.first().getAttribute("type"), "password");
    assert.equal(await fields.first().getAttribute("autocomplete"), "current-password");
    assert.equal(await p.locator("[autocomplete=username], input[name=username], input[type=email]").count(), 0);
    assert.equal(await p.evaluate(() => document.activeElement?.id), "password", "the field has focus on arrival");
    assert.ok(await p.getByRole("navigation", { name: "Main" }).isVisible(), "site header is there");
    await ctx.close();
  });

  await check("private: empty and wrong passwords are explained in words, and the field is ready again", async () => {
    const { ctx, p } = await fresh();
    await p.goto(`${BASE}/private/sign-in`);
    await p.getByRole("button", { name: /Unlock/ }).click();
    await p.getByText("Enter the password.").waitFor();
    await signIn(p, "not the password");
    await p.getByText("That password didn’t work. Try again.").waitFor();
    await p.getByText(/Problem: That password didn’t work/).waitFor(); // ✕ icon + word, state named for screen readers
    const field = p.getByLabel("Password", { exact: true });
    assert.equal(await field.inputValue(), "", "the wrong password is cleared");
    assert.equal(await field.getAttribute("aria-invalid"), "true");
    assert.equal(await p.evaluate(() => document.activeElement?.id), "password", "focus is back in the field");
    assert.match(p.url(), /\/private\/sign-in/);
    assert.equal((await ctx.cookies()).filter((c) => c.name === "fw_private").length, 0, "no session on failure");
    await field.pressSequentially("n");
    assert.equal(await p.getByText("That password didn’t work. Try again.").count(), 0, "typing again clears the message");
    assert.equal(await field.getAttribute("aria-invalid"), null);
    await ctx.close();
  });

  await check("private: Show / Hide reveals the password and says which state it's in", async () => {
    const { ctx, p } = await fresh();
    await p.goto(`${BASE}/private/sign-in`);
    const field = p.getByLabel("Password", { exact: true });
    await field.fill("abc");
    const toggle = p.getByRole("button", { name: /Show password/ });
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
    await toggle.click();
    assert.equal(await field.getAttribute("type"), "text");
    assert.equal(await p.getByRole("button", { name: /Hide password/ }).getAttribute("aria-pressed"), "true");
    await p.getByRole("button", { name: /Hide password/ }).click();
    assert.equal(await field.getAttribute("type"), "password");
    await ctx.close();
  });

  await check("private: the right password (Enter key) opens Private; the session cookie is HttpOnly, Secure, Lax, /private only", async () => {
    const { ctx, p } = await fresh();
    const problems: string[] = [];
    p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`); });
    p.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    await p.goto(`${BASE}/private`);
    await signIn(p);
    await p.waitForURL(`${BASE}/private`);
    await p.getByRole("heading", { level: 1, name: "Private" }).waitFor();
    const c = (await ctx.cookies()).find((x) => x.name === "fw_private");
    assert.ok(c, "session cookie set");
    assert.equal(c.httpOnly, true);
    assert.equal(c.secure, true);
    assert.equal(c.sameSite, "Lax");
    assert.equal(c.path, "/private");
    const days = (c.expires * 1000 - Date.now()) / 86_400_000;
    assert.ok(days > 29.9 && days <= 30, `expires in ${days.toFixed(2)} days`);
    await p.getByRole("link", { name: /CampHawk lab/ }).click();
    await p.waitForURL(`${BASE}/private/camphawk`);
    await p.getByRole("heading", { level: 1, name: "The campsite you wanted is already booked. We wait for it." }).waitFor();
    await p.getByRole("link", { name: /Private/ }).first().click();
    await p.waitForURL(`${BASE}/private`);
    assert.deepEqual(problems, [], "console stayed clean through sign-in, Private and the lab");
    await ctx.close();
  });

  await check("private: a deep link brings you back to where you were headed after signing in", async () => {
    const { ctx, p } = await fresh();
    await p.goto(`${BASE}/private/camphawk`);
    await p.waitForURL(/next=%2Fprivate%2Fcamphawk/);
    await signIn(p);
    await p.waitForURL(`${BASE}/private/camphawk`);
    await p.getByRole("heading", { level: 1, name: "The campsite you wanted is already booked. We wait for it." }).waitFor();
    await ctx.close();
  });

  await check("private: the old /lab/camphawk link still arrives (through sign-in)", async () => {
    const { ctx, p } = await fresh();
    await p.goto(`${BASE}/lab/camphawk`);
    await p.waitForURL(/\/private\/sign-in\?next=%2Fprivate%2Fcamphawk/);
    await signIn(p);
    await p.waitForURL(`${BASE}/private/camphawk`);
    await ctx.close();
  });

  await check("private: ?next can't send you anywhere outside the private area", async () => {
    for (const next of ["//evil.example/private", "https://evil.example", "/workshop", "/private/sign-in"]) {
      const { ctx, p } = await fresh();
      await p.goto(`${BASE}/private/sign-in?next=${encodeURIComponent(next)}`);
      await signIn(p);
      await p.waitForURL(`${BASE}/private`);
      await ctx.close();
    }
  });

  await check("private: files need the session too, and a forged cookie gets you nowhere", async () => {
    const img = `${BASE}/private/camphawk/hero-bg.webp`;
    assert.equal((await fetch(img, { redirect: "manual" })).status, 401);
    const forged = await fetch(`${BASE}/private`, { redirect: "manual", headers: { Cookie: "fw_private=v1.99999999999999.forged" } });
    assert.equal(forged.status, 307);
    assert.match(forged.headers.get("location") ?? "", /\/private\/sign-in/);
    const { ctx, p } = await fresh();
    await p.goto(`${BASE}/private`);
    await signIn(p);
    await p.waitForURL(`${BASE}/private`);
    const withSession = await ctx.request.get(img);
    assert.equal(withSession.status(), 200);
    assert.match(withSession.headers()["x-robots-tag"] ?? "", /noindex/);
    await ctx.close();
  });

  await check("private: Sign out forgets this device", async () => {
    const { ctx, p } = await fresh();
    await p.goto(`${BASE}/private`);
    await signIn(p);
    await p.waitForURL(`${BASE}/private`);
    await p.getByRole("button", { name: "Sign out" }).click();
    await p.waitForURL(`${BASE}/`);
    assert.equal((await ctx.cookies()).filter((c) => c.name === "fw_private").length, 0);
    await p.goto(`${BASE}/private`);
    await p.waitForURL(/\/private\/sign-in/);
    await ctx.close();
  });

  await check("private: signing in works with JavaScript turned off", async () => {
    const { ctx, p } = await fresh({ javaScriptEnabled: false });
    await p.goto(`${BASE}/private/camphawk`);
    await p.getByLabel("Password", { exact: true }).fill("not the password");
    await p.getByRole("button", { name: /Unlock/ }).click();
    await p.getByText("That password didn’t work. Try again.").waitFor();
    await p.getByLabel("Password", { exact: true }).fill(LAB_PASSWORD);
    await p.getByRole("button", { name: /Unlock/ }).click();
    await p.waitForURL(`${BASE}/private/camphawk`);
    await ctx.close();
  });

  await check("lab looks: every look renders its art, with a clean console", async () => {
    const { ctx, p } = await fresh({ viewport: { width: 1440, height: 900 } });
    const errors: string[] = [];
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await p.goto(`${BASE}/private/camphawk`);
    await signIn(p);
    await p.waitForURL(`${BASE}/private/camphawk`);
    for (const look of LOOKS) {
      await p.goto(`${BASE}/private/camphawk?look=${look.id}`, { waitUntil: "networkidle" });
      assert.equal(await p.locator(".look").getAttribute("data-look"), look.id);
      await p.getByRole("heading", { level: 1, name: /already booked/ }).waitFor();
      if (look.art) {
        const art = p.locator(look.id === "topo" ? ".look-map img" : ".look-scene img");
        await art.waitFor({ state: "attached" });
        assert.ok(await art.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), `${look.id}: art loaded`);
        assert.match(await art.evaluate((img: HTMLImageElement) => img.currentSrc), /-desktop\.webp$|painted-valley\.webp$/, `${look.id}: desktop crop on desktop`);
      }
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await check("lab round 2: both directions render their hero art, search and every pricing view, with a clean console", async () => {
    const { ctx, p } = await fresh({ viewport: { width: 1440, height: 900 } });
    const errors: string[] = [];
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await p.goto(`${BASE}/private/camphawk/golden-hour`);
    await signIn(p);
    await p.waitForURL(`${BASE}/private/camphawk/golden-hour`);
    for (const [path, hero] of [["golden-hour", ".gh-photo img"], ["trail-poster", ".tp-print img"]] as const) {
      await p.goto(`${BASE}/private/camphawk/${path}`, { waitUntil: "networkidle" });
      await p.getByRole("heading", { level: 1, name: /already booked/ }).waitFor();
      const art = p.locator(hero).first();
      assert.ok(await art.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), `${path}: hero art loaded`);
      assert.match(await art.evaluate((img: HTMLImageElement) => img.currentSrc), /\/round2\/[ab][12]-/, `${path}: round-2 art`);
      await p.getByRole("search").getByRole("button", { name: "Search campgrounds free" }).waitFor();
      // The three pricing branches still switch, in the new layout.
      await p.getByRole("heading", { level: 2, name: /Watching starts at/ }).waitFor();
      await p.getByRole("radio", { name: "Subscriber" }).click();
      await p.getByRole("heading", { level: 2, name: /all set/ }).waitFor();
      await p.getByRole("radio", { name: "In the app" }).click();
      await p.getByRole("heading", { level: 2, name: /needs a subscription/ }).waitFor();
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await check("lab looks: the Look menu switches the page and keeps the choice in the URL", async () => {
    const { ctx, p } = await fresh();
    await p.goto(`${BASE}/private/camphawk`);
    await signIn(p);
    await p.waitForURL(`${BASE}/private/camphawk`);
    await p.getByLabel("Look", { exact: true }).selectOption("dusk");
    assert.equal(await p.locator(".look").getAttribute("data-look"), "dusk");
    assert.match(p.url(), /\?look=dusk$/);
    await p.reload();
    assert.equal(await p.getByLabel("Look", { exact: true }).inputValue(), "dusk");
    await p.getByLabel("Look", { exact: true }).selectOption("current");
    assert.equal(p.url(), `${BASE}/private/camphawk`);
    await p.goto(`${BASE}/private/camphawk?look=nonsense`);
    assert.equal(await p.locator(".look").getAttribute("data-look"), "current", "an unknown look falls back to the current design");
    await ctx.close();
  });

  await check("lab looks: the overview lists every look and each opens it", async () => {
    const { ctx, p } = await fresh();
    await p.goto(`${BASE}/private/camphawk/looks`);
    await signIn(p);
    await p.waitForURL(`${BASE}/private/camphawk/looks`);
    const cards = p.locator("main li");
    assert.equal(await cards.count(), LOOKS.length);
    for (const img of await p.locator("main li img").all()) {
      await img.scrollIntoViewIfNeeded();
      await p.waitForFunction((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0, await img.elementHandle());
    }
    await cards.filter({ hasText: "Field guide" }).getByRole("link").click();
    await p.waitForURL(`${BASE}/private/camphawk?look=engraving`);
    assert.equal(await p.locator(".look").getAttribute("data-look"), "engraving");
    await ctx.close();
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
