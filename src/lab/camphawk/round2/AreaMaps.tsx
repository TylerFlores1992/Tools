"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { cx } from "@/components/cx";
import { SiteMap } from "./SiteMap";
import { scaleBar, type SiteMapData } from "./maps";
import { segmentsOfPath } from "./maps/trace";
import { areaMap, outline, unplacedSites, type Area, type Split } from "./maps/areas";
import { isFirstCome } from "./maps/first-come";
import { FirstComeMap } from "./FirstCome";

// Two kinds of Recreation.gov listing that one site map can't show (wave 1, 2026-10-08):
// - a SPLIT listing, several areas kilometres apart (Seven Points, Diamond Lake): an overview of the
//   whole listing with each area outlined and numbered, then each area's own site map;
// - a SINGLE UNIT, one cabin, lookout, guard station or group site (1,016 of them): a location map,
//   with the one place marked and what a camper needs to find it.
// Design comps for the owner to choose between (docs/design/campground-maps-areas.md); the area
// split itself is splitAreas() (tested). Same drawing rules as SiteMap: never colour alone, nothing
// claimed beyond the data, distances are straight lines and say so.

export type SplitLayout = "pick" | "stack";

type Props = {
  map: SiteMapData;
  name: string;
  provider: string;
  picked: string | null;
  openIds: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  note?: string;
};

export const fmtMi = (m: number) => { const mi = m / 1609.34; return mi < 0.1 ? `${Math.round(m * 3.28084 / 10) * 10} ft` : `${mi < 1 ? mi.toFixed(1) : mi.toFixed(1)} mi`; };

/** The listing's whole frame, drawn small: water, roads, a dot per site, each area outlined by a
    buffer around its own sites (boxes overlapped on a diagonal shore: critic round 1). Each number
    sits just outside its outline, on the side away from the listing's middle, so it never covers a
    site; a tap target is 44px around a 28px badge. */
