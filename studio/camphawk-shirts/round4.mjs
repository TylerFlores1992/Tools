// Round 4 (2026-10-07): Still Water without the diamond. The owner's wife: the peak mirrored in the lake
// makes the whole print read as a diamond. Seven layouts that keep the peak, the camp and the hawk but
// change what sits below the shore: no reflection, a solid lake plate, frames that cut the water off,
// a reflection kept only as tapering dashes, a banner on the waterline, a wide panorama.
// Mockups only (the peak is the 300 dpi camp render from prep4.py); print files follow for the pick.
// Units: print pixels at 300 dpi, 11.5 in = 3450 wide. 1 mm = 11.8.
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { chromium } from "playwright-core";
import { FONTS, P, HAWK, tee, place } from "./lib.mjs";

const MM = 300 / 25.4, W = 3450, CX = 1725, SHORE = 1598; // the shore band's centre row
const b64 = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const IMG = { one: b64("out4/peak-one.png"), three: b64("out4/peak-three.png"), sil: b64("out4/sil-one.png"), gap: b64("out4/silgap-one.png") };
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

const peak = (v = "one", t = "") => `<image href="${IMG[v]}" x="0" y="0" width="3450" height="${v === "one" ? 3899 : 4037}" ${t ? `transform="${t}"` : ""}/>`;
const hawk = (x, y, w, fill, extra = "") => `<svg x="${x}" y="${y}" width="${w}" height="${(w * HAWK.h) / HAWK.w}" viewBox="0 0 ${HAWK.w} ${HAWK.h}" overflow="visible"><path fill="${fill}" fill-rule="evenodd" ${extra} d="${P.hawkSil}"/></svg>`;
const HAWK0 = [2549, 392, 681];
const word = (y, ink, { size = 290, spacing = 124, len } = {}) => `<text x="${CX}" y="${y}" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="${size}" ${len ? `textLength="${len}" lengthAdjust="spacing"` : `letter-spacing="${spacing}"`} fill="${ink}">${len ? "CAMPHAWK" : `<tspan dx="${spacing / 2}">CAMPHAWK</tspan>`}</text>`;
const TAG = "THE CAMPSITE YOU WANTED IS BOOKED · WE WAIT FOR IT";
const tag = (y, ink, size = 86, len = 2700) => `<text x="${CX}" y="${y}" text-anchor="middle" font-family="Oswald" font-weight="500" font-size="${size}" textLength="${len}" lengthAdjust="spacing" fill="${ink}">${TAG}</text>`;

// a tapered stroke: thick in the middle, pointed ends (linocut water)
const dash = (x1, x2, y, t) => { const m = (x1 + x2) / 2, k = Math.min(t * 1.6, (x2 - x1) * 0.25);
  return `M ${x1} ${y} C ${x1 + k} ${y - t / 2}, ${m - k} ${y - t / 2}, ${m} ${y - t / 2} C ${m + k} ${y - t / 2}, ${x2 - k} ${y - t / 2}, ${x2} ${y} C ${x2 - k} ${y + t / 2}, ${m + k} ${y + t / 2}, ${m} ${y + t / 2} C ${m - k} ${y + t / 2}, ${x1 + k} ${y + t / 2}, ${x1} ${y} Z `; };
