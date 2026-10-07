// Builds 10 CampHawk shirt concepts as SVG and renders them onto tee mockups with Chromium.
// Everything is free: traced logo layers (traced-*.svg), OFL fonts (fonts/), hand-written geometry.
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { chromium } from "playwright-core";

const D = (n) => readFileSync(`traced-${n}.svg`, "utf8").match(/ d="([^"]+)"/)[1];
const P = { hawkSil: D("hawk-sil"), hawkEng: D("hawk-eng"), badgeDark: D("badge-dark"), badgeMid: D("badge-mid") };
// traced coordinate boxes
const HAWK = { w: 1290, h: 975 }; // hawk crop ×3
const BADGE = { w: 2055, h: 1755 }; // badge crop ×3

const FONTS = readFileSync("fonts.css", "utf8");

// ---------- inks and shirts (named, so nothing is told by colour alone) ----------
const INK = {
  forest: "#24382A", bone: "#EFE6D2", ochre: "#D39130", rust: "#B4462F", sage: "#8DA48A",
  pine: "#2F5A3E", slate: "#3D4A52", sky: "#B9CBD3", navy: "#1F2C46",
};
const SHIRT = {
  sand: "#D8CBB0", heatherGreen: "#4C6646", charcoal: "#2C2F2D", mustard: "#C48E2C", stone: "#A7AAA2",
  oatmeal: "#E4DBC9", sage: "#9AA796", cream: "#EEE7D8", white: "#F3F2EE", navy: "#26324C",
};

// ---------- reusable art pieces ----------
const hawk = (fill, kind = "eng") => `<path fill="${fill}" fill-rule="evenodd" d="${kind === "eng" ? P.hawkEng : P.hawkSil}"/>`;
const hawkSvg = (x, y, w, fill, kind = "eng", flip = false) => {
  const h = (w * HAWK.h) / HAWK.w;
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${HAWK.w} ${HAWK.h}" overflow="visible">${flip ? `<g transform="translate(${HAWK.w} 0) scale(-1 1)">` : "<g>"}${hawk(fill, kind)}</g></svg>`;
};
const badgeSvg = (x, y, w, dark, mid, extra = "") => {
  const h = (w * BADGE.h) / BADGE.w;
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${BADGE.w} ${BADGE.h}" overflow="visible">${extra}${mid ? `<path fill="${mid}" fill-rule="evenodd" d="${P.badgeMid}" clip-path="url(#badgeInner)"/>` : ""}<path fill="${dark}" fill-rule="evenodd" d="${P.badgeDark}"/></svg>`;
};
// inner of the logo's shield, in badge coords (traced ring sits ~ at these bounds)
const BADGE_DEFS = `<clipPath id="badgeInner"><ellipse cx="1040" cy="900" rx="790" ry="780"/></clipPath>`;

// distressed print texture: a mask that knocks small specks out of the ink
const distress = (id) => `<filter id="${id}f" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="1" seed="4" result="big"/><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="fine"/><feComposite in="big" in2="fine" operator="arithmetic" k1="0" k2="0.6" k3="0.7" k4="-0.15"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -14 10.9"/></filter><mask id="${id}" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="6000" height="6000"><rect x="-2000" y="-2000" width="6000" height="6000" filter="url(#${id}f)"/></mask>`;

const arcText = (id, cx, cy, r, text, { size, font, fill, spacing = 0, top = true, weight = 400, offset = "50%" }) => {
  const d = top
    ? `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
    : `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`;
  return `<path id="${id}" d="${d}" fill="none"/><text font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" letter-spacing="${spacing}" text-anchor="middle"><textPath href="#${id}" startOffset="${offset}">${text}</textPath></text>`;
};

const pine = (x, y, h, fill) => {
  // stacked-tier conifer, base centred at x,y
  const w = h * 0.42; const tiers = 5; let d = `M ${x} ${y - h} `;
  const pts = [];
  for (let i = 0; i < tiers; i++) {
    const t = (i + 1) / tiers; const ty = y - h + h * 0.9 * t; const tw = w * (0.35 + 0.65 * t) / 2;
    pts.push([tw, ty, tw * 0.55, ty - h * 0.06]);
  }
  for (const [tw, ty, iw, iy] of pts) d += `L ${x + tw} ${ty} L ${x + iw} ${iy + h * 0.02} `;
  d += `L ${x + w * 0.06} ${y - h * 0.1} L ${x + w * 0.06} ${y} L ${x - w * 0.06} ${y} L ${x - w * 0.06} ${y - h * 0.1} `;
  for (const [tw, ty, iw, iy] of [...pts].reverse()) d += `L ${x - iw} ${iy + h * 0.02} L ${x - tw} ${ty} `;
  // fix order: walk back up the left side
  return `<path fill="${fill}" d="${leftFix(x, y, h, w, pts)}"/>`;
};
function leftFix(x, y, h, w, pts) {
  let d = `M ${x} ${y - h} `;
  for (const [tw, ty, iw, iy] of pts) d += `L ${x + tw} ${ty} L ${x + iw} ${ty - h * 0.035} `;
  d += `L ${x + w * 0.07} ${y} L ${x - w * 0.07} ${y} `;
  for (const [tw, ty, iw] of [...pts].reverse()) d += `L ${x - iw} ${ty - h * 0.035} L ${x - tw} ${ty} `;
  return d + "Z";
}
const pineRow = (x0, x1, y, hMin, hMax, fill, seed = 1) => {
  let s = seed, out = ""; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let x = x0; x < x1; x += hMin * 0.32 + rnd() * hMin * 0.25) out += pine(x, y + rnd() * 6, hMin + rnd() * (hMax - hMin), fill);
  return out;
};

