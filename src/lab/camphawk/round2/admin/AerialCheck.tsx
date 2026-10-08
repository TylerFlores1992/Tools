"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/cx";
import { pct, type SiteMapData } from "../maps";
import { segmentsOfPath } from "../maps/trace";
import { aerialSource, aerialUrl, NO_PHOTO } from "../maps/aerial";

// A map laid over the aerial photo of the same ground, so a reviewer can see whether the sites sit
// on real pads and the roads on real roads. The photo is public domain, picked per map by
// maps/aerial.ts (USDA NAIP, or the Forest Service's in Alaska), asked for live in Web Mercator with the map's own bbox and proportions; across a
// campground that lines up with the map's local metres to well under a pixel. Nothing from the
// photo is ever drawn on a camper's map: it is evidence for the reviewer, not a layer.


const ROAD_WORD: Record<string, string> = { nps: "the Park Service", osm: "OpenStreetMap", usfs: "the Forest Service", tiger: "the Census Bureau" };


export function AerialCheck({ map, name }: { map: SiteMapData; name: string }) {
  const [overlay, setOverlay] = useState(true);
  const [strength, setStrength] = useState(100);
  // Metres per CSS pixel on the drawn photo, so the site rings keep one size at any width.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const perPx = width ? map.frame.w / width : 0;
  const ring = width && width < 560 ? 3.5 : 5.5;
  const [numbers, setNumbers] = useState(false);
  const [photo, setPhoto] = useState<"loading" | "ready" | "error">("loading");
  // A photo already in the browser's cache can finish before React attaches onLoad.
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => { const el = img.current; if (el?.complete) setPhoto(el.naturalWidth ? "ready" : "error"); }, []);
  const f = map.frame;
  const placed = map.sites.filter((s): s is typeof s & { at: [number, number] } => s.at !== null);
  if (!map.bbox) return <p className="text-[14.5px] text-ch-ink-2">This map was built before aerial checks existed. Rebuild it to compare.</p>;
  const source = aerialSource({ facilityId: map.facilityId, bbox: map.bbox });
  const src = aerialUrl({ facilityId: map.facilityId, bbox: map.bbox }, f);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Toggle on={overlay} onChange={setOverlay}>Sites and roads on top</Toggle>
        <Toggle on={numbers} onChange={setNumbers} disabled={!overlay}>Site numbers</Toggle>
        <label className="flex min-h-11 items-center gap-2 text-[13.5px] font-bold text-ch-ink-2">
          Strength
          <input type="range" min={0} max={100} step={5} name="overlay-strength" value={strength} disabled={!overlay} onChange={(e) => setStrength(Number(e.target.value))}
            aria-valuetext={`${strength}%`} className="w-28 accent-ch-ink disabled:cursor-not-allowed" />
          <span aria-hidden="true" className="w-9 text-right font-normal tabular-nums text-ch-ink-2">{strength}%</span>
        </label>
        <p className="text-[13.5px] text-ch-muted sm:ml-auto">{placed.length} sites · {Math.round(f.w)} × {Math.round(f.h)} m</p>
      </div>
      {/* The photo fills the column: the decision rides along beside it (from lg), so a tall
          campground can scroll rather than shrink. */}
      <div ref={box} className="relative mt-3 overflow-hidden rounded-ch-input border border-ch-line bg-ch-shell" style={{ aspectRatio: `${f.w} / ${f.h}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a live service image, not ours to optimise */}
        {src && <img ref={img} src={src} width={1400} height={Math.round((1400 * f.h) / f.w)} alt={`Aerial photo of ${name} and the ground around it`} onLoad={() => setPhoto("ready")} onError={() => setPhoto("error")}
          className={cx("absolute inset-0 size-full object-fill transition-opacity duration-300", photo === "ready" ? "opacity-100" : "opacity-0")} />}
        {(photo !== "ready" || !source) && (
          <p role={photo === "error" ? "alert" : "status"} className="absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-[14.5px] text-ch-ink-2">
            {!source ? NO_PHOTO : photo === "error" ? `The aerial photo didn’t load. ${source.host} may be busy; try again in a minute.` : "Loading the aerial photo…"}
          </p>
        )}
        {overlay && (
          <svg aria-hidden="true" viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`} preserveAspectRatio="none" className="absolute inset-0 size-full" style={{ opacity: strength / 100 }}>
            {/* Told from the roads by shape (dashes), not by a colour that means something else in CampHawk. */}
            {map.evidence?.outline && <path d={map.evidence.outline} fill="none" className="stroke-ch-ink" strokeOpacity={0.7} strokeWidth={4} strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />}
            {map.evidence?.outline && <path d={map.evidence.outline} fill="none" className="stroke-ch-white" strokeWidth={2} strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />}
            {map.roads.map((r, i) => <path key={`c${i}`} d={r.d} fill="none" className="stroke-ch-ink" strokeOpacity={r.traced ? 1 : 0.7} strokeWidth={r.traced ? 5 : 4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            {/* Traced roads in ochre (the reviewer's own), with a square at each end as in the tracing tool. */}
            {map.roads.map((r, i) => <path key={`r${i}`} d={r.d} fill="none" className={r.traced ? "stroke-ch-ochre" : "stroke-ch-white"} strokeWidth={r.traced ? 2.5 : 1.75} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            {perPx > 0 && map.roads.filter((r) => r.traced).flatMap((r, i) => {
              const segs = segmentsOfPath(r.d);
              if (!segs.length) return [];
              const v = 6 * perPx;
              return [segs[0][0], segs.at(-1)![1]].map((p, j) => <rect key={`e${i}-${j}`} x={p[0] - v / 2} y={p[1] - v / 2} width={v} height={v} className="fill-ch-ochre stroke-ch-ink" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />);
            })}
            {/* Thin hollow rings, so the pad under each site stays visible: 11px across, 7px on a phone,
                where a big campground's rings would otherwise cover the pads they mark. */}
            {/* A site a person moved: a dashed line from where Recreation.gov puts it, and a dashed ring there. */}
            {perPx > 0 && placed.filter((s) => s.movedFrom).map((s) => <g key={`mv${s.name}`}>
              <line x1={s.movedFrom![0]} y1={s.movedFrom![1]} x2={s.at[0]} y2={s.at[1]} className="stroke-ch-white" strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
              <circle cx={s.movedFrom![0]} cy={s.movedFrom![1]} r={ring * perPx} fill="none" className="stroke-ch-white" strokeWidth={1.5} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            </g>)}
            {perPx > 0 && placed.map((s) => <circle key={`k${s.name}`} cx={s.at[0]} cy={s.at[1]} r={ring * perPx} fill="none" className="stroke-ch-ink" strokeOpacity={0.75} strokeWidth={2.75} vectorEffect="non-scaling-stroke" />)}
            {perPx > 0 && placed.map((s) => <circle key={`w${s.name}`} cx={s.at[0]} cy={s.at[1]} r={ring * perPx} fill="none" className="stroke-ch-white" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />)}
          </svg>
        )}
        {overlay && numbers && strength > 0 && placed.map((s) => {
          const p = pct(map, s.at);
          return <span key={s.name} aria-hidden="true" style={{ left: p.left, top: p.top }} className="pointer-events-none absolute ml-[6px] -translate-y-1/2 text-[11px] font-extrabold leading-none tabular-nums text-ch-white [paint-order:stroke] [-webkit-text-stroke:2.5px_var(--color-ch-ink)]">{s.name}</span>;
        })}
      </div>
      <ul aria-label="What’s drawn on the photo" className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-ch-ink-2">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="size-[10px] rounded-full border-2 border-ch-white shadow-[0_0_0_1.5px_var(--color-ch-ink)]" />Sites, where Recreation.gov places them</li>
        {map.roads.some((r) => !r.traced) && <li className="flex items-center gap-2"><span aria-hidden="true" className="h-[5px] w-6 rounded-full border border-ch-ink bg-ch-white" />Roads from {ROAD_WORD[map.sources?.roads ?? "none"] ?? "the map’s sources"}</li>}
        {placed.some((s) => s.movedFrom) && <li className="flex items-center gap-2"><span aria-hidden="true" className="w-6 border-t-2 border-dashed border-ch-ink" />Sites moved to where the photo shows them, from the dashed ring</li>}
        {map.roads.some((r) => r.traced) && <li className="flex items-center gap-2"><TracedMark />Roads traced from this photo, a square at each end</li>}
        {map.evidence?.outline && <li className="flex items-center gap-2"><span aria-hidden="true" className="w-6 border-t-[3px] border-dashed border-ch-ink" />OpenStreetMap’s campground outline</li>}
        {source && <li className="text-ch-muted">Photo: {source.short}</li>}
      </ul>
    </div>
  );
}

/** The key's mark for a traced road: an ochre line with a square at its end. */
export function TracedMark() {
  return <span aria-hidden="true" className="relative h-[6px] w-7 rounded-full border border-ch-ink bg-ch-ochre"><span className="absolute -top-[3px] -right-[2px] size-[10px] rounded-[2px] border-[1.5px] border-ch-ink bg-ch-ochre" /></span>;
}

function Toggle({ on, onChange, disabled, children }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: string }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={() => onChange(!on)}
      className={cx("inline-flex min-h-11 items-center gap-2 rounded-ch-chip border px-3.5 text-[13.5px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green disabled:cursor-not-allowed disabled:border-ch-line disabled:bg-ch-shell disabled:text-ch-muted",
        on ? "border-ch-ink bg-ch-ink text-ch-white" : "border-ch-line bg-ch-card text-ch-ink-2 hover:border-ch-muted")}>
      <span aria-hidden="true" className={cx("grid size-4 place-items-center rounded-[4px] border text-[11px] leading-none", on ? "border-ch-white" : "border-ch-muted")}>{on ? "✓" : ""}</span>
      {children}
    </button>
  );
}
