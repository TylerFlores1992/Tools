// Round 3: ten new ONE-INK giveaway concepts (Night Watch was turned down; Still Water stays).
// Free: code geometry, the traced logo hawk, and art already paid for (Recraft treeline + lake layers).
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { chromium } from "playwright-core";
import { FONTS, P, HAWK, tee, place, arcText } from "./lib.mjs";
import { pine2, forest } from "./round2.mjs";

const IN = 26.8; // tee units per inch (size L, 20in chest)
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const hawkAt = (x, y, w, kind = "sil", fill = "currentColor", flip = false) => {
  const h = (w * HAWK.h) / HAWK.w;
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${HAWK.w} ${HAWK.h}" overflow="visible"><g ${flip ? `transform="translate(${HAWK.w} 0) scale(-1 1)"` : ""}><path fill="${fill}" fill-rule="evenodd" d="${kind === "eng" ? P.hawkEng : P.hawkSil}"/></g></svg>`;
};
const traced = (n) => readFileSync(`traced-${n}.svg`, "utf8").match(/ d="([^"]+)"/)[1];
const TREES = { d: traced("trees1"), w: 4608, h: 2304, ground: 0.875 };
const LAKE = { dark: traced("lf2-dark"), mid: traced("lf2-mid"), light: traced("lf2-light") };

const SHIRT = { natural: "#E9E2D0", forest: "#2F4A37", navy: "#25314A", sand: "#D6C7A6", white: "#F2F1EC", heather: "#A9ABA6", rust: "#9A4A2E", charcoal: "#2C2F2D", olive: "#5D6340", sky: "#AFC3CF" };
const INK = { forest: "#24382A", bone: "#ECE3CC", navy: "#1F2A40", ochre: "#D79A35", white: "#F3F1EA", rust: "#A44A2C" };

const designs = [];
const add = (d) => designs.push({ ...d, id: designs.length + 1 });

// 1 — FULLY BOOKED, crossed out ------------------------------------------------------------
add({
  name: "Not Anymore", shirt: ["Natural", SHIRT.natural], ink: ["Forest", INK.forest], placement: "Center chest, about 9in wide",
  note: "The whole app in one joke. A big stamped FULLY BOOKED with a hand-drawn line through it, \"not anymore\" in a quick script, and the hawk flying off with it. Reads from across a campground.",
  art: (c) => {
    const W = 1000, H = 640;
    return { vb: [W, H], art: `
      <rect x="40" y="70" width="920" height="300" rx="18" fill="none" stroke="${c}" stroke-width="12"/>
      <rect x="62" y="92" width="876" height="256" rx="10" fill="none" stroke="${c}" stroke-width="4"/>
      <text x="500" y="285" text-anchor="middle" font-family="Big Shoulders Display" font-weight="900" font-size="170" letter-spacing="4" fill="${c}">FULLY BOOKED</text>
      <path d="M 30 300 C 260 250, 620 200, 975 120" stroke="${c}" stroke-width="22" stroke-linecap="round" fill="none"/>
      <text x="560" y="510" text-anchor="middle" font-family="Kaushan Script" font-size="150" fill="${c}" transform="rotate(-6 560 480)">not anymore.</text>
      ${hawkAt(790, -20, 190, "sil", c)}
      <text x="500" y="625" text-anchor="middle" font-family="Oswald" font-weight="500" font-size="30" letter-spacing="14" fill="${c}">CAMPHAWK · WE WATCH FOR CANCELLATIONS</text>` };
  },
});

