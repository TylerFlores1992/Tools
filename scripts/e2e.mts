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
  try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name}\n     ${(e as Error).message.split("\n").slice(0, 4).join(" / ")}`); }
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
    await p.waitForURL(`${BASE}/private/camphawk/golden-hour`);
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
    for (const [path, hero] of [["golden-hour", "img.gh-photo"], ["trail-poster", ".tp-print img"]] as const) {
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
    // Golden hour rewrites CampHawk's "any N nights" for campers; a silent no-op replace would
    // leave the system wording on the page.
    await p.goto(`${BASE}/private/camphawk/golden-hour`, { waitUntil: "networkidle" });
    await p.getByRole("radio", { name: "Signed out" }).click();
    const text = await p.locator("main").innerText();
    assert.doesNotMatch(text, /any N nights/, "golden hour: no system wording");
    assert.match(text, /how many nights you need inside a window/, "golden hour: step 2 reworded");
    assert.match(text, /how many nights you need, anywhere in a window/, "golden hour: pricing reworded");
    // The header carries the golden-sky badge, and it loads through the private sign-in.
    const badge = p.locator("header img").first();
    assert.ok(await badge.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), "golden hour: badge loaded");
    assert.match(await badge.evaluate((img: HTMLImageElement) => img.currentSrc), /\/round2\/badge-golden-\d+\.webp$/, "golden hour: golden badge");
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await check("lab campground: days, months, unknown months, first come and the watch gate behave like CampHawk's", async () => {
    const { ctx, p } = await fresh({ viewport: { width: 1440, height: 900 } });
    const errors: string[] = [];
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await p.goto(`${BASE}/private/camphawk/golden-hour/campground`);
    await signIn(p);
    await p.waitForURL(`${BASE}/private/camphawk/golden-hour/campground`);
    await p.getByRole("heading", { level: 1, name: "Upper Pines" }).waitFor();
    const panel = p.getByRole("complementary", { name: "Selected day" });
    // An open day lists its sites; a booked day can't be picked.
    await p.getByRole("button", { name: /July 27, 2 sites open/ }).click();
    await panel.getByText("2 sites open").waitFor();
    assert.ok(await p.getByRole("button", { name: /July 12, fully booked/ }).isDisabled(), "booked day is not actionable");
    // The answer comes first, in words, under the name.
    await p.getByText("5 days with openings in July.").waitFor();
    // A month we couldn't read: no day is called booked, and the page says why.
    const next = p.getByRole("button", { name: "Next month" });
    await next.click();
    await next.click();
    await p.getByRole("heading", { level: 2, name: "September 2026" }).waitFor();
    await p.getByText("Couldn't check this month").waitFor();
    assert.equal(await p.getByRole("button", { name: /September \d+, fully booked/ }).count(), 0, "unknown month is never booked");
    // Not open for booking is its own state, not "booked".
    await next.click();
    await p.getByText("Not open for booking this month").waitFor();
    assert.equal(await p.getByRole("button", { name: /October \d+, fully booked/ }).count(), 0, "closed month is never booked");
    assert.ok((await p.getByRole("button", { name: /October \d+, not open for booking/ }).count()) > 20, "closed days say so");
    // A failed read is said in words, as an alert, and is never booked either.
    await next.click();
    await p.getByRole("alert").filter({ hasText: "usually the reservation provider" }).waitFor();
    assert.equal(await p.getByRole("button", { name: /November \d+, fully booked/ }).count(), 0, "failed month is never booked");
    assert.ok(await next.isDisabled(), "no months past the example data");
    // The watch buttons (band and day panel) follow CampHawk's WatchCta labels.
    const watch = (name: string) => p.getByRole("link", { name, exact: true });
    assert.equal(await watch("Sign up to watch").count(), 2);
    await p.getByRole("radio", { name: "Signed in", exact: true }).click();
    assert.equal(await watch("Start free trial to watch").count(), 2);
    await p.getByRole("radio", { name: "Subscriber" }).click();
    assert.equal(await watch("Watch this campground").count(), 2);
    await p.getByRole("radio", { name: "In the app" }).click();
    assert.equal(await watch("Subscribe to watch").count(), 2);
    // CampgroundDetail's page states, and its arrival rule.
    await p.getByLabel("Page state").selectOption("missing");
    await p.getByRole("heading", { level: 1, name: "Campground not found" }).waitFor();
    await p.getByLabel("Page state").selectOption("failed");
    await p.getByRole("heading", { level: 1, name: "We couldn't load this campground" }).waitFor();
    await p.getByRole("button", { name: "Try again" }).click();
    await p.getByRole("heading", { level: 1, name: "Upper Pines" }).waitFor();
    assert.equal(await p.getByRole("navigation", { name: "Breadcrumb" }).filter({ hasText: "Camping by state" }).count(), 0, "search arrivals get a back link");
    await p.getByLabel("Arrived from").selectOption("google");
    await p.getByRole("navigation", { name: "Breadcrumb" }).filter({ hasText: "Camping by state" }).waitFor();
    assert.equal(await p.getByRole("link", { name: "Back to search" }).count(), 0, "a cold arrival has no back link");
    // First come: the policy, not an empty calendar, and nothing to watch.
    await p.getByRole("radio", { name: "First come" }).click();
    await p.getByRole("heading", { level: 2, name: "First come, first served" }).waitFor();
    assert.equal(await p.getByRole("link", { name: /to watch|Watch this campground/ }).count(), 0, "first come offers no watch");
    assert.equal(await p.getByRole("button", { name: "Next month" }).count(), 0, "first come has no calendar");
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  // The Golden hour app screens run in a US timezone on purpose: that is where CampHawk's date
  // traps show (a date string parsed as UTC lands on the day before).
  const GH = `${BASE}/private/camphawk/golden-hour`;
  const watchErrors = (p: import("playwright-core").Page) => {
    const errors: string[] = [];
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    return errors;
  };

  await check("lab explore: a search shows all four result states, the map hoists a pick, and Back to search restores it", async () => {
    const { ctx, p } = await fresh({ viewport: { width: 1440, height: 900 }, timezoneId: "America/Los_Angeles" });
    const errors = watchErrors(p);
    await p.goto(`${GH}/explore`);
    await signIn(p);
    await p.waitForURL(`${GH}/explore`);
    // Guests get context, not a paywall, and the first-run box until they search.
    await p.getByText("You're searching as a guest").waitFor();
    await p.getByRole("heading", { level: 2, name: "Find a campsite that's actually open" }).waitFor();
    await p.getByLabel("Where").fill("yos");
    await p.getByRole("button", { name: "Yosemite Valley, CA place" }).click();
    await p.getByRole("button", { name: /Trip dates/ }).click();
    await p.getByRole("gridcell", { name: "Saturday, July 18, 2026" }).click();
    await p.getByRole("gridcell", { name: "Tuesday, July 21, 2026" }).click();
    await p.getByRole("button", { name: "Done" }).click();
    await p.getByRole("search").getByRole("button", { name: "Search" }).click();
    await p.getByRole("heading", { level: 2, name: "1 campground with openings" }).waitFor();
    // Open, booked, couldn't check and first come are four different words, never one.
    const results = p.getByRole("region", { name: "Results" });
    // (Tags carry a hidden "Status:" prefix for screen readers, so match within the text.)
    for (const word of ["Sites open", "Booked — watch it", "Couldn't check", "First come, first served"]) await results.getByText(word).first().waitFor();
    // Each card carries its own answer, and each pin says the same in its name (the map key
    // also says "Couldn't check", so read the cards and pins, not the page).
    const cardSays = async (name: string, word: string) => assert.match(await results.locator("div[data-state]", { has: p.getByRole("heading", { name, exact: true }) }).innerText(), new RegExp(word, "i"), name);
    await cardSays("Upper Pines", "Sites open");
    await cardSays("North Pines", "Booked — watch it");
    await cardSays("Lower Pines", "Couldn't check");
    await cardSays("Camp 4", "First come, first served");
    for (const pin of ["Upper Pines, sites open", "North Pines, booked", "Lower Pines, couldn't check", "Camp 4, first come, first served"]) await p.getByRole("button", { name: pin, exact: true }).waitFor();
    assert.equal(await results.getByRole("link", { name: "Sign up to watch" }).count(), 2, "booked and couldn't-check offer a watch; open and first come don't");
    // Picking a pin moves its card to the front.
    await p.getByRole("button", { name: "North Pines, booked" }).click();
    assert.equal(await results.getByRole("heading", { level: 3 }).first().innerText(), "North Pines");
    assert.match(p.url(), /place=Yosemite.*start=2026-07-18&end=2026-07-21/);
    // A result opens its own page, and "Back to search" brings the search back.
    await results.getByRole("link", { name: "Lower Pines", exact: true }).click();
    await p.getByRole("heading", { level: 1, name: "Lower Pines" }).waitFor();
    await p.getByText("We couldn't check July just now.").waitFor();
    await p.getByRole("link", { name: "Back to search" }).click();
    await p.getByRole("heading", { level: 2, name: "1 campground with openings" }).waitFor();
    // Who's looking changes the watch control, never the results.
    for (const [who, label] of [["Signed in", "Start free trial to watch"], ["Lapsed", "Resubscribe to watch"], ["Subscriber", "Start a watch"], ["In the app", "Subscribe to watch"]] as const) {
      await p.getByRole("radio", { name: who, exact: true }).click();
      assert.equal(await results.getByRole("link", { name: label, exact: true }).count(), 2, who);
    }
    await p.getByRole("radio", { name: "Subscriber", exact: true }).click();
    assert.equal(await p.getByText("You're searching", { exact: false }).count(), 0, "a subscriber is never sold to");
    // A failed search says so in words, with no internals.
    await p.getByLabel("Search answers").selectOption("fails");
    await p.getByRole("search").getByRole("button", { name: "Search" }).click();
    const alert = p.getByRole("alert").filter({ hasText: "Search didn't go through" });
    await alert.waitFor();
    assert.doesNotMatch(await alert.innerText(), /\d{3}/, "no status codes");
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await check("lab new watch: only a subscriber can start one; a park is one watch; this weekend is Friday to Sunday", async () => {
    const { ctx, p } = await fresh({ viewport: { width: 1440, height: 900 }, timezoneId: "America/Los_Angeles" });
    const errors = watchErrors(p);
    await p.goto(`${GH}/new`);
    await signIn(p);
    await p.waitForURL(`${GH}/new`);
    assert.equal(await p.getByRole("button", { name: "Start watching" }).count(), 0, "a guest isn't offered a button that can't work");
    await p.getByRole("link", { name: "Start free trial" }).waitFor();
    await p.getByRole("radio", { name: "Subscriber", exact: true }).click();
    await p.getByRole("button", { name: "Start watching" }).click();
    await p.getByRole("alert").filter({ hasText: "Pick a campground to watch." }).waitFor();
    // A first-come campground can't be picked, and says why.
    await p.getByLabel("Which campground").fill("camp 4");
    await p.getByText("no reservations, so there is nothing to watch").waitFor();
    assert.equal(await p.locator("#nw-cg-list button").count(), 0);
    // A park starts with all its bookable parts ticked; its walk-up part never appears.
    await p.getByLabel("Which campground").fill("carp");
    await p.getByRole("button", { name: /Carpinteria State Beach/ }).click();
    await p.getByText("3 of 3 selected").waitFor();
    assert.equal(await p.getByText("San Miguel (walk-up)").count(), 0);
    await p.getByRole("radio", { name: "This weekend" }).click();
    await p.getByRole("complementary").getByText("Fri Jul 10 – Sun Jul 12").waitFor();
    // ReserveCalifornia gets the 8am hold, not the Recreation.gov auto-cart toggle.
    await p.getByText("We can grab a site at 8am").waitFor();
    assert.equal(await p.getByRole("button", { name: /Add it to my cart automatically/ }).count(), 0);
    await p.getByRole("button", { name: "Start watching" }).click();
    await p.waitForURL(/\/watches\?/);
    assert.match(p.url(), /as=subscriber/);
    await p.getByRole("heading", { level: 3, name: "Carpinteria State Beach" }).waitFor();
    await p.getByText("4 of 6 watches running").waitFor();
    // The Auto-Cart promise is only for its plan; the base plan is told what still happens.
    await p.goto(`${GH}/new?as=subscriber&plan=alerts&campground=upper-pines&start=2026-07-18&end=2026-07-21`);
    await p.getByText("Auto-cart is on the Auto-Cart plan").waitFor();
    await p.getByText("Alerts race you to the site.", { exact: false }).waitFor();
    await p.goto(`${GH}/new?as=subscriber&campground=upper-pines&start=2026-07-18&end=2026-07-21`);
    await p.getByRole("button", { name: /Add it to my cart automatically/ }).waitFor();
    await p.getByRole("button", { name: "Mute individual campsites" }).click();
    await p.getByRole("button", { name: "Mute site Site 042" }).click();
    await p.getByText("1 of 7 muted").waitFor();
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await check("lab watches: the wall, the card states, holds, provider and auto-cart trouble, and the quiet-outlook note", async () => {
    const { ctx, p } = await fresh({ viewport: { width: 1440, height: 900 }, timezoneId: "America/Los_Angeles" });
    const errors = watchErrors(p);
    await p.goto(`${GH}/watches`);
    await signIn(p);
    await p.waitForURL(`${GH}/watches`);
    await p.getByRole("heading", { level: 2, name: "Watches need an account" }).waitFor();
    await p.getByRole("radio", { name: "Lapsed", exact: true }).click();
    await p.getByRole("link", { name: "Resubscribe to watch" }).waitFor();
    await p.getByRole("radio", { name: "Subscriber", exact: true }).click();
    await p.getByText("3 of 6 watches running").waitFor();
    for (const tag of ["1 site open", "In your cart", "We'll grab Site 042 · 8 AM", "2 more open 8 AM", "Paused"]) await p.getByText(tag).first().waitFor();
    // Calling off the queued hold takes its tag with it.
    await p.getByRole("button", { name: "Queued for us to grab" }).click();
    await p.getByRole("button", { name: "Call off the hold on 042" }).click();
    assert.equal(await p.getByText("We'll grab Site 042 · 8 AM").count(), 0);
    // A provider not answering is a banner and a card state, not a broken watch.
    await p.getByLabel("ReserveCalifornia").selectOption("down");
    await p.getByText("ReserveCalifornia isn't responding", { exact: true }).waitFor();
    await p.getByText("Checks paused").first().waitFor();
    // Auto-cart signed out: the hit card stops claiming a cart, and the running one says why.
    await p.getByLabel("Auto-cart connection").selectOption("disconnected");
    await p.getByText("Not carted — reconnect auto-cart").waitFor();
    assert.equal(await p.getByText(/In your cart$/).count(), 0, "no cart claim without the connection");
    await p.getByRole("link", { name: "Reconnect Recreation.gov" }).waitFor();
    // A new watch on a stay that's booked weeks out is told to expect quiet.
    await p.goto(`${GH}/watches?as=subscriber&new=north-pines&start=2026-07-25&end=2026-07-27`);
    await p.getByText("You're watching a stay that's fully booked").waitFor();
    await p.getByText("about 3 weeks away", { exact: false }).waitFor();
    await p.getByRole("button", { name: "Dismiss" }).click();
    assert.equal(await p.getByText("You're watching a stay that's fully booked").count(), 0);
    // The header tabs keep who we're pretending to be.
    await p.getByRole("navigation", { name: "Main" }).first().getByRole("link", { name: "Explore" }).click();
    await p.waitForURL(/\/explore\?as=subscriber/);
    assert.equal(await p.getByRole("navigation", { name: "Main" }).first().getByRole("link", { name: "Explore" }).getAttribute("aria-current"), "page");
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