// ripple rows below the shore: near the shore the lines are long and nearly whole; toward the viewer they
// break up, thin out and spread apart (perspective). half(y, i) is the field's half-width at each row.
// Under the camp the lake carries two columns of light instead: the fire's glow and the tent's lit door.
const FIRE_X = 1650, DOOR_X = 1872;
function ripples({ y0, rows, gap0 = 48, grow = 1.14, t0 = 2.0 * MM, t1 = 1.3 * MM, half = () => 1300, seed = 7, cx = CX, glints = true, keep = 0.92, k = 1, shape = dash }) {
  const r = rng(seed); let d = "", y = y0, g = gap0;
  const glow = glints ? [[cx + (FIRE_X - CX) * k, [230, 180, 130, 90, 50].map((v) => v * k)], [cx + (DOOR_X - CX) * k, [130, 90, 50].map((v) => v * k)]] : [];
  for (let i = 0; i < rows; i++) {
    const p = rows > 1 ? i / (rows - 1) : 0, t = t0 + (t1 - t0) * p, h = half(y, i);
    // the light columns: stacked dashes, shorter as they go down
    const cut = [];
    for (const [gx, ws] of glow) if (i < ws.length) { d += shape(gx - ws[i] / 2, gx + ws[i] / 2, y, t); cut.push([gx - ws[i] / 2 - 55, gx + ws[i] / 2 + 55]); }
    let x = cx - h + r() * 80;
    while (x < cx + h - 60) {
      const len = (560 - 330 * p) * (0.45 + r() * 0.9);
      let x2 = Math.min(x + len, cx + h);
      for (const [a, b] of cut) if (x < b && x2 > a) { if (x < a) x2 = a; else { x = b; x2 = Math.min(b + len * 0.5, cx + h); } }
      if (r() < keep - 0.45 * p && x2 - x > 70) d += shape(x, x2, y, t);
      x = x2 + 50 + p * 160 + r() * (60 + 180 * p);
    }
    y += g; g *= grow;
  }
  return { d, end: y };
}
const glintsOnly = (y0) => ripples({ y0, rows: 5, half: () => 0 }).d;

const capsule = (x1, x2, y, t) => `M ${x1 + t / 2} ${y - t / 2} H ${x2 - t / 2} A ${t / 2} ${t / 2} 0 0 1 ${x2 - t / 2} ${y + t / 2} H ${x1 + t / 2} A ${t / 2} ${t / 2} 0 0 1 ${x1 + t / 2} ${y - t / 2} Z `;
const designs = [];
const add = (id, name, note, fn) => designs.push({ id, name, note, fn });

// 1 — SHORELINE: no reflection at all. A band of tapering ripples, wider than it is deep, so the shape is
// a peak standing on a flat lake. Two glints under the fire and the tent door say the camp is lit.
add("shoreline", "Shoreline", "No reflection. The peak stands on a flat band of ripples; the fire and the lit tent throw a few glints on the water.", (ink, v) => {
  const w = ripples({ y0: SHORE + 62, rows: 6, half: (y, i) => 1400 - i * 30, seed: 11 });
  return { h: w.end + 520, art: `${peak(v)}<path fill="${ink}" d="${w.d}"/>${hawk(...HAWK0, ink)}${word(w.end + 240, ink)}${tag(w.end + 410, ink)}` };
});

// 2 — LAKE PLATE: the lake is one solid block of ink under the shore, with the name cut out of it and a
// few ripples cut out above the name. The peak stands on a plinth; nothing is mirrored.
add("plate", "Lake plate", "The lake becomes a solid block of ink with CAMPHAWK cut out of it. The peak stands on it like a plinth; nothing is mirrored.", (ink, v) => {
  const x0 = 260, x1 = 3190, y0 = SHORE + 44, y1 = y0 + 490;
  const rip = ripples({ y0: y0 + 70, rows: 1, gap0: 58, half: () => 1300, seed: 5, t0: 1.6 * MM, t1: 1.6 * MM, keep: 0.75, shape: capsule }).d;
  return { h: y1 + 280, art: `<defs><mask id="pm"><rect x="0" y="0" width="${W}" height="4000" fill="#fff"/><path fill="#000" d="${rip}"/>${word(y0 + 375, "#000", { size: 270, len: 2400 })}</mask></defs>
    ${peak(v)}<path fill="${ink}" mask="url(#pm)" d="M ${x0} ${y0} H ${x1} V ${y1 - 40} Q ${x1} ${y1} ${x1 - 40} ${y1} H ${x0 + 40} Q ${x0} ${y1} ${x0} ${y1 - 40} Z"/>
    ${hawk(2160, 230, 600, ink)}${tag(y1 + 170, ink, 92, 2930)}` };
});

