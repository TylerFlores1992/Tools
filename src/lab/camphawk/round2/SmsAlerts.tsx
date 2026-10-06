"use client";

import { useState } from "react";
import { Check, Loader2, MessageSquare } from "lucide-react";
import { buttonClasses } from "../ui";
import { ROUTES } from "./gates";
import { A } from "./LabPage";
import type { Visitor } from "../data";

// CampHawk's text-alert opt-in (campsite-finder src/components/v2/SmsAlerts.tsx), one component
// for Settings and the public /sms-opt-in page, as in CampHawk. THE WORDS ARE CARRIER-APPROVED
// (A2P 10DLC): optional, not a condition of purchase, frequency, rates, HELP/STOP, Terms and
// Privacy. Only the styling is the lab's. The consent box starts unchecked; nothing is required.
// Lab change: the "optional" notice is a neutral card (CampHawk tints it green, which its own
// rules keep for an open site or an action).

export type SmsState = "new" | "saved" | "loading" | "error";

export function SmsAlerts({ demo = false, start = "new", visitor }: { demo?: boolean; start?: SmsState; visitor?: Visitor }) {
  const [saved, setSaved] = useState<string | null>(start === "saved" ? "(209) 555-0142" : null);
  const [phone, setPhone] = useState(start === "saved" ? "(209) 555-0142" : "");
  const [agreed, setAgreed] = useState(start === "saved");
  const [busy, setBusy] = useState<"save" | "off" | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(start === "error" ? "Couldn't save that number" : null);

  if (start === "loading") {
    return (
      <div role="status" className="h-24 animate-pulse rounded-ch-input bg-ch-shell motion-reduce:animate-none">
        <span className="sr-only">Loading your text alert settings…</span>
      </div>
    );
  }

  const changed = phone.trim() !== (saved ?? "");
  const ready = phone.trim().length >= 10 && agreed && changed && !busy;
  const save = () => {
    if (demo || !ready) return;
    setBusy("save");
    setError(null);
    window.setTimeout(() => { setBusy(null); setSaved(phone.trim()); setDone(true); window.setTimeout(() => setDone(false), 2000); }, 600);
  };
  const turnOff = () => {
    setBusy("off");
    setError(null);
    // Off only once the server says so (a 500 used to show "off" while texts kept going).
    window.setTimeout(() => { setBusy(null); setSaved(null); setPhone(""); setAgreed(false); }, 600);
  };

  return (
    <div className="grid gap-4">
      {saved && !changed && (
        <div className="flex flex-wrap items-center gap-3 rounded-ch-input border border-ch-line bg-ch-paper px-4 py-3">
          <MessageSquare aria-hidden="true" className="size-5 shrink-0 text-ch-ink-2" />
          <p className="flex-1 text-[15px] font-bold text-ch-ink">Text alerts on · {saved}</p>
          <button type="button" onClick={turnOff} disabled={busy === "off"} className={buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 px-4" })}>
            {busy === "off" ? "Turning off…" : "Turn off"}
          </button>
        </div>
      )}
      <p className="rounded-ch-input border border-ch-line bg-ch-paper px-4 py-3 text-[14px] leading-relaxed text-ch-ink-2">
        <strong className="font-bold text-ch-ink">Text alerts are optional.</strong> CampHawk works fully with email alerts alone — you never need to give a phone number to create an account, subscribe, or use any feature. Adding your number and checking the box below is entirely voluntary, and you can skip it.
      </p>
      <div>
        <label htmlFor="sms-phone" className="mb-2 block text-[13px] font-extrabold text-ch-ink-2">{saved ? "Change your number" : "Mobile number"}</label>
        <input
          id="sms-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
          className="min-h-12 w-full rounded-ch-input border border-ch-line bg-ch-card px-4 text-[16px] text-ch-ink placeholder:text-ch-muted focus-visible:border-ch-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green"
        />
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-relaxed text-ch-ink-2">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 size-[18px] shrink-0 accent-ch-green" />
        <span>Yes, I&apos;d like to receive automated text messages from CampHawk when campgrounds I&apos;m watching have availability. Consent is not a condition of purchase.</span>
      </label>
      <p className="text-[13px] leading-relaxed text-ch-ink-2">
        <strong className="font-bold">Message frequency</strong> varies with campsite availability (typically at most one per watch). <strong className="font-bold">Message and data rates may apply.</strong> Reply <strong className="font-bold">HELP</strong> for help or <strong className="font-bold">STOP</strong> to cancel any time.{" "}
        <A href={ROUTES.terms} visitor={visitor}>Terms of Service</A> · <A href={ROUTES.privacy} visitor={visitor}>Privacy Policy</A>
      </p>
      <div>
        <button type="button" onClick={save} disabled={!ready} aria-describedby="sms-why" className={buttonClasses({ fullWidth: true, className: "min-h-12 text-[16px] disabled:cursor-not-allowed disabled:bg-ch-shell disabled:text-ch-ink-2 disabled:shadow-none" })}>
          {busy === "save" ? <><Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />Saving…</> : done ? <><Check aria-hidden="true" className="size-4" />Saved</> : saved ? "Update number" : "Turn on text alerts"}
        </button>
        {/* The disabled button says why, in words (CampHawk leaves it to the disabled style). */}
        {!ready && !busy && !done && (
          <p id="sms-why" className="mt-2 text-[13px] text-ch-ink-2">
            {demo ? "This is a preview of the form; nothing here is sent or saved." : saved && !changed ? "Edit the number to update it." : "Enter your number and tick the box to turn texts on."}
          </p>
        )}
      </div>
      {error && <p role="alert" className="text-[14px] text-ch-alert-deep">{error}</p>}
    </div>
  );
}
