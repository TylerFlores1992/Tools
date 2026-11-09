// Browser test of the built page against the mock window.claude: screenshots plus the main flows
// (open a project, change it from the chat, start a full session, approve, new project).
// node studio/rig-studio/dev/test.mjs   (after build.mts; writes screenshots/rig-studio-*.png)
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const shots = join(root, "../../screenshots");
mkdirSync(shots, { recursive: true });
execFileSync("npx", ["tsx", join(root, "seed.mts"), join(here, "seed.json")], { stdio: "ignore" });
const seed = JSON.parse(readFileSync(join(here, "seed.json"), "utf8"));
seed["config/workers"] = { cloud: "trig_cloud", pc: "trig_pc" };
const page = readFileSync(join(root, "dist/rig-studio.html"), "utf8");
const mock = readFileSync(join(here, "mock.js"), "utf8");

const MCP = {
  "Claude Code Remote/fire_trigger": { ok: true },
  "Dropbox/list_folder": { entries: [{ name: "Air Pro - Self Climber (09.07.22).vwx", path: "ns:1//a.vwx", path_display: "/Pickle/Pickled/Plans/Accurate/Air Pro - Self Climber (09.07.22).vwx", file_id: "id:1", modified_time: "2022-09-08T00:24:32Z", object_type: "file", file: { size: 13508229 } }], has_more: false },
  "Dropbox/create_folder": { folder: { path: "ns:1//Rig Studio/Test show", path_display: "/Rig Studio/Test show" } },
};
const SAMPLE = [
  {
    calls: [{ name: "edit_rig", input: { note: "Hoists at the four corners", ops: [{ op: "add_point", at: [0, 0, 310.25], capacity: 2000, label: "DSL" }, { op: "add_point", at: [1044, 0, 310.25], label: "DSR" }] } }],
    text: "Added a 1-ton hoist at the two downstage corners.",
  },
];

function html(extra = "") {
  return `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>
<script>window.__SEED__=${JSON.stringify(seed)};window.__MCP__=${JSON.stringify(MCP)};window.__SAMPLE__=${JSON.stringify(SAMPLE)};${extra}</script><script>${mock}</script>${page}</body></html>`;
}
writeFileSync(join(here, "harness.html"), html());

