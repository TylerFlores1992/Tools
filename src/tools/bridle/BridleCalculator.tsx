"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NumberField } from "@/components/NumberField";
import { Segmented } from "@/components/Segmented";
import { State } from "@/components/State";
import { cx } from "@/components/cx";
import { convertInput, levelBeamTension, solveBridle, type BridleInput, type BridleResult, type Units } from "./math";
import { DECIMALS, KEYS, fromQuery, statusFor, toQuery, type Key } from "./view";

const UNIT = { imperial: { len: "ft", force: "lb" }, metric: { len: "m", force: "kg" } } as const;

const PRESETS: { label: string; units: Units; input: BridleInput }[] = [
  { label: "500 lb, level beams", units: "imperial", input: { span: 21, load: 500, x: 9, drop: 12, rise: 0 } },
  { label: "2,000 lb, off-center", units: "imperial", input: { span: 12, load: 2000, x: 4, drop: 6, rise: 0 } },
  { label: "High/low beams", units: "imperial", input: { span: 10, load: 1000, x: 4, drop: 10, rise: -2 } },
];

const NO_ERRORS: Record<Key, boolean> = { span: false, load: false, x: false, drop: false, rise: false };

const round = (n: number, d = 1) => Number(n.toFixed(d));
const force = (n: number) => (Number.isFinite(n) ? (Math.abs(n) >= 100 ? Math.round(n).toLocaleString("en-US") : n.toFixed(1)) : "–");
const len = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "–");
const angle = (n: number) => (Number.isFinite(n) ? `${Math.round(n)}°` : "–");
const degrees = (n: number) => (Number.isFinite(n) ? String(Math.round(n)) : "–");

