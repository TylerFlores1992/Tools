// Round 2: refine concept 3 ("Night Watch", 1 ink) and concept 7 ("Still Water", 3 inks).
// Scale: the tee mockup's chest is 536 units ≈ 20in (size L laid flat), so 1in ≈ 26.8 units.
import { writeFileSync, mkdirSync } from "fs";
import { chromium } from "playwright-core";
import { FONTS, P, HAWK, tee, place, arcText } from "./lib.mjs";

const IN = 26.8;
export const r2 = {};

// ---------- seeded randomness ----------
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

// ---------- a better pine: irregular tiers, drooping branch tips, slight lean ----------
export function pine2(x, y, h, seed, { tiers = 8, width = 0.40, lean = 0 } = {}) {
  const r = rng(seed); const w = h * width; const top = [x + lean * h, y - h];
  const L = [], R = [];
  for (let i = 0; i < tiers; i++) {
    const t = (i + 1) / tiers;
    const ty = y - h + h * 0.86 * t + (r() - 0.5) * h * 0.02;
    const cx = x + lean * h * (1 - t);
    const half = (w / 2) * (0.22 + 0.78 * Math.pow(t, 0.9));
    const wl = half * (0.82 + r() * 0.36), wr = half * (0.82 + r() * 0.36);
    const notch = h * 0.075;
    L.push([cx - wl * 0.42, ty - notch], [cx - wl, ty + h * 0.012]);
    R.push([cx + wr * 0.42, ty - notch], [cx + wr, ty + h * 0.012]);
  }
  const trunk = h * 0.035;
  const pts = [top, ...R, [x + trunk, y - h * 0.1], [x + trunk, y], [x - trunk, y], [x - trunk, y - h * 0.1], ...L.reverse()];
  return "M " + pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L ") + " Z";
}
export function forest(x0, x1, y, hMin, hMax, seed, opts = {}) {
  const r = rng(seed); let d = ""; let x = x0;
  while (x < x1) {
    // taller trees toward the edges of a cluster when `edgeTall` is set
    const k = opts.edgeTall ? Math.abs((x - (x0 + x1) / 2) / ((x1 - x0) / 2)) : r();
    const h = hMin + (hMax - hMin) * (opts.edgeTall ? 0.25 + 0.75 * k * (0.7 + r() * 0.3) : r());
    d += pine2(x, y + r() * 4, h, Math.floor(r() * 1e6), { lean: (r() - 0.5) * 0.03 }) + " ";
    x += h * (0.17 + r() * 0.14);
  }
  return d;
}

const hawkAt = (x, y, w, kind = "eng") => `<svg x="${x}" y="${y}" width="${w}" height="${(w * HAWK.h) / HAWK.w}" viewBox="0 0 ${HAWK.w} ${HAWK.h}" overflow="visible"><path fill-rule="evenodd" d="${kind === "eng" ? P.hawkEng : P.hawkSil}"/></svg>`;

