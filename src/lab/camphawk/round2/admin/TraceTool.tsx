"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Check, Copy, Download, Droplet, RotateCcw, Route, Toilet, Trash2, Undo2 } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import { pct, type SiteMapData } from "../maps";
import { cleanRoad, lengthM, segmentsOfPath, snap, toDeg, toXY, traceFile, type TraceDraft, type TracePointType, type XY } from "../maps/trace";
import { naipUrl } from "./AerialCheck";

// Tracing what no public source has, over the aerial photo: campground roads, and restrooms and
// water taps a person can see. The reviewer clicks along a road; the trace is kept in this browser
// and downloaded as the file the build reads (studio/campground-maps/traces/<map>.json). Nothing
// here changes a map until that file is added and the map rebuilt.
//
// The photo is USDA NAIP (public domain), so what is traced from it is our own work. It is drawn
// in ochre, CampHawk's "yours" colour, with a square at each end (and at every point of the road
// being drawn), so it reads as the reviewer's own lines by shape as well as hue.

type Tool = "road" | TracePointType;
const ZOOMS = [1, 2, 4] as const;
type Zoom = (typeof ZOOMS)[number];
/** A point this close to a road (in screen pixels) snaps onto it. */
const SNAP_PX = 10;
const TOOLS: { t: Tool; label: string; Icon: typeof Route }[] = [
  { t: "road", label: "Road", Icon: Route },
  { t: "Restroom", label: "Restroom", Icon: Toilet },
  { t: "Water", label: "Water tap", Icon: Droplet },
];
const POINT_WORD: Record<TracePointType, string> = { Restroom: "Restroom", Water: "Water tap" };
/** The lab's disabled look (as on New watch): a shell button that can't be mistaken for one that works. */
const OFF = "disabled:cursor-not-allowed disabled:border-ch-line disabled:bg-ch-shell disabled:text-ch-ink-2 disabled:shadow-none disabled:hover:bg-ch-shell";

