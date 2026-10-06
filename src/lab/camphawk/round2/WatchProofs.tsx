import { Check } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../ui";
import { FEATURES } from "../copy";
import { Tag } from "../ui/Tag";
import { Art, ART } from "./Art";

// "What a watch does" for Golden hour: each of CampHawk's four promises shown as a small piece
// of its own UI, so the section proves rather than lists. Every example is fake and labeled as
// one. CampHawk's colour rules hold: green only for an open site or an action that gets one,
// blue for the Recreation.gov hand-off, fully booked neutral, and every status has a word.

const [ALERTS, AUTOCART, SEARCH, FLEXIBLE] = FEATURES;

function Tile({ title, body, className, children }: { title: string; body: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cx("flex flex-col rounded-[22px] border border-ch-line bg-ch-card p-6 sm:p-8", className)}>
      <h3 className="font-ch-display text-[24px] font-extrabold leading-tight tracking-[-.02em] text-ch-forest">{title}</h3>
      <p className="mt-2 max-w-[56ch] text-[16px] leading-relaxed text-ch-ink-2">{body}</p>
      <div className="mt-6 flex-1 content-end">{children}</div>
    </div>
  );
}

/** Every 15 seconds: a check log that ends in an open site. */
function CheckLog() {
  const rows = [
    ["6:01:44", "Checked. Fully booked."],
    ["6:01:59", "Checked. Fully booked."],
  ] as const;
  return (
    <figure className="rounded-[16px] bg-ch-paper p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="whitespace-nowrap font-ch-display text-[44px] font-extrabold leading-none tracking-[-.03em] text-ch-forest tabular-nums sm:text-[56px]">15 sec</p>
        <p className="text-[15px] font-bold text-ch-ink-2">between checks, all day and night</p>
      </div>
      <ol className="mt-4 grid gap-1 text-[15px] tabular-nums">
        {rows.map(([t, what]) => (
          <li key={t} className="grid grid-cols-[64px_1fr] sm:grid-cols-[76px_1fr] items-center rounded-[10px] px-3 py-2 text-ch-ink-2">
            <span className="text-ch-muted">{t}</span>
            <span>{what}</span>
          </li>
        ))}
        <li className="grid grid-cols-[64px_1fr] sm:grid-cols-[76px_1fr] items-center rounded-[10px] border-[1.5px] border-ch-green bg-ch-card px-3 py-2 font-bold text-ch-ink">
          <span className="font-normal text-ch-muted">6:02:14</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1"><Tag kind="open">Open</Tag> Site 042. Alert sent.</span>
        </li>
      </ol>
    </figure>
  );
}

/** Auto-cart: the site held in the user's Recreation.gov cart. */
function HeldCart() {
  return (
    <figure className="flex flex-col items-stretch gap-4 rounded-[16px] bg-ch-paper p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-ch-ink-2">Recreation.gov cart <Tag kind="cart">In cart</Tag></p>
        <p className="mt-1.5 font-ch-display text-[19px] font-extrabold leading-tight text-ch-ink">Upper Pines, site 042</p>
        <p className="mt-0.5 text-[15px] text-ch-ink-2 tabular-nums">Open for Jul 18-21, 3 nights</p>
      </div>
      <span className={buttonClasses({ variant: "cart", className: "pointer-events-none shrink-0 px-5" })}>Check out on Recreation.gov</span>
    </figure>
  );
}

/** Live search: open and booked campgrounds, said in words. */
function MiniResults() {
  const rows = [
    { name: "Upper Pines", where: "Yosemite, CA", open: "Open for Jul 18-21" },
    { name: "North Pines", where: "Yosemite, CA" },
    { name: "Wawona", where: "Yosemite, CA" },
  ];
  return (
    <figure>
      <ul className="divide-y divide-ch-line rounded-[16px] border border-ch-line">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-ch-display text-[17px] font-bold text-ch-ink">{r.name}</p>
              <p className="text-[14px] text-ch-muted">{r.where}</p>
            </div>
            {r.open ? (
              <span className="flex flex-col items-end gap-1 text-right"><Tag kind="open">Open</Tag><span className="text-[13px] font-bold text-ch-ink tabular-nums">{r.open}</span></span>
            ) : (
              <span className="flex flex-col items-end gap-1 text-right"><Tag kind="paused" srPrefix="Status:">Fully booked</Tag><span className={buttonClasses({ variant: "quiet", size: "sm", className: "pointer-events-none px-3 py-1.5" })}>Watch it</span></span>
            )}
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Flexible dates: a two-week window, and the three nights that opened inside it. */
function DateWindow() {
  const days = Array.from({ length: 14 }, (_, i) => 12 + i); // Jul 12-25
  const open = new Set([18, 19, 20]);
  return (
    <figure className="rounded-[16px] bg-ch-paper p-4 sm:p-5">
      <p className="text-[14px] font-bold text-ch-ink-2">Any 3 nights, Jul 12-25</p>
      <div aria-hidden="true" className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[12px] font-bold text-ch-muted">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <ol className="mt-1.5 grid grid-cols-7 gap-1.5 tabular-nums" aria-label="July 12 to 25; nights of July 18, 19 and 20 are open">
        {days.map((d) => (
          <li
            key={d}
            className={cx(
              "grid aspect-square place-items-center rounded-[8px] text-[14px] font-bold",
              open.has(d) ? "bg-ch-green text-ch-white" : "border border-ch-line bg-ch-card text-ch-ink-2",
            )}
          >
            {d}
          </li>
        ))}
      </ol>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-[15px] font-bold text-ch-ink"><Tag kind="open">Open</Tag> Nights of Jul 18, 19 and 20</p>
    </figure>
  );
}

export function WatchProofs() {
  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
      <Tile title={ALERTS.title} body={ALERTS.body} className="lg:col-span-7"><CheckLog /></Tile>
      <Art art={ART.a3} sizes="(min-width: 1024px) 40vw, 100vw" className="aspect-[4/3] w-full rounded-[22px] object-cover object-[50%_75%] lg:col-span-5 lg:row-span-2 lg:aspect-auto lg:h-full" />
      <Tile title={AUTOCART.title} body={AUTOCART.body} className="lg:col-span-7"><HeldCart /></Tile>
      <Tile title={SEARCH.title} body={SEARCH.body} className="lg:col-span-6"><MiniResults /></Tile>
      <Tile title={FLEXIBLE.title} body={FLEXIBLE.body} className="lg:col-span-6"><DateWindow /></Tile>
    </div>
  );
}
