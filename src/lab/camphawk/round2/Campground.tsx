"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../ui";
import type { Visitor } from "../data";
import { LabBar } from "../LabBar";
import { Tag } from "../ui/Tag";
import { Art, ART } from "./Art";
import { GhFooter, PhotoHeader } from "./GhChrome";
import {
  CAMPGROUND, FIRST_COME_BADGE, FIRST_COME_WHY, FIRST_MONTH, LAST_MONTH, MONTHS, SITES, TODAY,
  dayLabel, daysIn, firstWeekday, monthLabel, openingsBody, openingsHeading, pad2, shiftMonth,
} from "./campground-data";

// Screen 2 in the Golden hour look: CampHawk's campground page (campsite-finder
// src/components/v2/CampgroundDetail.tsx, AvailabilityGrid.tsx, WatchCta.tsx and
// CampgroundOpenings.tsx), ported with example data. Contract: docs/design/camphawk-home.md,
// "Screen 2". What it keeps from CampHawk, on purpose:
// - Booked days are neutral and struck through, never red; open days carry a dot and a word.
//   A month we couldn't read gets NO marks and says so: an absent reading is not "booked".
// - The watch button follows WatchCta's gate: one control, a label per visitor, never a price.
// - A first-come campground shows its policy, not an empty calendar (which would read as
//   "booked solid", the opposite of the truth), and offers no watch.

type Booking = "reservable" | "first-come";

/** WatchCta's labels, driven by the lab's "View as" instead of Clerk and the native bridge. */
function WatchButton({ visitor, className }: { visitor: Visitor; className?: string }) {
  const label = visitor === "subscriber" ? "Watch this campground" : visitor === "app" ? "Subscribe to watch" : "Sign up to watch";
  return <a href="#" className={buttonClasses({ size: "lg", className: cx("px-6", className) })}>{label}</a>;
}

