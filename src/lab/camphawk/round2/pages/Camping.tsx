"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import type { Visitor } from "../../data";
import { CAMPGROUNDS_ROUNDED } from "../../data";
import { ART } from "../Art";
import { ROUTES } from "../gates";
import { A, LabNote, LabPage } from "../LabPage";
import { withVisitor } from "../labState";
import { CHECK_SECONDS, SOURCE_COUNT, inWords } from "./tier2-data";
import {
  CALIFORNIA, HARD_TO_BOOK, HUBS, PROVINCES, STATES, hubBySlug, hubsIn, joinAnd, regionBySlug, regionsFor, total,
  type Hub, type Region, type Town,
} from "./camping-data";

// Tier 3: the search pages (campsite-finder src/app/camping/**, SiteTypeHubPage.tsx,
// SiteTypeStatePage.tsx, hardest-to-book). Their job is linking: a state page is the parent of
// every campground in it; the hubs give a parent to cabins, group sites and yurts. What they keep
// on purpose:
// - Inventory first: "Campgrounds in California", never "cancellations" in a heading (tried
//   2026-08-25 and falsified the same day by Search Console).
// - Under five campgrounds there is no page at all (a real 404, never a thin "nothing here").
// - States and provinces are never counted together ("47 states" is a claim about states).
// - Lists are names only: no open/booked badges, because these pages don't know.
// - Hardest to book is "our own pick … not a measured ranking": no ranks, no per-park numbers,
//   Yosemite first on purpose.
// - The site-type headings keep CampHawk's title case: they are the exact search query.
// Lab changes:
// - The pages sit in the app's frame, with the header and footer (CampHawk's have only a
//   breadcrumb; a camper who lands here from Google has no way to the rest of the app).
// - Links are forest and underlined, not green by hue alone; whole rows are the tap target.
// - The counts carry a caption saying what they count, not a bare number.
// - "A, B and C" (CampHawk drops the "and" at three); the hub title counts states and provinces
//   apart; numbers come from the lists ("15 more parks" is the list minus three).
// - The CTA says "Search campgrounds by date": CampHawk's "Search California by date" opens an
//   empty search.

const slugId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const LAB_NOTE = "California's counts and lists stand in for CampHawk's catalog; other states' counts and every campground list are illustrative.";

