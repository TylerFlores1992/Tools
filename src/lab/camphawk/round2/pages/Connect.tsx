"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import { LabSelect } from "../AppParts";
import { BareCard, BareFrame } from "../BareFrame";
import { ROUTES } from "../gates";
import { useUrlState, withVisitor } from "../labState";

// Tier 1: Connect Recreation.gov (campsite-finder src/app/connect/page.tsx). A one-time sign-in to
// Recreation.gov on CampHawk's private machine, so auto-cart can cart openings. Outside the app
// chrome on purpose: a credential screen shouldn't invite you away. What it keeps on purpose:
// - The form is the main path; the live window only appears when Recreation.gov wants a CAPTCHA,
//   a code, or a second try.
// - "a private machine we run", the same words as everywhere else; the password reveal.
// - A timeout blames the helper, never the password.
// Lab changes, from CampHawk's own rules and copy:
// - The heading says "Recreation.gov" (CampHawk's says "recreation.gov" here only).
// - Start, Sign in and Done are the blue provider hand-off; the shield is ink, not green.
// - The "this can take a minute" notes show under the form, where you're waiting (CampHawk only
//   draws them inside the live window, so in form mode they never appear).
// - Done says the sign-in worked, not "Auto-cart is now active" (nothing has been carted yet,
//   and a free account can reach this page), and goes to Settings, not the marketing page.
// - Errors are sentences: no "mint failed (500)", no "Is your CampHawk server online?".
// The lab runs the wait faster than life: the "still working" note at 2 s, not 20.

type Status = "idle" | "connecting" | "form" | "stream" | "done" | "error" | "timeout";
const STATUSES: readonly Status[] = ["idle", "connecting", "form", "stream", "done", "error", "timeout"];

const ERRORS: Partial<Record<Status, string>> = {
  error: "We couldn't reach the sign-in service just now. Nothing was saved — try again in a minute.",
  timeout: "The sign-in helper didn't respond. That usually means it needs updating or briefly dropped offline — not that your details are wrong. Try again in a minute, and email alerts@camphawk.app if it keeps happening.",
};

const field = "min-h-12 w-full rounded-ch-input border border-ch-line bg-ch-paper px-4 text-[16px] text-ch-ink focus-visible:border-ch-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green";
const blue = (className?: string) => buttonClasses({ variant: "cart", fullWidth: true, className: cx("min-h-12 text-[16px] disabled:cursor-not-allowed disabled:bg-ch-shell disabled:text-ch-ink-2 disabled:shadow-none", className) });

function SignInForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const a = window.setTimeout(() => setSlow(true), 2000);
    const b = window.setTimeout(onDone, 4500);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, [busy, onDone]);
  const [tried, setTried] = useState(false);
  const ready = email.trim() && password && !busy;
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); if (busy) return; if (!ready) { setTried(true); document.getElementById(email.trim() ? "rg-pass" : "rg-email")?.focus(); return; } setBusy(true); }} className="grid gap-4">
      <label className="grid gap-1.5"><span className="text-[13px] font-extrabold text-ch-ink-2">Recreation.gov email</span><input id="rg-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} className={field} /></label>
      <div className="grid gap-1.5">
        <label htmlFor="rg-pass" className="text-[13px] font-extrabold text-ch-ink-2">Recreation.gov password</label>
        <span className="relative">
          <input id="rg-pass" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} className={cx(field, "pr-20")} />
          <button type="button" onClick={() => setShow(!show)} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 min-w-16 px-3 text-[14px] font-bold text-ch-ink underline underline-offset-2">{show ? "Hide" : "Show"}</button>
        </span>
      </div>
      {/* CampHawk shows a pre-ticked "(required)" checkbox here; one you can't usefully untick is a
          statement, so the lab states it. */}
      <p className="flex items-start gap-3 rounded-ch-input border border-ch-line bg-ch-paper px-4 py-3 text-[14px] leading-relaxed text-ch-ink-2">
        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ch-ink" />
        <span>We save your login, encrypted, on a private machine we run, so auto-cart can sign back in on its own when the session drops. <strong className="font-bold text-ch-ink">It never reaches CampHawk&apos;s web servers or database.</strong></span>
      </p>
      <button type="submit" disabled={busy} aria-describedby="rg-why" className={blue()}>
        {busy ? <><Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />Signing you in…</> : "Sign in"}
      </button>
      {busy ? (
        <p role="status" className="text-center text-[14px] text-ch-ink-2">{slow ? "Still working — signing in to Recreation.gov can take up to a minute." : "Signing you in on the helper — this can take up to a minute."}</p>
      ) : (
        <p id="rg-why" role={tried && !ready ? "alert" : undefined} className={cx("text-center", tried && !ready ? "text-[14px] font-bold text-ch-ink" : "text-[13px] text-ch-ink-2")}>{!email.trim() || !password ? "Enter your email and password to continue." : "Recreation.gov may ask you to prove you’re a person; if it does, a window opens here."}</p>
      )}
    </form>
  );
}