// 3 — ROUND BADGE: a ring with a low horizon. The peak and the hawk break out of the top of the ring
// (with a clean gap), the water fills the bowl below the shore and is cut off by the ring.
add("badge", "Round badge", "A ring cuts the water off. The peak and the hawk break out through the top; ripples fill the bowl below the shore.", (ink, v) => {
  const cy = 1330, R = 1240, ring = 3.2 * MM, k = 1.07, T = `translate(${CX * (1 - k)} ${SHORE * (1 - k)}) scale(${k})`, dy = 150;
  const w = ripples({ y0: SHORE + 62, rows: 10, gap0: 48, grow: 1.075, keep: 1.0, half: (y) => Math.sqrt(Math.max(0, (R - 70) ** 2 - (y - cy) ** 2)) - 40, seed: 3, k });
  const g = hawk(HAWK0[0], HAWK0[1] - 40, HAWK0[2], "#000", `stroke="#000" stroke-width="${(48 * HAWK.w) / HAWK0[2]}" stroke-linejoin="round"`);
  return { h: cy + R + 520 + dy, art: `<defs><clipPath id="bc"><circle cx="${CX}" cy="${cy}" r="${R - 70}"/><rect x="1100" y="-400" width="1250" height="${cy - R + 680}"/></clipPath>
      <filter id="inv"><feColorMatrix values="-1 0 0 0 1  -1 0 0 0 1  -1 0 0 0 1  0 0 0 1 0"/></filter>
      <clipPath id="topc"><rect x="0" y="-400" width="${W}" height="${cy - R + 700}"/></clipPath>
      <mask id="bm" maskUnits="userSpaceOnUse" x="-100" y="-500" width="3700" height="5000"><rect x="-100" y="-500" width="3700" height="5000" fill="#fff"/><g clip-path="url(#topc)"><image href="${IMG.gap}" width="3450" height="3899" transform="${T}" filter="url(#inv)"/></g>${g}</mask></defs>
    <g transform="translate(0 ${dy})">
    <g clip-path="url(#bc)"><g transform="${T}">${peak(v)}</g><path fill="${ink}" d="${w.d}"/></g>
    <g mask="url(#bm)"><circle cx="${CX}" cy="${cy}" r="${R}" fill="none" stroke="${ink}" stroke-width="${ring}"/></g>
    ${hawk(HAWK0[0], HAWK0[1] - 40, HAWK0[2], ink)}${word(cy + R + 330, ink)}${tag(cy + R + 490, ink)}</g>` };
});

// 4 — ARCH WINDOW: the national-park window. Rounded top, flat base on the water; the peak sits inside,
// a hairline inner rule doubles the frame. The name sits below on a straight line.
add("arch", "Arch window", "A rounded-top window, like a park poster. The flat base cuts the water off just below the shore.", (ink, v) => {
  const x0 = 380, x1 = 3070, r = (x1 - x0) / 2, top = 40, cy = top + r, base = SHORE + 420, k = 0.9;
  const arch = (i) => `M ${x0 + i} ${base - i} V ${cy} A ${r - i} ${r - i} 0 0 1 ${x1 - i} ${cy} V ${base - i} Z`;
  const t = `translate(${CX * (1 - k)} ${top + 230 - 80 * k}) scale(${k})`; const shore = top + 230 - 80 * k + SHORE * k;
  const w = ripples({ y0: shore + 58, rows: 6, gap0: 46, half: () => r - 150, seed: 21, k });
    return { h: base + 660, art: `<defs><clipPath id="ac"><path d="${arch(50)}"/></clipPath></defs>
    <g clip-path="url(#ac)">${peak(v, t)}<path fill="${ink}" d="${w.d}"/>${hawk(2320, 420, 560, ink)}</g>
    <path d="${arch(0)}" fill="none" stroke="${ink}" stroke-width="${3.4 * MM}"/><path d="${arch(44)}" fill="none" stroke="${ink}" stroke-width="${1.3 * MM}"/>
    ${word(base + 430, ink)}${tag(base + 590, ink)}` };
});