// 2 — Topo contours with a site pin ---------------------------------------------------------
add({
  name: "Site Pin Topo", shirt: ["Sand", SHIRT.sand], ink: ["Forest", INK.forest], placement: "Full back 11in; small pin on the chest",
  note: "A topo map of a mountain drawn as contour lines, with one map pin on the campsite and its coordinates underneath. Quiet and outdoorsy; the pin is the app's whole idea.",
  art: (c) => {
    const W = 1000, H = 1150; let lines = "";
    const hills = [[470, 400, 260, 1], [720, 560, 170, 0.6], [250, 620, 200, 0.55], [600, 250, 120, 0.35]];
    const hgt = (x, y) => hills.reduce((h, [px, py, sg, a]) => h + a * Math.exp(-((x - px) ** 2 + (y - py) ** 2) / (2 * sg * sg)), 0)
      + 0.04 * Math.sin(x / 37) * Math.cos(y / 53) + 0.03 * Math.sin((x + y) / 29);
    const G = 6, nx = Math.ceil(W / G), ny = Math.ceil(940 / G);
    const v = []; for (let j = 0; j <= ny; j++) { v.push([]); for (let i = 0; i <= nx; i++) v[j].push(hgt(i * G, j * G)); }
    for (let k = 1; k <= 22; k++) {
      const lv = k * 0.05; let d = "";
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = v[j][i], b = v[j][i + 1], c2 = v[j + 1][i + 1], e = v[j + 1][i];
        const pts = []; const edge = (p, q, x1, y1, x2, y2) => { if ((p - lv) * (q - lv) < 0) { const t = (lv - p) / (q - p); pts.push([(x1 + (x2 - x1) * t) * G, (y1 + (y2 - y1) * t) * G]); } };
        edge(a, b, i, j, i + 1, j); edge(b, c2, i + 1, j, i + 1, j + 1); edge(c2, e, i + 1, j + 1, i, j + 1); edge(e, a, i, j + 1, i, j);
        for (let m = 0; m + 1 < pts.length; m += 2) d += `M${pts[m][0].toFixed(1)} ${pts[m][1].toFixed(1)}L${pts[m + 1][0].toFixed(1)} ${pts[m + 1][1].toFixed(1)}`;
      }
      lines += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${k % 5 === 0 ? 7 : 3.6}" stroke-linecap="round"/>`;
    }
    const pin = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" fill="${c}" fill-rule="evenodd" d="M 0 0 C -14 -28, -40 -46, -40 -76 A 40 40 0 1 1 40 -76 C 40 -46, 14 -28, 0 0 Z M 0 -94 A 18 18 0 1 0 0.1 -94 Z"/>`;
    return { vb: [W, H], art: `
      <defs><clipPath id="t2"><circle cx="500" cy="480" r="430"/></clipPath>
        <mask id="t2m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><circle cx="585" cy="555" r="70" fill="#000"/></mask></defs>
      <g clip-path="url(#t2)" mask="url(#t2m)">${lines}</g>
      <circle cx="500" cy="480" r="430" fill="none" stroke="${c}" stroke-width="10"/>
      ${pin(585, 600, 1.15)}
      <text x="500" y="1010" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="76" letter-spacing="30" fill="${c}"><tspan dx="15">CAMPHAWK</tspan></text>
      <text x="500" y="1070" text-anchor="middle" font-family="Oswald" font-weight="500" font-size="30" letter-spacing="8" fill="${c}">37.7396° N · 119.5653° W · SITE OPEN</text>` };
  },
  chest: (c) => ({ vb: [300, 300], art: `<path transform="translate(150 260) scale(2.2)" fill="${c}" fill-rule="evenodd" d="M 0 0 C -14 -28, -40 -46, -40 -76 A 40 40 0 1 1 40 -76 C 40 -46, 14 -28, 0 0 Z M 0 -94 A 18 18 0 1 0 0.1 -94 Z"/>` }),
});

// 3 — Stop refreshing: a refresh arrow made of pines ----------------------------------------
add({
  name: "Stop Refreshing", shirt: ["Heather grey", SHIRT.heather], ink: ["Forest", INK.forest], placement: "Center chest, about 8in wide",
  note: "Every camper has hammered refresh at 7am on booking day. The refresh arrow is a ring of pines around a tent, and the line underneath is the punchline.",
  art: (c) => {
    const W = 900, H = 1000, cx = 450, cy = 390, R = 300;
    const a0 = (-60 * Math.PI) / 180, a1 = (250 * Math.PI) / 180;
    const p = (a, rr = R) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    const tip = p(a0 - 0.32), wl = p(a0 + 0.02, R - 70), wr = p(a0 + 0.02, R + 70);
    return { vb: [W, H], art: `
      <defs><clipPath id="in3"><circle cx="${cx}" cy="${cy}" r="${R - 40}"/></clipPath></defs>
      <path d="M ${x1} ${y1} A ${R} ${R} 0 1 0 ${x0} ${y0}" fill="none" stroke="${c}" stroke-width="44"/>
      <path d="M ${wl[0]} ${wl[1]} L ${tip[0]} ${tip[1]} L ${wr[0]} ${wr[1]} Z" fill="${c}"/>
      <g clip-path="url(#in3)" fill="${c}">
        <path d="${forest(cx - R, cx + R, cy + 120, 70, 230, 3, { edgeTall: true })}"/>
        <rect x="${cx - R}" y="${cy + 116}" width="${2 * R}" height="${R}"/>
      </g>
      <path d="M ${cx - 80} ${cy + 200} L ${cx} ${cy + 110} L ${cx + 80} ${cy + 200} Z" fill="${SHIRT.heather}"/>
      <path d="M ${cx} ${cy + 150} L ${cx - 22} ${cy + 200} L ${cx + 22} ${cy + 200} Z" fill="${c}"/>
      ${hawkAt(cx - 70, cy - 170, 160, "sil", c)}
      <text x="${cx}" y="845" text-anchor="middle" font-family="Alfa Slab One" font-size="80" letter-spacing="2" fill="${c}">STOP REFRESHING.</text>
      <text x="${cx}" y="920" text-anchor="middle" font-family="Oswald" font-weight="500" font-size="36" letter-spacing="10" fill="${c}">CAMPHAWK WATCHES FOR YOU</text>` };
  },
});

