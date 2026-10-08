"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Check, ChevronDown, Copy, Download, Droplet, EyeOff, PenLine, RotateCcw, Route, Toilet, Trash2, Undo2 } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import { pct, type SiteMapData } from "../maps";
import { cleanRoad, lengthM, segmentsOfPath, snap, toDeg, toXY, traceFile, type TraceDraft, type TracePointType, type XY } from "../maps/trace";
import { TracedMark } from "./AerialCheck";
import { aerialSource, aerialUrl, NO_PHOTO } from "../maps/aerial";

// Tracing what no public source has, over the aerial photo: campground roads, and restrooms and
// water taps a person can see. The reviewer clicks along a road; the trace is kept in this browser
// and downloaded as the file the build reads (studio/campground-maps/traces/<map>.json). Nothing
// here changes a map until that file is added and the map rebuilt.
//
// The photo is public domain (maps/aerial.ts picks it: USDA NAIP, or the Forest Service's in
// Alaska), so what is traced from it is our own work. It is drawn
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
  const [confirmReplace, setConfirmReplace] = useState(false);
  // The road a list row points at (hover or focus): drawn with a halo, so "Road 7" is findable.
  const [hi, setHi] = useState<number | null>(null);
  // Which list rows show their name and through-road controls.
  const [open, setOpen] = useState<Set<number>>(new Set());
  // Where the last point snapped, ringed for a moment so the join is seen as well as read.
  const [ring, setRing] = useState<XY | null>(null);
  const ringTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(ringTimer.current), []);
  // The last thing deleted, so a delete can be taken back.
  const [deleted, setDeleted] = useState<{ draft: TraceDraft; what: string } | null>(null);
  // Any other change ends the chance to undo a delete (it would throw that change away).
  const edit = (d: TraceDraft) => { setDeleted(null); setDraft(d); };
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
  const source = aerialSource(map);
  const src = aerialUrl(map, f, photoW);
  const [photo, setPhoto] = useState<{ src: string; state: "ready" | "error" } | null>(null);
  const photoState = photo?.src === src ? photo.state : "loading";
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => { const el = img.current; if (el?.complete && el.src === src) setPhoto({ src, state: el.naturalWidth ? "ready" : "error" }); }, [src]);

  // Keep the middle of the view in the middle when zooming.
  const viewMid = useRef<[number, number] | null>(null);
  const changeZoom = (z: Zoom) => {
    const el = outer.current;
    if (el) viewMid.current = [(el.scrollLeft + el.clientWidth / 2) / el.scrollWidth, (el.scrollTop + el.clientHeight / 2) / el.scrollHeight];
    setZoom(z);
  };
  useLayoutEffect(() => {
    const el = outer.current, c = viewMid.current;
    if (!el || !c) return;
    el.scrollLeft = c[0] * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = c[1] * el.scrollHeight - el.clientHeight / 2;
    viewMid.current = null;
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
    if (snapped) { setRing(at); clearTimeout(ringTimer.current); ringTimer.current = setTimeout(() => setRing(null), 1200); }
    if (tool === "road") {
      if (active === null) {
        edit({ ...draft, roads: [...draft.roads, { coords: [deg] }] });
        setActive(draft.roads.length);
        setSaid(`Road ${draft.roads.length + 1} started${joined}. Add the next point.`);
      } else {
        const roads = draft.roads.map((r, i) => (i === active ? { ...r, coords: [...r.coords, deg] } : r));
        edit({ ...draft, roads });
        setSaid(`Road ${active + 1}: ${roads[active].coords.length} points${joined}.`);
      }
    } else {
      edit({ ...draft, points: [...draft.points, { type: tool, at: deg }] });
      setSaid(`${POINT_WORD[tool]} placed.`);
    }
  };
  const finish = () => {
    if (active === null) return;
    const road = draft.roads[active].coords;
    if (road.length < 2) {
      edit({ ...draft, roads: draft.roads.filter((_, i) => i !== active) });
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
      edit({ ...draft, roads: draft.roads.filter((_, i) => i !== active) });
      setActive(null);
      setSaid(`Road ${active + 1} removed.`);
    } else {
      edit({ ...draft, roads: draft.roads.map((r, i) => (i === active ? { ...r, coords: r.coords.slice(0, -1) } : r)) });
      setSaid(`Road ${active + 1}: ${road.length - 1} point${road.length - 1 === 1 ? "" : "s"}.`);
    }
  };
  const pickTool = (t: Tool) => { if (t !== "road") finish(); setTool(t); };
  /** Pick a finished road up again: new points go on its end, and Undo takes them back. */
  const continueRoad = (i: number) => {
    if (active !== null && active !== i) finish();
    setTool("road");
    setActive(i);
    setSaid(`Continuing road ${i + 1}: new points go on its end.`);
  };

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
    setDeleted({ draft, what: `Road ${i + 1}` });
    setDraft({ ...draft, roads: draft.roads.filter((_, j) => j !== i) });
    if (active !== null) setActive(i === active ? null : i < active ? active - 1 : active);
    setOpen(new Set());
    setSaid(`Road ${i + 1} deleted${i < draft.roads.length - 1 ? "; the roads after it are renumbered" : ""}.`);
  };
  const removePoint = (i: number) => {
    const word = `${POINT_WORD[draft.points[i].type]} ${draft.points.slice(0, i + 1).filter((q) => q.type === draft.points[i].type).length}`;
    setDeleted({ draft, what: word });
    setDraft({ ...draft, points: draft.points.filter((_, j) => j !== i) });
    setSaid(`${word} deleted.`);
  };
  const undoDelete = () => {
    if (!deleted) return;
    setDraft(deleted.draft);
    setActive(null);
    setSaid(`${deleted.what} is back.`);
    setDeleted(null);
  };

  const setThrough = (i: number, through: boolean) => {
    edit({ ...draft, roads: draft.roads.map((r, j) => (j === i ? cleanRoad({ ...r, through }) : r)) });
    setSaid(`Road ${i + 1} is ${through ? "a through road (drawn wide)" : "a campground road (drawn thin)"}.`);
  };
  const setName = (i: number, name: string) => edit({ ...draft, roads: draft.roads.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r };
    if (name) next.name = name; else delete next.name;
    return next;
  }) });
  const setReplace = (on: boolean) => {
    const next = { ...draft };
    if (on) next.replace = true; else delete next.replace;
    edit(next);
    setSaid(on ? "Your traces replace the source’s roads. Trace every road the map should show, through roads too." : "Your traces add to the source’s roads.");
  };

  const finished = draft.roads.filter((r) => r.coords.length > 1).length;
  const hasAny = finished > 0 || draft.points.length > 0;
  const file = () => traceFile(mapKey, draft, "Site maps review page (CampHawk lab)", new Date().toISOString().slice(0, 10), "", source?.credit);
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
  // A road's number sits above its start, kept inside the frame so it's never cut off.
  const labelAt = (c: XY) => {
    const x = Math.min(97, Math.max(3, ((c[0] - f.x) / f.w) * 100)), y = Math.min(100, Math.max(6, ((c[1] - f.y) / f.h) * 100));
    return { left: `${x}%`, top: `${y}%` };
  };
  // Where each road's number goes: its start, unless that's within 18px of a number already placed;
  // then its second point, its end or its middle, whichever is clear first.
  const labels: XY[] = [];
  for (const r of xyRoads) {
    const tries = r.length ? [r[0], r[1], r.at(-1), r[Math.floor(r.length / 2)]].filter((c): c is XY => !!c) : [];
    const clear = (c: XY) => labels.every((l) => Math.abs(l[0] - c[0]) > 18 * perPx || Math.abs(l[1] - c[1]) > 14 * perPx);
    labels.push(tries.find(clear) ?? tries[0] ?? [f.x, f.y]);
  }
  const toggleOpen = (i: number) => setOpen((o) => { const n = new Set(o); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const placedKinds = TRACE_KINDS.filter((k) => draft.points.some((p) => p.type === k.type));

  return (
    <div>
      <p id="trace-help" className="max-w-[70ch] text-[14.5px] leading-snug text-ch-ink-2">
        Click along the middle of a campground road, one point at each bend, then press <strong className="font-bold text-ch-ink">Finish road</strong>. A point near a road snaps onto it, so a new lane joins the road it leaves. Trace only what you can see on the photo.
      </p>

      {/* What you're drawing and how close: each a joined group where one is chosen. Snapping is a
          plain checkbox, and ink fill is kept for the one action, Finish road. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Segmented label="Draw">
          {TOOLS.map(({ t, label, Icon }) => <SegButton key={t} on={tool === t} onClick={() => pickTool(t)}><Icon aria-hidden="true" className="size-4" />{label}</SegButton>)}
        </Segmented>
        <Segmented label="Zoom">
          {ZOOMS.map((z) => <SegButton key={z} on={zoom === z} onClick={() => changeZoom(z)}>{z === 1 ? "Whole photo" : `${z}×`}</SegButton>)}
        </Segmented>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-ch-chip border border-ch-line bg-ch-card px-3.5 text-[13.5px] font-bold text-ch-ink-2 hover:border-ch-muted">
          <input type="checkbox" checked={snapOn} onChange={(e) => setSnapOn(e.target.checked)} className="size-4 accent-ch-ink" />
          Snap to roads
        </label>
      </div>

      {draft.replace && (
        <p className="mt-2 flex items-center gap-1.5 text-[13.5px] font-bold text-ch-ink"><EyeOff aria-hidden="true" className="size-4 shrink-0" />The source’s roads are hidden: your traces are this map’s only roads.</p>
      )}
      {/* The photo at 1×, 2× or 4×; zoomed, it scrolls inside its own frame and the page doesn't. */}
      <div ref={outer} className="relative mt-3 max-h-[75svh] overflow-auto overscroll-contain rounded-t-ch-input border border-b-0 border-ch-line bg-ch-shell">
        <div
          ref={surface}
          role="application"
          tabIndex={0}
          aria-label={`Tracing area: the aerial photo of ${name}. Arrow keys move the cross, Shift moves it 10 metres, Enter places a point, Escape finishes the road, Backspace takes back its last point.`}
          aria-describedby="trace-help"
          onClick={onClick}
          onKeyDown={onKey}
          // The cross shows as soon as the keyboard arrives, so Enter never places an unseen point.
          onFocus={(e) => { setFocused(true); if (!cursor && e.currentTarget.matches(":focus-visible")) setCursor([f.x + f.w / 2, f.y + f.h / 2]); }}
          onBlur={() => setFocused(false)}
          className="relative cursor-crosshair touch-manipulation select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ch-green"
          style={{ width: zoom === 1 ? "100%" : `${zoom * 100}%`, aspectRatio: `${f.w} / ${f.h}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a live service image, not ours to optimise */}
          {src && <img ref={img} src={src} alt="" width={photoW} height={Math.round((photoW * f.h) / f.w)} draggable={false} onLoad={() => setPhoto({ src, state: "ready" })} onError={() => setPhoto({ src, state: "error" })}
            className={cx("absolute inset-0 size-full select-none object-fill", photoState === "error" && "opacity-0")} />}
          <svg aria-hidden="true" viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
            {/* The source's roads. Replaced, they fade (no casing), so what goes is still visible. */}
            {!draft.replace && sourceRoads.map((r, i) => <path key={`c${i}`} d={r.d} fill="none" className="stroke-ch-ink" strokeOpacity={0.6} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            {sourceRoads.map((r, i) => <path key={`r${i}`} d={r.d} fill="none" className="stroke-ch-white" strokeOpacity={draft.replace ? 0.45 : 0.85} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            {perPx > 0 && placed.map((s) => <circle key={s.name} cx={s.at[0]} cy={s.at[1]} r={3.5 * perPx} fill="none" className="stroke-ch-white" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />)}
            {hi !== null && xyRoads[hi]?.length > 1 && <polyline points={xyRoads[hi].map((p) => p.join(",")).join(" ")} fill="none" className="stroke-ch-white" strokeOpacity={0.9} strokeWidth={draft.roads[hi].through ? 15 : 12} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
            {xyRoads.map((r, i) => r.length > 1 && <polyline key={`tc${i}`} points={r.map((p) => p.join(",")).join(" ")} fill="none" className="stroke-ch-ink" strokeWidth={draft.roads[i].through ? 8 : 5.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            {xyRoads.map((r, i) => r.length > 1 && <polyline key={`tf${i}`} points={r.map((p) => p.join(",")).join(" ")} fill="none" className="stroke-ch-ochre" strokeWidth={draft.roads[i].through ? 5 : 2.75} strokeDasharray={i === active ? "6 4" : undefined} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            {/* Squares: every point of the road being drawn, and each finished road's two ends (a
                square on every point of a long road hid the road itself on a phone). */}
            {perPx > 0 && xyRoads.flatMap((r, i) => r.map((p, j) => {
              if (i !== active && j !== 0 && j !== r.length - 1) return null;
              const big = i === active && j === r.length - 1 ? 1.6 : 1;
              return <rect key={`v${i}-${j}`} x={p[0] - (vertex * big) / 2} y={p[1] - (vertex * big) / 2} width={vertex * big} height={vertex * big} className="fill-ch-ochre stroke-ch-ink" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />;
            }))}
            {ring && perPx > 0 && <circle cx={ring[0]} cy={ring[1]} r={11 * perPx} fill="none" className="stroke-ch-ink" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />}
            {ring && perPx > 0 && <circle cx={ring[0]} cy={ring[1]} r={11 * perPx} fill="none" className="stroke-ch-white" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
            {focused && cursor && perPx > 0 && (
              <g className="stroke-ch-ink" strokeWidth={2} vectorEffect="non-scaling-stroke">
                <line x1={cursor[0] - 12 * perPx} y1={cursor[1]} x2={cursor[0] + 12 * perPx} y2={cursor[1]} vectorEffect="non-scaling-stroke" />
                <line x1={cursor[0]} y1={cursor[1] - 12 * perPx} x2={cursor[0]} y2={cursor[1] + 12 * perPx} vectorEffect="non-scaling-stroke" />
                <circle cx={cursor[0]} cy={cursor[1]} r={5 * perPx} fill="none" className="stroke-ch-white" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              </g>
            )}
          </svg>
          {/* Each road's number at its start, matching "Road N" in the list below. */}
          {draft.roads.map((r, i) => r.coords.length > 0 && (
            <span key={`n${i}`} aria-hidden="true" style={labelAt(labels[i])}
              className={cx("pointer-events-none absolute -translate-x-1/2 -translate-y-[135%] rounded-[4px] border-[1.5px] border-ch-ink px-1 text-[11px] font-extrabold leading-[14px] tabular-nums", i === hi ? "z-10 bg-ch-ink text-ch-white" : "bg-ch-white text-ch-ink")}>{i + 1}</span>
          ))}
          {draft.points.map((p, i) => {
            const at = pct(map, toXY(map, p.at));
            const Icon = p.type === "Restroom" ? Toilet : Droplet;
            return <span key={i} aria-hidden="true" style={at} className="pointer-events-none absolute grid size-[20px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[5px] border-2 border-ch-ink bg-ch-ochre text-ch-ink"><Icon className="size-[12px]" /></span>;
          })}
          {photoState !== "ready" && (
            <p role={photoState === "error" ? "alert" : "status"} className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-[14.5px] text-ch-ink-2">
              {!source ? NO_PHOTO : photoState === "error" ? `The aerial photo didn’t load. ${source.host} may be busy; try again in a minute.` : "Loading the aerial photo…"}
            </p>
          )}
        </div>
      </div>
      {/* The road controls and what just happened, kept in reach at the bottom of the screen while
          the photo is in view (on a phone the photo is taller than the window). */}
      <div className={cx("flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-b-ch-input border border-ch-line bg-ch-card px-3 py-2",
        active !== null && "sticky bottom-0 z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-6px_16px_-12px_rgb(22_41_31/0.35)]")}>
        {active !== null && <button type="button" onClick={finish} className={buttonClasses({ variant: "ink", size: "sm" })}><Check aria-hidden="true" className="size-4" />Finish road</button>}
        {active !== null && <button type="button" onClick={undo} className={buttonClasses({ variant: "quiet", size: "sm" })}><Undo2 aria-hidden="true" className="size-4" />Undo last point</button>}
        {deleted && <button type="button" onClick={undoDelete} className={buttonClasses({ variant: "quiet", size: "sm" })}><RotateCcw aria-hidden="true" className="size-4" />Undo delete</button>}
        <p aria-live="polite" className={cx("min-w-0 basis-full text-[13.5px] font-bold text-ch-ink sm:flex-1 sm:basis-auto", !said && "sr-only")}>{said}</p>
        {!said && <p className="text-[13.5px] text-ch-ink-2">{tool === "road" ? "Tap the photo to start a road." : `Tap the photo to place a ${POINT_WORD[tool].toLowerCase()}.`}</p>}
      </div>

      <ul aria-label="What’s drawn on the photo" className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-ch-ink-2">
        <li className="flex items-center gap-2"><TracedMark />Traced roads, numbered at the start, a square at each end</li>
        {sourceWord && sourceRoads.length > 0 && (draft.replace
          ? <li className="flex items-center gap-2"><span aria-hidden="true" className="h-[3px] w-6 rounded-full bg-ch-ink-2/45" />Roads from {sourceWord}, replaced (faded)</li>
          : <li className="flex items-center gap-2"><span aria-hidden="true" className="h-[5px] w-6 rounded-full border border-ch-ink bg-ch-white" />Roads from {sourceWord}</li>)}
        {placedKinds.map(({ type, Icon, word }) => <li key={type} className="flex items-center gap-2"><span aria-hidden="true" className="grid size-[18px] place-items-center rounded-[5px] border-2 border-ch-ink bg-ch-ochre text-ch-ink"><Icon className="size-[11px]" /></span>{word} you placed</li>)}
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
              <li key={`r${i}`} className="px-4 py-1.5 text-[14px]" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onFocus={() => setHi(i)} onBlur={() => setHi(null)}>
                <div className="flex items-start gap-2">
                  <Route aria-hidden="true" className="mt-[13px] size-4 shrink-0 text-ch-ink-2" />
                  <div className="min-w-0 flex-1 py-2">
                    <p className="flex flex-wrap items-center gap-x-2 leading-snug">
                      <span className="font-bold text-ch-ink">Road {i + 1}</span>
                      {i === active && <span className="inline-flex items-center gap-1 font-bold text-ch-ochre-ink"><PenLine aria-hidden="true" className="size-3.5" />drawing</span>}
                    </p>
                    {/* The facts on a line of their own, so a narrow row never starts a line mid-list. */}
                    <p className="text-[13.5px] leading-snug text-ch-ink-2 [overflow-wrap:anywhere]">
                      {[`${r.coords.length} point${r.coords.length === 1 ? "" : "s"}`, r.coords.length > 1 && <span key="m" className="tabular-nums">{Math.round(lengthM(xyRoads[i]))} m</span>, r.through && "through road", r.name && `“${r.name}”`].filter(Boolean).flatMap((x, k) => (k ? [" · ", x] : [x]))}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => toggleOpen(i)} aria-expanded={open.has(i)} aria-controls={`road-${i}-edit`} className={ROW_BTN}>
                      Edit<span className="sr-only"> road {i + 1}</span><ChevronDown aria-hidden="true" className={cx("size-4 transition-transform motion-reduce:transition-none", open.has(i) && "rotate-180")} />
                    </button>
                    <button type="button" onClick={() => removeRoad(i)} aria-label={`Delete road ${i + 1}`} className={DEL_BTN}><Trash2 aria-hidden="true" className="size-4" /></button>
                  </span>
                </div>
                {open.has(i) && (
                  <div id={`road-${i}-edit`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-2 pl-6">
                    <label className="flex min-w-0 basis-full items-center gap-2 text-[13.5px] text-ch-ink-2 sm:flex-1 sm:basis-auto">
                      <span className="shrink-0">Name</span>
                      <input type="text" value={r.name ?? ""} onChange={(e) => setName(i, e.target.value)} maxLength={80} placeholder="Optional, e.g. Loop B…" name={`road-${i + 1}-name`} autoComplete="off"
                        className="min-h-11 w-full min-w-0 rounded-ch-input border border-ch-line bg-ch-card px-3 text-[16px] text-ch-ink placeholder:text-ch-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ch-green sm:text-[14px]" />
                    </label>
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[13.5px] text-ch-ink-2">
                      <input type="checkbox" checked={!!r.through} onChange={(e) => setThrough(i, e.target.checked)} className="size-4 accent-ch-ink" />
                      Through road
                    </label>
                    {i !== active && r.coords.length > 0 && (
                      <button type="button" onClick={() => continueRoad(i)} className={buttonClasses({ variant: "quiet", size: "sm" })}><PenLine aria-hidden="true" className="size-4" />Continue road {i + 1}</button>
                    )}
                  </div>
                )}
              </li>
            ))}
            {draft.points.map((p, i) => {
              const Icon = p.type === "Restroom" ? Toilet : Droplet;
              const n = draft.points.slice(0, i + 1).filter((q) => q.type === p.type).length;
              return (
                <li key={`p${i}`} className="flex items-center gap-2 px-4 py-1.5 text-[14px]">
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-ch-ink-2" />
                  <span className="font-bold text-ch-ink">{POINT_WORD[p.type]} {n}</span>
                  <button type="button" onClick={() => removePoint(i)} aria-label={`Delete ${POINT_WORD[p.type].toLowerCase()} ${n}`} className={cx(DEL_BTN, "ml-auto")}><Trash2 aria-hidden="true" className="size-4" /></button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-3 text-[14px] text-ch-ink-2">Pick Road and click on the photo to start.</p>
        )}
        {sourceRoads.length > 0 && (
          <div className="border-t border-ch-line px-4 py-2.5">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[14px] font-bold text-ch-ink">
              <input type="checkbox" checked={!!draft.replace || confirmReplace}
                onChange={(e) => { if (e.target.checked) setConfirmReplace(true); else { setConfirmReplace(false); setReplace(false); } }} className="size-4 accent-ch-ink" />
              Replace the source’s roads
            </label>
            <p className="text-[13px] leading-snug text-ch-ink-2">For a source that has the roads but draws them in the wrong places: your traces become the map’s only roads.</p>
            {confirmReplace && !draft.replace && (
              <div role="group" aria-label="Replace the source’s roads?" className="mt-2 rounded-ch-input border border-ch-ochre-line bg-ch-ochre-soft px-3 py-2.5">
                <p className="text-[13.5px] leading-snug text-ch-ink">All {sourceRoads.length} road{sourceRoads.length === 1 ? "" : "s"} from {sourceWord || "the source"} will be hidden. Trace every road campers should see, and mark the through roads.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setConfirmReplace(false); setReplace(true); }} className={buttonClasses({ variant: "ink", size: "sm" })}>Replace them</button>
                  <button type="button" onClick={() => setConfirmReplace(false)} className={buttonClasses({ variant: "quiet", size: "sm" })}>Keep the source’s roads</button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="grid gap-2 border-t border-ch-line px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={download} disabled={!hasAny} className={buttonClasses({ variant: "ink", size: "sm", className: OFF })}><Download aria-hidden="true" className="size-4" />Download trace file</button>
            <button type="button" onClick={copy} disabled={!hasAny} className={buttonClasses({ variant: "quiet", size: "sm", className: OFF })}><Copy aria-hidden="true" className="size-4" />Copy</button>
            {changed && (confirmClear ? (
              <>
                <button type="button" onClick={() => { discard(); setActive(null); setConfirmClear(false); setDeleted(null); setOpen(new Set()); setSaid(map.trace ? "Back to the trace built into this map." : "Your traces were deleted."); }} className={buttonClasses({ variant: "warn", size: "sm" })}><Trash2 aria-hidden="true" className="size-4" />{map.trace ? "Yes, discard my changes" : "Yes, delete my traces"}</button>
                <button type="button" onClick={() => setConfirmClear(false)} className={buttonClasses({ variant: "quiet", size: "sm" })}>Keep them</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmClear(true)} className={buttonClasses({ variant: "quiet", size: "sm" })}><RotateCcw aria-hidden="true" className="size-4" />{map.trace ? "Discard my changes" : "Delete my traces"}</button>
            ))}
          </div>
          <p className="text-[13px] leading-snug text-ch-ink-2">
            The file is <code translate="no" className="font-mono text-[12px]">{mapKey}.json</code>. It goes on the map when it’s added to <code translate="no" className="font-mono text-[12px]">studio/campground-maps/traces/</code> and the map is rebuilt; a traced map then waits here for approval.
          </p>
        </div>
      </section>
    </div>
  );
}

const TRACE_KINDS: { type: TracePointType; Icon: typeof Route; word: string }[] = [
  { type: "Restroom", Icon: Toilet, word: "Restrooms" },
  { type: "Water", Icon: Droplet, word: "Water taps" },
];
const ROW_BTN = "inline-flex min-h-11 items-center gap-1 rounded-ch-btn px-2.5 text-[13.5px] font-bold text-ch-ink-2 hover:bg-ch-shell hover:text-ch-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green";
const DEL_BTN = "grid size-11 shrink-0 place-items-center rounded-ch-btn text-ch-ink-2 hover:bg-ch-shell hover:text-ch-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green";


/** A joined row of options where exactly one is chosen (pressed), told apart from actions by its frame. */
function Segmented({ label, children }: { label: string; children: ReactNode }) {
  return <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-ch-chip border border-ch-line bg-ch-card p-[3px]">{children}</div>;
}

function SegButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cx("inline-flex min-h-11 items-center gap-1.5 rounded-ch-chip px-3 text-[13.5px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green",
        on ? "bg-ch-ink text-ch-white" : "text-ch-ink-2 hover:bg-ch-shell hover:text-ch-ink")}>
      {children}
    </button>
  );
}
