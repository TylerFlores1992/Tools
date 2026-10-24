"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import {
  arcPath, fit, inMarquee, labelOf, panBy, pick, r2, toDrawing, toScreen, translated, unionBounds, zoomAt,
  type BBox, type Pt, type View, type VwObject,
} from "../geometry";
import { formatLength, snap, type Units } from "../units";
import { DEPT_STYLE, datumAxes } from "../show";
import type { Department, Geometry } from "../geometry";

export type Tool = "select" | "measure";

type Gesture =
  | { kind: "none" }
  | { kind: "pan"; last: Pt; start: Pt }
  | { kind: "marquee"; from: Pt; to: Pt; add: boolean }
  | { kind: "drag"; ids: string[]; from: Pt; delta: Pt; moved: boolean };

/**
 * The drawing, live from Vectorworks. Click to select (Shift adds), drag a selection to move it
 * (snapped to `step`), drag empty space to pan, Shift-drag empty space to box-select, wheel or
 * pinch to zoom. Arrow keys nudge the selection by `step` (Shift: ×10). In Measure, click two
 * points; clicks near an object snap to its middle.
 *
 * Selection is shown by shape, not colour alone: a dashed frame with corner squares, and the
 * inspector names what's selected.
 */
export function DrawingCanvas({
  objects, units, selected, onSelect, onMove, tool, step, fitSignal, measure, onMeasure, busy, dimmed, datum,
}: {
  objects: VwObject[];
  units: Units;
  selected: ReadonlySet<string>;
  onSelect: (ids: string[], mode: "replace" | "toggle" | "add") => void;
  onMove: (ids: string[], dx: number, dy: number) => void;
  tool: Tool;
  step: number;
  fitSignal: number;
  measure: Pt[];
  onMeasure: (pts: Pt[]) => void;
  busy: boolean;
  /** Departments drawn faintly (still clickable). Hidden ones are left out by the caller. */
  dimmed?: ReadonlySet<Department>;
  /** The show's datum, drawn as its CL and PL lines. */
  datum?: { origin: Pt; upstage: Pt; cl: string; pl: string } | null;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 520 });
  // The person's own view once they pan, zoom or touch the drawing; until then (and after
  // Fit, which bumps fitSignal) the view fits everything. `sig` ties it to the Fit it follows.
  const [userView, setUserView] = useState<{ view: View; sig: number } | null>(null);
  const [pending, setPending] = useState<Pt | null>(null); // a burst of arrow-key nudges, shown until sent
  const [gesture, setGesture] = useState<Gesture>({ kind: "none" });
  const [hover, setHover] = useState<string | null>(null);
  const pointers = useRef(new Map<number, Pt>());
  const pinch = useRef<{ dist: number } | null>(null);
  const nudge = useRef<{ dx: number; dy: number; timer: ReturnType<typeof setTimeout> | null }>({ dx: 0, dy: 0, timer: null });
  useEffect(() => () => { if (nudge.current.timer) clearTimeout(nudge.current.timer); }, []);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const width = Math.round(e.contentRect.width);
      setSize({ width, height: Math.round(Math.min(Math.max(width * 0.62, 360), 760)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bounds = useMemo(() => unionBounds(objects), [objects]);
  const own = userView && userView.sig === fitSignal ? userView.view : null;
  const v: View = own ? { ...own, width: size.width, height: size.height } : fit(bounds, size.width, size.height);
  const setView = (next: View) => setUserView({ view: next, sig: fitSignal });
  const tol = 8 / v.scale; // 8 px of slack for clicks, at any zoom

  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = wrap.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const dragDelta = gesture.kind === "drag" && gesture.moved ? gesture.delta : null;
  const preview = dragDelta ?? pending;
  const shown = useMemo(() => {
    if (!preview) return objects;
    const ids = new Set(gesture.kind === "drag" ? gesture.ids : selected);
    return objects.map((o) => (ids.has(o.id) ? translated(o, preview[0], preview[1]) : o));
  }, [objects, preview, gesture, selected]);

  function snapPoint(p: Pt): Pt {
    const hit = pick(objects, p, tol);
    if (!hit) return p;
    if (hit.location) return hit.location;
    return [(hit.bbox[0][0] + hit.bbox[1][0]) / 2, (hit.bbox[0][1] + hit.bbox[1][1]) / 2];
  }

  function onPointerDown(e: RPointerEvent<SVGSVGElement>) {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    if (!own) setView(v); // from here on the view is theirs: moving things won't re-fit it
    const s = local(e);
    pointers.current.set(e.pointerId, s);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]) };
      setGesture({ kind: "none" });
      return;
    }
    const p = toDrawing(v, s);
    if (tool === "measure") {
      const q = snapPoint(p);
      onMeasure(measure.length >= 2 ? [q] : [...measure, q]);
      return;
    }
    const hit = pick(objects, p, tol);
    if (!hit) {
      if (e.shiftKey) setGesture({ kind: "marquee", from: p, to: p, add: true });
      else setGesture({ kind: "pan", last: s, start: s });
      return;
    }
    let ids: string[];
    if (e.shiftKey) {
      onSelect([hit.id], "toggle");
      ids = selected.has(hit.id) ? [...selected].filter((i) => i !== hit.id) : [...selected, hit.id];
    } else if (selected.has(hit.id)) {
      ids = [...selected];
    } else {
      onSelect([hit.id], "replace");
      ids = [hit.id];
    }
    if (!busy) setGesture({ kind: "drag", ids, from: p, delta: [0, 0], moved: false });
  }

  function onPointerMove(e: RPointerEvent<SVGSVGElement>) {
    const s = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, s);
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      setView(zoomAt(v, mid, dist / (pinch.current.dist || dist)));
      pinch.current.dist = dist;
      return;
    }
    const p = toDrawing(v, s);
    if (gesture.kind === "pan") {
      setView(panBy(v, s[0] - gesture.last[0], s[1] - gesture.last[1]));
      setGesture({ ...gesture, last: s });
    } else if (gesture.kind === "marquee") {
      setGesture({ ...gesture, to: p });
    } else if (gesture.kind === "drag") {
      const raw: Pt = [p[0] - gesture.from[0], p[1] - gesture.from[1]];
      const moved = gesture.moved || Math.hypot(raw[0], raw[1]) * v.scale > 4;
      setGesture({ ...gesture, moved, delta: [snap(raw[0], step), snap(raw[1], step)] });
    } else if (gesture.kind === "none" && e.pointerType === "mouse") {
      setHover(pick(objects, p, tol)?.id ?? null);
    }
  }

  function onPointerUp(e: RPointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (gesture.kind === "drag" && gesture.moved && (gesture.delta[0] || gesture.delta[1])) {
      onMove(gesture.ids, gesture.delta[0], gesture.delta[1]);
    } else if (gesture.kind === "pan" && tool === "select") {
      // A click (not a drag) on empty space clears the selection.
      const [ux, uy] = local(e);
      const moved = Math.hypot(ux - gesture.start[0], uy - gesture.start[1]) > 3 || pointers.current.size > 0;
      if (!moved) onSelect([], "replace");
    } else if (gesture.kind === "marquee") {
      const ids = inMarquee(objects, gesture.from, gesture.to).map((o) => o.id);
      onSelect(ids, gesture.add ? "add" : "replace");
    }
    setGesture({ kind: "none" });
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const s = local(e);
    setView(zoomAt(v, s, Math.exp(-e.deltaY * 0.0015)));
  }
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  function onKeyDown(e: React.KeyboardEvent) {
    const dir: Record<string, Pt> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    if (dir[e.key] && selected.size && !busy) {
      e.preventDefault();
      const k = (e.shiftKey ? 10 : 1) * step;
      const n = nudge.current;
      n.dx += dir[e.key][0] * k;
      n.dy += dir[e.key][1] * k;
      setPending([n.dx, n.dy]);
      if (n.timer) clearTimeout(n.timer);
      if (!own) setView(v);
      // A burst of presses goes to Vectorworks as one move, once the keys rest.
      n.timer = setTimeout(() => {
        onMove([...selected], n.dx, n.dy);
        n.dx = n.dy = 0;
        n.timer = null;
        setPending(null);
      }, 450);
    } else if (e.key === "Escape") {
      onSelect([], "replace");
      onMeasure([]);
    } else if (e.key === "f" || e.key === "F") {
      setUserView(null);
    } else if (e.key === "+" || e.key === "=") {
      setView(zoomAt(v, [size.width / 2, size.height / 2], 1.25));
    } else if (e.key === "-") {
      setView(zoomAt(v, [size.width / 2, size.height / 2], 0.8));
    }
  }

  const S = (p: Pt) => toScreen(v, p).map(r2) as Pt;
  const selBoxes = shown.filter((o) => selected.has(o.id)).map((o) => o.bbox);
  const cursor = tool === "measure" ? "crosshair" : gesture.kind === "pan" ? "grabbing" : gesture.kind === "drag" ? "move" : hover ? "pointer" : "grab";

  return (
    <div ref={wrap} className="relative w-full min-w-0 overflow-hidden bg-surface">
      <svg
        ref={svgRef}
        role="application"
        aria-label={`Drawing: ${objects.length} objects. ${selected.size} selected. Arrow keys move the selection; F fits the view; plus and minus zoom.`}
        tabIndex={0}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="block w-full touch-none select-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ember"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
      >
        <Grid v={v} units={units} />
        {datum && <Datum v={v} {...datum} />}
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          {shown.map((o) => (
            <Shape key={o.id} o={o} S={S} v={v} state={selected.has(o.id) ? "selected" : hover === o.id ? "hover" : "idle"} dim={!!(o.dept && dimmed?.has(o.dept))} />
          ))}
        </g>
        {selBoxes.map((b, i) => <SelectionFrame key={i} b={b} S={S} />)}
        {gesture.kind === "marquee" && <Marquee a={S(gesture.from)} b={S(gesture.to)} />}
        {measure.length > 0 && <Measure pts={measure} S={S} units={units} />}
        {dragDelta && (
          <Badge at={[12, size.height - 14]} text={`Move ${formatLength(dragDelta[0], units)} across, ${formatLength(dragDelta[1], units)} up`} />
        )}
        {pending && <Badge at={[12, size.height - 14]} text={`Nudge ${formatLength(pending[0], units)} across, ${formatLength(pending[1], units)} up`} />}
      </svg>
    </div>
  );
}