// 4 — Arrowhead patch: Cancellation Patrol --------------------------------------------------
add({
  name: "Cancellation Patrol", shirt: ["Olive", SHIRT.olive], ink: ["Bone", INK.bone], placement: "Left chest 3.75in + full back 10in",
  note: "Styled like a park-service arrowhead patch, but the unit is the Cancellation Patrol. Official-looking and a little funny; works small on the chest and big on the back.",
  art: (c) => {
    const W = 800, H = 1040;
    const arrow = (k) => `M 400 ${30 + k} C 560 ${40 + k}, ${740 - k} ${110 + k}, ${760 - k} ${260 + k * 0.6} C ${770 - k} ${420}, ${700 - k} ${640}, 400 ${1010 - k} C ${100 + k} ${640}, ${30 + k} ${420}, ${40 + k} ${260 + k * 0.6} C ${60 + k} ${110 + k}, 240 ${40 + k}, 400 ${30 + k} Z`;
    return { vb: [W, H], art: `
      <defs><mask id="p4" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
        <rect width="${W}" height="${H}" fill="#fff"/>
        <path d="${arrow(26)}" fill="none" stroke="#000" stroke-width="7"/>
        <text x="400" y="200" text-anchor="middle" font-family="Oswald" font-weight="700" font-size="74" letter-spacing="10" fill="#000">CAMPHAWK</text>
        <g fill="#000">${hawkAt(190, 235, 420, "sil", "#000")}</g>
        <text x="400" y="640" text-anchor="middle" font-family="Oswald" font-weight="700" font-size="58" letter-spacing="6" fill="#000">CANCELLATION</text>
        <text x="400" y="708" text-anchor="middle" font-family="Oswald" font-weight="700" font-size="58" letter-spacing="16" fill="#000">PATROL</text>
        <path fill="#000" d="${forest(200, 600, 880, 50, 140, 21, { edgeTall: true })}"/>
        <rect x="180" y="876" width="440" height="10" fill="#000"/>
      </mask></defs>
      <path d="${arrow(0)}" fill="${c}" mask="url(#p4)"/>` };
  },
  chestSame: true,
});

