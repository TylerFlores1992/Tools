// Builds 10 CampHawk shirt concepts as SVG and renders them onto tee mockups with Chromium.
// Everything is free: traced logo layers (traced-*.svg), OFL fonts (fonts/), hand-written geometry.
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { chromium } from "playwright-core";

export const D = (n) => readFileSync(`traced-${n}.svg`, "utf8").match(/ d="([^"]+)"/)[1];
export const P = { hawkSil: D("hawk-sil"), hawkEng: D("hawk-eng"), badgeDark: D("badge-dark"), badgeMid: D("badge-mid") };
// traced coordinate boxes
export const HAWK = { w: 1290, h: 975 }; // hawk crop ×3
export const BADGE = { w: 2055, h: 1755 }; // badge crop ×3

export const FONTS = readFileSync("fonts.css", "utf8");

// ---------- inks and shirts (named, so nothing is told by colour alone) ----------
export const INK = {
  forest: "#24382A", bone: "#EFE6D2", ochre: "#D39130", rust: "#B4462F", sage: "#8DA48A",
  pine: "#2F5A3E", slate: "#3D4A52", sky: "#B9CBD3", navy: "#1F2C46",
};
export const SHIRT = {
  sand: "#D8CBB0", heatherGreen: "#4C6646", charcoal: "#2C2F2D", mustard: "#C48E2C", stone: "#A7AAA2",
  oatmeal: "#E4DBC9", sage: "#9AA796", cream: "#EEE7D8", white: "#F3F2EE", navy: "#26324C",
};

// ---------- reusable art pieces ----------
export const hawk = (fill, kind = "eng") => `<path fill="${fill}" fill-rule="evenodd" d="${kind === "eng" ? P.hawkEng : P.hawkSil}"/>`;
export const hawkSvg = (x, y, w, fill, kind = "eng", flip = false) => {
  const h = (w * HAWK.h) / HAWK.w;
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${HAWK.w} ${HAWK.h}" overflow="visible">${flip ? `<g transform="translate(${HAWK.w} 0) scale(-1 1)">` : "<g>"}${hawk(fill, kind)}</g></svg>`;
};
export const badgeSvg = (x, y, w, dark, mid, extra = "") => {
  const h = (w * BADGE.h) / BADGE.w;
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${BADGE.w} ${BADGE.h}" overflow="visible">${extra}${mid ? `<path fill="${mid}" fill-rule="evenodd" d="${P.badgeMid}" clip-path="url(#badgeInner)"/>` : ""}<path fill="${dark}" fill-rule="evenodd" d="${P.badgeDark}"/></svg>`;
};
// inner of the logo's shield, in badge coords (traced ring sits ~ at these bounds)
export const BADGE_DEFS = `<clipPath id="badgeInner"><ellipse cx="1040" cy="900" rx="790" ry="780"/></clipPath>`;

// distressed print texture: a mask that knocks small specks out of the ink
export const distress = (id) => `<filter id="${id}f" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="1" seed="4" result="big"/><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="fine"/><feComposite in="big" in2="fine" operator="arithmetic" k1="0" k2="0.6" k3="0.7" k4="-0.15"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -14 10.9"/></filter><mask id="${id}" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="6000" height="6000"><rect x="-2000" y="-2000" width="6000" height="6000" filter="url(#${id}f)"/></mask>`;

export const arcText = (id, cx, cy, r, text, { size, font, fill, spacing = 0, top = true, weight = 400, offset = "50%" }) => {
  const d = top
    ? `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
    : `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`;
  return `<path id="${id}" d="${d}" fill="none"/><text font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" letter-spacing="${spacing}" text-anchor="middle"><textPath href="#${id}" startOffset="${offset}">${text}</textPath></text>`;
};

export const pine = (x, y, h, fill) => {
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
export function leftFix(x, y, h, w, pts) {
  let d = `M ${x} ${y - h} `;
  for (const [tw, ty, iw, iy] of pts) d += `L ${x + tw} ${ty} L ${x + iw} ${ty - h * 0.035} `;
  d += `L ${x + w * 0.07} ${y} L ${x - w * 0.07} ${y} `;
  for (const [tw, ty, iw] of [...pts].reverse()) d += `L ${x - iw} ${ty - h * 0.035} L ${x - tw} ${ty} `;
  return d + "Z";
}
export const pineRow = (x0, x1, y, hMin, hMax, fill, seed = 1) => {
  let s = seed, out = ""; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let x = x0; x < x1; x += hMin * 0.32 + rnd() * hMin * 0.25) out += pine(x, y + rnd() * 6, hMin + rnd() * (hMax - hMin), fill);
  return out;
};

// ---------- the tee ----------
export const TEE = "M 400 92 C 435 128, 565 128, 600 92 L 712 120 C 790 145, 850 200, 940 335 L 822 405 L 768 345 L 772 1000 C 610 1014, 390 1014, 228 1000 L 232 345 L 178 405 L 60 335 C 150 200, 210 145, 288 120 Z";
export const COLLAR_F = "M 400 92 C 435 128, 565 128, 600 92 L 588 86 C 560 144, 440 144, 412 86 Z";
export const COLLAR_B = "M 400 92 C 435 110, 565 110, 600 92 L 588 86 C 560 98, 440 98, 412 86 Z";
export function tee(color, print, back = false) {
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
export const place = (x, y, w, vb, inner) => `<svg x="${x}" y="${y}" width="${w}" height="${(w * vb[1]) / vb[0]}" viewBox="0 0 ${vb[0]} ${vb[1]}" overflow="visible">${inner}</svg>`;
// placements (US print norms scaled to this tee: chest 3.5–4in, full front/back 11–12in)
export const LEFT_CHEST = (vb, inner, w = 120) => place(560, 215, w, vb, inner);
export const FULL = (vb, inner, w = 360, y = 230) => place(500 - w / 2, y, w, vb, inner);
export const BACK_YOKE = (vb, inner, w = 300, y = 175) => place(500 - w / 2, y, w, vb, inner);

