"use client";

import { useEffect, useRef, useState } from "react";
import { Bus, ExternalLink, Info, Toilet } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../ui";
import { dayLabel } from "./campground-data";
import { isWaymark, nearestRestroomFt, pct, restrooms, scaleBar, siteTypeLabel, type MapSite, type SiteMapData } from "./maps";

// The campground's own site map, drawn by CampHawk from public data (no provider map image is
// copied or traced): site points from Recreation.gov's RIDB, roads, restrooms and parking from the
// Park Service's GIS, the river from USGS. Build: studio/campground-maps/. What it keeps:
// - State is never colour alone. An open site is a green pin with a tick and its number in
//   words; every other site is a plain dot. The picked site grows and gets an ink ring.
// - Only the sites that are open on the picked night are buttons. The map adds "where", the day
//   panel stays the list, so nothing is reachable only by pointing at a picture.
// - It never claims more than the data: distances are straight lines, said so, and a fact RIDB
//   leaves blank (or writes as 0) isn't shown.

const ICON = "absolute grid size-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[4px] bg-ch-ink-2 text-ch-white shadow-ch-card sm:size-[22px] sm:rounded-[6px]";
const GLYPH = "size-2.5 sm:size-3.5";
/** A legend swatch: the same symbol, sitting in the text flow. */
const KEY_ICON = "grid size-[22px] place-items-center rounded-[6px] bg-ch-ink-2 text-ch-white";

/** The map's drawn width in CSS pixels, so labels can be thinned to what fits at that size. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Waymark numbers that fit: greedy, in site order, each at least `gap` px from every symbol,
    open pin, name and earlier number. Before the first measure, none (the dots still show). */
function fittingWaymarks(map: SiteMapData, sites: (MapSite & { at: [number, number] })[], taken: [number, number][], px: number): Set<string> {
  const out = new Set<string>();
  if (!px) return out;
  const scale = px / map.frame.w; // px per metre
  const gap = 26 / scale;
  const placed = [...taken];
  for (const s of sites) {
    if (!isWaymark(s.name)) continue;
    if (placed.some(([x, y]) => Math.hypot(x - s.at[0], y - s.at[1]) < gap)) continue;
    out.add(s.name);
    placed.push(s.at);
  }
  return out;
}