// 5 — Still Water, one ink (the giveaway twin of your three-ink shirt) ----------------------
add({
  name: "Still Water, One Ink", shirt: ["Natural", SHIRT.natural], ink: ["Forest", INK.forest], placement: "Left chest 3.75in + full back 10in",
  note: "The giveaway twin of the shirt you liked. Same peak-and-reflection diamond, cut down to one ink: the rock strata become fine engraved lines. You two wear three inks, everyone else gets the one-ink version.",
  art: (c) => {
    const W = 1000, H = 1130, S = 900, sx = 500 - 0.512 * S, sy = 10, k = 4096 / S;
    // mid tone (strata) → 45° hatching in the same ink: lines 3.6 units, gaps 5 (≥1mm at 10in)
    let hatch = ""; for (let i = -4096; i < 4096 * 2; i += 8.6 * k) hatch += `<rect x="${i}" y="-4096" width="${3.6 * k}" height="${4096 * 3}"/>`;
    return { vb: [W, H], art: `
      <defs><clipPath id="m5"><path fill-rule="evenodd" d="${LAKE.mid}"/></clipPath></defs>
      <svg x="${sx}" y="${sy}" width="${S}" height="${S}" viewBox="0 0 4096 4096">
        <g clip-path="url(#m5)" fill="${c}"><g transform="rotate(-35 2048 2048)">${hatch}</g></g>
        <path fill="${c}" fill-rule="evenodd" d="${LAKE.dark}"/>
      </svg>
      ${hawkAt(735, 110, 205, "sil", c)}
      <text x="500" y="${sy + S + 115}" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="84" letter-spacing="36" fill="${c}"><tspan dx="18">CAMPHAWK</tspan></text>
      <text x="500" y="${sy + S + 165}" text-anchor="middle" font-family="Oswald" font-weight="500" font-size="23" letter-spacing="3.2" fill="${c}">THE CAMPSITE YOU WANTED IS BOOKED · WE WAIT FOR IT</text>` };
  },
  chest: (c) => ({ vb: [600, 330], art: `<text x="300" y="90" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="92" letter-spacing="20" fill="${c}">CAMPHAWK</text>${hawkAt(165, 118, 270, "sil", c)}` }),
});

// 6 — The notification ------------------------------------------------------------------------
add({
  name: "The Notification", shirt: ["White", SHIRT.white], ink: ["Forest", INK.forest], placement: "Center chest, about 8in wide",
  note: "The moment every CampHawk user waits for, as a lock-screen alert: a site just opened. Drawn as a clean outline card, so it reads as a graphic, not a screenshot.",
  art: (c) => {
    const W = 900, H = 520;
    return { vb: [W, H], art: `
      <rect x="20" y="20" width="860" height="330" rx="56" fill="none" stroke="${c}" stroke-width="10"/>
      <rect x="62" y="62" width="104" height="104" rx="26" fill="${c}"/>
      <g>${hawkAt(70, 85, 88, "sil", SHIRT.white)}</g>
      <text x="196" y="102" font-family="Oswald" font-weight="700" font-size="40" letter-spacing="5" fill="${c}">CAMPHAWK</text>
      <text x="838" y="102" text-anchor="end" font-family="Oswald" font-weight="500" font-size="36" fill="${c}">now</text>
      <text x="196" y="170" font-family="Oswald" font-weight="700" font-size="54" fill="${c}">A site just opened.</text>
      <text x="64" y="245" font-family="Oswald" font-weight="500" font-size="40" fill="${c}">Upper Pines, site 042 · Fri–Sun, 2 nights.</text>
      <text x="64" y="305" font-family="Oswald" font-weight="500" font-size="40" fill="${c}">It's in your cart. Go.</text>
      <text x="450" y="455" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="54" letter-spacing="22" fill="${c}"><tspan dx="11">SOMEONE CANCELED</tspan></text>` };
  },
});

// 7 — The 7am routine, crossed out --------------------------------------------------------------
add({
  name: "The 7AM Routine", shirt: ["Navy", SHIRT.navy], ink: ["Bone", INK.bone], placement: "Full back 11in; wordmark on the chest",
  note: "A to-do list every Yosemite hopeful knows, each line struck through, then the answer. Pure type, big personality, and the cheapest kind of screen to make.",
  art: (c) => {
    const W = 1000, H = 1000;
    const rows = ["SET ALARM FOR 6:59 AM", "OPEN 4 BROWSER TABS", "REFRESH. REFRESH. REFRESH.", "SOLD OUT IN 9 SECONDS", "TRY AGAIN NEXT MONTH"];
    return { vb: [W, H], art: `
      <text x="500" y="90" text-anchor="middle" font-family="Oswald" font-weight="500" font-size="40" letter-spacing="14" fill="${c}">HOW TO BOOK A CAMPSITE</text>
      <rect x="150" y="120" width="700" height="6" fill="${c}"/>
      ${rows.map((t, i) => `<text x="500" y="${215 + i * 105}" text-anchor="middle" font-family="Big Shoulders Display" font-weight="800" font-size="76" letter-spacing="2" fill="${c}">${t}</text><rect x="${150 + (i % 2) * 20}" y="${190 + i * 105}" width="${660 - (i % 3) * 30}" height="9" fill="${c}" transform="rotate(${i % 2 ? -1.2 : 1} 500 ${190 + i * 105})"/>`).join("")}
      <text x="500" y="820" text-anchor="middle" font-family="Kaushan Script" font-size="96" fill="${c}">or just...</text>
      <text x="500" y="945" text-anchor="middle" font-family="Alfa Slab One" font-size="120" letter-spacing="4" fill="${c}">CAMPHAWK</text>` };
  },
  chest: (c) => ({ vb: [600, 160], art: `<text x="300" y="110" text-anchor="middle" font-family="Alfa Slab One" font-size="110" letter-spacing="4" fill="${c}">CAMPHAWK</text>` }),
});

