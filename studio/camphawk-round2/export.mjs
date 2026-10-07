// Exports the picked round-2 art to public/private/camphawk/round2/ as WebP.
// Usage: node studio/camphawk-round2/export.mjs   (picks and logo picks are listed below)
// Recraft tops out at 1280px on free credit; posters are upscaled with Lanczos (flat print art holds up).
import sharp from "sharp";

const OUT = "public/private/camphawk/round2/";
const SRC = "studio/camphawk-round2/out/";
const PICKS = [
  ["a1-hero-wide", "a1-hero-wide-bfl_flux_pro_1_1_ultra-1.png", [2560, 1440, 828]],
  ["a3-phone-dusk", "a3-phone-dusk-bfl_flux_pro_1_1_ultra-5.jpeg", [1200, 600]],
  ["a4-cta-dusk", "a4-cta-dusk-bfl_flux_pro_1_1_ultra-2.jpeg", [2560, 1440, 828]],
  ["c1-loop-dusk", "c1-loop-dusk-bfl_flux_pro_1_1_ultra-1.jpeg", [1600, 900]],
  ["c2-site-dusk", "c2-site-dusk-bfl_flux_pro_1_1_ultra-2.jpeg", [800, 500]],
  ["c3-river-dusk", "c3-river-dusk-bfl_flux_pro_1_1_ultra-1.jpeg", [800, 500]],
  ["b1-poster-wide", "b1-poster-wide-recraft_recraft_v4_1-5.webp", [2560, 1440, 828]],
  ["b2-poster-tall", "b2-poster-tall-recraft_recraft_v4_1-1.webp", [1170, 828]],
  ["b3-watch", "b3-watch-recraft_recraft_v4_1-1.webp", [640]],
  ["b4-pack", "b4-pack-recraft_recraft_v4_1-1.webp", [640]],
  ["b5-map", "b5-map-recraft_recraft_v4_1-1.webp", [640]],
  ["b6-calendar", "b6-calendar-recraft_recraft_v4_1-1.webp", [640]],
  ["e1-explore-wide", "e1-explore-wide-bfl_flux_pro_1_1_ultra-2.jpeg", [2560, 1440, 828]],
  ["e2-map", "e2-map-recraft_recraft_v4_1-1.webp", [1280, 828]],
  ["n1-newwatch-wide", "n1-newwatch-wide-bfl_flux_pro_1_1_ultra-1.jpeg", [2560, 1440, 828]],
  ["w1-watches-wide", "w1-watches-wide-bfl_flux_pro_1_1_ultra-1.jpeg", [2560, 1440, 828]],
  // Fix round (2026-10-06): one band photo per page type, replacing the overused a4.
  ["m1-coast-wide", "m1-coast-wide-bfl_flux_pro_1_1_ultra-1.jpeg", [2560, 1440, 828]],
  ["p1-pricing-wide", "p1-pricing-wide-bfl_flux_pro_1_1_ultra-1.jpeg", [2560, 1440, 828]],
  ["v1-fork-wide", "v1-fork-wide-bfl_flux_pro_1_1_ultra-1.jpeg", [2560, 1440, 828]],
  ["s1-ranger-wide", "s1-ranger-wide-bfl_flux_pro_1_1_ultra-1.jpeg", [2560, 1440, 828]],
  // Round 6 (2026-10-06): bands for the pages that had none, cut from earlier unused generations
  // (no new images bought): the Half Dome face for Hardest to book, the numbered site post for
  // the auto-cart guide, a lone tent in the pines for Settings.
  ["k1-halfdome-wide", "c4-cliff-dusk-bfl_flux_pro_1_1_ultra-2.jpeg", [2048, 1440, 828]],
  ["g1-sitepost-wide", "a3-site-post-bfl_flux_pro_1_1_ultra-1.jpeg", [2048, 1440, 828]],
  ["t1-tent-wide", "a3-site-dusk-bfl_flux_pro_1_1_ultra-1.jpeg", [1856, 1440, 828]],
];

