"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NumberField } from "@/components/NumberField";
import { Segmented } from "@/components/Segmented";
import { State } from "@/components/State";
import { cx } from "@/components/cx";
import { convertInput, levelBeamTension, solveBridle, type BridleInput, type Units } from "./math";

const UNIT = { imperial: { len: "ft", force: "lb" }, metric: { len: "m", force: "kg" } } as const;

const PRESETS: { label: string; units: Units; input: BridleInput }[] = [
  { label: "500 lb, level beams", units: "imperial", input: { span: 21, load: 500, x: 9, drop: 12, rise: 0 } },
  { label: "2,000 lb, off-center", units: "imperial", input: { span: 12, load: 2000, x: 4, drop: 6, rise: 0 } },
  { label: "High/low beams", units: "imperial", input: { span: 10, load: 1000, x: 4, drop: 10, rise: -2 } },
];

const KEYS = ["span", "load", "x", "drop", "rise"] as const;

function fromQuery(q: URLSearchParams): { input: BridleInput; units: Units } | null {
  const vals = KEYS.map((k) => Number(q.get(k)));
  if (!KEYS.every((k) => q.has(k)) || vals.some((v) => !Number.isFinite(v))) return null;
  const [span, load, x, drop, rise] = vals;
  return { input: { span, load, x, drop, rise }, units: q.get("u") === "metric" ? "metric" : "imperial" };
}

const round = (n: number, d = 1) => Number(n.toFixed(d));
const force = (n: number) => (Number.isFinite(n) ? (Math.abs(n) >= 100 ? Math.round(n).toLocaleString("en-US") : n.toFixed(1)) : "–");
const len = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "–");
const angle = (n: number) => (Number.isFinite(n) ? `${Math.round(n)}°` : "–");

