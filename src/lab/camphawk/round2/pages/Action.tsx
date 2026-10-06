"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { buttonClasses } from "../../ui";
import { LabSelect } from "../AppParts";
import { BareCard, BareFrame, BetaNote, Facts } from "../BareFrame";
import { ROUTES } from "../gates";
import { useUrlState, withVisitor } from "../labState";
import { HOLD, releaseLong } from "./alert-data";

// Tier 1: the one-tap action page (campsite-finder src/app/w/[token], HoldConfirm.tsx). A tapped
// link in an alert does its thing on arrival (like an unsubscribe link) and offers the opposite.
// Every action but one is reversible, so an email scanner opening the link is harmless. The
// exception is the 8am hold: it takes a real site off the market, so it shows the site first and
// waits for a yes. What it keeps on purpose:
// - The hold offer says which site, which nights and when, before anything happens.
// - "Beta" sits above the promise; "Not secured yet" is said whenever it's true.
// - Revisiting a confirmed hold says so ("no need to tap again").
// Lab changes, from CampHawk's own rules: the undo is a neutral button (CampHawk's is green, which
// means "gets you a site"); the result carries a shape and a word (a tick or a warning triangle,
// not ✅/⚠️ emoji); "Yes — hold it for me" is green, because it's the tap that gets you the site; a muted
// site is named by its site name, never the provider's id; one
// release-time format.

const ACTIONS = [
  "stop", "stop-again", "reopen", "keep", "mute", "bad-link", "unknown",
  "hold-offer", "hold-offer-second", "hold-refused", "hold-confirmed", "hold-full", "hold-bot-offline", "hold-revisit",
  "hold-not-entitled", "hold-unchecked", "hold-in-cart", "hold-withdrawn", "hold-booked", "hold-gone",
] as const;
type Action = (typeof ACTIONS)[number];

const CG = "Upper Pines";
type Result = { ok: boolean; title: string; message: string; inverse?: [label: string, to: Action] };
const RESULTS: Partial<Record<Action, Result>> = {
  stop: { ok: true, title: "Done", message: `Stopped watching ${CG}.`, inverse: ["Reopen this watch", "reopen"] },
  "stop-again": { ok: true, title: "Done", message: "Already stopped.", inverse: ["Reopen this watch", "reopen"] },
  reopen: { ok: true, title: "Done", message: `Watching ${CG} again.`, inverse: ["Stop watching", "stop"] },
  keep: { ok: true, title: "Done", message: `Kept ${CG} active.`, inverse: ["Stop watching", "stop"] },
  mute: { ok: true, title: "Done", message: `Muted Site 101 at ${CG}. You'll still hear about other sites.` },
  "bad-link": { ok: false, title: "That link didn't work", message: "It has expired or was already used. Open CampHawk to manage your watches." },
  unknown: { ok: false, title: "That link didn't work", message: "We couldn't tell what this link was for. Open CampHawk to manage your watches." },
  "hold-not-entitled": { ok: false, title: "We didn’t hold this one", message: "Holding a site at release time is part of the Auto-Cart plan. Your alerts carry on as normal — you can still book it yourself the moment it opens." },
  "hold-unchecked": { ok: false, title: "We couldn’t check just now", message: "We couldn’t read this hold’s status. Try the link again in a minute — nothing has been changed." },
  "hold-in-cart": { ok: true, title: "It’s in our cart", message: `We got ${HOLD.unit} at ${HOLD.campground} into our cart. Open the alert we sent when we carted it to claim it — we hold it for up to 60 minutes, so do it soon.` },
  "hold-withdrawn": { ok: false, title: "Booked before it opened", message: "ReserveCalifornia withdrew this site before it opened, so there is nothing for us to hold. Your alerts carry on as normal." },
  "hold-booked": { ok: false, title: "Booked before it opened", message: "Someone else booked this site before it opened, so there is nothing for us to hold. Your alerts carry on as normal." },
  "hold-gone": { ok: false, title: "This offer has closed", message: "We didn’t hold anything — that offer is no longer available. The site may have already been released, or the request expired. Your alerts carry on as normal." },
};