// =====================================================================================
// 3 — NIGHT WATCH (1 ink: bone on charcoal)
// A full moon; the hawk is cut out of it; pines cut the bottom edge. Type locks up around it.
// =====================================================================================
export function nightWatch({ ink, shirt, headFont = "Alfa Slab One", headSize = 100, headSpacing = 3 }) {
  const W = 1000, H = 920, cx = 500, cy = 470, R = 360;
  const horizon = cy + R * 0.66; // where the treeline stands
  // engraved shading: knock-out lines get thicker toward the horizon (a 1-ink gradient)
  let lines = "";
  const s0 = cy + R * 0.05, s1 = horizon - 70;
  for (let y = s0, i = 0; y < s1; i++) {
    const t = Math.max(0, (y - s0) / (s1 - s0));
    const th = 3.6 + 8 * Math.pow(t, 1.4); // ≥ 3.5 units ≈ 1mm at 11.5in wide: the minimum knockout that won't fill in
    lines += `<rect x="${cx - R}" y="${y.toFixed(1)}" width="${2 * R}" height="${th.toFixed(1)}"/>`;
    y += 15;
  }
  const trees = forest(cx - R - 20, cx + R + 30, horizon + 6, 34, 230, 31, { edgeTall: true });
  const hawkW = 540, hawkX = cx - hawkW / 2 + 6, hawkY = cy - 250;
  const stars = [[92, 420, 6], [120, 560, 3.5], [70, 640, 4], [908, 400, 4], [890, 530, 6], [935, 650, 3.5]]
    .map(([x, y, s]) => `<path d="M ${x} ${y - s * 2.2} L ${x + s * 0.5} ${y - s * 0.5} L ${x + s * 2.2} ${y} L ${x + s * 0.5} ${y + s * 0.5} L ${x} ${y + s * 2.2} L ${x - s * 0.5} ${y + s * 0.5} L ${x - s * 2.2} ${y} L ${x - s * 0.5} ${y - s * 0.5} Z"/>`).join("");
  const art = `<defs>
     <mask id="nwMoon" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
       <rect width="${W}" height="${H}" fill="#000"/>
       <circle cx="${cx}" cy="${cy}" r="${R}" fill="#fff"/>
              <rect x="0" y="${horizon - 34}" width="${W}" height="${H}" fill="#000"/>
       <g fill="#000">${hawkAt(hawkX, hawkY, hawkW, "eng")}</g>
       <path fill="#000" d="${trees}"/>
     </mask></defs>
   <g fill="${ink}">
     <rect width="${W}" height="${H}" mask="url(#nwMoon)"/>
     ${stars}
     <rect x="${cx - R - 50}" y="${horizon - 18}" width="${2 * R + 100}" height="8"/>
   </g>
   ${arcText("nwArc", cx, cy, R + 62, "THE CAMPSITE YOU WANTED IS BOOKED", { size: 40, font: "Oswald", weight: 500, fill: ink, spacing: 9 })}
   <text x="${cx}" y="${horizon + 112}" text-anchor="middle" font-family="${headFont}" font-size="${headSize}" letter-spacing="${headSpacing}" fill="${ink}">WE WAIT FOR IT.</text>
   <g fill="${ink}" font-family="Oswald" font-weight="500" font-size="34" letter-spacing="9">
     <text x="${cx}" y="${horizon + 182}" text-anchor="middle">CAMPHAWK · CHECKING EVERY 15 SECONDS</text>
   </g>`;
  return { vb: [W, H], art };
}
export function nightWatchChest({ ink }) {
  const W = 600, H = 700, cx = 300, cy = 270, R = 250;
  const trees = forest(cx - R, cx + R + 10, cy + R * 0.55, 50, 120, 7, { edgeTall: true });
  const art = `<defs><mask id="nwc" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#000"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="#fff"/><rect x="0" y="${cy + R * 0.55}" width="${W}" height="${H}" fill="#000"/><g fill="#000">${hawkAt(cx - 205, cy - 175, 390, "sil")}</g><path fill="#000" d="${trees}"/></mask></defs>
    <rect width="${W}" height="${H}" fill="${ink}" mask="url(#nwc)"/>
    <text x="${cx}" y="${cy + R * 0.55 + 125}" text-anchor="middle" font-family="Alfa Slab One" font-size="96" letter-spacing="6" fill="${ink}">CAMPHAWK</text>`;
  return { vb: [W, H], art };
}

