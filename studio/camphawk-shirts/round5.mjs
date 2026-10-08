// Round 5 (2026-10-08): the owner's pick (round 4 no. 7, "Short reflection") polished to the reviewers' notes.
// - Peak: one drawing for both shirts (polish5.py cleans the three-ink art; hatch5.py cuts the one-ink
//   version's moss areas as gouge strokes instead of the old traced capsules).
// - Camp: a bigger A-frame tent with a lit door and a campfire, on a shoreline, the fire on the peak's axis.
// - Water: rows that open up toward the viewer (perspective) inside an oval, with the fire's and the door's
//   light as clear lanes through the ripples (mist ink on the three-ink shirt).
// - Hawk: turned to face the camp it watches, banked, beside the summit.
// - Type: one family; the wordmark tighter and larger, the tagline narrower, clear steps between them.
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
function tent(ink) {
  const x0 = TENT_X - TENT_W / 2, x1 = TENT_X + TENT_W / 2, ax = TENT_X, ay = GROUND - TENT_H;
  // body: an A-frame with slightly bellied sides, the ridge pole poking out above the apex
  const left = wob(x0, GROUND, ax, ay, 3, 5), right = wob(ax, ay, x1, GROUND, 4, 5);
  const body = path([...left, ...right.slice(1)]);
  const pole = `M ${ax - 0.45 * MM} ${ay + 6} L ${ax - 0.45 * MM} ${ay - 2.4 * MM} Q ${ax} ${ay - 2.9 * MM} ${ax + 0.45 * MM} ${ay - 2.4 * MM} L ${ax + 0.45 * MM} ${ay + 6} Z`;
  // the lit door: a tall triangle, its top blunt (a knockout must stay over 1 mm wide)
  const dw = TENT_W * 0.40, dh = TENT_H * 0.66, dt = GROUND - dh;
  const door = `M ${ax - dw / 2} ${GROUND + 2} L ${ax - 0.65 * MM} ${dt} Q ${ax} ${dt - 1.0 * MM} ${ax + 0.65 * MM} ${dt} L ${ax + dw / 2} ${GROUND + 2} Z`;
  // guy lines as short pegged strokes, and a tie-back seam on each door flap (1 mm cuts)
  const seamL = `M ${ax - dw * 0.18} ${GROUND - dh * 0.55} L ${ax - dw * 0.62} ${GROUND - 2} L ${ax - dw * 0.62 + 1.1 * MM} ${GROUND - 2} Z`;
  const seamR = `M ${ax + dw * 0.18} ${GROUND - dh * 0.55} L ${ax + dw * 0.62} ${GROUND - 2} L ${ax + dw * 0.62 - 1.1 * MM} ${GROUND - 2} Z`;
  return { body, pole, door, seams: seamL + seamR };
}
// the fire: one flame with a side lick and a heart, over crossed logs, all in mm from the fire's base
const spline = (Pts, n = 10) => { const out = [], m = Pts.length;
  for (let i = 0; i < m; i++) { const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((k) => Pts[(i + k + m) % m]);
    for (let s = 0; s < n; s++) { const t = s / n, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t ** 3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); } } return out; };
function fire() {
  const k = 1.25 * MM, bx = FIRE_X, by = GROUND - 5.3 * k; // flame base sits above the logs
  const F = [[0, 0], [2.0, 0.3], [3.0, 1.3], [3.3, 2.8], [3.1, 4.2], [3.6, 5.3], [3.9, 6.8], [3.9, 6.8], [2.8, 6.0], [2.0, 5.6], [1.6, 6.6], [1.0, 8.0], [-0.2, 9.8], [-0.2, 9.8], [-0.6, 8.4], [-1.6, 6.6], [-2.6, 5.4], [-3.1, 4.0], [-3.3, 2.6], [-2.9, 1.3], [-1.9, 0.3]];
  const flame = path(spline(F.map(([x, y]) => [bx + x * k, by - y * k])));
  const Hh = [[0, 0], [1.25, 0.6], [1.15, 2.2], [0.1, 3.9], [-1.15, 2.2], [-1.25, 0.6]]; // the heart, 2.5 mm wide at this scale
  const heart = path(spline(Hh.map(([x, y]) => [bx + x * k, by - (y + 0.9) * k])));
  const half = 5.6 * k, rise = 3.6 * k, t = 1.5 * k, g = GROUND - 0.2 * k;
  const log = (s) => { const [ax, ay, bx2, by2] = [bx - half, g - (s > 0 ? 0 : rise), bx + half, g - (s > 0 ? rise : 0)];
    const dx = bx2 - ax, dy = by2 - ay, l = Math.hypot(dx, dy), nx = (-dy / l) * t / 2, ny = (dx / l) * t / 2;
    return `M ${ax + nx} ${ay + ny} L ${bx2 + nx} ${by2 + ny} L ${bx2 - nx} ${by2 - ny} L ${ax - nx} ${ay - ny} Z`; };
  const embers = `M ${bx - half * 0.72} ${g + 2} L ${bx} ${g - rise * 0.5} L ${bx + half * 0.72} ${g + 2} Z`;
  return { flame, heart, logs: log(1) + log(-1) + embers };
}
// the shore under the camp: a low wavy band from treeline to treeline, so the peak stands on ground
function shore() { const r = rng(21); let top = [], bot = [];
  for (let x = 205; x <= 3170; x += 40) { top.push([x, SHORE - 9 - r() * 7]); bot.push([x, SHORE + 12 + r() * 5]); }
  return path([...top, ...bot.reverse()]); }

