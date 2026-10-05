// Background artwork for the CampHawk "looks" mockups, drawn in code from CampHawk's own
// palette (campsite-finder globals.css). Seeded, so every render is identical.
//   window.draw(name, canvas) — name: topo | ridgeline | engraving | poster | dusk | grain
// Rendered to webp by render.mjs. No stock imagery, nothing to license.

const C = {
  paper: "#F5F7F2", card: "#FFFFFF", line: "#DDE3D8", shell: "#E7EBE3",
  ink: "#16291F", ink2: "#3A5344", muted: "#657569", faint: "#A9B5AA",
  green: "#1E7A4C", greenDeep: "#16603B", greenSoft: "#E4F1E8", greenLine: "#BFDDC9",
  ochre: "#D9932B", ochreSoft: "#FBF0DC", ochreInk: "#90621A", ochreLine: "#E7C98C",
  blue: "#2C4A8A", blueSoft: "#EEF2FA", blueLine: "#C6D3EC", forest: "#24382A",
};

// ---------- seeded randomness and Perlin noise ----------
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function perlin(seed) {
  const r = rng(seed), p = new Uint8Array(512), perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const dot = (h, x, y) => { const g = G[h & 7]; return g[0] * x + g[1] * y; };
  return (x, y) => {
    const X = Math.floor(x), Y = Math.floor(y), xf = x - X, yf = y - Y, xi = X & 255, yi = Y & 255;
    const u = fade(xf), v = fade(yf);
    const aa = p[p[xi] + yi], ab = p[p[xi] + yi + 1], ba = p[p[xi + 1] + yi], bb = p[p[xi + 1] + yi + 1];
    const x1 = dot(aa, xf, yf) + u * (dot(ba, xf - 1, yf) - dot(aa, xf, yf));
    const x2 = dot(ab, xf, yf - 1) + u * (dot(bb, xf - 1, yf - 1) - dot(ab, xf, yf - 1));
    return x1 + v * (x2 - x1); // about -0.7..0.7
  };
}
function fbm(n, x, y, oct = 5, lac = 2, gain = 0.5) {
  let a = 1, f = 1, s = 0, norm = 0;
  for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); norm += a; a *= gain; f *= lac; }
  return s / norm;
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`; };
const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };

/** Fine paper grain over the whole canvas (±amp per channel). */
function grain(ctx, W, H, amp, seed = 7) {
  const r = rng(seed), img = ctx.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const g = (r() - 0.5) * amp; d[i] += g; d[i + 1] += g; d[i + 2] += g; }
  ctx.putImageData(img, 0, 0);
}

/** A ridge line: y for every x, from layered noise with sharpened peaks. */
function ridge(n, W, base, amp, scale, sharp = 1.6, oct = 5) {
  const ys = new Float32Array(W + 1);
  for (let x = 0; x <= W; x++) {
    const v = fbm(n, x / scale, 0.37, oct);
    const peaky = 1 - Math.abs(v * 1.6);
    ys[x] = base - amp * Math.pow(Math.max(0, peaky), sharp) - amp * 0.25 * fbm(n, x / (scale * 0.25), 3.1, 3);
  }
  return ys;
}
function fillRidge(ctx, ys, W, H, style) {
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 2) ctx.lineTo(x, ys[x]);
  ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = style; ctx.fill();
}
/** A pine silhouette: a jagged spire with drooping tiers. */
function pine(ctx, x, yBase, h, color, r) {
  const w = h * (0.32 + r() * 0.08), tiers = 5 + Math.floor(r() * 3);
  ctx.beginPath(); ctx.moveTo(x, yBase - h);
  for (let i = 1; i <= tiers; i++) {
    const t = i / tiers, y = yBase - h + h * t * 0.92, half = (w / 2) * t;
    ctx.lineTo(x + half, y); ctx.lineTo(x + half * 0.55, y - h * 0.035);
  }
  ctx.lineTo(x + w * 0.06, yBase); ctx.lineTo(x - w * 0.06, yBase);
  for (let i = tiers; i >= 1; i--) {
    const t = i / tiers, y = yBase - h + h * t * 0.92, half = (w / 2) * t;
    ctx.lineTo(x - half * 0.55, y - h * 0.035); ctx.lineTo(x - half, y);
  }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
/** The hawk, wings spread, as a silhouette. */
function hawk(ctx, x, y, s, color, angle = -0.08) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-6, -3, -14, -9, -26, -12); ctx.lineTo(-38, -10); ctx.lineTo(-30, -7); ctx.lineTo(-36, -4);
  ctx.bezierCurveTo(-24, -3, -12, 0, -4, 4); ctx.lineTo(-3, 10); ctx.lineTo(0, 7); ctx.lineTo(3, 10); ctx.lineTo(4, 4);
  ctx.bezierCurveTo(12, 0, 24, -3, 36, -4); ctx.lineTo(30, -7); ctx.lineTo(38, -10); ctx.lineTo(26, -12);
  ctx.bezierCurveTo(14, -9, 6, -3, 0, 0);
  ctx.fillStyle = color; ctx.fill(); ctx.restore();
}

// ---------- 1. Topo: a trail map with hillshade, lakes and contours ----------
function topo(ctx, W, H) {
  const n = perlin(11), n2 = perlin(23), step = 3, gw = Math.ceil(W / step) + 1, gh = Math.ceil(H / step) + 1;
  const F = new Float32Array(gw * gh), sc = Math.max(W, H) / 2.6;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x = (i * step) / sc, y = (j * step) / sc;
    const wx = x + 0.6 * fbm(n2, x * 0.8, y * 0.8, 3), wy = y + 0.6 * fbm(n2, x * 0.8 + 5.2, y * 0.8 + 1.3, 3);
    F[j * gw + i] = 0.5 + 0.85 * fbm(n, wx, wy, 6);
  }
  const at = (i, j) => F[Math.min(gh - 1, Math.max(0, j)) * gw + Math.min(gw - 1, Math.max(0, i))];
  // Hillshade + elevation tint, then grain.
  const img = ctx.createImageData(W, H), d = img.data, paper = hex(C.paper), soft = hex(C.greenSoft), high = hex(C.shell), lake = hex(C.blueSoft);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = Math.floor(x / step), j = Math.floor(y / step), e = at(i, j);
    const dx = at(i + 1, j) - at(i - 1, j), dy = at(i, j + 1) - at(i, j - 1);
    const shade = Math.max(-1, Math.min(1, (-dx * 0.8 - dy * 0.6) * 28));
    let base;
    if (e < 0.3) base = lake;
    else { const t = Math.min(1, Math.max(0, (e - 0.35) / 0.35)); base = paper.map((v, k) => v + (soft[k] - v) * (1 - Math.abs(t - 0.5) * 2) * 0.55 + (high[k] - v) * Math.max(0, t - 0.7) * 0.8); }
    const k = (y * W + x) * 4, m = e < 0.3 ? 1 : 1 + shade * 0.045;
    d[k] = base[0] * m; d[k + 1] = base[1] * m; d[k + 2] = base[2] * m; d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Contours by marching squares.
  const seg = (L, lw, color) => {
    ctx.beginPath();
    for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), e = at(i, j + 1);
      const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (e > L ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const x0 = i * step, y0 = j * step, lerp = (p, q) => (L - p) / (q - p);
      const T = [x0 + step * lerp(a, b), y0], R = [x0 + step, y0 + step * lerp(b, c)], B = [x0 + step * lerp(e, c), y0 + step], Lf = [x0, y0 + step * lerp(a, e)];
      const pairs = { 1: [Lf, B], 2: [B, R], 3: [Lf, R], 4: [T, R], 5: [Lf, T, B, R], 6: [T, B], 7: [Lf, T], 8: [Lf, T], 9: [T, B], 10: [T, R, Lf, B], 11: [T, R], 12: [Lf, R], 13: [B, R], 14: [Lf, B] }[idx];
      for (let k = 0; k < pairs.length; k += 2) { ctx.moveTo(pairs[k][0], pairs[k][1]); ctx.lineTo(pairs[k + 1][0], pairs[k + 1][1]); }
    }
    ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke();
  };
  seg(0.3, 1.6, rgba(C.blue, 0.35));
  let k = 0;
  for (let L = 0.34; L < 1.05; L += 0.022, k++) seg(L, k % 5 === 0 ? 1.6 : 0.9, rgba(C.greenDeep, k % 5 === 0 ? 0.34 : 0.17));
  // A trail: a smooth curve through placed waypoints, switchbacking up the high ground.
  const portrait = H > W;
  const way = (portrait
    ? [[0.08, 1.02], [0.2, 0.88], [0.42, 0.84], [0.3, 0.76], [0.52, 0.7], [0.4, 0.62], [0.66, 0.56], [0.86, 0.5], [0.78, 0.4], [0.94, 0.33], [1.04, 0.3]]
    : [[-0.02, 0.88], [0.14, 0.84], [0.3, 0.9], [0.46, 0.8], [0.62, 0.84], [0.78, 0.76], [0.8, 0.66], [0.9, 0.6], [0.84, 0.5], [0.92, 0.42], [0.95, 0.3], [1.03, 0.2]]
  ).map(([x, y]) => [x * W, y * H]);
  const pts = [];
  for (let i = 0; i < way.length - 1; i++) {
    const p0 = way[Math.max(0, i - 1)], p1 = way[i], p2 = way[i + 1], p3 = way[Math.min(way.length - 1, i + 2)];
    for (let t = 0; t < 1; t += 0.02) {
      const t2 = t * t, t3 = t2 * t, cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  path(); ctx.lineWidth = 7; ctx.strokeStyle = rgba(C.card, 0.75); ctx.stroke();
  path(); ctx.setLineDash([10, 7]); ctx.lineWidth = 2.6; ctx.strokeStyle = rgba(C.ochreInk, 0.9); ctx.stroke(); ctx.restore();
  // Campsites along the trail: small tents with a ring.
  for (const f of [0.18, 0.5, 0.8]) {
    const [x, y] = pts[Math.floor(pts.length * f)];
    ctx.fillStyle = C.card; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(C.forest, 0.7); ctx.stroke();
    ctx.fillStyle = C.forest; ctx.beginPath(); ctx.moveTo(x, y - 5.5); ctx.lineTo(x + 6, y + 4.5); ctx.lineTo(x - 6, y + 4.5); ctx.closePath(); ctx.fill();
  }
  // Survey details: a compass rose and a scale bar, bottom right.
  const cx = W - 120, cy = H - 150;
  ctx.strokeStyle = rgba(C.ink2, 0.5); ctx.fillStyle = rgba(C.ink2, 0.5); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - 52); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx, cy + 52); ctx.lineTo(cx - 7, cy); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - 52); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx - 7, cy); ctx.closePath(); ctx.fill();
  ctx.font = "600 14px Georgia, serif"; ctx.textAlign = "center"; ctx.fillText("N", cx, cy - 60);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = rgba(C.ink2, i % 2 ? 0.15 : 0.5); ctx.fillRect(cx - 80 + i * 40, cy + 80, 40, 6); }
  ctx.strokeRect(cx - 80, cy + 80, 160, 6);
  grain(ctx, W, H, 7);
}

// ---------- 2. Ridgeline: layered ranges receding into haze ----------
function ridgeline(ctx, W, H, opts = {}) {
  const portrait = H > W, n = perlin(41), r = rng(9);
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  sky.addColorStop(0, C.paper); sky.addColorStop(0.55, mix(C.paper, C.ochreSoft, 0.6)); sky.addColorStop(1, C.ochreSoft);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // Sun, low and soft.
  const sx = W * (portrait ? 0.7 : 0.74), sy = H * (portrait ? 0.46 : 0.47), sr = Math.min(W, H) * 0.075;
  const halo = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 4);
  halo.addColorStop(0, rgba(C.ochre, 0.22)); halo.addColorStop(1, rgba(C.ochre, 0));
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = mix(C.ochreSoft, C.ochre, 0.45); ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  // Birds and the hawk.
  hawk(ctx, W * (portrait ? 0.32 : 0.58), H * (portrait ? 0.3 : 0.24), portrait ? 1.6 : 1.9, rgba(C.forest, 0.78));
  for (const [bx, by, s] of [[0.66, 0.31, 0.5], [0.7, 0.28, 0.4]]) hawk(ctx, W * bx, H * by, s, rgba(C.forest, 0.45), 0.05);
  const layers = 6, colors = [mix(C.line, C.paper, 0.35), C.line, mix(C.greenLine, C.faint, 0.4), mix(C.muted, C.ink2, 0.3), C.ink2, C.forest];
  for (let L = 0; L < layers; L++) {
    const t = L / (layers - 1);
    const base = H * ((portrait ? 0.56 : 0.6) + t * (portrait ? 0.3 : 0.32)), amp = H * (0.2 - t * 0.09), scale = W * (0.55 - t * 0.28);
    const ys = ridge(perlin(100 + L), W, base, amp, scale, 1.5 + t * 0.5);
    fillRidge(ctx, ys, W, H, colors[L]);
    if (L >= 4) for (let x = -10; x < W + 10; x += 5 + r() * (L === 5 ? 14 : 9)) {
      const h = (L === 5 ? 34 : 18) + r() * (L === 5 ? 70 : 30);
      pine(ctx, x, ys[Math.max(0, Math.min(W, Math.round(x)))] + 6, h * (portrait ? 0.8 : 1), colors[L], r);
    }
    if (L < layers - 1) {
      const mist = ctx.createLinearGradient(0, base - amp * 0.3, 0, base + H * 0.05);
      mist.addColorStop(0, rgba(C.paper, 0)); mist.addColorStop(1, rgba(C.paper, 0.55 - t * 0.35));
      ctx.fillStyle = mist; ctx.fillRect(0, base - amp, W, amp + H * 0.08);
    }
  }
  grain(ctx, W, H, 6);
}

// ---------- 3. Engraving: a field guide plate in fine linework ----------
function engraving(ctx, W, H) {
  const portrait = H > W, r = rng(31), ink = C.ink2;
  ctx.fillStyle = mix(C.paper, C.ochreSoft, 0.35); ctx.fillRect(0, 0, W, H);
  // Engraved sky: fine horizontal rules, thinning upward.
  for (let y = 0; y < H * 0.62; y += 4) {
    ctx.strokeStyle = rgba(ink, 0.05 + 0.1 * (y / (H * 0.62)));
    ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // Sun: concentric rings with short rays.
  const sx = W * (portrait ? 0.72 : 0.76), sy = H * 0.36, sr = Math.min(W, H) * 0.06;
  ctx.fillStyle = mix(C.paper, C.ochreSoft, 0.35); ctx.beginPath(); ctx.arc(sx, sy, sr * 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(ink, 0.55);
  for (let k = 0; k < 6; k++) { ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(sx, sy, sr * (0.35 + k * 0.17), 0, Math.PI * 2); ctx.stroke(); }
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 18) { ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * sr * 1.35, sy + Math.sin(a) * sr * 1.35); ctx.lineTo(sx + Math.cos(a) * sr * 1.9, sy + Math.sin(a) * sr * 1.9); ctx.stroke(); }
  // Ranges: occlude, then striations that follow the terrain, heavier on shadowed slopes.
  const layers = 4;
  for (let L = 0; L < layers; L++) {
    const t = L / (layers - 1), base = H * ((portrait ? 0.56 : 0.58) + t * 0.32), amp = H * (0.22 - t * 0.08), scale = W * (0.5 - t * 0.22);
    const ys = ridge(perlin(300 + L), W, base, amp, scale, 1.4 + t * 0.4);
    fillRidge(ctx, ys, W, H, mix(C.paper, C.ochreSoft, 0.35));
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 2) ctx.lineTo(x, ys[x]); ctx.lineTo(W, H); ctx.closePath(); ctx.clip();
    // Smooth the crest so the lines below it relax instead of folding.
    const sm = new Float32Array(W + 1), R = 24;
    for (let x = 0; x <= W; x++) { let acc = 0, c = 0; for (let d = -R; d <= R; d += 4) { const xx = Math.min(W, Math.max(0, x + d)); acc += ys[xx]; c++; } sm[x] = acc / c; }
    const flat = base + H * 0.04, N = 46, sp = (H * 0.5) / N;
    for (let k = 1; k < N; k++) {
      const f = Math.min(1, k / (N * 0.55));
      ctx.beginPath();
      for (let x = 0; x <= W; x += 3) {
        const crest = k < 4 ? ys[x] + (sm[x] - ys[x]) * (k / 4) : sm[x];
        const y = crest + (flat - crest) * f * 0.7 + k * sp * 0.55;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.lineWidth = 0.55 + 0.45 * t; ctx.strokeStyle = rgba(ink, Math.max(0.08, 0.3 + 0.3 * t - k * 0.004)); ctx.stroke();
    }
    // Shadowed faces (light from the left, so slopes falling to the right): short hatching.
    ctx.lineWidth = 0.6; ctx.strokeStyle = rgba(ink, 0.16 + 0.2 * t);
    for (let x = 0; x < W - 6; x += 3) {
      const slope = (ys[x + 6] - ys[x]) / 6;
      if (slope > 0.25) { const len = Math.min(amp * 0.35, 8 + slope * 26); ctx.beginPath(); ctx.moveTo(x, ys[x] + 1.5); ctx.lineTo(x - len * 0.35, ys[x] + len); ctx.stroke(); }
    }
    ctx.restore();
    ctx.lineWidth = 1.2 + t; ctx.strokeStyle = rgba(ink, 0.8); ctx.beginPath(); for (let x = 0; x <= W; x += 2) (x ? ctx.lineTo(x, ys[x]) : ctx.moveTo(x, ys[x])); ctx.stroke();
    if (L === layers - 1) for (let x = 6; x < W; x += 14 + r() * 26) {
      const h = 40 + r() * 70, y0 = ys[Math.round(Math.min(W, x))] + 10;
      ctx.save(); pine(ctx, x, y0, h, mix(C.paper, C.ochreSoft, 0.35), r); ctx.clip();
      ctx.strokeStyle = rgba(ink, 0.75); ctx.lineWidth = 0.8;
      for (let hx = x - h; hx < x + h; hx += 2.4) { ctx.beginPath(); ctx.moveTo(hx, y0 - h); ctx.lineTo(hx + 4, y0); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = rgba(ink, 0.9); ctx.lineWidth = 1; pine(ctx, x, y0, h, "transparent", rng(Math.round(x))); ctx.stroke();
    }
  }
  hawk(ctx, W * (portrait ? 0.3 : 0.6), H * (portrait ? 0.3 : 0.28), portrait ? 1.4 : 1.7, rgba(ink, 0.85));
  grain(ctx, W, H, 9);
}

// ---------- 4. Poster: a national-park poster in flat colour ----------
function poster(ctx, W, H) {
  const portrait = H > W, r = rng(17);
  const bands = [C.paper, mix(C.paper, C.ochreSoft, 0.5), C.ochreSoft, mix(C.ochreSoft, C.ochreLine, 0.45)];
  bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, (H * 0.58 * i) / bands.length, W, H); });
  const sx = W * (portrait ? 0.62 : 0.68), sy = H * 0.46, sr = Math.min(W, H) * (portrait ? 0.2 : 0.16);
  [[1.45, mix(C.ochreSoft, C.ochreLine, 0.6)], [1.2, C.ochreLine], [1, C.ochre]].forEach(([k, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(sx, sy, sr * k, 0, Math.PI * 2); ctx.fill(); });
  const layer = (seed, base, amp, scale, color, sharp) => { const ys = ridge(perlin(seed), W, H * base, H * amp, W * scale, sharp, 3); fillRidge(ctx, ys, W, H, color); return ys; };
  layer(501, 0.62, 0.24, 0.42, C.blueLine, 2.2);
  layer(502, 0.7, 0.16, 0.35, mix(C.blueLine, C.blue, 0.35), 1.8);
  layer(503, 0.78, 0.1, 0.3, C.greenLine, 1.3);
  const near = layer(504, 0.86, 0.08, 0.25, C.greenDeep, 1.1);
  // River: from the horizon to the bottom edge, widening.
  ctx.fillStyle = C.blue; ctx.beginPath();
  const riverX = (t) => W * (0.5 + 0.18 * Math.sin(t * 5.2 + 0.6) * (1 - t * 0.3));
  for (let i = 0; i <= 60; i++) { const t = i / 60, y = H * (0.74 + 0.26 * t); ctx.lineTo(riverX(t) - (2 + t * t * W * 0.12), y); }
  for (let i = 60; i >= 0; i--) { const t = i / 60, y = H * (0.74 + 0.26 * t); ctx.lineTo(riverX(t) + (2 + t * t * W * 0.12), y); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.blueSoft; ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) { const t = 0.3 + r() * 0.7, y = H * (0.74 + 0.26 * t), w = 6 + t * 40; ctx.beginPath(); ctx.moveTo(riverX(t) - w / 2, y); ctx.lineTo(riverX(t) + w / 2, y); ctx.stroke(); }
  // Tent and fire on the near bank.
  const tx = W * (portrait ? 0.24 : 0.3), ty = near[Math.round(tx)] + H * 0.05;
  ctx.fillStyle = C.ochre; ctx.beginPath(); ctx.moveTo(tx, ty - 34); ctx.lineTo(tx + 30, ty); ctx.lineTo(tx - 30, ty); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.ochreInk; ctx.beginPath(); ctx.moveTo(tx, ty - 34); ctx.lineTo(tx + 7, ty); ctx.lineTo(tx - 7, ty); ctx.closePath(); ctx.fill();
  // Foreground pines framing the scene.
  for (const side of [0, 1]) for (let i = 0; i < 9; i++) {
    const x = side ? W - r() * W * 0.16 : r() * W * 0.16, h = H * (0.22 + r() * 0.26);
    pine(ctx, x, H + 4, h, i % 2 ? C.forest : mix(C.forest, C.ink, 0.5), r);
  }
  hawk(ctx, sx - sr * 0.3, sy - sr * 0.15, portrait ? 2.2 : 2.6, C.forest);
  // Print texture: sparse speckle.
  for (let i = 0; i < W * H * 0.0009; i++) { ctx.fillStyle = rgba(r() > 0.5 ? C.card : C.ink, 0.12); ctx.fillRect(r() * W, r() * H, 1.4, 1.4); }
  grain(ctx, W, H, 6);
}

// ---------- 5. Dusk: night over the ridges, a fire in camp ----------
function dusk(ctx, W, H) {
  const portrait = H > W, r = rng(77);
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.8);
  sky.addColorStop(0, C.ink); sky.addColorStop(0.5, mix(C.ink, C.forest, 0.35)); sky.addColorStop(0.85, C.forest); sky.addColorStop(1, mix(C.forest, C.ochreInk, 0.35));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // Milky way: a soft diagonal band of dense faint stars.
  const n = perlin(5);
  for (let i = 0; i < W * H * 0.0016; i++) {
    const x = r() * W, y = r() * H * 0.7, band = Math.abs((y - H * 0.55) + (x - W * 0.5) * -0.45) / (H * 0.18);
    const v = Math.exp(-band * band) * (0.6 + 0.4 * n(x / 90, y / 90));
    if (r() < v) { ctx.fillStyle = rgba(C.paper, 0.18 + r() * 0.25); ctx.fillRect(x, y, 1, 1); }
  }
  for (let i = 0; i < W * H * 0.00022; i++) {
    const x = r() * W, y = r() * H * 0.72, s = r() < 0.94 ? 0.6 + r() * 0.9 : 1.6 + r() * 1.2;
    ctx.fillStyle = rgba(C.paper, 0.35 + r() * 0.6); ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
    if (s > 2.1) { ctx.strokeStyle = rgba(C.paper, 0.35); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x - s * 3, y); ctx.lineTo(x + s * 3, y); ctx.moveTo(x, y - s * 3); ctx.lineTo(x, y + s * 3); ctx.stroke(); }
  }
  // Crescent moon.
  const mx = W * (portrait ? 0.78 : 0.8), my = H * (portrait ? 0.3 : 0.16), mr = Math.min(W, H) * 0.035;
  const glow = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 6); glow.addColorStop(0, rgba(C.ochreSoft, 0.12)); glow.addColorStop(1, rgba(C.ochreSoft, 0));
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  const moon = document.createElement("canvas"); moon.width = moon.height = Math.ceil(mr * 2 + 4);
  const m = moon.getContext("2d"), mc = moon.width / 2;
  m.fillStyle = C.ochreSoft; m.beginPath(); m.arc(mc, mc, mr, 0, Math.PI * 2); m.fill();
  m.globalCompositeOperation = "destination-out"; m.beginPath(); m.arc(mc + mr * 0.45, mc - mr * 0.2, mr * 0.92, 0, Math.PI * 2); m.fill();
  ctx.drawImage(moon, mx - mc, my - mc);
  const colors = ["#3a5344", "#2c4436", "#22382b", "#18291f", "#101d15"];
  let front;
  colors.forEach((c, L) => {
    const t = L / (colors.length - 1), base = H * ((portrait ? 0.62 : 0.64) + t * 0.3), amp = H * (0.18 - t * 0.08);
    front = ridge(perlin(700 + L), W, base, amp, W * (0.5 - t * 0.24), 1.5 + t * 0.4);
    fillRidge(ctx, front, W, H, c);
    if (L < colors.length - 1) { const m = ctx.createLinearGradient(0, base - amp * 0.4, 0, base + 30); m.addColorStop(0, rgba(C.paper, 0)); m.addColorStop(1, rgba(C.paper, 0.07)); ctx.fillStyle = m; ctx.fillRect(0, base - amp, W, amp + 40); }
    if (L >= 3) for (let x = -10; x < W + 10; x += 5 + r() * 11) pine(ctx, x, front[Math.max(0, Math.min(W, Math.round(x)))] + 6, (L === 4 ? 40 : 22) + r() * (L === 4 ? 70 : 34), c, r);
  });
  // Campfire and tent on the near slope.
  const fx = W * (portrait ? 0.3 : 0.24), fy = front[Math.round(fx)] + H * 0.04;
  const fire = ctx.createRadialGradient(fx, fy, 2, fx, fy, H * 0.18); fire.addColorStop(0, rgba(C.ochre, 0.55)); fire.addColorStop(0.35, rgba(C.ochre, 0.15)); fire.addColorStop(1, rgba(C.ochre, 0));
  ctx.fillStyle = fire; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.ochreSoft; ctx.beginPath(); ctx.moveTo(fx, fy - 18); ctx.quadraticCurveTo(fx + 8, fy - 4, fx + 5, fy); ctx.lineTo(fx - 5, fy); ctx.quadraticCurveTo(fx - 8, fy - 6, fx, fy - 18); ctx.fill();
  ctx.fillStyle = C.ochre; ctx.beginPath(); ctx.moveTo(fx + 1, fy - 10); ctx.quadraticCurveTo(fx + 5, fy - 2, fx + 3, fy); ctx.lineTo(fx - 3, fy); ctx.quadraticCurveTo(fx - 4, fy - 4, fx + 1, fy - 10); ctx.fill();
  const tx = fx + 60;
  ctx.fillStyle = "#0b150f"; ctx.beginPath(); ctx.moveTo(tx, fy - 40); ctx.lineTo(tx + 38, fy + 2); ctx.lineTo(tx - 38, fy + 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgba(C.ochre, 0.7); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tx - 38, fy + 2); ctx.lineTo(tx, fy - 40); ctx.stroke();
  grain(ctx, W, H, 5);
}

/** A 512px tile of paper grain for page bodies. */
function grainTile(ctx, W, H) {
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  const r = rng(3), img = ctx.getImageData(0, 0, W, H), d = img.data, n = perlin(8);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4, fiber = n((x / W) * 24, (y / H) * 24) * 2;
    const g = (r() - 0.5) * 6 + fiber;
    d[k] += g; d[k + 1] += g; d[k + 2] += g;
  }
  ctx.putImageData(img, 0, 0);
}

window.draw = (name, canvas) => {
  const ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
  ({ topo, ridgeline, engraving, poster, dusk, grain: grainTile })[name](ctx, W, H);
};
