"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { CircleX, ExternalLink, QrCode, Tent, Toilet } from "lucide-react";
import { cx } from "@/components/cx";
import type { SiteMapData } from "./maps";
import { campgroundOutline, campgroundRestrooms, firstComeFrame, fittedLabels, fittedScaleBar, outlineLabelAt, ringCenter, type FirstComeFacts } from "./maps/first-come";
import { isFootway, latLon, reliefUrl } from "./AreaMaps";

// A first-come campground booked as one "Standard" site (docs/design/campground-maps-first-come.md):
// 130 Recreation.gov listings are a campground you can't reserve. You arrive, take any open site and
// pay there with Scan and Pay. The listing's one "site" is a payment placeholder whose point sits by
// the entrance, so this map draws the campground itself (OpenStreetMap's outline when it has one)
// and says how getting a site works. Two directions for the owner to pick between.

export type FirstComeLayout = "glance" | "steps";

/** The drawing: relief, water, trails, roads, the campground's outline (hatched, labelled) and its
    restrooms. With no outline, a pin at the listed point says "About here". */
function FirstComeDrawing({ map, aspect, className }: { map: SiteMapData; aspect: number; className?: string }) {
  const f = firstComeFrame(map, aspect);
  const at = map.sites[0]?.at ?? null;
  const o = campgroundOutline(map);
  const s = Math.max(f.w, f.h) / 700 * 0.6;
  const relief = reliefUrl(map, f);
  const bar = fittedScaleBar(f.w);
  const pct = ([x, y]: [number, number]) => ({ left: `${((x - f.x) / f.w) * 100}%`, top: `${((y - f.y) / f.h) * 100}%` });
  const within = ([x, y]: [number, number]) => x > f.x && x < f.x + f.w && y > f.y && y < f.y + f.h;
  const own = campgroundRestrooms(map);
  const wcs = [...own.inside, ...own.nearby].filter((r) => within(r.at));
  // The outline's label sits on its top edge, above its middle.
  const labelAt: [number, number] | null = o ? outlineLabelAt(o.ring) : null;
  // The pin's label goes left when the pin is in the frame's right half, so it never runs off a phone.
  const pinLeft = at ? at[0] > f.x + f.w * 0.45 : false;
  // Names that fit: none off the frame, none on another name or the "Campground" label (critic round 1).
  const k = f.w / 340;
  const names = fittedLabels(map.labels, f, labelAt ? [{ x0: labelAt[0] - 50 * k, y0: labelAt[1] - 30 * k, x1: labelAt[0] + 50 * k, y1: labelAt[1] }] : []);
  return (
    <div className={cx("relative isolate overflow-hidden rounded-ch-input border border-ch-line bg-ch-shell [container-type:inline-size]", className)} style={{ aspectRatio: `${f.w} / ${f.h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a live service image, not ours to optimise */}
      {relief && <img src={relief} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover mix-blend-multiply brightness-125 contrast-50" />}
      <svg viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`} className="absolute inset-0 size-full" role="img"
        aria-label={o ? `Map of the campground: its area hatched${own.inside.length ? `, ${own.inside.length} restroom${own.inside.length > 1 ? "s" : ""} inside it` : ""}${own.nearby.length ? `, ${own.nearby.length} more just outside` : ""}, with the roads, trails and water around it.` : "Map of where the campground is listed, with the roads, trails and water around it. Its own area isn’t mapped."}>
        <defs>
          <pattern id={`fc-hatch-${map.facilityId}`} width={14 * s} height={14 * s} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2={14 * s} className="stroke-ch-ink-2" strokeWidth={2.4 * s} strokeOpacity="0.45" />
          </pattern>
        </defs>
        {map.water.map((w, i) => <path key={i} d={w.d} fillRule="evenodd" className="fill-ch-map-water" />)}
        {o && <path d={o.rings.map((ring) => `M${ring.map((p) => p.join(" ")).join("L")}Z`).join("")} fill={`url(#fc-hatch-${map.facilityId})`} />}
        {[...map.trails, ...map.roads.filter(isFootway)].map((t, i) => <path key={i} d={t.d} fill="none" className="stroke-ch-ink-2" strokeWidth={2.2 * s} strokeDasharray={`${8 * s} ${6 * s}`} strokeLinecap="round" />)}
        {map.roads.filter((r) => !isFootway(r)).map((r, i) => <path key={`c${i}`} d={r.d} fill="none" className="stroke-ch-muted" strokeWidth={(r.cls === "Service" ? 7 : 10) * s} strokeLinecap="round" strokeLinejoin="round" />)}
        {map.roads.filter((r) => !isFootway(r)).map((r, i) => <path key={`r${i}`} d={r.d} fill="none" className="stroke-ch-card" strokeWidth={(r.cls === "Service" ? 4.5 : 7) * s} strokeLinecap="round" strokeLinejoin="round" />)}
        {map.buildings.filter((b) => !/restroom/i.test(`${b.name} ${b.type}`)).map((b, i) => <path key={i} d={b.d} className="fill-ch-faint" />)}
        {o && <path d={o.rings.map((ring) => `M${ring.map((p) => p.join(" ")).join("L")}Z`).join("")} fill="none" className="stroke-ch-ink" strokeWidth={2.6 * s} strokeLinejoin="round" />}
      </svg>
      {names.map((l) => (
        <span key={l.text} aria-hidden="true" style={{ ...pct(l.at), transform: `translate(-50%, -50%) rotate(${l.angle}deg)` }}
          className={cx("pointer-events-none absolute whitespace-nowrap text-[11px] sm:text-[12px]", l.kind !== "water" && "gh-map-halo", l.kind === "water" ? "font-semibold italic text-ch-map-water-ink" : "font-bold text-ch-ink-2")}>{l.text}</span>
      ))}
      {wcs.map((r, i) => (
        <span key={i} aria-hidden="true" style={pct(r.at)} className="pointer-events-none absolute grid size-[22px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[1.5px] border-ch-ink-2 bg-ch-card text-ch-ink-2"><Toilet aria-hidden="true" className="size-[13px]" /></span>
      ))}
      {labelAt && (
        <span aria-hidden="true" style={pct(labelAt)} className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-[6px] bg-ch-ink px-1.5 py-0.5 text-[13px] font-extrabold text-ch-white">Campground</span>
      )}
      {!o && at && (
        <span aria-hidden="true" style={pct(at)} className="pointer-events-none absolute z-10">
          <svg viewBox="0 0 28 36" className="absolute h-9 w-7 -translate-x-1/2 -translate-y-full drop-shadow-[0_1px_1px_rgba(0,0,0,.25)]">
            <path d="M14 35C14 35 2 21.5 2 13.5a12 12 0 0 1 24 0C26 21.5 14 35 14 35Z" className="fill-ch-ink stroke-ch-card" strokeWidth="2" />
            <circle cx="14" cy="13.5" r="4.5" className="fill-ch-card" />
          </svg>
          <span className={cx("absolute top-[-30px] whitespace-nowrap rounded-[6px] bg-ch-ink px-1.5 py-0.5 text-[13px] font-extrabold text-ch-white", pinLeft ? "right-[18px]" : "left-[18px]")}>About here</span>
        </span>
      )}
      <div aria-hidden="true" className="pointer-events-none absolute bottom-2 left-2 inline-flex items-end gap-2.5 rounded-[7px] bg-ch-card px-2 py-1.5 text-[11px] font-bold leading-none text-ch-ink-2 shadow-ch-card">
        <svg viewBox="0 0 12 18" className="h-[18px] w-3"><path d="M6 0 L11 12 L6 9.5 L1 12 Z" className="fill-ch-ink-2" /><text x="6" y="18" textAnchor="middle" className="fill-ch-ink-2 text-[6.5px] font-extrabold">N</text></svg>
        <span className="grid gap-1"><span className="block h-[5px] border-x-2 border-b-2 border-ch-ink-2" style={{ width: `${(bar.metres / f.w) * 100}cqw` }} /><span className="tabular-nums">{bar.ft >= 1000 ? `${(bar.ft / 5280).toFixed(bar.ft % 5280 ? 1 : 0)} mi` : `${bar.ft} ft`}</span></span>
      </div>
    </div>
  );
}

/** The key under the map: the hatching and the restroom symbol, in words (never colour alone). */
function MapKey({ outlined, restrooms }: { outlined: boolean; restrooms: boolean }) {
  if (!outlined && !restrooms) return null;
  return (
    <ul aria-label="Map key" className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ch-ink-2">
      {outlined && <li className="flex items-center gap-2"><svg aria-hidden="true" viewBox="0 0 18 14" className="h-3.5 w-[18px]"><defs><pattern id="fc-key-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" className="stroke-ch-ink-2" strokeWidth="1.6" strokeOpacity="0.6" /></pattern></defs><rect x="1" y="1" width="16" height="12" rx="2" fill="url(#fc-key-hatch)" className="stroke-ch-ink" strokeWidth="1.5" /></svg>The campground’s area</li>}
      {restrooms && <li className="flex items-center gap-2"><span aria-hidden="true" className="grid size-[18px] place-items-center rounded-full border-[1.5px] border-ch-ink-2 bg-ch-card text-ch-ink-2"><Toilet className="size-[11px]" /></span>Restroom</li>}
    </ul>
  );
}

/** Phone or wider, for the map's shape: B's 2:1 map is too small on a phone (critic round 1). */
const mdQuery = "(min-width: 768px)";
function useWide() {
  return useSyncExternalStore((cb) => { const m = window.matchMedia(mdQuery); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); }, () => window.matchMedia(mdQuery).matches, () => true);
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (<div className="grid content-start gap-0.5"><dt className="text-[13px] font-bold text-ch-ink-2">{term}</dt><dd className="text-[15px] leading-snug text-ch-ink">{children}</dd></div>);
}

