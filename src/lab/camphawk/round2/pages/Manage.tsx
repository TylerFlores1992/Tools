"use client";

import { useState } from "react";
import Link from "next/link";
import { BellOff, ChevronLeft, ExternalLink } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import { Card } from "../../ui/Card";
import { Collapsible } from "../../ui/Collapsible";
import { DatePicker, type DateRange } from "../../ui/DatePicker";
import { Tag } from "../../ui/Tag";
import { formatRange, nightsBetween, type ISODate } from "../../ui/date";
import { ART } from "../Art";
import { LabSelect } from "../AppParts";
import { ROUTES } from "../gates";
import { LabNote, LabPage } from "../LabPage";
import { useSwapFocus } from "../useSwapFocus";
import { useUrlState, withVisitor } from "../labState";
import { MANAGE, releaseLong, releaseShort, type ManageWatch } from "./alert-data";

// Tier 1: Manage a watch (campsite-finder src/app/(app)/manage/[token], ManageWatch.tsx,
// SiteMuteList.tsx). The token in the link is the credential, so a tapped alert opens it signed
// out. What it keeps on purpose:
// - "Open now" first, with when we last saw it: a last-seen record, not a live look.
// - "Holds you asked for" above the offers: a commitment the bot acts on at 8 AM.
// - Offers read as offers, not availability ("open" would send someone to a site they can't take).
// - A rejected date edit stays open with the reason, so the typed dates aren't lost.
// - Remove is last, with an in-page confirm.
// Lab changes, from CampHawk's own rules: a muted site is neutral (CampHawk's "Muted" is a red
// button); the queued-hold panel is ochre ("you asked for this"), not green; "Hold it" is
// green (it's how you get the site) and "Book" the blue provider hand-off; "Back to watches" is a
// paper link on the band; server messages are
// sentences, not "startDate must be a date like 2026-09-04"; one release-time format.

type Link_ = "works" | "expired" | "fails";