function ResultCard({ r, onInverse, home }: { r: Result; onInverse: (a: Action) => void; home: string }) {
  const Icon = r.ok ? CheckCircle2 : AlertTriangle;
  return (
    <BareCard className="text-center">
      <Icon aria-hidden="true" className="mx-auto size-10 text-ch-ink-2" />
      <h1 className="mt-3 font-ch-display text-[26px] font-extrabold text-ch-ink">{r.title}</h1>
      <p role="status" className="mx-auto mt-2 max-w-[40ch] text-[17px] leading-relaxed text-ch-ink-2">{r.message}</p>
      <div className="mt-6 grid gap-2">
        {r.ok && r.inverse && <button type="button" onClick={() => onInverse(r.inverse![1])} className={buttonClasses({ variant: "quiet", fullWidth: true, className: "min-h-12" })}>{r.inverse[0]}</button>}
        <Link href={home} className="inline-flex min-h-11 items-center justify-center text-[15px] font-bold text-ch-ink underline underline-offset-[3px]">Back to CampHawk</Link>
      </div>
    </BareCard>
  );
}

function LineNote({ rank }: { rank: 1 | 2 }) {
  return (
    <p className="mt-4 rounded-ch-input border border-ch-line bg-ch-paper px-4 py-3 text-[15px] leading-relaxed text-ch-ink-2">
      {rank === 1
        ? <><strong className="font-bold text-ch-ink">You’re first in line for this site.</strong> 1 other person is watching it too, but this one is yours to take.</>
        : <><strong className="font-bold text-ch-ink">You’re next in line for this site.</strong> Somebody else gets first refusal. If they don’t ask us to hold it, we’ll try to cart it for you instead.</>}
    </p>
  );
}

function HoldOffer({ second, onYes }: { second: boolean; onYes: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <BareCard>
      <h1 className="font-ch-display text-[28px] font-extrabold leading-tight text-ch-ink">Hold this site for you?</h1>
      <Facts rows={[["Campground", HOLD.campground], ["Site", <span key="s" className="font-ch-display text-[22px] font-extrabold">{HOLD.unit}</span>], ["Nights", `${HOLD.stay} · ${HOLD.nights} nights`], ["Releases", releaseLong()]]} />
      <p className="mt-4 text-[16px] leading-relaxed text-ch-ink-2">If you say yes, our bot tries to cart this exact site the second it opens and hold it for you for up to 60 minutes, so claim it within that time when we tell you. Only say yes if you actually want it: while we’re holding it, nobody else can book it.</p>
      {/* The beta note stays above the promise, on purpose. */}
      <BetaNote className="mt-4" />
      {/* Never disabled: a second tap while it works is harmless, and a dead button reads as broken. */}
      <button type="button" onClick={() => { setBusy(true); window.setTimeout(onYes, 700); }} className={buttonClasses({ size: "lg", fullWidth: true, className: "mt-5" })}>
        {busy ? <><Loader2 aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />Holding…</> : "Yes — hold it for me"}
      </button>
      <p className="mt-3 text-center text-[14px] text-ch-ink-2">Do nothing and we won’t hold it. You’ll still get the normal alert when it opens.</p>
      {second && <LineNote rank={2} />}
      <a href="#" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-bold text-ch-forest underline underline-offset-[3px]">Look at {HOLD.unit} on ReserveCalifornia<ExternalLink aria-hidden="true" className="size-4" /></a>
    </BareCard>
  );
}

