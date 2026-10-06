"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import { ART } from "../Art";
import { LabSelect } from "../AppParts";
import { GH, ROUTES } from "../gates";
import { LabPage } from "../LabPage";
import { useUrlParam, useUrlState, withVisitor } from "../labState";
import { SmsAlerts } from "../SmsAlerts";
import { EMAIL } from "./alert-data";

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
  const [email, setEmail] = useState(true);
  const [saving, setSaving] = useState<"finish" | "skip" | null>(null);
  // ?next= is where sign-up was headed; only a lab path is followed (never off-site).
  const nextParam = useUrlParam("next");
  const nextPath = nextParam && nextParam.startsWith(`${GH}/`) && !nextParam.startsWith("//") ? nextParam : ROUTES.explore;
  return (
    <LabPage
      page="Welcome"
      title="Welcome"
      showPlan
      photo={{ art: ART.a1, pos: "62% 70%", posLg: "50% 72%" }}
      controls={({ visitor }) => visitor !== "signed-out" && (
        <LabSelect label="Arrived from" short="From" value={from} onChange={setFrom} options={[["sign-up", "Sign-up"], ["checkout", "Checkout"]]} />
      )}
    >
      {({ visitor, plan }) => {
        if (visitor === "signed-out") {
          return (
            <div className="mx-auto max-w-[720px] rounded-ch-card border border-ch-line bg-ch-card p-6 text-center shadow-ch-pop sm:p-10">
              <h2 className="font-ch-display text-[clamp(24px,3vw,32px)] font-extrabold leading-tight text-ch-ink">Sign in to finish setting up</h2>
              <p className="mx-auto mt-2 max-w-[48ch] text-[16px] leading-relaxed text-ch-ink-2">Once you&apos;re signed in, you&apos;ll choose how we reach you when a campsite opens up. New here? Creating an account takes a minute.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link href={withVisitor(ROUTES.signUp, visitor)} className={buttonClasses({ className: "min-h-12 px-6" })}>Create an account</Link>
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
          <div className="mx-auto max-w-[720px] rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-pop sm:p-9">
            <h2 className="font-ch-display text-[clamp(24px,3vw,32px)] font-extrabold leading-tight tracking-[-.01em] text-ch-ink">
              {subscribed ? "You're subscribed — one last thing" : "You're in. How should we reach you?"}
            </h2>
            <p className="mt-2 max-w-[56ch] text-[16px] leading-relaxed text-ch-ink-2">Set this up now and an opening reaches you the moment we find it. You can change any of it later in Settings.</p>
            {from === "checkout" && visitor !== "subscriber" && (
              <p className="mt-3 rounded-ch-input bg-ch-shell px-3 py-2 text-[13px] text-ch-ink-2">Lab note: the checkout version is for a subscriber — switch View as to Subscriber.</p>
            )}

            <section aria-labelledby="w-email" className="mt-7 rounded-ch-input border border-ch-line p-4 sm:p-5">
              <h3 id="w-email" className="text-[17px] font-extrabold text-ch-ink">Email alerts</h3>
              <label className="mt-3 flex cursor-pointer items-start gap-3 text-[15px] text-ch-ink">
                <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="mt-0.5 size-[18px] shrink-0 accent-ch-green" />
                <span>Email me when a campsite I&apos;m watching opens up<span className="block text-[13px] text-ch-ink-2">to {EMAIL}</span></span>
              </label>
              {!email && <p role="status" className="mt-3 rounded-ch-input border border-ch-ochre-line bg-ch-ochre-soft px-3 py-2 text-[14px] text-ch-ink">With email off, add a phone number below or you won&apos;t hear about openings at all.</p>}
            </section>

            <section aria-labelledby="w-text" className="mt-4 rounded-ch-input border border-ch-line p-4 sm:p-5">
              <h3 id="w-text" className="text-[17px] font-extrabold text-ch-ink">Text alerts (optional)</h3>
              <p className="mb-4 mt-1 text-[14px] leading-relaxed text-ch-ink-2">A text is what actually wakes you at 6am.</p>
              <SmsAlerts visitor={visitor} />
            </section>

            {subscribed && plan === "autocart" && (
              <section aria-labelledby="w-cart" className="mt-4 rounded-ch-input border-2 border-ch-blue bg-ch-blue-soft p-4 sm:p-5">
                <h3 id="w-cart" className="text-[17px] font-extrabold text-ch-ink">Set up auto-cart</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ch-ink-2">One sign-in to Recreation.gov and we can put an opening straight into your cart, held while you get to your phone. It signs in on a private machine we run and saves that login there — encrypted, never on our web servers.</p>
                <Link href={withVisitor(ROUTES.connect, visitor)} className={buttonClasses({ variant: "cart", size: "sm", className: "mt-3 min-h-11 px-4" })}>Sign in to Recreation.gov</Link>
              </section>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-ch-line pt-6">
              <button type="button" disabled={saving !== null} onClick={() => go("finish")} className={buttonClasses({ className: cx("min-h-12 px-8 text-[16px]", saving && "cursor-wait") })}>
                {saving === "finish" && <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}Finish
              </button>
              <button type="button" disabled={saving !== null} onClick={() => go("skip")} className="min-h-11 cursor-pointer px-1 text-[15px] font-bold text-ch-ink-2 underline underline-offset-[3px] hover:text-ch-ink">
                Skip for now
              </button>
            </div>
          </div>
        );
      }}
    </LabPage>
  );
}