function Crumbs({ items, visitor }: { items: Array<[string, string | null]>; visitor: Visitor }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[14px] text-ch-ink-2">
      <ol className="flex flex-wrap items-center gap-y-1">
        {items.map(([label, href], i) => (
          <li key={label} className="flex items-center">
            {i > 0 && <span aria-hidden="true" className="mx-2 text-ch-muted">›</span>}
            {href ? <A href={href} visitor={visitor} className="font-semibold">{label}</A> : <span aria-current="page">{label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const rowLink = "flex min-h-11 items-center justify-between gap-3 py-2 text-[16px] text-ch-ink underline decoration-ch-line decoration-1 underline-offset-4 hover:decoration-ch-ink hover:decoration-2";

function RegionGrid({ rows, href, visitor, caption, bold }: { rows: Region[]; href: (r: Region) => string; visitor: Visitor; caption: string; bold?: boolean }) {
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div>
      <p className="mb-2 text-[14px] text-ch-ink-2">{caption}</p>
      <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((r) => (
          <li key={r.code} className="border-b border-ch-line">
            <Link href={withVisitor(href(r), visitor)} className={cx(rowLink, bold && "font-bold")}>
              <span>{r.name}</span>
              <span className="inline-block text-[14px] font-normal tabular-nums text-ch-ink-2">{r.count.toLocaleString("en-US")}<span className="sr-only"> campgrounds</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CampgroundList({ names, visitor, cols = 3 }: { names: string[]; visitor: Visitor; cols?: 2 | 3 }) {
  return (
    <ul className={cx("mt-2 grid gap-x-8 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3")}>
      {names.map((n) => (
        <li key={n} className="border-b border-ch-line"><Link href={withVisitor(ROUTES.campground, visitor)} className={rowLink}>{n}</Link></li>
      ))}
    </ul>
  );
}

function Towns({ groups, code, name, visitor }: { groups: Town[]; code: string; name: string; visitor: Visitor }) {
  return (
    <div className="mt-10 grid gap-9">
      {groups.map((g) => (
        <section key={g.city ?? "elsewhere"} aria-labelledby={`t-${slugId(g.city ?? "elsewhere")}`}>
          <h2 id={`t-${slugId(g.city ?? "elsewhere")}`} className="font-ch-display text-[20px] font-extrabold text-ch-ink">{g.city ? `${g.city}, ${code}` : `Elsewhere in ${name}`}</h2>
          <CampgroundList names={g.campgrounds} visitor={visitor} />
        </section>
      ))}
    </div>
  );
}

function Lead({ children }: { children: ReactNode }) {
  return <div className="max-w-[70ch] space-y-3 text-[17px] leading-relaxed text-ch-ink-2">{children}</div>;
}

function Search({ visitor, className }: { visitor: Visitor; className?: string }) {
  return <Link href={withVisitor(ROUTES.explore, visitor)} className={buttonClasses({ size: "lg", className: cx("px-6", className) })}>Search campgrounds by date</Link>;
}

function Note() {
  return <LabNote className="mt-12">{LAB_NOTE}</LabNote>;
}

const statePath = (r: Region) => `${ROUTES.camping}/${r.slug}`;
const indexLabel = (r: Region) => (r.canada ? "Camping in Canada" : "Camping by state");

/* ---------- /camping ---------- */

export function CampingHub() {
  const usTotal = total(STATES);
  const extraParks = HARD_TO_BOOK.length - 3;
  return (
    <LabPage page="Camping by state" title="Camping by state" dock={false} photo={{ art: ART.e1, pos: "40% 55%", posLg: "50% 55%" }}>
      {({ visitor }) => (
        <div>
          <Crumbs visitor={visitor} items={[["CampHawk", ROUTES.home], ["Camping by state", null]]} />
          <div className="mt-5"><Lead><p>These are the {STATES.length} states with enough campgrounds for a page of their own: {usTotal.toLocaleString("en-US")} bookable campgrounds, national forests, state parks and everything in between. Pick a state to see what we cover there. (Our full catalog is {CAMPGROUNDS_ROUNDED} campgrounds across the US and Canada.)</p></Lead></div>
          <ul aria-label="Kinds of site" className="mt-5 flex flex-wrap gap-2">
            {HUBS.map((h) => (
              <li key={h.slug}><Link href={withVisitor(`${ROUTES.camping}/${h.slug}`, visitor)} className="inline-flex min-h-11 items-center rounded-ch-chip border border-ch-line bg-ch-card px-4 text-[15px] font-bold text-ch-ink hover:border-ch-ink-2">{h.heading}</Link></li>
            ))}
          </ul>
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            <p className="rounded-ch-card border border-ch-line bg-ch-card p-5 text-[16px] leading-relaxed text-ch-ink-2 shadow-ch-card">Chasing somewhere that is never available? <A href={ROUTES.hardest} visitor={visitor}>The campgrounds that are always booked</A> covers Yosemite, Zion, Acadia and {extraParks} more parks whose sites go in minutes — and how a cancellation is the realistic way in.</p>
            <p className="rounded-ch-card border border-ch-line bg-ch-card p-5 text-[16px] leading-relaxed text-ch-ink-2 shadow-ch-card">Already found it booked out? <A href={ROUTES.soldOut} visitor={visitor}>What actually works when a campground is sold out</A>, and <A href={ROUTES.alerts} visitor={visitor}>how campsite cancellation alerts work</A> — including the free options worth checking first.</p>
          </div>
          <div className="mt-10"><RegionGrid rows={STATES} href={statePath} visitor={visitor} caption="The number beside each state is how many campgrounds we track there." bold /></div>
          <section id="canada" aria-labelledby="canada-h" className="mt-14 scroll-mt-24">
            <h2 id="canada-h" className="font-ch-display text-[clamp(24px,2.6vw,30px)] font-extrabold text-ch-forest">Camping in Canada</h2>
            <p className="mt-2 max-w-[70ch] text-[17px] leading-relaxed text-ch-ink-2">{total(PROVINCES).toLocaleString("en-US")} bookable campgrounds across {PROVINCES.length} provinces and territories — Parks Canada&apos;s national parks, plus the provincial and territorial systems. Pick a province to see what we cover there.</p>
            <div className="mt-5"><RegionGrid rows={PROVINCES} href={statePath} visitor={visitor} caption="The number beside each is how many campgrounds we track there." bold /></div>
          </section>
          <Note />
        </div>
      )}
    </LabPage>
  );
}

/* ---------- /camping/[state] ---------- */

export function StatePage({ slug }: { slug: string }) {
  const r = regionBySlug(slug)!;
  const ca = r.code === "CA";
  const types = hubsIn(r.code);
  return (
    <LabPage page={r.name} title={`Campgrounds in ${r.name}`} dock={false} photo={{ art: ART.c1, pos: "50% 60%", posLg: "50% 55%" }}>
      {({ visitor }) => (
        <div>
          <Crumbs visitor={visitor} items={[["CampHawk", ROUTES.home], [indexLabel(r), r.canada ? `${ROUTES.camping}#canada` : ROUTES.camping], [r.name, null]]} />
          <div className="mt-5">
            <Lead>
              <p>We track live availability at {r.count.toLocaleString("en-US")} bookable campgrounds across {r.name}{ca ? `, in ${CALIFORNIA.towns} towns` : ""}. Watch one and we recheck it every {CHECK_SECONDS} seconds, around the clock. Booked out is rarely final — people cancel constantly, and the site drops back into the booking system with no warning, often overnight — so when one frees up you hear about it in seconds rather than finding out weeks later that it was open for an hour.</p>
            </Lead>
            <p className="mt-3 text-[15px] text-ch-ink-2">{ca ? `Booking goes through ${joinAnd(CALIFORNIA.providers)}. ` : ""}Searching is free.</p>
            {types.length > 0 && (
              <p className="mt-2 text-[15px] text-ch-ink-2">Looking for something specific?{" "}
                {types.map((h, i) => (
                  <span key={h.slug}>{i > 0 && (i === types.length - 1 ? " or " : ", ")}<A href={`${ROUTES.camping}/${h.slug}/${r.slug}`} visitor={visitor}>{r.name} {h.label.toLowerCase()}</A></span>
                ))}.
              </p>
            )}
            <Search visitor={visitor} className="mt-6" />
          </div>
          {ca ? <Towns groups={CALIFORNIA.groups} code={r.code} name={r.name} visitor={visitor} /> : (
            <p className="mt-10 rounded-ch-card border border-ch-line bg-ch-card p-5 text-[16px] text-ch-ink-2 shadow-ch-card">The lab draws California&apos;s campground list; <A href={`${ROUTES.camping}/california`} visitor={visitor}>see it there</A>. CampHawk lists every campground in {r.name} here, by town.</p>
          )}
          <Note />
        </div>
      )}
    </LabPage>
  );
}

/* ---------- /camping/[type] ---------- */

// State systems = every data source but Recreation.gov (13 of 14); CampHawk types the 13.
const stateSystems = SOURCE_COUNT - 1;
const systems = (canada: boolean) => (canada ? `Recreation.gov, ${stateSystems} state park systems, Parks Canada and the Canadian provincial systems` : `Recreation.gov and ${stateSystems} state park systems`);
const places = (us: number, ca: number) => `${us} ${us === 1 ? "state" : "states"}${ca ? ` and ${ca} Canadian ${ca === 1 ? "province or territory" : "provinces and territories"}` : ""}`;

export function TypeHub({ type }: { type: string }) {
  const hub = hubBySlug(type)!;
  const rows = regionsFor(hub);
  const us = rows.filter((x) => !x.canada);
  const ca = rows.filter((x) => x.canada);
  return (
    <LabPage page={hub.heading} title={hub.heading} dock={false} photo={{ art: ART.n1, pos: "62% 55%", posLg: "50% 60%" }}>
      {({ visitor }) => (
        <div>
          <Crumbs visitor={visitor} items={[["CampHawk", ROUTES.home], ["Camping by state", ROUTES.camping], [hub.heading, null]]} />
          <div className="mt-5">
            <Lead>
              <p>{hub.blurb}</p>
              <p>We track live availability at {total(rows).toLocaleString("en-US")} campgrounds with {hub.noun} across {places(us.length, ca.length)}, on {systems(ca.length > 0)}. Watch one and we recheck it every {CHECK_SECONDS} seconds, around the clock, so when a booked site frees up you hear about it in seconds rather than finding out weeks later that it was open for an hour.</p>
            </Lead>
            <p className="mt-3 text-[15px] text-ch-ink-2">Searching live availability is free and needs no account.</p>
            <Search visitor={visitor} className="mt-6" />
          </div>
          {us.length > 0 && (
            <section aria-labelledby="by-state" className="mt-12">
              <h2 id="by-state" className="mb-4 font-ch-display text-[clamp(22px,2.4vw,28px)] font-extrabold text-ch-forest">{hub.heading} by state</h2>
              <RegionGrid rows={us} href={(x) => `${ROUTES.camping}/${hub.slug}/${x.slug}`} visitor={visitor} caption={`The number beside each state is how many campgrounds with ${hub.noun} we track there.`} />
            </section>
          )}
          {ca.length > 0 && (
            <section aria-labelledby="in-canada" className="mt-12">
              <h2 id="in-canada" className="mb-4 font-ch-display text-[clamp(22px,2.4vw,28px)] font-extrabold text-ch-forest">{hub.heading} in Canada</h2>
              <RegionGrid rows={ca} href={(x) => `${ROUTES.camping}/${hub.slug}/${x.slug}`} visitor={visitor} caption={`The number beside each is how many campgrounds with ${hub.noun} we track there.`} />
            </section>
          )}
          <p className="mt-10 text-[15px] text-ch-ink-2">Looking for something else? <A href={ROUTES.camping} visitor={visitor}>Browse every state and province</A>, or see <A href={ROUTES.hardest} visitor={visitor}>the campgrounds that are always booked</A>.</p>
          <Note />
        </div>
      )}
    </LabPage>
  );
}

/* ---------- /camping/[type]/[state] ---------- */

export function TypeStatePage({ type, slug }: { type: string; slug: string }) {
  const hub: Hub = hubBySlug(type)!;
  const r = regionBySlug(slug)!;
  const count = hub.byRegion[r.code];
  const ca = r.code === "CA";
  // California's list, cut to as many as the type has there (illustrative names).
  const groups: Town[] = [];
  if (ca) {
    let left = count;
    for (const g of CALIFORNIA.groups) {
      if (left <= 0) break;
      const take = g.campgrounds.slice(0, Math.min(2, left));
      groups.push({ ...g, campgrounds: take });
      left -= take.length;
    }
  }
  return (
    <LabPage page={`${r.name} ${hub.label}`} title={`${r.name} ${hub.label}`} dock={false} photo={{ art: ART.n1, pos: "62% 55%", posLg: "50% 60%" }}>
      {({ visitor }) => (
        <div>
          <Crumbs visitor={visitor} items={[["CampHawk", ROUTES.home], [indexLabel(r), ROUTES.camping], [hub.heading, `${ROUTES.camping}/${hub.slug}`], [r.name, null]]} />
          <div className="mt-5">
            <Lead><p>We track live availability at {count} campgrounds with {hub.noun} in {r.name}{ca ? `, across ${groups.length} towns` : ""}. {hub.blurb}</p></Lead>
            <p className="mt-3 text-[15px] text-ch-ink-2">{ca ? `Booking goes through ${joinAnd(CALIFORNIA.providers)}. ` : ""}Searching is free.</p>
            <Search visitor={visitor} className="mt-6" />
          </div>
          {ca ? <Towns groups={groups} code={r.code} name={r.name} visitor={visitor} /> : (
            <p className="mt-10 rounded-ch-card border border-ch-line bg-ch-card p-5 text-[16px] text-ch-ink-2 shadow-ch-card">The lab draws lists for California only; <A href={`${ROUTES.camping}/${hub.slug}/california`} visitor={visitor}>see California {hub.label.toLowerCase()}</A>. CampHawk lists each campground here, by town.</p>
          )}
          <p className="mt-10 text-[15px] text-ch-ink-2">Nothing free? See <A href={statePath(r)} visitor={visitor}>every campground we watch in {r.name}</A>, or <A href={`${ROUTES.camping}/${hub.slug}`} visitor={visitor}>{hub.heading} in other {r.canada ? "states and provinces" : "states"}</A>.</p>
          <Note />
        </div>
      )}
    </LabPage>
  );
}

/* ---------- /camping/hardest-to-book ---------- */

export function HardestToBook() {
  const count = HARD_TO_BOOK.reduce((n, p) => n + p.campgrounds.length, 0);
  return (
    <LabPage page="Always booked" title="The campgrounds that are always booked" dock={false} photo={{ art: ART.c1, pos: "50% 60%", posLg: "50% 55%" }}>
      {({ visitor }) => (
        <div>
          <Crumbs visitor={visitor} items={[["CampHawk", ROUTES.home], ["Always booked", null]]} />
          <div className="mt-5">
            <Lead>
              <p>Some campgrounds are gone the moment their booking window opens. Refresh at the wrong second and a whole summer of Yosemite Valley is spoken for before you have finished typing. It is not a queue you can win by being organized — for these {count} campgrounds, being early is not early enough.</p>
              <p>What does work is being there when somebody gives one back. Cancellations happen constantly — plans change, weather turns, someone holds three weekends and keeps one — and the site drops back into the booking system with no announcement, often in the middle of the night. Nearly every one of them is taken within minutes by whoever happened to be looking.</p>
              <p>CampHawk is the part that happens to be looking. Watch one of these campgrounds and we recheck it every {CHECK_SECONDS} seconds, around the clock, and the moment a site frees up we text, email and push you a link straight to it.</p>
            </Lead>
            <p className="mt-4 text-[15px] text-ch-ink-2">This is our own pick of famously oversubscribed national-park campgrounds, not a measured ranking. Live availability for every one of them is free to check.</p>
            <Link href={withVisitor(ROUTES.explore, visitor)} className={buttonClasses({ size: "lg", className: "mt-6 px-6" })}>Check availability now</Link>
          </div>
          {/* One card per park, in CampHawk's order (Yosemite first), in columns so each card is as
              tall as its list: denser than CampHawk's single column of one-link sections. */}
          <ul className="mt-10 gap-4 sm:columns-2 lg:columns-3">
            {HARD_TO_BOOK.map((p) => (
              <li key={p.park} className="mb-4 break-inside-avoid rounded-ch-card border border-ch-line bg-ch-card px-5 pb-2 pt-4 shadow-ch-card">
                <h2 className="font-ch-display text-[18px] font-extrabold leading-snug text-ch-ink">{p.park}</h2>
                <ul className="mt-1">
                  {p.campgrounds.map((n) => (
                    <li key={n} className="border-b border-ch-line last:border-b-0"><Link href={withVisitor(ROUTES.campground, visitor)} className={rowLink}>{n}</Link></li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-[15px] text-ch-ink-2">Watching all {inWords(count)} is not the point — pick the one you actually want. <A href={ROUTES.camping} visitor={visitor}>Browse every state</A> for the other {CAMPGROUNDS_ROUNDED}.</p>
          <LabNote className="mt-12">The parks and their order are CampHawk&apos;s; the campground names are matched by hand to its Recreation.gov ids and may not be exact.</LabNote>
        </div>
      )}
    </LabPage>
  );
}
