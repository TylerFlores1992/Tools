// Print kit for the owner's pick from round 4 (2026-10-08): no. 7, "Short reflection" (round4.mjs id "dashes").
// Renders the back at true size (11.5 in at 300 dpi = 3450 px wide), snaps every pixel to the nearest ink,
// writes one black-on-white separation per ink, and traces each to a vector SVG sized in inches (same tracer
// settings as kit.mjs). Also writes the 300 dpi transparent PNG that DTF and DTG printers take.
// Needs out4/ from `python3 prep4.py` (the peak without its reflection). Chest prints are unchanged (chest.mjs).
import { chromium } from "playwright-core"; import potrace from "potrace"; import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { FONTS } from "./lib.mjs";
import { designs } from "./round4.mjs";

const ID = process.argv[2] ?? "dashes", W = 3450, INCHES = 11.5;
const pick = designs.find((d) => d.id === ID);
const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const jobs = [
  ["one", "#24382A", "still-water-one-ink_back", [["forest", "#24382A"]]],
  ["three", "#2A3B2E", "still-water_back", [["forest", "#2A3B2E"], ["moss", "#4E5C3B"], ["mist", "#E2E6DC"]]],
];
mkdirSync("out4/final", { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
for (const [v, ink, out, inks] of jobs) {
  const { h: h0, art } = pick.fn(ink, v); const h = Math.ceil(h0);
  await page.setViewportSize({ width: W, height: h });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${FONTS} html,body{margin:0;background:transparent}</style><svg width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" style="display:block">${art}</svg>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
  const shot = `out4/final/${out}-render.png`;
  await page.screenshot({ path: shot, omitBackground: true });
  // every pixel with ink becomes exactly one ink (antialiased edges go to the nearest), the rest stays clear
  const { data, info } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height, pal = inks.map(([, hx]) => hex2(hx));
  const which = new Int8Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (data[4 * i + 3] < 128) continue;
    let best = 0, bd = Infinity;
    for (let k = 0; k < pal.length; k++) { const d = (data[4 * i] - pal[k][0]) ** 2 + (data[4 * i + 1] - pal[k][1]) ** 2 + (data[4 * i + 2] - pal[k][2]) ** 2; if (d < bd) { bd = d; best = k; } }
    which[i] = best;
  }
  const rgba = Buffer.alloc(4 * n);
  for (let i = 0; i < n; i++) if (which[i] >= 0) { const c = pal[which[i]]; rgba[4 * i] = c[0]; rgba[4 * i + 1] = c[1]; rgba[4 * i + 2] = c[2]; rgba[4 * i + 3] = 255; }
  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(`kit/${out}_300dpi.png`);
  const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${INCHES}in" height="${((INCHES * info.height) / info.width).toFixed(3)}in" viewBox="0 0 ${info.width} ${info.height}">${body}</svg>`;
  const all = [];
  for (let k = 0; k < inks.length; k++) {
    const [name, hx] = inks[k], sep = Buffer.alloc(n, 255);
    for (let i = 0; i < n; i++) if (which[i] === k) sep[i] = 0;
    const file = `out4/final/${out}-sep${k + 1}.png`;
    await sharp(sep, { raw: { width: info.width, height: info.height, channels: 1 } }).png().toFile(file);
    const d = await new Promise((res, rej) => potrace.trace(file, { turdSize: 8, optTolerance: 0.3, threshold: 128 }, (e, s) => e ? rej(e) : res(s.match(/ d="([^"]+)"/)?.[1] ?? "")));
    writeFileSync(`kit/${out}_${k + 1}-${name}.svg`, svg(`<path fill="${hx}" fill-rule="evenodd" d="${d}"/>`));
    all.push(`<path fill="${hx}" fill-rule="evenodd" d="${d}"/>`);
  }
  if (inks.length > 1) writeFileSync(`kit/${out}_all-inks.svg`, svg(all.join("")));
  console.log(out, `${info.width} x ${info.height} px = ${INCHES} x ${(info.height / 300).toFixed(2)} in`);
}
await browser.close();