const listJoin = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** A list read as a sentence: only its first word capitalized. */
const sentence = (xs: string[]) => { const t = listJoin(xs.map((x, i) => (i ? x.charAt(0).toLowerCase() + x.slice(1) : x))); return t; };

/** The steps, short enough for a strip; the app note only when Recreation.gov says Scan and Pay. */
function steps(facts: FirstComeFacts): { title: string; text: string }[] {
  return [
    { title: "Go to the campground", text: "“Open in a maps app” below gets you there." },
    { title: "Take an open site", text: "Pick any site that nobody has taken." },
    facts.scanAndPay
      ? { title: "Pay at the site", text: "Scan the QR code on the post with the Recreation.gov app. Download it before you go: there may be no signal." }
      : { title: "Pay at the campground", text: "Pay at the campground’s pay station when you arrive." },
  ];
}

/** A first-come campground: where it is, and how you get a site. */
export function FirstComeMap({ map, name, facts, layout }: { map: SiteMapData; name: string; facts: FirstComeFacts | null; layout: FirstComeLayout }) {
  const o = campgroundOutline(map);
  const at = map.sites[0]?.at ?? null;
  const ll = o ? latLon(map, ringCenter(o.ring)) : at ? latLon(map, at) : null;
  const own = campgroundRestrooms(map);
  const f = facts;
  const wide = useWide();
  const sitesLine = f?.sites ? `${f.sites} sites, by Recreation.gov’s description.` : "Recreation.gov doesn’t say how many.";
  // Restrooms: only those inside the mapped area are "here"; the rest are "nearby" (critic round 1).
  const wcText = own.inside.length ? `${own.inside.length} restroom${own.inside.length > 1 ? "s" : ""}${own.nearby.length ? ` (and ${own.nearby.length} nearby)` : ""}`
    : own.nearby.length ? `${own.nearby.length} restroom${own.nearby.length > 1 ? "s" : ""} nearby` : null;
  const here = [...(f?.amenities ?? []), ...(wcText && !f?.amenities.some((a) => /toilet/i.test(a)) ? [wcText] : [])];
  // RIDB gives these for the one placeholder site, so they're the listing's, not each site's.
  const rules = [f?.maxPeople && `up to ${f.maxPeople} people`, f?.maxVehicles != null && f.maxVehicles > 0 && `${f.maxVehicles} vehicle${f.maxVehicles > 1 ? "s" : ""}`].filter(Boolean) as string[];
  // A closed campground gets no "how to get a site" (critic round 1).
  const st = f && !f.closed ? steps(f) : null;
  const closed = f?.closed ? (
    <p role="note" className="mt-2 flex items-start gap-2 rounded-ch-input border border-ch-alert-line bg-ch-alert-soft px-3 py-2.5 text-[15px] leading-snug text-ch-alert-deep">
      <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span><strong className="font-extrabold">Closed.</strong> Recreation.gov’s listing says this campground is closed. Check before you go.</span>
    </p>
  ) : null;
  // A mapped area's middle is good to about 10 m; a listed point can be hundreds of metres off.
  const digits = o ? 4 : 3;
  const facts1 = (
    <dl className="grid content-start gap-3.5">
      <Fact term="Sites">{sitesLine}{rules.length ? ` Its listing allows ${listJoin(rules)} per site.` : ""}</Fact>
      {f?.access && f.access !== "Drive-In" && <Fact term="Getting to a site">{f.access === "Walk-In" ? "Walk-in: park and carry your gear to the site." : f.access}</Fact>}
      {here.length > 0 && <Fact term="What’s here">{sentence(here)}.</Fact>}
      {ll && <Fact term="Where">
        <span className="tabular-nums">{ll[0].toFixed(digits)}, {ll[1].toFixed(digits)}</span>{!o && <span className="text-ch-ink-2"> (approximate)</span>}
        <a href={`https://www.google.com/maps/search/?api=1&query=${ll[0].toFixed(digits)},${ll[1].toFixed(digits)}`} target="_blank" rel="noreferrer" className="mt-1 flex min-h-11 items-center gap-1.5 font-bold text-ch-ink underline underline-offset-2">Open in a maps app<ExternalLink aria-hidden="true" className="size-4" /><span className="sr-only">(opens in a new tab)</span></a>
      </Fact>}
      <Fact term="Alerts">There’s nothing to book ahead, so CampHawk can’t watch it for openings.</Fact>
    </dl>
  );
  const credit = (
    <p className="mt-4 px-1 text-[13px] leading-relaxed text-ch-muted sm:px-0">
      {o ? "The campground’s area is OpenStreetMap’s (© OpenStreetMap contributors). " : "OpenStreetMap doesn’t outline this campground, so the pin is where Recreation.gov lists it. "}
      Facts from Recreation.gov (RIDB, CC BY 4.0). Terrain: USGS 3D Elevation Program (public domain). Check the listing before you go.
    </p>
  );
  return (
    <section aria-labelledby="fc-h" className="mt-4 rounded-ch-card border border-ch-line bg-ch-card p-3 shadow-ch-card sm:mt-5 sm:p-6">
      <div className="px-1 sm:px-0">
        <p className="inline-flex items-center gap-1.5 rounded-ch-chip border border-ch-line bg-ch-shell px-2.5 py-1 text-[13px] font-extrabold text-ch-ink"><Tent aria-hidden="true" className="size-4" />First come, first served</p>
        {closed}
        <h2 id="fc-h" className="mt-2 font-ch-display text-[22px] font-extrabold tracking-[-.02em] text-ch-ink">{layout === "steps" ? "No reservations here" : "Where it is, and how to get a site"}</h2>
        <p className="mt-1 max-w-[62ch] text-[15px] text-ch-ink-2">{layout === "steps" ? "" : `${name} can’t be reserved. `}This listing is the whole campground, not one site{f?.closed ? "." : `: sites go to whoever arrives first${f?.scanAndPay ? ", and you pay there" : ""}.`}</p>
      </div>
      {layout === "glance" ? (
        <div className="mt-4 grid gap-5 px-1 sm:px-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-start">
          <div><FirstComeDrawing map={map} aspect={1} className="w-full" /><MapKey outlined={!!o} restrooms={own.inside.length + own.nearby.length > 0} /></div>
          <div className="grid content-start gap-5">
            {st && <Fact term="How to get a site"><ol className="mt-1 grid gap-1.5">{st.map((x, i) => <li key={x.title} className="flex gap-2"><span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-ch-ink text-[13px] font-extrabold text-ch-white">{i + 1}</span><span><strong className="font-bold">{x.title}.</strong> {x.text}</span></li>)}</ol></Fact>}
            {facts1}
          </div>
        </div>
      ) : (
        <>
          {st && (wide ? (
            <ol className="mt-4 grid grid-cols-3 gap-3">
              {st.map((x, i) => (
                <li key={x.title} className="grid content-start gap-1.5 rounded-ch-input border border-ch-line bg-ch-shell p-4">
                  <span className="flex items-center gap-2 font-ch-display text-[17px] font-extrabold text-ch-ink">
                    <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-ch-ink text-[14px] text-ch-white">{i + 1}</span>
                    {x.title}{i === 2 && f?.scanAndPay && <QrCode aria-hidden="true" className="ml-auto size-5 text-ch-ink-2" />}
                  </span>
                  <span className="text-[15px] leading-snug text-ch-ink-2">{x.text}</span>
                </li>
              ))}
            </ol>
          ) : (
            <ol className="mt-4 grid gap-1.5 px-1">{st.map((x, i) => <li key={x.title} className="flex gap-2 text-[15px] leading-snug text-ch-ink"><span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-ch-ink text-[13px] font-extrabold text-ch-white">{i + 1}</span><span><strong className="font-bold">{x.title}.</strong> {x.text}</span></li>)}</ol>
          ))}
          <div className="mt-4"><FirstComeDrawing map={map} aspect={wide ? 2 : 4 / 3} className="w-full" /><MapKey outlined={!!o} restrooms={own.inside.length + own.nearby.length > 0} /></div>
          <div className="mt-4 px-1 sm:px-0 [&>dl]:md:grid-cols-2 [&>dl]:md:gap-x-8">{facts1}</div>
        </>
      )}
      {credit}
    </section>
  );
}
