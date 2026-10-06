"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../ui";
import type { Visitor } from "../data";
import { LabBar, radioKeys } from "../LabBar";
import { Tag } from "../ui/Tag";
import { Art, ART } from "./Art";
import { LabNote } from "./LabPage";
import { GhFooter, PhotoHeader, ScreenLinks } from "./GhChrome";
import { canWatch, ROUTES, watchCtaLabel } from "./gates";
import { campgroundFor } from "./campground-lookup";
import { useUrlParam, useUrlState, useVisitor, withVisitor } from "./labState";
import {
  FIRST_COME_BADGE, FIRST_COME_WHY, FIRST_MONTH, LAST_MONTH, SITES, TODAY, type Month,
  dayLabel, daysIn, firstWeekday, monthLabel, openingsBody, openingsHeading, pad2, shiftMonth,
} from "./campground-data";

// Screen 2 in the Golden hour look: CampHawk's campground page (campsite-finder
// src/components/v2/CampgroundDetail.tsx, AvailabilityGrid.tsx, WatchCta.tsx and
// CampgroundOpenings.tsx), ported with example data. Contract: docs/design/camphawk-home.md,
// "Screen 2". What it keeps from CampHawk, on purpose:
// - The answer comes first: whether anything is open, in words, under the name.
// - Booked days are neutral and struck through, never red; open days carry a dot; days that are
//   not open for booking carry a bar. A month we couldn't read gets NO marks and says so: an
//   absent reading is not "booked". A failed request is said in words, without internals.
// - The watch button follows WatchCta's gate: one control, a label per visitor, never a price.
// - A first-come campground shows its policy, not an empty calendar (which would read as
//   "booked solid", the opposite of the truth), and offers no watch.

type Booking = "reservable" | "first-come";
/** CampgroundDetail's page states: the content, its loading skeleton, a 404, and a failed load. */
type PageState = "loaded" | "loading" | "missing" | "failed";
/** Where the visitor came from: an in-app search gets "Back to search"; a cold arrival from
    Google has no "back", so it gets the breadcrumb (CampgroundDetail's rule). */
type Arrival = "search" | "google";

const labSelect = "min-h-11 cursor-pointer rounded-ch-chip border border-ch-white/40 bg-ch-forest px-3 font-bold text-ch-white";

/** WatchCta for this page: a subscriber goes to New watch with the campground and the picked
    nights filled in; everyone else gets the step open to them (gates.ts). The lab doesn't
    build sign-up or checkout, so those stay put. */
function watchHref(visitor: Visitor, id: string, start?: string, end?: string): string {
  if (!canWatch(visitor)) return "#";
  const q = new URLSearchParams({ campground: id, ...(start && end ? { start, end } : {}) });
  return withVisitor(`${ROUTES.newWatch}?${q}`, visitor);
}

const firstMonthName = monthLabel(FIRST_MONTH).split(" ")[0];

/** The answer, for the band: the openings in the first month from today, in words. */
function OpenSummary({ months }: { months: Record<string, Month> }) {
  const first = months[FIRST_MONTH];
  // An unread month is not a booked one: say we couldn't check.
  if (first.unknown || first.error) return <p className="mt-4 text-[17px] text-ch-line">We couldn&apos;t check {firstMonthName} just now. A watch keeps checking around the clock.</p>;
  const open = Object.keys(first.open).filter((d) => d >= TODAY).sort();
  if (!open.length) return <p className="mt-4 text-[17px] text-ch-line">Nothing open in {firstMonthName} right now.</p>;
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[17px] text-ch-paper">
      <Tag kind="open">Sites open</Tag>
      <span>
        <strong className="font-bold">{open.length} days with openings in {firstMonthName}.</strong>{" "}
        <span className="text-ch-line">The next is {dayLabel(open[0])}.</span>
      </span>
    </p>
  );
}

