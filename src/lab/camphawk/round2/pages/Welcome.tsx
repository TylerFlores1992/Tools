"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import { ART } from "../Art";
import { LabSelect } from "../AppParts";
import { GH, ROUTES } from "../gates";
import { LabNote, LabPage } from "../LabPage";
import { useUrlParam, useUrlState, useVisitor, withVisitor } from "../labState";
import { SmsAlerts } from "../SmsAlerts";
import { EMAIL } from "./alert-data";
import { CHECK_SECONDS } from "./tier2-data";

// Tier 1: Welcome after sign-up (campsite-finder src/app/(app)/welcome). One setup step right
// after an account is made, or on the way back from checkout: email on or off, an optional text
// number, and the Recreation.gov sign-in if the plan includes auto-cart. What it keeps on purpose:
// - It's a step after sign-up, because the sign-up form takes no extra fields.
// - Texts stay optional: the box starts unticked, saving is its own button, and Finish and Skip
//   are always there (carrier rules: "not a condition of purchase").
// - The Auto-Cart card only shows to someone whose plan includes it; to anyone else it would be
//   an ad dressed as a setup step.
// - Finish never traps you: a failed save still moves on.
// Lab changes, from CampHawk's own rules: the Auto-Cart card is the blue Recreation.gov hand-off
// (CampHawk's is green); "Skip for now" skips, it doesn't quietly save email-off.

type From = "sign-up" | "checkout";