function Calendar() {
  const [month, setMonth] = useState(FIRST_MONTH);
  const [selected, setSelected] = useState<string | null>("2026-07-18");
  const data = MONTHS[month];
  const known = !data.unknown;
  const total = daysIn(month);
  const cells: (string | null)[] = [
    ...Array<null>(firstWeekday(month)).fill(null),
    ...Array.from({ length: total }, (_, i) => `${month}-${pad2(i + 1)}`),
  ];
  const openDays = Object.keys(data.open).filter((d) => d >= TODAY);
  const picked = selected && selected.startsWith(month) ? selected : null;
  const pickedSites = picked ? (data.open[picked] ?? []).map((id) => SITES[id]) : [];
  const shift = (by: number) => { setMonth(shiftMonth(month, by)); setSelected(null); };
  const canBack = month > FIRST_MONTH;
  const canForward = month < LAST_MONTH;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5">
      <div className="rounded-ch-card border border-ch-line bg-ch-card p-3 shadow-ch-card sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button type="button" onClick={() => shift(-1)} disabled={!canBack} aria-label="Previous month" className="grid size-11 cursor-pointer place-items-center rounded-ch-input border border-ch-line bg-ch-paper text-ch-ink-2 hover:border-ch-green hover:text-ch-green disabled:cursor-default disabled:border-ch-line disabled:text-ch-faint">
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <h2 aria-live="polite" className="font-ch-display text-[22px] font-extrabold tracking-[-.02em] text-ch-ink">{monthLabel(month)}</h2>
          <button type="button" onClick={() => shift(1)} disabled={!canForward} aria-label="Next month" className="grid size-11 cursor-pointer place-items-center rounded-ch-input border border-ch-line bg-ch-paper text-ch-ink-2 hover:border-ch-green hover:text-ch-green disabled:cursor-default disabled:border-ch-line disabled:text-ch-faint">
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
            const isBooked = known && !isPast && !isOpen;
            const on = picked === day;
            const label = isPast ? `${dayLabel(day)}, past`
              : !known ? `${dayLabel(day)}, couldn't check`
              : isOpen ? `${dayLabel(day)}, ${sites.length} site${sites.length === 1 ? "" : "s"} open`
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
                  isPast && "cursor-default text-ch-faint",
                  !known && !isPast && "cursor-default text-ch-muted",
                )}
              >
                {n}
                {isOpen && <span aria-hidden="true" className={cx("mt-0.5 size-[5px] rounded-full", on ? "bg-ch-card" : "bg-ch-green-deep")} />}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ch-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="inline-flex size-4 items-end justify-center rounded-[4px] bg-ch-green-soft pb-[2px]"><span className="size-[4px] rounded-full bg-ch-green-deep" /></i>
            Sites open
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="not-italic font-semibold text-ch-muted line-through decoration-[1.5px]">12</i>
            Fully booked
          </span>
          <span className="font-bold text-ch-ink sm:ml-auto">
            {!known ? "Couldn't check this month" : openDays.length ? `${openDays.length} day${openDays.length === 1 ? "" : "s"} with openings` : "Nothing open this month"}
          </span>
        </div>
        {!known && (
          <p className="mt-3 rounded-ch-input bg-ch-paper px-3 py-2.5 text-[14px] leading-relaxed text-ch-ink-2">
            We can&apos;t show this month&apos;s calendar right now. A watch still checks it for openings around the clock.
          </p>
        )}
      </div>

      <aside aria-label="Selected day" className="rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-card sm:p-6">
        <h3 className="font-ch-display text-[19px] font-bold text-ch-ink">{picked ? dayLabel(picked) : "Pick a day"}</h3>
        <p className="mt-1 text-[15px] text-ch-ink-2">
          {picked
            ? pickedSites.length ? `${pickedSites.length} site${pickedSites.length === 1 ? "" : "s"} open` : "Fully booked"
            : !known ? "Nothing to pick until this month can be read."
            : openDays.length === 0 ? "No day this month has a free site."
            : "Tap any highlighted day to see which sites are free."}
        </p>
        {pickedSites.length > 0 && (
          <ul className="mt-3 border-t border-ch-line">
            {pickedSites.map((s) => (
              <li key={s.id} className="flex items-center gap-3 border-b border-ch-line py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="font-ch-display text-[16px] font-bold text-ch-ink">{s.name}</p>
                  <p className="text-[14px] text-ch-muted">{s.loop}, {s.type.toLowerCase()}</p>
                </div>
                <Tag kind="open">Open</Tag>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

export function Campground() {
  const [visitor, setVisitor] = useState<Visitor>("signed-out");
  const [booking, setBooking] = useState<Booking>("reservable");
  const watchable = booking === "reservable";
  const { name, place, provider, description, amenities, phone } = CAMPGROUND;
  return (
    <div className="gh">
      <LabBar page="Campground" visitor={visitor} onVisitor={setVisitor}>
        <Link href="/private/camphawk/golden-hour" className="flex min-h-11 items-center whitespace-nowrap underline-offset-2 hover:underline">Golden hour home</Link>
        <div role="radiogroup" aria-label="Booking" className="flex items-center gap-1 rounded-ch-chip bg-ch-white/10 p-0.5">
          {(["reservable", "first-come"] as const).map((b) => (
            <button key={b} type="button" role="radio" aria-checked={booking === b} onClick={() => setBooking(b)} className={cx("flex min-h-10 items-center gap-1 whitespace-nowrap rounded-ch-chip px-3 font-bold", booking === b ? "bg-ch-white text-ch-forest" : "text-ch-white hover:bg-ch-white/15")}>
              {booking === b && <span aria-hidden="true">✓</span>}
              {b === "reservable" ? "Reservations" : "First come"}
            </button>
          ))}
        </div>
      </LabBar>

      <main id="main">
        <section className="relative bg-ch-forest">
          <PhotoHeader visitor={visitor} />
          <div className="mx-auto max-w-[var(--gh-max)] px-5 pt-6 sm:px-8 sm:pt-10">
            <a href="#" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-bold text-ch-line hover:text-ch-white">
              <ChevronLeft aria-hidden="true" className="size-4" /> Back to search
            </a>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-x-10 gap-y-5 pb-[clamp(96px,14vw,168px)]">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {!watchable && <Tag kind="paused" srPrefix="Booking:">{FIRST_COME_BADGE}</Tag>}
                  {watchable && CAMPGROUND.autoCart && <Tag kind="cart">Auto-cart</Tag>}
                  <Tag kind="src">{provider}</Tag>
                </div>
                <h1 className="font-ch-display text-[clamp(40px,6vw,72px)] font-extrabold leading-[1] tracking-[-.03em] text-ch-paper">{name}</h1>
                <p className="mt-2 text-[17px] text-ch-line">{place}</p>
              </div>
              {watchable && <WatchButton visitor={visitor} className="w-full sm:w-auto" />}
            </div>
          </div>
        </section>

        {/* The photos dock across the band's bottom edge, the way search does on the home page. */}
        <div className="relative mx-auto -mt-[clamp(72px,11vw,128px)] max-w-[var(--gh-max)] px-3 sm:px-8">
          <div className="grid grid-cols-2 gap-2 sm:auto-rows-[clamp(200px,22vw,300px)] sm:grid-cols-4 sm:gap-3">
            <Art art={ART.c1} eager sizes="(min-width: 640px) 50vw, 100vw" alt={`${name}, the campground loop at dusk`} className="col-span-2 aspect-[16/9] w-full rounded-ch-card bg-ch-forest object-cover shadow-ch-pop sm:aspect-auto sm:h-full" />
            <Art art={ART.c2} sizes="(min-width: 640px) 25vw, 50vw" alt={`${name}, a campsite with a fire ring`} className="aspect-square w-full rounded-ch-card bg-ch-forest object-cover shadow-ch-pop sm:aspect-auto sm:h-full" />
            <Art art={ART.c3} sizes="(min-width: 640px) 25vw, 50vw" alt="The river near the campground at dusk" className="aspect-square w-full rounded-ch-card bg-ch-forest object-cover shadow-ch-pop sm:aspect-auto sm:h-full" />
          </div>
        </div>

        <section aria-label="Availability" className="mx-auto max-w-[var(--gh-max)] px-3 pt-8 sm:px-8 sm:pt-10">
          {watchable ? (
            <Calendar />
          ) : (
            <div className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card sm:p-7">
              <h2 className="font-ch-display text-[22px] font-extrabold text-ch-ink">{FIRST_COME_BADGE}</h2>
              <p className="mt-2 max-w-[62ch] text-[16px] leading-relaxed text-ch-ink-2">{FIRST_COME_WHY}</p>
            </div>
          )}
          <p className="mt-3 px-1 text-[14px] text-ch-ink-2">Example data. Photos are illustrations, not the campground.</p>
        </section>

        <div className="mx-auto grid max-w-[var(--gh-max)] gap-4 px-3 py-[clamp(40px,6vw,72px)] sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-5">
          <section className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card sm:p-7">
            <h2 className="font-ch-display text-[22px] font-extrabold text-ch-ink">About</h2>
            <p className="mt-2 max-w-[62ch] text-[16px] leading-relaxed text-ch-ink-2">{description}</p>
            <h3 className="mt-5 text-[14px] font-bold text-ch-ink">Amenities</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {amenities.map((a) => <li key={a} className="rounded-ch-chip border border-ch-line px-3 py-1.5 text-[14px] text-ch-ink-2">{a}</li>)}
            </ul>
            <p className="mt-4 flex items-center text-[16px] text-ch-ink-2">
              <span className="text-ch-muted">Phone:&nbsp;</span>
              <a href="#" className="inline-flex min-h-11 items-center font-bold text-ch-green tabular-nums underline-offset-2 hover:underline">{phone}</a>
            </p>
          </section>
          <section className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card sm:p-7">
            <h2 className="font-ch-display text-[22px] font-extrabold text-ch-ink">{openingsHeading(name)}</h2>
            <div className="mt-2 max-w-[66ch] space-y-3">
              {openingsBody(name, place, CAMPGROUND.autoCart).map((t) => (
                <p key={t.slice(0, 40)} className="text-[16px] leading-relaxed text-ch-ink-2">{t}</p>
              ))}
            </div>
            <p className="mt-4 text-[15px] text-ch-ink-2">
              Fully booked? <a href="#" className="font-bold text-ch-green underline-offset-2 hover:underline">What actually works when a campground is sold out</a>.
            </p>
          </section>
        </div>
      </main>
      <GhFooter />
    </div>
  );
}
