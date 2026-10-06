"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import type { Visitor } from "../../data";
import { BareCard, BareFrame } from "../BareFrame";
import { LabNote } from "../LabPage";
import { ROUTES } from "../gates";
import { useUrlParam, withVisitor } from "../labState";
import { TRIAL_DAYS } from "./tier2-data";

// Tier 2: Sign in and Sign up (campsite-finder src/app/sign-in, sign-up, AuthPanel.tsx). CampHawk
// hosts Clerk's widget in a bare frame, themed to CampHawk (green #1E7A4C, ink #16291F, 12px
// radius, Nunito Sans). The lab draws a stand-in for the widget with Clerk's own English, so the
// frame can be judged; the real one is Clerk's. What it keeps on purpose:
// - No site header or footer: one job on the page.
// - In the app, no "Continue with Google" or divider: OAuth can't finish in a webview, and
//   offering Google would require Sign in with Apple.
// - A new account always goes through Welcome (phone and alert choices Clerk can't collect),
//   carrying where you were headed.
// Lab changes: each page has its own title and is noindex (CampHawk's inherit the home page's);
// one line of context above the widget when you came to start a trial or a watch (CampHawk's
// has none); the plan you picked is carried through, so Welcome can bring you back to it; the
// widget's main button is the ink button, not action green (signing in doesn't get you a site); the
// heading and line are CampHawk's voice, set through Clerk's `localization` prop (Clerk's defaults
// read "Welcome! Please fill in the details to get started.").

const field = "min-h-12 w-full rounded-ch-input border border-ch-line bg-ch-paper px-4 text-[16px] text-ch-ink focus-visible:border-ch-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green";
const main = buttonClasses({ variant: "ink", fullWidth: true, className: "min-h-12 text-[16px] disabled:cursor-wait" });

function Widget({ mode, visitor, next }: { mode: "in" | "up"; visitor: Visitor; next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: "email" | "password"; text: string } | null>(null);
  const app = visitor === "app";
  const up = mode === "up";
  const submit = () => {
    // Each error names its field, is tied to it, and takes focus there.
    if (!email.includes("@")) { setError({ field: "email", text: "Enter an email address, like name@example.com." }); document.getElementById("auth-email")?.focus(); return; }
    if (up && password.length < 8) { setError({ field: "password", text: "Your password needs at least 8 characters." }); document.getElementById("auth-pass")?.focus(); return; }
    setError(null);
    setBusy(true);
    // After sign-up: Welcome, carrying the destination. After sign-in: back where you were.
    const to = up ? `${ROUTES.welcome}${next ? `?next=${encodeURIComponent(next)}` : ""}` : next ?? ROUTES.explore;
    window.setTimeout(() => router.push(withVisitor(to, app ? "app" : "member")), 700);
  };
  return (
    <BareCard>
      <h1 className="text-center text-[20px] font-extrabold text-ch-ink">{up ? "Create your CampHawk account" : "Sign in to CampHawk"}</h1>
      <p className="mt-1 text-center text-[15px] text-ch-ink-2">{up ? "Free to make. Searching never needs one." : "Welcome back."}</p>
      {!app && (
        <>
          <a href="#" className="mt-6 flex min-h-12 items-center justify-center gap-2.5 rounded-ch-input border border-ch-line bg-ch-card text-[15px] font-bold text-ch-ink hover:bg-ch-paper">
            <span aria-hidden="true" className="grid size-5 place-items-center rounded-full border border-ch-line text-[12px] font-extrabold">G</span>Continue with Google
          </a>
          <div className="my-5 flex items-center gap-3 text-[14px] text-ch-ink-2"><span className="h-px flex-1 bg-ch-line" />or<span className="h-px flex-1 bg-ch-line" /></div>
        </>
      )}
      <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className={cx("grid gap-4", app && "mt-6")}>
        <label className="grid gap-1.5"><span className="text-[14px] font-bold text-ch-ink">Email address</span><input id="auth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={error?.field === "email" || undefined} aria-describedby={error?.field === "email" ? "auth-error" : undefined} className={field} /></label>
        {(up || app) && (
          <label className="grid gap-1.5"><span className="text-[14px] font-bold text-ch-ink">Password</span><input id="auth-pass" type="password" autoComplete={up ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={error?.field === "password" || undefined} aria-describedby={error?.field === "password" ? "auth-error" : undefined} className={field} /></label>
        )}
        {error && <p id="auth-error" role="alert" className="text-[14px] font-bold text-ch-alert-deep">{error.text}</p>}
        <button type="submit" disabled={busy} className={main}>{busy && <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}Continue</button>
      </form>
      <p className="mt-6 border-t border-ch-line pt-5 text-center text-[15px] text-ch-ink-2">
        {up ? "Already have an account? " : "Don’t have an account? "}
        <Link href={withVisitor(`${up ? ROUTES.signIn : ROUTES.signUp}${next ? `?redirect_url=${encodeURIComponent(next)}` : ""}`, visitor)} className="font-bold text-ch-forest underline underline-offset-[3px]">{up ? "Sign in" : "Sign up"}</Link>
      </p>
      <p className="mt-4 text-center text-[12px] text-ch-ink-2">Secured by Clerk</p>
    </BareCard>
  );
}

function Context({ plan, next, mode }: { plan: string | null; next: string | null; mode: "in" | "up" }) {
  const line = plan === "autocart" || plan === "base"
    ? `Your ${TRIAL_DAYS}-day free trial of ${plan === "autocart" ? "Auto-Cart" : "Alerts"} starts after this. Nothing is charged today.`
    : next?.includes("/new")
      ? mode === "up" ? "Create a free account, and we'll take you straight back to your watch." : "Sign in, and we'll take you straight back to your watch."
      : null;
  if (!line) return null;
  return <p className="mx-auto mt-4 max-w-[34ch] text-center text-[16px] font-bold leading-relaxed text-ch-paper">{line}</p>;
}

function AuthPage({ mode }: { mode: "in" | "up" }) {
  const plan = useUrlParam("plan");
  const back = useUrlParam("redirect_url");
  // A plan picked on Pricing comes back to Pricing after Welcome.
  const next = back ?? (plan ? `${ROUTES.pricing}?plan=${plan}` : null);
  return (
    <BareFrame page={mode === "up" ? "Sign up" : "Sign in"} centered lead={<Context plan={plan} next={next} mode={mode} />}>
      {({ visitor }) => (
        <>
          <Widget key={visitor} mode={mode} visitor={visitor} next={next} />
          <LabNote className="mt-4">A stand-in for Clerk&apos;s sign-{mode} widget, themed and worded through Clerk&apos;s appearance and localization settings. Continue moves on as if it worked.</LabNote>
        </>
      )}
    </BareFrame>
  );
}

export const SignIn = () => <AuthPage mode="in" />;
export const SignUp = () => <AuthPage mode="up" />;