export function BridleCalculator() {
  const [units, setUnits] = useState<Units>("imperial");
  const [input, setInput] = useState<BridleInput>(PRESETS[0].input);
  const r = useMemo(() => solveBridle(input), [input]);
  const u = UNIT[units];

  // Deep links: read the rig from the URL once, then keep the URL in step (no history spam).
  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      const q = fromQuery(new URLSearchParams(window.location.search));
      // One-time sync FROM an external system (the URL) after hydration. Reading it during
      // render would make the static HTML disagree with the client.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (q) { setInput(q.input); setUnits(q.units); }
      return;
    }
    const q = new URLSearchParams();
    for (const k of KEYS) q.set(k, String(round(input[k], 3)));
    q.set("u", units);
    window.history.replaceState(null, "", `?${q}`);
  }, [input, units]);

  const set = useCallback((k: keyof BridleInput) => (n: number) => setInput((p) => ({ ...p, [k]: n })), []);
  const switchUnits = (next: Units) => { setInput((p) => convertInput(p, units, next)); setUnits(next); };
  const over = r.valid && Math.max(r.left.tension, r.right.tension) > input.load;
  const level = Math.abs(input.rise) < 1e-9;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-8">
      {/* Phones: wrappers vanish (contents) and `order` gives diagram → results → inputs → math. */}
      <div className="contents lg:sticky lg:top-6 lg:grid lg:gap-8">
      {/* Diagram */}
      <section aria-label="Bridle diagram" className="order-1 rounded-card border border-line bg-surface shadow-card">
        <Diagram input={input} result={r} units={units} onMove={(x, drop) => setInput((p) => ({ ...p, x, drop }))} />
        <p className="border-t border-line px-5 py-3 text-small text-muted sm:px-6">
          Drag the bridle point, or focus it and use the arrow keys (Shift for bigger steps).
        </p>
      </section>

      {/* Worked by hand */}
      <section aria-labelledby="work-h" className="order-4 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <h2 id="work-h" className="text-h3 font-medium">Working it by hand</h2>
        <div className="mt-4 grid gap-3 font-mono text-small leading-relaxed text-ink-2 tabular-nums [overflow-wrap:anywhere]">
          {!r.valid ? (
            <p>Move the bridle point back between and below the beams to see the math.</p>
          ) : level ? (
            <>
              <p className="text-muted">Leg tension = load × leg length × other side’s horizontal ÷ (span × drop)</p>
              <p><span className="text-ice">Left</span> = {round(input.load)} × {len(r.left.length)} × {len(r.right.horizontal)} ÷ ({len(input.span)} × {len(input.drop)}) = <b className="text-ink">{levelBeamTension(input.load, r.left.length, r.right.horizontal, input.span, input.drop).toFixed(1)} {u.force}</b></p>
              <p><span className="text-series-2">Right</span> = {round(input.load)} × {len(r.right.length)} × {len(r.left.horizontal)} ÷ ({len(input.span)} × {len(input.drop)}) = <b className="text-ink">{levelBeamTension(input.load, r.right.length, r.left.horizontal, input.span, input.drop).toFixed(1)} {u.force}</b></p>
              <p className="text-muted">Leg length = √(horizontal² + drop²). Left: √({len(r.left.horizontal)}² + {len(input.drop)}²) = {len(r.left.length)} {u.len}</p>
            </>
          ) : (
            <>
              <p className="text-muted">With the beams at different heights the level-beam formula doesn’t apply. The tensions come from balancing forces: both legs pull sideways equally, and their vertical parts add up to the load.</p>
              <p>Check: {force(r.left.verticalForce)} + {force(r.right.verticalForce)} = <b className="text-ink">{force(r.left.verticalForce + r.right.verticalForce)} {u.force}</b> held up.</p>
            </>
          )}
        </div>
      </section>
      </div>

      <div className="contents lg:grid lg:gap-8">
      {/* Results */}
      <section aria-label="Results" aria-live="polite" className="order-2 grid content-start gap-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <LegCard side="Left" dashed={false} leg={r.left} load={input.load} valid={r.valid} u={u} />
          <LegCard side="Right" dashed leg={r.right} load={input.load} valid={r.valid} u={u} />
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:gap-4">
          <Stat label="Angle between legs" value={angle(r.valid ? r.includedAngle : NaN)} />
          <Stat label="Sideways pull on each beam" value={force(r.horizontalForce)} unit={u.force} />
        </dl>
        <div className="grid gap-2 text-small">
          {!r.valid && <State kind="wrong">{r.problem}</State>}
          {over && (
            <State kind="wrong">
              The {r.left.tension > r.right.tension ? "left" : "right"} leg carries more than the load itself. Lower the bridle point or move it toward the middle.
            </State>
          )}
          {r.valid && !over && r.includedAngle > 90 && (
            <State kind="note">Legs are {Math.round(r.includedAngle)}° apart. Past 120° on level beams, each leg carries more than the load.</State>
          )}
          {r.valid && !over && r.includedAngle <= 90 && <State kind="ok">Both legs carry less than the load.</State>}
        </div>
      </section>

      {/* Inputs */}
      <section aria-labelledby="measure-h" className="order-3 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="measure-h" className="text-h3 font-medium">Measurements</h2>
          <Segmented
            label="Units"
            value={units}
            onChange={switchUnits}
            options={[{ value: "imperial", label: "ft · lb" }, { value: "metric", label: "m · kg" }]}
          />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <NumberField label="Span between beams" unit={u.len} value={input.span} min={0.1} onChange={set("span")} />
          <NumberField label="Load" unit={u.force} value={input.load} min={0} step={10} decimals={0} onChange={set("load")} />
          <NumberField label="Bridle point from left beam" unit={u.len} value={input.x} onChange={set("x")} />
          <NumberField label="Drop below left beam" unit={u.len} value={input.drop} onChange={set("drop")} />
          <div className="sm:col-span-2">
            <NumberField label="Right beam higher by" unit={u.len} value={input.rise} onChange={set("rise")} hint="0 when both beams are the same height. Negative if the right beam is lower." />
          </div>
        </div>
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-small text-muted">Examples</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setInput(convertInput(p.input, p.units, units))}
                className="min-h-10 rounded-full border border-line-2 px-4 text-small text-ink-2 transition-colors duration-150 hover:border-control hover:text-ink"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}