// ---------- the tee ----------
const TEE = "M 400 92 C 435 128, 565 128, 600 92 L 712 120 C 790 145, 850 200, 940 335 L 822 405 L 768 345 L 772 1000 C 610 1014, 390 1014, 228 1000 L 232 345 L 178 405 L 60 335 C 150 200, 210 145, 288 120 Z";
const COLLAR_F = "M 400 92 C 435 128, 565 128, 600 92 L 588 86 C 560 144, 440 144, 412 86 Z";
const COLLAR_B = "M 400 92 C 435 110, 565 110, 600 92 L 588 86 C 560 98, 440 98, 412 86 Z";
function tee(color, print, back = false) {
  const lum = parseInt(color.slice(1, 3), 16) * 0.3 + parseInt(color.slice(3, 5), 16) * 0.59 + parseInt(color.slice(5, 7), 16) * 0.11;
  const dark = lum < 110;
  return `<svg viewBox="30 50 940 1000" xmlns="http://www.w3.org/2000/svg">
<defs>${BADGE_DEFS}
 <clipPath id="teeClip${back ? "B" : "F"}"><path d="${TEE}"/></clipPath>
 <filter id="fabric" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="3"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.10"/></feComponentTransfer></filter>
 <radialGradient id="shade" cx="50%" cy="38%" r="70%"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${dark ? 0.35 : 0.22}"/></radialGradient>
 <linearGradient id="fold" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.5" stop-color="#000" stop-opacity="0.07"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
 <filter id="soft"><feGaussianBlur stdDeviation="14"/></filter>
 <filter id="inkTex" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.5 0.75"/><feComposite in2="SourceGraphic" operator="in"/></filter>
</defs>
<ellipse cx="500" cy="1016" rx="360" ry="14" fill="#000" opacity="0.22" filter="url(#soft)"/>
<path d="${TEE}" fill="${color}"/>
<g clip-path="url(#teeClip${back ? "B" : "F"})">
 <path d="M 300 118 C 330 300, 300 700, 330 1070" stroke="#000" stroke-opacity="0.06" stroke-width="40" fill="none" filter="url(#soft)"/>
 <path d="M 700 118 C 690 400, 720 700, 680 1070" stroke="#000" stroke-opacity="0.06" stroke-width="40" fill="none" filter="url(#soft)"/>
 <path d="M 232 345 C 210 370, 195 390, 178 405" stroke="#000" stroke-opacity="0.12" stroke-width="18" fill="none" filter="url(#soft)"/>
 <path d="M 768 345 C 790 370, 805 390, 822 405" stroke="#000" stroke-opacity="0.12" stroke-width="18" fill="none" filter="url(#soft)"/>
 <g style="mix-blend-mode:${dark ? "normal" : "multiply"}" opacity="0.97">${print}</g>
 <rect x="0" y="0" width="1000" height="1100" fill="url(#shade)"/>
 <path d="M 240 930 C 400 960, 600 960, 760 935" stroke="#000" stroke-opacity="0.08" stroke-width="10" fill="none" filter="url(#soft)"/>
 <path d="M 640 600 C 660 700, 650 820, 680 900" stroke="#fff" stroke-opacity="${dark ? 0.05 : 0.18}" stroke-width="30" fill="none" filter="url(#soft)"/>
 <path d="M 360 520 C 340 640, 360 760, 340 880" stroke="#000" stroke-opacity="0.07" stroke-width="30" fill="none" filter="url(#soft)"/>
 <rect x="0" y="0" width="1000" height="1100" filter="url(#fabric)"/>
</g>
<path d="${back ? COLLAR_B : COLLAR_F}" fill="${color}" stroke="#000" stroke-opacity="0.18" stroke-width="2"/>
${back ? "" : `<path d="M 400 92 C 435 128, 565 128, 600 92" stroke="#000" stroke-opacity="0.25" stroke-width="3" fill="none"/>`}
<path d="M 178 405 L 232 345 M 822 405 L 768 345" stroke="#000" stroke-opacity="0.12" stroke-width="2" fill="none"/>
<path d="M 190 390 L 72 322 M 810 390 L 928 322" stroke="#000" stroke-opacity="0.1" stroke-width="2" fill="none"/>
<path d="M 229 986 C 400 1000, 600 1000, 771 986" stroke="#000" stroke-opacity="0.12" stroke-width="2" fill="none"/>
</svg>`;
}

