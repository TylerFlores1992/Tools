// The kit for the back the owner chose to print (2026-10-08): round 4 no. 7 "Short reflection" exactly as
// picked (`ref/pick-no7/`, the renders final4.mjs made), not the rounds 5-10 polish, which the owner judged
// worse ("the hawk, tent and fire in the new one look terrible"). Only the print-safety rules from those
// rounds are applied (prep5.py via finish5.py: about 0.2-0.35% of the ink, tips under 0.4 mm and hairline
// gaps), the canvas stays 11.5 x 8.33 in as picked. Writes the 300 dpi PNGs, trapped screen films
// (`kit/*_film{k}-{ink}.png`, 1-bit) and SVGs traced from them, as final5.mjs does.
import potrace from "potrace"; import sharp from "sharp";
import { writeFileSync, readFileSync, mkdirSync } from "fs"; import { execFileSync } from "child_process";

const UP = 3, TRACE = { turdSize: 8 * UP * UP, optTolerance: 0.2, threshold: 128, alphaMax: 0.8 };
const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const npy = (arr, h, w) => { let hd = `{'descr': '|i1', 'fortran_order': False, 'shape': (${h}, ${w}), }`; hd += " ".repeat(63 - ((10 + hd.length) % 64)) + "\n";
  const pre = Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0]), len = Buffer.alloc(2); len.writeUInt16LE(hd.length);
  return Buffer.concat([pre, len, Buffer.from(hd, "latin1"), Buffer.from(arr.buffer)]); };
const jobs = [
  ["still-water-one-ink_back", [["forest", "#24382A"]]],
  ["still-water_back", [["forest", "#2A3B2E"], ["moss", "#4E5C3B"], ["mist", "#E2E6DC"]]],
];
mkdirSync("out5/final", { recursive: true });
for (const [out, inks] of jobs) {
  const { data, info } = await sharp(`ref/pick-no7/${out}_300dpi.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height, pal = inks.map(([, hx]) => hex2(hx)), labels = new Int8Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (data[4 * i + 3] < 128) continue;
    let best = 0, bd = Infinity;
    for (let k = 0; k < pal.length; k++) { const d = (data[4 * i] - pal[k][0]) ** 2 + (data[4 * i + 1] - pal[k][1]) ** 2 + (data[4 * i + 2] - pal[k][2]) ** 2; if (d < bd) { bd = d; best = k; } }
    labels[i] = best;
  }
  // the type starts below the widest blank band in the lower half of the art (the rules leave the type as set)
  const inkRow = (y) => { for (let x = 0; x < info.width; x++) if (labels[y * info.width + x] >= 0) return true; return false; };
  const rows = []; for (let y = 0; y < info.height; y++) if (inkRow(y)) rows.push(y);
  const y0 = rows[0], y1 = rows[rows.length - 1]; let best = [0, 0], run = 0;
  for (let y = Math.floor((y0 + y1) / 2); y < y1; y++) { run = inkRow(y) ? 0 : run + 1; if (run > best[0]) best = [run, y + 1]; }
  writeFileSync(`out5/final/${out}-labels.npy`, npy(labels, info.height, info.width));
  execFileSync("python3", ["-W", "ignore", "finish5.py", out, inks.map(([nm, hx]) => `${nm}:${hx}`).join(","), String(best[1]), "keep"], { stdio: "inherit" });
  const size = JSON.parse(readFileSync(`out5/final/${out}-size.json`, "utf8"));
  const svg = (body, w = size.w, h = size.h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${(w / 300).toFixed(3)}in" height="${(h / 300).toFixed(3)}in" viewBox="0 0 ${w * UP} ${h * UP}">${body}</svg>`;
  const trace = async (file, w = size.w, h = size.h) => { const big = await sharp(file).resize(w * UP, h * UP, { kernel: "cubic" }).blur(0.6 * UP).png().toBuffer();
    return new Promise((res, rej) => potrace.trace(big, TRACE, (e, s) => e ? rej(e) : res(s.match(/ d="([^"]+)"/)?.[1] ?? ""))); };
  if (inks.length === 1) {
    writeFileSync(`kit/${out}_1-forest.svg`, svg(`<path fill="${inks[0][1]}" fill-rule="evenodd" d="${await trace(`out5/final/${out}-sep1.png`)}"/>`));
    continue;
  }
  const [fw, fh] = size.film, all = [];
  for (let k = 0; k < inks.length; k++) {
    const [name, hx] = inks[k];
    writeFileSync(`kit/${out}_${k + 1}-${name}.svg`, svg(`<path fill="#000" fill-rule="evenodd" d="${await trace(`out5/final/${out}-film${k + 1}.png`, fw, fh)}"/>`, fw, fh));
    all.unshift(`<path fill="${hx}" fill-rule="evenodd" d="${await trace(`out5/final/${out}-sep${k + 1}.png`)}"/>`);
  }
  writeFileSync(`kit/${out}_all-inks.svg`, svg(all.join("")));
}