function LegCard({ side, dashed, leg, load, valid, u }: { side: string; dashed: boolean; leg: ReturnType<typeof solveBridle>["left"]; load: number; valid: boolean; u: { len: string; force: string } }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <p className={cx("flex items-center gap-2 text-small font-medium", dashed ? "text-series-2" : "text-ice")}>
        <svg aria-hidden="true" width="22" height="4" viewBox="0 0 22 4"><line x1="0" y1="2" x2="22" y2="2" stroke="currentColor" strokeWidth="3" strokeDasharray={dashed ? "6 3" : undefined} /></svg>
        {side} leg
      </p>
      <p className="mt-2 text-title font-normal tabular-nums leading-none">
        {force(valid ? leg.tension : NaN)}
        <span className="ml-1.5 font-mono text-label uppercase text-muted">{u.force}</span>
      </p>
      <p className="mt-1 text-small text-muted">{valid && load > 0 ? `${Math.round((leg.tension / load) * 100)}% of load` : "–"}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-small tabular-nums">
        <dt className="text-muted">Length</dt><dd className="text-right">{len(leg.length)} {u.len}</dd>
        <dt className="text-muted">Horizontal</dt><dd className="text-right">{len(leg.horizontal)}</dd>
        <dt className="text-muted">Vertical</dt><dd className="text-right">{len(leg.vertical)}</dd>
        <dt className="text-muted">Angle</dt><dd className="text-right">{angle(leg.angle)}</dd>
      </dl>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-card sm:px-5">
      <dt className="text-small text-muted">{label}</dt>
      <dd className="mt-1 text-h2 font-normal tabular-nums">
        {value}
        {unit && value !== "–" && <span className="ml-1.5 font-mono text-label uppercase text-muted">{unit}</span>}
      </dd>
    </div>
  );
}

const VW = 640, VH = 420, ML = 64, MR = 64, MT = 74, MB = 70;