// =====================================================================================
// 7 — STILL WATER (3 inks on sage)
// =====================================================================================
export function stillWater({ dark, mid, light, shirt }) {
  const W = 1000, H = 1180, cx = 500, cy = 500, D = 450; // diamond half-diagonal
  const water = 590; // shoreline y
  const r = rng(77);
  // a peak: shadow body (dark), lit face (mid), snow on both faces (light / mid)
  const peak = (ax, ay, bl, br, ridge, snow, id) => {
    const zig = [];
    const steps = 6;
    for (let i = 1; i <= steps; i++) { const t = i / steps; zig.push([ax + (ridge - ax) * t + (r() - 0.5) * 22 * (1 - t * 0.5), ay + (water - ay) * t]); }
    const body = `M ${ax} ${ay} L ${br} ${water} L ${bl} ${water} Z`;
    const lit = `M ${ax} ${ay} L ${zig.map((p) => p.join(" ")).join(" L ")} L ${bl} ${water} Z`;
    // jagged snow line
    const sy = ay + (water - ay) * snow; let sl = `M ${bl - 50} ${sy}`;
    for (let x = bl - 50; x <= br + 50; x += 18) sl += ` L ${x} ${sy + (r() - 0.3) * 34 + (Math.abs(x - ax) / (br - bl)) * 40}`;
    sl += ` L ${br + 50} ${ay - 10} L ${bl - 50} ${ay - 10} Z`;
    return `<clipPath id="snow${id}"><path d="${sl}"/></clipPath>
      <path d="${body}" fill="${dark}"/>
      <path d="${lit}" fill="${mid}"/>
      <g clip-path="url(#snow${id})"><path d="${lit}" fill="${light}"/></g>
      <g clip-path="url(#snow${id})"><path d="${body}" fill="${mid}" clip-path="url(#shadowSide${id})"/></g>
      <clipPath id="shadowSide${id}"><path d="M ${ax} ${ay} L ${zig.map((p) => p.join(" ")).join(" L ")} L ${br + 60} ${water} L ${br + 60} ${ay - 20} Z"/></clipPath>`;
  };
  const range = `
    ${peak(300, 300, 120, 470, 330, 0.30, "a")}
    ${peak(705, 285, 500, 925, 770, 0.27, "b")}
    ${peak(520, 160, 300, 760, 560, 0.26, "c")}
    <path d="M 80 ${water} L 210 ${water - 70} L 280 ${water - 40} L 380 ${water - 95} L 470 ${water - 50} L 560 ${water - 80} L 650 ${water - 35} L 760 ${water - 90} L 920 ${water} Z" fill="${dark}"/>
    <path fill="${dark}" d="${forest(40, 330, water + 2, 50, 170, 11, { edgeTall: true })} ${forest(650, 980, water + 2, 50, 180, 12, { edgeTall: true })}"/>`;
  // reflection: the range mirrored, cut into horizontal bands; each band shifts sideways a little
  // (the wobble of moving water), bands thin out and gaps widen with depth. Gaps ≥ 3.6 units ≈ 1mm.
  const bands = [];
  for (let i = 0, y = water + 4; y < cy + D; i++) {
    const depth = (y - water) / (cy + D - water);
    const th = 13 - 8 * depth;
    bands.push({ y, th, dx: (r() - 0.5) * (6 + 26 * depth) });
    y += th + 3.6 + 5 * depth;
  }
  let shine = "";
  for (let i = 0; i < 14; i++) { const y = water + 20 + i * 22 + r() * 8; const x = 160 + r() * 620; shine += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(30 + r() * 120).toFixed(0)}" height="4" rx="2"/>`; }
  const cloud = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M 0 30 C 10 10 40 8 52 20 C 62 0 100 0 110 22 C 130 14 150 22 150 30 Z"/><rect transform="translate(${x} ${y}) scale(${s})" x="-30" y="36" width="140" height="6" rx="3"/>`;
  const dia = `${cx},${cy - D} ${cx + D},${cy} ${cx},${cy + D} ${cx - D},${cy}`;
  const art = `<defs>
     <clipPath id="swDia"><polygon points="${dia}"/></clipPath>
     <clipPath id="swSky"><rect x="0" y="0" width="${W}" height="${water}"/></clipPath>
   </defs>
   <g clip-path="url(#swDia)">
     <g fill="${light}">${cloud(180, 330, 1.1)}</g>
     <g clip-path="url(#swSky)">${range}</g>
     <defs><g id="swMirror"><g transform="translate(0 ${2 * water}) scale(1 -1)" clip-path="url(#swSky)">${range}</g></g>
       ${bands.map((b, i) => `<clipPath id="swB${i}"><rect x="0" y="${b.y.toFixed(1)}" width="${W}" height="${b.th.toFixed(1)}"/></clipPath>`).join("")}</defs>
     ${bands.map((b, i) => `<g clip-path="url(#swB${i})"><use href="#swMirror" x="${b.dx.toFixed(1)}"/></g>`).join("")}
     <g fill="${light}">${shine}</g>

     <rect x="0" y="${water - 2}" width="${W}" height="5" fill="${light}"/>
   </g>
   <polygon points="${dia}" fill="none" stroke="${dark}" stroke-width="14"/>
   <polygon points="${cx},${cy - D + 30} ${cx + D - 30},${cy} ${cx},${cy + D - 30} ${cx - D + 30},${cy}" fill="none" stroke="${dark}" stroke-width="3"/>
   <g fill="none" stroke="${shirt}" stroke-width="16" stroke-linejoin="round">${hawkAt(612, 118, 230, "sil")}</g><g fill="${dark}">${hawkAt(612, 118, 230, "sil")}</g>
   <text x="${cx}" y="${cy + D + 120}" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="78" letter-spacing="34" fill="${dark}">CAMPHAWK</text>
   <text x="${cx}" y="${cy + D + 178}" text-anchor="middle" font-family="Oswald" font-weight="500" font-size="30" letter-spacing="12" fill="${dark}">WE WAIT FOR IT · CAMPHAWK.APP</text>`;
  return { vb: [W, H], art };
}
export function stillWaterChest({ dark, mid, light }) {
  const art = `<text x="300" y="96" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="92" letter-spacing="22" fill="${dark}">CAMPHAWK</text>
    <g fill="${dark}">${hawkAt(195, 120, 210, "sil")}</g>`;
  return { vb: [600, 300], art };
}

