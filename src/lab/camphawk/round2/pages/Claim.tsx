"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2 } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import { LabSelect } from "../AppParts";
import { BareFrame } from "../BareFrame";
import { useUrlState } from "../labState";
import { CLAIM } from "./alert-data";

// Tier 1: Claim a held site (campsite-finder src/app/claim/[id], ClaimFlow.tsx, RcSignInForm.tsx,
// lib/claim-copy). The bot is holding a ReserveCalifornia site in ITS cart; this hands it to you.
// The riskiest moment in the product: during the swap the site is open to anyone for a couple of
// seconds. What it keeps on purpose:
// - Nothing is released until you press the button, and signing in is not "I'm ready".
// - The site number is set at display size: it's the one fact you carry into RC's grid.
// - The words depend on what the device can do: the app that can sign you in, a plain browser,
//   or an old app build that can't (which must SAY so; one lost a site in August by not saying).
// - An unconfirmed sign-in is not a refusal: it falls back to a checkbox.
// Lab changes: step markers are a shape and a word, in ink (CampHawk's "1" is ochre and "done" is
// green); "Open ReserveCalifornia" is the blue provider hand-off; the CAPTCHA prompt carries an
// icon as well as red; "Network error" is said as what happened; and the app's after-release
// line no longer tells you to "tap the cart icon" the button below replaced; the copy names the
// release button by its words, not as "the green button" (colour alone carries nothing).

type Status = "carted" | "carted-late" | "claiming" | "claiming-stuck" | "released" | "expired" | "failed" | "nothing" | "invalid";
type Device = "app" | "browser" | "old-app";
const STATUSES: readonly Status[] = ["carted", "carted-late", "claiming", "claiming-stuck", "released", "expired", "failed", "nothing", "invalid"];

const COPY = {
  browser: {
    prepareTitle: "Open ReserveCalifornia and sign in",
    prepareBody: "Do this first. Find your site and get as far as you can without booking — it will look taken, because we are the ones holding it. This page stays open; come back here when you are signed in.",
    prepareCta: "Open ReserveCalifornia",
    waitingTitle: "Sign in over there, then come back",
    waitingBody: "Nothing has been released yet. We keep holding it until you say go.",
    readyTitle: "Ready when you are",
    releasingBody: "Switch to your ReserveCalifornia tab and book it — we will also send you there if you stay here.",
    afterBody: "Book it on ReserveCalifornia now — it is open to anyone until you do.",
    afterCta: "Book it on ReserveCalifornia",
  },
  app: {
    prepareTitle: "Sign in and we will hand it over",
    prepareBody: "Enter your ReserveCalifornia login and we will sign you in here, then pass the site straight to you. Your password goes to ReserveCalifornia, never to us.",
    prepareCta: "Sign in to ReserveCalifornia",
    waitingTitle: "Waiting for you to sign in",
    waitingBody: "Sign in in that window, then close it. Nothing has been released yet — your site is still ours.",
    readyTitle: "Signed in. It's yours whenever you're ready",
    releasingBody: "Stay on this screen — we'll open ReserveCalifornia the moment it's yours.",
    afterBody: "We're putting it in your cart. When ReserveCalifornia opens, check out from the button below.",
    afterCta: "Finish on ReserveCalifornia",
  },
};

function SiteCard({ heading, tone, footer }: { heading: string; tone: "hold" | "done" | "warn"; footer?: ReactNode }) {
  return (
    <div className={cx("rounded-ch-card border-2 p-5 shadow-ch-pop sm:p-6", tone === "done" ? "border-ch-green bg-ch-card" : tone === "warn" ? "border-ch-ochre-line bg-ch-ochre-soft" : "border-ch-line bg-ch-card")}>
      <p role="status" className="text-[14px] font-extrabold text-ch-ink-2">{heading}</p>
      <h1 className="mt-1 font-ch-display text-[34px] font-extrabold leading-none tracking-[-.02em] text-ch-ink"><span className="sr-only">Claim </span>{CLAIM.unit}</h1>
      <p className="mt-2 text-[15px] text-ch-ink-2">{CLAIM.place}</p>
      <p className="mt-0.5 text-[15px] font-bold text-ch-ink-2">{CLAIM.stay} · {CLAIM.nights} nights</p>
      {footer && <p className="mt-3 border-t border-ch-line pt-3 text-[14px] text-ch-ink-2">{footer}</p>}
    </div>
  );
}

