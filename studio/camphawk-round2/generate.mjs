// Generates CampHawk round-2 art through Vercel AI Gateway (free credits only).
// Setup once: (cd studio/camphawk-round2 && npm i)
// Usage: node studio/camphawk-round2/generate.mjs <name> [variants]
// Prompts live in prompts.mjs; raw output goes to studio/camphawk-round2/out/ (gitignored).
// Never overwrites: new variants get the next free number.
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { gateway } from "@ai-sdk/gateway";
import { generateImage } from "ai";
import { PROMPTS } from "./prompts.mjs";

const KEY = process.env.AI_GATEWAY_API_KEY;
const FLOOR = 2; // stop while this much free credit is left; never buy more
if (!KEY) throw new Error("AI_GATEWAY_API_KEY is not set");

const [name, n = "1"] = process.argv.slice(2);
const job = PROMPTS[name];
if (!job) throw new Error(`unknown image: ${name}. Known: ${Object.keys(PROMPTS).join(", ")}`);

async function balance() {
  const r = await fetch("https://ai-gateway.vercel.sh/v1/credits", { headers: { Authorization: `Bearer ${KEY}` } });
  return Number((await r.json()).balance);
}

const out = new URL("./out/", import.meta.url);
await mkdir(out, { recursive: true });
const taken = (await readdir(out)).filter((f) => f.startsWith(`${name}-`)).length;
for (let i = taken + 1; i <= taken + Number(n); i++) {
  const before = await balance();
  if (before < FLOOR) { console.log(`stop: balance ${before} is under ${FLOOR}`); break; }
  const { image } = await generateImage({
    model: gateway.imageModel(job.model),
    prompt: job.prompt,
    ...job.params,
  });
  const ext = image.mediaType?.split("/")[1] ?? "png";
  const file = new URL(`${name}-${job.model.replace(/\W+/g, "_")}-${i}.${ext}`, out);
  await writeFile(file, image.uint8Array);
  console.log(`${name} #${i}: ${file.pathname}; balance ${before} → ${await balance()}`);
}
