// The Still Water back, rounds 5-7 (2026-10-08): the owner's pick (round 4 no. 7, "Short reflection") polished
// to the reviewers' notes (README, rounds 5-7).
// - Peak: one drawing for both shirts (polish5.py cleans the three-ink art; hatch5.py cuts the gouges).
// - Camp: an A-frame tent with a lit door and a campfire on the peak's axis, the rock cleared round them.
// - Water: hand-cut strokes in rows that open with depth, with the fire's light as one lane through them.
// - Hawk: beside the summit, head toward the peak, feather gouges cut in from the trailing edge.
// - Type: Josefin Sans; the wordmark 7 in wide, the tagline tracked to the same width.
// Everything drawn here shares one hand-cut wobble (the "cut" filter) so it matches the peak.
// Units: print pixels at 300 dpi; the print is 11.5 in = 3450 px wide. 1 mm = 11.8 px.
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { chromium } from "playwright-core";
import { FONTS, P, HAWK, tee, place } from "./lib.mjs";

export const MM = 300 / 25.4, IN = 300, W = 3450, CX = 1725, SHORE = 1606;
const b64 = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
export const INK = {
  one: { fg: "#24382A", glow: null },
  three: { fg: "#2A3B2E", glow: "#E2E6DC" },
};

// ---- camp ----------------------------------------------------------------------------------------------
const FIRE_X = CX, TENT_X = CX + 430, TENT_W = 1.75 * IN, TENT_H = 0.95 * IN, GROUND = SHORE - 6;
// a hand-cut edge: a straight line with a small, smooth wobble
const wob = (x1, y1, x2, y2, seed, amp = 4, n = 10) => { const r = rng(seed); const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, e = i === 0 || i === n ? 0 : (r() - 0.5) * 2 * amp; const nx = -(y2 - y1), ny = x2 - x1, l = Math.hypot(nx, ny);
    pts.push([x1 + (x2 - x1) * t + (nx / l) * e, y1 + (y2 - y1) * t + (ny / l) * e]); } return pts; };
const path = (pts) => "M " + pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L ") + " Z";
// a lens: a cut stroke pointed at both ends (used for gouges, light cuts and feather cuts)
const lens = (x1, y1, x2, y2, w) => { const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l, L = [], R = [];
  for (let i = 0; i <= 16; i++) { const f = i / 16, h = (w / 2) * Math.sin(Math.PI * f) ** 0.9, x = x1 + dx * f, y = y1 + dy * f; L.push([x + nx * h, y + ny * h]); R.push([x - nx * h, y - ny * h]); }
  return path([...L, ...R.reverse()]); };
function tent() {
  const x0 = TENT_X - TENT_W / 2, x1 = TENT_X + TENT_W / 2, ax = TENT_X, ay = GROUND - TENT_H;
  const left = wob(x0, GROUND, ax, ay, 3, 5), right = wob(ax, ay, x1, GROUND, 4, 5);
  const body = path([...left, ...right.slice(1)]);
  const pole = `M ${ax - 0.45 * MM} ${ay + 6} L ${ax - 0.45 * MM} ${ay - 2.4 * MM} Q ${ax} ${ay - 2.9 * MM} ${ax + 0.45 * MM} ${ay - 2.4 * MM} L ${ax + 0.45 * MM} ${ay + 6} Z`;
  // the lit door: a crisp triangle (square corners), its top cut flat at 1.3 mm so the knockout holds
  const dw = TENT_W * 0.40, dh = TENT_H * 0.66, dt = GROUND - dh;
  const door = `M ${ax - dw / 2} ${GROUND + 2} L ${ax - 0.65 * MM} ${dt} L ${ax + 0.65 * MM} ${dt} L ${ax + dw / 2} ${GROUND + 2} Z`;
  // one light cut down the shaded (right) side, parallel to the ridge
  const f0 = 0.22, f1 = 0.86, o = 0.17 * TENT_W;
  const cut = lens(ax + (x1 - ax) * f0 - o * 0.55, ay + (GROUND - ay) * f0 + 6, ax + (x1 - ax) * f1 - o, ay + (GROUND - ay) * f1, 1.5 * MM);
  return { body, pole, door, cut };
}
// the fire: three cut tongues over crossed logs, with one light cut up the middle tongue
const spline = (Pts, n = 10) => { const out = [], m = Pts.length;
  for (let i = 0; i < m; i++) { const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((k) => Pts[(i + k + m) % m]);
    for (let s = 0; s < n; s++) { const t = s / n, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t ** 3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); } } return out; };