function Step({ tone, title, body, children }: { tone: "todo" | "busy" | "done"; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="mt-4 rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card">
      <div className="flex gap-3">
        <span aria-hidden="true" className={cx("grid size-8 shrink-0 place-items-center rounded-full", tone === "done" ? "bg-ch-ink text-ch-white" : "bg-ch-shell text-ch-ink")}>
          {tone === "done" ? <Check className="size-4" /> : tone === "busy" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <span className="text-[14px] font-extrabold">1</span>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold text-ch-ink"><span className="sr-only">{tone === "done" ? "Done: " : tone === "busy" ? "Waiting: " : "Next: "}</span>{title}</p>
          {body && <p className="mt-1 text-[15px] leading-relaxed text-ch-ink-2">{body}</p>}
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

function Notice({ children, warn, alert }: { children: ReactNode; warn?: boolean; alert?: boolean }) {
  return (
    <div role={alert ? "alert" : "status"} className={cx("mt-4 flex gap-3 rounded-ch-card border px-5 py-4 text-[15px] leading-relaxed", warn ? "border-ch-ochre-line bg-ch-ochre-soft text-ch-ink" : "border-ch-line bg-ch-card text-ch-ink-2 shadow-ch-card")}>
      {warn && <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

function RcSignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const missing = [!email && "enter your email", !password && "enter your password", !checked && "tick the box"].filter(Boolean) as string[];
  const field = "min-h-12 w-full rounded-ch-input border border-ch-line bg-ch-paper px-4 text-[16px] text-ch-ink focus-visible:border-ch-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green";
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (missing.length) return; setBusy(true); window.setTimeout(onSignedIn, 900); }} className="grid gap-3">
      <label className="grid gap-1.5"><span className="text-[13px] font-extrabold text-ch-ink-2">ReserveCalifornia email</span><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={field} /></label>
      <div className="grid gap-1.5">
        <label htmlFor="rc-pass" className="text-[13px] font-extrabold text-ch-ink-2">ReserveCalifornia password</label>
        <span className="relative">
          <input id="rc-pass" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={cx(field, "pr-20")} />
          <button type="button" onClick={() => setShow(!show)} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 min-w-16 px-3 text-[14px] font-bold text-ch-ink underline underline-offset-2">{show ? "Hide" : "Show"}</button>
        </span>
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-relaxed text-ch-ink-2">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 size-[18px] shrink-0 accent-ch-green" />
        <span>I have checked these are right. A wrong password can lock the ReserveCalifornia account, and we only get one go at this before the site is back on the open market.</span>
      </label>
      <button type="submit" disabled={missing.length > 0 || busy} className={buttonClasses({ variant: "cart", fullWidth: true, className: "min-h-12 disabled:cursor-not-allowed disabled:bg-ch-shell disabled:text-ch-ink-2 disabled:shadow-none" })}>{busy ? "Signing you in…" : "Sign in and hand it over"}</button>
      {missing.length > 0 && <p className="text-center text-[13px] text-ch-ink-2">{missing.length === 1 && !checked ? "Tick the box above to continue." : `To continue: ${missing.join(", ")}.`}</p>}
    </form>
  );
}

export function Claim() {
  const [status, setStatus] = useUrlState<Status>("status", "carted", STATUSES);
  const [device, setDevice] = useUrlState<Device>("device", "app", ["app", "browser", "old-app"]);
  return (
    <BareFrame page="Claim a held site" controls={() => (
      <>
        <LabSelect label="Hold status" short="Hold" value={status} onChange={setStatus} options={[["carted", "We're holding it"], ["carted-late", "Hold running out"], ["claiming", "Handing over"], ["claiming-stuck", "Handing over, stuck"], ["released", "Yours to book"], ["expired", "Expired"], ["failed", "Couldn't hold"], ["nothing", "Nothing held"], ["invalid", "Link no longer valid"]]} />
        <LabSelect label="Device" short="Device" value={device} onChange={setDevice} options={[["app", "The app"], ["browser", "A browser"], ["old-app", "An old app build"]]} />
      </>
    )}>
      {() => <ClaimBody key={`${status}-${device}`} status={status} device={device} setStatus={setStatus} />}
    </BareFrame>
  );
}

function ClaimBody({ status, device, setStatus }: { status: Status; device: Device; setStatus: (s: Status) => void }) {
  const canInject = device === "app";
  const c = canInject ? COPY.app : COPY.browser;
  const [opened, setOpened] = useState(false);
  const [ready, setReady] = useState(false);
  const [releasing, setReleasing] = useState(false);
  useEffect(() => {
    if (status !== "claiming") return;
    const t = window.setTimeout(() => setStatus("released"), 2200);
    return () => window.clearTimeout(t);
  }, [status, setStatus]);

  if (status === "invalid") return <><h1 className="sr-only">Claim a held site</h1><Notice>This link is no longer valid.</Notice></>;
  if (status === "expired") return <><h1 className="sr-only">Claim a held site</h1><Notice>That hold expired — nobody claimed it, so the site is back on the open market.</Notice></>;
  if (status === "failed") return <><h1 className="sr-only">Claim a held site</h1><Notice>We couldn&apos;t hold that site. Your alerts carry on as normal.</Notice></>;
  if (status === "nothing") return <><h1 className="sr-only">Claim a held site</h1><Notice>Nothing is being held for you right now.</Notice></>;

  if (status === "claiming" || status === "claiming-stuck") {
    return (
      <>
        <SiteCard heading="Letting go — grab it now" tone="hold" />
        <div className="mt-4 flex items-center gap-3 rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card">
          <Loader2 aria-hidden="true" className="size-6 shrink-0 animate-spin text-ch-ink-2 motion-reduce:animate-none" />
          <p className="text-[16px] leading-relaxed text-ch-ink-2">{c.releasingBody}</p>
        </div>
        {status === "claiming-stuck" && <Notice warn>This is taking longer than it should — our bot may be offline. The site is still held, so nothing is lost. Try again in a minute, or open ReserveCalifornia and search for {CLAIM.unit}.</Notice>}
      </>
    );
  }

  if (status === "released") {
    return (
      <>
        <SiteCard heading={`${CLAIM.unit} is yours to book`} tone="done" />
        <Step tone="todo" title={c.afterCta} body={c.afterBody}>
          <a href="#" className={buttonClasses({ variant: "cart", size: "lg", fullWidth: true })}>{canInject ? "Check out on ReserveCalifornia" : c.afterCta}<ExternalLink aria-hidden="true" className="size-4" /></a>
        </Step>
        <a href="#" className="mt-4 flex min-h-11 items-center justify-center text-[15px] font-bold text-ch-ink underline underline-offset-[3px]">Go straight to your ReserveCalifornia cart</a>
      </>
    );
  }

  // carted
  const late = status === "carted-late";
  return (
    <>
      <SiteCard heading={late ? "This may already be gone" : "We're holding this for you"} tone={late ? "warn" : "hold"}
        footer={late ? "Our hold on it has run out, so it may already be free again — worth trying anyway." : `We hold it for up to 60 minutes. About ${CLAIM.minutesLeft} min left.`} />
      {device === "old-app" && <Notice warn>This version of the app cannot sign in or add to your cart for you. Do that yourself on ReserveCalifornia now — the site stays held until you tap “It&apos;s mine — hand it over”, so it is not lost. Afterwards, update CampHawk from the App Store so the next one is automatic.</Notice>}
      <p className="mt-4 px-1 text-[16px] leading-relaxed text-ch-ink-2">When you tap “It&apos;s mine — hand it over” we let go and you take it. That swap takes a couple of seconds, and the site is open to anyone during it — so only tap when you’re ready to finish.</p>
      {ready ? (
        <Step tone="done" title={c.readyTitle} />
      ) : opened && !canInject ? (
        <Step tone="busy" title={c.waitingTitle} body={c.waitingBody}>
          <label className="flex cursor-pointer items-start gap-3 rounded-ch-input border border-ch-line bg-ch-paper p-4 text-[15px] leading-relaxed text-ch-ink">
            <input type="checkbox" onChange={(e) => setReady(e.target.checked)} className="mt-1 size-[18px] shrink-0 accent-ch-green" />
            <span>I&apos;m signed in to ReserveCalifornia and looking at {CLAIM.unit}</span>
          </label>
        </Step>
      ) : (
        <Step tone="todo" title={c.prepareTitle} body={c.prepareBody}>
          {canInject
            ? <RcSignInForm onSignedIn={() => setReady(true)} />
            : <a href="#" onClick={(e) => { e.preventDefault(); setOpened(true); }} className={buttonClasses({ variant: "cart", size: "lg", fullWidth: true })}>{c.prepareCta}<ExternalLink aria-hidden="true" className="size-4" /></a>}
        </Step>
      )}
      {ready ? (
        <button type="button" onClick={() => { setReleasing(true); window.setTimeout(() => setStatus("claiming"), 400); }} className={buttonClasses({ size: "lg", fullWidth: true, className: "mt-4" })}>{releasing ? "Releasing…" : "It's mine — hand it over"}</button>
      ) : !canInject && (
        <p className="mt-3 text-center text-[14px] text-ch-ink-2">Tick the box once you’re signed in and on the page — we won’t let go until then.</p>
      )}
    </>
  );
}