// place a print (drawn in its own coords) on the tee: x,y = top-left in tee coords, w = width
const place = (x, y, w, vb, inner) => `<svg x="${x}" y="${y}" width="${w}" height="${(w * vb[1]) / vb[0]}" viewBox="0 0 ${vb[0]} ${vb[1]}" overflow="visible">${inner}</svg>`;
// placements (US print norms scaled to this tee: chest 3.5–4in, full front/back 11–12in)
const LEFT_CHEST = (vb, inner, w = 120) => place(560, 215, w, vb, inner);
const FULL = (vb, inner, w = 360, y = 230) => place(500 - w / 2, y, w, vb, inner);
const BACK_YOKE = (vb, inner, w = 300, y = 175) => place(500 - w / 2, y, w, vb, inner);

// ---------- the ten designs ----------
const F = { slab: "Alfa Slab One", bebas: "Bebas Neue", script: "Yellowtail", western: "Rye", osw: "Oswald", zilla: "Zilla Slab", jos: "Josefin Sans", fraunces: "Fraunces", shoulders: "Big Shoulders Display", barlow: "Barlow Condensed", kaushan: "Kaushan Script", dmserif: "DM Serif Display" };

const designs = [];

// 1 — The badge, one ink (giveaway)
designs.push((() => {
  const ink = INK.forest;
  const art = (c) => `${badgeSvg(0, 0, 1000, c)}
   <text x="500" y="985" text-anchor="middle" font-family="${F.slab}" font-size="128" letter-spacing="10" fill="${c}">CAMPHAWK</text>
   <text x="500" y="1060" text-anchor="middle" font-family="${F.osw}" font-weight="500" font-size="44" letter-spacing="15" fill="${c}">WE WAIT FOR IT</text>`;
  const vb = [1000, 1075];
  return {
    id: 1, name: "The Badge, one ink", inks: [["Forest", ink]], shirt: ["Sand", SHIRT.sand], colors: 1,
    front: LEFT_CHEST(vb, art(ink)), back: FULL(vb, art(ink), 330, 190), flat: [vb, art(ink)],
    note: "Your real logo, separated to one ink straight from the original art. Small on the chest, big on the back. The safest giveaway: it is the brand, nothing to explain.",
  };
})());

// 2 — Soaring hawk, left chest (giveaway, cheapest: one small print)
designs.push((() => {
  const ink = INK.bone;
  const art = (c) => `${hawkSvg(0, 0, 900, c, "eng")}
   <text x="450" y="800" text-anchor="middle" font-family="${F.slab}" font-size="150" letter-spacing="6" fill="${c}">CampHawk</text>
   <text x="450" y="880" text-anchor="middle" font-family="${F.osw}" font-weight="500" font-size="52" letter-spacing="22" fill="${c}">CAMPHAWK.APP</text>`;
  const vb = [900, 900];
  return {
    id: 2, name: "Soaring Hawk, chest only", inks: [["Bone", ink]], shirt: ["Heather green", SHIRT.heatherGreen], colors: 1,
    front: LEFT_CHEST(vb, art(ink), 130), back: null, flat: [vb, art(ink)],
    note: "Like your green-tee example: one small chest print and nothing on the back, the cheapest shirt to make. The hawk is traced from the logo, engraved-style, so it holds up at 4 inches.",
  };
})());

