// Chest prints for Still Water (both shirts), rebuilt on their own: renders the chest art at 300 dpi
// (3.75 in), traces it to a one-ink vector sized in inches, and writes the 300 dpi transparent PNG.
import { chromium } from "playwright-core"; import potrace from "potrace"; import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { FONTS } from "./lib.mjs";
import { stillWaterChest3, stillWaterOneChest } from "./round2.mjs";
mkdirSync("out2", { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
const jobs = [["still-water_chest", stillWaterChest3({ dark: "#000" }), "#2A3B2E"], ["still-water-one-ink_chest", stillWaterOneChest({ ink: "#000" }), "#24382A"]];
for (const [out, a, hex] of jobs) {
  const inches = 3.75, w = Math.round(inches * 300), h = Math.round((w * a.vb[1]) / a.vb[0]);
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${FONTS} html,body{margin:0;background:#fff}</style><svg width="${w}" height="${h}" viewBox="0 0 ${a.vb[0]} ${a.vb[1]}" style="display:block">${a.art}</svg>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150);
  const png = `out2/${out}-ink.png`; await page.screenshot({ path: png });
  const d = await new Promise((res, rej) => potrace.trace(png, { turdSize: 8, optTolerance: 0.3, threshold: 128 }, (e, svg) => e ? rej(e) : res(svg.match(/ d="([^"]+)"/)[1])));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${inches}in" height="${((inches * h) / w).toFixed(3)}in" viewBox="0 0 ${w} ${h}"><path fill="${hex}" fill-rule="evenodd" d="${d}"/></svg>`;
  writeFileSync(`kit/${out}_1-forest.svg`, svg);
  if (out === "still-water_chest") writeFileSync(`kit/${out}_all-inks.svg`, svg);
  // 300 dpi transparent PNG in the ink colour
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4); const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < info.width * info.height; i++) { rgba[4 * i] = r; rgba[4 * i + 1] = g; rgba[4 * i + 2] = b; rgba[4 * i + 3] = 255 - data[i]; }
  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(`kit/${out}_300dpi.png`);
  console.log(out, w, h);
}
await browser.close();