// ---------- render helpers ----------
const SH = { charcoal: "#2C2F2D", sage: "#9AA796" };
const INKS = { bone: "#EAE0C8", forest: "#2A3B2E", moss: "#4E5C3B", mist: "#E2E6DC" };

async function main() {
  mkdirSync("out2", { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
  const shot = async (name, body, w = 1800, h = 1000, bg = "#ECEAE4") => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${FONTS} html,body{margin:0;background:${bg}}</style>${body}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(120);
    await page.screenshot({ path: `out2/${name}.png` });
  };
  const flat = (a, bg, w, h) => `<div style="width:${w}px;height:${h}px;background:${bg};display:flex;align-items:center;justify-content:center"><svg viewBox="-40 -40 ${a.vb[0] + 80} ${a.vb[1] + 80}" style="width:92%;height:92%">${a.art}</svg></div>`;
  const mode = process.argv[2] ?? "all";

  if (mode === "type") {
    const fonts = [["Alfa Slab One", 150, 4], ["Big Shoulders Display", 210, 6], ["Rye", 128, 2], ["DM Serif Display", 160, 2], ["Bebas Neue", 220, 8], ["Zilla Slab", 170, 2]];
    const cells = fonts.map(([f, s, sp]) => `<div style="flex:1;position:relative">${flat(nightWatch({ ink: INKS.bone, headFont: f, headSize: s, headSpacing: sp }), SH.charcoal, 600, 760)}<div style="position:absolute;top:8px;left:12px;color:#aaa;font:14px sans-serif">${f}</div></div>`);
    await shot("type", `<div style="display:flex;flex-wrap:wrap;width:1800px">${cells.join("")}</div>`, 1800, 1520);
  }
  if (mode === "all") {
    const n = nightWatch3({ ink: INKS.bone });
    const nc = nightWatchChest3({ ink: INKS.bone });
    const s = stillWater4({ dark: INKS.forest, mid: INKS.moss, light: INKS.mist, shirt: SH.sage });
    const sc = stillWaterChest3({ dark: INKS.forest });
    const backW = 11.5 * IN, chestW = 3.75 * IN;
    const backOf = (a) => place(500 - backW / 2, 95 + 3 * IN, backW, a.vb, a.art);
    const chestOf = (a) => place(612 - chestW / 2, 95 + 3.2 * IN, chestW, a.vb, a.art);
    const row = (sh, front, back, art) => `<div style="display:flex;width:1800px;height:700px;align-items:center"><div style="flex:1;padding:30px 10px">${tee(sh, front)}</div><div style="flex:1;padding:30px 10px">${tee(sh, back, true)}</div>${flat(art, sh, 600, 700)}</div>`;
    await shot("night-watch", row(SH.charcoal, chestOf(nc), backOf(n), n), 1800, 700);
    await shot("still-water", row(SH.sage, chestOf(sc), backOf(s), s), 1800, 700);
    await shot("night-watch-flat", flat(n, SH.charcoal, 1400, 1700), 1400, 1700);
    await shot("still-water-flat", flat(s, SH.sage, 1400, 1650), 1400, 1650);
    writeFileSync("out2/night-watch.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n.vb[0]} ${n.vb[1]}">${n.art}</svg>`);
    writeFileSync("out2/still-water.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.vb[0]} ${s.vb[1]}">${s.art}</svg>`);
  }
  if (mode === "onelayers") {
    for (const [name, a, inches] of [["one-base", stillWaterOne({ ink: "#000", only: "base" }), 11.5], ["one-hatch", stillWaterOne({ ink: "#000", only: "hatch" }), 11.5], ["one-chest", stillWaterOneChest({ ink: "#000" }), 3.75]]) {
      const w = Math.round(inches * 300), h = Math.round((w * a.vb[1]) / a.vb[0]);
      await shot(name, `<svg width="${w}" height="${h}" viewBox="0 0 ${a.vb[0]} ${a.vb[1]}" style="display:block">${a.art}</svg>`, w, h, "#fff");
    }
  }
  if (mode === "one") {
    const n = stillWaterOne({ ink: "#24382A" }), c = stillWaterChest3({ dark: "#24382A" });
    const backW = 11.5 * IN, chestW = 3.75 * IN;
    const backOf = (a) => place(500 - backW / 2, 95 + 3 * IN, backW, a.vb, a.art);
    const chestOf = (a) => place(612 - chestW / 2, 95 + 3.2 * IN, chestW, a.vb, a.art);
    const sh = "#E9E2D0";
    await shot("one-tees", `<div style="display:flex;width:1800px;height:700px;align-items:center"><div style="flex:1;padding:30px 10px">${tee(sh, chestOf(c))}</div><div style="flex:1;padding:30px 10px">${tee(sh, backOf(n), true)}</div>${flat(n, sh, 600, 700)}</div>`, 1800, 700);
    await shot("one-flat", flat(n, sh, 1400, 1600), 1400, 1600);
    if (process.env.VARIANTS) {
      const vs = [[-35, 0], [-35, 2.4], [0, 2.4], [55, 2.4]];
      await shot("one-variants", `<div style="display:flex">${vs.map(([an, ol]) => `<div style="position:relative">${flat(stillWaterOne({ ink: "#24382A", angle: an, outline: ol }), sh, 700, 820)}<div style="position:absolute;top:8px;left:10px;font:14px sans-serif;color:#555">angle ${an} · outline ${ol}</div></div>`).join("")}</div>`, 2800, 820);
    }
    for (const [name, a, inches] of [["one-print", n, 11.5], ["one-chest-print", c, 3.75]]) {
      const w = Math.round(inches * 300), h = Math.round((w * a.vb[1]) / a.vb[0]);
      await shot(name, `<svg width="${w}" height="${h}" viewBox="0 0 ${a.vb[0]} ${a.vb[1]}" style="display:block">${a.art}</svg>`, w, h, sh);
    }
    const w = 1200, h = Math.round((w * n.vb[1]) / n.vb[0]);
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${FONTS} html,body{margin:0;background:transparent}</style><svg width="${w}" height="${h}" viewBox="0 0 ${n.vb[0]} ${n.vb[1]}" style="display:block">${n.art}</svg>`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(120);
    await page.screenshot({ path: "out2/one-alpha.png", omitBackground: true });
  }
  if (mode === "alpha") {
    // transparent renders for compositing onto the shirt photos
    for (const [name, a] of [["nw-alpha", nightWatch3({ ink: INKS.bone })], ["sw-alpha", stillWater4({ dark: INKS.forest, mid: INKS.moss, light: INKS.mist, shirt: SH.sage })]]) {
      const w = 1200, h = Math.round((w * a.vb[1]) / a.vb[0]);
      await page.setViewportSize({ width: w, height: h });
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>${FONTS} html,body{margin:0;background:transparent}</style><svg width="${w}" height="${h}" viewBox="0 0 ${a.vb[0]} ${a.vb[1]}" style="display:block">${a.art}</svg>`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(120);
      await page.screenshot({ path: `out2/${name}.png`, omitBackground: true });
    }
  }
  if (mode === "print") {
    // real size at 300 dpi: back 11.5in wide, chest 3.75in wide, no anti-aliasing tricks
    const jobs = [
      ["night-watch-print", nightWatch3({ ink: INKS.bone }), SH.charcoal, 11.5],
      ["night-watch-chest-print", nightWatchChest3({ ink: INKS.bone }), SH.charcoal, 3.75],
      ["still-water-print", stillWater4({ dark: INKS.forest, mid: INKS.moss, light: INKS.mist, shirt: SH.sage }), SH.sage, 11.5],
      ["still-water-chest-print", stillWaterChest3({ dark: INKS.forest }), SH.sage, 3.75],
    ];
    for (const [name, a, bg, inches] of jobs) {
      const w = Math.round(inches * 300), h = Math.round((w * a.vb[1]) / a.vb[0]);
      await shot(name, `<svg width="${w}" height="${h}" viewBox="0 0 ${a.vb[0]} ${a.vb[1]}" shape-rendering="crispEdges" style="display:block">${a.art}</svg>`, w, h, bg);
    }
  }
  await browser.close();
}

