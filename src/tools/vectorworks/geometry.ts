// The drawing as the connector describes it, and the maths the panel needs to draw it, pick
// things in it and drag them: drawing ↔ screen transforms (drawing y points up, screen y down),
// hit testing, bounds and fitting. No React here; geometry.test.mts covers it.

export type Pt = [number, number];
export type BBox = [Pt, Pt]; // [min, max]

export type Geometry =
  | { kind: "line"; start: Pt; end: Pt }
  | { kind: "polygon"; points: Pt[]; closed: boolean }
  | { kind: "oval"; center: Pt; rx: number; ry: number }
  | { kind: "arc"; center: Pt; radius: number; start_angle: number; sweep_angle: number }
  | { kind: "text"; position: Pt; text: string }
  | { kind: "bbox" };

export type VwObject = {
  id: string;
  type: string;
  name: string;
  layer: string;
  cls: string;
  bbox: BBox;
  width: number;
  height: number;
  geometry?: Geometry;
  length?: number;
  area?: number;
  perimeter?: number;
  symbol?: string;
  plugin?: string;
  location?: Pt;
  channel?: string;
  fields?: Record<string, string>;
};

/** A short, human label for an object: its name, fixture channel, symbol, or type. */
export function labelOf(o: VwObject): string {
  if (o.name) return o.name;
  if (o.channel) return `Channel ${o.channel}`;
  if (o.symbol) return o.symbol;
  if (o.plugin) return o.plugin;
  return o.type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function unionBounds(objects: readonly VwObject[]): BBox | null {
  if (!objects.length) return null;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const o of objects) {
    x0 = Math.min(x0, o.bbox[0][0]);
    y0 = Math.min(y0, o.bbox[0][1]);
    x1 = Math.max(x1, o.bbox[1][0]);
    y1 = Math.max(y1, o.bbox[1][1]);
  }
  return [[x0, y0], [x1, y1]];
}

export const center = (b: BBox): Pt => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];

/** What part of the drawing is on screen: drawing point (cx, cy) sits at the view's middle. */
export type View = { cx: number; cy: number; scale: number; width: number; height: number };

export function toScreen(v: View, p: Pt): Pt {
  return [v.width / 2 + (p[0] - v.cx) * v.scale, v.height / 2 - (p[1] - v.cy) * v.scale];
}

export function toDrawing(v: View, s: Pt): Pt {
  return [v.cx + (s[0] - v.width / 2) / v.scale, v.cy - (s[1] - v.height / 2) / v.scale];
}

/** A view that shows all of `b` with `margin` px to spare. */
export function fit(b: BBox | null, width: number, height: number, margin = 32): View {
  if (!b) return { cx: 0, cy: 0, scale: 1, width, height };
  const w = Math.max(b[1][0] - b[0][0], 1e-6);
  const h = Math.max(b[1][1] - b[0][1], 1e-6);
  const scale = Math.min((width - 2 * margin) / w, (height - 2 * margin) / h);
  const [cx, cy] = center(b);
  return { cx, cy, scale: Number.isFinite(scale) && scale > 0 ? scale : 1, width, height };
}

/** Zoom by `factor` keeping the drawing point under screen point `s` where it is. */
export function zoomAt(v: View, s: Pt, factor: number): View {
  const scale = Math.min(Math.max(v.scale * factor, 1e-4), 1e5);
  const before = toDrawing(v, s);
  const next = { ...v, scale };
  const after = toDrawing(next, s);
  return { ...next, cx: next.cx + (before[0] - after[0]), cy: next.cy + (before[1] - after[1]) };
}