export function SiteMap({ map, name, provider, picked, openIds, selectedId, onSelect, note }: {
  map: SiteMapData;
  name: string;
  provider: string;
  /** The night whose open sites are shown, or null for a plain map. */
  picked: string | null;
  openIds: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Says why no sites are marked (first come, an unread month…). */
  note?: string;
}) {
  const f = map.frame;
  const open = new Set(openIds);
  const placed = map.sites.filter((s): s is MapSite & { at: [number, number] } => s.at !== null);
  const openSites = placed.filter((s) => open.has(s.name));
  const selected = openSites.find((s) => s.name === selectedId) ?? null;
  const bar = scaleBar(map);
  const kiosk = map.buildings.find((b) => b.type === "Kiosk");
  const kioskAt = kiosk ? centroid(kiosk.d) : null;
  const shuttle = map.pois.find((p) => /shuttle/i.test(p.type));
  const parking = map.pois.filter((p) => p.type === "Parking Lot");
  const [box, px] = useWidth<HTMLDivElement>();
  const symbols: [number, number][] = [...restrooms(map).map((r) => r.at), ...parking.map((p) => p.at), ...(shuttle ? [shuttle.at] : []), ...(kioskAt ? [kioskAt] : []), ...map.labels.map((l) => l.at), ...openSites.map((s) => s.at)];
  // An open pin's number sits to its right: keep waymarks clear of that too.
  if (px) for (const s of openSites) symbols.push([s.at[0] + (40 * map.frame.w) / px, s.at[1] - (14 * map.frame.w) / px]);
  const waymarks = fittingWaymarks(map, placed.filter((s) => !open.has(s.name)), symbols, px);
  const summary = `Map of ${name}: ${placed.length} campsites along the campground roads, ${restrooms(map).length} restrooms` +
    (picked ? `. ${openSites.length ? `${openSites.length} open on ${dayLabel(picked)}: ${openSites.map((s) => s.name).join(", ")}` : `None open on ${dayLabel(picked)}`}.` : ".");

  return (
    <section aria-labelledby="site-map-h" className="mt-4 rounded-ch-card border border-ch-line bg-ch-card p-3 shadow-ch-card sm:mt-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-1 sm:px-0">
        <h2 id="site-map-h" className="font-ch-display text-[22px] font-extrabold tracking-[-.02em] text-ch-ink">Site map</h2>
        <p aria-live="polite" className="text-[15px] text-ch-ink-2">
          {note ?? (picked
            ? openSites.length ? <><strong className="font-bold text-ch-ink">{openSites.length} open</strong> on {dayLabel(picked)}{openSites.length === 1 ? "" : ". Tap one for its details"}.</> : `Nothing open on ${dayLabel(picked)}.`
            : "Pick an open day on the calendar to see its sites here.")}
        </p>
      </div>

      <div className="mt-3 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
        <figure className="m-0">
          <div ref={box} className="relative overflow-hidden rounded-ch-input border border-ch-line bg-ch-shell [container-type:inline-size]" style={{ aspectRatio: `${f.w} / ${f.h}` }}>
            <svg role="img" aria-label={summary} viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`} className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid meet">
              {map.water.map((w, i) => <path key={i} d={w.d} className="fill-ch-map-water" />)}
              {map.lots.map((l, i) => <path key={i} d={l.d} className="fill-ch-line stroke-ch-faint" strokeWidth={1} />)}
              {map.trails.map((t, i) => <path key={i} d={t.d} fill="none" className="stroke-ch-muted" strokeWidth={1.6} strokeDasharray="5 4" strokeLinecap="round" />)}
              {/* Roads: a soft casing under a white fill, in metres, so they scale with the map. */}
              {map.roads.map((r, i) => <path key={`c${i}`} d={r.d} fill="none" className="stroke-ch-faint" strokeWidth={r.cls === "Service" ? 8.5 : 12} strokeLinecap="round" strokeLinejoin="round" />)}
              {map.roads.map((r, i) => <path key={`r${i}`} d={r.d} fill="none" className="stroke-ch-card" strokeWidth={r.cls === "Service" ? 6 : 9} strokeLinecap="round" strokeLinejoin="round" />)}
              {map.buildings.map((b, i) => <path key={i} d={b.d} className="fill-ch-ink-2" />)}
              {/* Sites: a dot of fixed screen size (a zero-length round-capped line), whatever the zoom. */}
              {placed.filter((s) => !open.has(s.name)).map((s) => (
                <path key={s.name} d={`M${s.at[0]} ${s.at[1]}h0`} className="stroke-ch-ink-2" strokeWidth={picked ? 4.5 : 5.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={picked ? 0.55 : 1} />
              ))}
            </svg>

            {/* Labels and symbols sit over the drawing in HTML, so their type stays a readable size. */}
            {map.labels.map((l) => (
              <span key={l.text} aria-hidden="true" style={{ ...pct(map, l.at), transform: `translate(-50%, -50%) rotate(${l.angle}deg)` }}
                className={cx("pointer-events-none absolute whitespace-nowrap text-[11px] sm:text-[12px]", l.kind === "water" ? "font-semibold italic text-ch-map-water-ink" : l.kind === "trail" ? "text-ch-ink-2" : "font-bold text-ch-ink-2")}>
                {l.text}
              </span>
            ))}
            {placed.filter((s) => waymarks.has(s.name)).map((s) => (
              <span key={s.name} aria-hidden="true" style={pct(map, s.at)} className="pointer-events-none absolute -translate-x-1/2 translate-y-[3px] text-[10px] font-bold tabular-nums text-ch-ink-2 sm:text-[11px]">{s.name}</span>
            ))}
            {restrooms(map).map((r, i) => <span key={i} aria-hidden="true" style={pct(map, r.at)} className={ICON}><Toilet className={GLYPH} /></span>)}
            {parking.map((p, i) => <span key={i} aria-hidden="true" style={pct(map, p.at)} className={cx(ICON, "text-[10px] font-extrabold sm:text-[13px]")}>P</span>)}
            {shuttle && <span aria-hidden="true" style={pct(map, shuttle.at)} className={ICON}><Bus className={GLYPH} /></span>}
            {kioskAt && <span aria-hidden="true" style={pct(map, kioskAt)} className={ICON}><Info className={GLYPH} /></span>}

            {openSites.map((s) => {
              const on = s.name === selected?.name;
              return (
                <button key={s.name} type="button" aria-pressed={on} aria-label={`Site ${s.name}, open on ${dayLabel(picked!)}`} onClick={() => onSelect(s.name)}
                  style={pct(map, s.at)}
                  className={cx("absolute grid size-11 -translate-x-1/2 -translate-y-[78%] cursor-pointer place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ch-ink", on ? "z-20" : "z-10")}>
                  <span aria-hidden="true" className="gh-pin block" data-state="open" data-selected={on} />
                  <span aria-hidden="true" className={cx("absolute top-[6px] rounded-[5px]", on ? "left-[calc(50%+21px)]" : "left-[calc(50%+14px)]")} >
                    <span className="block bg-ch-card px-1 text-[13px] font-extrabold tabular-nums text-ch-green-deep shadow-ch-card rounded-[5px]">{s.name}</span>
                  </span>
                </button>
              );
            })}

            {/* North and scale, from the data's own projection (north is up). */}
            <div aria-hidden="true" className="pointer-events-none absolute bottom-2 left-2 flex items-end gap-2 rounded-[7px] bg-ch-card/90 px-2 py-1 text-[11px] font-bold text-ch-ink-2">
              <span className="grid place-items-center leading-none">▲<span>N</span></span>
              <span className="grid">
                <span className="block h-[5px] border-x-2 border-b-2 border-ch-ink-2" style={{ width: `calc(${(bar.metres / f.w) * 100}cqw)` }} />
                <span className="tabular-nums">{bar.ft} ft</span>
              </span>
            </div>
          </div>
          <figcaption className="mt-2 px-1 text-[13px] leading-relaxed text-ch-muted">
            Drawn by CampHawk from {provider}&apos;s published site locations (RIDB, CC BY 4.0), National Park Service roads and restrooms, and USGS water. Positions are approximate. Check the booking site before you go.
          </figcaption>
        </figure>

        <div className="grid gap-5 px-1 sm:px-0">
          {selected && <SiteDetails map={map} site={selected} picked={picked!} />}
          <ul aria-label="Map key" className={cx("grid grid-cols-2 gap-x-4 gap-y-2.5 text-[14px] text-ch-ink-2 lg:grid-cols-1", selected && "border-t border-ch-line pt-4")}>
            <li className="col-span-2 flex items-center gap-2.5 lg:col-span-1"><span aria-hidden="true" className="grid w-6 shrink-0 place-items-center"><span className="gh-pin block scale-75" data-state="open" /></span>Open on the picked night</li>
            <li className="flex items-center gap-2.5"><span aria-hidden="true" className="grid w-6 shrink-0 place-items-center"><span className="size-[6px] rounded-full bg-ch-ink-2" /></span>Other sites</li>
            <li className="flex items-center gap-2.5"><span aria-hidden="true" className="grid w-6 shrink-0 place-items-center text-[11px] font-bold tabular-nums">40</span>Site numbers</li>
            <li className="flex items-center gap-2.5"><span aria-hidden="true" className="grid w-6 shrink-0 place-items-center"><span className={KEY_ICON}><Toilet className="size-3.5" /></span></span>Restroom</li>
            {parking.length > 0 && <li className="flex items-center gap-2.5"><span aria-hidden="true" className="grid w-6 shrink-0 place-items-center"><span className={cx(KEY_ICON, "text-[13px] font-extrabold")}>P</span></span>Parking</li>}
            {shuttle && <li className="flex items-center gap-2.5"><span aria-hidden="true" className="grid w-6 shrink-0 place-items-center"><span className={KEY_ICON}><Bus className="size-3.5" /></span></span>Shuttle stop</li>}
            {kioskAt && <li className="flex items-center gap-2.5"><span aria-hidden="true" className="grid w-6 shrink-0 place-items-center"><span className={KEY_ICON}><Info className="size-3.5" /></span></span>Kiosk</li>}
            <li className="flex items-center gap-2.5"><span aria-hidden="true" className="grid w-6 shrink-0 place-items-center"><span className="h-[6px] w-6 rounded-full border border-ch-faint bg-ch-card" /></span>Road</li>
            <li className="flex items-center gap-2.5"><span aria-hidden="true" className="grid w-6 shrink-0 place-items-center"><span className="w-6 border-t-2 border-dashed border-ch-muted" /></span>Trail</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function SiteDetails({ map, site, picked }: { map: SiteMapData; site: MapSite; picked: string }) {
  const toilet = nearestRestroomFt(map, site);
  const facts = [
    site.maxVehicleFt && `Vehicles up to ${site.maxVehicleFt} ft`,
    site.backIn && "Back-in parking",
    site.maxPeople && `Up to ${site.maxPeople} people`,
    site.shade && "Shaded",
    site.accessible && "Accessible site",
    toilet !== null && `Restroom about ${toilet} ft away, in a straight line`,
  ].filter(Boolean) as string[];
  return (
    <div>
      <p className="text-[13px] font-bold text-ch-green-deep"><span aria-hidden="true">✓ </span>Open {dayLabel(picked)}</p>
      <h3 className="mt-1 font-ch-display text-[19px] font-bold text-ch-ink">Site {site.name}</h3>
      <p className="text-[15px] text-ch-ink-2">{siteTypeLabel(site.type).replace(/^./, (c) => c.toUpperCase())}</p>
      <ul className="mt-3 grid gap-1.5 border-t border-ch-line pt-3 text-[14px] text-ch-ink-2">
        {facts.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <a href="#" aria-label={`Book Site ${site.name} (opens the booking site)`} className={buttonClasses({ variant: "cart", fullWidth: true, className: "mt-4" })}>Book<ExternalLink aria-hidden="true" className="size-3.5" /></a>
    </div>
  );
}

/** Rough centre of an SVG path's points (for placing a symbol on a small building). */
function centroid(d: string): [number, number] {
  const n = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  let x = 0, y = 0, k = 0;
  for (let i = 0; i + 1 < n.length; i += 2) { x += n[i]; y += n[i + 1]; k++; }
  return [x / k, y / k];
}
