// Print kit for round 5 (2026-10-08): the owner's pick, round 4 no. 7 "Short reflection", polished (round5.mjs).
// Renders the back at 300 dpi (on an 11.5 in = 3450 px canvas), snaps every pixel to the nearest ink, then
// finish5.py applies the print rules, trims to the art, writes the 300 dpi PNG that DTF and DTG printers take
// and one trapped separation per ink, which this traces to vector SVGs sized in inches (as kit.mjs did).
// Needs out5/ from `python3 prep4.py`, `python3 polish5.py` and `python3 hatch5.py`. Chest prints are unchanged (chest.mjs).
import { chromium } from "playwright-core"; import potrace from "potrace"; import sharp from "sharp";
import { writeFileSync, mkdirSync, readFileSync } from "fs"; import { execFileSync } from "child_process";
import { FONTS } from "./lib.mjs";
import { design } from "./round5.mjs";

const W = 3450;
// a minimal .npy writer (int8, C order) for the label array
const npy = (arr, h, w) => { let hd = `{'descr': '|i1', 'fortran_order': False, 'shape': (${h}, ${w}), }`; hd += " ".repeat(63 - ((10 + hd.length) % 64)) + "\n";
  const pre = Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0]), len = Buffer.alloc(2); len.writeUInt16LE(hd.length);
  return Buffer.concat([pre, len, Buffer.from(hd, "latin1"), Buffer.from(arr.buffer)]); };
const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const jobs = [
  ["one", "#24382A", "still-water-one-ink_back", [["forest", "#24382A"]]],
  ["three", "#2A3B2E", "still-water_back", [["forest", "#2A3B2E"], ["moss", "#4E5C3B"], ["mist", "#E2E6DC"]]],
];
mkdirSync("out5/final", { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
for (const [v, ink, out, inks] of jobs) {
  const { h, art, typeTop } = design(v);
  await page.setViewportSize({ width: W, height: h });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${FONTS} html,body{margin:0;background:transparent}</style><svg width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" style="display:block">${art}</svg>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
  const shot = `out5/final/${out}-render.png`;
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
  // ink labels → finish5.py (prep, trim, trap, 300 dpi PNG and separations) → trace each separation
  const labels = new Int8Array(n); for (let i = 0; i < n; i++) labels[i] = which[i];
  writeFileSync(`out5/final/${out}-labels.npy`, npy(labels, info.height, info.width));
  execFileSync("python3", ["-W", "ignore", "finish5.py", out, inks.map(([, hx]) => hx).join(","), String(typeTop)], { stdio: "inherit" });
  const size = JSON.parse(readFileSync(`out5/final/${out}-size.json`, "utf8"));
  const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${(size.w / 300).toFixed(3)}in" height="${(size.h / 300).toFixed(3)}in" viewBox="0 0 ${size.w} ${size.h}">${body}</svg>`;
  const all = [];
  for (let k = 0; k < inks.length; k++) {
    const [name, hx] = inks[k], file = `out5/final/${out}-sep${k + 1}.png`;
    const d = await new Promise((res, rej) => potrace.trace(file, { turdSize: 8, optTolerance: 0.3, threshold: 128 }, (e, s) => e ? rej(e) : res(s.match(/ d="([^"]+)"/)?.[1] ?? "")));
    writeFileSync(`kit/${out}_${k + 1}-${name}.svg`, svg(`<path fill="${hx}" fill-rule="evenodd" d="${d}"/>`));
    all.push(`<path fill="${hx}" fill-rule="evenodd" d="${d}"/>`);
  }
  if (inks.length > 1) writeFileSync(`kit/${out}_all-inks.svg`, svg(all.join("")));
}
await browser.close();