export function BridleCalculator() {
  const [units, setUnits] = useState<Units>("imperial");
  const [input, setInput] = useState<BridleInput>(PRESETS[0].input);
  // Fields whose draft can't be read. While any is set, the result belongs to an older value.
  const [bad, setBad] = useState(NO_ERRORS);
  // Bumped when a preset or unit switch replaces every value, so fields drop a stale bad draft.
  const [gen, setGen] = useState(0);
  const r = useMemo(() => solveBridle(input), [input]);
  const u = UNIT[units];
  const blocked = KEYS.some((k) => bad[k]);
  const show = r.valid && !blocked;
  const status = statusFor(r, input.load, blocked);

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
    window.history.replaceState(null, "", `?${toQuery(input, units)}`);
  }, [input, units]);

  const set = useCallback((k: Key) => (n: number) => setInput((p) => ({ ...p, [k]: n })), []);
  const flag = useMemo(
    () => Object.fromEntries(KEYS.map((k) => [k, (b: boolean) => setBad((p) => (p[k] === b ? p : { ...p, [k]: b }))])) as Record<Key, (b: boolean) => void>,
    [],
  );
  const replaceAll = (next: BridleInput) => { setInput(next); setBad(NO_ERRORS); setGen((g) => g + 1); };
  const switchUnits = (next: Units) => { replaceAll(convertInput(input, units, next)); setUnits(next); };
  const level = Math.abs(input.rise) < 1e-9;
  const field = (k: Key, label: string, unit: string, extra?: { min?: number; step?: number; hint?: string }) => (
    <NumberField key={`${k}-${gen}`} label={label} unit={unit} value={input[k]} decimals={DECIMALS[k]} onChange={set(k)} onInvalid={flag[k]} {...extra} />
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-8">
      {/* Phones: wrappers vanish (contents) and `order` gives diagram → results → inputs → math. */}
      <div className="contents lg:sticky lg:top-6 lg:grid lg:gap-8">
      {/* Diagram */}
      <section aria-label="Bridle diagram" className="order-1 rounded-card border border-line bg-surface shadow-card">
        <Diagram input={input} result={r} blocked={blocked} units={units} onMove={(x, drop) => setInput((p) => ({ ...p, x, drop }))} />
        <p className="border-t border-line px-5 py-3 text-small text-muted sm:px-6">
          Drag the bridle point, or focus it and use the arrow keys (Shift for bigger steps).
        </p>
      </section>

      {/* Worked by hand */}
      <section aria-labelledby="work-h" className="order-4 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <h2 id="work-h" className="text-h3 font-medium">Working it by hand</h2>
        <div className="mt-4 grid gap-3 font-mono text-small leading-relaxed text-ink-2 tabular-nums [overflow-wrap:anywhere]">
          {blocked ? (
            <p>Fix the highlighted measurement to see the math.</p>
          ) : !r.valid ? (
            <p>Move the bridle point back between and below the beams to see the math.</p>
          ) : level ? (
            <>
              <p className="text-muted">Leg tension = load × leg length × other side’s horizontal ÷ <span className="whitespace-nowrap">(span × drop)</span></p>
              <p><span className="text-ice">Left</span> = {round(input.load)} × {len(r.left.length)} × {len(r.right.horizontal)} <span className="whitespace-nowrap">÷ ({len(input.span)} × {len(input.drop)})</span> = <b className="whitespace-nowrap text-ink">{levelBeamTension(input.load, r.left.length, r.right.horizontal, input.span, input.drop).toFixed(1)} {u.force}</b></p>
              <p><span className="text-series-2">Right</span> = {round(input.load)} × {len(r.right.length)} × {len(r.left.horizontal)} <span className="whitespace-nowrap">÷ ({len(input.span)} × {len(input.drop)})</span> = <b className="whitespace-nowrap text-ink">{levelBeamTension(input.load, r.right.length, r.left.horizontal, input.span, input.drop).toFixed(1)} {u.force}</b></p>
              <p className="text-muted">Leg length = √(horizontal² + drop²)</p>
              <p><span className="text-ice">Left</span> = √({len(r.left.horizontal)}² + {len(r.left.vertical)}²) = {len(r.left.length)} {u.len}</p>
              <p><span className="text-series-2">Right</span> = √({len(r.right.horizontal)}² + {len(r.right.vertical)}²) = {len(r.right.length)} {u.len}</p>
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
      {/* Results. Not a live region: it changes on every drag frame. Only the status line speaks. */}
      <section aria-label="Results" className="order-2 grid content-start gap-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <LegCard side="Left" dashed={false} leg={r.left} load={input.load} valid={show} blank={blocked} u={u} />
          <LegCard side="Right" dashed leg={r.right} load={input.load} valid={show} blank={blocked} u={u} />
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:gap-4">
          <Stat label="Angle between legs" value={angle(show ? r.includedAngle : NaN)} />
          <Stat label="Sideways pull per beam" value={force(show ? r.horizontalForce : NaN)} unit={u.force} />
        </dl>
        <div className="grid gap-2 text-small">
          <div aria-live="polite">
            {status.kind === "note" && status.caution ? (
              <State kind="note" sr={false}><b className="font-medium text-ink">Caution:</b> {status.text}</State>
            ) : (
              <State kind={status.kind}>{status.text}</State>
            )}
          </div>
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
          {field("span", "Span between beams", u.len, { min: 0.1 })}
          {field("load", "Load", u.force, { min: 0, step: 10 })}
          {field("x", "Bridle point from left beam", u.len)}
          {field("drop", "Drop below left beam", u.len)}
          <div className="sm:col-span-2">
            {field("rise", "Right beam higher by", u.len, { hint: "0 when both beams are the same height. Negative if the right beam is lower." })}
          </div>
        </div>
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-small text-muted">Examples</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => replaceAll(convertInput(p.input, p.units, units))}
                className="min-h-11 rounded-full border border-line-2 px-4 text-small text-ink-2 transition-colors duration-150 hover:border-control hover:text-ink"
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

function LegCard({ side, dashed, leg, load, valid, blank, u }: { side: string; dashed: boolean; leg: BridleResult["left"]; load: number; valid: boolean; blank: boolean; u: { len: string; force: string } }) {
  // Geometry rows stay when the rig is impossible (they explain it), but not when a field can't be read.
  const g = (n: number) => (blank ? NaN : n);
  const rows: [string, string, string][] = [
    ["Length", len(g(leg.length)), u.len],
    ["Horizontal", len(g(leg.horizontal)), u.len],
    ["Vertical", len(g(leg.vertical)), u.len],
    ["Angle", degrees(g(leg.angle)), "°"],
  ];
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
      <dl className="mt-3 grid grid-cols-[auto_1fr_2ch] gap-x-2 gap-y-0.5 text-small tabular-nums">
        {rows.map(([name, value, unit]) => (
          <div key={name} className="contents">
            <dt className="text-muted">{name}</dt>
            <dd className="text-right">{value}</dd>
            <dd className="font-mono text-label text-muted">{value === "–" ? "" : unit}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="grid content-between gap-1 rounded-card border border-line bg-surface px-4 py-3 shadow-card sm:px-5">
      <dt className="text-small text-muted">{label}</dt>
      <dd className="text-h2 font-normal tabular-nums">
        {value}
        {unit && value !== "–" && <span className="ml-1.5 font-mono text-label uppercase text-muted">{unit}</span>}
      </dd>
    </div>
  );
}

/** Desktop frame; below PHONE_PX of rendered width a narrower frame keeps text and the handle big enough. */
const VW_WIDE = 640, VW_PHONE = 420, PHONE_PX = 520, VH = 420, MB = 70;
/** On-screen minimums: label text in CSS px, and the drag handle's hit target diameter. */
const MIN_TEXT_PX = 13, MIN_HIT_PX = 44;

function Diagram({ input, result: r, blocked, units, onMove }: { input: BridleInput; result: BridleResult; blocked: boolean; units: Units; onMove: (x: number, drop: number) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState(false);
  const [px0, setPx0] = useState(0); // rendered width in CSS px; 0 until measured
  const u = UNIT[units];
  const { span, x, drop, rise, load } = input;

  useEffect(() => {
    const el = svg.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setPx0(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scale: viewBox units per screen pixel. Fonts never render under MIN_TEXT_PX.
  const phone = px0 > 0 && px0 < PHONE_PX;
  const VW = phone ? VW_PHONE : VW_WIDE;
  const s = px0 > 0 ? VW / px0 : 1;
  const fs = (base: number) => Math.max(base, MIN_TEXT_PX * s);
  const fSpan = fs(13), fSeg = fs(14), fLeg = fs(15), fLoad = fs(14); // floors at MIN_TEXT_PX on screen

  // Header band: span label on top, segment labels under it, then the dimension line; never overlapping.
  const spanY = fSpan + 4, segY = spanY + fSeg + 8, dimY = segY + 9, MT = dimY + 34;
  const ML = phone ? 44 + fSeg * 3 : 64, MR = phone ? 40 : 64;

  // Fit the rig in the frame. The vertical extent is frozen while dragging so the view doesn't swim.
  const liveDepth = Math.max(span * 0.7, (Math.max(0, rise) + drop) * 1.3, Math.abs(rise) + 1);
  const [frozenDepth, setFrozenDepth] = useState(liveDepth);
  const depth = drag ? frozenDepth : liveDepth;
  const safeSpan = span > 0 ? span : 1;
  const k = Math.min((VW - ML - MR) / safeSpan, (VH - MT - MB) / depth);
  const ox = ML + (VW - ML - MR - safeSpan * k) / 2, top = Math.max(0, rise);
  const X = (v: number) => ox + v * k, Y = (v: number) => MT + (top - v) * k;
  const ax = X(0), ay = Y(0), bx = X(span), by = Y(rise), px = X(x), py = Y(-drop);
  const ok = r.valid && !blocked;
  const leftStroke = ok ? "var(--fw-ice)" : "var(--fw-wrong)";
  const rightStroke = ok ? "var(--fw-series-2)" : "var(--fw-wrong)";

  // Load box sized to its text; the frame ends just under it (no dead band). While dragging it may
  // grow but never shrink, so the page under the finger doesn't jump.
  const loadText = blocked ? "–" : `${force(load)} ${u.force}`;
  const boxW = Math.max(88, loadText.length * fLoad * 0.62 + 20), boxH = Math.max(34, fLoad + 20);
  const fit = Math.min(VH, Math.max(MT + 100, py + 20 + boxH + 14));
  const [frozenH, setFrozenH] = useState(fit);
  const vh = drag ? Math.min(VH, Math.max(frozenH, fit)) : fit;
  const hitR = Math.max(26, (MIN_HIT_PX / 2) * s);

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
    const st = e.shiftKey ? 1 : 0.1;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] };
    const m = moves[e.key]; if (!m) return;
    e.preventDefault();
    onMove(round(Math.min(span * 0.98, Math.max(span * 0.02, x + m[0])), 2), round(Math.max(Math.max(0.1, -rise + 0.1), drop + m[1]), 2));
  }

  const label = (props: React.SVGProps<SVGTextElement>, text: string) => (
    <text {...props} className="fill-current font-mono" style={{ paintOrder: "stroke", stroke: "var(--fw-surface)", strokeWidth: 5, strokeLinejoin: "round", ...props.style }}>{text}</text>
  );

  return (
    // role="group", not "img": an img's children are presentational, which would hide the slider.
    <svg
      ref={svg}
      viewBox={`0 0 ${VW} ${vh}`}
      role="group"
      aria-label={`Bridle diagram: span ${len(span)} ${u.len}, bridle point ${len(x)} ${u.len} from the left beam and ${len(drop)} ${u.len} below it.`}
      className="block h-auto w-full touch-none select-none"
      onPointerMove={(e) => drag && toWorld(e)}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
    >
      {/* span label + horizontal dimensions */}
      <g className="text-muted" fontSize={fSpan}>{label({ x: (ax + bx) / 2, y: spanY, textAnchor: "middle" }, `span ${len(span)} ${u.len}`)}</g>
      <g stroke="var(--fw-line-2)" strokeWidth="1">
        <line x1={ax} y1={dimY} x2={bx} y2={dimY} />
        {[ax, px, bx].map((v, i) => <line key={i} x1={v} y1={dimY - 5} x2={v} y2={dimY + 5} />)}
        <line x1={px} y1={dimY + 5} x2={px} y2={py - 22} strokeDasharray="3 5" />
      </g>
      <g fontSize={fSeg} fontWeight="600">
        <g className="text-ice">{label({ x: (ax + px) / 2, y: segY, textAnchor: "middle" }, len(x))}</g>
        <g className="text-series-2">{label({ x: (px + bx) / 2, y: segY, textAnchor: "middle" }, len(span - x))}</g>
      </g>
      {/* drop dimension */}
      <g stroke="var(--fw-line-2)" strokeWidth="1">
        <line x1={ax - 30} y1={ay} x2={ax - 30} y2={py} />
        <line x1={ax - 36} y1={ay} x2={ax - 24} y2={ay} />
        <line x1={ax - 36} y1={py} x2={px - 14} y2={py} strokeDasharray="3 5" />
      </g>
      <g className="text-ink" fontSize={fSeg} fontWeight="600">{label({ x: ax - 38, y: (ay + py) / 2 + 5, textAnchor: "end" }, len(drop))}</g>
      {/* legs: left solid, right dashed — shape and colour both carry the difference */}
      <line x1={ax} y1={ay} x2={px} y2={py} stroke={leftStroke} strokeWidth="4" strokeLinecap="round" strokeDasharray={ok ? undefined : "2 8"} />
      <line x1={bx} y1={by} x2={px} y2={py} stroke={rightStroke} strokeWidth="4" strokeLinecap="round" strokeDasharray={ok ? "12 7" : "2 8"} />
      <g fontSize={fLeg} fontWeight="700">
        <g className="text-ice">{label({ x: (ax + px) / 2 - 12, y: (ay + py) / 2 + 4, textAnchor: "end" }, `L ${blocked ? "–" : len(r.left.length)}`)}</g>
        <g className="text-series-2">{label({ x: (bx + px) / 2 + 12, y: (by + py) / 2 + 4 }, `R ${blocked ? "–" : len(r.right.length)}`)}</g>
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
      <rect x={px - boxW / 2} y={py + 20} width={boxW} height={boxH} rx="6" fill="var(--fw-surface-2)" stroke="var(--fw-ink-2)" strokeWidth="1.5" />
      <text x={px} y={py + 20 + boxH / 2 + fLoad * 0.36} textAnchor="middle" fontSize={fLoad} fontWeight="600" className="fill-current text-ink font-mono">{loadText}</text>
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
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setFrozenDepth(liveDepth); setFrozenH(fit); setDrag(true); toWorld(e); }}
        className="cursor-grab outline-none active:cursor-grabbing [&:focus-visible>[data-ring]]:opacity-100"
      >
        {/* invisible hit area: at least MIN_HIT_PX across on screen, whatever the diagram's width */}
        <circle cx={px} cy={py} r={hitR} fill="transparent" />
        <circle cx={px} cy={py} r="26" fill="var(--fw-ink)" opacity={drag ? 0.14 : 0.06} />
        <circle data-ring className="opacity-0 transition-opacity motion-reduce:transition-none" cx={px} cy={py} r="15" fill="none" stroke="var(--fw-ember)" strokeWidth="2.5" />
        <circle cx={px} cy={py} r="7" fill="var(--fw-surface)" stroke="var(--fw-ink)" strokeWidth="2.5" />
      </g>
    </svg>
  );
}
