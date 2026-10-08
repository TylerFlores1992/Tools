"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { cx } from "@/components/cx";
import { SiteMap } from "./SiteMap";
import { siteTypeLabel, type SiteMapData } from "./maps";
import { segmentsOfPath } from "./maps/trace";
import { areaMap, splitAreas, type Area } from "./maps/areas";

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

const fmtMi = (m: number) => { const mi = m / 1609.34; return mi < 0.1 ? `${Math.round(m * 3.28084 / 10) * 10} ft` : `${mi < 1 ? mi.toFixed(1) : mi.toFixed(1)} mi`; };

/** The listing's whole frame, drawn small: water, roads, a dot per site, each area outlined. */
function Overview({ map, areas, current, onPick, linkTo }: { map: SiteMapData; areas: Area[]; current: number | null; onPick?: (i: number) => void; linkTo?: (i: number) => string }) {
  // Never thinner than 1:2, so a listing strung along a shore still has room for its numbers.
  const g = map.frame, f = { ...g };
  if (f.w < f.h / 2) { f.x -= (f.h / 2 - f.w) / 2; f.w = f.h / 2; }
  if (f.h < f.w / 2) { f.y -= (f.w / 2 - f.h) / 2; f.h = f.w / 2; }
  const s = Math.max(f.w, f.h) / 600; // stroke scale: about 1px at 600px across
  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-ch-input border border-ch-line bg-ch-shell" style={{ aspectRatio: `${f.w} / ${f.h}`, maxWidth: `min(100%, calc(380px * ${(f.w / f.h).toFixed(3)}))` }}>
      <svg viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`} className="absolute inset-0 size-full" aria-hidden="true">
        {map.water.map((w, i) => <path key={i} d={w.d} fillRule="evenodd" className="fill-ch-map-water" />)}
        {map.roads.map((r, i) => <path key={i} d={r.d} fill="none" className="stroke-ch-muted" strokeWidth={2.2 * s} strokeLinecap="round" strokeLinejoin="round" />)}
        {map.sites.filter((x) => x.at).map((x) => <path key={x.name} d={`M${x.at![0]} ${x.at![1]}h0`} className="stroke-ch-ink-2" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
        {areas.map((a, i) => (
          <rect key={i} x={a.frame.x} y={a.frame.y} width={a.frame.w} height={a.frame.h} rx={18 * s} fill="none"
            className="stroke-ch-ink" strokeWidth={i === current ? 3 : 1.5} strokeDasharray={i === current ? undefined : "6 5"} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {areas.map((a, i) => {
        // Each number at its area's middle, where it can't be read as belonging to the next area.
        const left = `${((a.center[0] - f.x) / f.w) * 100}%`, top = `${((a.center[1] - f.y) / f.h) * 100}%`;
        const badge = cx("absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-ch-ink text-[13px] font-extrabold tabular-nums shadow-ch-card", i === current ? "bg-ch-ink text-ch-white" : "bg-ch-card text-ch-ink");
        const label = `Area ${i + 1}: ${a.name}`;
        return onPick
          ? <button key={i} type="button" aria-label={label} aria-pressed={i === current} onClick={() => onPick(i)} style={{ left, top }} className={cx(badge, "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green")}><span aria-hidden="true">{i + 1}</span></button>
          : linkTo ? <a key={i} href={linkTo(i)} aria-label={label} style={{ left, top }} className={cx(badge, "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green")}><span aria-hidden="true">{i + 1}</span></a>
          : <span key={i} aria-hidden="true" style={{ left, top }} className={badge}>{i + 1}</span>;
      })}
    </div>
  );
}

/** A listing's site map, split into areas when it's several places (else the ordinary map). */
export function AreaMaps({ layout, ...p }: Props & { layout: SplitLayout }) {
  const split = useMemo(() => splitAreas(p.map.sites), [p.map]);
  const [current, setCurrent] = useState(0);
  const [findNext, setFindNext] = useState<{ q: string; n: number } | null>(null);
  if (split.kind === "one") return <SiteMap {...p} />;
  if (split.kind === "dispersed") {
    return <SiteMap {...p} note={`${p.map.sites.length} sites spread along ${fmtMi(Math.max(p.map.frame.w, p.map.frame.h))}, not one campground. Find a site to see where it is.`} />;
  }
  const { areas } = split;
  const open = new Set(p.openIds);
  const openIn = (a: Area) => a.sites.filter((s) => open.has(s)).length;
  const sentence = `${p.map.sites.length} sites in ${areas.length} areas, spread over ${fmtMi(Math.max(p.map.frame.w, p.map.frame.h) - 110)}. The numbers on the overview match the areas below.`;
  // Find a site that's in another area: switch to it, then find it there.
  const findElsewhere = (q: string) => {
    const i = areas.findIndex((a) => a.sites.some((s) => s.toLowerCase() === q.toLowerCase() || s.replace(/^0+/, "") === q.replace(/^0+/, "")));
    if (i < 0) return false;
    if (layout === "pick") { setCurrent(i); setFindNext({ q, n: Date.now() }); }
    else document.getElementById(`area-${i}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    return true;
  };

  const intro = (
    <section aria-labelledby="areas-h" className="mt-4 rounded-ch-card border border-ch-line bg-ch-card p-3 shadow-ch-card sm:mt-5 sm:p-6">
      <div className="px-1 sm:px-0">
        <h2 id="areas-h" className="font-ch-display text-[22px] font-extrabold tracking-[-.02em] text-ch-ink">Site map</h2>
        <p className="mt-1 max-w-[62ch] text-[15px] leading-snug text-ch-ink-2">{sentence}</p>
      </div>
      <div className={cx("mt-3 grid gap-4", layout === "pick" && "lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start")}>
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
        <SiteMap key={current} {...p} map={areaMap(p.map, a)} name={`${p.name}, ${a.name}`} heading={`${current + 1} · ${a.name}`} headingId="area-map-h"
          findElsewhere={findElsewhere} findOnMount={findNext?.q} />
      </>
    );
  }
  return (
    <>
      {intro}
      {areas.map((a, i) => (
        <div key={i} id={`area-${i}`} className="scroll-mt-4">
          <SiteMap {...p} map={areaMap(p.map, a)} name={`${p.name}, ${a.name}`} heading={`${i + 1} · ${a.name}`} headingId={`area-${i}-h`} findElsewhere={findElsewhere} />
        </div>
      ))}
    </>
  );
}