const fails = [];
const ok = (cond, msg) => (cond ? console.log(`  ✓ ${msg}`) : (fails.push(msg), console.log(`  ✕ ${msg}`)));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (await import("node:fs")).existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined, args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
for (const scheme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/fonts\.g|ERR_|net::/.test(m.text()) && errors.push(m.text()));
  await p.goto(`file://${join(here, "harness.html")}`);
  await p.waitForSelector(".card");
  await p.screenshot({ path: join(shots, `rig-studio-home-${scheme}.png`) });
  await p.click(".card");
  await p.waitForSelector(".viewer canvas");
  await p.waitForTimeout(800);
  await p.screenshot({ path: join(shots, `rig-studio-project-${scheme}.png`) });
  if (scheme === "dark") {
    console.log("project view");
    ok((await p.locator(".msg").count()) === 1, "the seeded chat message shows");
    await p.click("text=Plan");
    await p.waitForTimeout(400);
    await p.screenshot({ path: join(shots, "rig-studio-plan.png") });
    await p.click("text=Front");
    await p.waitForTimeout(400);
    await p.screenshot({ path: join(shots, "rig-studio-front.png") });
    await p.click("#tab-checks");
    ok(await p.locator(".finding").first().isVisible(), "checks list findings");
    ok((await p.locator("tbody tr").count()) === 8, "eight towers in the load table");
    await p.screenshot({ path: join(shots, "rig-studio-checks.png") });
    await p.click("#tab-rental");
    const rental = await p.locator(".tbl").innerText();
    ok(/56\s+20\.5" box truss, 10' section/.test(rental), "rental list has 56 × 10' sections");
    ok(/8\s+Self-climber sleeve block/.test(rental), "rental list has 8 sleeves");
    await p.click("#csv-rental");
    await p.click("#tab-files");
    await p.waitForSelector(".file");
    ok(/New/.test(await p.locator(".file").first().innerText()), "an unseen Dropbox file is flagged New");
    await p.screenshot({ path: join(shots, "rig-studio-files.png") });

    console.log("chat edits the rig and saves a version");
    await p.click("#tab-chat");
    await p.fill("#ask", "Put hoists on the two downstage corners");
    await p.click("#send");
    await p.waitForFunction(() => [...window.__DOCS__.keys()].some((k) => k.endsWith("versions/v0002")));
    const v2 = await p.evaluate(() => window.__DOCS__.get("projects/air-pro-roof/versions/v0002"));
    ok(v2.sketch.points.length === 2 && v2.by === "claude" && /corners/.test(v2.note), "version 2 has the two hoists, by Claude, with its note");
    await p.waitForSelector("text=Added a 1-ton hoist");
    ok(true, "Claude's reply shows in the chat");
    const prompt = await p.evaluate(() => JSON.stringify(window.__CALLS__.find((c) => c.sample)));
    ok(/RIG FORMAT/.test(prompt) && /Air Pro self-climber roof/.test(prompt), "the prompt carries the format and the project");

    console.log("pictures go to Claude in the chat and are kept with the message");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    await p.evaluate((b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], "head-block.png", { type: "image/png" }));
      document.getElementById("ask").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    }, png.toString("base64"));
    await p.waitForSelector(".pending-imgs img");
    await p.fill("#ask", "This is what the head block looks like");
    await p.click("#send");
    await p.waitForSelector(".msg-imgs img");
    const sent = await p.evaluate(() => window.__CALLS__.filter((c) => c.sample).pop());
    ok(sent.images === 1 && /I attached a picture/.test(JSON.stringify(sent.sample)), "the picture went to Claude with the request");
    const kept = await p.evaluate(() => [...window.__DOCS__.entries()].find(([k, v]) => k.includes("/chat/") && v.images?.length)?.[1]);
    ok(kept && kept.images.length === 1 && kept.text === "This is what the head block looks like", "the message keeps the picture");
    ok((await p.locator(".pending-imgs").count()) === 0, "the composer clears after sending");

    console.log("a full session starts from the page");
    await p.fill("#ask", "Read the lighting plot in Dropbox and lay out truss over it");
    await p.selectOption("#where", "pc");
    await p.click("#start-session");
    await p.waitForSelector(".job");
    const fire = await p.evaluate(() => window.__CALLS__.find((c) => c.tool === "fire_trigger"));
    ok(fire && fire.input.trigger_id === "trig_pc" && /Rig Studio job \S+\nproject: air-pro-roof/.test(fire.input.text) && /Read the lighting plot/.test(fire.input.text), "fire_trigger went to the PC worker with the job and request");
    const job = await p.evaluate(() => [...window.__DOCS__.entries()].find(([k]) => k.startsWith("jobs/"))?.[1]);
    ok(job && job.status === "queued" && job.where === "pc" && job.pid === "air-pro-roof", "a queued job document was written");
    // A session's progress shows live.
    await p.evaluate(() => {
      const [k, v] = [...window.__DOCS__.entries()].find(([k]) => k.startsWith("jobs/"));
      window.__DOCS__.set(k, { ...v, status: "running", progress: "Reading the drawing in Vectorworks" });
      window.claude.use("db").then((db) => db.doc(k).update({}));
    });
    await p.waitForSelector("text=Reading the drawing in Vectorworks");
    ok(true, "session progress shows live");
    await p.screenshot({ path: join(shots, "rig-studio-chat.png") });

    console.log("approve");
    await p.click("#approve");
    await p.click("#approve-yes");
    await p.waitForFunction(() => { const pr = window.__DOCS__.get("projects/air-pro-roof"); return pr.approved && pr.approved === pr.current; });
    ok(true, "approving writes the approved version");
    await p.click("#build");
    await p.waitForTimeout(300);
    const build = await p.evaluate(() => window.__CALLS__.filter((c) => c.tool === "fire_trigger").length);
    ok(build === 2, "with no Vectorworks here, Build starts a PC session");

    console.log("new project");
    await p.click(".back");
    await p.click("#new-project");
    await p.fill("#np-name", "Test show");
    await p.click("#np-create");
    await p.waitForSelector(".blank-hint");
    const proj = await p.evaluate(() => [...window.__DOCS__.entries()].find(([k, v]) => k.split("/").length === 2 && k.startsWith("projects/") && v.name === "Test show")?.[1]);
    ok(proj && proj.dropbox?.display === "/Rig Studio/Test show" && proj.current === 1, "a new blank project with its Dropbox folder");
    await p.screenshot({ path: join(shots, "rig-studio-blank.png") });

    console.log("pin, archive and delete from the project list");
    await p.click(".back");
    await p.waitForSelector(".card");
    const testId = await p.evaluate(() => [...window.__DOCS__.entries()].find(([k, v]) => k.split("/").length === 2 && v.name === "Test show")[0].split("/")[1]);
    const names = () => p.$$eval(".card h3", (hs) => hs.map((h) => h.textContent.replace("Pinned:", "").trim()));
    ok((await names())[0] === "Test show", "newest project first before pinning");
    await p.click("#menu-air-pro-roof");
    await p.click("#pin-air-pro-roof");
    await p.waitForFunction(() => document.querySelector(".card h3")?.textContent.includes("Air Pro"));
    ok(true, "a pinned project moves to the top");
    ok(await p.locator(".card").first().locator(".pin-mark").isVisible(), "and shows a pin with a word for screen readers");
    await p.screenshot({ path: join(shots, "rig-studio-pinned.png") });
    await p.click(`#menu-${testId}`);
    await p.click(`#archive-${testId}`);
    await p.waitForFunction(() => document.querySelectorAll(".card").length === 1);
    ok(/Archived Test show/.test(await p.locator(".notice").innerText()), "archiving says where it went");
    await p.click("text=Archived projects (1)");
    await p.waitForSelector(`#menu-${testId}`);
    await p.click(`#menu-${testId}`);
    await p.click(`#delete-${testId}`);
    ok(/can't be undone/.test(await p.locator(".card-confirm").innerText()), "deleting asks first and says it can't be undone");
    await p.click(`#delete-yes-${testId}`);
    await p.waitForFunction((id) => ![...window.__DOCS__.keys()].some((k) => k.startsWith(`projects/${id}`)), testId);
    ok(true, "deleting removes the project, its versions and chat");
    ok((await p.evaluate(() => [...window.__DOCS__.keys()].filter((k) => k.startsWith("projects/air-pro-roof/versions")).length)) >= 2, "other projects are untouched");
  }
  ok(errors.length === 0, `no page errors (${scheme})${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
  await ctx.close();
}

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const m = await phone.newPage();
await m.goto(`file://${join(here, "harness.html")}#p-air-pro-roof`);
await m.waitForSelector(".viewer canvas");
await m.waitForTimeout(800);
await m.screenshot({ path: join(shots, "rig-studio-phone.png"), fullPage: true });
const sw = await m.evaluate(() => document.documentElement.scrollWidth);
ok(sw <= 390, `no sideways scroll on a phone (${sw}px)`);
await browser.close();
if (fails.length) {
  console.log(`\n${fails.length} failed`);
  process.exit(1);
}
console.log("\nall passed");