function Shape({ o, S, v, state, dim = false, geometry }: { o: VwObject; S: (p: Pt) => Pt; v: View; state: "idle" | "hover" | "selected"; dim?: boolean; geometry?: Geometry }) {
  const g = geometry ?? o.geometry;
  // Department decides the line pattern (never colour alone); a selected or hovered object is
  // drawn solid and heavier so it reads as picked whatever its department.
  const style = DEPT_STYLE[o.dept ?? "other"];
  const cls = state !== "idle" ? "text-ink" : dim ? "text-line-2" : o.source && o.source !== "native" ? "text-muted" : "text-ink-2";
  const sw = state === "selected" ? 2.6 : state === "hover" ? 2 : style.width;
  const common = { className: cls, strokeWidth: sw, strokeDasharray: state === "idle" ? style.dash : undefined, vectorEffect: "non-scaling-stroke" as const };
  if (g?.kind === "group") {
    return <g>{g.parts.map((part, i) => <Shape key={i} o={o} S={S} v={v} state={state} dim={dim} geometry={part} />)}</g>;
  }
  if (g?.kind === "wall") {
    // Both faces of the wall, offset half its thickness either side of the centerline.
    const [dx, dy] = [g.end[0] - g.start[0], g.end[1] - g.start[1]];
    const len = Math.hypot(dx, dy) || 1;
    const half = (g.thickness ?? 0) / 2;
    const [nx, ny] = [(-dy / len) * half, (dx / len) * half];
    const faces: [Pt, Pt][] = half > 0
      ? [[[g.start[0] + nx, g.start[1] + ny], [g.end[0] + nx, g.end[1] + ny]], [[g.start[0] - nx, g.start[1] - ny], [g.end[0] - nx, g.end[1] - ny]]]
      : [[g.start, g.end]];
    return <g>{faces.map(([a0, b0], i) => { const [a, b] = [S(a0), S(b0)]; return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...common} />; })}</g>;
  }
  if (g?.kind === "line") {
    const [a, b] = [S(g.start), S(g.end)];
    return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...common} />;
  }
  if (g?.kind === "polygon") {
    const pts = g.points.map((p) => S(p).join(",")).join(" ");
    return g.closed ? <polygon points={pts} {...common} /> : <polyline points={pts} {...common} />;
  }
  if (g?.kind === "oval") {
    const c = S(g.center);
    return <ellipse cx={c[0]} cy={c[1]} rx={r2(g.rx * v.scale)} ry={r2(g.ry * v.scale)} {...common} />;
  }
  if (g?.kind === "arc") return <path d={arcPath(v, g)} {...common} />;
  if (g?.kind === "text") {
    const p = S(g.position);
    return (
      <text x={p[0]} y={p[1]} className={`${cls} font-mono`} fill="currentColor" stroke="none" fontSize={12}>
        {g.text}
      </text>
    );
  }
  // Symbols, fixtures and other plug-in objects: their outline, with a short label.
  const [a, b] = [S([o.bbox[0][0], o.bbox[1][1]]), S([o.bbox[1][0], o.bbox[0][1]])];
  const [w, h] = [Math.max(b[0] - a[0], 2), Math.max(b[1] - a[1], 2)];
  const isFixture = o.plugin === "Lighting Device";
  return (
    <g>
      <rect x={a[0]} y={a[1]} width={w} height={h} rx={isFixture ? Math.min(w, h) / 3 : 0} {...common} />
      {/* Fixture channels sit above the fixture; other names sit under the outline's left end,
          so a pipe's name never lands on the channels of the fixtures hung on it. */}
      {isFixture ? (
        <text x={a[0] + w / 2} y={a[1] - 5} textAnchor="middle" fill="currentColor" stroke="none" fontSize={11} className={`${cls} font-mono`} style={{ paintOrder: "stroke", stroke: "var(--fw-surface)", strokeWidth: 4 }}>
          {o.channel || ""}
        </text>
      ) : w > 40 ? (
        <text x={a[0]} y={a[1] + h + 13} fill="currentColor" stroke="none" fontSize={11} className={`${cls} font-mono`} style={{ paintOrder: "stroke", stroke: "var(--fw-surface)", strokeWidth: 4 }}>
          {labelOf(o).slice(0, 32)}
        </text>
      ) : null}
    </g>
  );
}

