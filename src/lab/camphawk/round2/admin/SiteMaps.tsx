"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, EyeOff, RotateCcw } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import { StatusMark } from "../../ui/StatusMark";
import { SiteMap } from "../SiteMap";
import type { SiteMapData } from "../maps";
import { tidyCase } from "../maps/name";
import { AGENCY_SHORT, REASON_LABEL, SAMPLE, VERDICT, reasonCounts, wilson, type Check as QaCheck, type SampleEntry, type Verdict } from "../maps/sample";
import { FIRST_LOOK, FIRST_LOOK_WORD, type FirstLook } from "../maps/sample-review";
import { AdminFrame } from "./AdminFrame";
import { MapThumb } from "./MapThumb";
import { AerialCheck } from "./AerialCheck";

// Site maps: the queue where CampHawk's automatically drawn campground maps wait for a person
// (a lab mock of a CampHawk admin section). The evidence is the interface: every verdict says
// its reasons in words, every check shows its measurement against its limit, and every map can
// be laid over the aerial photo of the same ground. Decisions are kept in this browser only.

const ORDER: Verdict[] = ["review", "not-drawn", "ready"];
const FILTERS = [["all", "All"], ["review", "Need a look"], ["not-drawn", "Can’t be drawn"], ["ready", "Ready"]] as const;
type Filter = (typeof FILTERS)[number][0];
type Decision = "approved" | "hidden";

/* ---------- decisions, kept in this browser ---------- */

const KEY = "lab-site-map-decisions";
const EVT = "lab-site-map-decisions";
function readDecisions(): Record<string, Decision> {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") ?? {}; } catch { return {}; }
}
let cache: { raw: string | null; value: Record<string, Decision> } = { raw: null, value: {} };
function snapshot() {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { /* storage blocked: nothing saved */ }
  if (raw !== cache.raw) cache = { raw, value: readDecisions() };
  return cache.value;
}
const EMPTY: Record<string, Decision> = {};
function useDecisions(): [Record<string, Decision>, (id: string, d: Decision | null) => void] {
  const value = useSyncExternalStore(
    (on) => { window.addEventListener(EVT, on); window.addEventListener("storage", on); return () => { window.removeEventListener(EVT, on); window.removeEventListener("storage", on); }; },
    snapshot,
    () => EMPTY,
  );
  const set = (id: string, d: Decision | null) => {
    const next = { ...readDecisions() };
    if (d) next[id] = d; else delete next[id];
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not saved */ }
    window.dispatchEvent(new Event(EVT));
  };
  return [value, set];
}

const sorted = [...SAMPLE.entries].sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict) || tidyCase(a.name).localeCompare(tidyCase(b.name)));
const pct = (k: number, n: number) => Math.round((k / n) * 100);
const fmt = (n: number) => n.toLocaleString("en-US");

export function SiteMaps() {
  const params = useSearchParams();
  const id = params.get("id");
  const entry = id ? SAMPLE.entries.find((e) => e.id === id) ?? null : null;
  const home = usePathname() ?? "";
  return (
    <AdminFrame page="Site maps (admin)" home={home}>
      {id ? <Detail entry={entry} id={id} home={home} /> : <Queue home={home} />}
    </AdminFrame>
  );
}

/* ---------- the queue ---------- */

