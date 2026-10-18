// Finals for the home hero on Vercel AI Gateway (Flux 1.1 Ultra), from the drafts the owner picked.
// Setup once: (cd studio/hero-wilderness && npm ci)
// Usage: node studio/hero-wilderness/final.mjs <wide|tall> [variants] [imagePromptStrength]
// The picked draft goes in as BFL's image prompt so the composition carries over.
// Output and provenance go to out/finals/ (gitignored). Never overwrites.
import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { gateway } from "@ai-sdk/gateway";
import { generateImage } from "ai";
import { FINAL_C } from "./prompts.mjs";

const KEY = process.env.AI_GATEWAY_API_KEY;
const FLOOR = 0.25; // stop while this much free credit is left; never buy more
if (!KEY) throw new Error("AI_GATEWAY_API_KEY is not set");

const MODEL = "bfl/flux-pro-1.1-ultra";
// The owner's picks (2026-10-18): direction C, prompt 0.
const PICKS = {
  wide: { draft: "c-wide-klein-09.jpg", aspectRatio: "16:9" },
  tall: { draft: "c-tall-klein-05.jpg", aspectRatio: "9:16" },
};
const [cut, n = "1", strength = "0.5"] = process.argv.slice(2);
const pick = PICKS[cut];
if (!pick) throw new Error("usage: final.mjs <wide|tall> [variants] [imagePromptStrength]");
const prompt = FINAL_C;

async function balance() {
  const r = await fetch("https://ai-gateway.vercel.sh/v1/credits", { headers: { Authorization: `Bearer ${KEY}` } });
  return Number((await r.json()).balance);
}

const out = new URL("./out/finals/", import.meta.url);
await mkdir(out, { recursive: true });
const draft = await readFile(new URL(`../${pick.draft}`, out));
const taken = (await readdir(out)).filter((f) => f.startsWith(`${cut}-`) && !f.endsWith(".jsonl")).length;
for (let i = taken + 1; i <= taken + Number(n); i++) {
  const before = await balance();
  if (before < FLOOR) { console.log(`stop: balance ${before} is under ${FLOOR}`); break; }
  const { image } = await generateImage({
    model: gateway.imageModel(MODEL),
    prompt,
    aspectRatio: pick.aspectRatio,
    providerOptions: { blackForestLabs: { raw: true, imagePrompt: draft.toString("base64"), imagePromptStrength: Number(strength) } },
  });
  const ext = image.mediaType?.split("/")[1] ?? "png";
  const file = `${cut}-ultra-${String(i).padStart(2, "0")}.${ext}`;
  await writeFile(new URL(file, out), image.uint8Array);
  const after = await balance();
  await appendFile(new URL("log.jsonl", out), JSON.stringify({
    file, model: MODEL, licence: "BFL API terms via Vercel AI Gateway (output terms not yet checked)", prompt: "prompts.mjs FINAL_C (c[0] toned down)",
    from: pick.draft, imagePromptStrength: Number(strength), aspectRatio: pick.aspectRatio, raw: true,
    date: new Date().toISOString(), cost: `$${(before - after).toFixed(3)} free credit`,
  }) + "\n");
  console.log(`${file}: balance ${before} → ${after}`);
}