// =====================================================================================
// 7, v3 — STILL WATER with the Recraft linocut lake (separated into 3 inks and traced)
// =====================================================================================
import { readFileSync as rf } from "fs";
const LD = (n) => rf(`traced-lake1-${n}.svg`, "utf8").match(/ d="([^"]+)"/)[1];
let LAKE; const lake = () => (LAKE ??= { dark: LD("dark"), mid: LD("mid"), light: LD("light") });
export function stillWater3({ dark, mid, light, shirt, tagline = "THE CAMPSITE YOU WANTED IS BOOKED · WE WAIT FOR IT" }) {
  const W = 1000, H = 1150, cx = 500, cy = 470, D = 450, inset = 30;
  const L = lake(); const S = 880; const sx = cx - S / 2, sy = 62;
  const dia = (d) => `${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`;
  const hx = 620, hy = 52, hw = 280;
  const art = `<defs><clipPath id="sw3"><polygon points="${dia(D - inset - 14)}"/></clipPath></defs>
   <g clip-path="url(#sw3)">
     <svg x="${sx}" y="${sy}" width="${S}" height="${S}" viewBox="0 0 4096 4096">
       <path fill="${mid}" stroke="${mid}" stroke-width="${(1.6 * 4096) / S}" stroke-linejoin="round" fill-rule="evenodd" d="${L.mid}"/>
       <path fill="${light}" stroke="${light}" stroke-width="${(1.6 * 4096) / S}" stroke-linejoin="round" fill-rule="evenodd" d="${L.light}"/>
       <path fill="${dark}" fill-rule="evenodd" d="${L.dark}"/>
     </svg>
   </g>
   <polygon points="${dia(D)}" fill="none" stroke="${dark}" stroke-width="14"/>
   <polygon points="${dia(D - inset)}" fill="none" stroke="${dark}" stroke-width="4.5"/>
   <g fill="${shirt}" stroke="${shirt}" stroke-width="18" stroke-linejoin="round">${hawkAt(hx, hy, hw, "sil")}</g>
   <g fill="${dark}">${hawkAt(hx, hy, hw, "sil")}</g>
   <text x="${cx}" y="${cy + D + 112}" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="78" letter-spacing="34" fill="${dark}">CAMPHAWK</text>
   <text x="${cx}" y="${cy + D + 160}" text-anchor="middle" font-family="Oswald" font-weight="500" font-size="24" letter-spacing="7" fill="${dark}">${tagline}</text>`;
  return { vb: [W, H], art };
}
// The chest wordmark is set to an exact width (textLength): at its old size and tracking it ran past the
// 600-unit canvas and the print files lost the C and the K (found 2026-10-07). 540 units leaves 30 each side.
const CHEST_WORD = (fill) => `<text x="300" y="84" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="76" textLength="540" lengthAdjust="spacing" fill="${fill}">CAMPHAWK</text>`;
export function stillWaterChest3({ dark }) {
  // wordmark over the logo's hawk, centred
  const art = `${CHEST_WORD(dark)}
    <g fill="${dark}">${hawkAt(300 - 135, 118, 270, "sil")}</g>`;
  return { vb: [600, 330], art };
}


