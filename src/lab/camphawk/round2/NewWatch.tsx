"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellOff, BellRing, Check, ChevronDown } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../ui";
import { priceShort, WATCH_LIMIT } from "../data";
import { LabBar } from "../LabBar";
import { Collapsible } from "../ui/Collapsible";
import { DatePicker, type DateRange } from "../ui/DatePicker";
import { NightsPicker } from "../ui/NightsPicker";
import { Chip } from "../ui/Chip";
import { RadioChips } from "../ui/RadioChips";
import { addDays, formatRange, nightsBetween, thisWeekendRange, todayISO, type ISODate } from "../ui/date";
import { ART } from "./Art";
import { AppBand, BandPhoto, FavoriteHeart, LabSelect, PLANS, PricingLink, SubscribeCta, type Plan } from "./AppParts";
import { FIRST_COME_BADGE, FIRST_COME_WHY } from "./campground-data";
import { accountGate, ROUTES } from "./gates";
import { TRIAL_DAYS } from "./pages/tier2-data";
import { BetaNote } from "./BareFrame";
import { GhFooter, ScreenLinks } from "./GhChrome";
import { useUrlParam, useUrlState, useVisitor, withVisitor } from "./labState";
import { bookableParts, FAVORITE_IDS, findCampgrounds, pickable, PICKABLE, sitesFor, type Division, type Pickable } from "./newwatch-data";

// Screen 4 in the Golden hour look: CampHawk's New watch (campsite-finder src/app/(app)/new,
// src/components/v2/NewWatch.tsx, TrustPanel.tsx, SiteMuteList.tsx), ported with example data.
// Contract: docs/design/camphawk-home.md, "Screen 4". What it keeps from CampHawk, on purpose:
// - The control matches who's reading: only a subscriber gets "Start watching"; everyone else
//   gets the step open to them, before they fill anything in.
// - A park is one watch: its bookable parts start ticked (up to 10); first-come parts never
//   appear, and a first-come campground can't be picked at all, with the reason in words.
// - The panel beside the form explains a watch until there's a campground, then reads back
//   exactly what will be created.
// - Auto-cart is promised only to someone on the Auto-Cart plan; anyone else is told what still
//   happens. No filter panel: the poller doesn't read one, so this screen doesn't offer it.
// Lab changes: the "What we’ll do" panel is a plain card (CampHawk tints it green, which its own
// rules keep for an open site or an action). A muted site is neutral (a word and a crossed bell), not CampHawk's red button,
// because red means "you must act" in its own rules.

const MAX_DIVISIONS = 10;
/** The picker's starting suggestions (example data): the lab's most-watched campgrounds. */
const OFTEN_WATCHED = ["upper-pines", "north-pines", "leo-carrillo"];
type Mode = "exact" | "flexible";
type OnSubmit = "saves" | "limit" | "expired" | "needs-sub";
const ON_SUBMIT = ["saves", "limit", "expired", "needs-sub"] as const;

const label = "mb-2 block text-[13px] font-extrabold text-ch-ink-2";
const panel = "rounded-ch-input border border-ch-line bg-ch-card px-4 py-3.5";

