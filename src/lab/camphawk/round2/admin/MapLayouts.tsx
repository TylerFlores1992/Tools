"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cx } from "@/components/cx";
import type { SiteMapData } from "../maps";
import { tidyCase } from "../maps/name";
import { AreaMaps, UnitMap, type SplitLayout, type UnitLayout } from "../AreaMaps";
import { FirstComeMap, type FirstComeLayout } from "../FirstCome";
import type { FirstComeFacts } from "../maps/first-come";
import firstComeExamples from "../maps/first-come-examples.json";
import { AdminFrame } from "./AdminFrame";

// Design comps for the owner (docs/design/campground-maps-areas.md): how a split listing and a single
// unit would show on the campground page, two directions each, drawn from real listings. The owner
// picks one of each; the rollout then builds it. ?split=pick|stack&unit=card|wide&ex=<id>.

const SPLITS: [string, string][] = [
  ["233626", "Five areas around a lake"],
  ["231980", "Ten loops along 2 mi of shore"],
  ["232136", "Three clusters up a creek"],
  ["234130", "River sites over 22 mi (not designed yet)"],
];
const UNITS: [string, string][] = [
  ["234334", "Fire lookout, trail only"],
  ["234248", "Lookout on forest roads"],
  ["233272", "Guard station by a highway"],
  ["231992", "Group camp"],
  ["234342", "Cabin by a river"],
];
// First-come campgrounds booked as one "Standard" site (docs/design/campground-maps-first-come.md).
const FIRST_COME: [string, string][] = [
  ["10165280", "17 sites, mapped area, restrooms"],
  ["10165555", "Walk-in, area not mapped"],
  ["10165105", "No count; amenities listed"],
  ["10165165", "Closed"],
  ["10165335", "Two loops by a road"],
];
const FC_FACTS = (firstComeExamples as { facts: Record<string, FirstComeFacts> }).facts;
const FC_LOOKS: [FirstComeLayout, string, string][] = [
  ["glance", "A · Map and how-to side by side", "The campground’s area hatched on the map, its restrooms marked; beside it (below it on a phone) the three steps to get a site, then the facts."],
  ["steps", "B · Steps first, then a wide map", "The three steps as a strip across the top, a wide map of the campground under them, and the facts below. Leads with what to do."],
];
const SPLIT_LOOKS: [SplitLayout, string, string][] = [
  ["pick", "A · One area at a time", "An overview with each area numbered, a list of areas beside it, and one area’s site map below. Find a site switches area."],
  ["stack", "B · Every area, in order", "The same overview, then every area’s site map one after another, each under its number. Nothing to switch; a longer page."],
];
const UNIT_LOOKS: [UnitLayout, string, string][] = [
  ["card", "A · Map and facts side by side", "A square location map with the land’s shape shaded and the one place marked; beside it (below it on a phone) what it is, the nearest trail and road, and its coordinates."],
  ["wide", "B · Wide map, facts on it", "A wide strip of the same map with the facts in a card over its corner (below it on a phone). Shows more of the ground; the card covers part of it."],
];

function useMapFile(id: string) {
  const [got, setGot] = useState<{ id: string; map: SiteMapData | null } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/private/camphawk/maps/ridb-${id}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((m: SiteMapData | null) => { if (live) setGot({ id, map: m && Array.isArray(m.sites) ? m : null }); });
    return () => { live = false; };
  }, [id]);
  return got?.id === id ? got.map ?? "error" : null;
}