function Queue({ home }: { home: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("show");
  const filter: Filter = FILTERS.some(([v]) => v === raw) ? (raw as Filter) : "all";
  const setFilter = (f: Filter) => router.replace(f === "all" ? home : `${home}?show=${f}`, { scroll: false });
  const [decisions] = useDecisions();
  const { summary, population, entries } = SAMPLE;
  const n = entries.length;
  const [lo, hi] = wilson(summary.ready, n);
  const multi = population.multiSite.campgrounds;
  const shown = sorted.filter((e) => filter === "all" || e.verdict === filter);
  const reasons = reasonCounts(entries);
  const notReady = n - summary.ready;
  const decided = Object.keys(decisions).filter((k) => entries.some((e) => e.id === k && e.verdict !== "ready")).length;

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-balance font-ch-display text-ch-title font-bold leading-tight text-ch-ink">Site maps</h1>
          <p className="mt-1 max-w-[70ch] text-[15px] leading-relaxed text-ch-ink-2">
            {n} Recreation.gov campgrounds, drawn at random from the {fmt(multi)} with two or more sites, built from public data and checked automatically. A map goes live on its own only when every check passes; the rest wait here for a person and the aerial photo.
          </p>
        </div>
      </div>

      {/* The headline, then the other two answers, then the campgrounds that need no map. */}
      <section aria-label="Results" className="grid grid-cols-2 gap-3 lg:grid-cols-[1.35fr_1fr_1fr_1.2fr]">
        <div className="col-span-2 rounded-ch-card bg-ch-forest p-5 text-ch-white shadow-ch-card lg:col-span-1">
          <p className="flex items-center gap-1.5 text-ch-meta font-bold uppercase tracking-[.08em] text-ch-white/80"><Check aria-hidden="true" className="size-4" />Ready on their own</p>
          <p className="mt-2 font-ch-display text-[40px] font-extrabold leading-none tabular-nums">{summary.ready}<span className="text-[22px] font-bold text-ch-white/80"> of {n}</span></p>
          <p className="mt-2 text-[14px] leading-snug text-ch-white/85">{pct(summary.ready, n)}% of the sample. Across all {fmt(multi)}, likely {lo}–{hi}%: about {fmt(Math.round((multi * lo) / 100 / 10) * 10)} to {fmt(Math.round((multi * hi) / 100 / 10) * 10)} maps.</p>
        </div>
        <Tile verdict="review" count={summary.review} n={n} note={decided ? `${decided} decided so far` : "Each takes about a minute with the aerial photo"} />
        <Tile verdict="not-drawn" count={summary.notDrawn} n={n} note="Shown as “not drawn yet” on the campground page" />
        <div className="col-span-2 rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-card sm:p-5 lg:col-span-1">
          <p className="text-ch-meta font-bold uppercase tracking-[.08em] text-ch-muted">No map needed</p>
          <p className="mt-2 font-ch-display text-[32px] font-extrabold leading-none tabular-nums text-ch-ink">{fmt(population.singleUnit.campgrounds)}</p>
          <p className="mt-2 text-[14px] leading-snug text-ch-ink-2">of the {fmt(population.campgrounds)} campgrounds are a single cabin, lookout or group site. Counted, not sampled.</p>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
      <CrossCheck />
      {notReady > 0 && (
        <section aria-labelledby="why-h" className="rounded-ch-card border border-ch-line bg-ch-card shadow-ch-card">
          <div className="border-b border-ch-line px-4 py-3 sm:px-5">
            <h2 id="why-h" className="font-ch-display text-ch-h font-bold text-ch-ink">Why maps need a look</h2>
            <p className="text-[13.5px] text-ch-muted">Of the {notReady} that aren’t ready. One map can have several reasons.</p>
          </div>
          <ul className="grid gap-y-2.5 p-4 sm:p-5">
            {reasons.map((r) => (
              <li key={r.code} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="text-[14px] text-ch-ink">{REASON_LABEL[r.code]}</span>
                <span className="text-[14px] font-bold tabular-nums text-ch-ink">{r.count}</span>
                <span aria-hidden="true" className="col-span-2 h-2 rounded-full bg-ch-shell">
                  <span className="block h-full rounded-full bg-ch-ink-2" style={{ width: `${Math.max(4, (r.count / notReady) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-ch-display text-[20px] font-bold text-ch-ink">The {n} maps</h2>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {FILTERS.map(([v, label]) => {
            const count = v === "all" ? n : entries.filter((e) => e.verdict === v).length;
            const on = filter === v;
            return (
              <button key={v} type="button" aria-pressed={on} onClick={() => setFilter(v)}
                className={cx("inline-flex min-h-10 items-center gap-1.5 rounded-ch-chip border px-3.5 text-[13.5px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green", on ? "border-ch-ink bg-ch-ink text-ch-white" : "border-ch-line bg-ch-card text-ch-ink-2 hover:border-ch-muted")}>
                {label}<span className={cx("tabular-nums", on ? "text-ch-white/80" : "text-ch-muted")}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {shown.length ? (
        <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((e) => <Card key={e.id} entry={e} home={home} decision={decisions[e.id]} />)}
        </ul>
      ) : (
        <p className="mt-3 rounded-ch-card border border-dashed border-ch-line bg-ch-card px-5 py-8 text-center text-[15px] text-ch-ink-2">No maps in this group.</p>
      )}

      <p className="mt-8 max-w-[80ch] text-[13px] leading-relaxed text-ch-muted">
        Drawn {SAMPLE.built} from the {SAMPLE.drawn.export} (seed {SAMPLE.drawn.seed}, stratified by agency). The range is a 95% interval for {n} draws. Build: <code className="font-mono text-[12px]">studio/campground-maps/build-sample.mjs</code>.
      </p>
    </>
  );
}

const LOOKS: FirstLook[] = ["good", "usable", "hold", "unsure"];
const LOOK_HEAD: Record<FirstLook, string> = { good: "Good", usable: "Roads incomplete", hold: "Not usable", unsure: "Can’t tell" };

/** The automatic verdicts against a first look over the aerial photo: where the check was right,
    too strict (held a good map), or too loose (passed a map that isn't usable). */
function CrossCheck() {
  const rows = (["ready", "review"] as Verdict[]).map((v) => {
    const es = SAMPLE.entries.filter((e) => e.verdict === v);
    return { v, n: es.length, counts: LOOKS.map((l) => es.filter((e) => FIRST_LOOK[e.id]?.call === l).length) };
  });
  const passedBad = rows[0].counts[2];
  const heldGood = rows[1].counts[0];
  return (
    <section aria-labelledby="cross-h" className="rounded-ch-card border border-ch-line bg-ch-card shadow-ch-card">
      <div className="border-b border-ch-line px-4 py-3 sm:px-5">
        <h2 id="cross-h" className="font-ch-display text-ch-h font-bold text-ch-ink">Did the check get it right?</h2>
        <p className="text-[13.5px] text-ch-muted">Each verdict against a first look over the aerial photo. “Roads incomplete” maps are usable: sites are right, some roads are missing.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[14px]">
          <thead className="text-[12px] font-bold text-ch-muted">
            <tr className="border-b border-ch-line">
              <th scope="col" className="px-4 py-2 align-bottom font-bold sm:px-5">The check said</th>
              {LOOKS.map((l) => <th key={l} scope="col" className="px-2 py-2 text-right align-bottom font-bold leading-tight last:pr-4 sm:whitespace-nowrap sm:px-3 sm:last:pr-5">{LOOK_HEAD[l]}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.v} className="border-b border-ch-line last:border-b-0">
                <th scope="row" className="py-2.5 pl-4 pr-2 sm:px-5"><StatusMark level={VERDICT[r.v].level} label={VERDICT[r.v].word} className="text-[13.5px]" /><span className="block pl-[22px] text-[12.5px] font-normal text-ch-muted">{r.n} maps</span></th>
                {r.counts.map((c, i) => <td key={i} className={cx("px-2 py-2.5 text-right tabular-nums last:pr-4 sm:px-3 sm:last:pr-5", c ? "font-bold text-ch-ink" : "text-ch-muted")}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-ch-line px-4 py-3 text-[14px] leading-snug text-ch-ink-2 sm:px-5">
        {passedBad === 0 ? "No map it passed looked unusable." : `${passedBad} map${passedBad === 1 ? "" : "s"} it passed looked unusable.`} {rows[0].counts[1]} of the {rows[0].n} it passed are missing some roads. {heldGood} of the {rows[1].n} it held were fine and take a minute to approve, which makes <strong className="font-bold text-ch-ink">{rows[0].n + heldGood} of {SAMPLE.entries.length} ready to go live after one look</strong>.
      </p>
    </section>
  );
}

function Tile({ verdict, count, n, note }: { verdict: Verdict; count: number; n: number; note: string }) {
  const v = VERDICT[verdict];
  return (
    <div className="rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-card sm:p-5">
      <StatusMark level={v.level} label={v.plural} className="whitespace-normal text-ch-meta uppercase tracking-[.08em]" />
      <p className="mt-2 font-ch-display text-[32px] font-extrabold leading-none tabular-nums text-ch-ink">{count}<span className="text-[18px] font-bold text-ch-muted"> of {n}</span></p>
      <p className="mt-2 text-[14px] leading-snug text-ch-ink-2">{note}</p>
    </div>
  );
}

function Card({ entry: e, home, decision }: { entry: SampleEntry; home: string; decision?: Decision }) {
  const v = VERDICT[e.verdict];
  const name = tidyCase(e.name);
  return (
    <li className="group relative flex overflow-hidden rounded-ch-card border border-ch-line bg-ch-card shadow-ch-card transition-colors focus-within:border-ch-ink hover:border-ch-muted sm:flex-col">
      {/* The box keeps its shape whatever the campground's (square in a phone's row, 4:3 on a
          card); the drawing fits inside it. */}
      <div className="relative aspect-square w-28 shrink-0 border-r border-ch-line bg-ch-shell sm:aspect-[4/3] sm:w-auto sm:border-b sm:border-r-0">
        <div className="absolute inset-1.5 sm:inset-2"><MapThumb thumb={e.thumb} label={`${name}: ${e.metrics.placed} sites`} /></div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 sm:gap-1.5 sm:p-4">
        <StatusMark level={v.level} label={v.word} className="text-[13px]" />
        <h3 className="font-ch-display text-[17px] font-bold leading-snug text-ch-ink">
          <Link href={`${home}?id=${e.id}`} className="after:absolute after:inset-0 focus-visible:outline-none group-focus-within:underline">{name}</Link>
        </h3>
        <p className="text-[13.5px] text-ch-muted">{[AGENCY_SHORT[e.agency] ?? e.agency, e.state, `${e.metrics.sites} sites`].filter(Boolean).join(" · ")}</p>
        {e.reasons.length > 0 && (
          <p className="text-[13.5px] leading-snug text-ch-ink-2">{e.reasons[0].text}{e.reasons.length > 1 ? `, and ${e.reasons.length - 1} more reason${e.reasons.length > 2 ? "s" : ""}` : ""}.</p>
        )}
        {FIRST_LOOK[e.id] && <p className="mt-auto pt-1 text-[13px] text-ch-muted">First look: <span className="font-bold text-ch-ink-2">{FIRST_LOOK_WORD[FIRST_LOOK[e.id].call]}</span></p>}
        {decision && <DecisionNote decision={decision} />}
      </div>
    </li>
  );
}

function DecisionNote({ decision, className }: { decision: Decision; className?: string }) {
  return (
    <p className={cx("flex items-center gap-1.5 text-[13px] font-bold text-ch-ink", className)}>
      {decision === "approved" ? <Check aria-hidden="true" className="size-4" /> : <EyeOff aria-hidden="true" className="size-4" />}
      {decision === "approved" ? "You approved it" : "You kept it hidden"}
    </p>
  );
}

/* ---------- one map ---------- */

function useMap(id: string): { map: SiteMapData | null; state: "loading" | "ready" | "error" } {
  const [got, setGot] = useState<{ id: string; map: SiteMapData | null } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/private/camphawk/maps/ridb-${id}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((m: SiteMapData | null) => { if (live) setGot({ id, map: m && Array.isArray(m.sites) ? m : null }); });
    return () => { live = false; };
  }, [id]);
  if (!got || got.id !== id) return { map: null, state: "loading" };
  return got.map ? { map: got.map, state: "ready" } : { map: null, state: "error" };
}

function Detail({ entry, id, home }: { entry: SampleEntry | null; id: string; home: string }) {
  const [decisions, decide] = useDecisions();
  const { map, state } = useMap(id);
  const back = <Link href={home} className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-bold text-ch-ink-2 underline-offset-2 hover:underline"><ArrowLeft aria-hidden="true" className="size-4" />All maps</Link>;
  if (!entry) return <>{back}<p className="mt-4 text-[15px] text-ch-ink-2">There’s no map “{id}” in this sample.</p></>;

  const v = VERDICT[entry.verdict];
  const name = tidyCase(entry.name);
  const decision = decisions[entry.id];
  const at = sorted.findIndex((e) => e.id === entry.id);
  const nextEntry = sorted.slice(at + 1).find((e) => e.verdict !== "ready" && !decisions[e.id]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {back}
        {nextEntry && <Link href={`${home}?id=${nextEntry.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-bold text-ch-ink-2 underline-offset-2 hover:underline">Next to look at<ArrowRight aria-hidden="true" className="size-4" /></Link>}
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0">
          <StatusMark level={v.level} label={v.word} className="text-[14px]" />
          <h1 className="mt-1 text-balance font-ch-display text-ch-title font-bold leading-tight text-ch-ink">{name}</h1>
          <p className="mt-1 text-[15px] text-ch-ink-2">{[entry.agency, entry.recArea, entry.state, `${entry.metrics.sites} sites`].filter(Boolean).join(" · ")}</p>
          {entry.reasons.length > 0 && (
            <ul className="mt-3 grid gap-1 text-[15px] text-ch-ink">
              {entry.reasons.map((r) => <li key={r.code} className="flex gap-2"><span aria-hidden="true" className="text-ch-muted">–</span>{r.text}</li>)}
            </ul>
          )}
          {FIRST_LOOK[entry.id] && (
            <div className="mt-4 max-w-[65ch] rounded-ch-input border border-ch-line bg-ch-shell px-4 py-3">
              <p className="text-[12px] font-bold uppercase tracking-[.06em] text-ch-muted">First look over the aerial photo</p>
              <p className="mt-1 text-[15px] text-ch-ink"><strong className="font-bold">{FIRST_LOOK_WORD[FIRST_LOOK[entry.id].call]}.</strong> {FIRST_LOOK[entry.id].note}</p>
              <p className="mt-1 text-[12.5px] text-ch-muted">By the session that built the sample, 2026-10-07. One look; your decision is separate.</p>
            </div>
          )}
        </div>

        {/* Beside the header from lg; on a phone it follows the photo, so the evidence comes first. */}
        <div className="hidden lg:block"><DecisionBox entry={entry} decision={decision} decide={decide} /></div>
      </div>

      <Panel id="aerial-h" title="Against the aerial photo" className="mt-5">
        {state === "ready" && map ? <AerialCheck map={map} name={name} /> : <Pending state={state} />}
      </Panel>
      <div className="mt-4 lg:hidden"><DecisionBox entry={entry} decision={decision} decide={decide} /></div>

      <Panel id="checks-h" title="The automatic checks" className="mt-4" pad={false}>
        <Checks checks={entry.checks} />
      </Panel>

      <div className="mt-4">
        <h2 className="font-ch-display text-[20px] font-bold text-ch-ink">What campers would see</h2>
        <p className="mt-0.5 text-[14px] text-ch-ink-2">The campground page’s site map, drawn from this data.</p>
        {state === "ready" && map ? (
          <SiteMap map={map} name={name} provider="Recreation.gov" picked={null} openIds={[]} selectedId={null} onSelect={() => {}} note="No night is picked here, so every site is a plain dot." />
        ) : <div className="mt-3"><Pending state={state} /></div>}
      </div>

      <Panel id="sources-h" title="Where each layer came from" className="mt-4">
        <Sources entry={entry} />
      </Panel>
    </>
  );
}

function DecisionBox({ entry, decision, decide }: { entry: SampleEntry; decision?: Decision; decide: (id: string, d: Decision | null) => void }) {
  return (
    <section aria-label="Your decision" className="rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-card">
      {entry.verdict === "ready" && !decision ? (
        <p className="text-[14.5px] leading-snug text-ch-ink-2">Every check passed, so this map would go live on its own. You can still keep it hidden.</p>
      ) : !decision ? (
        <p className="text-[14.5px] leading-snug text-ch-ink-2">Compare the sites with the aerial photo. Approve the map if they sit on real pads along real roads.</p>
      ) : (
        <DecisionNote decision={decision} />
      )}
      <div className="mt-3 grid gap-2">
        {decision ? (
          <button type="button" onClick={() => decide(entry.id, null)} className={buttonClasses({ variant: "quiet", size: "sm", fullWidth: true })}><RotateCcw aria-hidden="true" className="size-4" />Undo</button>
        ) : (
          <>
            {entry.verdict !== "not-drawn" && <button type="button" onClick={() => decide(entry.id, "approved")} className={buttonClasses({ variant: "ink", size: "sm", fullWidth: true })}><Check aria-hidden="true" className="size-4" />Approve map</button>}
            <button type="button" onClick={() => decide(entry.id, "hidden")} className={buttonClasses({ variant: "quiet", size: "sm", fullWidth: true })}><EyeOff aria-hidden="true" className="size-4" />Keep it hidden</button>
          </>
        )}
      </div>
      <p className="mt-3 text-[12.5px] leading-snug text-ch-muted">Lab: decisions are saved in this browser only.</p>
    </section>
  );
}

function Panel({ id, title, className, pad = true, children }: { id: string; title: string; className?: string; pad?: boolean; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={cx("rounded-ch-card border border-ch-line bg-ch-card shadow-ch-card", className)}>
      <div className="border-b border-ch-line px-4 py-3 sm:px-5"><h2 id={id} className="font-ch-display text-ch-h font-bold text-ch-ink">{title}</h2></div>
      <div className={pad ? "p-4 sm:p-5" : ""}>{children}</div>
    </section>
  );
}

function Pending({ state }: { state: "loading" | "ready" | "error" }) {
  return (
    <p role={state === "error" ? "alert" : "status"} className="rounded-ch-input bg-ch-shell px-4 py-6 text-center text-[14.5px] text-ch-ink-2">
      {state === "error" ? "This map’s file didn’t load. Reload the page to try again." : "Loading the map…"}
    </p>
  );
}

const RESULT: Record<QaCheck["result"], ReactNode> = {
  pass: <StatusMark level="ok" label="Passes" className="text-[13.5px]" />,
  review: <StatusMark level="warn" label="Needs a look" className="text-[13.5px]" />,
  fail: <StatusMark level="fail" label="Can’t be drawn" className="text-[13.5px]" />,
  none: <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13.5px] font-bold text-ch-muted"><span aria-hidden="true" className="inline-block w-4 text-center">–</span>Nothing to check</span>,
};

function Checks({ checks }: { checks: QaCheck[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[14px]">
        <thead className="text-[12px] font-bold uppercase tracking-[.06em] text-ch-muted">
          <tr className="border-b border-ch-line">
            <th scope="col" className="px-4 py-2.5 font-bold sm:px-5">Check</th>
            <th scope="col" className="px-3 py-2.5 font-bold">Measured</th>
            <th scope="col" className="px-3 py-2.5 font-bold">Limit</th>
            <th scope="col" className="px-4 py-2.5 font-bold sm:px-5">Result</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.code} className="border-b border-ch-line last:border-b-0">
              <th scope="row" className="px-4 py-3 font-semibold text-ch-ink sm:px-5">{c.label}</th>
              <td className="px-3 py-3 tabular-nums text-ch-ink">{c.value}</td>
              <td className="px-3 py-3 text-ch-ink-2">{c.limit}</td>
              <td className="px-4 py-3 sm:px-5">{RESULT[c.result]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ROAD_SOURCE: Record<SampleEntry["sources"]["roads"], string> = {
  nps: "National Park Service GIS",
  osm: "OpenStreetMap",
  usfs: "Forest Service system roads",
  none: "None: no source had roads here",
};
const WATER_SOURCE: Record<SampleEntry["sources"]["water"], string> = {
  usgs: "USGS hydrography",
  osm: "OpenStreetMap (USGS didn’t answer)",
  none: "Not fetched",
};

function Sources({ entry }: { entry: SampleEntry }) {
  const rows: [string, ReactNode][] = [
    ["Sites", "Recreation.gov’s published points (RIDB, CC BY 4.0)"],
    ["Roads", ROAD_SOURCE[entry.sources.roads]],
    ["Lakes and rivers", WATER_SOURCE[entry.sources.water]],
    ["Aerial photo", "USDA NAIP, via USGS The National Map (public domain). For checking only; never drawn on a camper’s map."],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[180px_minmax(0,1fr)]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-bold text-ch-ink">{k}</dt>
          <dd className="text-ch-ink-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