function fire() {
  const k = 1.25 * MM, bx = FIRE_X, by = GROUND - 2.6 * k;          // the flame's base sits down in the logs
  // in k units from the flame's base, y up; tips doubled so they stay sharp. Three uneven tongues: a tall one
  // leaning left, a shorter one off to the right, a small one tucked in on the left (round 6 read as a crown)
  const F = [[0, -0.6], [2.4, -0.2], [3.2, 1.4], [3.5, 3.4], [4.3, 5.6], [4.6, 7.4], [4.6, 7.4], [3.3, 6.0], [2.3, 5.6], [2.0, 7.6], [1.0, 10.4], [-0.9, 13.4], [-0.9, 13.4],
    [-1.5, 11.0], [-2.0, 8.6], [-2.3, 7.2], [-3.2, 7.6], [-3.6, 7.9], [-3.6, 7.9], [-3.5, 5.6], [-3.2, 2.6], [-2.6, 0.4]];
  const flame = path(spline(F.map(([x, y]) => [bx + x * k, by - y * k])));
  const core = lens(bx + 0.6 * k, by - 2.2 * k, bx - 0.5 * k, by - 9.0 * k, 1.6 * MM);   // the lit core, a cut
  const half = 5.6 * k, rise = 3.6 * k, t = 1.5 * k, g = GROUND - 0.2 * k;
  const log = (s) => { const [ax, ay, bx2, by2] = [bx - half, g - (s > 0 ? 0 : rise), bx + half, g - (s > 0 ? rise : 0)];
    const dx = bx2 - ax, dy = by2 - ay, l = Math.hypot(dx, dy), nx = (-dy / l) * t / 2, ny = (dx / l) * t / 2;
    return `M ${ax + nx} ${ay + ny} L ${bx2 + nx} ${by2 + ny} L ${bx2 - nx} ${by2 - ny} L ${ax - nx} ${ay - ny} Z`; };
  const embers = `M ${bx - half * 0.72} ${g + 2} L ${bx} ${g - rise * 0.5} L ${bx + half * 0.72} ${g + 2} Z`;
  return { flame, core, logs: log(1) + log(-1) + embers };
}
// pines either side of the camp, tallest beside it (about 60% of the tent) and stepping down outward
function pines() { const r = rng(41); let d = "";
  const tree = (x, h) => { const pts = [[x, GROUND - h]], tiers = Math.max(4, Math.round(h / 34));
    const L = [], R = [];
    for (let i = 1; i <= tiers; i++) { const t = i / tiers, y = GROUND - h + h * 0.88 * t, w = h * 0.2 * (0.25 + 0.75 * t) * (0.85 + r() * 0.3);
      L.push([x - w * 0.45, y - h * 0.06], [x - w, y + h * 0.015]); R.push([x + w * 0.45, y - h * 0.06], [x + w, y + h * 0.015]); }
    const tr = h * 0.035;
    return path([pts[0], ...R, [x + tr, GROUND - h * 0.1], [x + tr, GROUND + 4], [x - tr, GROUND + 4], [x - tr, GROUND - h * 0.1], ...L.reverse()]) + " "; };
  for (const [x, h] of [[2468, 172], [2530, 140], [2588, 112], [2640, 92]]) d += tree(x + (r() - 0.5) * 10, h * (0.95 + r() * 0.1));
  for (const [x, h] of [[1455, 150], [1395, 124], [1340, 100], [1290, 84]]) d += tree(x + (r() - 0.5) * 10, h * (0.95 + r() * 0.1));
  return d; }
