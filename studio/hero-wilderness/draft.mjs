// Drafts hero art on Cloudflare Workers AI, free tier only (docs/design/hero-wilderness-cyber.md §4.2).
// Usage: CLOUDFLARE_ACCOUNT_ID=<id> node studio/hero-wilderness/draft.mjs <a|b> [count] [wide|tall] [klein|schnell]
// No dependencies. Output and a provenance log go to studio/hero-wilderness/out/ (gitignored).
// Never overwrites; stops before the day's estimated neurons pass BUDGET.
import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { DIRECTIONS, SIZES } from "./prompts.mjs";

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!TOKEN) throw new Error("CLOUDFLARE_API_TOKEN is not set");
if (!ACCOUNT) throw new Error("CLOUDFLARE_ACCOUNT_ID is not set (dashboard → Workers AI → account ID)");

const MODELS = {
  klein: { id: "@cf/black-forest-labs/flux-2-klein-4b", licence: "Apache-2.0" },
  schnell: { id: "@cf/black-forest-labs/flux-1-schnell", licence: "Apache-2.0" },
};
const BUDGET = 9000; // of the 10,000 free neurons a day (resets 00:00 UTC); leaves room for other use

const [dir, n = "4", size = "wide", modelKey = "klein"] = process.argv.slice(2);
const prompts = DIRECTIONS[dir];
const model = MODELS[modelKey];
const { width, height } = SIZES[size] ?? {};
if (!prompts || !model || !width) throw new Error("usage: draft.mjs <a|b> [count] [wide|tall] [klein|schnell]");

// Estimates from the price table (512 x 512 tiles); read the real figure in the dashboard.
const tiles = Math.ceil(width / 512) * Math.ceil(height / 512);
const cost = modelKey === "klein" ? tiles * 26.05 : tiles * 4.8 + 4 * 9.6;

const out = new URL("./out/", import.meta.url);
await mkdir(out, { recursive: true });
const ledgerFile = new URL("ledger.json", out);
const today = new Date().toISOString().slice(0, 10);
let ledger = {};
try { ledger = JSON.parse(await readFile(ledgerFile, "utf8")); } catch {}
ledger[today] ??= 0;

async function run(prompt, seed) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/${model.id}`;
  const headers = { Authorization: `Bearer ${TOKEN}` };
  let body;
  if (modelKey === "klein") {
    // FLUX.2 takes multipart form fields, even with only a prompt.
    body = new FormData();
    for (const [k, v] of Object.entries({ prompt, width, height, seed })) body.append(k, String(v));
  } else {
    // schnell takes JSON and has no size control (1024 x 1024).
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ prompt, steps: 4, seed });
  }
  const r = await fetch(url, { method: "POST", headers, body });
  const type = r.headers.get("content-type") ?? "";
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  if (type.includes("json")) {
    const j = await r.json();
    const b64 = j.result?.image ?? j.image;
    if (!b64) throw new Error(`no image in response: ${JSON.stringify(j).slice(0, 300)}`);
    return Buffer.from(b64, "base64");
  }
  return Buffer.from(await r.arrayBuffer());
}

const taken = (await readdir(out)).filter((f) => f.startsWith(`${dir}-${size}-${modelKey}-`)).length;
for (let i = taken + 1; i <= taken + Number(n); i++) {
  if (ledger[today] + cost > BUDGET) { console.log(`stop: ~${Math.round(ledger[today])} neurons used today`); break; }
  const p = (i - 1) % prompts.length;
  const seed = Math.floor(Math.random() * 2 ** 31);
  const bytes = await run(prompts[p], seed);
  const ext = bytes[0] === 0x89 ? "png" : bytes[0] === 0xff ? "jpg" : "webp";
  const file = `${dir}-${size}-${modelKey}-${String(i).padStart(2, "0")}.${ext}`;
  await writeFile(new URL(file, out), bytes);
  ledger[today] += cost;
  await writeFile(ledgerFile, JSON.stringify(ledger, null, 2));
  // Provenance (§4.4): everything needed to fill the table if this file ships.
  await appendFile(new URL("log.jsonl", out), JSON.stringify({
    file, model: model.id, licence: model.licence, prompt: prompts[p], promptIndex: p, seed, width, height,
    date: new Date().toISOString(), cost: `~${Math.round(cost)} neurons (free tier)`,
  }) + "\n");
  console.log(`${file}  prompt ${p}  seed ${seed}  ~${Math.round(ledger[today])} neurons today`);
}