// ---- Single units ----

export type UnitLayout = "card" | "wide";

const KIND: [RegExp, string][] = [[/lookout/i, "Fire lookout"], [/guard station|ranger station/i, "Guard station"], [/yurt/i, "Yurt"], [/cabin|homestead|hut/i, "Cabin"], [/group/i, "Group site"]];
const kindOf = (name: string, type: string) => KIND.find(([re]) => re.test(name))?.[1] ?? (/GROUP/.test(type) ? "Group site" : /CABIN/.test(type) ? "Cabin" : "Site");

/** The nearest mapped road to a point: its name (when the source names it) and straight-line distance. */
export function nearestRoad(map: SiteMapData, at: [number, number]): { name: string; m: number } | null {
  let best: { name: string; m: number } | null = null;
  for (const r of map.roads) for (const [a, b] of segmentsOfPath(r.d)) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dy) / len)) : 0;
    const m = Math.hypot(at[0] - (a[0] + t * dx), at[1] - (a[1] + t * dy));
    if (!best || m < best.m) best = { name: r.name, m };
  }
  return best;
}

/** Metres on the map to [lat, lon], through the map's own bbox. */
const latLon = (map: SiteMapData, [x, y]: [number, number]): [number, number] | null => {
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
  const q = new URLSearchParams({ bbox: [nw[1], se[0], se[1], nw[0]].join(","), bboxSR: "4326", imageSR: "3857", size: `${w},${h}`, format: "png", renderingRule: JSON.stringify({ rasterFunction: "Hillshade Gray" }), f: "image" });
  return `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?${q}`;
}