// ---- water ---------------------------------------------------------------------------------------------
// a tapered dash with a slightly uneven belly (hand-cut), pointed ends
const dash = (x1, x2, y, t, r) => { const m = x1 + (x2 - x1) * (0.4 + r() * 0.2), k = Math.min(t * 1.6, (x2 - x1) * 0.25), tu = t * (0.45 + r() * 0.1), td = t - tu;
  return `M ${x1} ${y} C ${x1 + k} ${y - tu}, ${m - k} ${y - tu}, ${m} ${y - tu} C ${m + k} ${y - tu}, ${x2 - k} ${y - tu}, ${x2} ${y} C ${x2 - k} ${y + td}, ${m + k} ${y + td}, ${m} ${y + td} C ${m - k} ${y + td}, ${x1 + k} ${y + td}, ${x1} ${y} Z `; };
function water() {
  const r = rng(29); let ink = "", glow = "";
  const lanes = [[FIRE_X, 0.42 * IN], [TENT_X, 0.30 * IN]]; // light lanes under the fire and the lit door
  let y = SHORE + 50; const rows = 6;
  for (let i = 0; i < rows; i++) {
    const p = i / (rows - 1);
    const half = 1480 * Math.sqrt(1 - (0.55 * p) ** 2) - 260 * p;  // an oval: rows shorten toward the viewer
    const t = (1.55 + 0.85 * p) * MM;                              // nearer rows are thicker
    const lane = lanes.map(([x, w]) => { const hw = (w * (1 - 0.35 * p)) / 2; return [x - hw + (r() - 0.5) * 70, x + hw + (r() - 0.5) * 70]; });
    let x = CX - half + r() * 60;
    while (x < CX + half - 60) {
      const len = (330 + 360 * p) * (0.55 + r() * 0.8);
      let x2 = Math.min(x + len, CX + half);
      for (const [a, b] of lane) if (x < b + 40 && x2 > a - 40) { if (x < a - 40) x2 = a - 40; else { x = b + 40; x2 = Math.min(x + len, CX + half); } }
      if (x2 - x > 80 && r() < 0.95 - 0.25 * p) ink += dash(x, x2, y, t, r);
      x = x2 + (60 + 90 * p) * (0.7 + r() * 0.8);
    }
    // the light itself: short dashes in the lane, only where there is a glow ink (three-ink shirt)
    for (const [a, b] of lane) if (i < 4) { const w = (b - a) * (0.75 - 0.15 * i); glow += dash((a + b) / 2 - w / 2, (a + b) / 2 + w / 2, y, t * 0.9, r); }
    y += t + (1.7 + 2.3 * p) * MM + (1.6 + 0.85 * (i + 1) / (rows - 1)) * MM * 0.5;
  }
  return { ink, glow, end: y };
}

// ---- hawk and type -------------------------------------------------------------------------------------
const HAWK_W = 1.5 * IN, HAWK_CX = 2560, HAWK_CY = 470;
const hawk = (fill) => { const h = (HAWK_W * HAWK.h) / HAWK.w;
  return `<g transform="translate(${HAWK_CX} ${HAWK_CY}) rotate(4) scale(-1 1) translate(${-HAWK_W / 2} ${-h / 2})"><svg width="${HAWK_W}" height="${h}" viewBox="0 0 ${HAWK.w} ${HAWK.h}" overflow="visible"><path fill="${fill}" fill-rule="evenodd" d="${P.hawkSil}"/></svg></g>`; };
const TAG = ["THE CAMPSITE YOU WANTED IS BOOKED", "WE WAIT FOR IT"];
const WORD_W = 2120;
const word = (y, ink) => `<text x="${CX}" y="${y}" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="276" textLength="${WORD_W}" lengthAdjust="spacing" fill="${ink}">CAMPHAWK</text>`;
// two centred lines after "BOOKED", tracked 0.14 em (the trailing space of letter-spacing is cancelled with dx)
const TAG_SIZE = 72, TAG_LS = 0.1 * TAG_SIZE, TAG_LEAD = 1.5 * TAG_SIZE;
const tag = (y, ink) => TAG.map((line, i) => `<text x="${CX}" y="${y + i * TAG_LEAD}" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="${TAG_SIZE}" letter-spacing="${TAG_LS}" fill="${ink}"><tspan dx="${TAG_LS / 2}">${line}</tspan></text>`).join("");

export function design(v) {
  const { fg, glow } = INK[v];
  const peak = `<image href="${b64(`out5/peak-${v}.png`)}" x="0" y="0" width="${W}" height="4037"/>`; // both peaks come from the same 3450 x 4037 drawing
  const t = tent(), f = fire(), w = water();
  const knock = glow ?? "#000"; // three-ink: the door and the fire's heart are mist; one-ink: cut out (mask)
  const capH = 0.7 * 276, wordY = w.end + 0.42 * IN + capH - 40, tagY = wordY + 0.24 * IN + TAG_SIZE * 0.72;
  const camp = glow
    ? `<path fill="${fg}" d="${t.body} ${t.pole} ${f.flame} ${f.logs}"/><path fill="${glow}" d="${t.door} ${f.heart}"/>`
    : `<defs><mask id="lit" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="4000"><rect width="${W}" height="4000" fill="#fff"/><path fill="#000" d="${t.door} ${f.heart}"/></mask></defs>
       <path fill="${fg}" mask="url(#lit)" d="${t.body} ${t.pole} ${f.flame} ${f.logs}"/>`;
  const art = `${peak}<path fill="${fg}" d="${shore()}"/>${camp}<path fill="${fg}" d="${w.ink}"/>${glow ? `<path fill="${glow}" d="${w.glow}"/>` : ""}${hawk(fg)}${word(wordY, fg)}${tag(tagY, fg)}`;
  return { h: Math.ceil(tagY + TAG_LEAD + 0.3 * IN), art, knock, typeTop: Math.floor(wordY - capH - 40) };
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
