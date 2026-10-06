"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LocateFixed, MapPin, Search, Tent } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../ui";
import { CAMPGROUNDS_ROUNDED, type Visitor } from "../data";
import { LabBar } from "../LabBar";
import { Card } from "../ui/Card";
import { Tag } from "../ui/Tag";
import { DatePicker, type DateRange } from "../ui/DatePicker";
import { EMPTY_FILTERS, FilterPanel, type FilterValue } from "../ui/FilterPanel";
import { NightsPicker } from "../ui/NightsPicker";
import { RadioChips } from "../ui/RadioChips";
import { addDays, thisWeekendRange, todayISO, type ISODate } from "../ui/date";
import { Art, ART } from "./Art";
import { AppBand, BandPhoto, FavoriteHeart, LabSelect, PLANS, PricingLink, SubscribeCta, WatchCtaLink, type Plan } from "./AppParts";
import { CAMPGROUND, FIRST_COME_BADGE, FIRST_COME_WHY } from "./campground-data";
import { ORIGIN, search, suggest, type ExampleCampground } from "./explore-data";
import { ROUTES } from "./gates";
import { TRIAL_DAYS } from "./pages/tier2-data";
import { LabNote } from "./LabPage";
import { GhFooter, ScreenLinks } from "./GhChrome";
import { useUrlState, useVisitor, withVisitor } from "./labState";

// Screen 3 in the Golden hour look: CampHawk's Explore (campsite-finder src/app/(app)/search,
// src/components/v2/Explore.tsx, ResultCard.tsx, ResultsMap.tsx), ported with example data.
// Contract: docs/design/camphawk-home.md, "Screen 3". What it keeps from CampHawk, on purpose:
// - Searching is free and says so; the status box sells only to someone who can't watch yet,
//   and a subscriber is never sold to.
// - Three availability answers, not two: open, booked, and "Couldn't check" (a provider that
//   didn't answer is never drawn as booked), plus first come, which offers no watch. With no
//   dates nothing is claimed at all.
// - The map's pins carry state as a shape as well as a hue, and picking one hoists its card to
//   the front instead of scrolling the map away.
// - Once there are results, the radius, date and nights controls re-run the search.
// - The search lives in the URL, so "Back to search" from a campground restores it.
// Lab changes, from CampHawk's own colour rules: the status box and first-run panel are plain
// cards (its blue means the provider hand-off, its green an open site); the picked pin and card
// get an ink ring and keep their state (CampHawk paints them red, which hides the state and
// means "act now"); the open pin carries a tick so it doesn't differ from booked by hue alone.
// Also: the map is an illustration with example pins (no Mapbox); "Use my location"
// pretends you're in Yosemite Valley; a typed place that matches nothing says so instead of
// quietly searching near you under the typed name (CampHawk does the latter; reported).

const RADII = [10, 25, 50, 100, 200];
type When = "exact" | "tonight" | "weekend" | "flexible";
type Answer = "normal" | "fails" | "no-location";
const ANSWERS = ["normal", "fails", "no-location"] as const;
type Result = ExampleCampground & { hasAvailability: boolean | undefined };
type Searched = { place: string; radius: number; range: DateRange; flexNights: number | null };

const label = "mb-2 block text-[13px] font-extrabold text-ch-ink-2";
const SEARCH_KEYS = ["place", "radius", "when", "start", "end", "nights", "type", "rv", "electric"];
const LOADING_MS = 650;