function TrustPanel() {
  const [open, setOpen] = useState(false);
  const tick = (t: React.ReactNode, i: number) => (
    <li key={i} className="flex items-start gap-2 py-1 text-[14px] leading-normal text-ch-ink-2">
      <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-ch-ink" />
      <span>{t}</span>
    </li>
  );
  return (
    <div className="mt-2.5 grid gap-2.5">
      <div className={panel}>
        <h3 className="text-[15px] font-bold text-ch-ink">What we can and can’t do</h3>
        <ul className="mt-1.5">
          {[
            <>We stay signed in to your account in a browser on a private machine we run — never on our web servers, and never in our cloud database.</>,
            <>The only thing we do with it is <strong className="font-extrabold text-ch-ink">add a site to your cart</strong>. Nothing is ever bought.</>,
            <>We can’t check out, cancel, or change a reservation you already have.</>,
            <>Disconnecting signs out and deletes the session right away. Your watches keep running — just without auto-cart.</>,
          ].map(tick)}
        </ul>
        <p className="mt-1.5 border-t border-ch-line pt-2 text-[13px] leading-normal text-ch-muted">
          Recreation.gov sessions drop from time to time. Because your login is saved, the machine signs back in on its own — you don’t have to do anything. Auto-cart pauses for those few minutes, and your watches keep alerting you normally throughout.
        </p>
      </div>
      <div className="rounded-ch-input border border-ch-ochre-line bg-ch-ochre-soft px-4 py-3.5">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-11 w-full cursor-pointer items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green">
          <span className="flex-1">
            <span className="block text-[15px] font-bold text-ch-ochre-ink">Auto-cart saves your Recreation.gov login</span>
            <span className="mt-0.5 block text-[13px] text-ch-ochre-ink">It has to, so it can sign back in for you — tap to see exactly what that means.</span>
          </span>
          <ChevronDown aria-hidden="true" className={cx("size-4 shrink-0 text-ch-ochre-ink transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </button>
        {open && (
          <ul className="mt-2 border-t border-ch-ochre-line pt-2">
            {[
              <>We store your Recreation.gov <strong className="font-extrabold">password</strong>, encrypted, on that same private machine. It never reaches CampHawk’s servers or database.</>,
              <>We use it for exactly one thing: signing you back in when the session drops, so auto-cart doesn’t quietly stop working.</>,
              <>After two failed sign-ins we delete it and ask you to reconnect, so a changed password can’t lock your account.</>,
              <>Turning auto-cart off, or disconnecting, deletes the stored password immediately.</>,
            ].map((t, i) => (
              <li key={i} className="flex items-start gap-2 py-1 text-[14px] leading-normal text-ch-ink-2">
                <span aria-hidden="true" className="mt-px shrink-0 text-[12px] font-extrabold text-ch-ochre-ink">!</span>
                <span>{t}</span>
              </li>
            ))}
            <li className="mt-1.5 border-t border-ch-ochre-line pt-2 text-[13px] leading-normal text-ch-ochre-ink">
              A saved password is more than a session — it’s a reusable key to your Recreation.gov account. Auto-cart can’t work without it. If you’d rather not, leave auto-cart off: your watches still find the opening and still alert you in seconds, you just add the site to the cart yourself.
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

function MuteList({ ids, divisions, muted, setMuted }: { ids: string[]; divisions: Division[]; muted: ReadonlySet<string>; setMuted: (s: ReadonlySet<string>) => void }) {
  const sites = useMemo(() => sitesFor(ids, divisions), [ids, divisions]);
  const toMute = sites.filter((s) => !muted.has(s.id)).map((s) => s.id);
  const toUnmute = sites.filter((s) => muted.has(s.id)).map((s) => s.id);
  const change = (mute: string[], unmute: string[]) => {
    const next = new Set(muted);
    mute.forEach((id) => next.add(id));
    unmute.forEach((id) => next.delete(id));
    setMuted(next);
  };
  const small = buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 px-3.5" });
  return (
    <>
      <p className="pb-3 text-[14px] leading-normal text-ch-ink-2">Only want a handful of sites? Mute all, then unmute the ones you’d actually take — we’ll only wake you for those. You can change this any time from the watch.</p>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {toMute.length > 0 && <button type="button" onClick={() => change(toMute, [])} className={small}>Mute all {toMute.length}</button>}
        {toUnmute.length > 0 && <button type="button" onClick={() => change([], toUnmute)} className={small}>Unmute all {toUnmute.length}</button>}
        <span className="text-[13px] text-ch-muted">{muted.size ? `${muted.size} of ${sites.length} muted` : "Mute all, then unmute the few you’d take"}</span>
      </div>
      <ul className="max-h-[320px] overflow-y-auto overscroll-contain">
        {sites.map((s) => {
          const isMuted = muted.has(s.id);
          return (
            <li key={s.id} className="flex items-center gap-2.5 border-b border-ch-line py-2 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className={cx("block truncate text-[15px] font-bold", isMuted ? "text-ch-muted" : "text-ch-ink")}>{s.name}</span>
                <span className="mt-0.5 block text-[13px] text-ch-muted">{s.note}</span>
              </span>
              <button
                type="button"
                aria-pressed={isMuted}
                aria-label={`Mute site ${s.name}`}
                onClick={() => change(isMuted ? [] : [s.id], isMuted ? [s.id] : [])}
                className={cx(buttonClasses({ variant: "quiet", size: "sm", className: "min-h-11 min-w-[96px] px-3" }), isMuted && "border-ch-muted bg-ch-shell text-ch-ink-2")}
              >
                {isMuted && <BellOff aria-hidden="true" className="size-4" />}
                {isMuted ? "Muted" : "Mute"}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function PickerRow({ p, onPick }: { p: Pickable; onPick: (p: Pickable) => void }) {
  const ok = pickable(p);
  const parts = bookableParts(p).length;
  const body = (
    <>
      <span className="block font-semibold text-ch-ink">
        {p.name}
        {ok && parts > 1 && <span className="ml-1.5 rounded-full border border-ch-line bg-ch-paper px-1.5 py-0.5 text-[12px] font-semibold text-ch-muted">{parts} parts</span>}
        <span className="ml-2 font-normal text-ch-muted">{p.place}</span>
      </span>
      {!ok && <span className="mt-0.5 block text-[13px] text-ch-ink-2">{FIRST_COME_BADGE} — no reservations, so there is nothing to watch.</span>}
    </>
  );
  return ok ? (
    <button type="button" data-picker-option="" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(p)} className="block min-h-12 w-full cursor-pointer bg-ch-card px-3.5 py-2.5 text-left text-[15px] hover:bg-ch-paper focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ch-green">{body}</button>
  ) : (
    <div className="bg-ch-card px-3.5 py-2.5 text-[15px]">{body}</div>
  );
}

export function NewWatch() {
  const router = useRouter();
  const [visitor, setVisitor] = useVisitor();
  const [plan, setPlan] = useUrlState<Plan>("plan", "autocart", PLANS);
  const [onSubmit, setOnSubmit] = useUrlState<OnSubmit>("submit", "saves", ON_SUBMIT);
  const initialId = useUrlParam("campground");
  const initialStart = useUrlParam("start");
  const initialEnd = useUrlParam("end");

  const [chosen, setChosenCg] = useState<Pickable | null>(null);
  const [q, setQ] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(() => new Set(FAVORITE_IDS));
  const [parts, setParts] = useState<ReadonlySet<string>>(new Set());
  const [mode, setMode] = useState<Mode>("exact");
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [flexNights, setFlexNights] = useState(2);
  const [weekendsOnly, setWeekendsOnly] = useState(false);
  const [autoCart, setAutoCart] = useState(true);
  const [muted, setMuted] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<"expired" | "needs-sub" | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seeded = useRef(false);

  const pick = useCallback((p: Pickable) => {
    setChosenCg(p);
    setQ(p.name);
    setPickerOpen(false);
    setMuted(new Set());
    setParts(new Set(bookableParts(p).slice(0, MAX_DIVISIONS).map((d) => d.id)));
  }, []);

  // Arriving from a result card or a campground page: the campground and nights come along.
  useEffect(() => {
    if (seeded.current) return;
    if (initialId === null && initialStart === null) return;
    seeded.current = true;
    const p = PICKABLE.find((x) => x.id === initialId);
    // One-time sync FROM the URL (a result card or a campground page) after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (p) pick(p);
    if (initialStart && initialEnd) setRange({ start: initialStart as ISODate, end: initialEnd as ISODate });
  }, [initialId, initialStart, initialEnd, pick]);

  const divisions = chosen ? bookableParts(chosen) : [];
  const targets = divisions.length > 1 ? divisions.filter((d) => parts.has(d.id)).map((d) => d.id) : divisions.length === 1 ? [divisions[0].id] : chosen ? [chosen.id] : [];
  const firstCome = Boolean(chosen && !pickable(chosen));
  const canAutoCart = chosen?.provider === "Recreation.gov" && !firstCome;
  const canRcHold = chosen?.provider === "ReserveCalifornia" && !firstCome;
  const offer = visitor === "subscriber" && plan === "autocart" ? "promise" : "upsell";
  const windowNights = range.start && range.end ? nightsBetween(range.start, range.end) : 0;
  const flexTooLong = mode === "flexible" && windowNights > 0 && flexNights > windowNights;
  const tooMany = divisions.length > 1 && parts.size > MAX_DIVISIONS;
  const weekend = thisWeekendRange();
  const isThisWeekend = range.start === weekend.start && range.end === weekend.end;
  const gate = accountGate(visitor);
  const notifyWords = visitor === "app" ? "send you a notification" : "text, email and push you";

  const favoriteRows = chosen ? [] : PICKABLE.filter((p) => favorites.has(p.id) && (!q.trim() || [p.name, p.place].some((v) => v.toLowerCase().includes(q.trim().toLowerCase()))));
  const hits = chosen ? [] : findCampgrounds(q).filter((p) => !favorites.has(p.id));
  const canFavorite = visitor === "subscriber";
  const shown = pickerOpen && ((canFavorite && favoriteRows.length > 0) || hits.length > 0);

  function submit() {
    // Each error takes focus to the field it's about (it shows under the button, far from it).
    const focus = (sel: string) => window.setTimeout(() => document.querySelector<HTMLElement>(sel)?.focus(), 0);
    if (!chosen) { focus("#nw-cg"); return setError("Pick a campground to watch."); }
    if (!range.start || !range.end) { focus("#nw-dates button[aria-expanded]"); return setError(mode === "flexible" ? "Choose the window to watch." : "Choose your nights."); }
    if (targets.length === 0) { focus("#nw-parts input[type=checkbox]"); return setError("Pick at least one part of the park to watch."); }
    setSaving(true);
    setError(null);
    setAnswer(null);
    window.setTimeout(() => {
      setSaving(false);
      if (onSubmit === "limit") return setError(`You’ve hit the ${WATCH_LIMIT}-watch limit. Delete one to add another.`);
      if (onSubmit === "expired" || onSubmit === "needs-sub") return setAnswer(onSubmit);
      const nights = mode === "flexible" ? `&nights=${flexNights}${weekendsOnly ? "&weekends=1" : ""}` : "";
      router.push(withVisitor(`${ROUTES.watches}?new=${chosen.id}&start=${range.start}&end=${range.end}${nights}`, visitor));
    }, 600);
  }

  const toggleFavorite = (id: string) => setFavorites((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="gh">
      <LabBar page="New watch" visitor={visitor} onVisitor={setVisitor}>
        <ScreenLinks visitor={visitor} current="new" />
        {visitor === "subscriber" && <LabSelect label="Plan" short="Plan" value={plan} onChange={setPlan} options={[["autocart", "Auto-Cart"], ["alerts", "Alerts"]]} />}
        {visitor === "subscriber" && <LabSelect label="On submit" short="Submit" value={onSubmit} onChange={setOnSubmit} options={[["saves", "Saves"], ["limit", "At the limit"], ["expired", "Session expired"], ["needs-sub", "Plan lapsed"]]} />}
      </LabBar>

      <main id="main">
        <AppBand visitor={visitor} current="new" title="New watch" sub="Pick a booked campground and the nights you want. We check it every 15 seconds until a site opens." photo={<BandPhoto art={ART.n1} pos="80% 45%" posLg="50% 34%" />} />
        <div className="relative mx-auto -mt-[var(--gh-dock)] grid max-w-[var(--gh-max)] items-start gap-6 px-5 pb-[clamp(40px,6vw,80px)] sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="min-w-0 rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-pop sm:p-7">
            {/* Keeps the outline in order (h1, then h2 before the panels' h3s). */}
            <h2 className="sr-only">The watch</h2>
            <label htmlFor="nw-cg" className={label}>Which campground</label>
            <div
              ref={pickerRef}
              onBlur={(e) => {
                if (e.relatedTarget instanceof Node && pickerRef.current?.contains(e.relatedTarget)) return;
                window.setTimeout(() => { if (!pickerRef.current?.contains(document.activeElement)) setPickerOpen(false); }, 120);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && pickerOpen) { inputRef.current?.focus(); setPickerOpen(false); return; }
                if ((e.key === "ArrowDown" || e.key === "ArrowUp") && shown) {
                  const rows = Array.from(pickerRef.current?.querySelectorAll<HTMLElement>("[data-picker-option]") ?? []);
                  if (!rows.length) return;
                  e.preventDefault();
                  const at = rows.indexOf(document.activeElement as HTMLElement);
                  if (e.key === "ArrowDown") rows[Math.min(at + 1, rows.length - 1)].focus();
                  else if (at <= 0) inputRef.current?.focus();
                  else rows[at - 1].focus();
                }
              }}
            >
              {/* Rows carry a favorite button as well as the pick, so they're a group of buttons
                  reached with the down arrow, not a listbox (a listbox can't hold buttons). */}
              <p id="nw-cg-hint" className="sr-only">Matching campgrounds appear below as you type. Press the down arrow to reach them.</p>
              <div className="relative">
                <input
                  ref={inputRef}
                  id="nw-cg"
                  type="search"
                  aria-controls={shown ? "nw-cg-list" : undefined}
                  aria-describedby="nw-cg-hint"
                  value={q}
                  onFocus={() => setPickerOpen(true)}
                  onChange={(e) => { setQ(e.target.value); setPickerOpen(true); setChosenCg(null); }}
                  placeholder="Search a campground by name…"
                  autoComplete="off"
                  className={cx("min-h-12 w-full rounded-ch-input border border-ch-line bg-ch-paper py-3 pl-4 font-ch-display text-[16px] font-semibold text-ch-ink placeholder:font-ch-body placeholder:font-normal placeholder:text-ch-muted focus-visible:border-ch-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green", chosen && canFavorite ? "pr-12" : "pr-4")}
                />
                {chosen && canFavorite && <FavoriteHeart favorite={favorites.has(chosen.id)} onToggle={() => toggleFavorite(chosen.id)} name={chosen.name} className="absolute right-1.5 top-1/2 -translate-y-1/2" />}
              </div>
              {shown && (
                <div id="nw-cg-list" role="group" aria-label="Matching campgrounds" className="mt-1 overflow-hidden rounded-ch-input border border-ch-line">
                  {canFavorite && favoriteRows.length > 0 && (
                    <>
                      <p className="border-b border-ch-line bg-ch-ochre-soft px-3.5 py-2 text-[13px] font-extrabold text-ch-ochre-ink">Your favorites</p>
                      <ul>
                        {favoriteRows.map((p) => (
                          <li key={p.id} className="flex items-center border-b border-ch-line last:border-b-0">
                            <div className="min-w-0 flex-1"><PickerRow p={p} onPick={(x) => { pick(x); inputRef.current?.focus(); }} /></div>
                            <FavoriteHeart favorite onToggle={() => toggleFavorite(p.id)} name={p.name} className="mr-1.5" />
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {hits.length > 0 && (
                    <ul className={cx(canFavorite && favoriteRows.length > 0 && "border-t border-ch-line")}>
                      {hits.map((p) => <li key={p.id} className="border-b border-ch-line last:border-b-0"><PickerRow p={p} onPick={(x) => { pick(x); inputRef.current?.focus(); }} /></li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {/* An empty box gets a start: the campgrounds people watch most, one tap to pick. */}
            {!chosen && !shown && !q.trim() && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="w-full text-[14px] text-ch-ink-2">Often watched</span>
                {OFTEN_WATCHED.map((id) => PICKABLE.find((p) => p.id === id)!).map((p) => (
                  <Chip key={p.id} size="sm" onClick={() => pick(p)}>{p.name}</Chip>
                ))}
              </div>
            )}

            {divisions.length > 1 && (
              <fieldset className="mt-6">
                <legend className={label}>Which parts of the park</legend>
                <div className="rounded-[13px] border border-ch-line bg-ch-card">
                  <div className="flex items-center justify-between gap-2 border-b border-ch-line px-3.5 py-1.5">
                    <span className="text-[14px] text-ch-ink-2">{parts.size} of {divisions.length} selected</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setParts(new Set(divisions.slice(0, MAX_DIVISIONS).map((d) => d.id)))} className="min-h-11 rounded-lg px-3 text-[14px] font-bold text-ch-forest underline underline-offset-2 hover:bg-ch-paper">All</button>
                      <button type="button" onClick={() => setParts(new Set())} className="min-h-11 rounded-lg px-3 text-[14px] font-bold text-ch-ink-2 hover:bg-ch-paper">None</button>
                    </div>
                  </div>
                  <ul id="nw-parts" className="max-h-64 divide-y divide-ch-line overflow-y-auto overscroll-contain">
                    {divisions.map((d) => (
                      <li key={d.id}>
                        <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3.5 py-2 hover:bg-ch-paper">
                          <input type="checkbox" checked={parts.has(d.id)} onChange={() => setParts((prev) => { const n = new Set(prev); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} className="size-[18px] shrink-0 accent-ch-green" />
                          <span className="text-[15px] text-ch-ink">{d.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
                {tooMany && <p role="alert" className="mt-2 px-0.5 text-[14px] text-ch-alert-deep">{parts.size} parts selected — the most a single watch can cover is {MAX_DIVISIONS}. Untick a few.</p>}
                <p className="mt-2 px-0.5 text-[13px] leading-normal text-ch-muted">All the parts you keep are watched under one watch, so a whole park still counts as one of your {WATCH_LIMIT}. Up to {MAX_DIVISIONS}.</p>
              </fieldset>
            )}

            <fieldset className="mt-6">
              <legend className={label}>Which nights</legend>
              <RadioChips<"exact" | "weekend" | "flexible">
                label="Which nights"
                className="mb-2.5"
                options={[{ value: "exact", label: "Exact dates" }, { value: "weekend", label: "This weekend" }, { value: "flexible", label: "Flexible" }]}
                value={mode === "flexible" ? "flexible" : isThisWeekend ? "weekend" : "exact"}
                onChange={(v) => { if (v === "weekend") { setMode("exact"); setRange(thisWeekendRange()); } else setMode(v); }}
              />
              {mode === "flexible" && <div className="mb-2.5"><NightsPicker nights={flexNights} onNightsChange={setFlexNights} weekendsOnly={weekendsOnly} onWeekendsOnlyChange={setWeekendsOnly} /></div>}
              <div id="nw-dates"><DatePicker
                value={range}
                onChange={setRange}
                label={mode === "flexible" ? "Window to watch" : "Trip dates"}
                meta={mode === "flexible" && range.start ? `any ${flexNights}-night${weekendsOnly ? " weekend" : ""} stay in this window` : undefined}
                minDate={todayISO()}
                defaultMonth={range.start ?? addDays(todayISO(), 1)}
              /></div>
              {flexTooLong && <p role="alert" className="mt-2 text-[14px] text-ch-alert-deep">{flexNights} nights doesn’t fit in a {windowNights}-night window. Widen the window or shorten the stay.</p>}
            </fieldset>

            {targets.length > 0 && !firstCome && (
              <div className="mt-6">
                <Collapsible label="Mute individual campsites" summary={muted.size ? `${muted.size} muted` : "optional"}>
                  <MuteList ids={targets} divisions={divisions} muted={muted} setMuted={setMuted} />
                </Collapsible>
              </div>
            )}

            {canAutoCart && offer === "promise" && (
              <fieldset className="mt-6">
                <legend className={label}>Auto-cart</legend>
                <button type="button" onClick={() => setAutoCart(!autoCart)} aria-pressed={autoCart} className="flex w-full cursor-pointer items-center gap-3 rounded-ch-input border border-ch-line bg-ch-card px-4 py-3.5 text-left hover:border-ch-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green">
                  <span className="flex-1">
                    <span className="block text-[15px] font-bold text-ch-ink">Add it to my cart automatically</span>
                    <span className="mt-0.5 block text-[14px] leading-normal text-ch-ink-2">We put the site in your Recreation.gov cart the moment it opens, so it’s waiting when your phone buzzes.</span>
                  </span>
                  {/* The switch carries its state as position and a word as well as hue. */}
                  <span className="flex shrink-0 flex-col items-center gap-1">
                    <span aria-hidden="true" className={cx("relative h-6 w-10 rounded-full transition-colors motion-reduce:transition-none", autoCart ? "bg-ch-blue" : "bg-ch-faint")}>
                      <span className={cx("absolute top-[3px] size-[18px] rounded-full bg-ch-card shadow-ch-card transition-transform motion-reduce:transition-none", autoCart ? "translate-x-[19px]" : "translate-x-[3px]")} />
                    </span>
                    <span aria-hidden="true" className="text-[12px] font-bold text-ch-ink-2">{autoCart ? "On" : "Off"}</span>
                  </span>
                </button>
                {autoCart && <TrustPanel />}
              </fieldset>
            )}
            {canAutoCart && offer === "upsell" && (
              <fieldset className="mt-6">
                <legend className={label}>Auto-cart</legend>
                <div className={panel}>
                  <p className="text-[15px] font-bold text-ch-ink">Auto-cart is on the Auto-Cart plan</p>
                  <p className="mt-0.5 text-[14px] leading-normal text-ch-ink-2">We’ll still alert you the moment a site opens — you book it yourself. <a href="#" className="font-bold underline underline-offset-2 hover:text-ch-ink">See plans</a></p>
                </div>
              </fieldset>
            )}
            {canRcHold && offer === "promise" && (
              <div className={cx(panel, "mt-6")}>
                <p className="text-[15px] font-bold text-ch-ink">We can hold a site at the 8 AM release</p>
                <p className="mt-1 text-[14px] leading-normal text-ch-ink-2">ReserveCalifornia releases canceled sites at 8 AM. The night before, we’ll tell you which site is opening and offer to cart it the second it does — you decide then, site by site. Nothing to switch on here.</p>
                <BetaNote className="mt-2" />
              </div>
            )}
            {canRcHold && offer === "upsell" && (
              <div className={cx(panel, "mt-6")}>
                <p className="text-[15px] font-bold text-ch-ink">8 AM holds are on the Auto-Cart plan</p>
                <p className="mt-1 text-[14px] leading-normal text-ch-ink-2">ReserveCalifornia releases canceled sites at 8 AM. We’ll still tell you the night before which site is opening, and alert you the moment it does — you book it yourself. <a href="#" className="font-bold underline underline-offset-2 hover:text-ch-ink">See plans</a></p>
              </div>
            )}
            {/* The action sits under the fields it submits (CampHawk puts it in the side panel, which
                lands below the explainer on phones). */}
            <div className="mt-7 border-t border-ch-line pt-6">
              <div>
                {firstCome && <p className="mb-2.5 rounded-ch-input border border-ch-line bg-ch-paper px-3 py-2.5 text-[14px] leading-normal text-ch-ink-2"><strong className="font-bold">{FIRST_COME_BADGE}.</strong> {FIRST_COME_WHY}</p>}
                {gate === "ready" ? (
                  <button type="button" onClick={submit} disabled={saving || flexTooLong || tooMany || firstCome} className={buttonClasses({ fullWidth: true, className: "min-h-12 text-[16px] disabled:cursor-not-allowed disabled:bg-ch-shell disabled:text-ch-ink-2 disabled:shadow-none" })}>
                    {saving ? "Setting up…" : "Start watching"}
                  </button>
                ) : (
                  <SubscribeCta visitor={visitor} fullWidth />
                )}
                {/* Where the alert will go, so "Start watching" has a visible consequence. */}
                {gate === "ready" && (
                  <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[14px] text-ch-ink-2">
                    <BellRing aria-hidden="true" className="size-4 shrink-0" />
                    {visitor === "app" ? "Alerts come to this phone as notifications." : <>Alerts go by email, push and text. <a href="#" className="font-bold text-ch-ink underline underline-offset-[3px]">Change in Settings</a></>}
                  </p>
                )}
              </div>
              {answer === "needs-sub" && (
                <p role="status" className="mt-3 text-[14px] leading-normal text-ch-ink">Watches need a subscription — from {priceShort("base", "monthly")} after a {TRIAL_DAYS}‑day free trial. <a href="#" className="font-bold underline">Compare plans</a></p>
              )}
              {answer === "expired" && (
                <p role="alert" className="mt-3 text-[14px] leading-normal text-ch-alert-deep">Your session expired before we could save this. <a href="#" className="font-bold underline">Sign in</a> and press Start watching again — nothing you’ve entered is lost.</p>
              )}
              {error && <p role="alert" className="mt-3 text-[14px] text-ch-alert-deep">{error}</p>}
            </div>
          </form>

          <aside aria-labelledby="nw-what" className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-pop sm:p-6 lg:sticky lg:top-6">
            <h2 id="nw-what" className="font-ch-display text-[20px] font-extrabold text-ch-forest">What we’ll do</h2>
            {chosen ? (
              <p className="mt-2 text-[16px] leading-relaxed text-ch-ink-2">
                Watch <strong className="font-extrabold">{chosen.name}</strong> for{" "}
                {mode === "flexible"
                  ? <>any <strong className="font-extrabold">{flexNights}-night</strong>{weekendsOnly ? " weekend" : ""} opening</>
                  : <strong className="font-extrabold">{formatRange(range.start, range.end) ?? "your dates"}</strong>}
                {mode === "flexible" && range.start && <> between <strong className="font-extrabold">{formatRange(range.start, range.end)}</strong></>}
                , around the clock. We’ll {notifyWords} the moment a site frees up — you don’t need to keep this open.
              </p>
            ) : (
              <>
                <p className="mt-2 text-[16px] leading-relaxed text-ch-ink-2">
                  A watch keeps checking a booked campground for you, around the clock. The moment someone cancels, we {notifyWords}, so the site goes to you and not the next person hitting refresh.
                </p>
                <ol className="mt-3">
                  {[
                    ["Pick the campground", "Search by name in the box, or tap one of the campgrounds people often watch."],
                    ["Choose your nights", "Exact dates, This weekend, or Flexible: how many nights you need, anywhere in a range. Flexible catches far more cancellations."],
                    ["Start watching", "Then go about your day. We’ll find you when something opens, and on Recreation.gov we can put the site straight in your cart."],
                  ].map(([title, sub], i) => (
                    <li key={title} className="flex gap-3 border-b border-ch-line py-3.5 last:border-b-0">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ch-shell font-ch-display text-[14px] font-extrabold text-ch-ink">{i + 1}</span>
                      <span>
                        <span className="block text-[16px] font-bold text-ch-ink">{title}</span>
                        <span className="mt-0.5 block text-[15px] leading-relaxed text-ch-ink-2">{sub}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}

          </aside>
          <PricingLink visitor={visitor} plan={plan} className="lg:col-span-2" />
        </div>
      </main>
      <GhFooter visitor={visitor} />
    </div>
  );
}