// the shore: a low band from treeline to treeline with a rough, hand-cut top edge
function shore() { const r = rng(21); let top = [], bot = [];
  for (let x = 205; x <= 3170; x += 22) { top.push([x, SHORE - 8 - r() * 10]); bot.push([x, SHORE + 12 + r() * 6]); }
  return path([...top, ...bot.reverse()]); }

// ---- water ---------------------------------------------------------------------------------------------
// a hand-cut stroke: entered with a rounded, blunt end (the gouge going in), full at about a third, then
// thinning to a point; the belly sits a little off the line and both edges wander gently (one sine each)
const dash = (x1, x2, y, t, r) => { const flip = r() < 0.5, n = 28, top = [], bot = [];
  const ph1 = r() * 6.28, ph2 = r() * 6.28, wv = (x2 - x1) / (1.3 + r()), lift = (r() - 0.5) * 0.12 * t;
  for (let i = 0; i <= n; i++) { const f = i / n, g = flip ? 1 - f : f;          // g = 0 at the blunt end
    const prof = g < 0.32 ? 0.62 + 0.38 * Math.sin((Math.PI / 2) * (g / 0.32)) : 1 - ((g - 0.32) / 0.68) ** 1.7;
    const x = x1 + (x2 - x1) * f, hw = (t / 2) * Math.max(prof, 0);
    top.push([x, y - hw + lift * Math.sin(Math.PI * f) + 0.06 * t * Math.sin(x / wv * 6.28 + ph1)]);
    bot.push([x, y + hw * 0.92 + 0.06 * t * Math.sin(x / wv * 6.28 + ph2)]); }
  // a round cap on the blunt end
  const e = flip ? n : 0, cx0 = flip ? x2 : x1, dir = flip ? 1 : -1, ty = top[e][1], by = bot[e][1], rr = (by - ty) / 2, cap = [];
  for (let k = 1; k < 6; k++) { const th = Math.PI / 2 - (Math.PI * k) / 6; cap.push([cx0 + dir * rr * Math.cos(th) * 0.8, (ty + by) / 2 - rr * Math.sin(th)]); }
  const pts = flip ? [...top, ...cap, ...bot.reverse()] : [...top, ...bot.reverse(), ...cap.reverse()];
  return path(pts) + " "; };
function water(withGlow) {
  const r = rng(29), rg = rng(31); let ink = "", glow = "";            // rg: the glow only, so both shirts get the same strokes
  const lanes = [[FIRE_X, 0.42 * IN]];                              // the fire's light only (the tent gives none)
  let y = SHORE + 46; const rows = 5;
  for (let i = 0; i < rows; i++) {
    const p = i / (rows - 1);
    const half = 1480 * Math.sqrt(1 - (0.55 * p) ** 2) - 260 * p;
    const t = (1.25 + 0.95 * p) * MM;                              // 1.25 mm near the shore, 2.2 mm nearest the viewer
    const lane = lanes.map(([x, w]) => { const hw = (w * (1 - 0.35 * p)) / 2; return [x - hw + (r() - 0.5) * 60, x + hw + (r() - 0.5) * 60]; });
    let x = CX - half + r() * 60;
    while (x < CX + half - 60) {
      const len = (330 + 360 * p) * (0.55 + r() * 0.8) * (1 - 0.45 * Math.abs(x - CX) / half);   // shorter toward the edges
      let x2 = Math.min(x + len, CX + half);
      for (const [a, b] of lane) if (x < b + 40 && x2 > a - 40) { if (x < a - 40) x2 = a - 40; else { x = b + 40; x2 = Math.min(x + len, CX + half); } }
      if (x2 - x > 80 && r() < 0.97 - 0.12 * p) ink += dash(x, x2, y, t, r);
      x = x2 + (60 + 90 * p) * (0.7 + r() * 0.8);
    }
    // the light in the lane: on the three-ink shirt, a mist sliver; on the one-ink shirt the lane stays bare
    // shirt, a column of light where the rows break (round 6's little stubs read as stitching)
    if (withGlow) for (const [a, b] of lane) if (i < 4) { const w = (b - a) * (0.85 - 0.12 * i); glow += dash((a + b) / 2 - w / 2, (a + b) / 2 + w / 2, y, t * 0.8, rg); }
    y += t + (2.0 + 2.6 * p) * MM * (0.75 + r() * 0.5);               // uneven row spacing
  }
  return { ink, glow, end: y };
}