function Diagram({ input, result: r, units, onMove }: { input: BridleInput; result: ReturnType<typeof solveBridle>; units: Units; onMove: (x: number, drop: number) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState(false);
  const u = UNIT[units];
  const { span, x, drop, rise, load } = input;

  // Fit the rig in the frame. The vertical extent is frozen while dragging so the view doesn't swim.
  const liveDepth = Math.max(span * 0.7, (Math.max(0, rise) + drop) * 1.3, Math.abs(rise) + 1);
  const [frozenDepth, setFrozenDepth] = useState(liveDepth);
  const depth = drag ? frozenDepth : liveDepth;
  const safeSpan = span > 0 ? span : 1;
  const k = Math.min((VW - ML - MR) / safeSpan, (VH - MT - MB) / depth);
  const ox = ML + (VW - ML - MR - safeSpan * k) / 2, top = Math.max(0, rise);
  const X = (v: number) => ox + v * k, Y = (v: number) => MT + (top - v) * k;
  const ax = X(0), ay = Y(0), bx = X(span), by = Y(rise), px = X(x), py = Y(-drop);
  const leftStroke = r.valid ? "var(--fw-ice)" : "var(--fw-wrong)";
  const rightStroke = r.valid ? "var(--fw-series-2)" : "var(--fw-wrong)";
  const dimY = Math.min(ay, by) - 34;

  function toWorld(e: React.PointerEvent) {
    const el = svg.current; if (!el) return;
    const pt = el.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(el.getScreenCTM()!.inverse());
    const wx = (p.x - ox) / k, wy = top - (p.y - MT) / k;
    const nx = Math.min(span * 0.98, Math.max(span * 0.02, wx));
    const nd = Math.max(Math.max(0.1, -rise + 0.1), -wy);
    onMove(round(nx, 2), round(nd, 2));
  }
  function onKey(e: React.KeyboardEvent) {
    const s = e.shiftKey ? 1 : 0.1;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] };
    const m = moves[e.key]; if (!m) return;
    e.preventDefault();
    onMove(round(Math.min(span * 0.98, Math.max(span * 0.02, x + m[0])), 2), round(Math.max(Math.max(0.1, -rise + 0.1), drop + m[1]), 2));
  }

  const label = (props: React.SVGProps<SVGTextElement>, text: string) => (
    <text {...props} className="fill-current font-mono" style={{ paintOrder: "stroke", stroke: "var(--fw-surface)", strokeWidth: 5, strokeLinejoin: "round", ...props.style }}>{text}</text>
  );

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${VW} ${VH}`}
      role="img"
      aria-label={`Bridle diagram: span ${len(span)} ${u.len}, bridle point ${len(x)} ${u.len} from the left beam and ${len(drop)} ${u.len} below it.`}
      className="block h-auto w-full touch-none select-none"
      onPointerMove={(e) => drag && toWorld(e)}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
    >
      {/* span label + horizontal dimensions */}
      <g className="text-muted" fontSize="13">{label({ x: (ax + bx) / 2, y: 26, textAnchor: "middle" }, `span ${len(span)} ${u.len}`)}</g>
      <g stroke="var(--fw-line-2)" strokeWidth="1">
        <line x1={ax} y1={dimY} x2={bx} y2={dimY} />
        {[ax, px, bx].map((v, i) => <line key={i} x1={v} y1={dimY - 5} x2={v} y2={dimY + 5} />)}
        <line x1={px} y1={dimY + 5} x2={px} y2={py - 22} strokeDasharray="3 5" />
      </g>
      <g fontSize="14" fontWeight="600">
        <g className="text-ice">{label({ x: (ax + px) / 2, y: dimY - 9, textAnchor: "middle" }, len(x))}</g>
        <g className="text-series-2">{label({ x: (px + bx) / 2, y: dimY - 9, textAnchor: "middle" }, len(span - x))}</g>
      </g>
      {/* drop dimension */}
      <g stroke="var(--fw-line-2)" strokeWidth="1">
        <line x1={ax - 30} y1={ay} x2={ax - 30} y2={py} />
        <line x1={ax - 36} y1={ay} x2={ax - 24} y2={ay} />
        <line x1={ax - 36} y1={py} x2={px - 14} y2={py} strokeDasharray="3 5" />
      </g>
      <g className="text-ink" fontSize="14" fontWeight="600">{label({ x: ax - 38, y: (ay + py) / 2 + 5, textAnchor: "end" }, len(drop))}</g>
      {/* legs: left solid, right dashed — shape and colour both carry the difference */}
      <line x1={ax} y1={ay} x2={px} y2={py} stroke={leftStroke} strokeWidth="4" strokeLinecap="round" strokeDasharray={r.valid ? undefined : "2 8"} />
      <line x1={bx} y1={by} x2={px} y2={py} stroke={rightStroke} strokeWidth="4" strokeLinecap="round" strokeDasharray={r.valid ? "12 7" : "2 8"} />
      <g fontSize="15" fontWeight="700">
        <g className="text-ice">{label({ x: (ax + px) / 2 - 12, y: (ay + py) / 2 + 4, textAnchor: "end" }, `L ${len(r.left.length)}`)}</g>
        <g className="text-series-2">{label({ x: (bx + px) / 2 + 12, y: (by + py) / 2 + 4 }, `R ${len(r.right.length)}`)}</g>
      </g>
      {/* beams */}
      {[[ax, ay], [bx, by]].map(([cx0, cy0], i) => (
        <g key={i} fill="var(--fw-control)">
          <rect x={cx0 - 18} y={cy0 - 13} width="36" height="13" rx="2" />
          <circle cx={cx0} cy={cy0} r="4" />
        </g>
      ))}
      {/* load */}
      <line x1={px} y1={py} x2={px} y2={py + 20} stroke="var(--fw-ink-2)" strokeWidth="2" />
      <rect x={px - 44} y={py + 20} width="88" height="34" rx="6" fill="var(--fw-surface-2)" stroke="var(--fw-ink-2)" strokeWidth="1.5" />
      <text x={px} y={py + 42} textAnchor="middle" fontSize="14" fontWeight="600" className="fill-current text-ink font-mono">{force(load)} {u.force}</text>
      {/* apex handle: draggable and keyboard-operable */}
      <g
        tabIndex={0}
        role="slider"
        aria-label="Bridle point"
        aria-valuemin={0}
        aria-valuemax={span}
        aria-valuenow={round(x, 1)}
        aria-valuetext={`${len(x)} ${u.len} from the left beam, ${len(drop)} ${u.len} below it`}
        onKeyDown={onKey}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setFrozenDepth(liveDepth); setDrag(true); toWorld(e); }}
        className="cursor-grab outline-none active:cursor-grabbing [&:focus-visible>[data-ring]]:opacity-100"
      >
        <circle cx={px} cy={py} r="26" fill="var(--fw-ink)" opacity={drag ? 0.14 : 0.06} />
        <circle data-ring className="opacity-0 transition-opacity" cx={px} cy={py} r="15" fill="none" stroke="var(--fw-ember)" strokeWidth="2.5" />
        <circle cx={px} cy={py} r="7" fill="var(--fw-surface)" stroke="var(--fw-ink)" strokeWidth="2.5" />
      </g>
    </svg>
  );
}