function SelectionFrame({ b, S }: { b: BBox; S: (p: Pt) => Pt }) {
  const [a, c] = [S([b[0][0], b[1][1]]), S([b[1][0], b[0][1]])];
  const pad = 5;
  const [x, y, w, h] = [a[0] - pad, a[1] - pad, c[0] - a[0] + 2 * pad, c[1] - a[1] + 2 * pad];
  const corners: Pt[] = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
  return (
    <g className="text-ember" aria-hidden="true" pointerEvents="none">
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="6 4" />
      {corners.map(([cx, cy], i) => <rect key={i} x={cx - 4} y={cy - 4} width={8} height={8} fill="var(--fw-surface)" stroke="currentColor" strokeWidth={1.5} />)}
    </g>
  );
}

function Marquee({ a, b }: { a: Pt; b: Pt }) {
  return (
    <rect
      x={Math.min(a[0], b[0])} y={Math.min(a[1], b[1])} width={Math.abs(b[0] - a[0])} height={Math.abs(b[1] - a[1])}
      fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" className="text-ink-2" pointerEvents="none"
    />
  );
}

function Measure({ pts, S, units }: { pts: Pt[]; S: (p: Pt) => Pt; units: Units }) {
  const [a, b] = [pts[0], pts[1]];
  const sa = S(a);
  if (!b) return <circle cx={sa[0]} cy={sa[1]} r={5} className="text-series-2" fill="none" stroke="currentColor" strokeWidth={2} pointerEvents="none" />;
  const sb = S(b);
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return (
    <g className="text-series-2" pointerEvents="none">
      <line x1={sa[0]} y1={sa[1]} x2={sb[0]} y2={sb[1]} stroke="currentColor" strokeWidth={2} strokeDasharray="7 5" />
      {[sa, sb].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={5} fill="none" stroke="currentColor" strokeWidth={2} />)}
      <Badge at={[(sa[0] + sb[0]) / 2, (sa[1] + sb[1]) / 2 - 10]} text={formatLength(d, units)} anchor="middle" />
    </g>
  );
}