// 8 — Circling: one line, a tent, the hawk's orbit -------------------------------------------
add({
  name: "Circling", shirt: ["Forest green", SHIRT.forest], ink: ["Bone", INK.bone], placement: "Left chest 4in only",
  note: "Minimal and premium: a single-line ridge with one tent, and the hawk's flight path drawn as a dotted circle around it. We circle until it opens. Small chest print only, like your green-tee example.",
  art: (c) => {
    const W = 600, H = 560;
    return { vb: [W, H], art: `
      <ellipse cx="300" cy="245" rx="265" ry="135" fill="none" stroke="${c}" stroke-width="6" stroke-dasharray="2 18" stroke-linecap="round" transform="rotate(-8 300 245)"/>
      <path d="M 40 360 L 170 230 L 230 290 L 320 170 L 440 330 L 490 290 L 560 360" fill="none" stroke="${c}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M 262 360 L 300 312 L 338 360 Z M 300 330 L 290 360 L 310 360 Z" fill="${c}" fill-rule="evenodd"/>
      <rect x="40" y="356" width="520" height="8" rx="4" fill="${c}"/>
      ${hawkAt(400, 110, 140, "sil", c)}
      <text x="300" y="470" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="64" letter-spacing="24" fill="${c}"><tspan dx="12">CAMPHAWK</tspan></text>
      <text x="300" y="530" text-anchor="middle" font-family="Oswald" font-weight="500" font-size="30" letter-spacing="10" fill="${c}">WE CIRCLE UNTIL IT OPENS</text>` };
  },
  chestOnly: true,
});

// 9 — Trail sign stack ----------------------------------------------------------------------------
add({
  name: "Trail Signs", shirt: ["Rust", SHIRT.rust], ink: ["Bone", INK.bone], placement: "Full back 10in; small arrow sign on the chest",
  note: "Routed wooden trail signs on a post, pointing different ways: the booked campground one way, the open site the other. Warm, nostalgic, and the joke lands on a second look.",
  art: (c) => {
    const W = 900, H = 1100;
    const sign = (y, w, dir, line1, line2) => {
      const x0 = dir > 0 ? 450 - 40 : 450 + 40 - w; const tip = dir > 0 ? x0 + w + 60 : x0 - 60;
      const pts = dir > 0 ? `${x0},${y} ${x0 + w},${y} ${tip},${y + 75} ${x0 + w},${y + 150} ${x0},${y + 150}` : `${x0 + w},${y} ${x0},${y} ${tip},${y + 75} ${x0},${y + 150} ${x0 + w},${y + 150}`;
      const tx = dir > 0 ? x0 + w / 2 + 10 : x0 + w / 2 - 10;
      return `<polygon points="${pts}" fill="${c}"/>
        <text x="${tx}" y="${y + 70}" text-anchor="middle" font-family="Rye" font-size="50" fill="${SHIRT.rust}">${line1}</text>
        <text x="${tx}" y="${y + 125}" text-anchor="middle" font-family="Oswald" font-weight="700" font-size="38" letter-spacing="6" fill="${SHIRT.rust}">${line2}</text>`;
    };
    return { vb: [W, H], art: `
      <rect x="425" y="60" width="50" height="1000" fill="${c}"/>
      ${hawkAt(330, 0, 240, "sil", c)}
      ${sign(150, 520, -1, "Upper Pines", "FULLY BOOKED · 0 SITES")}
      ${sign(340, 500, 1, "Your Site", "OPEN · 1 SITE · 0.2 MI")}
      ${sign(530, 440, -1, "Refreshing", "NO LONGER REQUIRED")}
      <path fill="${c}" d="${forest(80, 820, 1060, 60, 200, 5, { edgeTall: true })}"/>
      <rect x="60" y="1055" width="780" height="12" fill="${c}"/>` };
  },
  chest: (c) => ({ vb: [600, 260], art: `<polygon points="40,40 470,40 560,130 470,220 40,220" fill="${c}"/><text x="255" y="155" text-anchor="middle" font-family="Rye" font-size="62" fill="${SHIRT.rust}">CampHawk</text>` }),
});