function MuteSites({ w }: { w: ManageWatch }) {
  const [muted, setMuted] = useState<ReadonlySet<string>>(() => new Set(w.sites.slice(1, 1 + w.muted).map((s) => s.id)));
  const toMute = w.sites.filter((s) => !muted.has(s.id)).map((s) => s.id);
  const toUnmute = w.sites.filter((s) => muted.has(s.id)).map((s) => s.id);
  const set = (ids: string[], on: boolean) => setMuted((m) => { const n = new Set(m); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const small = buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 px-3.5" });
  return (
    <Collapsible label="Mute individual campsites" summary={muted.size ? `${muted.size} muted` : undefined}>
      <p className="pb-3 text-[15px] leading-relaxed text-ch-ink-2">Mute a site to stop hearing about it — the one by the road, the one with no shade, the one you already tried. The watch keeps running for every other site.</p>
      {w.parts && <p className="mb-3 rounded-ch-input bg-ch-paper px-3 py-2 text-[13px] text-ch-ink-2">Muting below covers {w.firstPart} only — the other parts keep alerting.</p>}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {toMute.length > 0 && <button type="button" onClick={() => set(toMute, true)} className={small}>Mute all {toMute.length}</button>}
        {toUnmute.length > 0 && <button type="button" onClick={() => set(toUnmute, false)} className={small}>Unmute all {toUnmute.length}</button>}
        <span className="text-[13px] text-ch-ink-2">{muted.size ? `${muted.size} of ${w.sites.length} muted` : "Mute all, then unmute the few you'd take"}</span>
      </div>
      <ul className="max-h-[320px] overflow-y-auto overscroll-contain">
        {w.sites.map((s) => {
          const on = muted.has(s.id);
          return (
            <li key={s.id} className="flex items-center gap-3 border-b border-ch-line py-2 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className={cx("block truncate text-[15px] font-bold", on ? "text-ch-muted" : "text-ch-ink")}>{s.name}</span>
                <span className="block text-[13px] text-ch-ink-2">{s.note}</span>
              </span>
              <button type="button" aria-pressed={on} aria-label={`Mute site ${s.name}`} onClick={() => set([s.id], !on)} className={cx(buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 min-w-[96px] px-3" }), on && "border-ch-muted bg-ch-shell")}>
                {on && <BellOff aria-hidden="true" className="size-4" />}{on ? "Muted" : "Mute"}
              </button>
            </li>
          );
        })}
      </ul>
    </Collapsible>
  );
}

export function Manage() {
  const [which, setWhich] = useUrlState<"upper-pines" | "leo">("watch", "upper-pines", ["upper-pines", "leo"]);
  const [link, setLink] = useUrlState<Link_>("link", "works", ["works", "expired", "fails"]);
  const w = MANAGE[which];
  return (
    <LabPage
      page="Manage watch"
      tab="watches"
      title={link === "works" ? w.name : "Can't open this watch"}
      photo={which === "upper-pines" ? { art: ART.c1, pos: "60% 60%", posLg: "50% 55%" } : { art: ART.m1, pos: "28% 65%", posLg: "50% 62%" }}
      controls={() => (
        <>
          <LabSelect label="Example watch" short="Watch" value={which} onChange={setWhich} options={[["upper-pines", "Upper Pines (open now)"], ["leo", "Leo Carrillo (8am holds)"]]} />
          <LabSelect label="Link" short="Link" value={link} onChange={setLink} options={[["works", "Works"], ["expired", "Expired"], ["fails", "Won't load"]]} />
        </>
      )}
    >
      {({ visitor }) => link !== "works" ? (
        <div className="rounded-ch-card border border-ch-line bg-ch-card p-6 text-center shadow-ch-pop sm:p-10">
          <p className="mx-auto max-w-[46ch] text-[17px] leading-relaxed text-ch-ink-2">{link === "expired" ? "This link has expired. Open the watch from your Watches list instead." : "Could not load this watch."}</p>
          <Link href={withVisitor(ROUTES.watches, visitor)} className={buttonClasses({ variant: "quiet", className: "mt-5 px-5" })}>Back to watches</Link>
        </div>
      ) : (
        <ManageBody key={which} w={w} back={withVisitor(ROUTES.watches, visitor)} calendar={which === "leo" ? "#" : withVisitor(`${ROUTES.campground}?id=upper-pines`, visitor)} />
      )}
    </LabPage>
  );
}

function ManageBody({ w, back, calendar }: { w: ManageWatch; back: string; calendar: string }) {
  const [active, setActive] = useState(true);
  const [editing, setEditing] = useState(false);
  const [requested, setRequested] = useState(w.requested);
  const { confirmRef: editPanelRef, triggerRef: editTriggerRef } = useSwapFocus<HTMLDivElement>(editing);
  const [range, setRange] = useState<DateRange>({ start: w.start, end: w.end });
  const [saved, setSaved] = useState<DateRange>({ start: w.start, end: w.end });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removed, setRemoved] = useState(false);

  if (removed) {
    return (
      <div className="rounded-ch-card border border-ch-line bg-ch-card p-6 text-center shadow-ch-pop sm:p-10">
        <h2 className="font-ch-display text-[28px] font-extrabold text-ch-ink">Watch removed</h2>
        <p className="mx-auto mt-2 max-w-[46ch] text-[17px] text-ch-ink-2">We&apos;ve stopped checking, and you won&apos;t get any more alerts for it.</p>
        <Link href={back} className={buttonClasses({ variant: "quiet", className: "mt-5 px-5" })}>Back to watches</Link>
      </div>
    );
  }

  const nights = w.flexNights ?? nightsBetween(saved.start!, saved.end!);
  const meta = [`${nights} ${nights === 1 ? "night" : "nights"}`, w.weekendsOnly ? "weekends only" : null, w.muted ? `${w.muted} sites muted` : null].filter(Boolean).join(" · ");
  const saveDates = () => {
    if (!range.start || !range.end) return;
    setSaving(true);
    setError(null);
    window.setTimeout(() => {
      setSaving(false);
      const n = nightsBetween(range.start!, range.end!);
      // CampHawk shows the API's raw string ("this watch is looking for 3 nights, which does not
      // fit in that window"); the lab says the same thing as a sentence.
      if (w.flexNights && n < w.flexNights) { setError(`This watch is looking for ${w.flexNights} nights, which don't fit between those dates. Pick a wider window.`); return; }
      if (!w.flexNights && n > 365) { setError("A watch can cover at most 365 days."); return; }
      setSaved(range);
      setEditing(false);
    }, 500);
  };

  return (
    <div className="grid gap-5">
      {/* It sits on the band's photo, above the card that docks into it: paper type, underlined. */}
      <Link href={back} className="inline-flex min-h-11 items-center gap-1 justify-self-start text-[15px] font-bold text-ch-paper underline underline-offset-[3px] hover:decoration-2">
        <ChevronLeft aria-hidden="true" className="size-4" /> Back to watches
      </Link>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="grid min-w-0 content-start gap-5">
      <Card state={active ? "default" : "paused"} className="p-5 shadow-ch-pop sm:p-7">
        <div data-card-dim>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {active ? <Tag kind="watch">Watching</Tag> : <Tag kind="paused">Paused</Tag>}
            {w.autoCart && w.provider === "Recreation.gov" && <Tag kind="cart" mark="auto-cart">Auto-cart</Tag>}
            <Tag kind="src">{w.provider}</Tag>
          </div>
          {/* The band already names the watch; the card doesn't say it twice. */}
          <h2 className="sr-only">Watch details</h2>
          {w.parts && (
            <div className="mt-3 rounded-ch-input border border-ch-line bg-ch-paper px-4 py-3">
              <p className="text-[13px] font-extrabold text-ch-ink-2">{w.parts.length} parts of this park</p>
              <ul className="mt-1 grid gap-0.5 text-[15px] text-ch-ink">{w.parts.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}
          {!editing && (
            <>
              <p className="mt-4 text-[17px] font-bold text-ch-ink-2">{w.flexNights ? `Any ${w.flexNights} nights, ${formatRange(saved.start, saved.end)}` : formatRange(saved.start, saved.end)}</p>
              <p className="mt-0.5 text-[15px] text-ch-ink-2">{meta}</p>
            </>
          )}
        </div>
        {editing && (
          <div ref={editPanelRef} tabIndex={-1} role="group" aria-label="Edit dates" className="mt-4 grid gap-3 outline-none">
            <DatePicker value={range} onChange={setRange} label={w.flexNights ? "Search window" : "Trip dates"} meta={w.flexNights && range.start ? `any ${w.flexNights} nights in this window` : undefined} defaultOpen defaultMonth={range.start as ISODate} />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={saveDates} disabled={!range.start || !range.end || saving} className={buttonClasses({ variant: "ink", size: "sm", className: "min-h-11 px-4 disabled:cursor-not-allowed disabled:bg-ch-shell disabled:text-ch-ink-2 disabled:shadow-none" })}>{saving ? "Saving…" : "Save dates"}</button>
              <button type="button" onClick={() => { setEditing(false); setRange(saved); setError(null); }} className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 px-4" })}>Cancel</button>
            </div>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-ch-line pt-4">
          <Link href={calendar} className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 px-4" })}>Calendar</Link>
          <a href="#" className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 px-4" })}>Open on {w.provider}<ExternalLink aria-hidden="true" className="size-3.5" /></a>
          {!editing && <button ref={editTriggerRef} type="button" onClick={() => setEditing(true)} className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 px-4" })}>Edit dates</button>}
          {active
            ? <button type="button" onClick={() => setActive(false)} className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 px-4" })}>Pause checks</button>
            : <button type="button" onClick={() => setActive(true)} className={buttonClasses({ variant: "ink", size: "sm", className: "min-h-11 px-4" })}>Resume checks</button>}
        </div>
      </Card>
      {error && <p role="alert" className="rounded-ch-input border border-ch-alert bg-ch-alert-soft px-4 py-3 text-[15px] text-ch-alert-deep">{error}</p>}

      {w.open.length > 0 && (
        <section aria-labelledby="open-now" className="rounded-ch-card border-[1.5px] border-ch-green bg-ch-card p-5 shadow-ch-card">
          <h2 id="open-now" className="flex items-center gap-2"><Tag kind="open">{w.open.length} site{w.open.length === 1 ? "" : "s"} open now</Tag></h2>
          <ul className="mt-3 divide-y divide-ch-line">
            {w.open.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-bold text-ch-ink">{o.name}</span>
                  <span className="block text-[14px] text-ch-ink-2">{o.seenSecondsAgo < 90 ? "Seen open just now" : `Seen open ${Math.round(o.seenSecondsAgo / 60)} min ago`}</span>
                </span>
                <a href="#" className={buttonClasses({ variant: "cart", size: "sm", className: "min-h-11 px-5" })}>Book<ExternalLink aria-hidden="true" className="size-3.5" /></a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[14px] text-ch-ink-2">Last seen by our checks, not a live look. {w.provider === "Recreation.gov" ? "Book goes straight to the site page." : "Book opens the loop on the provider — pick the site and dates there."}</p>
        </section>
      )}

      {requested.length > 0 && (
        <section aria-labelledby="grab" className="rounded-ch-card border border-l-4 border-ch-line border-l-ch-ochre bg-ch-card p-5 shadow-ch-card">
          <h2 id="grab" className="font-ch-display text-[19px] font-extrabold text-ch-ink">Holds you asked for</h2>
          <ul className="mt-2 divide-y divide-ch-line">
            {requested.map((r) => (
              <li key={r.unit} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2"><span className="text-[16px] font-bold text-ch-ink">{r.unit}</span><Tag kind="watch" mark="queued">Asked</Tag></span>
                  <span className="mt-0.5 block text-[14px] text-ch-ink-2">{r.stay} · releases {releaseLong()}</span>
                </span>
                <button type="button" onClick={() => setRequested((xs) => xs.filter((x) => x.unit !== r.unit))} aria-label={`Call off the hold on ${r.unit}`} className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 px-4" })}>Call this off</button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[14px] text-ch-ink-2">You asked us to hold {requested.length === 1 ? "this one" : "these"} at the {releaseShort()} release. You’ll get an alert the moment it’s in the cart, with a link to take it.</p>
        </section>
      )}

      {w.offered.length > 0 && (
        <section aria-labelledby="offered" className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card">
          <h2 id="offered" className="font-ch-display text-[19px] font-extrabold text-ch-ink">Sites you can hold at {releaseShort()}</h2>
          <ul className="mt-2 divide-y divide-ch-line">
            {w.offered.map((o) => (
              <li key={o.unit} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold text-ch-ink">{o.unit}</span>
                  <span className="mt-0.5 block text-[14px] text-ch-ink-2">{o.nights} nights from {o.from}</span>
                </span>
                <Link href={withVisitor(`${ROUTES.action}?action=hold-offer`, "subscriber")} aria-label={`Hold it: ${o.unit}`} className={buttonClasses({ size: "sm", className: "min-h-11 px-5" })}>Hold it</Link>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[14px] text-ch-ink-2">{requested.length > 0 ? `You’ve already asked us to hold ${requested.map((x) => x.unit).join(" and ")}. Ask for another only if you’d take either — while we hold a site, nobody else can book it.` : "Only ask for one you actually want — while we hold it, nobody else can book it."}</p>
        </section>
      )}

      </div>
      {/* Wide screens: the watch and its sites on the left, the settings and history beside it. */}
      <div className="grid content-start gap-5">
      <MuteSites w={w} />
      {w.alerts.length > 0 && (
        <Collapsible label="Alerts sent" summary={`${w.alerts.length} sent`}>
          <ul>
            {w.alerts.map((a, i) => (
              <li key={i} className="border-b border-ch-line py-2.5 last:border-b-0">
                <p className="text-[15px] font-bold text-ch-ink">{a.site ?? "A site opened up"}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ch-ink-2">{a.when} · {a.channel}{a.failed && <Tag kind="alert">Didn&apos;t go out</Tag>}</p>
              </li>
            ))}
          </ul>
        </Collapsible>
      )}

      <div className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card">
        {!confirming ? (
          <div className="grid gap-3">
            <p className="flex-1 text-[15px] text-ch-ink-2">Done with this trip? Removing the watch deletes it and its alert history.</p>
            <button type="button" onClick={() => setConfirming(true)} className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 justify-self-start px-4" })}>Remove watch</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-[16px] font-bold text-ch-ink">Remove this watch permanently?</p>
            <button type="button" onClick={() => setConfirming(false)} className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 px-4" })}>Keep it</button>
            <button type="button" onClick={() => setRemoved(true)} className={buttonClasses({ variant: "warn", size: "sm", className: "min-h-11 px-4" })}>Remove</button>
          </div>
        )}
      </div>
      <LabNote>Example watch, as if today were Monday, July 6.</LabNote>
      </div>
      </div>
    </div>
  );
}
