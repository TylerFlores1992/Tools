"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../ui";
import type { Visitor } from "../data";
import { LabBar } from "../LabBar";
import type { Piece } from "./Art";
import { AppBand, BandPhoto, LabSelect, PLANS, type Plan } from "./AppParts";
import { GhFooter, ScreenLinks, type Tab } from "./GhChrome";
import { useUrlState, useVisitor, withVisitor } from "./labState";

// The frame every Golden hour page past the first five shares: the lab bar (View as, the
// screen's own switches), the forest band with the header and the title, the page on paper, and
// the forest footer. Pages pass their content as a function of who's looking, so one gate rule
// can't drift between pages. Plus the reading kit for CampHawk's content pages: section headings,
// prose, lists, questions and answers, callouts and a closing band.

export type LabCtx = { visitor: Visitor; plan: Plan; setVisitor: (v: Visitor) => void };

export function LabPage({
  page, tab, title, sub, photo, controls, children, showPlan = false, dock = true, wide = false,
}: {
  /** The lab bar's breadcrumb label. */
  page: string;
  tab?: Tab;
  title: string;
  sub?: ReactNode;
  photo?: { art: Piece; pos: string; posLg: string };
  /** The screen's own lab switches, rendered in the lab bar. */
  controls?: (ctx: LabCtx) => ReactNode;
  children: (ctx: LabCtx) => ReactNode;
  /** Subscribers get a Plan switch (Auto-Cart or Alerts) when the page branches on it. */
  showPlan?: boolean;
  /** The first card rises into the band (app screens); reading pages start on paper. */
  dock?: boolean;
  wide?: boolean;
}) {
  const [visitor, setVisitor] = useVisitor();
  const [plan, setPlan] = useUrlState<Plan>("plan", "autocart", PLANS);
  const ctx: LabCtx = { visitor, plan, setVisitor };
  return (
    <div className="gh">
      <LabBar page={page} visitor={visitor} onVisitor={setVisitor}>
        <ScreenLinks visitor={visitor} current="other" />
        {showPlan && visitor === "subscriber" && <LabSelect label="Plan" short="Plan" value={plan} onChange={setPlan} options={[["autocart", "Auto-Cart"], ["alerts", "Alerts"]]} />}
        {controls?.(ctx)}
      </LabBar>
      <main id="main">
        <AppBand visitor={visitor} current={tab} title={title} sub={sub} photo={photo ? <BandPhoto {...photo} /> : undefined} dock={dock} />
        <div className={cx("relative mx-auto px-3 pb-[clamp(48px,7vw,96px)] sm:px-8", dock ? "-mt-[var(--gh-dock)]" : "pt-[clamp(32px,5vw,64px)]", wide ? "max-w-[var(--gh-max)]" : "max-w-[1120px]")}>
          {children(ctx)}
        </div>
      </main>
      <GhFooter visitor={visitor} />
    </div>
  );
}

/* ---------- reading kit ---------- */

