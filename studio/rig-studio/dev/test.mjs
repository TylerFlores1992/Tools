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
  "Dropbox/create_file": { file: { name: "x.rigrequest.json", path: "ns:1//x" } },
  "Dropbox/create_folder": { folder: { path: "ns:1//Rig Studio/Test show", path_display: "/Rig Studio/Test show" } },
};
const READOUT = {
  readout: 1, document: "CFF-26.vwx", units: "in",
  layers: [{ name: "Stage", type: "design", elevation: 0 }],
  classes: ["None"],
  objects: [
    { t: "plugin_object", layer: "Lighting", cls: "L", bbox: [0, 0, 1, 1], at: [120, 240, 300], rot: 0, plugin: "Lighting Device", fields: { "Inst Type": "Mac Viper", Weight: "86 lb" } },
    { t: "plugin_object", layer: "Rigging", cls: "T", bbox: [0, 230, 480, 250], at: [0, 240, 310], rot: 0, plugin: "Truss", fields: { Length: "40'" } },
    { t: "rectangle", layer: "Stage", cls: "None", bbox: [0, 0, 480, 360], pts: [[0, 0], [480, 0], [480, 360], [0, 360]], closed: true },
    { t: "polygon", layer: "Stage", cls: "None", bbox: [40, 40, 136, 88], pts: [[40, 40], [136, 40], [136, 88], [40, 88]], closed: true, z: [0, 48], fill: "#3366cc", in: "Riser" },
    { t: "extrude", layer: "Stage", cls: "None", bbox: [200, 40, 240, 80], pts: [[200, 40], [240, 40], [240, 80], [200, 80]], closed: true, z: [0, 30], fill: "#cc6633", mid: 0 },
  ],
  mesh_parts: ["CFF-26.rigmesh1.json"],
};
// Its 3D faces come in a part file beside it: a 40" cube (quarter-inch steps).
const CUBE = { q: 0.25, v: [800,160,0, 960,160,0, 960,320,0, 800,320,0, 800,160,120, 960,160,120, 960,320,120, 800,320,120], f: [4,0,1,2,3, 4,4,5,6,7, 4,0,1,5,4, 4,1,2,6,5, 4,2,3,7,6, 4,3,0,4,7] };
MCP["Dropbox/list_folder"].entries.push({ name: "CFF-26.rigmesh1.json", path: "ns:1//CFF-26.rigmesh1.json", file_id: "id:mesh1", modified_time: "2026-11-09T17:00:00Z", object_type: "file", file: { size: 400 } });
MCP["Dropbox/fetch/id:mesh1"] = { id: "id:mesh1", text: JSON.stringify({ rigmesh: 1, meshes: { "0": CUBE } }) };
MCP["Dropbox/list_folder"].entries.push({ name: "CFF-26.rigread.json", path: "ns:1//CFF-26.rigread.json", path_display: "/Pickle/Pickled/Plans/Accurate/CFF-26.rigread.json", file_id: "id:ro", modified_time: "2026-11-09T17:00:00Z", object_type: "file", file: { size: 900 } });
MCP["Dropbox/list_folder"].entries.push({ name: "CFF-26.vwx", path: "ns:1//CFF-26.vwx", path_display: "/Pickle/Pickled/Plans/Accurate/CFF-26.vwx", file_id: "id:cff", modified_time: "2026-11-09T07:00:00Z", object_type: "file", file: { size: 79000000 } });
MCP["Dropbox/fetch"] = { id: "id:ro", title: "CFF-26.rigread.json", text: process.env.RS_READOUT ? (await import("node:fs")).readFileSync(process.env.RS_READOUT, "utf8") : JSON.stringify(READOUT) };
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
  p.on("pageerror", (e) => {
  errors.push(e.message);
  if (process.env.RS_DEV) console.log("PAGEERROR STACK:", e.stack);
});
if (process.env.RS_DEV) p.on("console", (m) => m.type() === "error" && console.log("CONSOLE ERROR:", m.text().slice(0, 3000)));
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
    const t0 = Date.now();
    await p.click('[id="open-readout-id:ro"]', { timeout: process.env.RS_READOUT ? 300000 : 30000 });
    if (process.env.RS_READOUT) {
      // A real read-out: just open it and take pictures (dev aid, not part of the checks).
      console.log("click returned after", Date.now() - t0, "ms");
      await p.waitForFunction(() => [...window.__DOCS__.keys()].filter((k) => k.startsWith("projects/air-pro-roof/layers/")).length > 3, null, { timeout: 300000 });
      await p.waitForTimeout(4000);
      console.log("real read-out opened in", Date.now() - t0, "ms; layers:", await p.evaluate(() => [...window.__DOCS__.keys()].filter((k) => k.startsWith("projects/air-pro-roof/layers/")).length));
      await p.click("#tab-layers").catch(() => {});
      await p.waitForTimeout(1500);
      await p.screenshot({ path: join(shots, "rig-studio-real-readout.png") });
      for (const [b, f] of [["3D", "rig-studio-real-3d.png"], ["Plan", "rig-studio-real-plan.png"]]) {
        await p.getByRole("button", { name: b, exact: true }).click().catch(() => {});
        await p.getByRole("button", { name: "Fit", exact: true }).click().catch(() => {});
        await p.waitForTimeout(1500);
        await p.screenshot({ path: join(shots, f) });
      }
      // Close-ups (RS_CLOSE="x,y,steps;x,y,steps"): back to 3D, zoom in on a screen point.
      for (const [i, spec] of (process.env.RS_CLOSE ?? "").split(";").filter(Boolean).entries()) {
        const [x, y, steps] = spec.split(",").map(Number);
        const view = spec.split(",")[3] === "plan" ? "Plan" : "3D";
        await p.getByRole("button", { name: view, exact: true }).click().catch(() => {});
        await p.getByRole("button", { name: "Fit", exact: true }).click().catch(() => {});
        await p.waitForTimeout(800);
        await p.mouse.move(x, y);
        for (let k = 0; k < steps; k++) {
          await p.mouse.wheel(0, -240);
          await p.waitForTimeout(60);
        }
        await p.waitForTimeout(1500);
        await p.screenshot({ path: join(shots, `rig-studio-real-close${i + 1}.png`) });
      }
      console.log("errors:", errors.join(" | ") || "none");
      process.exit(0);
    }
    await p.waitForFunction(() => [...window.__DOCS__.keys()].filter((k) => k.startsWith("projects/air-pro-roof/layers/")).length === 3);
    const kinds = await p.evaluate(() => [...window.__DOCS__.entries()].filter(([k]) => k.startsWith("projects/air-pro-roof/layers/")).map(([, v]) => v.kind).sort().join());
    ok(kinds === "fixtures,rig,shapes", "a read-out from Dropbox opens as fixtures, the existing rig and outlines");
    ok(/1 lighting fixtures, 1 truss pieces/.test(await p.locator(".toast-wrap").innerText().catch(() => "")), "and says what was in it");
    const fetched = await p.evaluate(() => window.__CALLS__.find((c) => c.tool === "fetch"));
    ok(fetched && fetched.input.id === "id:ro", "read through Dropbox's fetch with the file id");
    await p.click('[id="open-readout-id:ro"]');
    await p.waitForTimeout(400);
    ok((await p.evaluate(() => [...window.__DOCS__.keys()].filter((k) => k.startsWith("projects/air-pro-roof/layers/")).length)) === 3, "opening it again replaces the layers instead of doubling them");
    const blocks = await p.evaluate(() => {
      let n = 0;
      window.__rsViewer?.refs?.traverse((o) => { if (o.isMesh && o.material?.type === "MeshStandardMaterial" && o.geometry?.attributes?.position?.count >= 36) n++; });
      return n;
    });
    ok(blocks >= 1, `a 3D object from the drawing is drawn as a block (${blocks})`);
    const faced = await p.evaluate(() => window.__DOCS__ && [...window.__DOCS__.entries()].some(([k, v]) => k.startsWith("projects/air-pro-roof/layers/") && (v.shapes ?? []).some((s) => s.m && s.m.f.length === 30)));
    ok(faced, "its real faces came from the part file in Dropbox and are kept on the layer");
    ok(!(await p.locator(".file", { hasText: "rigmesh" }).count()), "the part files stay out of the file list");

    ok(/Read it out again on my PC/.test(await p.locator('[id="read-id:cff"]').innerText().catch(() => "")), "a drawing already read out can be read out again");
    ok(/Read it out on my PC/.test(await p.locator('[id="read-id:1"]').innerText()), "one never read out says so plainly");

    console.log("reading a drawing out: a request in Dropbox for the PC's connector, waking the PC first");
    await p.evaluate(() => window.__setDoc("config/workers", { cloud: "trig_cloud", pc: "trig_pc", wake: true }));
    await p.click('[id="read-id:1"]');
    await p.waitForSelector('[id="job-id:1"]');
    const jk = await p.evaluate(() => [...window.__DOCS__.entries()].find(([k, v]) => k.startsWith("jobs/") && v.file === "id:1")?.[0]);
    const jid = jk.split("/")[1];
    const cf = await p.evaluate(() => window.__CALLS__.filter((c) => c.tool === "create_file").at(-1));
    ok(cf && cf.input.path === `ns:1915330336//Pickle/Pickled/Plans/Accurate/Air Pro - Self Climber (09.07.22).${jid}.rigrequest.json` && JSON.parse(cf.input.content).job === jid, "a request file naming the job goes beside the drawing in Dropbox");
    const wf = await p.evaluate(() => window.__CALLS__.filter((c) => c.tool === "fire_trigger").at(-1));
    ok(wf.input.trigger_id === "trig_cloud" && /^wake the PC for job \S+\nRig Studio job /.test(wf.input.text), "the cloud worker is asked to check and wake the PC");
    ok(/Checking whether your PC is on/.test(await p.locator('[id="job-id:1"]').innerText()), "the status shows under the file at once");
    ok(await p.locator('[id="read-id:1"]').isDisabled(), "the button waits while the job runs (no second copy)");
    ok((await p.locator(".tabs [aria-selected=true], #tab-files[aria-selected=true]").count()) >= 1 && (await p.locator(".file").count()) > 0, "and the page stays on Files");
    await p.evaluate((k) => window.claude.use("db").then((db) => db.doc(k).update({ awake: true, progress: "Your PC is awake." })), jk);
    await p.waitForTimeout(600);
    ok((await p.evaluate(() => window.__CALLS__.filter((c) => c.tool === "fire_trigger" && c.input.trigger_id === "trig_pc").length)) === 0, "no PC session is started: the connector answers the request itself");
    await p.evaluate((id) => {
      window.__MCP__["Dropbox/list_folder"].entries.push({ name: "Air Pro - Self Climber (09.07.22).rigstatus.json", path: "ns:1//s", file_id: "id:st", modified_time: new Date(Date.now() + 2000).toISOString().slice(0, 19) + "Z", object_type: "file", file: { size: 90 } });
      window.__MCP__["Dropbox/fetch/id:st"] = { id: "id:st", text: JSON.stringify({ job: id, state: "done", message: "Read out on your PC: 12 objects, 3 layers, 4 symbols, 1 lighting fixtures." }) };
    }, jid);
    await p.waitForFunction(() => /✓ Done\. Read out on your PC: 12 objects/.test(document.querySelector('[id="job-id:1"]')?.textContent ?? ""), null, { timeout: 15000 });
    ok(true, "the PC's status file finishes the job, in its words");
    ok(!(await p.locator(".file", { hasText: "rigstatus" }).count()), "the request and status files stay out of the file list");
    await p.evaluate((k) => {
      window.__setDoc("config/workers", { cloud: "trig_cloud", pc: "trig_pc" });
      window.__DOCS__.delete(k);
      for (let i = window.__CALLS__.length - 1; i >= 0; i--) if (window.__CALLS__[i].tool === "fire_trigger") window.__CALLS__.splice(i, 1);
      window.__MCP__["Dropbox/list_folder"].entries = window.__MCP__["Dropbox/list_folder"].entries.filter((e) => e.file_id !== "id:st");
    }, jk);

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
    ok((await p.locator("a.wake").count()) === 0, "no separate wake button: the job wakes the PC itself");
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

    console.log("pin, archive and delete full sessions");
    const reqs = () => p.$$eval(".section .job-req", (els) => els.map((e) => e.textContent));
    const before = await reqs();
    ok(before.length === 2, "two sessions listed");
    await p.locator(".job-menu-btn").nth(1).click();
    await p.locator("[id^=pin-job-]").click();
    await p.waitForFunction((first) => document.querySelector(".section .job-req")?.textContent !== first, before[0]);
    ok((await reqs())[0] === before[1], "a pinned session moves to the top");
    await p.locator(".job-menu-btn").nth(1).click();
    await p.locator("[id^=archive-job-]").click();
    await p.waitForFunction(() => document.querySelectorAll(".section .job-req").length === 1);
    ok(await p.locator("text=Archived sessions (1)").isVisible(), "an archived session moves to Archived sessions");
    await p.locator(".job-menu-btn").first().click();
    await p.locator("[id^=delete-job-]").click();
    ok(/doesn't stop the session/.test(await p.locator(".card-confirm").innerText()), "deleting a running session's record says it keeps running");
    await p.locator("[id^=delete-yes-job-]").click();
    await p.waitForFunction(() => [...window.__DOCS__.keys()].filter((k) => k.startsWith("jobs/")).length === 1);
    ok(true, "deleting removes only that session's record");
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