function Pills<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}
          className={cx("inline-flex min-h-11 items-center rounded-ch-chip border px-3.5 text-[13.5px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green", v === value ? "border-ch-ink bg-ch-ink text-ch-white" : "border-ch-line bg-ch-card text-ch-ink-2 hover:border-ch-muted")}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function MapLayouts() {
  const params = useSearchParams();
  const pathname = usePathname();
  const home = pathname.replace(/\/layouts$/, "");
  const split = (params.get("split") === "stack" ? "stack" : "pick") as SplitLayout;
  const unit = (params.get("unit") === "wide" ? "wide" : "card") as UnitLayout;
  const splitEx = SPLITS.some(([id]) => id === params.get("s")) ? params.get("s")! : SPLITS[0][0];
  const unitEx = UNITS.some(([id]) => id === params.get("u")) ? params.get("u")! : UNITS[0][0];
  const set = (k: string, v: string) => { const q = new URLSearchParams(params.toString()); q.set(k, v); window.history.replaceState(null, "", `${pathname}?${q}`); };
  const fc = (params.get("fc") === "steps" ? "steps" : "glance") as FirstComeLayout;
  const fcEx = FIRST_COME.some(([id]) => id === params.get("f")) ? params.get("f")! : FIRST_COME[0][0];
  const splitMap = useMapFile(splitEx), unitMap = useMapFile(unitEx), fcMap = useMapFile(fcEx);
  const [site, setSite] = useState<string | null>(null);

  return (
    <AdminFrame page="Site maps: layouts (design comps)" home={home}>
      <Link href={home} className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-bold text-ch-ink-2 underline-offset-2 hover:underline"><ArrowLeft aria-hidden="true" className="size-4" />Site maps</Link>
      <h1 className="mt-1 text-balance font-ch-display text-ch-title font-bold leading-tight text-ch-ink">Three kinds of listing, two ways each</h1>
      <p className="mt-1 max-w-[70ch] text-[15px] leading-relaxed text-ch-ink-2">How the campground page would show a listing that is several areas apart, one that is a single cabin or lookout, and a first-come campground you can’t reserve. Drawn from real Recreation.gov listings. Pick one of each; nothing here is live.</p>

      <section aria-labelledby="split-h" className="mt-8">
        <h2 id="split-h" className="font-ch-display text-[22px] font-extrabold text-ch-ink">Several areas under one listing</h2>
        <div className="mt-3 grid gap-3">
          <Pills label="Direction" value={split} options={SPLIT_LOOKS.map(([v, t]): [SplitLayout, string] => [v, t])} onChange={(v) => set("split", v)} />
          <p className="max-w-[70ch] text-[14px] leading-snug text-ch-ink-2">{SPLIT_LOOKS.find(([v]) => v === split)![2]}</p>
          <Pills label="Example" value={splitEx} options={SPLITS.map(([id, t]) => [id, t])} onChange={(v) => { set("s", v); setSite(null); }} />
        </div>
        {splitMap === null ? <p role="status" className="mt-4 text-[15px] text-ch-ink-2">Loading the map…</p>
          : splitMap === "error" ? <p role="alert" className="mt-4 text-[15px] text-ch-ink-2">This example’s map didn’t load.</p>
          : <>
              <p className="mt-5 text-[14px] font-bold text-ch-ink-2">{tidyCase(splitMap.name ?? "")}</p>
              <AreaMaps key={`${splitEx}-${split}`} layout={split} map={splitMap} name={tidyCase(splitMap.name ?? "")} provider="Recreation.gov" picked={null} openIds={[]} selectedId={site} onSelect={setSite} />
            </>}
      </section>

      <section aria-labelledby="unit-h" className="mt-12">
        <h2 id="unit-h" className="font-ch-display text-[22px] font-extrabold text-ch-ink">A single cabin, lookout or group site</h2>
        <div className="mt-3 grid gap-3">
          <Pills label="Direction" value={unit} options={UNIT_LOOKS.map(([v, t]): [UnitLayout, string] => [v, t])} onChange={(v) => set("unit", v)} />
          <p className="max-w-[70ch] text-[14px] leading-snug text-ch-ink-2">{UNIT_LOOKS.find(([v]) => v === unit)![2]}</p>
          <Pills label="Example" value={unitEx} options={UNITS.map(([id, t]) => [id, t])} onChange={(v) => set("u", v)} />
        </div>
        {unitMap === null ? <p role="status" className="mt-4 text-[15px] text-ch-ink-2">Loading the map…</p>
          : unitMap === "error" ? <p role="alert" className="mt-4 text-[15px] text-ch-ink-2">This example’s map didn’t load.</p>
          : <>
              <p className="mt-5 text-[14px] font-bold text-ch-ink-2">{tidyCase(unitMap.name ?? "")}</p>
              <UnitMap map={unitMap} name={tidyCase(unitMap.name ?? "")} provider="Recreation.gov" layout={unit} />
            </>}
      </section>
      <section aria-labelledby="fc-sec-h" className="mt-12">
        <h2 id="fc-sec-h" className="font-ch-display text-[22px] font-extrabold text-ch-ink">A first-come campground (booked as one “Standard” site)</h2>
        <div className="mt-3 grid gap-3">
          <Pills label="Direction" value={fc} options={FC_LOOKS.map(([v, t]): [FirstComeLayout, string] => [v, t])} onChange={(v) => set("fc", v)} />
          <p className="max-w-[70ch] text-[14px] leading-snug text-ch-ink-2">{FC_LOOKS.find(([v]) => v === fc)![2]}</p>
          <Pills label="Example" value={fcEx} options={FIRST_COME.map(([id, t]) => [id, t])} onChange={(v) => set("f", v)} />
        </div>
        {fcMap === null ? <p role="status" className="mt-4 text-[15px] text-ch-ink-2">Loading the map…</p>
          : fcMap === "error" ? <p role="alert" className="mt-4 text-[15px] text-ch-ink-2">This example’s map didn’t load.</p>
          : <>
              <p className="mt-5 text-[14px] font-bold text-ch-ink-2">{tidyCase(fcMap.name ?? "")}</p>
              <FirstComeMap map={fcMap} name={tidyCase(fcMap.name ?? "")} facts={FC_FACTS[fcEx] ?? null} layout={fc} />
            </>}
      </section>
    </AdminFrame>
  );
}