// 5 — DASHES: keeps the reflection the owner liked, but redrawn: only the peak's own outline echoes in the
// water as broken tapering dashes, it stops at a third of the peak's height, and the band's bottom is flat.
add("dashes", "Broken reflection", "Keeps a reflection, but only as broken dashes under the peak that stop a third of the way down. The bottom edge is flat, so no diamond.", (ink, v) => {
  const r = rng(9); let d = ""; const sil = JSON.parse(readFileSync("out4/sil-profile.json", "utf8")); // half-width of the peak at each height above the shore
  const glow = [[FIRE_X, [230, 180, 130, 90, 50]], [DOOR_X, [130, 90, 50]]];
  let y = SHORE + 60, g = 46; const rows = 5;
  for (let i = 0; i < rows; i++) {
    const p = i / (rows - 1), hw = sil[Math.min(sil.length - 1, Math.round((y - SHORE) * 1.15))]; // the mirrored peak's half-width here
    const t = (2.1 - 0.7 * p) * MM, cut = [];
    for (const [gx, ws] of glow) if (i < ws.length) { d += dash(gx - ws[i] / 2, gx + ws[i] / 2, y, t); cut.push([gx - ws[i] / 2 - 55, gx + ws[i] / 2 + 55]); }
    const run = (a, b, len, gap, keep, th) => { let x = a + r() * 30; while (x < b - 50) { let x2 = Math.min(x + len * (0.6 + r() * 0.8), b);
      for (const [c0, c1] of cut) if (x < c1 && x2 > c0) { if (x < c0) x2 = c0; else { x = c1; continue; } }
      if (r() < keep && x2 - x > 60) d += dash(x, x2, y, th); x = x2 + gap * (0.6 + r() * 0.8); } };
    // inside the mirrored peak: long, dense, broken more toward the bottom (this is what reads as reflection)
    run(CX - hw, CX + hw, 520 - 300 * p, 36 + 90 * p, 0.97 - 0.3 * p, t);
    // open water either side: short, sparse, thinner
    run(CX - 1440, CX - hw - 70, 260, 200, 0.6, t * 0.8);
    run(CX + hw + 70, CX + 1440, 260, 200, 0.6, t * 0.8);
    y += g; g *= 1.1;
  }
  return { h: y + 560, art: `${peak(v)}<path fill="${ink}" d="${d}"/>${hawk(...HAWK0, ink)}${word(y + 260, ink)}${tag(y + 430, ink)}` };
});

// 6 — BANNER: a straight banner with notched ends lies on the waterline; the name rides on it in the
// shirt colour. A few ripples under the banner; the banner is the bottom edge of the art.
add("banner", "Waterline banner", "A straight banner lies on the waterline with CAMPHAWK cut out of it. It closes the bottom, so the peak can't mirror.", (ink, v) => {
  const y0 = SHORE + 40, bh = 470, x0 = 330, x1 = 3120, n = 140;
  const band = `M ${x0} ${y0} H ${x1} L ${x1 - n} ${y0 + bh / 2} L ${x1} ${y0 + bh} H ${x0} L ${x0 + n} ${y0 + bh / 2} Z`;
  const w = ripples({ y0: y0 + bh + 70, rows: 3, gap0: 54, half: (y, i) => 1100 - i * 260, seed: 13, glints: false, keep: 0.8 });
  return { h: y0 + bh + 260, art: `<defs><mask id="bnm"><rect width="${W}" height="5000" fill="#fff"/>${word(y0 + 350, "#000", { size: 300, len: 2240 })}</mask></defs>
    ${peak(v)}<path fill="${ink}" mask="url(#bnm)" d="${band}"/>${hawk(...HAWK0, ink)}${tag(y0 + bh + 170, ink)}` };
});