/** The search, as URL parameters (Explore's encodeSearch), merged into the lab's own. */
function writeSearch(s: { place: string; radius: number; when: When; range: DateRange; flexNights: number; filters: FilterValue }) {
  const url = new URL(window.location.href);
  for (const k of SEARCH_KEYS) url.searchParams.delete(k);
  const q = url.searchParams;
  if (s.place) q.set("place", s.place);
  q.set("radius", String(s.radius));
  if (s.when !== "exact") q.set("when", s.when);
  if (s.range.start) q.set("start", s.range.start);
  if (s.range.end) q.set("end", s.range.end);
  if (s.when === "flexible") q.set("nights", String(s.flexNights));
  if (s.filters.siteType) q.set("type", s.filters.siteType);
  if (s.filters.rvLength) q.set("rv", String(s.filters.rvLength));
  if (s.filters.electric) q.set("electric", "1");
  window.history.replaceState(window.history.state, "", url);
  // The search alone (no lab switches), for the cards' "back" link.
  const only = new URLSearchParams();
  for (const k of SEARCH_KEYS) { const v = q.get(k); if (v !== null) only.set(k, v); }
  return `?${only}`;
}

/** The status box above the results: context, not a paywall. Nothing for a subscriber. */
function StatusBox({ visitor }: { visitor: Visitor }) {
  if (visitor === "subscriber") return null;
  const guest = visitor === "signed-out" || visitor === "app";
  return (
    <div className="mb-5 rounded-ch-card border border-ch-line bg-ch-card px-5 py-4 shadow-ch-card">
      <p className="text-[16px] font-bold text-ch-ink">{guest ? "You're searching as a guest" : "You're searching with a free account"}</p>
      <p className="mt-1 max-w-[62ch] text-[15px] leading-relaxed text-ch-ink-2">
        {visitor === "signed-out"
          ? "Live availability is free and always will be. An account is only needed to watch a campground that's already booked."
          : visitor === "app"
            ? "Live availability is free and always will be. Watching a booked campground needs a subscription — no account needed."
            : "Live availability is free and always will be. Watching a booked campground — and the text the moment someone cancels — needs a subscription."}
      </p>
      <SubscribeCta visitor={visitor} className="mt-3" />
      <Link href={withVisitor(ROUTES.watches, visitor)} className="mt-2 inline-flex min-h-11 items-center text-[16px] font-bold text-ch-forest underline underline-offset-2 hover:decoration-2">
        See what a watch does
      </Link>
    </div>
  );
}

/** The first-run box's closing line, matched to the reader (ExploreAccountCta). */
function AccountLine({ visitor }: { visitor: Visitor }) {
  if (visitor === "subscriber") return null;
  const link = "font-bold text-ch-forest underline underline-offset-2 hover:decoration-2";
  if (visitor === "app") return <p className="mt-3 text-[14px] leading-normal text-ch-ink-2">Watching booked campgrounds needs a subscription — no account needed. <a href="#" className={link}>See plans</a></p>;
  return (
    <p className="mt-3 text-[14px] leading-normal text-ch-ink-2">
      {visitor === "signed-out" ? "Searching is free and needs no account. Watches, text alerts and auto-cart need one. " : "Watches, text alerts and auto-cart come with a subscription. "}
      <a href="#" className={link}>{visitor === "signed-out" ? `Start a ${TRIAL_DAYS}-day free trial` : visitor === "lapsed" ? "Resubscribe" : "Start your free trial"}</a>
    </p>
  );
}