// Per-pick fixes, applied before resizing:
//   lift      a tone curve (out = in^p) that opens the shadows without clipping the fire or sky.
//             c2 read as a black square at card size (2026-10-06).
//   letterbox Flux sometimes paints cinema bars; crop the near-black rows off top and bottom.
//   soften    mix toward ch-paper so a map reads as a quiet ground for the pins on it.
//   band      cut a 2.33:1 strip (a page band's shape) whose centre sits at this fraction of the height.
const TUNE = {
  "c2-site-dusk": { lift: 0.78 },
  "k1-halfdome-wide": { band: 0.42 },
  "g1-sitepost-wide": { band: 0.5 },
  "t1-tent-wide": { band: 0.62 },
  "e1-explore-wide": { letterbox: true },
  "e2-map": { soften: 0.45 },
};

// Vignettes are painted on cream: key that cream out to transparency (soft edge), so they sit on
// any paper without a visible square.
async function keyed(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => (y * info.width + x) * 4;
  const bg = [0, 1, 2].map((c) => [at(4, 4), at(info.width - 5, 4), at(4, info.height - 5), at(info.width - 5, info.height - 5)].reduce((t, i) => t + data[i + c], 0) / 4);
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.max(...[0, 1, 2].map((c) => Math.abs(data[i + c] - bg[c])));
    data[i + 3] = d <= 10 ? 0 : d >= 26 ? 255 : Math.round(((d - 10) / 16) * 255);
  }
  return sharp(data, { raw: info });
}

// Logos sit on a plain white field, but white also appears INSIDE the badge (snow, river, the
// inner ring). So only background connected to the image edge goes: flood-fill from the border,
// then a soft one-pixel edge, then trim to the badge and centre it on a transparent square.
async function cutout(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const dist = (i) => 255 - Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]); // 0 = white
  const bg = new Uint8Array(W * H), stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || dist(i) > 24) continue;
    bg[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W);
  }
  // Edge band (two pixels in from the background): these pixels are part white. Alpha comes from
  // how far they are from white, and the white is un-mixed out of the colour, so no halo shows on
  // a dark header.
  const near = new Uint8Array(W * H);
  for (let pass = 0; pass < 2; pass++) {
    const src = pass === 0 ? bg : near.slice();
    for (let i = 0; i < W * H; i++) {
      if (bg[i] || near[i]) continue;
      const x = i % W, y = (i / W) | 0;
      if ((x > 0 && src[i - 1]) || (x < W - 1 && src[i + 1]) || (y > 0 && src[i - W]) || (y < H - 1 && src[i + W])) near[i] = 1;
    }
  }
  for (let i = 0; i < W * H; i++) {
    if (bg[i]) { data[i * 4 + 3] = 0; continue; }
    if (!near[i]) continue;
    // Reference: the nearest solid pixel just inside, i.e. the colour this edge pixel is a blend of.
    const x = i % W, y = (i / W) | 0;
    let ref = 0;
    for (let r = 1; r <= 3 && !ref; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = yy * W + xx;
      if (!bg[j] && !near[j]) ref = Math.max(ref, dist(j));
    }
    // Hair-thin tips have no solid pixel nearby; they are dark feather, so assume a dark reference.
    const a = Math.min(1, dist(i) / (ref || 230));
    if (a <= 0.02) { data[i * 4 + 3] = 0; continue; }
    for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.max(0, Math.min(255, Math.round((data[i * 4 + c] - 255 * (1 - a)) / a)));
    data[i * 4 + 3] = Math.round(a * 255);
  }
  const trimmed = await sharp(data, { raw: info }).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
  const side = Math.max(trimmed.info.width, trimmed.info.height);
  return sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: trimmed.data, left: Math.round((side - trimmed.info.width) / 2), top: Math.round((side - trimmed.info.height) / 2) }])
    .png();
}

