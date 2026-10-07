"use client";

import { ART } from "../Art";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import type { Visitor } from "../../data";
import { CAMPGROUNDS_ROUNDED } from "../../data";
import { ROUTES } from "../gates";
import type { Fact } from "../AppParts";
import { A, LabNote, LabPage } from "../LabPage";
import { withVisitor } from "../labState";
import { CHECK_SECONDS, SOURCES_LINE, inWords } from "./tier2-data";
import {
  CALIFORNIA, COVERAGE, HARD_TO_BOOK, HUBS, PROVINCES, STATES, UNPAGED, hubBySlug, hubsIn, joinAnd, regionBySlug, regionsFor, total,
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
// - The CTA says "Search campgrounds", the lab's one name for opening search (CampHawk's
//   "Search California by date" opens an empty search, and it has six other names).

const slugId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const LAB_NOTE = "California’s counts and lists stand in for CampHawk’s catalog; other states’ counts and every campground list are illustrative.";

function Crumbs({ items, visitor }: { items: Array<[string, string | null]>; visitor: Visitor }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[14px] text-ch-ink-2">
      <ol className="flex flex-wrap items-center gap-y-1">
        {items.map(([label, href], i) => (
          // The separator ends the item before it, so a wrapped trail never starts a line with "›".
          <li key={label} className="flex items-center">
            {href ? <A href={href} visitor={visitor} className="font-semibold">{label}</A> : <span aria-current="page">{label}</span>}
            {i < items.length - 1 && <span aria-hidden="true" className="mx-2 text-ch-muted">›</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const rowLink = "flex min-h-11 items-center justify-between gap-3 py-2 text-[16px] text-ch-ink underline decoration-ch-line decoration-1 underline-offset-4 hover:decoration-ch-ink hover:decoration-2";

function RegionGrid({ rows, href, visitor, caption }: { rows: Region[]; href: (r: Region) => string; visitor: Visitor; caption: string }) {
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div>
      <p className="mb-2 text-[14px] text-ch-ink-2">{caption}</p>
      <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((r) => (
          <li key={r.code} className="border-b border-ch-line">
            <Link href={withVisitor(href(r), visitor)} className={cx(rowLink, "font-bold")}>
              <span>{r.name}</span>
              <span className="inline-block text-[14px] font-normal tabular-nums text-ch-ink-2">{r.count.toLocaleString("en-US")}<span className="sr-only"> campgrounds</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// One card per town, the same card Hardest to book uses, so the two catalog pages read as one
// family (round 8: a long run of bare link rows read as an SEO scaffold).
function Towns({ groups, code, name, visitor }: { groups: Town[]; code: string; name: string; visitor: Visitor }) {
  return (
    // Two masonry columns, read down (alphabetical either way): a row grid left holes beside the
    // long towns and under a lone last card (round 15).
    <div className="mt-10 gap-4 sm:columns-2">
      {groups.map((g) => (
        <section key={g.city ?? "elsewhere"} aria-labelledby={`t-${slugId(g.city ?? "elsewhere")}`} className="mb-4 break-inside-avoid rounded-ch-card border border-ch-line bg-ch-card px-5 pb-2 pt-4 shadow-ch-card">
          <h2 id={`t-${slugId(g.city ?? "elsewhere")}`} className="flex items-baseline justify-between gap-3 font-ch-display text-[18px] font-extrabold leading-snug text-ch-ink">
            <span>{g.city ? `${g.city}, ${code}` : `Elsewhere in ${name}`}</span>
            <span className="shrink-0 font-ch-body text-[13px] font-semibold text-ch-ink-2 tabular-nums">{g.campgrounds.length} {g.campgrounds.length === 1 ? "campground" : "campgrounds"}</span>
          </h2>
          <ul className="mt-1">
            {g.campgrounds.map((n) => (
              <li key={n} className="border-b border-ch-line last:border-b-0"><Link href={withVisitor(ROUTES.campground, visitor)} className={rowLink}>{n}</Link></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const shownIn = (groups: Town[]) => groups.reduce((n, g) => n + g.campgrounds.length, 0);

function Lead({ children }: { children: ReactNode }) {
  return <div className="max-w-[70ch] space-y-3 text-[17px] leading-relaxed text-ch-ink-2">{children}</div>;
}

function Search({ visitor, className }: { visitor: Visitor; className?: string }) {
  return <Link href={withVisitor(ROUTES.explore, visitor)} className={buttonClasses({ size: "lg", className: cx("px-6", className) })}>Search campgrounds</Link>;
}

function Note() {
  return <LabNote className="mt-12">{LAB_NOTE}</LabNote>;
}

const statePath = (r: Region) => `${ROUTES.camping}/${r.slug}`;
const indexLabel = (r: Region) => (r.canada ? "Camping in Canada" : "Camping by state");

/* ---------- /camping ---------- */

/** The catalog pages' frame: the lead and the list in one column, and beside it a card that says
    where to go next, held in view while the list scrolls (round 14: a lead, a line of links and a
    button stacked up before the list, and the right of the page sat empty). */
function CatalogLayout({ lead, links, visitor, aside, children, note }: { lead: ReactNode; links?: ReadonlyArray<readonly [label: string, href: string]>; visitor: Visitor; aside?: ReactNode; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
      <div className="min-w-0">
        <Lead>{lead}</Lead>
        {children}
      </div>
      <aside aria-label="Where to next" className="lg:sticky lg:top-6 lg:self-start">
        {aside ?? (links && <NarrowCard links={links} visitor={visitor} note={note} />)}
      </aside>
    </div>
  );
}

function ArrowRows({ links, visitor }: { links: ReadonlyArray<readonly [label: string, href: string]>; visitor: Visitor }) {
  return (
    <ul>
      {links.map(([label, href]) => (
        <li key={href} className="border-b border-ch-line last:border-b-0">
          <Link href={withVisitor(href, visitor)} className={cx(rowLink, "text-[15px] font-bold")}><span>{label}</span><ArrowRight aria-hidden="true" className="size-4 shrink-0 text-ch-ink-2" /></Link>
        </li>
      ))}
    </ul>
  );
}

/** One card per catalog page: what the list is (`note`), search, then where else to look
    (round 16: a separate "These are N of M" card made two search buttons on one page). */
function NarrowCard({ links, visitor, note }: { links: ReadonlyArray<readonly [label: string, href: string]>; visitor: Visitor; note?: ReactNode }) {
  return (
    <div className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card">
      <div className="mb-5 border-b border-ch-line pb-4">
        {note && <p className="mb-4 text-[15px] leading-relaxed text-ch-ink-2">{note}</p>}
        <Search visitor={visitor} className="w-full" />
        <p className="mt-2 text-center text-[14px] text-ch-ink-2">Searching is free and needs no account.</p>
      </div>
      <p className="text-[13px] font-extrabold text-ch-ink-2">Narrow it down</p>
      <ArrowRows links={links} visitor={visitor} />
    </div>
  );
}

/** Numbers in a card: value over what it counts, top-aligned however the labels wrap. */
function CardFacts({ facts }: { facts: ReadonlyArray<Fact> }) {
  return (
    <dl className="grid grid-cols-2 border-b border-ch-line pb-4">
      {facts.map(([v, l], i) => (
        <div key={l} className={cx("flex flex-col gap-1", i > 0 && "border-l border-ch-line pl-4")}>
          <dt className="order-last text-[14px] leading-snug text-ch-ink-2">{l}</dt>
          <dd className="font-ch-display text-[34px] font-extrabold leading-none tracking-[-.02em] text-ch-forest tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const n = (x: number) => x.toLocaleString("en-US");

/* ---------- /camping ---------- */

export function CampingHub() {
  const usTotal = total(STATES);
  const extraParks = HARD_TO_BOOK.length - 3;
  return (
    <LabPage page="Camping by state" title="Camping by state" dock={false} facts={[[String(STATES.length), "states with a page"], [n(usTotal), "campgrounds in them"], [CAMPGROUNDS_ROUNDED, "in the US and Canada"]]}>
      {({ visitor }) => (
        <div>
          <Crumbs visitor={visitor} items={[["CampHawk", ROUTES.home], ["Camping by state", null]]} />
          <CatalogLayout
            visitor={visitor}
            lead={<>
              <p>These are the {STATES.length} states with enough campgrounds for a page of their own: national forests, state parks and everything in between. Pick one to see what we track there.</p>
              <p>Chasing somewhere that is never available? Yosemite, Zion, Acadia and {extraParks} more parks go in minutes, and a cancellation is the realistic way in.</p>
            </>}
            links={[...HUBS.map((h) => [h.heading, `${ROUTES.camping}/${h.slug}`] as const), ["The campgrounds that are always booked", ROUTES.hardest], ["When a campground is fully booked", ROUTES.soldOut]]}
          >
          <div className="mt-12"><RegionGrid rows={STATES} href={statePath} visitor={visitor} caption="The number beside each state is how many campgrounds we track there." /></div>
          <section id="canada" aria-labelledby="canada-h" className="mt-14 scroll-mt-24">
            <h2 id="canada-h" className="font-ch-display text-[clamp(24px,2.6vw,30px)] font-extrabold leading-[1.15] text-ch-forest">Camping in Canada</h2>
            <p className="mt-2 max-w-[70ch] text-[17px] leading-relaxed text-ch-ink-2">{n(total(PROVINCES) + UNPAGED.canada)} bookable campgrounds in {COVERAGE.canadaRegions} of Canada’s 13 provinces and territories — Parks Canada’s national parks, plus {inWords(COVERAGE.canadianProvincialSystems)} provincial and territorial systems. These {inWords(PROVINCES.length)} have enough for a page of their own.</p>
            <div className="mt-5"><RegionGrid rows={PROVINCES} href={statePath} visitor={visitor} caption="The number beside each is how many campgrounds we track there." /></div>
          </section>
          </CatalogLayout>
          <Note />
        </div>
      )}
    </LabPage>
  );
}

/* ---------- /camping/[state] ---------- */

const WHY_WATCH = `Fully booked is rarely final. People cancel constantly, and the site drops back into the booking system with no warning, often overnight. Watch one and we recheck it every ${CHECK_SECONDS} seconds, around the clock, so you hear within seconds, not weeks later.`;

export function StatePage({ slug }: { slug: string }) {
  const r = regionBySlug(slug)!;
  const ca = r.code === "CA";
  const types = hubsIn(r.code);
  const facts: Fact[] = ca
    ? [[n(r.count), "campgrounds tracked"], [String(CALIFORNIA.towns), "towns"], [String(CALIFORNIA.providers.length), "booking systems"]]
    : [[n(r.count), "campgrounds tracked"], [`${CHECK_SECONDS} sec`, "between checks"]];
  return (
    <LabPage page={r.name} title={`Campgrounds in ${r.name}`} dock={false} facts={facts}>
      {({ visitor }) => (
        <div>
          <Crumbs visitor={visitor} items={[["CampHawk", ROUTES.home], [indexLabel(r), r.canada ? `${ROUTES.camping}#canada` : ROUTES.camping], [r.name, null]]} />
          <CatalogLayout
            visitor={visitor}
            note={ca && <><strong className="text-ch-ink">These are {shownIn(CALIFORNIA.groups)} of {r.name}’s {n(r.count)} campgrounds</strong>, the ones people watch most. Search by name, town or ZIP to find the rest.</>}
            lead={<>
              <p>{WHY_WATCH}</p>
              {ca && <p>Booking goes through {joinAnd(CALIFORNIA.providers)}.</p>}
            </>}
            links={[...types.map((h) => [`${r.name} ${h.label}`, `${ROUTES.camping}/${h.slug}/${r.slug}`] as const), [r.canada ? "Camping in Canada" : "Camping by state", r.canada ? `${ROUTES.camping}#canada` : ROUTES.camping]]}
          >
          {ca ? (
            <>
              <Towns groups={CALIFORNIA.groups} code={r.code} name={r.name} visitor={visitor} />
            </>
          ) : (
            <p className="mt-10 rounded-ch-card border border-ch-line bg-ch-card p-5 text-[16px] text-ch-ink-2 shadow-ch-card">The lab draws California’s campground list; <A href={`${ROUTES.camping}/california`} visitor={visitor}>see it there</A>. CampHawk lists every campground in {r.name} here, by town.</p>
          )}
          </CatalogLayout>
          <Note />
        </div>
      )}
    </LabPage>
  );
}

/* ---------- /camping/[type] ---------- */

// Worded as the sold-out guide words it, from the source list: one of the 14 sources carries
// Parks Canada and the provincial systems as well as four states, so "13 state systems" overcounts.
const systems = (canada: boolean) => (canada ? SOURCES_LINE : "Recreation.gov and the state park reservation systems we read");
// Name Canada's regions for what they are: "5 Canadian provinces" when none is a territory.
const TERRITORIES = new Set(["NT", "NU", "YT"]);
const places = (us: number, ca: ReadonlyArray<{ code: string }>) => {
  const t = ca.filter((r) => TERRITORIES.has(r.code)).length;
  const kind = t === 0 ? (ca.length === 1 ? "province" : "provinces") : t === ca.length ? (t === 1 ? "territory" : "territories") : "provinces and territories";
  return `${us} ${us === 1 ? "state" : "states"}${ca.length ? ` and ${ca.length} Canadian ${kind}` : ""}`;
};

const canadaKind = (ca: ReadonlyArray<{ code: string }>) => places(0, ca).replace(/^0 states and \d+ Canadian /, "Canadian ");

export function TypeHub({ type }: { type: string }) {
  const hub = hubBySlug(type)!;
  const rows = regionsFor(hub);
  const us = rows.filter((x) => !x.canada);
  const ca = rows.filter((x) => x.canada);
  const facts: Fact[] = [[n(total(rows)), `campgrounds with ${hub.noun}`], [String(us.length), us.length === 1 ? "state" : "states"], ...(ca.length ? [[String(ca.length), canadaKind(ca)] as const] : [])];
  return (
    <LabPage page={hub.heading} title={hub.heading} dock={false} facts={facts}>
      {({ visitor }) => (
        <div>
          <Crumbs visitor={visitor} items={[["CampHawk", ROUTES.home], ["Camping by state", ROUTES.camping], [hub.heading, null]]} />
          <CatalogLayout
            visitor={visitor}
            lead={<>
              <p>{hub.blurb}</p>
              <p>We track them across {places(us.length, ca)}, on {systems(ca.length > 0)}. Most book out months ahead, so a cancellation is the realistic way in: watch one and we recheck it every {CHECK_SECONDS} seconds, around the clock.</p>
            </>}
            links={[...HUBS.filter((h) => h.slug !== hub.slug).map((h) => [h.heading, `${ROUTES.camping}/${h.slug}`] as const), ["Camping by state", ROUTES.camping], ["The campgrounds that are always booked", ROUTES.hardest]]}
          >
          {us.length > 0 && (
            <section aria-labelledby="by-state" className="mt-12">
              <h2 id="by-state" className="mb-4 font-ch-display text-[clamp(22px,2.4vw,28px)] font-extrabold leading-[1.15] text-ch-forest">{hub.heading} by state</h2>
              <RegionGrid rows={us} href={(x) => `${ROUTES.camping}/${hub.slug}/${x.slug}`} visitor={visitor} caption={`The number beside each state is how many campgrounds with ${hub.noun} we track there.`} />
            </section>
          )}
          {ca.length > 0 && (
            <section aria-labelledby="in-canada" className="mt-12">
              <h2 id="in-canada" className="mb-4 font-ch-display text-[clamp(22px,2.4vw,28px)] font-extrabold leading-[1.15] text-ch-forest">{hub.heading} in Canada</h2>
              <RegionGrid rows={ca} href={(x) => `${ROUTES.camping}/${hub.slug}/${x.slug}`} visitor={visitor} caption={`The number beside each is how many campgrounds with ${hub.noun} we track there.`} />
            </section>
          )}
          </CatalogLayout>
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
    // 1 to 3 per town in turn, so the sample reads as picked, not as "2" on every card (round 14).
    for (const [gi, g] of CALIFORNIA.groups.entries()) {
      if (left <= 0) break;
      // Yosemite's Pines loops are tent sites only (the campground page says so), so they never
      // appear under cabins, groups or yurts.
      const take = g.campgrounds.filter((x) => !/Pines Campground$/.test(x)).slice(0, Math.min([2, 3, 1][gi % 3], left));
      if (!take.length) continue;
      groups.push({ ...g, campgrounds: take });
      left -= take.length;
    }
  }
  const others = hubsIn(r.code).filter((h) => h.slug !== hub.slug);
  return (
    <LabPage page={`${r.name} ${hub.label}`} title={`${r.name} ${hub.label}`} dock={false} facts={[[n(count), `campgrounds with ${hub.noun}`], [n(r.count), "campgrounds tracked"], [`${CHECK_SECONDS} sec`, "between checks"]]}>
      {({ visitor }) => (
        <div>
          <Crumbs visitor={visitor} items={[["CampHawk", ROUTES.home], [indexLabel(r), ROUTES.camping], [hub.heading, `${ROUTES.camping}/${hub.slug}`], [r.name, null]]} />
          <CatalogLayout
            visitor={visitor}
            note={ca && <><strong className="text-ch-ink">These are {shownIn(groups)} of {r.name}’s {count} campgrounds with {hub.noun}</strong>, the ones people watch most. Search by name, town or ZIP to find the rest.</>}
            lead={<>
              <p>A campground with {hub.noun} in {r.name} is usually fully booked months ahead, so a cancellation is the realistic way in. It drops back into the booking system with no warning, often overnight; watch one and we recheck it every {CHECK_SECONDS} seconds, around the clock.</p>
              {ca && <p>Booking goes through {joinAnd(CALIFORNIA.providers)}.</p>}
            </>}
            links={[[`Campgrounds in ${r.name}`, statePath(r)], ...others.map((h) => [`${r.name} ${h.label}`, `${ROUTES.camping}/${h.slug}/${r.slug}`] as const), [hub.heading, `${ROUTES.camping}/${hub.slug}`]]}
          >
          {ca ? (
            <>
              <Towns groups={groups} code={r.code} name={r.name} visitor={visitor} />
            </>
          ) : (
            <p className="mt-10 rounded-ch-card border border-ch-line bg-ch-card p-5 text-[16px] text-ch-ink-2 shadow-ch-card">The lab draws lists for California only; <A href={`${ROUTES.camping}/${hub.slug}/california`} visitor={visitor}>see California {hub.label.toLowerCase()}</A>. CampHawk lists each campground here, by town.</p>
          )}
          </CatalogLayout>
          <Note />
        </div>
      )}
    </LabPage>
  );
}

/* ---------- /camping/hardest-to-book ---------- */

export function HardestToBook() {
  const count = HARD_TO_BOOK.reduce((x, p) => x + p.campgrounds.length, 0);
  return (
    <LabPage page="Always booked" title="The campgrounds that are always booked" dock={false} photo={{ art: ART.k1, pos: "55% 40%", posLg: "50% 40%" }}>
      {({ visitor }) => (
        <div>
          <Crumbs visitor={visitor} items={[["CampHawk", ROUTES.home], ["Always booked", null]]} />
          <CatalogLayout
            visitor={visitor}
            lead={<>
              <p>Some campgrounds are gone the moment their booking window opens. Refresh at the wrong second and a whole summer of Yosemite Valley is spoken for before you’ve finished typing. For these {count} campgrounds, being early isn’t early enough.</p>
              <p>What does work is being there when somebody gives one back. Cancellations happen constantly, and the site drops back into the booking system with no announcement, often in the middle of the night. Watch one and we recheck it every {CHECK_SECONDS} seconds, around the clock, and the moment a site frees up we email, push and text you a link straight to it.</p>
            </>}
            aside={
              <div className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card">
                <CardFacts facts={[[String(count), "campgrounds"], [String(HARD_TO_BOOK.length), "parks and seashores"]]} />
                <p className="mt-4 text-[15px] leading-relaxed text-ch-ink-2">This is our own pick of famously oversubscribed campgrounds in national parks and seashores, not a measured ranking. Live availability for every one of them is free to check.</p>
                <Search visitor={visitor} className="mt-5 w-full" />
                <div className="mt-4 border-t border-ch-line"><ArrowRows links={[["When a campground is fully booked", ROUTES.soldOut], ["How cancellation alerts work", ROUTES.alerts]]} visitor={visitor} /></div>
              </div>
            }
          >
            {/* One row per park, in CampHawk's order (Yosemite first), its campgrounds inline: a ranked
                list reads top to bottom, and twelve one-link cards read as filler (round 9). */}
            <ol className="mt-10 border-t border-ch-line">
              {HARD_TO_BOOK.map((p) => (
                <li key={p.park} className="grid gap-x-8 gap-y-1 border-b border-ch-line py-3.5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:items-baseline">
                  <h2 className="font-ch-display text-[17px] font-extrabold leading-snug text-ch-ink">{p.park}</h2>
                  <ul className="grid sm:flex sm:flex-wrap sm:gap-x-5">
                    {p.campgrounds.map((c) => (
                      <li key={c}><Link href={withVisitor(ROUTES.campground, visitor)} className={rowLink}>{c}</Link></li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-[15px] text-ch-ink-2">Watching all {inWords(count)} isn’t the point — pick the one you actually want. <A href={ROUTES.camping} visitor={visitor}>Browse every state</A> for every other campground.</p>
          </CatalogLayout>
          <LabNote className="mt-12">The parks and their order are CampHawk’s; the campground names are matched by hand to its Recreation.gov ids and may not be exact.</LabNote>
        </div>
      )}
    </LabPage>
  );
}