// 3 — "We wait for it." back print, hawk circling
designs.push((() => {
  const ink = INK.bone;
  const art = (c) => `<defs>${distress("d3", 0.62, 1.1)}</defs><g mask="url(#d3)">
   <circle cx="500" cy="430" r="300" fill="none" stroke="${c}" stroke-width="10" stroke-dasharray="2 26" stroke-linecap="round"/>
   <circle cx="500" cy="430" r="250" fill="none" stroke="${c}" stroke-width="4"/>
   ${pineRow(240, 760, 680, 50, 110, c, 3)}
   ${hawkSvg(255, 200, 500, c, "eng")}
   <rect x="225" y="676" width="550" height="12" fill="${c}"/>
   <text x="500" y="820" text-anchor="middle" font-family="${F.dmserif}" font-size="58" fill="${c}">The campsite you wanted is booked.</text>
   <text x="500" y="980" text-anchor="middle" font-family="${F.bebas}" font-size="190" letter-spacing="8" fill="${c}">WE WAIT FOR IT.</text>
   <text x="500" y="1050" text-anchor="middle" font-family="${F.osw}" font-weight="500" font-size="40" letter-spacing="18" fill="${c}">CAMPHAWK.APP</text></g>`;
  const chest = (c) => `${hawkSvg(0, 0, 600, c, "sil")}<text x="300" y="560" text-anchor="middle" font-family="${F.bebas}" font-size="130" letter-spacing="6" fill="${c}">CAMPHAWK</text>`;
  const vb = [1000, 1060];
  return {
    id: 3, name: "We Wait For It", inks: [["Bone", ink]], shirt: ["Charcoal", SHIRT.charcoal], colors: 1,
    front: LEFT_CHEST([600, 580], chest(ink), 110), back: FULL(vb, art(ink), 380, 180), flat: [vb, art(ink)],
    note: "Your own headline as the joke on the back: \"The campsite you wanted is booked. We wait for it.\" A hawk circling inside a watch ring over the treeline. Light vintage wear in the ink.",
  };
})());

// 4 — Every 15 seconds: the watch dial
designs.push((() => {
  const ink = INK.forest;
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2; const big = i % 15 === 0; const r1 = 420, r2 = big ? 370 : i % 5 === 0 ? 390 : 402;
    return `<line x1="${500 + Math.sin(a) * r1}" y1="${500 - Math.cos(a) * r1}" x2="${500 + Math.sin(a) * r2}" y2="${500 - Math.cos(a) * r2}" stroke-width="${big ? 14 : 6}"/>`;
  }).join("");
  const art = (c) => `<g stroke="${c}" stroke-linecap="butt">${ticks}</g>
   <circle cx="500" cy="500" r="440" fill="none" stroke="${c}" stroke-width="8"/>
   <g fill="${c}">${Array.from({ length: 40 }, (_, i) => { const t0 = (i / 40) * Math.PI / 2, t1 = t0 + (Math.PI / 80) * (1 - i / 44); const r = 345; return `<path d="M ${500 + Math.sin(t0) * 300} ${500 - Math.cos(t0) * 300} L ${500 + Math.sin(t0) * r} ${500 - Math.cos(t0) * r} A ${r} ${r} 0 0 1 ${500 + Math.sin(t1) * r} ${500 - Math.cos(t1) * r} L ${500 + Math.sin(t1) * 300} ${500 - Math.cos(t1) * 300} Z"/>`; }).join("")}</g>
   <line x1="500" y1="500" x2="500" y2="150" stroke="${c}" stroke-width="8" stroke-linecap="round"/>
   <circle cx="500" cy="500" r="300" fill="none" stroke="${c}" stroke-width="4"/>
   ${hawkSvg(230, 300, 540, c, "eng")}
   ${arcText("a4t", 500, 500, 470, "WATCHING EVERY 15 SECONDS", { size: 64, font: F.osw, weight: 700, fill: c, spacing: 10 })}
   ${arcText("a4b", 500, 500, 520, "CAMPHAWK · ROUND THE CLOCK", { size: 64, font: F.osw, weight: 700, fill: c, spacing: 10, top: false })}`;
  const vb = [1000, 1000];
  return {
    id: 4, name: "Every 15 Seconds", inks: [["Forest", ink]], shirt: ["Mustard", SHIRT.mustard], colors: 1,
    front: FULL(vb, art(ink), 300, 230), back: null, flat: [vb, art(ink)],
    note: "The product's real promise as a watch dial: 60 ticks, a radar sweep, the hawk in the middle. It reads as a cool graphic to strangers and as an inside joke to anyone who's used CampHawk.",
  };
})());

