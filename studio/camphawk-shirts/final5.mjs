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
// potrace on the film upsampled 3x and softened, alphaMax 0.8, optTolerance 0.2: measured in round 7 against
// tracing at 1x (any alphaMax), this follows the PNG 3x closer (5k px off, not 14-17k) and brings back about
// half the sub-0.4 mm tips (574 px, none over 16 px) instead of sharpening rounded tips into points
const UP = 3, TRACE = { turdSize: 8 * UP * UP, optTolerance: 0.2, threshold: 128, alphaMax: 0.8 };
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
  execFileSync("python3", ["-W", "ignore", "finish5.py", out, inks.map(([nm, hx]) => `${nm}:${hx}`).join(","), String(typeTop)], { stdio: "inherit" });
  const size = JSON.parse(readFileSync(`out5/final/${out}-size.json`, "utf8"));
  const svg = (body, w = size.w, h = size.h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${(w / 300).toFixed(3)}in" height="${(h / 300).toFixed(3)}in" viewBox="0 0 ${w * UP} ${h * UP}">${body}</svg>`;
  const trace = async (file, w = size.w, h = size.h) => { const big = await sharp(file).resize(w * UP, h * UP, { kernel: "cubic" }).blur(0.6 * UP).png().toBuffer();
    return new Promise((res, rej) => potrace.trace(big, TRACE, (e, s) => e ? rej(e) : res(s.match(/ d="([^"]+)"/)?.[1] ?? ""))); };
  if (inks.length === 1) {                                     // one ink: the art itself, no film furniture
    const [name, hx] = inks[0];
    writeFileSync(`kit/${out}_1-${name}.svg`, svg(`<path fill="${hx}" fill-rule="evenodd" d="${await trace(`out5/final/${out}-sep1.png`)}"/>`));
    continue;
  }
  // three inks: each screen film with its registration marks and label; and the all-inks composite stacked as
  // it prints, mist then moss then forest, each from its trapped separation (the spreads sit under the darker
  // ink, so there are no butted edges to leave hairline seams, as round 7's untrapped composite did)
  const [fw, fh] = size.film, all = [];
  for (let k = 0; k < inks.length; k++) {
    const [name, hx] = inks[k];
    // films are black (a mist-colored film is nearly clear); the ink and its hex are in the label
    writeFileSync(`kit/${out}_${k + 1}-${name}.svg`, svg(`<path fill="#000" fill-rule="evenodd" d="${await trace(`out5/final/${out}-film${k + 1}.png`, fw, fh)}"/>`, fw, fh));
    all.unshift(`<path fill="${hx}" fill-rule="evenodd" d="${await trace(`out5/final/${out}-sep${k + 1}.png`)}"/>`);
  }
  writeFileSync(`kit/${out}_all-inks.svg`, svg(all.join("")));
}
await browser.close();
