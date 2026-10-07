"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Bus, Droplet, ExternalLink, Info, Search, Toilet, ZoomIn, ZoomOut } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../ui";
import { dayLabel } from "./campground-data";
import { nearestRestroomFt, restrooms, scaleBar, siteTypeLabel, type MapSite, type SiteMapData } from "./maps";
import { findSite, placeNumbers, toPx, type Box } from "./maps/layout";

// The campground's own site map, drawn by CampHawk from public data (no provider map image is
// copied or traced): site points from Recreation.gov's RIDB, roads, restrooms and parking from the
// Park Service's GIS, the river from USGS. Build: studio/campground-maps/. What it keeps:
// - State is never colour alone. An open site is a green pin with a tick and its number in
//   words; a site you searched for is an ink ring with its number; every other site is a dot.
// - Only open sites are buttons. The day panel stays the list, and "Find a site" reaches any
//   site by its number, so nothing is reachable only by pointing at a picture.
// - It never claims more than the data: distances are straight lines, said so; a fact RIDB
//   leaves blank (or writes as 0) isn't shown; there's no tree texture because we have no
//   canopy data, and a forest drawn everywhere would be a guess.
// - Zoom draws the map at least 1600px wide inside a pannable frame, where every number that
//   fits is shown (about three in four at Upper Pines). Numbers sit beside their own dot on the side away from the road.

type Placed = MapSite & { at: [number, number] };
/** Zoomed, the map is drawn at least this wide (px): about 75% of Upper Pines' numbers fit. */
const ZOOM_PX = 1600;
/** Service symbols are outlines, lighter than any pin, so the open sites stay the loudest thing. */
const SYMBOL = "absolute grid size-[18px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[1.5px] border-ch-ink-2 bg-ch-card text-ch-ink-2";
const KEY = "grid size-[18px] place-items-center rounded-full border-[1.5px] border-ch-ink-2 bg-ch-card text-ch-ink-2";