function Badge({ at, text, anchor = "start" }: { at: Pt; text: string; anchor?: "start" | "middle" }) {
  return (
    <text x={at[0]} y={at[1]} textAnchor={anchor} fontSize={13} fontWeight={600} fill="currentColor" className="font-mono tabular-nums text-ink" style={{ paintOrder: "stroke", stroke: "var(--fw-surface)", strokeWidth: 5, strokeLinejoin: "round" }}>
      {text}
    </text>
  );
}

/** A quiet reference grid: 1' (or 1 m) lines, coarser when zoomed out. */
function Grid({ v, units }: { v: View; units: Units }) {
  const base = units.units_per_inch * (Math.abs(units.units_per_inch - 25.4) < 1 || units.units_per_inch < 0.1 ? 1000 / 25.4 : 12);
  let step = base;
  while (step * v.scale < 24) step *= 5;
  while (step * v.scale > 160) step /= 5;
  const [x0, y1] = toDrawing(v, [0, 0]);
  const [x1, y0] = toDrawing(v, [v.width, v.height]);
  const lines: string[] = [];
  for (let x = Math.ceil(x0 / step) * step; x <= x1 && lines.length < 400; x += step) {
    const sx = r2(toScreen(v, [x, 0])[0]);
    lines.push(`M${sx} 0V${v.height}`);
  }
  for (let y = Math.ceil(y0 / step) * step; y <= y1 && lines.length < 800; y += step) {
    const sy = r2(toScreen(v, [0, y])[1]);
    lines.push(`M0 ${sy}H${v.width}`);
  }
  return <path d={lines.join("")} className="text-line" stroke="currentColor" strokeWidth={1} fill="none" aria-hidden="true" pointerEvents="none" />;
}