function UnitDrawing({ map, frame, label, terrain, className }: { map: SiteMapData; frame?: SiteMapData["frame"]; label: string; terrain?: boolean; className?: string }) {
  const f = frame ?? map.frame, site = map.sites.find((s) => s.at);
  const s = Math.max(f.w, f.h) / 700;
  const relief = terrain ? reliefUrl(map, f) : null;
  return (
    <div className={cx("relative isolate overflow-hidden rounded-ch-input border border-ch-line bg-ch-shell", className)} style={{ aspectRatio: `${f.w} / ${f.h}` }}>
      {/* The ground's shape, multiplied onto the paper so hills read without a colour of their own. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- a live service image, not ours to optimise */}
      {relief && <img src={relief} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover opacity-60 mix-blend-multiply" />}
      <svg viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`} className="absolute inset-0 size-full" role="img" aria-label={`Map of the ground around ${label}: roads, trails and water within ${fmtMi(f.w / 2)}.`}>
        {map.water.map((w, i) => <path key={i} d={w.d} fillRule="evenodd" className="fill-ch-map-water" />)}
        {map.trails.map((t, i) => <path key={i} d={t.d} fill="none" className="stroke-ch-muted" strokeWidth={1.6 * s} strokeDasharray={`${6 * s} ${5 * s}`} strokeLinecap="round" />)}
        {map.roads.map((r, i) => <path key={`c${i}`} d={r.d} fill="none" className="stroke-ch-muted" strokeWidth={(r.cls === "Service" ? 7 : 10) * s} strokeLinecap="round" strokeLinejoin="round" />)}
        {map.roads.map((r, i) => <path key={`r${i}`} d={r.d} fill="none" className="stroke-ch-card" strokeWidth={(r.cls === "Service" ? 4.5 : 7) * s} strokeLinecap="round" strokeLinejoin="round" />)}
        {map.buildings.map((b, i) => <path key={i} d={b.d} className="fill-ch-faint" />)}
      </svg>
      {map.labels.map((l) => (
        <span key={l.text} aria-hidden="true" style={{ left: `${((l.at[0] - f.x) / f.w) * 100}%`, top: `${((l.at[1] - f.y) / f.h) * 100}%`, transform: `translate(-50%, -50%) rotate(${l.angle}deg)` }}
          className={cx("pointer-events-none absolute whitespace-nowrap text-[11px] sm:text-[12px]", l.kind !== "water" && "gh-map-halo", l.kind === "water" ? "font-semibold italic text-ch-map-water-ink" : "font-bold text-ch-ink-2")}>{l.text}</span>
      ))}
      {site?.at && (
        <span aria-hidden="true" style={{ left: `${((site.at[0] - f.x) / f.w) * 100}%`, top: `${((site.at[1] - f.y) / f.h) * 100}%` }} className="pointer-events-none absolute">
          <span className="absolute grid size-9 -translate-x-1/2 -translate-y-full place-items-center rounded-full rounded-br-none bg-ch-ink text-ch-white shadow-ch-card [transform:translate(-50%,-100%)_rotate(45deg)]"><MapPin className="size-4 -rotate-45" /></span>
          <span className="absolute left-5 top-[-34px] whitespace-nowrap rounded-[6px] bg-ch-ink px-1.5 py-0.5 text-[13px] font-extrabold text-ch-white">{label}</span>
        </span>
      )}
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
  const road = site.at ? nearestRoad(map, site.at) : null;
  const ll = site.at ? latLon(map, site.at) : null;
  const people = site.maxPeople ? `${kind === "Group site" ? "Up to" : "Sleeps up to"} ${site.maxPeople}` : null;
  const facts = (
    <dl className="grid content-start gap-3.5">
      <Fact term="What it is">{[`One ${kind.toLowerCase()}`, people && people.toLowerCase(), siteTypeLabel(site.type) && site.type.includes("ELECTRIC") && !site.type.includes("NONELECTRIC") ? "with electricity" : null].filter(Boolean).join(", ")}.</Fact>
      {road && <Fact term="Nearest road on the map">{road.name ? <><strong className="font-bold">{road.name}</strong>, </> : "An unnamed road, "}about {fmtMi(road.m)} away (straight line).</Fact>}
      {ll && <Fact term="Where">
        <span className="tabular-nums">{ll[0].toFixed(5)}, {ll[1].toFixed(5)}</span>
        <a href={`https://www.google.com/maps/search/?api=1&query=${ll[0].toFixed(5)},${ll[1].toFixed(5)}`} target="_blank" rel="noreferrer" className="mt-1 flex min-h-11 items-center gap-1.5 font-bold text-ch-ink underline underline-offset-2">Open in a maps app<ExternalLink aria-hidden="true" className="size-4" /><span className="sr-only">(opens in a new tab)</span></a>
      </Fact>}
    </dl>
  );
  const credit = <p className="mt-4 px-1 text-[13px] leading-relaxed text-ch-muted sm:px-0">{map.credits ?? `Drawn by CampHawk from ${provider}’s published location (RIDB, CC BY 4.0).`}{layout === "wide" ? " Terrain: USGS 3D Elevation Program (public domain)." : ""} Roads and trails are for finding it, not directions: check the access before you go.</p>;
  return (
    <section aria-labelledby="unit-map-h" className="mt-4 rounded-ch-card border border-ch-line bg-ch-card p-3 shadow-ch-card sm:mt-5 sm:p-6">
      <div className="px-1 sm:px-0">
        <h2 id="unit-map-h" className="font-ch-display text-[22px] font-extrabold tracking-[-.02em] text-ch-ink">Where it is</h2>
        <p className="mt-1 text-[15px] text-ch-ink-2">This listing is one {kind.toLowerCase()}, so there’s no site to pick: the map shows where it is.</p>
      </div>
      {layout === "card" ? (
        <div className="mt-3 grid gap-5 px-1 sm:px-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-start">
          <UnitDrawing map={map} label={kind} className="w-full" />
          {facts}
        </div>
      ) : (
        <div className="relative mt-3">
          <UnitDrawing map={map} frame={{ x: map.frame.x, y: map.frame.y + map.frame.h * 0.2, w: map.frame.w, h: map.frame.h * 0.6 }} label={kind} terrain className="w-full" />
          <div className="mt-3 rounded-ch-input border border-ch-line bg-ch-card p-4 md:absolute md:left-3 md:top-3 md:mt-0 md:w-[320px] md:shadow-ch-card">{facts}</div>
        </div>
      )}
      {credit}
    </section>
  );
}
