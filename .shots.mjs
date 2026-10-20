import { chromium } from "playwright-core";
const routes = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: "dark" });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3123/private/sign-in?next=/private");
  await p.fill("#password", "localpw"); await p.click("button[type=submit]");
  await p.waitForFunction(() => !location.pathname.includes("sign-in"));
  for (const r of routes) {
    await p.goto("http://localhost:3123" + r); await p.waitForLoadState("networkidle");
    const name = r.replace(/[^a-z0-9]+/gi, "_") + "_" + w;
    const over = await p.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === "visible" && e.clientWidth > 0).slice(0, 5).map((e) => e.tagName + "." + (e.className + "").slice(0, 60) + " " + e.textContent.slice(0, 40)));
    const hscroll = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    console.log(name, "hscroll", hscroll, over.length ? over : "");
    await p.screenshot({ path: `/tmp/claude-0/shots/${name}.png`, fullPage: true });
  }
  await ctx.close();
}
await b.close();
