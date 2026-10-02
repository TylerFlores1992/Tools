// Cyber Wolf v2: a denser, symmetric wolf head. Right half authored, mirrored, Delaunay-triangulated,
// clipped to the silhouette, and lit in fake 3D. Renders as: faceted sculpture, constellation, engraving.
(function () {
  // Silhouette, right half, from the crown centre clockwise to the chin centre.
  const OUT = [[0, 72], [22, 76], [48, 78], [94, -6], [138, 96], [132, 128], [168, 150], [143, 166], [172, 198],
    [139, 205], [153, 240], [116, 237], [112, 268], [80, 262], [48, 272], [24, 292], [0, 300]];
  const IN = [[78, 30], [100, 66], [70, 66], [60, 96], [0, 108], [28, 104], [82, 116], [38, 124], [110, 126],
    [90, 130], [64, 139], [38, 152], [66, 153], [50, 174], [86, 172], [0, 150], [16, 182], [0, 198], [22, 212],
    [40, 224], [64, 242], [0, 236], [22, 245], [10, 259], [0, 263], [30, 266], [14, 278], [0, 282],
    [112, 160], [104, 198], [74, 220], [132, 150], [128, 188], [96, 238], [118, 108], [40, 92], [108, 92]];
  const EYE = [[90, 130], [64, 139], [38, 152], [66, 153]];
  const NOSE = [[0, 236], [22, 245], [10, 259], [0, 263]];

  const mirrorPts = (arr) => arr.filter(([x]) => x !== 0).map(([x, y]) => [-x, y]);
  const outline = [...OUT, ...OUT.slice(1, -1).reverse().map(([x, y]) => [-x, y])];
  const points = [...OUT, ...IN, ...mirrorPts(OUT), ...mirrorPts(IN)];
  const eyes = [EYE, EYE.map(([x, y]) => [-x, y])];
  const nose = [...NOSE, ...NOSE.slice(1, -1).reverse().map(([x, y]) => [-x, y])];

  function inPoly(p, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  // Bowyer–Watson Delaunay.
  function delaunay(pts) {
    const big = [[-2000, -2000], [2000, -2000], [0, 2600]];
    const P = [...pts, ...big]; const n = pts.length;
    let tris = [[n, n + 1, n + 2]];
    const circ = (t) => {
      const [a, b, c] = t.map((i) => P[i]);
      const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
      const ux = ((a[0] ** 2 + a[1] ** 2) * (b[1] - c[1]) + (b[0] ** 2 + b[1] ** 2) * (c[1] - a[1]) + (c[0] ** 2 + c[1] ** 2) * (a[1] - b[1])) / d;
      const uy = ((a[0] ** 2 + a[1] ** 2) * (c[0] - b[0]) + (b[0] ** 2 + b[1] ** 2) * (a[0] - c[0]) + (c[0] ** 2 + c[1] ** 2) * (b[0] - a[0])) / d;
      return [ux, uy, (a[0] - ux) ** 2 + (a[1] - uy) ** 2];
    };
    for (let i = 0; i < n; i++) {
      const p = P[i]; const bad = []; const keep = [];
      for (const t of tris) { const [ux, uy, r2] = circ(t); ((p[0] - ux) ** 2 + (p[1] - uy) ** 2 < r2 - 1e-9 ? bad : keep).push(t); }
      const edges = new Map();
      for (const t of bad) for (let k = 0; k < 3; k++) {
        const a = t[k], b = t[(k + 1) % 3], key = a < b ? a + ',' + b : b + ',' + a;
        edges.set(key, edges.has(key) ? null : [a, b]);
      }
      tris = keep;
      for (const e of edges.values()) if (e) tris.push([e[0], e[1], i]);
    }
    return tris.filter((t) => t.every((i) => i < n));
  }
  const cen = (t) => [(points[t[0]][0] + points[t[1]][0] + points[t[2]][0]) / 3, (points[t[0]][1] + points[t[1]][1] + points[t[2]][1]) / 3];
  const tris = delaunay(points).filter((t) => { const c = cen(t); return inPoly(c, outline) && !eyes.some((e) => inPoly(c, e)) && !inPoly(c, nose); });

  // Fake depth so facets light like a sculpted head.
  const g = (v, s) => Math.exp(-((v / s) ** 2));
  function z(x, y) {
    const ax = Math.abs(x);
    let d = 34 * (1 - Math.min(1, (ax / 172) ** 2));
    d += 58 * g(ax, 40) * (1 / (1 + Math.exp(-(y - 170) / 18)));   // muzzle
    d += 22 * g(ax, 70) * g(y - 110, 40);                            // forehead dome
    d += 16 * g(ax - 95, 30) * g(y - 160, 40);                       // cheek bones
    d -= 18 * g(ax - 60, 22) * g(y - 146, 14);                       // eye sockets
    if (y < 90 && ax > 40) d -= 10;                                  // ears sit back
    if (ax > 130) d -= 14;                                           // ruff sweeps back
    return d;
  }
  const P3 = points.map(([x, y]) => [x, y, z(x, y)]);
  function normal(t) {
    const [a, b, c] = t.map((i) => P3[i]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (n[2] < 0) n = n.map((x) => -x);
    const l = Math.hypot(...n); return n.map((x) => x / l);
  }
  const N = tris.map(normal);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const mix = (p, q, s) => {
    const A = parseInt(p.slice(1), 16), B = parseInt(q.slice(1), 16);
    const ch = (n, k) => (n >> k) & 255;
    return '#' + [16, 8, 0].map((k) => Math.round(ch(A, k) + (ch(B, k) - ch(A, k)) * Math.max(0, Math.min(1, s))).toString(16).padStart(2, '0')).join('');
  };
  const pstr = (arr) => arr.map((p) => p.map((v) => +v.toFixed(2)).join(',')).join(' ');
  const VB = 'viewBox="-185 -20 370 335"';
  const open = (size, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" ${VB} width="${size}" height="${(size * 335 / 370).toFixed(0)}" aria-hidden="true" ${extra}>`;
  function edges() {
    const seen = new Map();
    for (const t of tris) for (let k = 0; k < 3; k++) {
      const a = t[k], b = t[(k + 1) % 3], key = a < b ? a + ',' + b : b + ',' + a;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    return [...seen.entries()].map(([k, c]) => [...k.split(',').map(Number), c === 1]);   // [a, b, isBoundary]
  }

  // 1) Faceted sculpture with key light + coloured rim.
  function faceted({ size = 420, dark = '#060A13', light = '#7C93C4', rim = '#FF9A5C', rimAmt = 0.4, key = [-0.55, -0.6, 0.7],
    rimDir = [0.85, -0.15, 0.35], edge = 'rgba(200,220,255,.18)', eye = '#FFB27A', glow = true, id = 'f' } = {}) {
    const K = unit(key), Rm = unit(rimDir);
    let s = open(size) + `<defs><filter id="${id}g" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    tris.forEach((t, i) => {
      const n = N[i]; const d = Math.max(0, dot(n, K)); const r = Math.pow(Math.max(0, dot(n, Rm) - 0.35) / 0.65, 2) * rimAmt;
      const c = mix(mix(dark, light, 0.04 + Math.pow(d, 1.6) * 0.95), rim, r);
      s += `<polygon points="${pstr(t.map((j) => points[j]))}" fill="${c}" stroke="${c}" stroke-width=".6" stroke-linejoin="round"/>`;
    });
    s += `<g stroke="${edge}" stroke-width=".5" fill="none">${tris.map((t) => `<polygon points="${pstr(t.map((j) => points[j]))}"/>`).join('')}</g>`;
    s += `<polygon points="${pstr(nose)}" fill="${dark}"/>`;
    s += `<g fill="${eye}" ${glow ? `filter="url(#${id}g)"` : ''}>${eyes.map((e) => `<polygon points="${pstr(e)}"/>`).join('')}</g>`;
    return s + '</svg>';
  }

  // 2) Constellation: stars of varying magnitude at the vertices, faint lines, brighter outline.
  function constellation({ size = 520, star = '#FFFFFF', line = '#CFE0FF', lineA = 0.11, outlineA = 0.5, eye = '#FFB27A', seed = 3, id = 'c' } = {}) {
    let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    let s = open(size) + `<defs><radialGradient id="${id}s"><stop offset="0" stop-color="${star}"/><stop offset=".25" stop-color="${star}" stop-opacity=".9"/><stop offset="1" stop-color="${star}" stop-opacity="0"/></radialGradient>
      <filter id="${id}g" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    const E = edges();
    s += `<g stroke="${line}" stroke-linecap="round" fill="none">` + E.map(([a, b, bd]) =>
      `<line x1="${points[a][0]}" y1="${points[a][1]}" x2="${points[b][0]}" y2="${points[b][1]}" stroke-opacity="${bd ? outlineA : lineA}" stroke-width="${bd ? 0.8 : 0.5}"/>`).join('') + '</g>';
    // dim "dust" stars along edges add detail without clutter
    s += `<g fill="${star}">` + E.map(([a, b]) => { const k = 0.3 + rnd() * 0.4; const x = points[a][0] + (points[b][0] - points[a][0]) * k, y = points[a][1] + (points[b][1] - points[a][1]) * k; return rnd() < 0.35 ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r=".55" opacity="${(0.25 + rnd() * 0.35).toFixed(2)}"/>` : ''; }).join('') + '</g>';
    const isOut = new Set(); outline.forEach(([x, y]) => points.forEach(([px, py], i) => { if (px === x && py === y) isOut.add(i); }));
    s += points.map(([x, y], i) => {
      const m = isOut.has(i) ? 0.75 + rnd() * 0.5 : 0.35 + rnd() * 0.55; const r = 1 + m * 2.4;
      let st = `<circle cx="${x}" cy="${y}" r="${(r * 1.8).toFixed(2)}" fill="url(#${id}s)" opacity="${(m * 0.32).toFixed(2)}"/><circle cx="${x}" cy="${y}" r="${(r * 0.5).toFixed(2)}" fill="${star}"/>`;
      if (m > 1.17) st += `<path d="M${x - r * 4} ${y}H${x + r * 4}M${x} ${y - r * 4}V${y + r * 4}" stroke="${star}" stroke-width=".35" opacity=".55"/>`;
      return st;
    }).join('');
    s += `<g fill="${eye}" filter="url(#${id}g)" opacity=".95">${eyes.map((e) => `<polygon points="${pstr(e)}"/>`).join('')}</g>`;
    return s + '</svg>';
  }

  // 3) Engraving: each facet hatched with lines that follow its normal; brighter facets get denser lines.
  function engraved({ size = 480, ink = '#DCE4F2', key = [-0.55, -0.6, 0.7], minGap = 1.7, maxGap = 8, width = 0.5, angle = 1.15, eye = '#FFB27A', outlineInk, id = 'e' } = {}) {
    const K = unit(key);
    let s = open(size) + `<defs><filter id="${id}g" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g stroke="${ink}" stroke-width="${width}" stroke-linecap="round">`;
    tris.forEach((t, i) => {
      const n = N[i]; const b = Math.max(0, dot(n, K));
      const gap = maxGap - (maxGap - minGap) * Math.pow(b, 0.8);
      const cx = (points[t[0]][0] + points[t[1]][0] + points[t[2]][0]) / 3; const ang = cx < 0 ? Math.PI - angle : angle; const dx = Math.cos(ang), dy = Math.sin(ang); const nx = -dy, ny = dx;
      const V = t.map((j) => points[j]);
      const proj = V.map(([x, y]) => x * nx + y * ny); const lo = Math.min(...proj), hi = Math.max(...proj);
      for (let c = Math.ceil(lo / gap) * gap; c < hi; c += gap) {
        const hits = [];
        for (let k = 0; k < 3; k++) {
          const p = V[k], q = V[(k + 1) % 3], pp = proj[k], pq = proj[(k + 1) % 3];
          if ((pp - c) * (pq - c) < 0) { const u = (c - pp) / (pq - pp); hits.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]); }
        }
        if (hits.length === 2) s += `<line x1="${hits[0][0].toFixed(1)}" y1="${hits[0][1].toFixed(1)}" x2="${hits[1][0].toFixed(1)}" y2="${hits[1][1].toFixed(1)}"/>`;
      }
    });
    s += '</g>';
    s += `<polygon points="${pstr(outline)}" fill="none" stroke="${outlineInk || ink}" stroke-width=".8" stroke-linejoin="round"/>`;
    s += `<polygon points="${pstr(nose)}" fill="${ink}"/>`;
    s += `<g fill="${eye}" filter="url(#${id}g)">${eyes.map((e) => `<polygon points="${pstr(e)}"/>`).join('')}</g>`;
    return s + '</svg>';
  }
  window.WOLF2 = { points, tris, outline, eyes, nose, faceted, constellation, engraved };
})();