function Calendar({ visitor, id, months }: { visitor: Visitor; id: string; months: Record<string, Month> }) {
  const [month, setMonth] = useState(FIRST_MONTH);
  const [selected, setSelected] = useState<string | null>(() => (months[FIRST_MONTH].open["2026-07-18"] ? "2026-07-18" : null));
  const data = months[month];
  const unread = Boolean(data.unknown || data.error);
  const known = !unread;
  const total = daysIn(month);
  const cells: (string | null)[] = [
    ...Array<null>(firstWeekday(month)).fill(null),
    ...Array.from({ length: total }, (_, i) => `${month}-${pad2(i + 1)}`),
  ];
  const openDays = Object.keys(data.open).filter((d) => d >= TODAY);
  const picked = selected && selected.startsWith(month) ? selected : null;
  const pickedSites = picked ? (data.open[picked] ?? []).map((id) => SITES[id]) : [];
  const shift = (by: number) => { setMonth(shiftMonth(month, by)); setSelected(null); };
  const summary = data.error ? "Availability unavailable"
    : data.unknown ? "Couldn't check this month"
    : data.closed ? "Not open for booking this month"
    : openDays.length ? `${openDays.length} day${openDays.length === 1 ? "" : "s"} with openings`
    : "Nothing open this month";
  const navButton = "grid size-11 cursor-pointer place-items-center rounded-ch-input border border-ch-line bg-ch-paper text-ch-ink-2 hover:border-ch-ink-2 hover:text-ch-ink disabled:cursor-default disabled:border-ch-line disabled:text-ch-faint";

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-5">
      <div className="rounded-ch-card border border-ch-line bg-ch-card p-3 shadow-ch-card sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button type="button" onClick={() => shift(-1)} disabled={month <= FIRST_MONTH} aria-label="Previous month" className={navButton}>
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <h2 aria-live="polite" className="font-ch-display text-[22px] font-extrabold tracking-[-.02em] text-ch-ink">{monthLabel(month)}</h2>
          <button type="button" onClick={() => shift(1)} disabled={month >= LAST_MONTH} aria-label="Next month" className={navButton}>
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div aria-hidden="true" className="mb-1.5 grid grid-cols-7 text-center text-[12px] font-bold text-ch-muted">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {cells.map((day, i) => {
            if (!day) return <div key={`blank-${i}`} className="aspect-square sm:aspect-auto sm:h-14" />;
            const n = Number(day.slice(8));
            const isPast = day < TODAY;
            const sites = data.open[day] ?? [];
            const isOpen = known && !isPast && sites.length > 0;
            const isClosed = known && !isPast && Boolean(data.closed);
            const isBooked = known && !isPast && !isOpen && !isClosed;
            const on = picked === day;
            const label = isPast ? `${dayLabel(day)}, past`
              : !known ? `${dayLabel(day)}, couldn't check`
              : isOpen ? `${dayLabel(day)}, ${sites.length} site${sites.length === 1 ? "" : "s"} open`
              : isClosed ? `${dayLabel(day)}, not open for booking`
              : `${dayLabel(day)}, fully booked`;
            return (
              <button
                key={day}
                type="button"
                disabled={!isOpen}
                aria-label={label}
                aria-pressed={isOpen ? on : undefined}
                onClick={() => setSelected(day)}
                className={cx(
                  "flex aspect-square flex-col items-center justify-center rounded-[11px] text-[15px] font-semibold tabular-nums sm:aspect-auto sm:h-14 sm:text-[16px]",
                  isOpen && !on && "cursor-pointer bg-ch-green-soft font-bold text-ch-green-deep hover:bg-ch-green-soft-hover",
                  isOpen && on && "cursor-pointer bg-ch-green font-bold text-ch-white",
                  isBooked && "cursor-default text-ch-muted line-through decoration-[1.5px]",
                  (isClosed || !known) && !isPast && "cursor-default text-ch-muted",
                  isPast && "cursor-default text-ch-faint",
                )}
              >
                {n}
                {isOpen && <span aria-hidden="true" className={cx("mt-0.5 size-[5px] rounded-full", on ? "bg-ch-card" : "bg-ch-green-deep")} />}
                {isClosed && <span aria-hidden="true" className="mt-1 h-[2px] w-2.5 rounded-full bg-ch-faint" />}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ch-ink-2">
          {/* Each key repeats the mark its days carry, so it reads without hue. */}
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="inline-flex size-4 items-end justify-center rounded-[4px] bg-ch-green-soft pb-[2px]"><span className="size-[4px] rounded-full bg-ch-green-deep" /></i>
            Sites open
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="not-italic font-semibold text-ch-muted line-through decoration-[1.5px]">12</i>
            Fully booked
          </span>
          {data.closed && (
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className="inline-flex size-4 items-end justify-center pb-[3px]"><span className="h-[2px] w-2.5 rounded-full bg-ch-faint" /></i>
              Not open for booking
            </span>
          )}
          {cells.some((d) => d && d < TODAY) && (
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className="not-italic font-semibold text-ch-faint">3</i>
              Past
            </span>
          )}
          <span className="font-bold text-ch-ink sm:ml-auto">{summary}</span>
        </div>
        {data.unknown && (
          <p className="mt-3 rounded-ch-input bg-ch-paper px-3 py-2.5 text-[14px] leading-relaxed text-ch-ink-2">
            We can&apos;t show this month&apos;s calendar right now. A watch still checks it for openings around the clock.
          </p>
        )}
        {data.error && (
          <p role="alert" className="mt-3 rounded-ch-input bg-ch-alert-soft px-3 py-2.5 text-[14px] leading-relaxed text-ch-alert-deep">
            We couldn&apos;t load this month&apos;s availability. This is usually the reservation provider, not your connection.
          </p>
        )}
      </div>

      <aside aria-label="Selected day" className="rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-card sm:p-6">
        <h3 className="font-ch-display text-[19px] font-bold text-ch-ink">{picked ? dayLabel(picked) : "Pick a day"}</h3>
        <p className="mt-1 text-[15px] text-ch-ink-2">
          {picked
            ? pickedSites.length ? `${pickedSites.length} site${pickedSites.length === 1 ? "" : "s"} open` : "Fully booked"
            : unread ? "Nothing to pick until this month can be read."
            : openDays.length === 0 ? "No day this month has a free site."
            : "Tap any highlighted day to see which sites are free."}
        </p>
        {pickedSites.length > 0 && (
          <ul className="mt-3 border-t border-ch-line">
            {pickedSites.map((s) => (
              <li key={s.id} className="flex items-center gap-3 border-b border-ch-line py-3 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="block font-ch-display text-[16px] font-bold text-ch-ink">{s.name}</span>
                  <span className="block text-[14px] text-ch-ink-2">{s.loop}, {s.type}</span>
                </span>
                {/* An open site gets you there: the blue hand-off to the booking site (lab change;
                    CampHawk's day panel only offers a watch). */}
                <a href="#" aria-label={`Book ${s.name} (opens the booking site)`} className={buttonClasses({ variant: "cart", size: "sm", className: "min-h-11 shrink-0 px-4" })}>Book<ExternalLink aria-hidden="true" className="size-3.5" /></a>
              </li>
            ))}
          </ul>
        )}
        {/* The next step after the calendar: the same gated watch control as the band. */}
        <div className="mt-2 border-t border-ch-line pt-4">
          <p className="text-[15px] leading-relaxed text-ch-ink-2">Not the nights you need? We can watch your dates and tell you the second a site opens.</p>
          <Link href={watchHref(visitor, id)} className={buttonClasses({ variant: "quiet", fullWidth: true, className: "mt-3" })}>{watchCtaLabel(visitor, "Watch this campground")}</Link>
        </div>
      </aside>
    </div>
  );
}

export function Campground() {
  const [visitor, setVisitor] = useVisitor();
  const [bookingSwitch, setBooking] = useUrlState<Booking>("booking", "reservable", ["reservable", "first-come"]);
  const [page, setPage] = useUrlState<PageState>("state", "loaded", ["loaded", "loading", "missing", "failed"]);
  const [arrival, setArrival] = useUrlState<Arrival>("from", "search", ["search", "google"]);
  // Arriving from Explore carries the search, so "Back to search" restores it.
  const backQuery = useUrlParam("back");
  const searchHref = withVisitor(`${ROUTES.explore}${backQuery?.startsWith("?") ? backQuery : ""}`, visitor);
  const { info: CAMPGROUND, months } = campgroundFor(useUrlParam("id"));
  // A campground that takes no reservations is first come whatever the switch says.
  const booking: Booking = CAMPGROUND.reservable ? bookingSwitch : "first-come";
  const watchable = booking === "reservable";
  const { name, place, provider, description, amenities, phone, stateName } = CAMPGROUND;
  const back = (
    <Link href={searchHref} className="inline-flex min-h-11 items-center gap-1 text-[15px] font-bold text-ch-line hover:text-ch-white">
      <ChevronLeft aria-hidden="true" className="size-4" /> Back to search
    </Link>
  );
  const crumbs = (
    <nav aria-label="Breadcrumb" className="flex min-h-11 flex-wrap items-center gap-x-1.5 text-[15px] text-ch-line">
      {["CampHawk", "Camping by state", stateName].map((c) => (
        <span key={c} className="inline-flex items-center gap-1.5">
          <a href="#" className="inline-flex min-h-11 items-center font-bold hover:text-ch-white hover:underline">{c}</a>
          <span aria-hidden="true">›</span>
        </span>
      ))}
      <span aria-current="page">{name}</span>
    </nav>
  );
  return (
    <div className="gh">
      <LabBar page="Campground" visitor={visitor} onVisitor={setVisitor}>
        <ScreenLinks visitor={visitor} current="campground" />
        <div role="radiogroup" aria-label="Booking" onKeyDown={radioKeys(["reservable", "first-come"] as const, booking, setBooking)} className="flex items-center gap-1 rounded-ch-chip bg-ch-white/10 p-0.5">
          {(["reservable", "first-come"] as const).map((b) => (
            <button key={b} type="button" role="radio" aria-checked={booking === b} tabIndex={booking === b ? 0 : -1} onClick={() => setBooking(b)} className={cx("flex min-h-10 items-center gap-1 whitespace-nowrap rounded-ch-chip px-3 font-bold", booking === b ? "bg-ch-white text-ch-forest" : "text-ch-white hover:bg-ch-white/15")}>
              {booking === b && <span aria-hidden="true">✓</span>}
              {b === "reservable" ? "Reservations" : "First come"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2"><span aria-hidden="true" className="font-bold">Page</span>
          <select aria-label="Page state" value={page} onChange={(e) => setPage(e.target.value as PageState)} className={labSelect}>
            <option value="loaded">Loaded</option>
            <option value="loading">Loading</option>
            <option value="missing">Not found</option>
            <option value="failed">Couldn&apos;t load</option>
          </select>
        </label>
        <label className="flex items-center gap-2"><span aria-hidden="true" className="font-bold">From</span>
          <select aria-label="Arrived from" value={arrival} onChange={(e) => setArrival(e.target.value as Arrival)} className={labSelect}>
            <option value="search">Search</option>
            <option value="google">Google</option>
          </select>
        </label>
      </LabBar>

      {page !== "loaded" ? (
        <main id="main">
          <section className="bg-ch-forest pb-[clamp(56px,8vw,112px)]">
            <PhotoHeader visitor={visitor} />
            <div className="mx-auto max-w-[var(--gh-max)] px-5 pt-4 sm:px-8 sm:pt-8">
              {page === "loading" && (
                <div role="status">
                  <span className="sr-only">Loading this campground…</span>
                  <div aria-hidden="true" className="mt-14 h-12 w-72 max-w-full animate-pulse rounded-ch-input bg-ch-white/10 motion-reduce:animate-none" />
                  <div aria-hidden="true" className="mt-3 h-5 w-44 animate-pulse rounded-ch-input bg-ch-white/10 motion-reduce:animate-none" />
                  <div aria-hidden="true" className="mt-8 h-[260px] animate-pulse rounded-ch-card bg-ch-white/10 motion-reduce:animate-none" />
                </div>
              )}
              {page === "missing" && (
                <div className="pt-10">
                  <h1 className="font-ch-display text-[clamp(34px,4.5vw,48px)] font-extrabold leading-[1.05] tracking-[-.03em] text-ch-paper">Campground not found</h1>
                  <p className="mt-3 text-[17px] text-ch-line">We don&apos;t have this campground.</p>
                  <Link href={searchHref} className={buttonClasses({ variant: "quiet", className: "mt-6 px-5" })}>Back to search</Link>
                </div>
              )}
              {page === "failed" && (
                <div className="pt-10">
                  <h1 className="font-ch-display text-[clamp(34px,4.5vw,48px)] font-extrabold leading-[1.05] tracking-[-.03em] text-ch-paper">We couldn&apos;t load this campground</h1>
                  <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-ch-line">
                    Something went wrong on our side or with the connection — this doesn&apos;t mean the campground is gone. Try again in a moment.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <button type="button" onClick={() => setPage("loaded")} className={buttonClasses({ variant: "ink", className: "px-5" })}>Try again</button>
                    <Link href={searchHref} className={buttonClasses({ variant: "quiet", className: "px-5" })}>Back to search</Link>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      ) : (
      <main id="main">
        <section className="relative bg-ch-forest">
          <PhotoHeader visitor={visitor} />
          <div className="mx-auto max-w-[var(--gh-max)] px-5 pt-4 sm:px-8 sm:pt-8">
            {arrival === "google" ? crumbs : back}
            <div className="mt-2 flex flex-wrap items-end justify-between gap-x-10 gap-y-5 pb-[clamp(56px,8vw,112px)]">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {!watchable && <Tag kind="paused" mark="first-come" srPrefix="Booking:">{FIRST_COME_BADGE}</Tag>}
                  {watchable && CAMPGROUND.autoCart && <Tag kind="cart" mark="auto-cart">Auto-cart</Tag>}
                  <Tag kind="src">{provider}</Tag>
                </div>
                <h1 className="font-ch-display text-[clamp(40px,5vw,56px)] font-extrabold leading-[1] tracking-[-.03em] text-ch-paper">{name}</h1>
                <p className="mt-2 text-[17px] text-ch-line">{place}</p>
                {watchable && <OpenSummary months={months} />}
              </div>
              {watchable && <Link href={watchHref(visitor, CAMPGROUND.id)} className={buttonClasses({ variant: canWatch(visitor) ? "primary" : "paper", size: "lg", className: "w-full px-6 sm:w-auto" })}>{watchCtaLabel(visitor, "Watch this campground")}</Link>}
            </div>
          </div>
        </section>

        {/* The photos dock across the band's bottom edge, the way search does on the home page.
            Phones show one, so the calendar starts sooner. */}
        <div className="relative mx-auto -mt-[clamp(40px,6vw,88px)] max-w-[var(--gh-max)] px-5 sm:px-8">
          <div className="grid gap-2 sm:auto-rows-[clamp(150px,13vw,200px)] sm:grid-cols-4 sm:gap-3">
            <Art art={ART.c1} eager sizes="(min-width: 640px) 50vw, 100vw" alt={`${name}, the campground loop at dusk`} className="aspect-[16/9] w-full rounded-ch-card bg-ch-forest object-cover shadow-ch-pop sm:col-span-2 sm:aspect-auto sm:h-full" />
            <Art art={ART.c2} sizes="25vw" alt={`${name}, a campsite with a fire ring`} className="hidden size-full rounded-ch-card bg-ch-forest object-cover shadow-ch-pop sm:block" />
            <Art art={ART.c3} sizes="25vw" alt="The river near the campground at dusk" className="hidden size-full rounded-ch-card bg-ch-forest object-cover shadow-ch-pop sm:block" />
          </div>
        </div>

        <section aria-label="Availability" className="mx-auto max-w-[var(--gh-max)] px-5 pt-6 sm:px-8 sm:pt-8">
          {watchable ? (
            <Calendar key={CAMPGROUND.id} visitor={visitor} id={CAMPGROUND.id} months={months} />
          ) : (
            <div className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card sm:p-7">
              <h2 className="font-ch-display text-[22px] font-extrabold text-ch-ink">{FIRST_COME_BADGE}</h2>
              <p className="mt-2 max-w-[62ch] text-[16px] leading-relaxed text-ch-ink-2">{FIRST_COME_WHY}</p>
            </div>
          )}
          <LabNote className="mt-3">Example data. Photos are illustrations, not the campground.</LabNote>
        </section>

        <div className="mx-auto grid max-w-[var(--gh-max)] gap-x-14 gap-y-8 px-5 py-[clamp(40px,6vw,80px)] sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <section className="self-start rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card sm:p-7">
            <h2 className="font-ch-display text-[22px] font-extrabold text-ch-ink">About</h2>
            <p className="mt-2 max-w-[62ch] text-[16px] leading-relaxed text-ch-ink-2">{description}</p>
            <h3 className="mt-5 text-[14px] font-bold text-ch-ink">Amenities</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {amenities.map((a) => <li key={a} className="rounded-ch-tag border border-ch-line bg-ch-paper px-2.5 py-1.5 text-[14px] text-ch-ink-2">{a}</li>)}
            </ul>
            <p className="mt-4 flex items-center text-[16px] text-ch-ink-2">
              <span className="text-ch-muted">Phone:&nbsp;</span>
              <a href="#" className="inline-flex min-h-11 items-center whitespace-nowrap font-bold text-ch-forest tabular-nums underline underline-offset-2 hover:decoration-2">{phone}</a>
            </p>
          </section>
          {/* Plain prose on paper, not a second card: this is the reading part of the page. */}
          <section className="px-2 sm:px-0">
            <h2 className="font-ch-display text-[clamp(26px,3vw,34px)] font-extrabold leading-tight tracking-[-.02em] text-ch-forest">{watchable && Object.keys(months[FIRST_MONTH].open).some((d) => d >= TODAY) ? `When ${name} books up` : openingsHeading(name)}</h2>
            <div className="mt-3 max-w-[66ch] space-y-3">
              {openingsBody(name, place, CAMPGROUND.autoCart).map((t) => (
                <p key={t.slice(0, 40)} className="text-[17px] leading-relaxed text-ch-ink-2">{t}</p>
              ))}
            </div>
            <p className="mt-5 text-[16px] text-ch-ink-2">
              Fully booked? <a href="#" className="font-bold text-ch-forest underline underline-offset-2 hover:decoration-2">What actually works when a campground is sold out</a>.
            </p>
            <p className="mt-2 text-[16px] text-ch-ink-2">
              Also booked out? See <a href="#" className="font-bold text-ch-forest underline underline-offset-2 hover:decoration-2">every {stateName} campground we watch</a>, or <a href="#" className="font-bold text-ch-forest underline underline-offset-2 hover:decoration-2">browse by state</a>.
            </p>
          </section>
        </div>
      </main>
      )}
      <GhFooter visitor={visitor} />
    </div>
  );
}
