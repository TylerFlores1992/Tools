// One image edit through Vercel AI Gateway (Flux Kontext Pro, $0.04): the model gets an input image plus a
// prompt. Hard stop at the owner's shirt budget ($0.75 from a $2.045 balance, so never below $1.295).
// args: name input.png aspectRatio "prompt"   → gen/<name>-N.png
import { readFile, writeFile } from "node:fs/promises"; import { existsSync } from "node:fs";
import { gateway } from "@ai-sdk/gateway"; import { generateImage } from "ai";
const KEY = process.env.AI_GATEWAY_API_KEY, FLOOR = 1.295, PRICE = 0.04, MODEL = "bfl/flux-kontext-pro";
const bal = async () => Number((await (await fetch("https://ai-gateway.vercel.sh/v1/credits", { headers: { Authorization: `Bearer ${KEY}` } })).json()).balance);
const [name, input, aspectRatio, prompt] = process.argv.slice(2);
const before = await bal();
if (before - PRICE < FLOOR) { console.log(`stop: balance ${before} would go under ${FLOOR}`); process.exit(1); }
const { image } = await generateImage({ model: gateway.imageModel(MODEL), prompt: { images: [await readFile(input)], text: prompt }, aspectRatio });
let i = 1; while (existsSync(`gen/${name}-${i}.png`)) i++;
await writeFile(`gen/${name}-${i}.png`, image.uint8Array);
console.log(`gen/${name}-${i}.png (${image.mediaType}) balance ${before} → ${await bal()}`);