/** The show's CL and PL (or DSE) as long center-line dashes through the datum, labeled at the view's edge. */
function Datum({ v, origin, upstage, cl, pl }: { v: View; origin: Pt; upstage: Pt; cl: string; pl: string }) {
  const reach = (v.width + v.height) / v.scale;
  const axes = datumAxes(origin, upstage, reach);
  const line = ([a0, b0]: [Pt, Pt], label: string) => {
    const [a, b] = [toScreen(v, a0), toScreen(v, b0)];
    // label where the line leaves the view, nudged inside
    const t = [0.02, 0.98].map((k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k] as Pt);
    const inside = t.map((p) => [Math.min(Math.max(p[0], 14), v.width - 30), Math.min(Math.max(p[1], 14), v.height - 8)] as Pt);
    return (
      <g key={label}>
        <line x1={r2(a[0])} y1={r2(a[1])} x2={r2(b[0])} y2={r2(b[1])} stroke="currentColor" strokeWidth={1} strokeDasharray="14 5 3 5" />
        <text x={r2(inside[1][0])} y={r2(inside[1][1])} fontSize={11} fill="currentColor" stroke="none" className="font-mono" style={{ paintOrder: "stroke", stroke: "var(--fw-surface)", strokeWidth: 4 }}>{label}</text>
      </g>
    );
  };
  const o = toScreen(v, origin);
  return (
    <g className="text-muted" aria-hidden="true" pointerEvents="none">
      {line(axes.cl, cl)}
      {line(axes.pl, pl)}
      <circle cx={r2(o[0])} cy={r2(o[1])} r={4} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </g>
  );
}