// ---- hawk and type -------------------------------------------------------------------------------------
const HAWK_W = 1.8 * IN, HAWK_CX = 2650, HAWK_CY = 545, HAWK_ROT = 2;
// feather cuts in the hawk's own units (1290 x 975): gouges driven in from the trailing edge, each a lens centred
// on the edge so only its inner half shows, widest where it opens and tapering into the wing (closed cuts read
// as windows in round 6, and their pointed ends filled in at print). Three on the raised wing, of different
// lengths, one on the lower wing; plus a 1.5 mm eye (a 1.2 mm eye is under the 1.5 mm2 pinhole fill)
const FEATHERS = [[158, 577, 242, 353], [238, 701, 342, 419], [347, 743, 423, 537], [1029, 996, 971, 814]], EYE = [884, 645];
// the cuts are knockouts to the shirt on both shirts (mist-filled cuts spilled past the wing and read as teeth)
const hawk = (fill) => { const h = (HAWK_W * HAWK.h) / HAWK.w, k = HAWK.w / HAWK_W;
  const er = 0.75 * MM * k, eye = `M ${EYE[0] - er} ${EYE[1]} a ${er} ${er} 0 1 0 ${2 * er} 0 a ${er} ${er} 0 1 0 ${-2 * er} 0 Z`;
  const cuts = FEATHERS.map(([a, b, c, d], i) => lens(a, b, c, d, (1.8 - 0.15 * (i % 2)) * MM * k)).join(" ") + " " + eye;
  const inner = `<mask id="hk" maskUnits="userSpaceOnUse" x="-100" y="-100" width="1500" height="1200"><rect x="-100" y="-100" width="1500" height="1200" fill="#fff"/><path fill="#000" d="${cuts}"/></mask><path fill="${fill}" fill-rule="evenodd" mask="url(#hk)" d="${P.hawkSil}"/>`;
  return `<g transform="translate(${HAWK_CX} ${HAWK_CY}) rotate(${HAWK_ROT}) scale(-1 1) translate(${-HAWK_W / 2} ${-h / 2})"><svg width="${HAWK_W}" height="${h}" viewBox="0 0 ${HAWK.w} ${HAWK.h}" overflow="visible">${inner}</svg></g>`; };
const TAG = ["THE CAMPSITE YOU WANTED IS BOOKED", "WE WAIT FOR IT"];
const WORD_SIZE = 276, WORD_W = 2100;                                 // 7 in wide, tracked about 0.24 em
const word = (y, ink) => `<text x="${CX}" y="${y}" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="${WORD_SIZE}" textLength="${WORD_W}" lengthAdjust="spacing" fill="${ink}">CAMPHAWK</text>`;
// two centred lines after "BOOKED", in a lighter weight than the wordmark, caps about 5.3 mm; the tracking is set
// so the first line's ink is as wide as the wordmark's (measured on the kit PNG: 2065 px against 2079)
const TAG_SIZE = 86, TAG_LS = 0.105 * TAG_SIZE, TAG_LEAD = 1.5 * TAG_SIZE;
const tag = (y, ink) => TAG.map((line, i) => `<text x="${CX}" y="${y + i * TAG_LEAD}" text-anchor="middle" font-family="Josefin Sans" font-weight="600" font-size="${TAG_SIZE}" letter-spacing="${TAG_LS}" fill="${ink}"><tspan dx="${TAG_LS / 2}">${line}</tspan></text>`).join("");