// =====================================================================================
// 3, v3 — NIGHT WATCH with the Recraft treeline; critic fixes
// =====================================================================================
let _trees; const trees = () => (_trees ??= { d: rf("traced-trees1.svg", "utf8").match(/ d="([^"]+)"/)[1], w: 4608, h: 2304, ground: 0.875 });
export function nightWatch3({ ink, headSize = 84, arcSize = 46 }) {
  const TREES = trees();
  const W = 1000, H = 940, cx = 500, cy = 450, R = 360;
  const cut = cy + R * 0.62;            // the moon ends on the ground line
  const tw = 2 * R + 300, th = (tw * TREES.h) / TREES.w, tx = cx - tw / 2, ty = cut + 6 - th * TREES.ground;
  const hawkW = 490, hawkX = cx - hawkW / 2 + 28, hawkY = cy - 288;
  const headY = cut + 118, tagY = cut + 178;
  const art = `<defs>
     <mask id="nw3" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
       <rect width="${W}" height="${H}" fill="#000"/>
       <circle cx="${cx}" cy="${cy}" r="${R}" fill="#fff"/>
       <svg x="${tx}" y="${ty}" width="${tw}" height="${th}" viewBox="0 0 ${TREES.w} ${TREES.h}"><path fill="#000" stroke="#000" stroke-width="${(3.2 * TREES.w) / tw}" stroke-linejoin="round" d="${TREES.d}"/></svg>
       <rect x="0" y="${cut}" width="${W}" height="${H}" fill="#000"/>
       <g fill="#fff" stroke="#fff" stroke-width="14" stroke-linejoin="round">${hawkAt(hawkX, hawkY, hawkW, "sil")}</g>
       <g fill="#000" stroke="#000" stroke-width="${(1.3 * HAWK.w) / hawkW}">${hawkAt(hawkX, hawkY, hawkW, "eng")}</g>
     </mask></defs>
   <rect width="${W}" height="${H}" fill="${ink}" mask="url(#nw3)"/>
   ${arcText("nw3Arc", cx, cy, R + 40, "THE CAMPSITE YOU WANTED IS BOOKED", { size: arcSize, font: "Oswald", weight: 500, fill: ink, spacing: 8 })}
   <rect x="${cx - R}" y="${cut + 16}" width="${2 * R}" height="7" fill="${ink}"/>
   <text x="${cx}" y="${headY}" text-anchor="middle" font-family="Alfa Slab One" font-size="${headSize}" letter-spacing="2" fill="${ink}">WE WAIT FOR IT.</text>
   <text x="${cx}" y="${tagY}" text-anchor="middle" font-family="Oswald" font-weight="500" font-size="30" letter-spacing="9" fill="${ink}">CAMPHAWK · CHECKING EVERY 15 SECONDS</text>`;
  return { vb: [W, H], art };
}
export function nightWatchChest3({ ink }) {
  // simplified for 3.75in: solid hawk in the moon, no trees, no engraving
  const W = 600, H = 660, cx = 300, cy = 250, R = 240;
  const art = `<defs><mask id="nwc3" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#000"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="#fff"/><g fill="#000">${hawkAt(cx - 200, cy - 150, 400, "sil")}</g></mask></defs>
    <rect width="${W}" height="${H}" fill="${ink}" mask="url(#nwc3)"/>
    <text x="${cx}" y="${cy + R + 130}" text-anchor="middle" font-family="Alfa Slab One" font-size="100" letter-spacing="4" fill="${ink}">CAMPHAWK</text>`;
  return { vb: [W, H], art };
}


// =====================================================================================
// 7, v4 — STILL WATER: the bold Recraft peak-and-reflection diamond (6–7 planes), no frame
// =====================================================================================
const LF = (n) => rf(`traced-lf2-${n}.svg`, "utf8").match(/ d="([^"]+)"/)[1];
export function stillWater4({ dark, mid, light, shirt, tagline = "THE CAMPSITE YOU WANTED IS BOOKED · WE WAIT FOR IT" }) {
  const W = 1000, H = 1170, cx = 500;
  const S = 900, sx = cx - 0.512 * S, sy = 20; // scene: 1024px art, diamond centre at (0.512, 0.5)
  const k = 4096 / S;
  const hx = 735, hy = 120, hw = 205;
  const art = `<svg x="${sx}" y="${sy}" width="${S}" height="${S}" viewBox="0 0 4096 4096">
       <path fill="${mid}" stroke="${mid}" stroke-width="${1.6 * k}" stroke-linejoin="round" fill-rule="evenodd" d="${LF("mid")}"/>
       <path fill="${light}" stroke="${light}" stroke-width="${1.6 * k}" stroke-linejoin="round" fill-rule="evenodd" d="${LF("light")}"/>
       <path fill="${dark}" fill-rule="evenodd" d="${LF("dark")}"/>
     </svg>
   <g fill="${dark}">${hawkAt(hx, hy, hw, "sil")}</g>
   <text x="${cx}" y="${sy + S + 120}" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="84" letter-spacing="36" fill="${dark}"><tspan dx="18">CAMPHAWK</tspan></text>
   <text x="${cx}" y="${sy + S + 172}" text-anchor="middle" font-family="Oswald" font-weight="500" font-size="23" letter-spacing="3.2" fill="${dark}">${tagline}</text>`;
  return { vb: [W, H], art };
}