export function Welcome() {
  const [from, setFrom] = useUrlState<From>("from", "sign-up", ["sign-up", "checkout"]);
  const [saving, setSaving] = useState<"finish" | "skip" | null>(null);
  // ?next= is where sign-up was headed; only a lab path is followed (never off-site).
  const nextParam = useUrlParam("next");
  const nextPath = nextParam && nextParam.startsWith(`${GH}/`) && !nextParam.startsWith("//") ? nextParam : ROUTES.explore;
  // One title per screen: the band says it, the card doesn't repeat it.
  const [viewer] = useVisitor();
  const title = viewer === "signed-out" ? "Sign in to finish setting up" : from === "checkout" && viewer === "subscriber" ? "You're subscribed. Let's set up your alerts." : "You're in. How should we reach you?";
  return (
    <LabPage
      page="Welcome"
      title={title}
      showPlan
      photo={{ art: ART.t1, pos: "60% 20%", posLg: "50% 18%" }}
      controls={({ visitor }) => visitor !== "signed-out" && (
        <LabSelect label="Arrived from" short="From" value={from} onChange={setFrom} options={[["sign-up", "Sign-up"], ["checkout", "Checkout"]]} />
      )}
    >
      {({ visitor, plan }) => {
        if (visitor === "signed-out") {
          return (
            <div className="max-w-[720px] rounded-ch-card border border-ch-line bg-ch-card p-6 text-center shadow-ch-pop sm:p-10">
              <p className="mx-auto max-w-[48ch] text-[16px] leading-relaxed text-ch-ink-2">Once you&apos;re signed in, you&apos;ll choose how we reach you when a campsite opens up. New here? Creating an account takes a minute.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link href={withVisitor(ROUTES.signUp, visitor)} className={buttonClasses({ variant: "ink", className: "min-h-12 px-6" })}>Create an account</Link>
                <Link href={withVisitor(ROUTES.signIn, visitor)} className={buttonClasses({ variant: "quiet", className: "min-h-12 px-6" })}>Sign in</Link>
              </div>
            </div>
          );
        }
        // Checkout only makes sense for someone it made a subscriber.
        const subscribed = from === "checkout" && visitor === "subscriber";
        const next = withVisitor(nextPath, visitor);
        const go = (kind: "finish" | "skip") => { setSaving(kind); window.setTimeout(() => window.location.assign(next), 700); };
        return (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="grid min-w-0 gap-4">
          <div className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-pop sm:p-9">
            <p className="max-w-[56ch] text-[16px] leading-relaxed text-ch-ink-2">Set this up now and an opening reaches you the moment we find it. You can change any of it later in Settings.</p>

            <section aria-labelledby="w-email" className="mt-7 rounded-ch-input border border-ch-line p-4 sm:p-5">
              <h2 id="w-email" className="text-[17px] font-extrabold text-ch-ink">Email alerts</h2>
              {/* Email is always on, as Settings says (CampHawk's Welcome has an email checkbox that
                  Settings then ignores; the lab keeps one model). */}
              <p className="mt-2 flex items-start gap-3 text-[15px] leading-relaxed text-ch-ink-2"><Mail aria-hidden="true" className="mt-0.5 size-5 shrink-0" /><span>Always on. Every opening we find goes to <strong className="font-bold text-ch-ink">{EMAIL}</strong>.</span></p>
            </section>

            <section aria-labelledby="w-text" className="mt-4 rounded-ch-input border border-ch-line p-4 sm:p-5">
              <h2 id="w-text" className="text-[17px] font-extrabold text-ch-ink">Text alerts</h2>
              <p className="mb-4 mt-1 text-[14px] leading-relaxed text-ch-ink-2">A text is what actually wakes you at 6 AM.</p>
              <SmsAlerts visitor={visitor} secondary />
            </section>

            {subscribed && plan === "autocart" && (
              <section aria-labelledby="w-cart" className="mt-4 rounded-ch-input border border-l-4 border-ch-line border-l-ch-blue bg-ch-card p-4 sm:p-5">
                <h2 id="w-cart" className="text-[17px] font-extrabold text-ch-ink">Set up auto-cart</h2>
                <p className="mt-1 text-[15px] leading-relaxed text-ch-ink-2">One sign-in to Recreation.gov and we can put an opening straight into your cart, held while you get to your phone. It signs in on a private machine we run and saves that login there — encrypted, never on our web servers.</p>
                <Link href={withVisitor(ROUTES.connect, visitor)} className={buttonClasses({ variant: "cart", className: "mt-4 min-h-12 px-5 text-[15px]" })}>Sign in to Recreation.gov</Link>
              </section>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-ch-line pt-6">
              <button type="button" disabled={saving !== null} onClick={() => go("finish")} className={buttonClasses({ variant: "ink", className: cx("min-h-12 px-8 text-[16px]", saving && "cursor-wait") })}>
                {saving === "finish" && <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}Finish
              </button>
              <button type="button" disabled={saving !== null} onClick={() => go("skip")} className="min-h-11 cursor-pointer px-1 text-[15px] font-bold text-ch-ink-2 underline underline-offset-[3px] hover:text-ch-ink">
                Skip for now
              </button>
            </div>
          </div>
          {from === "checkout" && visitor !== "subscriber" && <LabNote>The after-checkout version is for a subscriber: switch View as to Subscriber.</LabNote>}
          </div>
          {/* Wide screens only: on a phone it would sit under Finish, after the job is done. */}
          <aside aria-labelledby="w-next" className="hidden rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card lg:sticky lg:top-6 lg:block">
            <h2 id="w-next" className="font-ch-display text-[19px] font-extrabold text-ch-ink">What happens next</h2>
            <ol className="mt-3 grid gap-3 text-[15px] leading-relaxed text-ch-ink-2">
              {[
                `Start a watch on a booked campground. We check it every ${CHECK_SECONDS} seconds, around the clock.`,
                "The moment a site frees up, we tell you by every channel you've turned on, at once.",
                subscribed && plan === "autocart" ? "On Recreation.gov, auto-cart puts it straight in your cart. You check out." : "You book it on the booking site, while it's still open.",
              ].map((line, i) => (
                <li key={i} className="flex gap-3"><span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-ch-shell text-[13px] font-extrabold text-ch-ink">{i + 1}</span><span>{line}</span></li>
              ))}
            </ol>
          </aside>
          </div>
        );
      }}
    </LabPage>
  );
}
