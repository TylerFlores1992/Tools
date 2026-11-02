// Page Turner on the home server. Keeps a real Chrome window on a course, clicks Next when the
// page allows it, and answers only to the site (bearer key, loopback, one Funnel path).
// Screens are held in memory for the one request that asks for them; nothing is written to disk.
import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { CLICK_NEXT, SCAN_FRAME, decide, mergeFrames, newMemory } from "./detect.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const envFile = join(HERE, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

const TOKEN = process.env.COURSE_TOKEN;
const TOPIC = process.env.NTFY_TOPIC;
const PORT = Number(process.env.COURSE_PORT || 8095);
const SITE = "https://tylerflores.dev/private/course";
const MOUNT = "/course";
if (!TOKEN || TOKEN.length < 32) { console.error("COURSE_TOKEN is missing. Run setup.ps1 first."); process.exit(1); }

const VIEW = { width: 1100, height: 800 };
const context = await chromium.launchPersistentContext(process.env.COURSE_PROFILE || join(HERE, "profile"), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: "chrome" }),
  headless: Boolean(process.env.COURSE_HEADLESS),
  viewport: VIEW,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

const state = { status: "stopped", message: "Open your course, then press Start.", clicks: 0, alert: null, updatedAt: Date.now() };
let memory = newMemory();
let lastAlert = "";
const say = (status, message, alert = null) => Object.assign(state, { status, message, alert, updatedAt: Date.now() });

/** The newest open tab: course players often open themselves in a pop-up. */
const page = () => context.pages().filter((p) => !p.isClosed()).at(-1) ?? null;

async function push(reason, message) {
  if (!TOPIC) return;
  try {
    await fetch(`https://ntfy.sh/${TOPIC}`, {
      method: "POST",
      headers: { Title: "Page Turner", Click: SITE, Priority: reason === "question" ? "high" : "default" },
      body: message,
      signal: AbortSignal.timeout(10_000),
    });
  } catch { console.error("The phone alert didn't send."); }
}

async function scan(p) {
  const results = await Promise.all(p.frames().map((f) => f.evaluate(SCAN_FRAME).catch(() => null)));
  return { ...mergeFrames(results.filter(Boolean)), url: p.url() };
}

async function clickNext(p) {
  for (const f of [...p.frames()].reverse()) {
    if (await f.evaluate(CLICK_NEXT).catch(() => false)) return true;
  }
  return false;
}

let busy = false;
async function tick() {
  if (busy || state.status === "stopped" || state.status === "paused") return;
  busy = true;
  try {
    const p = page();
    if (!p) { say("needs-you", "The course window was closed.", "closed"); return; }
    const d = decide(await scan(p), memory, Date.now());
    if (state.status === "stopped" || state.status === "paused") return; // pressed during the scan
    say(d.status, d.message, d.alert);
    const key = d.alert ? `${d.alert}|${p.url()}|${memory.since}` : "";
    if (key && key !== lastAlert) await push(d.alert, d.message);
    lastAlert = key;
    if (d.click && (await clickNext(p))) state.clicks += 1;
  } catch { /* a page mid-navigation can't be read; the next tick tries again */ } finally { busy = false; }
}
setInterval(tick, 1000);

const keyHash = createHash("sha256").update(TOKEN).digest();
function authorized(req) {
  const given = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  return timingSafeEqual(createHash("sha256").update(given).digest(), keyHash);
}
async function body(req) {
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 4000) throw new Error("too large"); }
  return raw ? JSON.parse(raw) : {};
}
const KEYS = new Set(["Enter", "Tab", "Backspace", "Escape", "Space"]);
const finite = (n) => typeof n === "number" && Number.isFinite(n);

async function route(method, path, req, res) {
  const json = (code, data) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(data)); };
  if (method === "GET" && path === "/state") {
    return json(200, { status: state.status, message: state.message, clicks: state.clicks, title: await page()?.title().catch(() => "") ?? "", updatedAt: state.updatedAt });
  }
  const p = page();
  if (method === "GET" && path === "/screen") {
    if (!p) return json(409, { error: "The course window is closed." });
    const shot = await p.screenshot({ type: "jpeg", quality: 60, timeout: 8000 });
    res.writeHead(200, { "content-type": "image/jpeg", "cache-control": "no-store" });
    return res.end(shot);
  }
  if (method !== "POST") return json(404, { error: "Not found." });
  const b = await body(req);
  if (path === "/control") {
    if (b.action === "start") { memory = newMemory(); say("running", "Starting."); }
    else if (b.action === "pause") say("paused", "Paused.");
    else if (b.action === "stop") say("stopped", "Stopped.");
    else return json(400, { error: "That isn't a control." });
    return json(200, { ok: true });
  }
  if (!p) return json(409, { error: "The course window is closed." });
  if (path === "/tap" && finite(b.x) && finite(b.y) && b.x >= 0 && b.x <= 1 && b.y >= 0 && b.y <= 1) {
    await p.mouse.click(b.x * VIEW.width, b.y * VIEW.height);
    memory.readyAt = 0;
    return json(200, { ok: true });
  }
  if (path === "/scroll" && finite(b.dy) && Math.abs(b.dy) <= 2000) { await p.mouse.wheel(0, b.dy); return json(200, { ok: true }); }
  if (path === "/type" && typeof b.text === "string" && b.text.length <= 500) { await p.keyboard.insertText(b.text); return json(200, { ok: true }); }
  if (path === "/key" && KEYS.has(b.key)) { await p.keyboard.press(b.key); return json(200, { ok: true }); }
  if (path === "/open" && typeof b.url === "string" && /^https?:\/\//i.test(b.url)) {
    await p.goto(b.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    return json(200, { ok: true });
  }
  return json(400, { error: "That request wasn't understood." });
}

createServer(async (req, res) => {
  try {
    if (!authorized(req)) { res.writeHead(401); return res.end(); }
    const raw = new URL(req.url, "http://x").pathname;
    await route(req.method, raw.startsWith(`${MOUNT}/`) ? raw.slice(MOUNT.length) : raw, req, res);
  } catch {
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "The course window didn't respond." }));
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Page Turner is ready on this computer, port ${PORT}.`));