/** A content page's text column: a paper card when docked, plain paper otherwise. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("max-w-[72ch] text-[17px] leading-relaxed text-ch-ink-2", className)}>{children}</div>;
}

export function H2({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return <h2 id={id} className={cx("mt-12 scroll-mt-6 font-ch-display text-[clamp(24px,2.6vw,32px)] font-extrabold leading-tight tracking-[-.02em] text-ch-forest first:mt-0", className)}>{children}</h2>;
}

export function H3({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cx("mt-7 font-ch-display text-[20px] font-extrabold leading-snug text-ch-ink", className)}>{children}</h3>;
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("mt-4 first:mt-0", className)}>{children}</p>;
}

export function Ul({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={cx("mt-4 grid gap-2.5", className)}>
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-ch-ink-2" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** Numbered steps, the shape CampHawk's explainers use. */
export function Steps({ steps, className }: { steps: ReadonlyArray<readonly [ReactNode, ReactNode]>; className?: string }) {
  return (
    <ol className={cx("mt-5 grid gap-4", className)}>
      {steps.map(([t, body], i) => (
        <li key={i} className="flex gap-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ch-shell font-ch-display text-[15px] font-extrabold text-ch-ink">{i + 1}</span>
          <span>
            <span className="block text-[17px] font-bold text-ch-ink">{t}</span>
            <span className="mt-1 block">{body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A lab or in-text link that keeps who we're pretending to be. */
export function A({ href, visitor, children, className }: { href: string; visitor?: Visitor; children: ReactNode; className?: string }) {
  const out = href === "#" || href.startsWith("http") || href.startsWith("mailto:");
  // Links are forest ink and underlined, not action green: following a link isn't getting a site.
  const cls = cx("font-bold text-ch-forest underline decoration-1 underline-offset-[3px] hover:decoration-2", className);
  if (out) return <a href={href} className={cls}>{children}</a>;
  return <Link href={visitor ? withVisitor(href, visitor) : href} className={cls}>{children}</Link>;
}

/** Questions and answers: one disclosure per question, the answer readable without JS order games. */
export function Faq({ items, className }: { items: ReadonlyArray<readonly [string, ReactNode]>; className?: string }) {
  return (
    <div className={cx("mt-6 divide-y divide-ch-line rounded-ch-card border border-ch-line bg-ch-card shadow-ch-card", className)}>
      {items.map(([q, a]) => <FaqItem key={q} q={q} a={a} />)}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <h3>
        <button type="button" aria-expanded={open} aria-controls={`${id}-a`} onClick={() => setOpen(!open)} className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left text-[17px] font-bold text-ch-ink hover:bg-ch-paper focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ch-green">
          <span className="flex-1">{q}</span>
          <ChevronDown aria-hidden="true" className={cx("size-5 shrink-0 text-ch-ink-2 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </button>
      </h3>
      <div id={`${id}-a`} hidden={!open} className="px-5 pb-5 text-[16px] leading-relaxed text-ch-ink-2">{a}</div>
    </div>
  );
}

/** A quiet card inside reading text: a note, a limit, a fact box. Tones follow CampHawk's
    colour rules: neutral by default, ochre for "you asked for this", blue for the provider. */
export function Callout({ title, children, tone = "neutral", className }: { title?: ReactNode; children: ReactNode; tone?: "neutral" | "yours" | "provider"; className?: string }) {
  const box = tone === "yours" ? "border-ch-ochre-line bg-ch-ochre-soft" : tone === "provider" ? "border-ch-blue-line bg-ch-blue-soft" : "border-ch-line bg-ch-card shadow-ch-card";
  return (
    <div className={cx("mt-6 rounded-ch-card border px-5 py-4", box, className)}>
      {title && <p className="text-[17px] font-bold text-ch-ink">{title}</p>}
      <div className={cx("text-[16px] leading-relaxed text-ch-ink-2", Boolean(title) && "mt-1")}>{children}</div>
    </div>
  );
}

/** The forest band a content page closes on: one sentence and one action. */
export function CtaBand({ title, body, action }: { title: string; body?: ReactNode; action: ReactNode }) {
  return (
    <section className="mt-16 rounded-ch-card bg-ch-forest px-6 py-10 text-center sm:px-10 sm:py-14">
      <h2 className="mx-auto max-w-[22ch] text-balance font-ch-display text-[clamp(26px,3.2vw,40px)] font-extrabold leading-tight tracking-[-.02em] text-ch-paper">{title}</h2>
      {body && <p className="mx-auto mt-3 max-w-[56ch] text-[17px] leading-relaxed text-ch-line">{body}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>
    </section>
  );
}

/** A note for reviewers, never part of the product: dashed, labeled "Lab", always outside the
    product's own cards so nobody mistakes it for CampHawk copy. */
export function LabNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="note" className={cx("flex items-start gap-2.5 rounded-ch-input border border-dashed border-ch-muted px-3 py-2 text-[13px] leading-relaxed text-ch-ink-2", className)}>
      <span className="mt-px shrink-0 text-[11px] font-extrabold uppercase tracking-[.1em] text-ch-ink">Lab</span>
      <span>{children}</span>
    </p>
  );
}

/** A card on paper: the docked first block of an app page, or a section box. */
export function Panel({ children, className, as: As = "div", label }: { children: ReactNode; className?: string; as?: "div" | "section"; label?: string }) {
  return <As aria-label={label} className={cx("rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-pop sm:p-8", className)}>{children}</As>;
}

/** The one primary link a page ends on (a lab link where it can be, "#" where it would leave). */
export function ActionLink({ href, visitor, children, variant = "primary", className }: { href: string; visitor?: Visitor; children: ReactNode; variant?: "primary" | "quiet" | "cart"; className?: string }) {
  const cls = buttonClasses({ variant, size: "lg", className: cx("px-6", className) });
  if (href === "#") return <a href="#" className={cls}>{children}</a>;
  return <Link href={visitor ? withVisitor(href, visitor) : href} className={cls}>{children}</Link>;
}