function FirstRun({ visitor }: { visitor: Visitor }) {
  const steps = [
    ["Say where", "A city, park or ZIP in the search box — or tap the crosshair to use your location. Leave it empty and we'll search near you."],
    ["Say when", "Exact dates, or one tap for tonight or this weekend. Flexible is the useful one: say how many nights you need and give us a date range to hunt inside, and we'll take any stretch that long."],
    ["Search", <>Results marked <Tag kind="open" className="mx-0.5 align-[1px]">Sites open</Tag> have a site free right now. Tap any result for its full calendar, or the map to see where they are.</>],
  ] as const;
  return (
    <div className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card sm:p-7">
      <h2 className="font-ch-display text-[24px] font-extrabold tracking-[-.02em] text-ch-forest">How search works</h2>
      <p className="mt-2 max-w-[56ch] text-[16px] leading-relaxed text-ch-ink-2">
        Explore checks live availability at {CAMPGROUNDS_ROUNDED} campgrounds — national forests, state and provincial parks, and everything in between — and shows you what&apos;s bookable right now.
      </p>
      {/* Wide screens: the three steps side by side, so the card has no dead half. */}
      <ol className="mt-4 max-w-[56ch] xl:mt-6 xl:grid xl:max-w-none xl:grid-cols-3 xl:gap-6">
        {steps.map(([title, sub], i) => (
          <li key={title} className="flex gap-3 border-b border-ch-line py-3 last:border-b-0 xl:border-b-0 xl:border-t xl:pt-4">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ch-shell text-[13px] font-extrabold text-ch-ink">{i + 1}</span>
            <span>
              <span className="block text-[15px] font-bold text-ch-ink">{title}</span>
              <span className="mt-0.5 block text-[14px] leading-normal text-ch-ink-2">{sub}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 border-t border-ch-line pt-4">
        <p className="text-[15px] font-bold text-ch-ink">Everything booked?</p>
        <p className="mt-1 max-w-[56ch] text-[14px] leading-normal text-ch-ink-2">That&apos;s what we&apos;re for. Start a watch on a full campground and we&apos;ll check it every 15 seconds and text you the moment someone cancels.</p>
        <AccountLine visitor={visitor} />
      </div>
    </div>
  );
}

type PinState = "open" | "booked" | "unknown" | "first-come" | "plain";
function pinState(c: Result, datesChosen: boolean): PinState {
  if (!datesChosen) return "plain";
  if (c.hasAvailability === true) return "open";
  if (c.hasAvailability === false) return "booked";
  return c.reservable ? "unknown" : "first-come";
}
const PIN_WORDS: Record<PinState, string | null> = { open: "sites open", booked: "booked", unknown: "couldn't check", "first-come": FIRST_COME_BADGE.toLowerCase(), plain: null };

/** ResultsMap, as an illustration: the pins are real buttons on a painted valley. */
function ResultsMap({ results, datesChosen, selectedId, onSelect }: { results: Result[]; datesChosen: boolean; selectedId: string | null; onSelect: (id: string) => void }) {
  const anyFirstCome = datesChosen && results.some((c) => pinState(c, true) === "first-come");
  const swatch = "mr-1.5 inline-block align-[-1px] rounded-full";
  const legend = (
    <>
            {datesChosen && (
              <>
                <span><i aria-hidden="true" className={cx(swatch, "inline-grid size-3.5 place-items-center bg-ch-green align-[-2px] text-[9px] font-extrabold not-italic leading-none text-ch-white")}>✓</i>Sites open</span>
                <span><i aria-hidden="true" className={cx(swatch, "size-2.5 bg-ch-muted")} />Booked</span>
                <span><i aria-hidden="true" className={cx(swatch, "size-2.5 border-[2.5px] border-ch-muted bg-ch-card")} />Couldn&apos;t check</span>
                {anyFirstCome && <span><i aria-hidden="true" className={cx(swatch, "size-2 bg-ch-faint")} />First come</span>}
              </>
            )}
            {selectedId && <span><i aria-hidden="true" className={cx(swatch, "size-2.5 bg-ch-card ring-2 ring-ch-ink")} />Showing first</span>}
    </>
  );
  return (
    <figure className="mb-4">
      <div role="group" aria-label="Map of results" className="relative aspect-[16/9] overflow-hidden sm:aspect-[11/5] rounded-ch-card border border-ch-line bg-ch-shell">
        <Art art={ART.e2} sizes="(min-width: 1024px) 860px, 100vw" className="absolute inset-0 size-full object-cover" />
        {(datesChosen || selectedId) && (
          <div className="absolute left-2 top-2 hidden max-w-[calc(100%-1rem)] flex-wrap gap-x-3 gap-y-1 rounded-[9px] bg-ch-card px-2.5 py-1.5 text-[12px] font-bold text-ch-ink-2 shadow-ch-card sm:flex">{legend}</div>
        )}
        {results.map((c) => {
          const state = pinState(c, datesChosen);
          const words = PIN_WORDS[state];
          const selected = selectedId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={selected}
              aria-label={`${c.name}${words ? `, ${words}` : ""}`}
              onClick={() => onSelect(c.id)}
              style={{ left: `${c.pin.x}%`, ["--y" as string]: c.pin.y }}
              className={cx("gh-map-pin absolute grid size-11 -translate-x-1/2 -translate-y-[78%] cursor-pointer place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ch-ink", selected && "z-10")}
            >
              <span aria-hidden="true" className="gh-pin block" data-state={state} data-selected={selected} />
            </button>
          );
        })}
      </div>
      {/* Phones: the key sits under the map, where it can't cover a pin. */}
      {(datesChosen || selectedId) && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[13px] font-bold text-ch-ink-2 sm:hidden">{legend}</div>}
      <figcaption className="mt-2 px-1 text-[13px] text-ch-muted">Illustrated map with example pins, not a real map.</figcaption>
    </figure>
  );
}

function ResultCard({ c, visitor, searched, backTo, favorite, onToggleFavorite }: { c: Result; visitor: Visitor; searched: Searched; backTo: string; favorite: boolean; onToggleFavorite?: () => void }) {
  const { start, end } = searched.range;
  const datesChosen = Boolean(start && end);
  const firstCome = !c.reservable;
  const open = datesChosen && c.hasAvailability === true;
  const booked = datesChosen && c.hasAvailability === false;
  const unknown = datesChosen && c.hasAvailability === undefined && !firstCome;
  // Only Upper Pines has a page in the lab; the other cards open the same example page.
  const href = withVisitor(`${ROUTES.campground}?id=${c.id}&back=${encodeURIComponent(backTo)}`, visitor);
  return (
    <Card state={open ? "hit" : "default"} className="flex h-full flex-col">
      <div className="flex-1">
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          {open && <Tag kind="open">Sites open</Tag>}
          {booked && <Tag kind="paused" mark="booked">Booked — watch it</Tag>}
          {unknown && <Tag kind="paused" mark="unknown" srPrefix="Availability:">Couldn&apos;t check</Tag>}
          {firstCome && <Tag kind="paused" mark="first-come" srPrefix="Booking:">{FIRST_COME_BADGE}</Tag>}
          {c.provider === "Recreation.gov" && !firstCome && <Tag kind="cart" mark="auto-cart">Auto-cart</Tag>}
          <Tag kind="src">{c.provider}</Tag>
        </div>
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 font-ch-display text-[20px] font-extrabold leading-tight tracking-[-.02em] text-ch-ink">
            <Link href={href} className="underline-offset-[3px] hover:underline">{c.name}</Link>
          </h3>
          {onToggleFavorite && <FavoriteHeart favorite={favorite} onToggle={onToggleFavorite} name={c.name} className="-mr-1.5 -mt-1" />}
        </div>
        <p className="mt-1 text-[15px] text-ch-ink-2">{c.place} · {c.distance < 1 ? "under a mile away" : `${Math.round(c.distance)} mi away`}</p>
      </div>
      <div className="mt-4 grid gap-2 border-t border-ch-line pt-4">
        <Link href={href} className={buttonClasses({ variant: open ? "primary" : "quiet", fullWidth: true })}>
          {open ? "See what's open" : firstCome ? "See details" : "See full calendar"}
        </Link>
        {!open && (firstCome
          ? <p className="text-[14px] leading-normal text-ch-ink-2">{FIRST_COME_WHY}</p>
          : <WatchCtaLink visitor={visitor} campgroundId={c.id} start={start} end={end} />)}
      </div>
    </Card>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div aria-hidden="true" className="aspect-[16/9] animate-pulse rounded-ch-card border border-ch-line bg-ch-card motion-reduce:animate-none sm:col-span-2" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} aria-hidden="true" className="h-[210px] animate-pulse rounded-ch-card border border-ch-line bg-ch-card motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export function Explore() {
  const [visitor, setVisitor] = useVisitor();
  const [plan, setPlan] = useUrlState<Plan>("plan", "autocart", PLANS);
  const [answer, setAnswer] = useUrlState<Answer>("answer", "normal", ANSWERS);

  const [place, setPlace] = useState("");
  const [picked, setPicked] = useState(false);
  const [focusPlace, setFocusPlace] = useState(false);
  const [radius, setRadius] = useState(10);
  const [when, setWhen] = useState<When>("exact");
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [flexNights, setFlexNights] = useState(2);
  const [weekendsOnly, setWeekendsOnly] = useState(false);
  const [filters, setFilters] = useState<FilterValue>(EMPTY_FILTERS);
  const [results, setResults] = useState<Result[] | null>(null);
  const [searched, setSearched] = useState<Searched | null>(null);
  const [backTo, setBackTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(() => new Set([CAMPGROUND.id]));
  const requestId = useRef(0);
  const hydrated = useRef(false);
  const [restoring, setRestoring] = useState(false);

  const suggestions = picked || !focusPlace ? [] : suggest(place);
  // The where field is an ARIA combobox: focus stays in the input; arrows move the active option.
  const [active, setActive] = useState(-1);
  const pickSuggestion = (name: string) => { setPlace(name); setPicked(true); setFocusPlace(false); setActive(-1); };

  const locateMe = useCallback(() => {
    setLocating(true);
    setError(null);
    window.setTimeout(() => {
      setLocating(false);
      if (answer === "no-location") { setError("We couldn't get your location. Type a place instead."); return; }
      setPlace("My location");
      setPicked(true);
    }, 400);
  }, [answer]);

  const run = useCallback(() => {
    const id = ++requestId.current;
    setError(null);
    // A typed place has to be one we know; empty means "near me".
    let where = place.trim();
    if (where && !picked && where !== "My location" && where !== "Near me") {
      const hit = suggest(where)[0];
      if (!hit) { setError(`We couldn't find “${where}”. Try a city, park or ZIP, and pick it from the list.`); return; }
      where = hit.name;
      setPlace(where);
      setPicked(true);
    }
    if (!where) {
      if (answer === "no-location") { setError("Type a place to search around — we couldn't get your location."); return; }
      where = "Near me";
      setPlace(where);
      setPicked(true);
    }
    setLoading(true);
    const flex = when === "flexible" ? flexNights : null;
    window.setTimeout(() => {
      if (id !== requestId.current) return;
      setLoading(false);
      if (answer === "fails") { setError("Search didn't go through. Try again in a moment."); return; }
      setResults(search({ radius, start: range.start, end: range.end, flexNights: flex, filters }));
      setSearched({ place: where, radius, range, flexNights: flex });
      setSelectedId(null);
      setBackTo(writeSearch({ place: where, radius, when, range, flexNights, filters }));
    }, LOADING_MS);
  }, [place, picked, answer, when, flexNights, radius, range, filters]);

  // Restore a search from the URL (the home page's search, or "Back to search").
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const q = new URLSearchParams(window.location.search);
    const p = q.get("place");
    const w = q.get("when");
    // A place, or just a "when" from the home page (an empty place searches near you).
    if (!p && !w) return;
    const r = Number(q.get("radius"));
    const n = Number(q.get("nights"));
    const rv = Number(q.get("rv"));
    const type = q.get("type");
    // One-time sync FROM an external system (the URL) after hydration. Reading it during render
    // would make the static HTML disagree with the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlace(p ?? "");
    if (RADII.includes(r)) setRadius(r);
    if (w === "tonight" || w === "weekend" || w === "flexible") setWhen(w);
    const start = q.get("start") as ISODate | null;
    const end = q.get("end") as ISODate | null;
    // A "when" with no dates (the home page sends only the choice) gets that choice's dates.
    if (!start && w === "tonight") setRange({ start: todayISO(), end: addDays(todayISO(), 1) });
    else if (!start && w === "weekend") setRange(thisWeekendRange());
    else if (!start && w === "flexible") setRange({ start: todayISO(), end: addDays(todayISO(), 30) });
    else setRange({ start, end });
    if (n > 0) setFlexNights(n);
    setFilters({ siteType: type === "tent" || type === "cabin" || type === "group" ? type : null, rvLength: rv > 0 ? rv : null, electric: q.get("electric") === "1" });
    setRestoring(true);
  }, []);
  useEffect(() => {
    if (!restoring) return;
    // The restored search runs once its state has landed (Explore's own restore pattern).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestoring(false);
    run();
  }, [restoring, run]);

  // Once there are results, these controls re-run the search (exact dates wait for both ends).
  const runRef = useRef(run);
  useEffect(() => { runRef.current = run; }, [run]);
  const hasResults = results !== null;
  useEffect(() => {
    if (!hasResults) return;
    if (when === "exact" && (!range.start || !range.end)) return;
    const t = window.setTimeout(() => runRef.current(), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately not on results
  }, [radius, when, range.start, range.end, flexNights]);

  const choosePreset = (p: When) => {
    setWhen(p);
    if (p === "tonight") setRange({ start: todayISO(), end: addDays(todayISO(), 1) });
    else if (p === "weekend") setRange(thisWeekendRange());
    else if (p === "flexible") setRange({ start: todayISO(), end: addDays(todayISO(), 30) });
  };

  const datesChosen = Boolean(searched?.range.start && searched?.range.end);
  const openCount = datesChosen ? (results?.filter((c) => c.hasAvailability === true).length ?? 0) : 0;
  const ordered = results && selectedId ? [...results.filter((c) => c.id === selectedId), ...results.filter((c) => c.id !== selectedId)] : results;
  const canFavorite = visitor === "subscriber";

  return (
    <div className="gh">
      <LabBar page="Explore" visitor={visitor} onVisitor={setVisitor}>
        <ScreenLinks visitor={visitor} current="explore" />
        {visitor === "subscriber" && <LabSelect label="Plan" short="Plan" value={plan} onChange={setPlan} options={[["autocart", "Auto-Cart"], ["alerts", "Alerts"]]} />}
        <LabSelect label="Search answers" short="Search" value={answer} onChange={setAnswer} options={[["normal", "Works"], ["fails", "Fails"], ["no-location", "No location"]]} />
      </LabBar>

      <main id="main">
        <AppBand
          visitor={visitor}
          current="explore"
          title="Find a campsite that's open tonight"
          sub={`Live availability across ${CAMPGROUNDS_ROUNDED} campgrounds — every Recreation.gov site in all 50 states, state parks in 34, and national and provincial parks across Canada.`}
          photo={<BandPhoto art={ART.e1} pos="60% 70%" posLg="50% 62%" />}
        />

        <div className="relative mx-auto -mt-[var(--gh-dock)] grid max-w-[var(--gh-max)] items-start gap-6 px-5 pb-[clamp(40px,6vw,80px)] sm:px-8 lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-8">
          {/* The search rail docks across the band's edge, the way search does on the home page. */}
          <form
            role="search"
            aria-label="Search campgrounds"
            onSubmit={(e) => { e.preventDefault(); run(); }}
            className="min-w-0 rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-pop sm:p-5 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:overscroll-contain"
          >
            <label htmlFor="gh-where" className={label}>Where</label>
            <div className="relative">
              <input
                id="gh-where"
                role="combobox"
                value={place}
                onChange={(e) => { setPlace(e.target.value); setPicked(false); setActive(-1); setFocusPlace(true); }}
                onFocus={() => setFocusPlace(true)}
                onBlur={() => window.setTimeout(() => setFocusPlace(false), 150)}
                onKeyDown={(e) => {
                  if (!suggestions.length) return;
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % suggestions.length); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1)); }
                  else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pickSuggestion(suggestions[active].name); }
                  else if (e.key === "Escape") { e.preventDefault(); setFocusPlace(false); setActive(-1); }
                }}
                placeholder="City, park, or ZIP…"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={suggestions.length > 0}
                aria-controls="gh-where-list"
                aria-activedescendant={active >= 0 && suggestions[active] ? `gh-where-opt-${active}` : undefined}
                className="min-h-12 w-full rounded-ch-input border border-ch-line bg-ch-paper py-3 pl-4 pr-12 font-ch-display text-[16px] font-semibold text-ch-ink placeholder:font-ch-body placeholder:font-normal placeholder:text-ch-muted focus-visible:border-ch-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green"
              />
              <button type="button" onClick={locateMe} disabled={locating} aria-label="Use my location" title="Use my location" className="absolute inset-y-0 right-0 grid w-12 cursor-pointer place-items-center rounded-r-ch-input text-ch-muted hover:text-ch-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ch-green disabled:cursor-wait">
                <LocateFixed aria-hidden="true" className={cx("size-5", locating && "animate-pulse motion-reduce:animate-none")} />
              </button>
            </div>
            <ul id="gh-where-list" role="listbox" aria-label="Suggestions" hidden={suggestions.length === 0} className="mt-1 overflow-hidden rounded-ch-input border border-ch-line">
              {suggestions.map((s, i) => (
                <li
                  key={s.name}
                  id={`gh-where-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(s.name)}
                  className={cx("flex min-h-12 w-full cursor-pointer items-center gap-2.5 border-b border-ch-line px-3 py-2 text-left text-[15px] last:border-b-0 hover:bg-ch-paper", i === active ? "bg-ch-shell shadow-[inset_4px_0_0_var(--color-ch-forest)]" : "bg-ch-card")}
                >
                  {s.kind === "campground" ? <Tent aria-hidden="true" className="size-4 shrink-0 text-ch-ink-2" /> : <MapPin aria-hidden="true" className="size-4 shrink-0 text-ch-muted" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ch-ink">{s.name}</span>
                    {s.sub && <span className="block truncate text-[13px] text-ch-muted">{s.sub}</span>}
                  </span>
                  <span className="shrink-0 text-[13px] text-ch-muted">{s.kind}</span>
                </li>
              ))}
            </ul>

            <fieldset className="mt-5">
              <legend className={label}>Within</legend>
              <RadioChips label="Within" options={RADII.map((r) => ({ value: r, label: `${r} mi` }))} value={radius} onChange={setRadius} />
            </fieldset>

            <fieldset className="mt-5">
              <legend className={label}>When</legend>
              <RadioChips
                label="When"
                className="mb-2.5"
                options={([["exact", "Exact dates"], ["tonight", "Tonight"], ["weekend", "This weekend"], ["flexible", "Flexible"]] as const).map(([value, l]) => ({ value: value as When, label: l }))}
                value={when}
                onChange={choosePreset}
              />
              {when === "flexible" && (
                <div className="mb-2.5">
                  <NightsPicker nights={flexNights} onNightsChange={setFlexNights} weekendsOnly={weekendsOnly} onWeekendsOnlyChange={setWeekendsOnly} showWeekendsOnly={false} />
                </div>
              )}
              <DatePicker
                value={range}
                onChange={(v) => { setRange(v); if (when !== "flexible") setWhen("exact"); }}
                label={when === "flexible" ? "Search window" : "Trip dates"}
                meta={when === "flexible" && range.start ? `any ${flexNights}-night stay in this window` : undefined}
              />
            </fieldset>

            <div className="mt-5"><FilterPanel value={filters} onChange={setFilters} /></div>

            <button type="submit" disabled={loading} className={buttonClasses({ fullWidth: true, className: "mt-5 min-h-12 text-[16px]" })}>
              <Search aria-hidden="true" className="size-4.5" />
              {loading ? "Searching…" : "Search"}
            </button>
            {error && <p role="alert" className="mt-3 rounded-ch-input bg-ch-alert-soft px-3 py-2.5 text-[14px] leading-relaxed text-ch-alert-deep">{error}</p>}
          </form>

          <section aria-label="Results" aria-busy={loading} className="min-w-0 lg:pt-[calc(var(--gh-dock)+24px)]">
            {/* One short line is announced, not every card in the list. */}
            <p role="status" className="sr-only">{loading ? "Searching…" : results === null || !searched ? "" : openCount > 0 ? `${results.length} campgrounds, ${openCount} with openings` : `${results.length} campgrounds, none with openings for those dates`}</p>
            <StatusBox visitor={visitor} />
            {results === null && !loading && <FirstRun visitor={visitor} />}
            {loading && <ResultsSkeleton />}
            {results !== null && searched && !loading && (
              <>
                <div className="mb-4">
                  <h2 className="font-ch-display text-[clamp(24px,2.4vw,30px)] font-extrabold tracking-[-.02em] text-ch-ink">
                    {openCount > 0 ? `${openCount} campground${openCount === 1 ? "" : "s"} with openings` : `${results.length} campground${results.length === 1 ? "" : "s"} nearby`}
                  </h2>
                  <p className="mt-0.5 text-[15px] text-ch-ink-2">within {searched.radius} mi of {searched.place === "Near me" || searched.place === "My location" ? `you (${ORIGIN})` : searched.place}</p>
                </div>
                {results.length > 0 && <ResultsMap results={results} datesChosen={datesChosen} selectedId={selectedId} onSelect={setSelectedId} />}
                {results.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {ordered!.map((c) => (
                      <div key={c.id} className={selectedId === c.id ? "rounded-ch-card ring-2 ring-ch-ink ring-offset-2 ring-offset-ch-paper" : undefined}>
                        <ResultCard
                          c={c}
                          visitor={visitor}
                          searched={searched}
                          backTo={backTo}
                          favorite={favorites.has(c.id)}
                          onToggleFavorite={canFavorite ? () => setFavorites((f) => { const n = new Set(f); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; }) : undefined}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-ch-card border border-ch-line bg-ch-card p-5 text-[16px] text-ch-ink-2">Nothing within {searched.radius} mi. Try a wider radius.</p>
                )}
                {results.length > 0 && openCount < results.length && (
                  <div className="mt-5 rounded-ch-card border border-dashed border-ch-line bg-ch-card p-6 text-center sm:p-8">
                    {/* CampHawk's title, unless something IS open: then it would contradict the heading. */}
                    <h3 className="font-ch-display text-[20px] font-extrabold text-ch-ink">{openCount > 0 ? "The one you wanted is booked?" : "Nothing open for your dates?"}</h3>
                    <p className="mx-auto mb-4 mt-1.5 max-w-[46ch] text-[16px] leading-relaxed text-ch-ink-2">The good spots are booked, not gone. Set a watch and we&apos;ll alert you within seconds of a cancellation.</p>
                    {visitor === "signed-out"
                      ? <a href="#" className={buttonClasses({ variant: "ink", className: "px-5" })}>Start {TRIAL_DAYS}-day free trial</a>
                      : <Link href={withVisitor(`${ROUTES.newWatch}${searched.range.start && searched.range.end ? `?start=${searched.range.start}&end=${searched.range.end}` : ""}`, visitor)} className={buttonClasses({ className: "px-5" })}>Create a watch</Link>}
                  </div>
                )}
                <LabNote className="mt-4">Example data, as if today were Monday, July 6.</LabNote>
              </>
            )}
            <PricingLink visitor={visitor} plan={plan} className="mt-5" />
          </section>
        </div>
      </main>
      <GhFooter visitor={visitor} />
    </div>
  );
}