// =====================================================================================
// 5 (round 3) → final giveaway: STILL WATER, ONE INK. Rock strata become hatching in the same ink.
// =====================================================================================
export function stillWaterOne({ ink, hatchW = 4.1, hatchGap = 5.9, angle = -35, outline = 2.2, only = "all", tagline = "THE CAMPSITE YOU WANTED IS BOOKED · WE WAIT FOR IT" }) {
  const W = 1000, H = 1130, S = 900, sx = 500 - 0.512 * S, sy = 10, k = 4096 / S;
  let hatch = ""; for (let i = -4096; i < 4096 * 2; i += (hatchW + hatchGap) * k) hatch += `<rect x="${i.toFixed(0)}" y="-4096" width="${(hatchW * k).toFixed(1)}" height="${4096 * 3}"/>`;
  const art = `<defs><clipPath id="m1ink"><path fill-rule="evenodd" d="${LF("mid")}"/></clipPath></defs>
    <svg x="${sx}" y="${sy}" width="${S}" height="${S}" viewBox="0 0 4096 4096">
      ${only !== "base" ? `<g clip-path="url(#m1ink)" fill="${ink}"><g transform="rotate(${angle} 2048 2048)">${hatch}</g></g>` : ""}
      ${only !== "hatch" ? `${outline ? `<path fill="none" stroke="${ink}" stroke-width="${outline * k}" stroke-linejoin="round" d="${LF("mid")}"/><path fill="none" stroke="${ink}" stroke-width="${outline * k}" stroke-linejoin="round" d="${LF("light")}"/>` : ""}
      <path fill="${ink}" fill-rule="evenodd" d="${LF("dark")}"/>` : ""}
    </svg>
    ${only !== "hatch" ? `<g fill="${ink}">${hawkAt(735, 110, 205, "sil")}</g>` : ""}
    ${only !== "hatch" ? `<text x="500" y="${sy + S + 115}" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="84" letter-spacing="36" fill="${ink}"><tspan dx="18">CAMPHAWK</tspan></text>
    <text x="500" y="${sy + S + 165}" text-anchor="middle" font-family="Oswald" font-weight="500" font-size="26" letter-spacing="3.2" fill="${ink}">${tagline}</text>` : ""}`;
  return { vb: [W, H], art };
}
// chest for the one-ink shirt: the hawk thickened slightly so its feather gaps don't clog at 3.75in
export function stillWaterOneChest({ ink }) {
  const art = `${CHEST_WORD(ink)}
    <g fill="${ink}" stroke="${ink}" stroke-width="${(2.2 * HAWK.w) / 270}" stroke-linejoin="round">${hawkAt(165, 118, 270, "sil")}</g>`;
  return { vb: [600, 330], art };
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