function HoldConfirmed({ kind }: { kind: "fresh" | "revisit" | "full" | "offline" }) {
  return (
    <BareCard>
      <CheckCircle2 aria-hidden="true" className="size-10 text-ch-ink-2" />
      <h1 className="mt-3 font-ch-display text-[28px] font-extrabold leading-tight text-ch-ink">{kind === "revisit" ? "You’re on the list for this site" : "Got it — we’ll try for this site"}</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-ch-ink-2">{kind === "revisit" ? "Your request is in, no need to tap again." : "We have your request."} When {HOLD.unit} at {HOLD.campground} opens on {releaseLong()}, our bot will try to put it in the cart for you.</p>
      {(kind === "full" || kind === "offline") && (
        <p className="mt-4 rounded-ch-input border border-ch-ochre-line bg-ch-ochre-soft px-4 py-3 text-[15px] leading-relaxed text-ch-ink-2">
          <strong className="font-bold text-ch-ink">Not secured yet.</strong>{" "}
          {kind === "full" ? "Every slot we have for that release is taken, so this one is waiting for a free slot rather than secured. Plan to book it yourself when it opens." : "Our booking bot is offline right now. It has until the release to come back, but plan to book it yourself when it opens."}
        </p>
      )}
      <Facts rows={[["Site", HOLD.unit], ["Nights", `${HOLD.stay} · ${HOLD.nights} nights`], ["Releases", releaseLong()]]} />
      <p className="mt-5 text-[16px] font-bold text-ch-ink">What happens next</p>
      <ul className="mt-2 grid gap-2 text-[15px] leading-relaxed text-ch-ink-2">
        <li className="flex gap-2.5"><span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-ch-ink-2" />If we get it, we’ll alert you right away with a link to claim it. We hold it for up to 60 minutes, so claim it within that time.</li>
        <li className="flex gap-2.5"><span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-ch-ink-2" />If we miss it, we’ll tell you.</li>
        <li className="flex gap-2.5"><span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-ch-ink-2" />Set an alarm for {releaseLong()} anyway, in case we miss.</li>
      </ul>
      <BetaNote className="mt-5" />
    </BareCard>
  );
}

const LABELS: Record<Action, string> = {
  stop: "Stop watching", "stop-again": "Stop (already stopped)", reopen: "Reopen", keep: "Keep (still want this?)", mute: "Mute a site", "bad-link": "Expired link", unknown: "Unknown action",
  "hold-offer": "8am hold: offer", "hold-offer-second": "8am hold: offer, second in line", "hold-refused": "8am hold: not on Auto-Cart", "hold-confirmed": "8am hold: confirmed",
  "hold-full": "8am hold: confirmed, slots full", "hold-bot-offline": "8am hold: confirmed, bot offline", "hold-revisit": "8am hold: opened again",
  "hold-not-entitled": "8am hold: plan doesn't include it", "hold-unchecked": "8am hold: couldn't check", "hold-in-cart": "8am hold: already in our cart",
  "hold-withdrawn": "8am hold: withdrawn by ReserveCalifornia", "hold-booked": "8am hold: booked by someone", "hold-gone": "8am hold: offer closed",
};

export function ActionPage() {
  const [action, setAction] = useUrlState<Action>("action", "stop", ACTIONS);
  return (
    <BareFrame page="One-tap action" controls={() => <LabSelect label="What the link did" short="Link" value={action} onChange={setAction} options={ACTIONS.map((a) => [a, LABELS[a]] as const)} />}>
      {({ visitor }) => {
        const home = withVisitor(visitor === "app" ? ROUTES.explore : ROUTES.home, visitor);
        if (action === "hold-offer" || action === "hold-offer-second") return <HoldOffer second={action === "hold-offer-second"} onYes={() => setAction("hold-confirmed")} />;
        if (action === "hold-confirmed") return <HoldConfirmed kind="fresh" />;
        if (action === "hold-revisit") return <HoldConfirmed kind="revisit" />;
        if (action === "hold-full") return <HoldConfirmed kind="full" />;
        if (action === "hold-bot-offline") return <HoldConfirmed kind="offline" />;
        if (action === "hold-refused") {
          return (
            <BareCard>
              <AlertTriangle aria-hidden="true" className="size-10 text-ch-ink-2" />
              <h1 className="mt-3 font-ch-display text-[28px] font-extrabold text-ch-ink">We didn’t hold this one</h1>
              <p className="mt-2 text-[16px] leading-relaxed text-ch-ink-2">Holding a site at release time is part of the Auto-Cart plan, so nothing is queued for {HOLD.unit}. Your alerts carry on as normal. You can still book it yourself the moment it opens, {releaseLong()}.</p>
            </BareCard>
          );
        }
        return <ResultCard r={RESULTS[action]!} onInverse={setAction} home={home} />;
      }}
    </BareFrame>
  );
}