// 5 — Hexagon trail badge (3 inks)
designs.push((() => {
  const [a, b, c] = [INK.forest, INK.ochre, INK.bone];
  const hex = (r, cx = 500, cy = 520) => Array.from({ length: 6 }, (_, i) => { const t = Math.PI / 6 + (i * Math.PI) / 3; return `${cx + Math.cos(t) * r},${cy + Math.sin(t) * r * 1.05}`; }).join(" ");
  const rays = Array.from({ length: 22 }, (_, i) => { const t1 = Math.PI + (i / 22) * Math.PI, t2 = t1 + Math.PI / 44; return `<path d="M 500 470 L ${500 + Math.cos(t1) * 600} ${470 + Math.sin(t1) * 600} L ${500 + Math.cos(t2) * 600} ${470 + Math.sin(t2) * 600} Z"/>`; }).join("");
  const art = `<defs><clipPath id="hx5"><polygon points="${hex(400)}"/></clipPath>${distress("d5", 0.6, 1.0)}</defs>
   <g mask="url(#d5)">
   <polygon points="${hex(440)}" fill="${a}"/>
   <polygon points="${hex(420)}" fill="${c}"/>
   <polygon points="${hex(400)}" fill="${a}"/>
   <g clip-path="url(#hx5)">
     <rect x="0" y="0" width="1000" height="1100" fill="${c}"/>
     <g fill="${b}">${rays}</g>
     <circle cx="500" cy="470" r="95" fill="${b}"/><circle cx="500" cy="470" r="80" fill="${c}"/><circle cx="500" cy="470" r="66" fill="${b}"/>
     <svg x="70" y="250" width="860" height="${(860 * BADGE.h) / BADGE.w}" viewBox="250 500 1600 1250" preserveAspectRatio="xMidYMid slice"><path fill="${b}" fill-rule="evenodd" d="${P.badgeMid}" clip-path="url(#badgeInner)" opacity="0"/><path fill="${a}" fill-rule="evenodd" d="${P.badgeDark}" clip-path="url(#badgeInner)"/></svg>
   </g>
   ${hawkSvg(140, 70, 470, a, "eng")}
   <rect x="130" y="760" width="740" height="150" rx="8" fill="${a}"/>
   <rect x="142" y="772" width="716" height="126" rx="4" fill="none" stroke="${b}" stroke-width="4"/>
   <text x="500" y="872" text-anchor="middle" font-family="${F.script}" font-size="132" fill="${c}">CampHawk</text>
   <text x="500" y="1075" text-anchor="middle" font-family="${F.osw}" font-weight="700" font-size="44" letter-spacing="16" fill="${a}">BOOKED SOLID? NOT FOR LONG.</text>
   </g>`;
  const chest = `${hawkSvg(0, 0, 600, a, "sil")}`;
  const vb = [1000, 1100];
  return {
    id: 5, name: "Trailhead Hexagon", inks: [["Forest", a], ["Ochre", b], ["Bone", c]], shirt: ["Stone grey", SHIRT.stone], colors: 3,
    front: LEFT_CHEST([600, 460], chest, 110), back: FULL(vb, art, 380, 175), flat: [vb, art],
    note: "Your Tailgate Jam reference, made CampHawk's: a hexagon with sun rays, the logo's own mountains and pines, the hawk breaking out of the frame, a script wordmark on a banner.",
  };
})());

