"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/cx";
import { pct, type SiteMapData } from "../maps";

// A map laid over the aerial photo of the same ground, so a reviewer can see whether the sites sit
// on real pads and the roads on real roads. The photo is USDA NAIP (public domain) from USGS The
// National Map, asked for live in Web Mercator with the map's own bbox and proportions; across a
// campground that lines up with the map's local metres to well under a pixel. Nothing from the
// photo is ever drawn on a camper's map: it is evidence for the reviewer, not a layer.

const NAIP = "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage";

export function naipUrl(bbox: [number, number, number, number], frame: { w: number; h: number }, width = 1400): string {
  const height = Math.round((width * frame.h) / frame.w);
  const q = new URLSearchParams({ bbox: bbox.join(","), bboxSR: "4326", imageSR: "3857", size: `${width},${height}`, format: "jpg", f: "image" });
  return `${NAIP}?${q}`;
}

export function AerialCheck({ map, name }: { map: SiteMapData; name: string }) {
  const [overlay, setOverlay] = useState(true);
  const [numbers, setNumbers] = useState(false);
  const [photo, setPhoto] = useState<"loading" | "ready" | "error">("loading");
  // A photo already in the browser's cache can finish before React attaches onLoad.
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => { const el = img.current; if (el?.complete) setPhoto(el.naturalWidth ? "ready" : "error"); }, []);
  const f = map.frame;
  const placed = map.sites.filter((s): s is typeof s & { at: [number, number] } => s.at !== null);
  if (!map.bbox) return <p className="text-[14.5px] text-ch-ink-2">This map was built before aerial checks existed. Rebuild it to compare.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Toggle on={overlay} onChange={setOverlay}>Sites and roads on top</Toggle>
        <Toggle on={numbers} onChange={setNumbers} disabled={!overlay}>Site numbers</Toggle>
        <p className="text-[13.5px] text-ch-muted sm:ml-auto">{placed.length} sites · {Math.round(f.w)} × {Math.round(f.h)} m</p>
      </div>
      {/* A tall campground would draw taller than the screen: the width is capped so the photo
          stays near 85% of the viewport's height, centred. */}
      <div className="relative mx-auto mt-3 overflow-hidden rounded-ch-input border border-ch-line bg-ch-shell" style={{ aspectRatio: `${f.w} / ${f.h}`, width: `min(100%, calc(85svh * ${(f.w / f.h).toFixed(3)}))` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a live service image, not ours to optimise */}
        <img ref={img} src={naipUrl(map.bbox, f)} alt={`Aerial photo of ${name} and the ground around it`} onLoad={() => setPhoto("ready")} onError={() => setPhoto("error")}
          className={cx("absolute inset-0 size-full object-fill transition-opacity duration-300", photo === "ready" ? "opacity-100" : "opacity-0")} />
        {photo !== "ready" && (
          <p role={photo === "error" ? "alert" : "status"} className="absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-[14.5px] text-ch-ink-2">
            {photo === "error" ? "The aerial photo didn’t load. USGS’s imagery service may be busy; try again in a minute." : "Loading the aerial photo…"}
          </p>
        )}
        {overlay && (
          <svg aria-hidden="true" viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`} preserveAspectRatio="none" className="absolute inset-0 size-full">
            {/* Told from the roads by shape (dashes), not by a colour that means something else in CampHawk. */}
            {map.evidence?.outline && <path d={map.evidence.outline} fill="none" className="stroke-ch-ink" strokeOpacity={0.7} strokeWidth={4} strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />}
            {map.evidence?.outline && <path d={map.evidence.outline} fill="none" className="stroke-ch-white" strokeWidth={2} strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />}
            {map.roads.map((r, i) => <path key={`c${i}`} d={r.d} fill="none" className="stroke-ch-ink" strokeOpacity={0.7} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            {map.roads.map((r, i) => <path key={`r${i}`} d={r.d} fill="none" className="stroke-ch-white" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            <path d={placed.map((s) => `M${s.at[0]} ${s.at[1]}h0`).join("")} className="stroke-ch-ink" strokeWidth={9} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={placed.map((s) => `M${s.at[0]} ${s.at[1]}h0`).join("")} className="stroke-ch-white" strokeWidth={5.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        )}
        {overlay && numbers && placed.map((s) => {
          const p = pct(map, s.at);
          return <span key={s.name} aria-hidden="true" style={{ left: p.left, top: p.top }} className="pointer-events-none absolute ml-[6px] -translate-y-1/2 text-[11px] font-extrabold leading-none tabular-nums text-ch-white [paint-order:stroke] [-webkit-text-stroke:2.5px_var(--color-ch-ink)]">{s.name}</span>;
        })}
      </div>
      <ul aria-label="What’s drawn on the photo" className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-ch-ink-2">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="size-[9px] rounded-full border-2 border-ch-ink bg-ch-white" />Sites, where Recreation.gov places them</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-[5px] w-6 rounded-full border border-ch-ink bg-ch-white" />Roads the map draws</li>
        {map.evidence?.outline && <li className="flex items-center gap-2"><span aria-hidden="true" className="w-6 border-t-[3px] border-dashed border-ch-ink" />OpenStreetMap’s campground outline</li>}
        <li className="text-ch-muted">Photo: USDA NAIP via USGS (public domain)</li>
      </ul>
    </div>
  );
}

function Toggle({ on, onChange, disabled, children }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: string }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={() => onChange(!on)}
      className={cx("inline-flex min-h-10 items-center gap-2 rounded-ch-chip border px-3.5 text-[13.5px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green disabled:cursor-not-allowed disabled:opacity-50",
        on ? "border-ch-ink bg-ch-ink text-ch-white" : "border-ch-line bg-ch-card text-ch-ink-2 hover:border-ch-muted")}>
      <span aria-hidden="true" className={cx("grid size-4 place-items-center rounded-[4px] border text-[11px] leading-none", on ? "border-ch-white" : "border-ch-muted")}>{on ? "✓" : ""}</span>
      {children}
    </button>
  );
}
