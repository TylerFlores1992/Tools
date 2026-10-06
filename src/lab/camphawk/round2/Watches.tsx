"use client";

import { useState, useSyncExternalStore } from "react";
import { Info, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "../ui";
import { WATCH_LIMIT, type Visitor } from "../data";
import { LabBar } from "../LabBar";
import { Card, type CardState } from "../ui/Card";
import { Collapsible } from "../ui/Collapsible";
import { Tag } from "../ui/Tag";
import { daysBetween, formatRange, nightsBetween, todayISO, type ISODate } from "../ui/date";
import { Art, ART } from "./Art";
import { AppBand, BandPhoto, LabSelect, PhoneNudge, PLANS, PricingLink, WatchCtaLink, type Plan } from "./AppParts";
import { availability, CAMPGROUNDS } from "./explore-data";
import { ROUTES } from "./gates";
import { GhFooter, ScreenLinks } from "./GhChrome";
import { LabNote } from "./LabPage";
import { useUrlParam, useUrlState, useVisitor, withVisitor } from "./labState";
import { PICKABLE } from "./newwatch-data";
import { ALERTS, OUTLOOK_HEADING, outlookBody, WATCHES, type ExampleWatch, type Hold } from "./watches-data";

// Screen 5 in the Golden hour look: CampHawk's Your watches (campsite-finder src/app/(app)/watches,
// src/components/v2/WatchesList.tsx, WatchCard.tsx, HoldRow.tsx, SetupNudges.tsx,
// NewWatchOutlook.tsx), ported with example data. Contract: docs/design/camphawk-home.md,
// "Screen 5". What it keeps from CampHawk, on purpose:
// - A card says its state in words and a tag: a site open (and how many), in your cart, watching,
//   paused, checks paused, auto-cart reconnecting or disconnected. "In your cart" only when the
//   bot's own record says so; a reconnect problem says so instead.
// - Tomorrow's 8am ReserveCalifornia holds live in the card they came from, collapsed, with the
//   count and the time on the card's tags.
// - A provider not answering is a banner and a card state, never a failure of the watch.
// - Two columns that don't share a row height, so one tall card doesn't leave holes.
// - A brand-new watch on a stay that's fully booked weeks out gets told to expect quiet.
// Lab changes, from CampHawk's own colour rules: "Auto-cart reconnecting" fixes itself, so its
// card isn't red (only "signed out", which needs you, is); a provider outage is neutral, not
// ochre; and a site already in your cart gets the blue checkout button.

type ListState = "list" | "empty" | "loading" | "failed";
type CartLink = "connected" | "reconnecting" | "disconnected";
type WatchState = "watching" | "hit" | "paused" | "authexpired" | "disconnected" | "stalled";

function watchState(w: ExampleWatch, cart: CartLink, providerDown: boolean): WatchState {
  if (!w.active) return "paused";
  if (w.openSites?.length) return "hit";
  if (w.autoCart && w.provider === "Recreation.gov" && cart === "disconnected") return "disconnected";
  if (w.autoCart && w.provider === "Recreation.gov" && cart === "reconnecting") return "authexpired";
  if (providerDown && w.provider === "ReserveCalifornia") return "stalled";
  return "watching";
}

function HoldRow({ h, onRemove }: { h: Hold; onRemove: (id: string) => void }) {
  const offered = h.status === "offered";
  return (
    <div className="grid gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-ch-ink">Site {h.site}</p>
          <p className="text-[13px] text-ch-muted">{h.part}</p>
        </div>
        {offered ? <Tag kind="paused" mark="queued">Offered</Tag> : <Tag kind="watch" mark="queued">Queued</Tag>}
      </div>
      <p className="text-[14px] leading-normal text-ch-ink-2">
        {offered
          ? "Releases tomorrow at 8 AM. We can try to cart it for you the second it opens — tap below if you want it."
          : "We'll try for this the second it opens, tomorrow at 8 AM. We'll tell you either way — keep an alarm set in case we miss."}
      </p>
      <div className="flex flex-wrap gap-2">
        {offered && <a href="#" className={buttonClasses({ size: "sm", className: "min-h-11 flex-1 px-4" })}>Hold it for me</a>}
        <button type="button" onClick={() => onRemove(h.id)} aria-label={offered ? `Don't hold ${h.site} for me` : `Call off the hold on ${h.site}`} className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 px-4" })}>
          {offered ? "I don't want this one" : "Call this off"}
        </button>
      </div>
    </div>
  );
}

function WatchCard({ w, visitor, cart, providerDown, onRemoveHold }: { w: ExampleWatch; visitor: Visitor; cart: CartLink; providerDown: boolean; onRemoveHold: (id: string) => void }) {
  const state = watchState(w, cart, providerDown);
  const nights = w.flexNights ?? nightsBetween(w.start, w.end);
  const spec = [`${nights} ${nights === 1 ? "night" : "nights"}`, w.weekendsOnly ? "weekends only" : null, w.mutedSites ? `${w.mutedSites} site${w.mutedSites === 1 ? "" : "s"} muted` : null].filter(Boolean).join(" · ");
  const asked = (w.holds ?? []).filter((h) => h.status === "requested");
  const offered = (w.holds ?? []).filter((h) => h.status === "offered");
  const cardState: CardState = state === "hit" ? "hit" : state === "disconnected" ? "warn" : state === "paused" ? "paused" : "default";
  const recgov = w.provider === "Recreation.gov";
  const carted = w.carted?.length && cart === "connected" ? w.carted : null;
  const calendarHref = withVisitor(`${ROUTES.campground}?id=${CAMPGROUNDS.find((c) => c.name === w.name)?.id ?? ""}`, visitor);

  return (
    <Card state={cardState} className="flex flex-col">
      <div data-card-dim className="flex-1">
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          {state === "hit" && <Tag kind="open">{w.openSites!.length} site{w.openSites!.length === 1 ? "" : "s"} open</Tag>}
          {asked.length > 0 && <Tag kind="watch" mark="queued">We&apos;ll grab {asked.length === 1 ? `Site ${asked[0].site}` : `${asked.length} sites`} · 8 AM</Tag>}
          {carted && <Tag kind="cart">{carted.length === 1 ? "In your cart" : `${carted.length} in your cart`}</Tag>}
          {state === "hit" && w.autoCart && recgov && cart === "disconnected" && <Tag kind="paused" mark="needs-you">Not carted — reconnect auto-cart</Tag>}
          {state === "hit" && w.autoCart && recgov && cart === "reconnecting" && <Tag kind="paused" mark="reconnecting">Not carted — reconnecting</Tag>}
          {state === "watching" && <Tag kind="watch">Watching</Tag>}
          {w.autoCart && recgov && state !== "authexpired" && state !== "disconnected" && !carted && !(state === "hit" && cart !== "connected") && <Tag kind="cart" mark="auto-cart">Auto-cart</Tag>}
          {state === "paused" && <Tag kind="paused">Paused</Tag>}
          {state === "authexpired" && <Tag kind="paused" mark="reconnecting">Auto-cart reconnecting</Tag>}
          {state === "disconnected" && <Tag kind="paused" mark="needs-you">Auto-cart disconnected</Tag>}
          {state === "stalled" && <Tag kind="paused" mark="provider-down">Checks paused</Tag>}
          <Tag kind="src">{w.provider}</Tag>
        </div>
        <h3 className="font-ch-display text-[20px] font-extrabold leading-tight tracking-[-.02em] text-ch-ink">{w.name}</h3>
        {w.parts && (
          <p className="mt-1 text-[14px] leading-normal text-ch-ink-2">
            <span className="font-bold">{w.parts.length} parts</span> · {w.parts.slice(0, 4).join(" · ")}{w.parts.length > 4 ? ` · +${w.parts.length - 4} more` : ""}
          </p>
        )}
        <p className="mt-3 text-[16px] font-bold text-ch-ink-2">{w.flexNights ? `Any ${nights} nights, ${formatRange(w.start, w.end)}` : formatRange(w.start, w.end)}</p>
        <p className="mt-0.5 text-[14px] text-ch-ink-2">{spec}</p>
      </div>

      {state === "authexpired" && (
        <div className="mt-3 border-t border-ch-line pt-3">
          <p className="mb-2.5 text-[14px] leading-normal text-ch-ink-2">Auto-cart can&apos;t hold a site for you right now — the machine holding your Recreation.gov session is reconnecting. It signs back in by itself, and we&apos;re still checking and still alerting you meanwhile.</p>
          <a href="#" className={buttonClasses({ variant: "quiet", fullWidth: true })}>Sign in again if this sticks</a>
        </div>
      )}
      {state === "disconnected" && (
        <div className="mt-3 border-t border-ch-line pt-3">
          <p className="mb-2.5 text-[14px] leading-normal text-ch-ink-2">Recreation.gov signed CampHawk out of your account, so auto-cart can&apos;t put an opening in your cart. We&apos;re still checking and still alerting you. Sign in again and it picks back up.</p>
          <a href="#" className={buttonClasses({ variant: "quiet", fullWidth: true })}>Reconnect Recreation.gov</a>
        </div>
      )}
      {state === "stalled" && (
        <div className="mt-3 border-t border-ch-line pt-3">
          <p className="text-[14px] text-ch-ink-2">{w.provider} isn&apos;t responding. We&apos;re retrying — your other watches are unaffected.</p>
        </div>
      )}
      {(offered.length > 0 || asked.length > 0) && (
        <div className="mt-3 grid gap-2 border-t border-ch-line pt-3">
          {offered.length > 0 && (
            <Collapsible label="Available to hold" summary={`${offered.length} site${offered.length === 1 ? "" : "s"}`}>
              <div className="divide-y divide-ch-line">{offered.map((h) => <HoldRow key={h.id} h={h} onRemove={onRemoveHold} />)}</div>
            </Collapsible>
          )}
          {asked.length > 0 && (
            <Collapsible label="Queued for us to grab" summary={`${asked.length} site${asked.length === 1 ? "" : "s"}`}>
              <div className="divide-y divide-ch-line">{asked.map((h) => <HoldRow key={h.id} h={h} onRemove={onRemoveHold} />)}</div>
            </Collapsible>
          )}
        </div>
      )}
      {/* Lab proposal: the site is already in the cart, so the card's main action is the hand-off
          (blue). CampHawk's card offers only Calendar and Manage here; its alert has the link. */}
      {carted && (
        <div className="mt-3 border-t border-ch-line pt-3">
          <a href="#" className={buttonClasses({ variant: "cart", fullWidth: true })}>
            <ShoppingCart aria-hidden="true" className="size-4" />
            Check out on Recreation.gov
          </a>
        </div>
      )}
      <div className="mt-3 flex gap-2 border-t border-ch-line pt-3">
        <Link href={calendarHref} aria-label={`Calendar for ${w.name}`} className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 flex-1" })}>Calendar</Link>
        <a href="#" aria-label={`Manage the ${w.name} watch`} className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 flex-1" })}>Manage</a>
      </div>
    </Card>
  );
}

/** A numbered three-step list, the shape CampHawk uses on the wall and the first run. */
function Steps({ steps }: { steps: ReadonlyArray<readonly [string, string]> }) {
  return (
    <ol className="mt-5 rounded-ch-card border border-ch-line bg-ch-card px-5 py-2">
      {steps.map(([title, sub], i) => (
        <li key={title} className="flex gap-3 border-b border-ch-line py-3.5 last:border-b-0">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ch-shell text-[14px] font-extrabold text-ch-ink">{i + 1}</span>
          <span>
            <span className="block text-[16px] font-bold text-ch-ink">{title}</span>
            <span className="mt-0.5 block text-[14px] leading-normal text-ch-ink-2">{sub}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The wall and the first run share a frame: words on the left, the photo of the moment beside. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid overflow-hidden rounded-ch-card border border-ch-line bg-ch-paper shadow-ch-pop lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="p-5 sm:p-8">{children}</div>
      <Art art={ART.a3} sizes="(min-width: 1024px) 420px, 0px" alt="A phone lighting up on a picnic table at dusk" className="hidden size-full bg-ch-forest object-cover lg:block" />
    </div>
  );
}

function AccountWall({ visitor }: { visitor: Visitor }) {
  return (
    <Panel>
      <h2 className="font-ch-display text-[clamp(24px,2.6vw,32px)] font-extrabold tracking-[-.02em] text-ch-ink">Watches need an account</h2>
      <p className="mt-2 max-w-[52ch] text-[16px] leading-relaxed text-ch-ink-2">Searching stays free. Watches run on our servers around the clock, so they&apos;re tied to your account.</p>
      <Steps steps={[
        [`Up to ${WATCH_LIMIT} watches at once`, "One per campground and date range."],
        ["Alerts in seconds", "Push, text and email the moment a site frees up."],
        ["Auto-cart on Recreation.gov", "With the Auto-Cart plan, the site lands in your cart before you finish reading the alert."],
      ]} />
      <div className="mt-5 grid gap-2 sm:max-w-[420px]">
        <a href="#" className={buttonClasses({ variant: "ink", fullWidth: true })}>Start 7-day free trial</a>
        <a href="#" className={buttonClasses({ variant: "quiet", fullWidth: true })}>Plan options</a>
        <a href="#" className={buttonClasses({ variant: "quiet", fullWidth: true })}>Sign in</a>
        <Link href={withVisitor(ROUTES.explore, visitor)} className={buttonClasses({ variant: "quiet", fullWidth: true })}>Keep exploring without an account</Link>
      </div>
    </Panel>
  );
}

function FirstRun({ visitor }: { visitor: Visitor }) {
  return (
    <Panel>
      <h2 className="font-ch-display text-[clamp(24px,2.6vw,32px)] font-extrabold tracking-[-.02em] text-ch-ink">No watches yet</h2>
      <p className="mt-2 max-w-[52ch] text-[16px] leading-relaxed text-ch-ink-2">A watch keeps checking a booked campground for you and tells you the moment someone cancels.</p>
      <Steps steps={[
        ["Pick a campground and your nights", "Exact dates, or how many nights you need inside a month you're free."],
        ["We check every 15 seconds", "Around the clock, right up until your trip date."],
        ["You get the site", `${visitor === "app" ? "A notification" : "Push, text and email"} in seconds — and on Recreation.gov we can drop it straight in your cart.`],
      ]} />
      <div className="mt-5 sm:max-w-[420px]">
        <WatchCtaLink visitor={visitor} label="Create your first watch" />
        <p className="mt-2 text-center text-[14px] text-ch-ink-2">Most people start with the trip they already missed out on.</p>
      </div>
    </Panel>
  );
}

/** The watch New watch just created, from its URL (?new=&start=&end=&nights=). */
function useCreated(): { watch: ExampleWatch; leadDays: number; quiet: boolean } | null {
  const id = useUrlParam("new");
  const start = useUrlParam("start") as ISODate | null;
  const end = useUrlParam("end") as ISODate | null;
  const nights = Number(useUrlParam("nights")) || undefined;
  const weekends = useUrlParam("weekends") === "1";
  const p = PICKABLE.find((x) => x.id === id);
  if (!p || !start || !end) return null;
  const parts = p.divisions?.filter((d) => d.reservable).map((d) => d.name);
  const known = CAMPGROUNDS.find((c) => c.id === p.id);
  const open = known ? availability(known, { radius: 999, start, end, flexNights: nights ?? null, filters: { siteType: null, rvLength: null, electric: false } }) : undefined;
  const leadDays = daysBetween(todayISO(), start);
  return {
    watch: { id: `new-${p.id}`, name: p.name, provider: p.provider, parts: parts && parts.length > 1 ? parts : undefined, start, end, flexNights: nights, weekendsOnly: weekends, autoCart: p.provider === "Recreation.gov", active: true },
    leadDays,
    // NewWatchOutlook: only for a stay we know is fully booked, more than two weeks out.
    quiet: open === false && leadDays > 14,
  };
}

/** WatchesList's column switch: one list in the DOM, split in two from 640px. */
function useTwoColumns(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(min-width: 640px)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 640px)").matches,
    () => false,
  );
}

export function Watches() {
  const [visitor, setVisitor] = useVisitor();
  const [plan, setPlan] = useUrlState<Plan>("plan", "autocart", PLANS);
  const [list, setList] = useUrlState<ListState>("state", "list", ["list", "empty", "loading", "failed"]);
  const [setup, setSetup] = useUrlState<"done" | "no-phone">("setup", "done", ["done", "no-phone"]);
  const [provider, setProvider] = useUrlState<"up" | "down">("provider", "up", ["up", "down"]);
  const [cart, setCart] = useUrlState<CartLink>("cart", "connected", ["connected", "reconnecting", "disconnected"]);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [outlookDismissed, setOutlookDismissed] = useState(false);
  const created = useCreated();
  const twoColumns = useTwoColumns();

  const subscriber = visitor === "subscriber";
  const watches = [...(created ? [created.watch] : []), ...WATCHES].map((w) => ({ ...w, holds: w.holds?.filter((h) => !removed.has(h.id)) }));
  const running = watches.filter((w) => w.active).length;
  const providerDown = provider === "down";
  const stalled = providerDown ? watches.filter((w) => w.active && w.provider === "ReserveCalifornia" && !w.openSites?.length).length : 0;
  const card = (w: ExampleWatch) => <WatchCard key={w.id} w={w} visitor={visitor} cart={cart} providerDown={providerDown} onRemoveHold={(id) => setRemoved((r) => new Set(r).add(id))} />;

  let body: React.ReactNode;
  if (visitor === "signed-out") body = <AccountWall visitor={visitor} />;
  else if (!subscriber || list === "empty") body = <FirstRun visitor={visitor} />;
  else if (list === "loading") {
    body = (
      <div role="status" className="grid gap-4 sm:grid-cols-2">
        <span className="sr-only">Loading your watches…</span>
        {[0, 1].map((i) => <div key={i} aria-hidden="true" className="h-[220px] animate-pulse rounded-ch-card border border-ch-line bg-ch-card shadow-ch-pop motion-reduce:animate-none" />)}
      </div>
    );
  } else if (list === "failed") {
    body = (
      <div className="rounded-ch-card border border-ch-line bg-ch-card p-6 shadow-ch-pop sm:p-8">
        <h2 className="font-ch-display text-[24px] font-extrabold text-ch-ink">We couldn&apos;t load your watches</h2>
        <p role="alert" className="mt-2 max-w-[56ch] text-[16px] leading-relaxed text-ch-ink-2">Your watches are still running — this is only the page. Try again in a moment.</p>
        <button type="button" onClick={() => setList("list")} className={buttonClasses({ variant: "ink", className: "mt-5 px-5" })}>Try again</button>
      </div>
    );
  } else {
    body = (
      <>
        {stalled > 0 && (
          <div className="mb-4 flex gap-3 rounded-[13px] border border-ch-line bg-ch-card px-4 py-3.5 shadow-ch-card">
            <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ch-ink-2" />
            <div>
              <p className="text-[16px] font-bold text-ch-ink">ReserveCalifornia isn&apos;t responding</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ch-ink-2">{stalled === 1 ? "1 watch is" : `${stalled} watches are`} affected. We&apos;re retrying automatically. Your other watches are unaffected.</p>
            </div>
          </div>
        )}
        {setup === "no-phone" && <PhoneNudge className="mb-4" />}
        {created?.quiet && !outlookDismissed && (
          <div className="mb-4 flex items-start gap-3 rounded-[13px] border border-ch-line bg-ch-card px-4 py-3.5 shadow-ch-card">
            <div className="flex-1">
              <p className="text-[16px] font-bold text-ch-ink">{OUTLOOK_HEADING}</p>
              <p className="mt-1 max-w-[70ch] text-[15px] leading-relaxed text-ch-ink-2">{outlookBody(created.leadDays)}</p>
            </div>
            <button type="button" onClick={() => setOutlookDismissed(true)} aria-label="Dismiss" className="-mr-1 -mt-1 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-[16px] text-ch-ink-2 hover:bg-ch-paper hover:text-ch-ink">✕</button>
          </div>
        )}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[13px] border border-ch-line bg-ch-card px-4 py-3.5 shadow-ch-card">
          <div className="min-w-[12rem] flex-1">
            <p className="text-[16px] font-bold text-ch-ink tabular-nums">{running} of {WATCH_LIMIT} watches running</p>
            <p className="mt-0.5 text-[14px] text-ch-ink-2">We check every 15 seconds, around the clock.</p>
          </div>
          <WatchCtaLink visitor={visitor} label="New watch" fullWidth={false} className="min-h-11 px-5" />
        </div>
        <h2 className="sr-only">Watches, running and paused</h2>
        {/* Two columns that don't share a row height; cards alternate so reading goes across, then down. */}
        {twoColumns ? (
          <div className="grid grid-cols-2 items-start gap-4">
            {[0, 1].map((col) => <div key={col} className="grid gap-4">{watches.filter((_, i) => i % 2 === col).map(card)}</div>)}
          </div>
        ) : (
          <div className="grid gap-4">{watches.map(card)}</div>
        )}
        <div className="mt-5">
          <Collapsible label="Alert history" summary={`${ALERTS.length} recent`}>
            <ul>
              {ALERTS.map((a) => (
                <li key={a.id} className="flex items-center gap-3 border-b border-ch-line py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-ch-ink">{a.campground} · {a.site}</p>
                    <p className="mt-0.5 text-[13px] text-ch-ink-2">{a.when} · {a.channels.join(", ")}{a.failed.map((c) => ` · ${c} failed`).join("")}</p>
                  </div>
                  {a.failed.length > 0 && <span className="shrink-0 rounded-ch-chip bg-ch-alert-soft px-2.5 py-1 text-[13px] font-bold text-ch-alert-deep">{a.failed.length === a.channels.length ? "not delivered" : `${a.failed[0]} not delivered`}</span>}
                </li>
              ))}
            </ul>
          </Collapsible>
        </div>
        <LabNote className="mt-4">Example watches, as if today were Monday, July 6.</LabNote>
      </>
    );
  }

  return (
    <div className="gh">
      <LabBar page="Your watches" visitor={visitor} onVisitor={setVisitor}>
        <ScreenLinks visitor={visitor} current="watches" />
        {subscriber && (
          <>
            <LabSelect label="Plan" short="Plan" value={plan} onChange={setPlan} options={[["autocart", "Auto-Cart"], ["alerts", "Alerts"]]} />
            <LabSelect label="Page state" short="Page" value={list} onChange={setList} options={[["list", "Watches"], ["empty", "None yet"], ["loading", "Loading"], ["failed", "Couldn't load"]]} />
            <LabSelect label="Text alerts" short="Phone" value={setup} onChange={setSetup} options={[["done", "Added"], ["no-phone", "Missing"]]} />
            <LabSelect label="ReserveCalifornia" short="Provider" value={provider} onChange={setProvider} options={[["up", "Answering"], ["down", "Not responding"]]} />
            <LabSelect label="Auto-cart connection" short="Auto-cart" value={cart} onChange={setCart} options={[["connected", "Connected"], ["reconnecting", "Reconnecting"], ["disconnected", "Signed out"]]} />
          </>
        )}
      </LabBar>
      <main id="main">
        <AppBand visitor={visitor} current="watches" title="Your watches" photo={<BandPhoto art={ART.w1} pos="85% 55%" posLg="50% 55%" />} />
        <div className="relative mx-auto -mt-[var(--gh-dock)] max-w-[var(--gh-max)] px-5 pb-[clamp(40px,6vw,80px)] sm:px-8">
          {body}
          <PricingLink visitor={visitor} plan={plan} className="mt-5" />
        </div>
      </main>
      <GhFooter visitor={visitor} />
    </div>
  );
}