function Overview({ map, areas, current, onPick, linkTo }: { map: SiteMapData; areas: Area[]; current: number | null; onPick?: (i: number) => void; linkTo?: (i: number) => string }) {
  const g = map.frame;
  const s = Math.max(g.w, g.h) / 600; // stroke scale: about 1px at 600px across
  const pad = 14 * s;
  const mid: [number, number] = [g.x + g.w / 2, g.y + g.h / 2];
  const rings = areas.map((a) => outline(map, a, pad));
  // The map's own frame has only a narrow margin, so an area at its edge would lose its outline and
  // number (Medicine Lake, Hardin Ridge: first look, 2026-10-08). Room for every outline and a badge.
  const room = 40 * s, xs = rings.flat().map((q) => q[0]), ys = rings.flat().map((q) => q[1]);
  const x0 = Math.min(g.x, Math.min(...xs) - room), y0 = Math.min(g.y, Math.min(...ys) - room);
  const f = { x: x0, y: y0, w: Math.max(g.x + g.w, Math.max(...xs) + room) - x0, h: Math.max(g.y + g.h, Math.max(...ys) + room) - y0 };
  // Never thinner than 1:2, so a listing strung along a shore still has room for its numbers.
  if (f.w < f.h / 2) { f.x -= (f.h / 2 - f.w) / 2; f.w = f.h / 2; }
  if (f.h < f.w / 2) { f.y -= (f.w / 2 - f.h) / 2; f.h = f.w / 2; }
  // The badge: from the area's middle, out past its outline away from the listing's middle.
  const badgeAt = (a: Area, ring: [number, number][]): [number, number] => {
    let dx = a.center[0] - mid[0], dy = a.center[1] - mid[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    if (len < 1) { dx = -0.7; dy = -0.7; }
    const reach = Math.max(...ring.map(([x, y]) => (x - a.center[0]) * dx + (y - a.center[1]) * dy));
    const r = reach + 22 * s;
    return [Math.min(Math.max(a.center[0] + dx * r, f.x + 18 * s), f.x + f.w - 18 * s), Math.min(Math.max(a.center[1] + dy * r, f.y + 18 * s), f.y + f.h - 18 * s)];
  };
  return (
    // At most about 560px (or 70% of the screen) tall, so a long listing's overview stays one glance.
    <div className="relative mx-auto w-full overflow-hidden rounded-ch-input border border-ch-line bg-ch-shell" style={{ aspectRatio: `${f.w} / ${f.h}`, maxWidth: `calc(min(70svh, 560px) * ${(f.w / f.h).toFixed(3)})` }}>
      <svg viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`} className="absolute inset-0 size-full" aria-hidden="true">
        {map.water.map((w, i) => <path key={i} d={w.d} fillRule="evenodd" className="fill-ch-map-water" />)}
        {map.roads.map((r, i) => <path key={i} d={r.d} fill="none" className="stroke-ch-muted" strokeWidth={2.2 * s} strokeLinecap="round" strokeLinejoin="round" />)}
        {rings.map((ring, i) => (
          <path key={i} d={`M${ring.map((q) => q.join(" ")).join("L")}Z`} className={i === current ? "fill-ch-card stroke-ch-ink" : "fill-none stroke-ch-ink"} fillOpacity={i === current ? 0.55 : undefined}
            strokeWidth={i === current ? 3 : 1.5} strokeDasharray={i === current ? undefined : "6 5"} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
        {map.sites.filter((x) => x.at).map((x) => <path key={x.name} d={`M${x.at![0]} ${x.at![1]}h0`} className="stroke-ch-ink-2" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
        {areas.map((a, i) => {
          const [bx, by] = badgeAt(a, rings[i]);
          // A short leader from the badge to the outline's nearest point.
          const near = rings[i].reduce((b, q) => (Math.hypot(q[0] - bx, q[1] - by) < Math.hypot(b[0] - bx, b[1] - by) ? q : b));
          return <path key={`l${i}`} d={`M${bx} ${by}L${near[0]} ${near[1]}`} className="stroke-ch-ink" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      {areas.map((a, i) => {
        const [bx, by] = badgeAt(a, rings[i]);
        const left = `${((bx - f.x) / f.w) * 100}%`, top = `${((by - f.y) / f.h) * 100}%`;
        const dot = cx("grid size-7 place-items-center rounded-full border-2 border-ch-ink text-[13px] font-extrabold tabular-nums shadow-ch-card", i === current ? "bg-ch-ink text-ch-white" : "bg-ch-card text-ch-ink");
        const hit = "absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ch-green";
        const label = `Area ${i + 1}: ${a.name}`;
        return onPick
          ? <button key={i} type="button" aria-label={label} aria-pressed={i === current} onClick={() => onPick(i)} style={{ left, top }} className={cx(hit, "cursor-pointer")}><span aria-hidden="true" className={dot}>{i + 1}</span></button>
          : linkTo ? <a key={i} href={linkTo(i)} aria-label={label} style={{ left, top }} className={hit}><span aria-hidden="true" className={dot}>{i + 1}</span></a>
          : <span key={i} aria-hidden="true" style={{ left, top }} className={hit}><span className={dot}>{i + 1}</span></span>;
      })}
    </div>
  );
}

/** A listing's site map, split into areas when it's several places (else the ordinary map). */
export function AreaMaps({ layout, ...p }: Props & { layout: SplitLayout }) {
  // The split the build recorded (and checked). Never worked out here: a listing a person kept as
  // one map (Strawberry Bay, approved as one) must not be split by the page.
  const split: Split = p.map.split ?? { kind: "one" };
  const [current, setCurrent] = useState(0);
  const [findNext, setFindNext] = useState<{ q: string; n: number } | null>(null);
  // A site picked outside the map (the day panel's Map button) switches to its area.
  const [seen, setSeen] = useState(p.selectedId);
  if (p.selectedId !== seen) {
    setSeen(p.selectedId);
    const i = split.kind === "areas" && p.selectedId ? split.areas.findIndex((a) => a.sites.includes(p.selectedId!)) : -1;
    if (i >= 0 && i !== current) setCurrent(i);
  }
  if (split.kind === "one") return <SiteMap {...p} />;
  if (split.kind === "dispersed") {
    return <SiteMap {...p} note={`${p.map.sites.length} sites spread along ${fmtMi(Math.max(p.map.frame.w, p.map.frame.h))}, not one campground. Find a site to see where it is.`} />;
  }
  const { areas } = split;
  const open = new Set(p.openIds);
  const openIn = (a: Area) => a.sites.filter((s) => open.has(s)).length;
  const unplaced = unplacedSites(p.map.sites);
  const placedN = areas.reduce((n, a) => n + a.sites.length, 0);
  const sentence = `${placedN} sites in ${areas.length} areas, spread over ${fmtMi(Math.max(p.map.frame.w, p.map.frame.h) - 110)}.${unplaced.length ? ` ${unplaced.length} more ${unplaced.length === 1 ? "has" : "have"} no published location, so ${unplaced.length === 1 ? "it isn’t" : "they aren’t"} on any area’s map (${unplaced.slice(0, 4).join(", ")}${unplaced.length > 4 ? "…" : ""}).` : ""}`;
  // Find a site that's in another area: switch to it, then find it there.
  const findElsewhere = (q: string) => {
    const i = areas.findIndex((a) => a.sites.some((s) => s.toLowerCase() === q.toLowerCase() || s.replace(/^0+/, "") === q.replace(/^0+/, "")));
    if (i < 0) return false;
    if (layout === "pick") { setCurrent(i); setFindNext((f) => ({ q, n: (f?.n ?? 0) + 1 })); }
    else document.getElementById(`area-${i}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    return true;
  };

  const intro = (
    <section aria-labelledby="areas-h" className="mt-4 rounded-ch-card border border-ch-line bg-ch-card p-3 shadow-ch-card sm:mt-5 sm:p-6">
      <div className="px-1 sm:px-0">
        <h2 id="areas-h" className="font-ch-display text-[22px] font-extrabold tracking-[-.02em] text-ch-ink">Site map</h2>
        <p className="mt-1 max-w-[62ch] text-[15px] leading-snug text-ch-ink-2">{sentence}</p>
      </div>
      <div className={cx("mt-3 grid gap-4", layout === "pick" && "md:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] md:items-start")}>
        <Overview map={p.map} areas={areas} current={layout === "pick" ? current : null} onPick={layout === "pick" ? setCurrent : undefined} linkTo={layout === "stack" ? (i) => `#area-${i}` : undefined} />
        {layout === "pick" ? (
          <div role="group" aria-label="Areas" className="grid content-start gap-1.5">
            {areas.map((a, i) => (
              <button key={i} type="button" aria-pressed={i === current} onClick={() => setCurrent(i)}
                className={cx("flex min-h-11 items-center gap-2.5 rounded-ch-input border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green", i === current ? "border-ch-ink bg-ch-ink text-ch-white" : "border-ch-line bg-ch-card text-ch-ink hover:border-ch-muted")}>
                <span aria-hidden="true" className={cx("grid size-6 shrink-0 place-items-center rounded-full border-2 text-[12px] font-extrabold tabular-nums", i === current ? "border-ch-white" : "border-ch-ink")}>{i + 1}</span>
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold leading-tight">{a.name}</span><span className={cx("block text-[13px] leading-tight", i === current ? "text-ch-white" : "text-ch-ink-2")}>{a.sites.length} sites{p.picked ? ` · ${openIn(a)} open` : ""}</span></span>
              </button>
            ))}
          </div>
        ) : (
          <ol aria-label="Areas" className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((a, i) => (
              <li key={i}><a href={`#area-${i}`} className="flex min-h-11 items-center gap-2.5 rounded-ch-input px-1 text-[15px] font-bold text-ch-ink underline-offset-2 hover:underline">
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-ch-ink text-[12px] font-extrabold tabular-nums">{i + 1}</span>
                {a.name}<span className="font-normal text-ch-ink-2">{a.sites.length} sites{p.picked ? ` · ${openIn(a)} open` : ""}</span>
              </a></li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );

  if (layout === "pick") {
    const a = areas[current];
    return (
      <>
        {intro}
        <nav aria-label="Areas" className="mt-4 flex items-center justify-between gap-2 sm:mt-5">
          <button type="button" disabled={current === 0} onClick={() => setCurrent(current - 1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-ch-input px-2 text-[14px] font-bold text-ch-ink underline-offset-2 hover:underline disabled:cursor-default disabled:text-ch-muted disabled:no-underline focus-visible:outline-2 focus-visible:outline-ch-green"><ArrowLeft aria-hidden="true" className="size-4" />{current > 0 ? `Area ${current}` : "First area"}</button>
          <p className="text-[14px] text-ch-ink-2">Area {current + 1} of {areas.length}</p>
          <button type="button" disabled={current === areas.length - 1} onClick={() => setCurrent(current + 1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-ch-input px-2 text-[14px] font-bold text-ch-ink underline-offset-2 hover:underline disabled:cursor-default disabled:text-ch-muted disabled:no-underline focus-visible:outline-2 focus-visible:outline-ch-green">{current < areas.length - 1 ? `Area ${current + 2}` : "Last area"}<ArrowRight aria-hidden="true" className="size-4" /></button>
        </nav>
        <SiteMap key={current} {...p} map={areaMap(p.map, a)} name={`${p.name}, ${a.name}`} heading={`Area ${current + 1}: ${a.name}`} headingId="area-map-h"
          findElsewhere={findElsewhere} findOnMount={findNext?.q} />
      </>
    );
  }
  return (
    <>
      {intro}
      {areas.map((a, i) => (
        <div key={i} id={`area-${i}`} className="scroll-mt-4">
          <SiteMap {...p} map={areaMap(p.map, a)} name={`${p.name}, ${a.name}`} heading={`Area ${i + 1}: ${a.name}`} headingId={`area-${i}-h`} findElsewhere={findElsewhere} />
        </div>
      ))}
    </>
  );
}

/**
 * What a camper sees for a listing, in the look the owner picked (2026-10-08): one unit → where it
 * is (map and facts side by side, with terrain); several places → the overview, then one area at a
 * time; anything else → the site map.
 */
export function CamperMap(p: Props) {
  // A first-come campground booked as one "Standard" site: the campground and how to get a site
  // (the owner picked A, 2026-10-08; docs/design/campground-maps-first-come.md).
  if (isFirstCome(p.map)) return <FirstComeMap map={p.map} name={p.name} facts={p.map.firstCome ?? null} layout="glance" />;
  if (p.map.sites.length === 1) return <UnitMap map={p.map} name={p.name} provider={p.provider} layout="card" />;
  return <AreaMaps layout="pick" {...p} />;
}

// ---- Single units ----

export type UnitLayout = "card" | "wide";

const KIND: [RegExp, string][] = [[/lookout/i, "Fire lookout"], [/guard station|ranger station/i, "Guard station"], [/yurt/i, "Yurt"], [/cabin|homestead|hut/i, "Cabin"], [/group/i, "Group site"]];
const kindOf = (name: string, type: string) => KIND.find(([re]) => re.test(name))?.[1] ?? (/GROUP/.test(type) ? "Group site" : /CABIN/.test(type) ? "Cabin" : "Site");

/** A "road" a source tags as a path, track or named trail: drawn and counted as a trail. */
export const isFootway = (r: { name: string; cls: string }) => /trail|path|footway/i.test(`${r.cls} ${r.name}`);

/** The nearest mapped road and the nearest trail to a point: name (when the source names it) and
    straight-line distance. A road OpenStreetMap tags as a path or track is a trail here, so a
    lookout reached on foot never reads as "by the road". */
export function nearestWays(map: SiteMapData, at: [number, number]): { road: { name: string; m: number } | null; trail: { name: string; m: number } | null } {
  const near = (paths: { name: string; d: string }[]) => {
    let best: { name: string; m: number } | null = null;
    for (const r of paths) for (const [a, b] of segmentsOfPath(r.d)) {
      const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dy) / len)) : 0;
      const m = Math.hypot(at[0] - (a[0] + t * dx), at[1] - (a[1] + t * dy));
      if (!best || m < best.m) best = { name: r.name, m };
    }
    return best;
  };
  const footway = isFootway;
  return { road: near(map.roads.filter((r) => !footway(r))), trail: near([...map.trails.map((t) => ({ name: t.name, d: t.d })), ...map.roads.filter(footway)]) };
}

/** Metres on the map to [lat, lon], through the map's own bbox. */
export const latLon = (map: SiteMapData, [x, y]: [number, number]): [number, number] | null => {
  if (!map.bbox) return null;
  const [w, s, e, n] = map.bbox, f = map.frame;
  return [n - ((y - f.y) / f.h) * (n - s), w + ((x - f.x) / f.w) * (e - w)];
};

/** USGS 3DEP shaded relief (public domain) under a frame of the map, asked for live like the aerial
    photo; at most 2,000 px a side. Null when the map has no bbox. */
export function reliefUrl(map: SiteMapData, frame = map.frame, width = 1400): string | null {
  if (!map.bbox) return null;
  const nw = latLon(map, [frame.x, frame.y]), se = latLon(map, [frame.x + frame.w, frame.y + frame.h]);
  if (!nw || !se) return null;
  const w = Math.min(width, 2000), h = Math.min(2000, Math.round((w * frame.h) / frame.w));
  const q = new URLSearchParams({ bbox: [nw[1], se[0], se[1], nw[0]].join(","), bboxSR: "4326", imageSR: "3857", size: `${w},${h}`, format: "png", renderingRule: JSON.stringify({ rasterFunction: "Hillshade Gray" }), interpolation: "RSP_BilinearInterpolation", f: "image" });
  return `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?${q}`;
}

function UnitDrawing({ map, frame, label, className }: { map: SiteMapData; frame?: SiteMapData["frame"]; label: string; className?: string }) {
  const f = frame ?? map.frame, site = map.sites.find((s) => s.at);
  // Lighter than a campground's roads (critic round 1): here the ground is the subject.
  const s = Math.max(f.w, f.h) / 700 * 0.6;
  const relief = reliefUrl(map, f);
  const bar = scaleBar({ ...map, frame: f });
  const pct = ([x, y]: [number, number]) => ({ left: `${((x - f.x) / f.w) * 100}%`, top: `${((y - f.y) / f.h) * 100}%` });
  // The label goes on the side with no road or water name near it.
  const crowdedRight = site?.at ? map.labels.some((l) => l.at[0] > site.at![0] && l.at[0] - site.at![0] < f.w * 0.35 && Math.abs(l.at[1] - site.at![1]) < f.h * 0.08) : false;
  return (
    <div className={cx("relative isolate overflow-hidden rounded-ch-input border border-ch-line bg-ch-shell", className)} style={{ aspectRatio: `${f.w} / ${f.h}` }}>
      {/* USGS shaded relief multiplied onto the map's paper, light, so hills read without a colour of their own. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- a live service image, not ours to optimise */}
      {relief && <img src={relief} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover mix-blend-multiply brightness-125 contrast-50" />}
      <svg viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`} className="absolute inset-0 size-full" role="img" aria-label={`Map of the ground around the ${label.toLowerCase()}: roads, trails and water within ${fmtMi(f.w / 2)}, with the land’s shape shaded.`}>
        {map.water.map((w, i) => <path key={i} d={w.d} fillRule="evenodd" className="fill-ch-map-water" />)}
        {[...map.trails, ...map.roads.filter(isFootway)].map((t, i) => <path key={i} d={t.d} fill="none" className="stroke-ch-ink-2" strokeWidth={2.2 * s} strokeDasharray={`${8 * s} ${6 * s}`} strokeLinecap="round" />)}
        {map.roads.filter((r) => !isFootway(r)).map((r, i) => <path key={`c${i}`} d={r.d} fill="none" className="stroke-ch-muted" strokeWidth={(r.cls === "Service" ? 7 : 10) * s} strokeLinecap="round" strokeLinejoin="round" />)}
        {map.roads.filter((r) => !isFootway(r)).map((r, i) => <path key={`r${i}`} d={r.d} fill="none" className="stroke-ch-card" strokeWidth={(r.cls === "Service" ? 4.5 : 7) * s} strokeLinecap="round" strokeLinejoin="round" />)}
        {map.buildings.map((b, i) => <path key={i} d={b.d} className="fill-ch-faint" />)}
      </svg>
      {/* A name that would run into the pin or its label is left off: the pin is the point of the map. */}
      {map.labels.filter((l) => !site?.at || Math.abs(l.at[0] - site.at[0]) > f.w * 0.22 || Math.abs(l.at[1] - site.at[1]) > f.h * 0.09).map((l) => (
        <span key={l.text} aria-hidden="true" style={{ ...pct(l.at), transform: `translate(-50%, -50%) rotate(${l.angle}deg)` }}
          className={cx("pointer-events-none absolute whitespace-nowrap text-[11px] sm:text-[12px]", l.kind !== "water" && "gh-map-halo", l.kind === "water" ? "font-semibold italic text-ch-map-water-ink" : "font-bold text-ch-ink-2")}>{l.text}</span>
      ))}
      {site?.at && (
        <span aria-hidden="true" style={pct(site.at)} className="pointer-events-none absolute z-10">
          {/* The pin's tip is the published point. */}
          <svg viewBox="0 0 28 36" className="absolute h-9 w-7 -translate-x-1/2 -translate-y-full drop-shadow-[0_1px_1px_rgba(0,0,0,.25)]">
            <path d="M14 35C14 35 2 21.5 2 13.5a12 12 0 0 1 24 0C26 21.5 14 35 14 35Z" className="fill-ch-ink stroke-ch-card" strokeWidth="2" />
            <circle cx="14" cy="13.5" r="4.5" className="fill-ch-card" />
          </svg>
          <span className={cx("absolute top-[-30px] whitespace-nowrap rounded-[6px] bg-ch-ink px-1.5 py-0.5 text-[13px] font-extrabold text-ch-white", crowdedRight ? "right-[18px]" : "left-[18px]")}>{label}</span>
        </span>
      )}
      <div aria-hidden="true" className="pointer-events-none absolute bottom-2 left-2 inline-flex items-end gap-2.5 rounded-[7px] bg-ch-card px-2 py-1.5 text-[11px] font-bold leading-none text-ch-ink-2 shadow-ch-card">
        <svg viewBox="0 0 12 18" className="h-[18px] w-3"><path d="M6 0 L11 12 L6 9.5 L1 12 Z" className="fill-ch-ink-2" /><text x="6" y="18" textAnchor="middle" className="fill-ch-ink-2 text-[6.5px] font-extrabold">N</text></svg>
        <span className="grid gap-1"><span className="block h-[5px] border-x-2 border-b-2 border-ch-ink-2" style={{ width: `${(bar.metres / f.w) * 100}cqw` }} /><span className="tabular-nums">{bar.ft >= 1000 ? `${(bar.ft / 5280).toFixed(bar.ft % 5280 ? 1 : 0)} mi` : `${bar.ft} ft`}</span></span>
      </div>
    </div>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (<div className="grid gap-0.5"><dt className="text-[13px] font-bold text-ch-ink-2">{term}</dt><dd className="text-[15px] leading-snug text-ch-ink">{children}</dd></div>);
}

/** A single unit's location map: the one place, the ground around it, and how to find it. */
export function UnitMap({ map, name, provider, layout }: { map: SiteMapData; name: string; provider: string; layout: UnitLayout }) {
  const site = map.sites.find((s) => s.at) ?? map.sites[0];
  const kind = kindOf(name, site.type);
  const ways = site.at ? nearestWays(map, site.at) : { road: null, trail: null };
  // A trail is worth naming when it's the nearer way in (a lookout reached on foot).
  const trailFirst = ways.trail && (!ways.road || ways.trail.m < ways.road.m);
  const ll = site.at ? latLon(map, site.at) : null;
  const people = site.maxPeople ? `${kind === "Group site" ? "Up to" : "Sleeps up to"} ${site.maxPeople}` : null;
  const facts = (
    <dl className="grid content-start gap-3.5">
      <Fact term="What it is">{[`One ${kind.toLowerCase()}`, people && people.toLowerCase(), site.type.includes("ELECTRIC") && !site.type.includes("NONELECTRIC") ? "with electricity" : null].filter(Boolean).join(", ")}.</Fact>
      {trailFirst && ways.trail && <Fact term="Nearest trail on the map">{ways.trail.name ? <strong className="font-bold">{ways.trail.name}</strong> : "An unnamed trail"}, about {fmtMi(ways.trail.m)} away (straight line).</Fact>}
      <Fact term="Nearest road on the map">{ways.road ? <>{ways.road.name ? <strong className="font-bold">{ways.road.name}</strong> : "An unnamed road"}, about {fmtMi(ways.road.m)} away (straight line).</> : <>None within {fmtMi(map.frame.w / 2)}: check the access before you book.</>}</Fact>
      {ll && <Fact term="Where">
        <span className="tabular-nums">{ll[0].toFixed(5)}, {ll[1].toFixed(5)}</span>
        <a href={`https://www.google.com/maps/search/?api=1&query=${ll[0].toFixed(5)},${ll[1].toFixed(5)}`} target="_blank" rel="noreferrer" className="mt-1 flex min-h-11 items-center gap-1.5 font-bold text-ch-ink underline underline-offset-2">Open in a maps app<ExternalLink aria-hidden="true" className="size-4" /><span className="sr-only">(opens in a new tab)</span></a>
      </Fact>}
    </dl>
  );
  const credit = <p className="mt-4 px-1 text-[13px] leading-relaxed text-ch-muted sm:px-0">{map.credits ?? `Drawn by CampHawk from ${provider}’s published location (RIDB, CC BY 4.0).`} Terrain: USGS 3D Elevation Program (public domain). Roads and trails are for finding it, not directions: check the access before you go.</p>;
  return (
    <section aria-labelledby="unit-map-h" className="mt-4 rounded-ch-card border border-ch-line bg-ch-card p-3 shadow-ch-card sm:mt-5 sm:p-6">
      <div className="px-1 sm:px-0">
        <h2 id="unit-map-h" className="font-ch-display text-[22px] font-extrabold tracking-[-.02em] text-ch-ink">Where it is</h2>
        <p className="mt-1 text-[15px] text-ch-ink-2">This listing is one {kind.toLowerCase()}, so there’s no site to pick: the map shows where it is.</p>
      </div>
      {layout === "card" ? (
        <div className="mt-3 grid gap-5 px-1 sm:px-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-start">
          <UnitDrawing map={map} label={kind} className="w-full [container-type:inline-size]" />
          {facts}
        </div>
      ) : (
        <div className="relative mt-3">
          <UnitDrawing map={map} frame={{ x: map.frame.x, y: map.frame.y + map.frame.h * 0.2, w: map.frame.w, h: map.frame.h * 0.6 }} label={kind} className="w-full [container-type:inline-size]" />
          <div className="mt-3 rounded-ch-input border border-ch-line bg-ch-card p-4 md:absolute md:left-3 md:top-3 md:mt-0 md:w-[320px] md:shadow-ch-card">{facts}</div>
        </div>
      )}
      {credit}
    </section>
  );
}