export function design(v) {
  const { fg, glow } = INK[v];
  const peakImg = (extra = "") => `<image href="${b64(`out5/peak-${v}.png`)}" x="0" y="0" width="${W}" height="4037"${extra}/>`; // both peaks come from the same 3450 x 4037 drawing
  const t = tent(), f = fire(), w = water(!!glow);
  const capH = 0.7 * WORD_SIZE, wordY = w.end + 0.4 * IN + capH - 40, tagY = wordY + 0.27 * IN + TAG_SIZE * 0.72;
  const campShapes = `${t.body} ${t.pole} ${f.flame} ${f.logs}`, lit = `${t.door} ${t.cut} ${f.core}`;
  const halo = `<clipPath id="above"><rect x="0" y="0" width="${W}" height="${GROUND - 14}"/></clipPath><mask id="clear" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="4037"><rect width="${W}" height="4037" fill="#fff"/><path clip-path="url(#above)" d="${campShapes}" fill="#000" stroke="#000" stroke-width="${4.6 * MM}" stroke-linejoin="round"/></mask>`;
  const peak = peakImg(` mask="url(#clear)"`) + (glow ? `<path clip-path="url(#above)" d="${campShapes}" fill="${glow}" stroke="${glow}" stroke-width="${4.6 * MM}" stroke-linejoin="round"/>` : "");
  const camp = glow
    ? `<path fill="${fg}" d="${campShapes}"/><path fill="${glow}" d="${lit}"/>`
    : `<mask id="lit" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="4000"><rect width="${W}" height="4000" fill="#fff"/><path fill="#000" d="${lit}"/></mask>
       <path fill="${fg}" mask="url(#lit)" d="${campShapes}"/>`;
  // the drawn parts (camp, shore, water, hawk) share one hand-cut wobble, about 0.015 in, so they match the peak
  const cutFx = `<filter id="cut" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="4000"><feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="1" seed="7"/><feDisplacementMap in="SourceGraphic" scale="9" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  const drawn = `<g filter="url(#cut)"><path fill="${fg}" d="${pines()}"/><path fill="${fg}" d="${shore()}"/>${camp}<path fill="${fg}" d="${w.ink}"/>${glow ? `<path fill="${glow}" d="${w.glow}"/>` : ""}${hawk(fg)}</g>`;
  const art = `<defs>${cutFx}${halo}</defs>${peak}${drawn}${word(wordY, fg)}${tag(tagY, fg)}`;
  return { h: Math.ceil(tagY + TAG_LEAD + 0.3 * IN), art, typeTop: Math.floor(wordY - capH - 40) };
}

// ---- render previews -----------------------------------------------------------------------------------
async function main() {
  mkdirSync("out5", { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage();
  const shot = async (file, body, w, h, bg, omit = false) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${FONTS} html,body{margin:0;background:${bg}}</style>${body}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
    await page.screenshot({ path: file, omitBackground: omit });
  };
  for (const [v, bg] of [["one", "#E9E2D0"], ["three", "#9AA796"]]) {
    const { h, art } = design(v);
    const svg = (wpx) => `<svg xmlns="http://www.w3.org/2000/svg" width="${wpx}" height="${Math.round((wpx * h) / W)}" viewBox="0 0 ${W} ${h}" style="display:block">${art}</svg>`;
    await shot(`out5/${v}-flat.png`, `<div style="padding:110px;background:${bg}">${svg(1180)}</div>`, 1400, Math.round((1180 * h) / W) + 220, bg);
    await shot(`out5/${v}-full.png`, svg(W), W, h, "transparent", true);
    console.log(v, h, (h / 300).toFixed(2) + " in tall");
  }
  await browser.close();
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