export function panBy(v: View, dxPx: number, dyPx: number): View {
  return { ...v, cx: v.cx - dxPx / v.scale, cy: v.cy + dyPx / v.scale };
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function insidePolygon(p: Pt, pts: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const angleIn = (a: number, start: number, sweep: number) => {
  const norm = (x: number) => ((x % 360) + 360) % 360;
  const rel = sweep >= 0 ? norm(a - start) : norm(start - a);
  return rel <= Math.abs(sweep) + 1e-9;
};

/**
 * How far drawing point p is from the object's visible geometry (0 = on it or inside a filled
 * shape). Shapes count as filled, so a click inside a rectangle picks it.
 */
export function distanceTo(o: VwObject, p: Pt): number {
  const g = o.geometry;
  const box = () => {
    const [[x0, y0], [x1, y1]] = o.bbox;
    const dx = Math.max(x0 - p[0], 0, p[0] - x1);
    const dy = Math.max(y0 - p[1], 0, p[1] - y1);
    return Math.hypot(dx, dy);
  };
  if (!g) return box();
  switch (g.kind) {
    case "line":
      return distToSegment(p, g.start, g.end);
    case "polygon": {
      const pts = g.points;
      if (g.closed && pts.length > 2 && insidePolygon(p, pts)) return 0;
      let d = Infinity;
      const n = g.closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) d = Math.min(d, distToSegment(p, pts[i], pts[(i + 1) % pts.length]));
      return d;
    }
    case "oval": {
      const [dx, dy] = [(p[0] - g.center[0]) / (g.rx || 1e-9), (p[1] - g.center[1]) / (g.ry || 1e-9)];
      const r = Math.hypot(dx, dy);
      return r <= 1 ? 0 : (r - 1) * Math.min(g.rx, g.ry);
    }
    case "arc": {
      const [dx, dy] = [p[0] - g.center[0], p[1] - g.center[1]];
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angleIn(ang, g.start_angle, g.sweep_angle)) return Math.abs(Math.hypot(dx, dy) - g.radius);
      const end = (a: number): Pt => [g.center[0] + g.radius * Math.cos((a * Math.PI) / 180), g.center[1] + g.radius * Math.sin((a * Math.PI) / 180)];
      const [s, e] = [end(g.start_angle), end(g.start_angle + g.sweep_angle)];
      return Math.min(Math.hypot(p[0] - s[0], p[1] - s[1]), Math.hypot(p[0] - e[0], p[1] - e[1]));
    }
    default:
      return box();
  }
}

/**
 * The object under a click: the closest within `tolerance` drawing units, preferring smaller
 * things when several contain the point (a fixture on a truss picks the fixture).
 */
export function pick(objects: readonly VwObject[], p: Pt, tolerance: number): VwObject | null {
  let best: VwObject | null = null;
  let bestKey = Infinity;
  for (const o of objects) {
    const d = distanceTo(o, p);
    if (d > tolerance) continue;
    const size = Math.max(o.width, o.height);
    const key = d === 0 ? size * 1e-6 : d + 1; // inside beats near; smaller wins among insides
    if (key < bestKey) {
      best = o;
      bestKey = key;
    }
  }
  return best;
}

/** Objects whose bounds lie wholly inside the marquee rectangle (drawing units). */
export function inMarquee(objects: readonly VwObject[], a: Pt, b: Pt): VwObject[] {
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  return objects.filter((o) => o.bbox[0][0] >= x0 && o.bbox[1][0] <= x1 && o.bbox[0][1] >= y0 && o.bbox[1][1] <= y1);
}

/** Moves an object's geometry by (dx, dy): the panel's preview while dragging. */
export function translated(o: VwObject, dx: number, dy: number): VwObject {
  const m = (p: Pt): Pt => [p[0] + dx, p[1] + dy];
  const g = o.geometry;
  let geometry: Geometry | undefined = g;
  if (g) {
    switch (g.kind) {
      case "line": geometry = { ...g, start: m(g.start), end: m(g.end) }; break;
      case "polygon": geometry = { ...g, points: g.points.map(m) }; break;
      case "oval": case "arc": geometry = { ...g, center: m(g.center) }; break;
      case "text": geometry = { ...g, position: m(g.position) }; break;
      default: geometry = g;
    }
  }
  return { ...o, bbox: [m(o.bbox[0]), m(o.bbox[1])], location: o.location && m(o.location), geometry };
}

/** Screen coordinates to 2 decimals: plenty for pixels, and keeps SVG strings short. */
export const r2 = (n: number) => Math.round(n * 100) / 100;

/** SVG path data for an arc in screen space (y already flipped by toScreen). */
export function arcPath(v: View, g: Extract<Geometry, { kind: "arc" }>): string {
  const pt = (a: number): Pt => toScreen(v, [g.center[0] + g.radius * Math.cos((a * Math.PI) / 180), g.center[1] + g.radius * Math.sin((a * Math.PI) / 180)]);
  const [s, e] = [pt(g.start_angle), pt(g.start_angle + g.sweep_angle)].map((p) => p.map(r2));
  const r = r2(g.radius * v.scale);
  const large = Math.abs(g.sweep_angle) > 180 ? 1 : 0;
  const sweep = g.sweep_angle > 0 ? 0 : 1; // the y flip reverses the direction
  if (Math.abs(g.sweep_angle) >= 360) {
    const c = toScreen(v, g.center).map(r2);
    return `M ${r2(c[0] - r)} ${c[1]} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;
  }
  return `M ${s[0]} ${s[1]} A ${r} ${r} 0 ${large} ${sweep} ${e[0]} ${e[1]}`;
}