// 10 — Treeline wordmark --------------------------------------------------------------------
add({
  name: "Treeline Wordmark", shirt: ["Charcoal", SHIRT.charcoal], ink: ["Bone", INK.bone], placement: "Center chest, about 10in wide",
  note: "The wide CAMPHAWK wordmark from Still Water with the hand-cut treeline growing out of it, and one small hawk above the gap. Simple enough to wear anywhere; pairs with Still Water.",
  art: (c) => {
    const W = 1000, H = 520, tw = 1000, th = (tw * TREES.h) / TREES.w;
    return { vb: [W, H], art: `
      <svg x="0" y="${300 - th * TREES.ground}" width="${tw}" height="${th}" viewBox="0 0 ${TREES.w} ${TREES.h}"><path fill="${c}" d="${TREES.d}"/></svg>
      <rect x="0" y="300" width="${W}" height="16" fill="${c}"/>
      ${hawkAt(430, 70, 150, "sil", c)}
      <text x="500" y="440" text-anchor="middle" font-family="Josefin Sans" font-weight="700" font-size="100" letter-spacing="44" fill="${c}"><tspan dx="22">CAMPHAWK</tspan></text>
      <text x="500" y="500" text-anchor="middle" font-family="Oswald" font-weight="500" font-size="32" letter-spacing="12" fill="${c}">WE WAIT FOR IT</text>` };
  },
});

// ---------- render: front, back (if any), flat ----------
mkdirSync("out3", { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1800, height: 700 } });
const flat = (a, bg, w, h) => `<div style="width:${w}px;height:${h}px;background:${bg};display:flex;align-items:center;justify-content:center"><svg viewBox="-40 -40 ${a.vb[0] + 80} ${a.vb[1] + 80}" style="width:88%;height:88%">${a.art}</svg></div>`;
const chestAt = (a, w = 3.75) => place(612 - (w * IN) / 2, 95 + 3.2 * IN, w * IN, a.vb, a.art);
const backAt = (a, w) => place(500 - (w * IN) / 2, 95 + 3 * IN, w * IN, a.vb, a.art);
const centerAt = (a, w) => place(500 - (w * IN) / 2, 95 + 4.5 * IN, w * IN, a.vb, a.art);
const meta = [];
for (const d of designs) {
  const c = d.ink[1], a = d.art(c), sh = d.shirt[1];
  let front, back = null;
  const wIn = Number((d.placement.match(/([\d.]+)in/) || [])[1] || 10);
  if (d.chestOnly) front = chestAt(a, 4);
  else if (/^Center chest/.test(d.placement)) front = centerAt(a, wIn);
  else { front = chestAt(d.chest ? d.chest(c) : a); back = backAt(a, Number((d.placement.match(/back ([\d.]+)in/) || [])[1] || 10)); }
  const cell = (inner, label) => `<div class="t" style="width:600px;height:700px;position:relative;display:flex;align-items:center;justify-content:center"><span style="position:absolute;top:14px;font:500 15px Oswald;letter-spacing:4px;color:#666">${label}</span>${inner}</div>`;
  const cells = cell(tee(sh, front), "FRONT") + (back ? cell(tee(sh, back, true), "BACK") : cell(tee(sh, ""), "BACK · BLANK"));
  const html = `<!doctype html><meta charset="utf-8"><style>${FONTS} html,body{margin:0;background:#ECEAE4} .t > svg{height:640px;width:auto;margin-top:20px}</style><div style="display:flex;width:1800px;height:700px">${cells}${flat(a, sh, 600, 700)}</div>`;
  await page.setContent(html, { waitUntil: "load" }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(120);
  const f = `out3/idea-${String(d.id).padStart(2, "0")}.png`; await page.screenshot({ path: f });
  meta.push({ id: d.id, name: d.name, shirt: d.shirt, ink: d.ink, placement: d.placement, note: d.note });
  console.log(f, d.name);
}
writeFileSync("out3/ideas.json", JSON.stringify(meta, null, 1));
await browser.close();