// One dusk grade for every photo (round 6, 2026-10-06): Flux painted each scene in its own electric
// blue or violet, so the pages read as unrelated stock. Cool hues (170-315°) are pulled halfway
// toward the hero's teal-blue (205°) and their saturation cut to 62%; warm light (lamps, fire,
// tents) is left as painted, so it stays the one warm note. A gentle shadow lift (v^0.92) opens
// the near-black. Paintings, the map and the badge are not photos and skip it.
const PHOTO = /^(a|c|e1|n1|w1|m1|p1|v1|s1|k1|g1|t1)\d?-/;
function grade(data, channels = 3, { hue = 205, pull = 0.55, sat = 0.62, lift = 0.92 } = {}) {
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    let s = max ? d / max : 0;
    const v = Math.pow(max, lift);
    const w = h < 170 || h > 315 ? 0 : h < 185 ? (h - 170) / 15 : h > 300 ? (315 - h) / 15 : 1;
    if (w) { h += (hue - h) * pull * w; s *= 1 - (1 - sat) * w; }
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    const [rr, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    data[i] = Math.round((rr + m) * 255); data[i + 1] = Math.round((gg + m) * 255); data[i + 2] = Math.round((bb + m) * 255);
  }
  return data;
}

async function tuned(name, file) {
  const t = TUNE[name] ?? {};
  const photo = PHOTO.test(name);
  if (!TUNE[name] && !photo) return null;
  const { data, info } = await sharp(SRC + file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  if (photo) grade(data);
  if (t.lift) {
    const lut = Array.from({ length: 256 }, (_, v) => Math.round(255 * Math.pow(v / 255, t.lift)));
    for (let i = 0; i < data.length; i++) data[i] = lut[data[i]];
  }
  if (t.soften) {
    const paper = [0xf5, 0xf7, 0xf2];
    for (let i = 0; i < data.length; i++) data[i] = Math.round(data[i] * (1 - t.soften) + paper[i % 3] * t.soften);
  }
  let img = sharp(data, { raw: info });
  if (t.band) {
    const h = Math.round(W / 2.333);
    const top = Math.max(0, Math.min(H - h, Math.round(H * t.band - h / 2)));
    img = sharp(await img.png().toBuffer()).extract({ left: 0, top, width: W, height: h });
  }
  if (t.letterbox) {
    const rowMean = (y) => { let sum = 0; for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) sum += data[(y * W + x) * 3 + c]; return sum / (W * 3); };
    let top = 0, bottom = H - 1;
    while (top < H / 4 && rowMean(top) < 8) top++;
    while (bottom > (H * 3) / 4 && rowMean(bottom) < 8) bottom--;
    // A few rows more on each side: the bar's edge is soft.
    const inset = 4;
    img = sharp(await img.png().toBuffer()).extract({ left: 0, top: top + inset, width: W, height: bottom - top + 1 - 2 * inset });
  }
  return sharp(await img.png().toBuffer());
}

for (const [name, file, widths] of PICKS) {
  const vignette = /^b[3-6]-/.test(name);
  for (const w of widths) {
    let img = vignette ? await keyed(SRC + file) : (await tuned(name, file)) ?? sharp(SRC + file);
    const info = await img
      .resize({ width: w, kernel: "lanczos3" })
      .sharpen(w > 1280 && file.endsWith(".webp") ? { sigma: 0.6 } : undefined)
      .webp({ quality: name.startsWith("b") ? 82 : 78, alphaQuality: 90 })
      .toFile(`${OUT}${name}-${w}.webp`);
    console.log(`${name}-${w}.webp ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)} KB`);
  }
}

// Logo picks: cut out of their white field, exported square at 2x and 3x the header's CSS size.
const LOGOS = [["badge-golden", "l2-badge-golden-bfl_flux_kontext_pro-1.png", [120, 80]]];
for (const [name, file, widths] of LOGOS) {
  const cut = await (await cutout(SRC + file)).toBuffer();
  for (const w of widths) {
    const info = await sharp(cut).resize({ width: w, kernel: "lanczos3" }).webp({ quality: 90, alphaQuality: 100, smartSubsample: true }).toFile(`${OUT}${name}-${w}.webp`);
    console.log(`${name}-${w}.webp ${info.width}x${info.height} ${(info.size / 1024).toFixed(1)} KB`);
  }
}