// 6 — Golden hour postcard (3 inks, halftone sky)
designs.push((() => {
  const [a, b, c] = [INK.forest, INK.ochre, INK.rust];
  let dots = "";
  for (let y = 10; y < 560; y += 16) for (let x = (y / 16) % 2 ? 18 : 10; x < 600; x += 16) { const r = Math.max(0, 7.5 * (1 - y / 520)); if (r > 0.8) dots += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}"/>`; }
  const art = `<defs><clipPath id="pc6"><rect x="0" y="0" width="600" height="760" rx="6"/></clipPath>${distress("d6", 0.6, 1.3)}</defs>
   <g clip-path="url(#pc6)" mask="url(#d6)">
     <g fill="${b}">${dots}</g>
     <circle cx="390" cy="300" r="120" fill="${b}"/>
     <path d="M -20 620 L 120 330 L 170 390 L 250 240 L 360 420 L 420 380 L 620 640 Z" fill="${c}"/>
     <path d="M 250 240 L 230 330 L 270 300 L 290 420 L 360 420 Z M 120 330 L 110 420 L 150 380 Z" fill="${a}" opacity="1"/>
     ${pineRow(-20, 640, 700, 110, 260, a, 9)}
     <rect x="0" y="680" width="600" height="100" fill="${a}"/>
     ${hawkSvg(70, 120, 300, a, "sil")}
   </g>
   <rect x="0" y="0" width="600" height="760" rx="6" fill="none" stroke="${a}" stroke-width="10"/>
   <text x="300" y="840" text-anchor="middle" font-family="${F.western}" font-size="70" letter-spacing="4" fill="${a}">CAMPHAWK</text>`;
  const vb = [600, 860];
  return {
    id: 6, name: "Golden Hour Postcard", inks: [["Forest", a], ["Ochre", b], ["Rust", c]], shirt: ["Oatmeal", SHIRT.oatmeal], colors: 3,
    front: place(408, 235, 190, vb, art), back: null, flat: [vb, art],
    note: "Your mountain-and-pines reference: a small upright postcard on the chest. The sky fades with halftone dots, so the gradient costs no extra ink. Golden hour, the look you picked for the app.",
  };
})());

// 7 — Reflection diamond (back), 3 inks
designs.push((() => {
  const [a, b, c] = [INK.forest, INK.sage, INK.bone];
  const art = `<defs><clipPath id="dm7"><polygon points="500,40 940,500 500,960 60,500"/></clipPath><clipPath id="top7"><rect x="0" y="0" width="1000" height="520"/></clipPath>${distress("d7", 0.62, 1.1)}</defs>
   <g mask="url(#d7)">
   <g clip-path="url(#dm7)">
     <g clip-path="url(#top7)">
       <path d="M 60 520 L 260 300 L 330 360 L 470 160 L 560 290 L 620 240 L 940 520 Z" fill="${b}"/>
       <path d="M 470 160 L 440 260 L 480 240 L 470 330 L 560 290 Z M 260 300 L 250 380 L 300 340 Z M 620 240 L 640 330 L 700 300 Z" fill="${c}"/>
       <path d="M 470 160 L 520 380 L 600 520 L 620 520 L 560 290 Z M 620 240 L 760 520 L 800 520 Z" fill="${a}"/>
       ${pineRow(60, 330, 520, 70, 160, a, 5)}${pineRow(680, 950, 520, 60, 150, a, 8)}
     </g>
     <g transform="translate(0 1040) scale(1 -1)" clip-path="url(#top7)" opacity="1">
       <g mask="url(#ripple)">
       <path d="M 60 520 L 260 300 L 330 360 L 470 160 L 560 290 L 620 240 L 940 520 Z" fill="${b}"/>
       ${pineRow(60, 330, 520, 70, 160, a, 5)}${pineRow(680, 950, 520, 60, 150, a, 8)}
       </g>
     </g>
     <defs><mask id="ripple"><rect width="1000" height="1100" fill="#000"/>${Array.from({ length: 26 }, (_, i) => `<rect x="${(i * 137) % 300}" y="${512 - i * 18}" width="${1000 - ((i * 211) % 400)}" height="${10 - i * 0.25}" fill="#fff"/>`).join("")}</mask></defs>
     <rect x="0" y="514" width="1000" height="10" fill="${c}"/>
   </g>
   <polygon points="500,40 940,500 500,960 60,500" fill="none" stroke="${a}" stroke-width="12"/>
   ${hawkSvg(560, 60, 240, a, "sil")}
   </g>
   <text x="500" y="1060" text-anchor="middle" font-family="${F.jos}" font-weight="700" font-size="58" letter-spacing="30" fill="${a}">CAMPHAWK</text>`;
  const chest = `<text x="300" y="120" text-anchor="middle" font-family="${F.jos}" font-weight="700" font-size="110" letter-spacing="20" fill="${a}">CAMPHAWK</text>${hawkSvg(170, 150, 260, a, "sil")}`;
  const vb = [1000, 1080];
  return {
    id: 7, name: "Still Water", inks: [["Forest", a], ["Sage", b], ["Bone", c]], shirt: ["Sage", SHIRT.sage], colors: 3,
    front: LEFT_CHEST([600, 360], chest, 120), back: FULL(vb, art, 330, 200), flat: [vb, art],
    note: "Your grey-tee reference: a quiet diamond on the back, peaks mirrored in a lake that breaks into ripples, one small hawk. Tone on tone, the calmest of the ten.",
  };
})());