/** The streamed Recreation.gov window, drawn as a stand-in: the lab has no broker. */
function StreamWindow() {
  return (
    <div>
      <p className="flex items-start gap-2 rounded-ch-input border border-ch-ochre-line bg-ch-ochre-soft px-4 py-3 text-[15px] font-bold text-ch-ink">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />Recreation.gov wants to check you&apos;re a person. Please finish signing in in the window below.
      </p>
      <p className="mt-2 text-[14px] text-ch-ink-2">Tap the window and type as usual — the keyboard opens when you tap a field. Sign in and it finishes on its own.</p>
      <div role="img" aria-label="Recreation.gov sign-in window (lab stand-in)" className="mt-4 overflow-hidden rounded-ch-input border border-ch-line bg-ch-white">
        <div className="flex items-center gap-1.5 border-b border-ch-line bg-ch-shell px-3 py-2">
          <span className="size-2.5 rounded-full bg-ch-line" /><span className="size-2.5 rounded-full bg-ch-line" /><span className="size-2.5 rounded-full bg-ch-line" />
          <span className="ml-2 truncate text-[12px] text-ch-ink-2">recreation.gov/log-in</span>
        </div>
        <div className="grid aspect-[4/3] content-center gap-3 px-8">
          <div className="h-3 w-1/2 rounded-ch-tag bg-ch-shell" />
          <div className="h-10 rounded-ch-tag border border-ch-line" />
          <div className="h-10 rounded-ch-tag border border-ch-line" />
          <div className="flex items-center gap-2"><span className="size-5 rounded-ch-tag border border-ch-line" /><span className="h-3 w-1/3 rounded-ch-tag bg-ch-shell" /></div>
          <div className="h-10 rounded-ch-tag bg-ch-shell" />
        </div>
      </div>
    </div>
  );
}

export function Connect() {
  const [status, setStatus] = useUrlState<Status>("status", "form", STATUSES);
  useEffect(() => {
    if (status !== "connecting") return;
    const t = window.setTimeout(() => setStatus("form"), 1400);
    return () => window.clearTimeout(t);
  }, [status, setStatus]);
  return (
    <BareFrame page="Connect Recreation.gov" homeLabel="CampHawk — back to the site" controls={() => (
      <LabSelect label="Sign-in step" short="Step" value={status} onChange={setStatus} options={[["idle", "Start"], ["connecting", "Opening"], ["form", "Form"], ["stream", "Live window (CAPTCHA)"], ["done", "Connected"], ["error", "Couldn't reach service"], ["timeout", "Helper didn't respond"]]} />
    )}>
      {({ visitor }) => (
        <BareCard>
          <ShieldCheck aria-hidden="true" className="size-9 text-ch-ink" />
          <h1 className="mt-2 font-ch-display text-[28px] font-extrabold leading-tight tracking-[-.01em] text-ch-ink">Connect Recreation.gov</h1>
          {status !== "done" && (
            <p className="mt-2 text-[15px] leading-relaxed text-ch-ink-2">
              Sign in once so auto-cart can add openings to your Recreation.gov cart. Your email and password go over an encrypted connection to a private machine we run — the one that keeps your session open.
            </p>
          )}
          <div className="mt-6">
            {status === "idle" && (
              <div className="grid gap-4">
                <p className="text-[15px] leading-relaxed text-ch-ink-2">Click below to start a secure sign-in. You&apos;ll enter your Recreation.gov email and password, and this page closes itself automatically once you&apos;re in.</p>
                <button type="button" onClick={() => setStatus("connecting")} className={blue()}>Start secure sign-in</button>
              </div>
            )}
            {status === "connecting" && (
              <p role="status" className="flex items-center gap-3 rounded-ch-input border border-ch-line bg-ch-paper px-4 py-4 text-[15px] text-ch-ink-2">
                <Loader2 aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />Opening a secure Recreation.gov window…
              </p>
            )}
            {status === "form" && <SignInForm onDone={() => setStatus("done")} />}
            {status === "stream" && <StreamWindow />}
            {status === "done" && (
              <div role="status" className="grid gap-4">
                <div className="flex gap-3 rounded-ch-input border border-ch-line bg-ch-paper p-4">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-ch-ink" />
                  <div>
                    <h2 className="text-[18px] font-extrabold text-ch-ink">You&apos;re connected</h2>
                    <p className="mt-1 text-[15px] leading-relaxed text-ch-ink-2">Recreation.gov sign-in complete. When a site you&apos;re watching opens, auto-cart adds it to your Recreation.gov cart — just finish checkout on your phone. You can turn it off any time in Settings.</p>
                  </div>
                </div>
                <Link href={withVisitor(ROUTES.settings, visitor)} className={blue()}>Done</Link>
              </div>
            )}
            {(status === "error" || status === "timeout") && (
              <div role="alert" className="grid gap-4">
                <p className="flex gap-3 rounded-ch-input border border-ch-ochre-line bg-ch-ochre-soft p-4 text-[15px] leading-relaxed text-ch-ink">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />{ERRORS[status]}
                </p>
                <button type="button" onClick={() => setStatus("connecting")} className={buttonClasses({ variant: "quiet", fullWidth: true, className: "min-h-12 text-[16px]" })}>Try again</button>
              </div>
            )}
          </div>
        </BareCard>
      )}
    </BareFrame>
  );
}