/** The map frame's drawn width in CSS pixels. */
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
  const placed = map.sites.filter((s): s is Placed => s.at !== null);
  const openSites = placed.filter((s) => open.has(s.name));
  const selected = openSites.find((s) => s.name === selectedId) ?? null;
  const [found, setFound] = useState<Placed | null>(null);
  const [query, setQuery] = useState("");
  const [findMsg, setFindMsg] = useState("");
  const [zoomed, setZoomed] = useState(false);
  const [viewport, vw] = useWidth<HTMLDivElement>();
  const scroller = useRef<HTMLDivElement>(null);
  const details = useRef<HTMLDivElement>(null);
  // From lg the details sit beside the map, so a tap needn't scroll to them.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const W = zoomed && vw ? Math.max(vw * 2, ZOOM_PX) : vw;
  const zoom = vw ? W / vw : 1;

  const kiosk = map.buildings.find((b) => b.type === "Kiosk");
  const kioskAt = kiosk ? centroid(kiosk.d) : null;
  const shuttle = map.pois.find((p) => /shuttle/i.test(p.type));
  const parking = map.pois.filter((p) => p.type === "Parking Lot");
  const water = map.pois.filter((p) => p.type === "Water");
  const dump = map.pois.filter((p) => p.type === "Dump Station");
  const symbols: { at: [number, number]; icon: ReactNode; key: string }[] = [
    ...restrooms(map).map((r, i) => ({ at: r.at, icon: <Toilet className="size-[11px]" />, key: `wc${i}` })),
    ...parking.map((p, i) => ({ at: p.at, icon: <span className="text-[10px] font-extrabold leading-none">P</span>, key: `p${i}` })),
    ...water.map((p, i) => ({ at: p.at, icon: <Droplet className="size-[11px]" />, key: `w${i}` })),
    ...dump.map((p, i) => ({ at: p.at, icon: <span className="text-[10px] font-extrabold leading-none">D</span>, key: `d${i}` })),
    ...(shuttle ? [{ at: shuttle.at, icon: <Bus className="size-[11px]" />, key: "bus" }] : []),
    ...(kioskAt ? [{ at: kioskAt, icon: <Info className="size-[11px]" />, key: "kiosk" }] : []),
  ];

  // Everything already drawn is an obstacle for the site numbers: symbols, pins with their
  // number tags, the found ring, and the road and river names.
  const boxAt = (at: [number, number], w: number, h: number, dx = 0, dy = 0): Box => {
    const [x, y] = toPx(map, at, W);
    return { x0: x + dx - w / 2, y0: y + dy - h / 2, x1: x + dx + w / 2, y1: y + dy + h / 2 };
  };
  const pinned = new Set([...openSites.map((s) => s.name), ...(found ? [found.name] : [])]);
  const obstacles: Box[] = W ? [
    ...symbols.map((s) => boxAt(s.at, 22, 22)),
    // The pin, and its number tag to the right (wider when the pin is picked and scaled up).
    ...openSites.flatMap((s) => [boxAt(s.at, 40, 50, 0, -18), boxAt(s.at, 50, 26, 40, -8)]),
    ...(found ? [boxAt(found.at, 26, 26), boxAt(found.at, 40, 22, 34, 0)] : []),
    // A name runs along its road at an angle: cover it with small boxes along that line.
    ...map.labels.flatMap((l) => {
      const len = l.text.length * 6.5, n = Math.ceil(len / 14), r = (l.angle * Math.PI) / 180;
      return Array.from({ length: n }, (_, i) => { const t = (i + 0.5) * (len / n) - len / 2; return boxAt(l.at, 16, 16, t * Math.cos(r), t * Math.sin(r)); });
    }),
  ] : [];
  const numberPx = zoom > 1 ? 12 : 11;
  const numbers = placeNumbers(map, placed.filter((s) => !pinned.has(s.name)), W, obstacles, { charPx: numberPx * 0.62, linePx: numberPx + 3 });

  const bar = scaleBar(map, zoom);
  const summary = `Map of ${name}: ${placed.length} campsites along the campground roads, ${restrooms(map).length} restrooms` +
    (picked ? `. ${openSites.length ? `${openSites.length} open on ${dayLabel(picked)}: ${openSites.map((s) => s.name).join(", ")}` : `None open on ${dayLabel(picked)}`}.` : ".");

  // Bring a site into view inside the zoomed frame.
  const center = (at: [number, number]) => {
    const el = scroller.current;
    if (!el) return;
    const [x, y] = toPx(map, at, W);
    el.scrollTo({ left: x - el.clientWidth / 2, top: y - el.clientHeight / 2, behavior: "smooth" });
  };
  useLayoutEffect(() => {
    if (zoom > 1) { const at = found?.at ?? selected?.at; if (at) center(at); }
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (s: Placed) => {
    onSelect(s.name);
    // Phones: the details (and Book) are below the map; bring them up.
    if (!wide) requestAnimationFrame(() => details.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };
  const find = () => {
    const s = findSite(map, query);
    if (!s || !s.at) {
      setFound(null);
      setFindMsg(query.trim() ? `There’s no site “${query.trim()}” at ${name}.` : "Type a site number.");
      return;
    }
    const p = s as Placed;
    if (open.has(p.name)) { setFound(null); pick(p); setFindMsg(`Site ${p.name} is open on ${dayLabel(picked!)}.`); }
    else {
      setFound(p);
      setFindMsg(picked ? `Site ${p.name} is ringed on the map. It isn’t open on ${dayLabel(picked)}.` : `Site ${p.name} is ringed on the map.`);
    }
    if (zoom > 1) requestAnimationFrame(() => center(p.at));
  };

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

      <form role="search" aria-label="Find a site on the map" onSubmit={(e) => { e.preventDefault(); find(); }} className="mt-3 flex flex-wrap items-center gap-2 px-1 sm:px-0">
        <label htmlFor="site-find" className="text-[14px] font-bold text-ch-ink">Find a site</label>
        <input id="site-find" inputMode="numeric" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. 157"
          className="min-h-11 w-28 rounded-ch-input border border-ch-muted bg-ch-paper px-3 text-[16px] font-semibold tabular-nums text-ch-ink placeholder:font-normal placeholder:text-ch-muted focus-visible:border-ch-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green" />
        <button type="submit" className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 px-3" })}><Search aria-hidden="true" className="size-3.5" />Find</button>
        <button type="button" aria-pressed={zoomed} onClick={() => setZoomed((z) => !z)} className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 px-3 sm:ml-auto" })}>
          {zoomed ? <><ZoomOut aria-hidden="true" className="size-3.5" />Whole map</> : <><ZoomIn aria-hidden="true" className="size-3.5" />{numbers.length < placed.length / 3 ? "Zoom in for site numbers" : "Zoom in"}</>}
        </button>
        <p aria-live="polite" className="basis-full text-[14px] text-ch-ink-2 empty:hidden">{findMsg}</p>
      </form>

      {/* A tall, narrow campground would draw taller than a screen: from lg the map's column is
          capped so its height stays near 85% of the viewport, and the details take the rest. */}
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,var(--map-cap))_minmax(300px,1fr)] lg:gap-6" style={{ ["--map-cap" as string]: `max(360px, calc(85svh * ${(f.w / f.h).toFixed(3)}))` }}>
        {/* min-w-0: the zoomed drawing is wider than this box, and must scroll inside it, not widen it. */}
        <div ref={viewport} className="relative min-w-0">
          <div ref={scroller} className={cx("relative w-full rounded-ch-input border border-ch-line bg-ch-shell", zoom > 1 ? "overflow-auto overscroll-contain" : "overflow-hidden")} style={{ aspectRatio: `${f.w} / ${f.h}` }}>
            <div className="relative" style={{ width: zoom > 1 ? `${W}px` : "100%", aspectRatio: `${f.w} / ${f.h}` }}>
              <svg role="img" aria-label={summary} viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`} className="absolute inset-0 size-full">
                {map.water.map((w, i) => <path key={i} d={w.d} fillRule="evenodd" className="fill-ch-map-water" />)}
                {map.lots.map((l, i) => <path key={i} d={l.d} className="fill-ch-line stroke-ch-faint" strokeWidth={1} />)}
                {map.trails.map((t, i) => <path key={i} d={t.d} fill="none" className="stroke-ch-muted" strokeWidth={1.4} strokeDasharray="5 4" strokeLinecap="round" />)}
                {/* Roads: a muted casing under a white fill, in metres, wider for through roads. */}
                {map.roads.map((r, i) => <path key={`c${i}`} d={r.d} fill="none" className="stroke-ch-muted" strokeWidth={r.cls === "Service" ? 7.5 : 11} strokeLinecap="round" strokeLinejoin="round" />)}
                {map.roads.map((r, i) => <path key={`r${i}`} d={r.d} fill="none" className="stroke-ch-card" strokeWidth={r.cls === "Service" ? 5 : 8} strokeLinecap="round" strokeLinejoin="round" />)}
                {/* Restrooms and the kiosk are marked by their symbols; a footprint under one reads as a shadow. */}
                {map.buildings.filter((b) => !/restroom|kiosk/i.test(`${b.name} ${b.type}`)).map((b, i) => <path key={i} d={b.d} className="fill-ch-faint" />)}
                {/* Sites: dots of fixed screen size (zero-length round-capped lines) at any zoom. */}
                {placed.filter((s) => !open.has(s.name)).map((s) => (
                  <path key={s.name} d={`M${s.at[0]} ${s.at[1]}h0`} className="stroke-ch-ink-2" strokeWidth={picked ? 4.5 : 5.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={picked ? 0.6 : 1} />
                ))}
              </svg>

              {/* Type and symbols sit over the drawing in HTML, so they stay a readable size. */}
              {W > 0 && map.labels.map((l) => {
                const [x, y] = toPx(map, l.at, W);
                return (
                  <span key={l.text} aria-hidden="true" style={{ left: x, top: y, transform: `translate(-50%, -50%) rotate(${l.angle}deg)` }}
                    className={cx("pointer-events-none absolute whitespace-nowrap text-[11px] sm:text-[12px]", l.kind !== "water" && "gh-map-halo", l.kind === "water" ? "font-semibold italic text-ch-map-water-ink" : l.kind === "trail" ? "text-ch-ink-2" : "font-bold text-ch-ink-2")}>
                    {l.text}
                  </span>
                );
              })}
              {numbers.map((n) => (
                <span key={n.name} aria-hidden="true" style={{ left: n.cx, top: n.cy, fontSize: numberPx }} className="gh-map-halo pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 font-bold leading-none tabular-nums text-ch-ink">{n.name}</span>
              ))}
              {W > 0 && symbols.map((s) => {
                // A symbol under an open pin is hidden (the pin is the point of the map), and one
                // at the frame's edge is pulled in so it's never cut in half.
                const [x, y] = toPx(map, s.at, W);
                if (openSites.some((o) => { const [ox, oy] = toPx(map, o.at, W); return Math.abs(ox - x) < 26 && y - oy < 14 && oy - y < 44; })) return null;
                const H = (W * f.h) / f.w;
                return <span key={s.key} aria-hidden="true" style={{ left: Math.min(Math.max(x, 11), W - 11), top: Math.min(Math.max(y, 11), H - 11) }} className={SYMBOL}>{s.icon}</span>;
              })}

              {W > 0 && found && (() => {
                const [x, y] = toPx(map, found.at, W);
                return (
                  <span aria-hidden="true" style={{ left: x, top: y }} className="pointer-events-none absolute z-10">
                    <span className="absolute size-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ch-ink shadow-[0_0_0_2px_var(--color-ch-card)]" />
                    <span className="absolute left-[16px] top-0 -translate-y-1/2 rounded-[5px] bg-ch-ink px-1 text-[13px] font-extrabold tabular-nums text-ch-white">{found.name}</span>
                  </span>
                );
              })()}

              {W > 0 && openSites.map((s) => {
                const on = s.name === selected?.name;
                const [x, y] = toPx(map, s.at, W);
                return (
                  <button key={s.name} type="button" aria-pressed={on} aria-label={`Site ${s.name}, open on ${dayLabel(picked!)}`} onClick={() => pick(s)}
                    style={{ left: x, top: y }}
                    className={cx("absolute grid size-11 -translate-x-1/2 -translate-y-[78%] cursor-pointer place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ch-ink", on ? "z-20" : "z-10")}>
                    <span aria-hidden="true" className="gh-pin block" data-state="open" data-selected={on} />
                    <span aria-hidden="true" className={cx("absolute top-[6px] rounded-[5px] bg-ch-card px-1 text-[13px] font-extrabold tabular-nums text-ch-green-deep shadow-ch-card", on ? "left-[calc(50%+21px)]" : "left-[calc(50%+14px)]")}>{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* North and scale stay put while the zoomed map pans. Drawn from the data's own projection. */}
          {W > 0 && (
            <div aria-hidden="true" className="pointer-events-none absolute bottom-2 left-2 inline-flex items-end gap-2.5 rounded-[7px] bg-ch-card px-2 py-1.5 text-[11px] font-bold leading-none text-ch-ink-2 shadow-ch-card">
              <svg viewBox="0 0 12 18" className="h-[18px] w-3" aria-hidden="true">
                <path d="M6 0 L11 12 L6 9.5 L1 12 Z" className="fill-ch-ink-2" />
                <text x="6" y="18" textAnchor="middle" className="fill-ch-ink-2 text-[6.5px] font-extrabold">N</text>
              </svg>
              <span className="grid gap-1">
                <span className="block h-[5px] border-x-2 border-b-2 border-ch-ink-2" style={{ width: (bar.metres * W) / f.w }} />
                <span className="tabular-nums">{bar.ft} ft</span>
              </span>
            </div>
          )}
        </div>

        <div className="grid gap-5 px-1 sm:px-0">
          {selected && <div ref={details} className="scroll-mt-4"><SiteDetails map={map} site={selected} picked={picked!} /></div>}
          <ul aria-label="Map key" className={cx("grid grid-cols-2 gap-x-4 gap-y-2.5 text-[14px] text-ch-ink-2 lg:grid-cols-1", selected && "border-t border-ch-line pt-4")}>
            {picked && <Key wide mark={<span className="gh-pin block scale-75" data-state="open" />}>Open on the picked night</Key>}
            <Key mark={<span className="size-[6px] rounded-full bg-ch-ink-2" />}>{picked ? "Other sites" : "Campsites"}</Key>
            <Key mark={<span className="size-[14px] rounded-full border-[3px] border-ch-ink" />}>A site you found</Key>
            <Key mark={<span className={KEY}><Toilet className="size-[11px]" /></span>}>Restroom</Key>
            {parking.length > 0 && <Key mark={<span className={cx(KEY, "text-[10px] font-extrabold")}>P</span>}>Parking</Key>}
            {water.length > 0 && <Key mark={<span className={KEY}><Droplet className="size-[11px]" /></span>}>Drinking water</Key>}
            {dump.length > 0 && <Key mark={<span className={cx(KEY, "text-[10px] font-extrabold")}>D</span>}>Dump station</Key>}
            {shuttle && <Key mark={<span className={KEY}><Bus className="size-[11px]" /></span>}>Shuttle stop</Key>}
            {kioskAt && <Key mark={<span className={KEY}><Info className="size-[11px]" /></span>}>Kiosk</Key>}
            <Key mark={<span className="h-[7px] w-6 rounded-full border-[1.5px] border-ch-muted bg-ch-card" />}>Road</Key>
            <Key mark={<span className="w-6 border-t-2 border-dashed border-ch-muted" />}>Trail</Key>
          </ul>
        </div>
      </div>
      <p className="mt-4 px-1 text-[13px] leading-relaxed text-ch-muted sm:px-0">
        {map.credits ?? `Drawn by CampHawk from ${provider}’s published site locations (RIDB, CC BY 4.0), National Park Service roads and restrooms, and USGS water. Positions are approximate. Check the booking site before you go.`}
      </p>
    </section>
  );
}

function Key({ mark, wide, children }: { mark: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <li className={cx("flex items-center gap-2.5", wide && "col-span-2 lg:col-span-1")}>
      <span aria-hidden="true" className="grid w-6 shrink-0 place-items-center">{mark}</span>{children}
    </li>
  );
}

function SiteDetails({ map, site, picked }: { map: SiteMapData; site: MapSite; picked: string }) {
  const toilet = nearestRestroomFt(map, site);
  const facts = [
    site.loop && site.loop,
    site.spurFt && `Parking spur ${site.spurFt}${site.spurWidthFt ? ` × ${site.spurWidthFt}` : ""} ft`,
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
      <a href="#" aria-label={`Book Site ${site.name} (opens the booking site)`} className={buttonClasses({ variant: "cart", fullWidth: true, className: "mt-3" })}>Book<ExternalLink aria-hidden="true" className="size-3.5" /></a>
      <ul className="mt-3 grid gap-1.5 border-t border-ch-line pt-3 text-[14px] text-ch-ink-2">
        {facts.map((t) => <li key={t}>{t}</li>)}
      </ul>
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