// 8 — The full logo in three inks
designs.push((() => {
  const [a, b, c] = [INK.forest, INK.sage, INK.ochre];
  let skyDots = ""; for (let y = 260; y < 900; y += 30) for (let x = ((y / 30) % 2 ? 260 : 275); x < 1820; x += 30) { const r = 15 * Math.min(1, Math.max(0, (y - 260) / 560)) ** 1.2; if (r > 1.5) skyDots += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}"/>`; }
  const sky = `<ellipse cx="1040" cy="760" rx="760" ry="520" fill="${c}" opacity="0.0"/>`;
  const art = `${badgeSvg(0, 0, 1000, a, b, `<g clip-path="url(#badgeInner)" fill="${c}">${skyDots}</g>`)}
   <defs><linearGradient id="sky8" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0.0"/><stop offset="0.55" stop-color="${c}" stop-opacity="0.85"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
   <text x="500" y="985" text-anchor="middle" font-family="${F.slab}" font-size="128" letter-spacing="10" fill="${a}">CAMPHAWK</text>
   <text x="500" y="1060" text-anchor="middle" font-family="${F.osw}" font-weight="500" font-size="44" letter-spacing="15" fill="${a}">WE WAIT FOR IT</text>${sky}`;
  const vb = [1000, 1075];
  return {
    id: 8, name: "The Badge, three inks", inks: [["Forest", a], ["Sage", b], ["Ochre", c]], shirt: ["Cream", SHIRT.cream], colors: 3,
    front: LEFT_CHEST(vb, art), back: FULL(vb, art, 330, 190), flat: [vb, art],
    note: "Concept 1's three-ink sister, made for the two of you: the same logo, separated into forest, sage mountains and an ochre golden-hour sky behind the peaks. Pairs with concept 1, so the giveaway and yours match.",
  };
})());

// 9 — Campsite reservation tag (1 ink)
designs.push((() => {
  const ink = INK.forest;
  const art = (c) => `<defs>${distress("d9", 0.58, 1.2)}</defs><g mask="url(#d9)">
   <path d="M 120 60 L 880 60 L 940 120 L 940 1040 L 60 1040 L 60 120 Z" fill="none" stroke="${c}" stroke-width="14"/>
   <circle cx="500" cy="140" r="34" fill="none" stroke="${c}" stroke-width="10"/>
   <text x="500" y="260" text-anchor="middle" font-family="${F.osw}" font-weight="700" font-size="54" letter-spacing="18" fill="${c}">RESERVED</text>
   <line x1="110" y1="290" x2="890" y2="290" stroke="${c}" stroke-width="6"/>
   <text x="500" y="470" text-anchor="middle" font-family="${F.shoulders}" font-weight="900" font-size="230" fill="${c}">SITE 042</text>
   ${hawkSvg(330, 495, 340, c, "sil")}
   <line x1="110" y1="790" x2="890" y2="790" stroke="${c}" stroke-width="6"/>
   <g font-family="${F.osw}" font-weight="500" font-size="42" letter-spacing="4" fill="${c}">
     <text x="130" y="860">FOUND BY</text><text x="870" y="860" text-anchor="end" font-weight="700">CAMPHAWK</text>
     <text x="130" y="925">STATUS</text><text x="870" y="925" text-anchor="end" font-weight="700">SOMEONE CANCELED</text>
     <text x="130" y="990">NIGHTS</text><text x="870" y="990" text-anchor="end" font-weight="700">ALL OF THEM</text>
   </g></g>`;
  const chest = (c) => `<text x="300" y="150" text-anchor="middle" font-family="${F.shoulders}" font-weight="900" font-size="170" fill="${c}">SITE 042</text><text x="300" y="230" text-anchor="middle" font-family="${F.osw}" font-weight="700" font-size="56" letter-spacing="14" fill="${c}">CAMPHAWK</text>`;
  const vb = [1000, 1100];
  return {
    id: 9, name: "Site Reserved", inks: [["Forest", ink]], shirt: ["White", SHIRT.white], colors: 1,
    front: LEFT_CHEST([600, 250], chest(ink), 130), back: FULL(vb, art(ink), 330, 190), flat: [vb, art(ink)],
    note: "The paper tag clipped to a campsite post, filled in by CampHawk. \"Status: someone canceled.\" Funny to campers, all type, cheap in one ink. Site number is a placeholder: could be your favorite site.",
  };
})());

