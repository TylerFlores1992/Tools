// One Recraft image through AI Gateway (REST). Hard stop at the owner's budget: $0.75 from $2.045.
import { writeFileSync, mkdirSync, existsSync } from "fs";
const KEY = process.env.AI_GATEWAY_API_KEY, FLOOR = 1.30;
const bal = async () => Number((await (await fetch("https://ai-gateway.vercel.sh/v1/credits", { headers: { Authorization: `Bearer ${KEY}` } })).json()).balance);
const [name, model, size, prompt, extra] = process.argv.slice(2);
const before = await bal();
if (before < FLOOR + 0.1) { console.log(`stop: balance ${before}`); process.exit(1); }
const body = { model, prompt, n: 1, size, ...(extra ? JSON.parse(extra) : {}) };
const r = await fetch("https://ai-gateway.vercel.sh/v1/images/generations", { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const j = await r.json();
if (!r.ok) { console.log(r.status, JSON.stringify(j).slice(0, 600)); process.exit(1); }
mkdirSync("gen", { recursive: true });
let i = 1; while (existsSync(`gen/${name}-${i}.png`) || existsSync(`gen/${name}-${i}.svg`)) i++;
const d = j.data[0]; const buf = Buffer.from(d.b64_json, "base64");
const ext = buf.slice(0, 5).toString().includes("<") ? "svg" : "png";
writeFileSync(`gen/${name}-${i}.${ext}`, buf);
console.log(`gen/${name}-${i}.${ext}  balance ${before} → ${await bal()}`);
