// One shareable image of every round-4 option (numbered, the old diamond last). Run from this folder after round4.mjs.
import { chromium } from "playwright-core"; import { readFileSync } from "fs";
const FONTS = readFileSync("fonts.css", "utf8");
const b64 = (f) => `data:image/${f.endsWith("jpg") ? "jpeg" : "png"};base64,${readFileSync(f).toString("base64")}`;
const items = [["arch", "Arch window"], ["panorama", "Panorama"], ["badge", "Round badge"], ["plate", "Lake plate"], ["shoreline", "Shoreline"], ["banner", "Waterline banner"], ["dashes", "Short reflection"]];
const cell = (src, n, name, before = false) => `<div class="c${before ? " b" : ""}"><div class="img"><img src="${src}"></div><div class="lab"><span class="n">${n}</span>${name}</div></div>`;
const html = `<!doctype html><meta charset=utf-8><style>${FONTS}
body{margin:0;background:#F3EFE5;font-family:"Josefin Sans";color:#22352A}
.wrap{width:1600px;padding:60px 60px 50px;box-sizing:border-box}
h1{font-size:64px;letter-spacing:4px;margin:0 0 6px;font-weight:700}
p{font-family:Oswald;font-weight:500;font-size:28px;letter-spacing:1.5px;margin:0 0 40px;color:#4F5E52}
.g{display:grid;grid-template-columns:repeat(2,1fr);gap:36px}
.img{background:#E9E2D0;border:2px solid #D3CBB7;height:820px;display:flex;align-items:center;justify-content:center}
.img img{max-width:100%;max-height:100%}
.lab{font-size:40px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-top:16px;display:flex;align-items:center;gap:16px}
.n{display:inline-flex;width:58px;height:58px;border-radius:50%;background:#22352A;color:#F3EFE5;align-items:center;justify-content:center;font-size:32px;padding-top:4px;box-sizing:border-box}
.b .img{background:#E2DCCB}.b .lab{color:#7A6F5C}.b .n{background:transparent;border:3px solid #7A6F5C;color:#7A6F5C;width:auto;border-radius:30px;padding:4px 14px 0;font-size:24px;letter-spacing:2px}
</style><div class="wrap"><h1>CAMPHAWK SHIRT · BACK PRINT</h1><p>WHICH NUMBER DO YOU LIKE BEST? THE LAST ONE IS THE OLD “DIAMOND”.</p><div class="g">
${items.map(([id, name], i) => cell(b64(`out4/${id}-flat.png`), i + 1, name)).join("")}
${cell(b64("out4/old-diamond.png"), "OLD", "The diamond", true)}
</div></div>`;
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); const p = await br.newPage({ viewport: { width: 1600, height: 1000 } });
await p.setContent(html, { waitUntil: "load" }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
await p.screenshot({ path: "out4/options.png", fullPage: true }); await br.close();