// 10 — Park-poster arch (navy, 2 inks + shirt)
designs.push((() => {
  const [a, b] = [INK.ochre, INK.bone];
  const art = `<defs>${distress("d10", 0.6, 1.0)}</defs><g mask="url(#d10)">
   ${arcText("a10", 500, 640, 420, "CAMPHAWK", { size: 190, font: F.slab, fill: a, spacing: 12 })}
   ${arcText("a10s", 500, 640, 420, "CAMPHAWK", { size: 190, font: F.slab, fill: "none", spacing: 12 })}
   <path d="M 120 760 L 300 600 L 360 650 L 470 520 L 560 620 L 620 580 L 880 760 Z" fill="${a}"/>
   ${pineRow(110, 890, 790, 60, 150, b, 4)}
   ${hawkSvg(250, 250, 500, b, "eng")}
   <rect x="100" y="788" width="800" height="10" fill="${b}"/>
   <text x="500" y="890" text-anchor="middle" font-family="${F.western}" font-size="62" letter-spacing="6" fill="${b}">BOOKED SOLID?</text>
   <text x="500" y="970" text-anchor="middle" font-family="${F.western}" font-size="62" letter-spacing="6" fill="${a}">NOT FOR LONG.</text></g>`;
  const vb = [1000, 1000];
  return {
    id: 10, name: "Park Poster Arch", inks: [["Ochre", a], ["Bone", b]], shirt: ["Navy", SHIRT.navy], colors: 2,
    front: FULL(vb, art, 340, 220), back: null, flat: [vb, art],
    note: "Vintage national-park poster: arched slab type over the hawk, peaks and pines, \"Booked solid? Not for long.\" Two inks on navy, so the shirt itself is the third color.",
  };
})());

// ---------- render ----------
mkdirSync("out", { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" + (process.env.CHROME_SUFFIX ?? "") }).catch(async () => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 });
for (const d of designs) {
  const [vb, flatInner] = d.flat;
  const lbl = (t) => `<div style="position:absolute;top:28px;left:0;right:0;text-align:center;font:500 20px 'Oswald';letter-spacing:5px;color:#55584f">${t}</div>`;
  const html = `<!doctype html><meta charset="utf-8"><style>${FONTS} html,body{margin:0;background:#ECEAE4} .row{display:flex;gap:0;height:1000px} .row>div{position:relative;flex:1;display:flex;align-items:center;justify-content:center;padding:40px 10px 10px} .row>div>svg{display:block;width:100%} .flat{background:${d.shirt[1]}}</style>
  <div class="row">
   <div>${lbl("FRONT")}${tee(d.shirt[1], d.front)}</div>
   ${d.back ? `<div>${lbl("BACK")}${tee(d.shirt[1], d.back, true)}</div>` : ""}
   <div class="flat"><svg viewBox="-60 -60 ${vb[0] + 120} ${vb[1] + 120}" style="width:86%;height:86%"><defs>${BADGE_DEFS}</defs>${flatInner}</svg></div>
  </div>`;
  // the "front only" panel: show the flat art bigger instead
  writeFileSync(`out/${d.id}.html`, html);
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `out/concept-${String(d.id).padStart(2, "0")}.png` });
  console.log("rendered", d.id, d.name);
}
writeFileSync("out/designs.json", JSON.stringify(designs.map(({ front, back, flat, ...r }) => r), null, 1));
await browser.close();