export function TraceTool({ map, mapKey, name, draft, setDraft, changed, discard }: {
  map: SiteMapData & { bbox: [number, number, number, number] };
  mapKey: string;
  name: string;
  draft: TraceDraft;
  setDraft: (d: TraceDraft) => void;
  changed: boolean;
  discard: () => void;
}) {
  const f = map.frame;
  const [tool, setTool] = useState<Tool>("road");
  const [activeAt, setActive] = useState<number | null>(null);
  const [zoom, setZoom] = useState<Zoom>(1);
  const [snapOn, setSnapOn] = useState(true);
  const [cursor, setCursor] = useState<XY | null>(null);
  const [focused, setFocused] = useState(false);
  const [said, setSaid] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  // A road being drawn that has since been deleted (or discarded) is no longer being drawn.
  const active = activeAt !== null && activeAt < draft.roads.length ? activeAt : null;

  // The frame's width, so the photo is asked for at the size it's shown and snapping is in pixels.
  const outer = useRef<HTMLDivElement>(null);
  const [frameW, setFrameW] = useState(0);
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    setDpr(Math.min(2, window.devicePixelRatio || 1));
    const ro = new ResizeObserver(([e]) => setFrameW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const drawnW = frameW * zoom;
  const perPx = drawnW ? f.w / drawnW : 0;
  // Asked for in steps of 400px so a resize doesn't fetch a new photo every pixel; USGS serves up to 4000.
  const photoW = drawnW ? Math.min(4000, Math.ceil((drawnW * dpr) / 400) * 400) : 1400;
  const src = naipUrl(map.bbox, f, photoW);
  const [photo, setPhoto] = useState<{ src: string; state: "ready" | "error" } | null>(null);
  const photoState = photo?.src === src ? photo.state : "loading";
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => { const el = img.current; if (el?.complete && el.src === src) setPhoto({ src, state: el.naturalWidth ? "ready" : "error" }); }, [src]);

  // Keep the middle of the view in the middle when zooming.
  const centre = useRef<[number, number] | null>(null);
  const changeZoom = (z: Zoom) => {
    const el = outer.current;
    if (el) centre.current = [(el.scrollLeft + el.clientWidth / 2) / el.scrollWidth, (el.scrollTop + el.clientHeight / 2) / el.scrollHeight];
    setZoom(z);
  };
  useLayoutEffect(() => {
    const el = outer.current, c = centre.current;
    if (!el || !c) return;
    el.scrollLeft = c[0] * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = c[1] * el.scrollHeight - el.clientHeight / 2;
    centre.current = null;
  }, [zoom]);

  // What a new point may snap to: the source's roads, and every traced road (an earlier point of the
  // road being drawn included, so a loop can close on itself).
  // The source's roads (kept in the map file even when a trace replaces them).
  const sourceRoads = useMemo(() => map.sourceRoads ?? map.roads.filter((r) => !r.traced), [map.sourceRoads, map.roads]);
  const sourceSegments = useMemo(() => (draft.replace ? [] : sourceRoads.flatMap((r) => segmentsOfPath(r.d))), [sourceRoads, draft.replace]);
  const xyRoads = draft.roads.map((r) => r.coords.map((c) => toXY(map, c)));
  const snapTargets = () => [
    ...sourceSegments,
    ...xyRoads.flatMap((r, i) => {
      const pts = i === active ? r.slice(0, -1) : r;
      return pts.slice(1).map((p, j) => [pts[j], p] as [XY, XY]);
    }),
  ];

  const add = (raw: XY) => {
    const { at, snapped } = snapOn && perPx ? snap(raw, snapTargets(), SNAP_PX * perPx) : { at: raw, snapped: false };
    const deg = toDeg(map, at);
    const joined = snapped ? ", joined to a road" : "";
    if (tool === "road") {
      if (active === null) {
        setDraft({ ...draft, roads: [...draft.roads, { coords: [deg] }] });
        setActive(draft.roads.length);
        setSaid(`Road ${draft.roads.length + 1} started${joined}. Add the next point.`);
      } else {
        const roads = draft.roads.map((r, i) => (i === active ? { ...r, coords: [...r.coords, deg] } : r));
        setDraft({ ...draft, roads });
        setSaid(`Road ${active + 1}: ${roads[active].coords.length} points${joined}.`);
      }
    } else {
      setDraft({ ...draft, points: [...draft.points, { type: tool, at: deg }] });
      setSaid(`${POINT_WORD[tool]} placed.`);
    }
  };
  const finish = () => {
    if (active === null) return;
    const road = draft.roads[active].coords;
    if (road.length < 2) {
      setDraft({ ...draft, roads: draft.roads.filter((_, i) => i !== active) });
      setSaid("A road needs two points; that one was removed.");
    } else {
      setSaid(`Road ${active + 1} finished: ${road.length} points, ${Math.round(lengthM(xyRoads[active]))} m.`);
    }
    setActive(null);
  };
  const undo = () => {
    if (active === null) return;
    const road = draft.roads[active].coords;
    if (road.length <= 1) {
      setDraft({ ...draft, roads: draft.roads.filter((_, i) => i !== active) });
      setActive(null);
      setSaid(`Road ${active + 1} removed.`);
    } else {
      setDraft({ ...draft, roads: draft.roads.map((r, i) => (i === active ? { ...r, coords: r.coords.slice(0, -1) } : r)) });
      setSaid(`Road ${active + 1}: ${road.length - 1} point${road.length - 1 === 1 ? "" : "s"}.`);
    }
  };
  const pickTool = (t: Tool) => { if (t !== "road") finish(); setTool(t); };

  const surface = useRef<HTMLDivElement>(null);
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const box = surface.current?.getBoundingClientRect();
    if (!box?.width) return;
    add([f.x + ((e.clientX - box.left) / box.width) * f.w, f.y + ((e.clientY - box.top) / box.height) * f.h]);
  };
  // The keyboard way: arrows move a cross (1 m, or 10 m with Shift), Enter places a point, Escape
  // ends the road, Backspace takes its last point back.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1;
    const move: Record<string, XY> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const here = cursor ?? [f.x + f.w / 2, f.y + f.h / 2];
    if (move[e.key]) {
      e.preventDefault();
      const next: XY = [Math.min(f.x + f.w, Math.max(f.x, here[0] + move[e.key][0])), Math.min(f.y + f.h, Math.max(f.y, here[1] + move[e.key][1]))];
      setCursor(next);
      revealCursor(next);
    } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCursor(here); add(here); }
    else if (e.key === "Escape") { e.preventDefault(); finish(); }
    else if (e.key === "Backspace") { e.preventDefault(); undo(); }
  };
  const revealCursor = ([x, y]: XY) => {
    const el = outer.current;
    if (!el || !drawnW) return;
    const px = ((x - f.x) / f.w) * el.scrollWidth, py = ((y - f.y) / f.h) * el.scrollHeight;
    if (px < el.scrollLeft + 24 || px > el.scrollLeft + el.clientWidth - 24) el.scrollLeft = px - el.clientWidth / 2;
    if (py < el.scrollTop + 24 || py > el.scrollTop + el.clientHeight - 24) el.scrollTop = py - el.clientHeight / 2;
  };

  const removeRoad = (i: number) => {
    setDraft({ ...draft, roads: draft.roads.filter((_, j) => j !== i) });
    if (active !== null) setActive(i === active ? null : i < active ? active - 1 : active);
    setSaid(`Road ${i + 1} deleted.`);
  };
  const removePoint = (i: number) => {
    setDraft({ ...draft, points: draft.points.filter((_, j) => j !== i) });
    setSaid(`${POINT_WORD[draft.points[i].type]} deleted.`);
  };

  const setThrough = (i: number, through: boolean) => {
    setDraft({ ...draft, roads: draft.roads.map((r, j) => (j === i ? cleanRoad({ ...r, through }) : r)) });
    setSaid(`Road ${i + 1} is ${through ? "a through road (drawn wide)" : "a campground road (drawn thin)"}.`);
  };
  const setName = (i: number, name: string) => setDraft({ ...draft, roads: draft.roads.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r };
    if (name) next.name = name; else delete next.name;
    return next;
  }) });
  const setReplace = (on: boolean) => {
    const next = { ...draft };
    if (on) next.replace = true; else delete next.replace;
    setDraft(next);
    setSaid(on ? "Your traces replace the source’s roads. Trace every road the map should show, through roads too." : "Your traces add to the source’s roads.");
  };

  const finished = draft.roads.filter((r) => r.coords.length > 1).length;
  const hasAny = finished > 0 || draft.points.length > 0;
  const file = () => traceFile(mapKey, draft, "Site maps review page (CampHawk lab)", new Date().toISOString().slice(0, 10));
  const download = () => {
    const blob = new Blob([JSON.stringify(file(), null, 1) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${mapKey}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setSaid(`Downloaded ${mapKey}.json.`);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(file(), null, 1) + "\n"); setSaid("Trace file copied."); }
    catch { setSaid("Copying didn’t work in this browser. Use Download instead."); }
  };

  const vertex = 6 * perPx; // a 6px square at any zoom
  const placed = map.sites.filter((s): s is typeof s & { at: [number, number] } => s.at !== null);
  const sourceWord = { nps: "the Park Service", osm: "OpenStreetMap", usfs: "the Forest Service", tiger: "the Census Bureau", none: "" }[map.sources?.roads ?? "none"];

  return (
    <div>
      <p id="trace-help" className="max-w-[70ch] text-[14.5px] leading-snug text-ch-ink-2">
        Click along the middle of a campground road, one point at each bend, then press <strong className="font-bold text-ch-ink">Finish road</strong>. A point near a road snaps onto it, so a new lane joins the road it leaves. Trace only what you can see on the photo.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Draw" className="flex flex-wrap gap-1.5">
          {TOOLS.map(({ t, label, Icon }) => (
            <Pill key={t} on={tool === t} onClick={() => pickTool(t)}><Icon aria-hidden="true" className="size-4" />{label}</Pill>
          ))}
        </div>
        <div role="group" aria-label="Zoom" className="flex gap-1.5 sm:ml-auto">
          {ZOOMS.map((z) => <Pill key={z} on={zoom === z} onClick={() => changeZoom(z)}>{z === 1 ? "Whole photo" : `${z}×`}</Pill>)}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={finish} disabled={active === null} className={buttonClasses({ variant: "ink", size: "sm", className: OFF })}><Check aria-hidden="true" className="size-4" />Finish road</button>
        <button type="button" onClick={undo} disabled={active === null} className={buttonClasses({ variant: "quiet", size: "sm", className: OFF })}><Undo2 aria-hidden="true" className="size-4" />Undo last point</button>
        <Pill on={snapOn} onClick={() => setSnapOn(!snapOn)} check>Snap to roads</Pill>
        {sourceRoads.length > 0 && <Pill on={!!draft.replace} onClick={() => setReplace(!draft.replace)} check>Replace the source’s roads</Pill>}
      </div>
      {draft.replace && (
        <p className="mt-2 max-w-[70ch] rounded-ch-input border border-ch-ochre-line bg-ch-ochre-soft px-3 py-2 text-[13.5px] leading-snug text-ch-ink">
          Your traces will be this map’s only roads. Use it when a source has the roads but draws them in the wrong places. Trace every road campers should see, and mark the ones through the campground as through roads.
        </p>
      )}

      {/* The photo at 1×, 2× or 4×; zoomed, it scrolls inside its own frame and the page doesn't. */}
      <div ref={outer} className="relative mt-3 max-h-[80svh] overflow-auto overscroll-contain rounded-ch-input border border-ch-line bg-ch-shell">
        <div
          ref={surface}
          role="application"
          tabIndex={0}
          aria-label={`Tracing area: the aerial photo of ${name}. Arrow keys move the cross, Shift moves it 10 metres, Enter places a point, Escape finishes the road, Backspace takes back its last point.`}
          aria-describedby="trace-help"
          onClick={onClick}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="relative cursor-crosshair focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ch-green"
          style={{ width: zoom === 1 ? "100%" : `${zoom * 100}%`, aspectRatio: `${f.w} / ${f.h}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a live service image, not ours to optimise */}
          <img ref={img} src={src} alt="" draggable={false} onLoad={() => setPhoto({ src, state: "ready" })} onError={() => setPhoto({ src, state: "error" })}
            className={cx("absolute inset-0 size-full select-none object-fill", photoState === "error" && "opacity-0")} />
          <svg aria-hidden="true" viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
            {/* The source's roads; replaced, they stay as a thin dashed line, so the reviewer sees what goes. */}
            {!draft.replace && sourceRoads.map((r, i) => <path key={`c${i}`} d={r.d} fill="none" className="stroke-ch-ink" strokeOpacity={0.6} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            {sourceRoads.map((r, i) => <path key={`r${i}`} d={r.d} fill="none" className="stroke-ch-white" strokeOpacity={draft.replace ? 0.9 : 0.85} strokeWidth={1.5} strokeDasharray={draft.replace ? "3 4" : undefined} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            {perPx > 0 && placed.map((s) => <circle key={s.name} cx={s.at[0]} cy={s.at[1]} r={3.5 * perPx} fill="none" className="stroke-ch-white" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />)}
            {xyRoads.map((r, i) => r.length > 1 && <polyline key={`tc${i}`} points={r.map((p) => p.join(",")).join(" ")} fill="none" className="stroke-ch-ink" strokeWidth={draft.roads[i].through ? 8 : 5.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            {xyRoads.map((r, i) => r.length > 1 && <polyline key={`tf${i}`} points={r.map((p) => p.join(",")).join(" ")} fill="none" className="stroke-ch-ochre" strokeWidth={draft.roads[i].through ? 5 : 2.75} strokeDasharray={i === active ? "6 4" : undefined} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            {/* Squares: every point of the road being drawn, and each finished road's two ends (a
                square on every point of a long road hid the road itself on a phone). */}
            {perPx > 0 && xyRoads.flatMap((r, i) => r.map((p, j) => {
              if (i !== active && j !== 0 && j !== r.length - 1) return null;
              const big = i === active && j === r.length - 1 ? 1.6 : 1;
              return <rect key={`v${i}-${j}`} x={p[0] - (vertex * big) / 2} y={p[1] - (vertex * big) / 2} width={vertex * big} height={vertex * big} className="fill-ch-ochre stroke-ch-ink" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />;
            }))}
            {focused && cursor && perPx > 0 && (
              <g className="stroke-ch-ink" strokeWidth={2} vectorEffect="non-scaling-stroke">
                <line x1={cursor[0] - 12 * perPx} y1={cursor[1]} x2={cursor[0] + 12 * perPx} y2={cursor[1]} vectorEffect="non-scaling-stroke" />
                <line x1={cursor[0]} y1={cursor[1] - 12 * perPx} x2={cursor[0]} y2={cursor[1] + 12 * perPx} vectorEffect="non-scaling-stroke" />
                <circle cx={cursor[0]} cy={cursor[1]} r={5 * perPx} fill="none" className="stroke-ch-white" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              </g>
            )}
          </svg>
          {draft.points.map((p, i) => {
            const at = pct(map, toXY(map, p.at));
            const Icon = p.type === "Restroom" ? Toilet : Droplet;
            return <span key={i} aria-hidden="true" style={at} className="pointer-events-none absolute grid size-[20px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[5px] border-2 border-ch-ink bg-ch-ochre text-ch-ink"><Icon className="size-[12px]" /></span>;
          })}
          {photoState !== "ready" && (
            <p role={photoState === "error" ? "alert" : "status"} className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-[14.5px] text-ch-ink-2">
              {photoState === "error" ? "The aerial photo didn’t load. USGS’s imagery service may be busy; try again in a minute." : "Loading the aerial photo…"}
            </p>
          )}
        </div>
      </div>
      <p aria-live="polite" className="mt-2 min-h-[1.4em] text-[13.5px] font-bold text-ch-ink">{said}</p>

      <ul aria-label="What’s drawn on the photo" className="mt-1 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-ch-ink-2">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="relative h-[6px] w-7 rounded-full border border-ch-ink bg-ch-ochre"><span className="absolute -top-[3px] left-0 size-[10px] rounded-[2px] border-[1.5px] border-ch-ink bg-ch-ochre" /></span>Traced roads, a square at each end</li>
        {sourceWord && sourceRoads.length > 0 && (draft.replace
          ? <li className="flex items-center gap-2"><span aria-hidden="true" className="w-6 border-t-2 border-dashed border-ch-ink-2" />Roads from {sourceWord}, replaced</li>
          : <li className="flex items-center gap-2"><span aria-hidden="true" className="h-[5px] w-6 rounded-full border border-ch-ink bg-ch-white" />Roads from {sourceWord}</li>)}
        <li className="flex items-center gap-2"><span aria-hidden="true" className="size-[10px] rounded-full border-2 border-ch-white shadow-[0_0_0_1.5px_var(--color-ch-ink)]" />Sites</li>
      </ul>

      <section aria-labelledby="traces-h" className="mt-4 rounded-ch-input border border-ch-line bg-ch-paper">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-ch-line px-4 py-2.5">
          <h3 id="traces-h" className="font-ch-display text-[16px] font-bold text-ch-ink">Your traces</h3>
          <p className="text-[13px] text-ch-ink-2">{changed ? "Saved in this browser; not on the map yet" : map.trace ? "As built into this map" : "Nothing traced yet"}</p>
        </div>
        {draft.roads.length || draft.points.length ? (
          <ul className="divide-y divide-ch-line">
            {draft.roads.map((r, i) => (
              <Item key={`r${i}`} onDelete={() => removeRoad(i)} label={`Delete road ${i + 1}`}>
                <Route aria-hidden="true" className="size-4 shrink-0 text-ch-ink-2" />
                <span className="font-bold text-ch-ink">Road {i + 1}</span>
                <span className="tabular-nums text-ch-ink-2">{r.coords.length} point{r.coords.length === 1 ? "" : "s"}{r.coords.length > 1 ? ` · ${Math.round(lengthM(xyRoads[i]))} m` : ""}</span>
                {i === active && <span className="font-bold text-ch-ochre-ink">· drawing</span>}
                <span className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 pb-1">
                  <label className="flex min-w-0 basis-full items-center gap-2 text-[13.5px] text-ch-ink-2 sm:flex-1 sm:basis-auto">
                    <span className="shrink-0">Name</span>
                    <input type="text" value={r.name ?? ""} onChange={(e) => setName(i, e.target.value)} maxLength={80} placeholder="Optional, as on the sign" name={`road-${i + 1}-name`} autoComplete="off"
                      className="min-h-11 w-full min-w-0 rounded-ch-input border border-ch-line bg-ch-card px-3 text-[14px] text-ch-ink placeholder:text-ch-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ch-green" />
                  </label>
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[13.5px] text-ch-ink-2">
                    <input type="checkbox" checked={!!r.through} onChange={(e) => setThrough(i, e.target.checked)} className="size-4 accent-ch-ink" />
                    Through road
                  </label>
                </span>
              </Item>
            ))}
            {draft.points.map((p, i) => {
              const Icon = p.type === "Restroom" ? Toilet : Droplet;
              const n = draft.points.slice(0, i + 1).filter((q) => q.type === p.type).length;
              return (
                <Item key={`p${i}`} onDelete={() => removePoint(i)} label={`Delete ${POINT_WORD[p.type].toLowerCase()} ${n}`}>
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-ch-ink-2" />
                  <span className="font-bold text-ch-ink">{POINT_WORD[p.type]} {n}</span>
                </Item>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-3 text-[14px] text-ch-ink-2">Pick Road and click on the photo to start.</p>
        )}
        <div className="grid gap-2 border-t border-ch-line px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={download} disabled={!hasAny} className={buttonClasses({ variant: "ink", size: "sm", className: OFF })}><Download aria-hidden="true" className="size-4" />Download trace file</button>
            <button type="button" onClick={copy} disabled={!hasAny} className={buttonClasses({ variant: "quiet", size: "sm", className: OFF })}><Copy aria-hidden="true" className="size-4" />Copy</button>
            {changed && (confirmClear ? (
              <>
                <button type="button" onClick={() => { discard(); setActive(null); setConfirmClear(false); setSaid(map.trace ? "Back to the trace built into this map." : "Your traces were deleted."); }} className={buttonClasses({ variant: "warn", size: "sm" })}><Trash2 aria-hidden="true" className="size-4" />{map.trace ? "Yes, discard my changes" : "Yes, delete my traces"}</button>
                <button type="button" onClick={() => setConfirmClear(false)} className={buttonClasses({ variant: "quiet", size: "sm" })}>Keep them</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmClear(true)} className={buttonClasses({ variant: "quiet", size: "sm" })}><RotateCcw aria-hidden="true" className="size-4" />{map.trace ? "Discard my changes" : "Delete my traces"}</button>
            ))}
          </div>
          <p className="text-[13px] leading-snug text-ch-ink-2">
            The file is <code className="font-mono text-[12px]">{mapKey}.json</code>. It goes on the map when it’s added to <code className="font-mono text-[12px]">studio/campground-maps/traces/</code> and the map is rebuilt; a traced map then waits here for approval.
          </p>
        </div>
      </section>
    </div>
  );
}

function Pill({ on, onClick, check, children }: { on: boolean; onClick: () => void; check?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cx("inline-flex min-h-11 items-center gap-1.5 rounded-ch-chip border px-3.5 text-[13.5px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green",
        on ? "border-ch-ink bg-ch-ink text-ch-white" : "border-ch-line bg-ch-card text-ch-ink-2 hover:border-ch-muted")}>
      {check && <span aria-hidden="true" className={cx("grid size-4 place-items-center rounded-[4px] border text-[11px] leading-none", on ? "border-ch-white" : "border-ch-muted")}>{on ? "✓" : ""}</span>}
      {children}
    </button>
  );
}

function Item({ onDelete, label, children }: { onDelete: () => void; label: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2 px-4 py-1.5 text-[14px]">
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">{children}</span>
      <button type="button" onClick={onDelete} aria-label={label} className="grid size-11 shrink-0 place-items-center rounded-ch-btn text-ch-ink-2 hover:bg-ch-shell hover:text-ch-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green">
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}