// 7 — PANORAMA: a wide window with rounded corners; the peak fills it and the trees run off both sides.
// A strip of water at the bottom. Reads as a landscape at a glance; the frame is a rectangle.
add("panorama", "Panorama", "A wide window the peak fills edge to edge, trees running off both sides, a strip of lake at the bottom.", (ink, v) => {
  const x0 = 140, x1 = 3310, top = 60, k = 1.15, t = `translate(${CX * (1 - k)} ${top + 70 - 80 * k}) scale(${k})`, shore = top + 70 - 80 * k + SHORE * k, base = shore + 250, rr = 44;
  const box = (i) => `M ${x0 + i + rr} ${top + i} H ${x1 - i - rr} Q ${x1 - i} ${top + i} ${x1 - i} ${top + i + rr} V ${base - i - rr} Q ${x1 - i} ${base - i} ${x1 - i - rr} ${base - i} H ${x0 + i + rr} Q ${x0 + i} ${base - i} ${x0 + i} ${base - i - rr} V ${top + i + rr} Q ${x0 + i} ${top + i} ${x0 + i + rr} ${top + i} Z`;
  const w = ripples({ y0: shore + 60, rows: 3, gap0: 52, half: () => 1500, seed: 17, k });
  return { h: base + 600, art: `<defs><clipPath id="pc"><path d="${box(64)}"/></clipPath></defs>
    <g clip-path="url(#pc)">${peak(v, t)}<path fill="${ink}" d="${w.d}"/></g>
    <path d="${box(0)}" fill="none" stroke="${ink}" stroke-width="${3.4 * MM}"/>${hawk(2480, 330, 680, ink)}
    ${word(base + 370, ink)}${tag(base + 530, ink)}` };
});

// ---------- render ----------
const NATURAL = "#E9E2D0", FOREST = "#24382A", FOREST3 = "#2A3B2E", SAGE = "#9AA796";
async function main() {
  mkdirSync("out4", { recursive: true });
  const only = process.argv[2];
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage();
  const shot = async (file, body, w, h, bg, omit = false) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${FONTS} html,body{margin:0;background:${bg}}</style>${body}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150);
    await page.screenshot({ path: file, omitBackground: omit });
  };
  for (const d of designs) {
    if (only && d.id !== only) continue;
    const { h, art } = d.fn(FOREST, "one");
    const svg = (wpx) => `<svg xmlns="http://www.w3.org/2000/svg" width="${wpx}" height="${Math.round((wpx * h) / W)}" viewBox="0 0 ${W} ${h}" style="display:block">${art}</svg>`;
    writeFileSync(`out4/${d.id}.svg`, svg(W));
    // flat art on the natural shirt colour, and a transparent render for the photo composite
    await shot(`out4/${d.id}-flat.png`, `<div style="padding:110px;background:${NATURAL}">${svg(1180)}</div>`, 1400, Math.round((1180 * h) / W) + 220, NATURAL);
    await shot(`out4/${d.id}-alpha.png`, svg(1400), 1400, Math.round((1400 * h) / W), "transparent", true);
    // drawn tee, back, print 11.5 in wide starting 3 in below the collar
    const IN = 26.8, bw = 11.5 * IN;
    await shot(`out4/${d.id}-tee.png`, `<div style="width:900px">${tee(NATURAL, place(500 - bw / 2, 95 + 3 * IN, bw, [W, h], art), true)}</div>`, 900, 960, "#ECEAE4");
    { const a3 = d.fn(FOREST3, "three"); const s3 = `<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="${Math.round((1180 * a3.h) / W)}" viewBox="0 0 ${W} ${a3.h}" style="display:block">${a3.art}</svg>`;
      await shot(`out4/${d.id}-flat3.png`, `<div style="padding:110px;background:${SAGE}">${s3}</div>`, 1400, Math.round((1180 * a3.h) / W) + 220, SAGE); }
    console.log(d.id, h, (h / 300).toFixed(2) + " in tall");
  }
  await browser.close();
}
export { designs };
if (import.meta.url === `file://${process.argv[1]}`) await main();
