"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Eye, EyeOff, PenLine, RotateCcw, Route } from "lucide-react";
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
import { TraceTool } from "./TraceTool";
import { useSavedTraceIds, useTraceDraft } from "./useTraceDraft";
import { withDraft } from "../maps/trace";

// Site maps: the queue where CampHawk's automatically drawn campground maps wait for a person
// (a lab mock of a CampHawk admin section). The evidence is the interface: every verdict says
// its reasons in words, every check shows its measurement against its limit, and every map can
// be laid over the aerial photo of the same ground. Decisions are kept in this browser only.

const ORDER: Verdict[] = ["review", "not-drawn", "ready"];
const FILTERS = [["all", "All"], ["review", "Needs a look"], ["not-drawn", "Can’t be drawn"], ["ready", "Ready"]] as const;
type Filter = (typeof FILTERS)[number][0];
type Decision = "approved" | "roads" | "hidden";

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

// The queue's order: maps that need a look first, and among them the ones a first look found fine
// (a quick approval) ahead of the ones that need work.
const LOOK_ORDER = ["good", "usable", "unsure", "hold"];
const sorted = [...SAMPLE.entries].sort((a, b) =>
  ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict)
  || LOOK_ORDER.indexOf(FIRST_LOOK[a.id]?.call ?? "hold") - LOOK_ORDER.indexOf(FIRST_LOOK[b.id]?.call ?? "hold")
  || tidyCase(a.name).localeCompare(tidyCase(b.name)));
const lookCount = (v: Verdict, call: FirstLook) => SAMPLE.entries.filter((e) => e.verdict === v && FIRST_LOOK[e.id]?.call === call).length;
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
  const raw = params.get("show");
  const filter: Filter = FILTERS.some(([v]) => v === raw) ? (raw as Filter) : "all";
  // The native History API syncs with useSearchParams (Next's SPA guide): the filter changes at
  // once, with no server round trip, and a filter is not a new page.
  const setFilter = (f: Filter) => window.history.replaceState(null, "", f === "all" ? home : `${home}?show=${f}`);
  const [decisions] = useDecisions();
  const localTraces = useSavedTraceIds();
  const { summary, population, entries } = SAMPLE;
  const n = entries.length;
  const [lo, hi] = wilson(summary.ready, n);
  const multi = population.multiSite.campgrounds;
  const shown = sorted.filter((e) => filter === "all" || e.verdict === filter);
  const reasons = reasonCounts(entries);
  const notReady = n - summary.ready;
  const decided = Object.keys(decisions).filter((k) => entries.some((e) => e.id === k && e.verdict !== "ready")).length;
  // Maps held for nothing but their traced roads: one approval each.
  const onlyTraced = entries.filter((e) => e.verdict === "review" && e.reasons.every((r) => r.code === "traced")).length;

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-balance font-ch-display text-ch-title font-bold leading-tight text-ch-ink">Site maps</h1>
          <p className="mt-1 max-w-[70ch] text-[15px] leading-relaxed text-ch-ink-2">
            {n} Recreation.gov campgrounds, drawn at random from the {fmt(multi)} with two or more sites, built from public data and checked automatically. A map goes live on its own only when every check passes; the rest wait here for a person and the aerial photo, where roads no public source has can be traced.
          </p>
        </div>
      </div>

      {/* The headline, then the other two answers, then the campgrounds that need no map. */}
      <section aria-label="Results" className="grid grid-cols-2 gap-3 lg:grid-cols-[1.35fr_1fr_1fr_1.2fr]">
        <div className="col-span-2 rounded-ch-card bg-ch-forest p-5 text-ch-white shadow-ch-card lg:col-span-1">
          <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-ch-white/85"><CircleCheck aria-hidden="true" className="size-4" />Ready on their own</p>
          <p className="mt-2 font-ch-display text-[40px] font-extrabold leading-none tabular-nums">{summary.ready}<span className="text-[22px] font-bold text-ch-white/80"> of {n}</span></p>
          <p className="mt-2.5 text-[14px] font-bold leading-snug">{[`${lookCount("ready", "good")} good`, `${lookCount("ready", "usable")} with roads missing`, lookCount("ready", "unsure") && `${lookCount("ready", "unsure")} unclear`].filter(Boolean).join(" · ")}</p>
          <p className="mt-1 text-[13px] leading-snug text-ch-white/80">On the aerial photo. Across all {fmt(multi)}: likely {lo}–{hi}%.</p>
        </div>
        <Tile verdict="review" count={summary.review} n={n} note={[onlyTraced && `${onlyTraced} only need their traced roads approved.`, decided ? `${decided} decided so far.` : "Each waits for a person and the aerial photo."].filter(Boolean).join(" ")} />
        <Tile verdict="not-drawn" count={summary.notDrawn} n={n} note="Shown as “not drawn yet” on the campground page" />
        <div className="col-span-2 rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-card sm:p-5 lg:col-span-1">
          <p className="text-[13.5px] font-bold text-ch-ink-2">No map needed</p>
          <p className="mt-2 font-ch-display text-[32px] font-extrabold leading-none tabular-nums text-ch-ink">{fmt(population.singleUnit.campgrounds)}</p>
          <p className="mt-2 text-[14px] leading-snug text-ch-ink-2">of the {fmt(population.campgrounds)} campgrounds are a single cabin, lookout or group site. Counted, not sampled.</p>
        </div>
      </section>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-ch-display text-[20px] font-bold text-ch-ink">The {n} maps</h2>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {FILTERS.map(([v, label]) => {
            const count = v === "all" ? n : entries.filter((e) => e.verdict === v).length;
            if (!count && filter !== v) return null; // a filter that shows nothing isn't offered
            const on = filter === v;
            return (
              <button key={v} type="button" aria-pressed={on} onClick={() => setFilter(v)}
                className={cx("inline-flex min-h-11 items-center gap-1.5 rounded-ch-chip border px-3.5 text-[13.5px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green", on ? "border-ch-ink bg-ch-ink text-ch-white" : "border-ch-line bg-ch-card text-ch-ink-2 hover:border-ch-muted")}>
                {label}<span className={cx("tabular-nums", on ? "text-ch-white/80" : "text-ch-muted")}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {shown.length ? (
        <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((e) => <Card key={e.id} entry={e} home={home} decision={decisions[e.id]} traced={localTraces.has(e.id)} />)}
        </ul>
      ) : (
        <p className="mt-3 rounded-ch-card border border-dashed border-ch-line bg-ch-card px-5 py-8 text-center text-[15px] text-ch-ink-2">No maps in this group.</p>
      )}

      <h2 className="mt-10 font-ch-display text-[20px] font-bold text-ch-ink">How the check did</h2>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
      <CrossCheck />
      {notReady > 0 && (
        <section aria-labelledby="why-h" className="rounded-ch-card border border-ch-line bg-ch-card shadow-ch-card">
          <div className="border-b border-ch-line px-4 py-3 sm:px-5">
            <h3 id="why-h" className="font-ch-display text-ch-h font-bold text-ch-ink">Why maps need a look</h3>
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

      <p className="mt-8 max-w-[80ch] text-[13px] leading-relaxed text-ch-ink-2">
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
  // Held maps a first look found usable: some only because roads were traced from the photo.
  const held = SAMPLE.entries.filter((e) => e.verdict === "review" && ["good", "usable"].includes(FIRST_LOOK[e.id]?.call ?? ""));
  const heldTraced = held.filter((e) => e.reasons.some((r) => r.code === "traced")).length;
  return (
    <section aria-labelledby="cross-h" className="rounded-ch-card border border-ch-line bg-ch-card shadow-ch-card">
      <div className="border-b border-ch-line px-4 py-3 sm:px-5">
        <h3 id="cross-h" className="font-ch-display text-ch-h font-bold text-ch-ink">Did the check get it right?</h3>
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
        {passedBad === 0 ? "No map it passed looked unusable." : `${passedBad} map${passedBad === 1 ? "" : "s"} it passed looked unusable.`} {rows[0].counts[1]} of the {rows[0].n} it passed are missing some roads. {held.length} of the {rows[1].n} it held are usable on the photo{heldTraced ? `, ${heldTraced} of them with roads traced from it` : ""}, which makes <strong className="font-bold text-ch-ink">{rows[0].n - passedBad + held.length} of {SAMPLE.entries.length} ready to go live after one look</strong>.
      </p>
    </section>
  );
}

function Tile({ verdict, count, n, note }: { verdict: Verdict; count: number; n: number; note: string }) {
  const v = VERDICT[verdict];
  return (
    <div className="rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-card sm:p-5">
      <StatusMark level={v.level} label={v.word} className="whitespace-normal text-[13.5px]" />
      <p className="mt-2 font-ch-display text-[32px] font-extrabold leading-none tabular-nums text-ch-ink">{count}<span className="text-[18px] font-bold text-ch-muted"> of {n}</span></p>
      <p className="mt-2 text-[14px] leading-snug text-ch-ink-2">{note}</p>
    </div>
  );
}

function Card({ entry: e, home, decision, traced }: { entry: SampleEntry; home: string; decision?: Decision; traced?: boolean }) {
  const v = VERDICT[e.verdict];
  const name = tidyCase(e.name);
  return (
    <li className="group relative flex overflow-hidden rounded-ch-card border border-ch-line bg-ch-card shadow-ch-card transition-colors focus-within:border-ch-ink hover:border-ch-muted sm:flex-col">
      {/* The box keeps its shape whatever the campground's (square in a phone's row, 4:3 on a
          card); the drawing fits inside it. */}
      <div className="relative aspect-square w-28 shrink-0 border-r border-ch-line bg-ch-shell sm:aspect-[4/3] sm:w-auto sm:border-b sm:border-r-0">
        <div className="absolute inset-1.5 sm:inset-2"><MapThumb id={e.id} thumb={e.thumb} label={`${name}: ${e.metrics.placed} sites`} /></div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 sm:gap-1.5 sm:p-4">
        <StatusMark level={v.level} label={v.word} className="text-[13px]" />
        <h3 className="font-ch-display text-[17px] font-bold leading-snug text-ch-ink">
          <Link href={`${home}?id=${e.id}`} className="after:absolute after:inset-0 focus-visible:outline-none group-focus-within:underline">{name}</Link>
        </h3>
        <p className="text-[13.5px] text-ch-muted">{[AGENCY_SHORT[e.agency] ?? e.agency, e.state, `${e.metrics.sites} sites`].filter(Boolean).join(" · ")}</p>
        {e.reasons.length === 0 && <p className="text-[13.5px] leading-snug text-ch-ink-2">All {e.checks.length} checks passed.</p>}
        {e.reasons.length > 0 && (
          <p className="text-[13.5px] leading-snug text-ch-ink-2">{e.reasons[0].text}{e.reasons.length > 1 ? `, and ${e.reasons.length - 1} more reason${e.reasons.length > 2 ? "s" : ""}` : ""}.</p>
        )}
        {FIRST_LOOK[e.id] && <p className="mt-auto pt-1 text-[13px] text-ch-muted">First look: <span className="font-bold text-ch-ink-2">{FIRST_LOOK_WORD[FIRST_LOOK[e.id].call]}</span></p>}
        {decision && <DecisionNote decision={decision} />}
        {traced && <p className="flex items-center gap-1.5 text-[13px] font-bold text-ch-ochre-ink"><PenLine aria-hidden="true" className="size-4" />Your traces, not built yet</p>}
      </div>
    </li>
  );
}

const DECIDED: Record<Decision, { Icon: typeof Check; text: string }> = {
  approved: { Icon: Check, text: "You approved it" },
  roads: { Icon: Route, text: "You sent it for roads to be added" },
  hidden: { Icon: EyeOff, text: "You kept it hidden" },
};

function DecisionNote({ decision, className }: { decision: Decision; className?: string }) {
  const { Icon, text } = DECIDED[decision];
  return (
    <p className={cx("flex items-center gap-1.5 text-[13px] font-bold text-ch-ink", className)}>
      <Icon aria-hidden="true" className="size-4" />{text}
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
  const [draft, setDraft, changed, discard] = useTraceDraft(id, map);
  // Check the map, or trace what it's missing; ?tool=trace opens the tracing tool.
  const params = useSearchParams();
  const [tool, setTool] = useState<"check" | "trace">(params.get("tool") === "trace" ? "trace" : "check");
  // What campers would see with the reviewer's traces in place (the same map until they trace).
  const shown = map?.bbox ? withDraft(map, draft) : map;
  const back = <Link href={home} className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-bold text-ch-ink-2 underline-offset-2 hover:underline"><ArrowLeft aria-hidden="true" className="size-4" />All maps</Link>;
  if (!entry) return <>{back}<p className="mt-4 text-[15px] text-ch-ink-2">There’s no map “{id}” in this sample.</p></>;

  const v = VERDICT[entry.verdict];
  const name = tidyCase(entry.name);
  const decision = decisions[entry.id];
  const at = sorted.findIndex((e) => e.id === entry.id);
  const nextEntry = [...sorted.slice(at + 1), ...sorted.slice(0, at)].find((e) => e.verdict !== "ready" && !decisions[e.id]);
  const nextHref = nextEntry ? `${home}?id=${nextEntry.id}` : null;
  const look = FIRST_LOOK[entry.id];
  // "Trace the missing roads" opens the tool and brings the photo into view.
  const openTrace = () => { setTool("trace"); requestAnimationFrame(() => document.getElementById("aerial-h")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })); };
  const decisionBox = <DecisionBox entry={entry} decision={decision} decide={decide} nextHref={nextHref} onTrace={map?.bbox ? openTrace : undefined} traceChanged={changed} />;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {back}
        {nextHref && <Link href={nextHref} className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-bold text-ch-ink-2 underline-offset-2 hover:underline">Next to look at<ArrowRight aria-hidden="true" className="size-4" /></Link>}
      </div>

      {/* The work on the left; from lg the first look and the decision ride along on the right, so
          the buttons are in reach while the photo and the checks scroll. On a phone the decision
          follows the photo, so the evidence comes first. */}
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="min-w-0">
          <StatusMark level={v.level} label={v.word} className="text-[14px]" />
          <h1 className="mt-1 text-balance font-ch-display text-ch-title font-bold leading-tight text-ch-ink">{name}</h1>
          <p className="mt-1 text-[15px] text-ch-ink-2">{[entry.agency, entry.recArea, entry.state, `${entry.metrics.sites} sites`].filter(Boolean).join(" · ")}</p>
          {entry.reasons.length > 0 && (
            <ul className="mt-3 grid list-disc gap-1 pl-5 text-[15px] text-ch-ink marker:text-ch-muted">
              {entry.reasons.map((r) => <li key={r.code}>{r.text}</li>)}
            </ul>
          )}
          {look && <div className="mt-4 lg:hidden"><FirstLookNote id={entry.id} /></div>}

          <Panel id="aerial-h" title="Against the aerial photo" className="mt-5">
            {state === "ready" && map && shown ? (
              <>
                {map.bbox && (
                  <div role="group" aria-label="What to do with the photo" className="mb-4 flex flex-wrap gap-1.5">
                    <ModePill on={tool === "check"} onClick={() => setTool("check")}><Eye aria-hidden="true" className="size-4" />Check the map</ModePill>
                    <ModePill on={tool === "trace"} onClick={() => setTool("trace")}><PenLine aria-hidden="true" className="size-4" />Trace what’s missing</ModePill>
                  </div>
                )}
                {tool === "trace" && map.bbox
                  ? <TraceTool map={{ ...map, bbox: map.bbox }} mapKey={`ridb-${entry.id}`} name={name} draft={draft} setDraft={setDraft} changed={changed} discard={discard} />
                  : <AerialCheck map={shown} name={name} />}
              </>
            ) : <Pending state={state} />}
          </Panel>
          <div className="mt-4 lg:hidden">{decisionBox}</div>

          <Panel id="checks-h" title="The automatic checks" className="mt-4" pad={false}>
            <Checks checks={entry.checks} />
          </Panel>

          <div className="mt-6">
            <h2 className="font-ch-display text-[20px] font-bold text-ch-ink">What campers would see</h2>
            <p className="mt-0.5 text-[14px] text-ch-ink-2">{changed ? "With your traces in place. They aren’t built yet, so the checks above don’t include them." : "The campground page’s site map, drawn from this data."}</p>
            {state === "ready" && shown ? (
              <SiteMap map={shown} name={name} provider="Recreation.gov" picked={null} openIds={[]} selectedId={null} onSelect={() => {}} note="No night is picked here, so every site is a plain dot." />
            ) : <div className="mt-3"><Pending state={state} /></div>}
          </div>

          <Panel id="sources-h" title="Where each layer came from" className="mt-4">
            <Sources entry={entry} map={map} />
          </Panel>
        </div>

        <aside aria-label="Review" className="hidden gap-4 lg:sticky lg:top-6 lg:grid">
          {look && <FirstLookNote id={entry.id} />}
          <FailingChecks checks={entry.checks} />
          {decisionBox}
        </aside>
      </div>
    </>
  );
}

/** The checks that didn't pass, with their numbers, beside the photo they're judged against. */
function FailingChecks({ checks }: { checks: QaCheck[] }) {
  const failing = byResult(checks).filter((c) => c.result === "review" || c.result === "fail");
  if (!failing.length) return null;
  return (
    <div className="rounded-ch-card border border-ch-ochre-line bg-ch-ochre-soft px-4 py-3.5">
      <p className="text-[13px] font-bold text-ch-ochre-ink">{failing.length === 1 ? "The check that didn’t pass" : `The ${failing.length} checks that didn’t pass`}</p>
      <ul className="mt-1.5 grid gap-2">
        {failing.map((c) => (
          <li key={c.code} className="text-[14px] leading-snug text-ch-ink">
            <span className="font-bold">{c.label}:</span> <span className="tabular-nums">{c.value}</span>
            <span className="block text-[13px] text-ch-ink-2">Limit: {c.limit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FirstLookNote({ id }: { id: string }) {
  const look = FIRST_LOOK[id];
  return (
    <div className="rounded-ch-card bg-ch-shell px-4 py-3.5">
      <p className="text-[13px] font-bold text-ch-ink-2">First look over the aerial photo</p>
      <p className="mt-1 text-[15px] leading-snug text-ch-ink"><strong className="font-bold">{FIRST_LOOK_WORD[look.call]}.</strong> {look.note}</p>
      <p className="mt-1.5 text-[13px] leading-snug text-ch-ink-2">By the session that built the sample, Oct 7, 2026. One look; your decision is separate.</p>
    </div>
  );
}

/** What a reviewer does with a map. The firm (ink) button follows the evidence: approve when the
    first look found nothing wrong, otherwise the outcome the first look points to. */
function DecisionBox({ entry, decision, decide, nextHref, onTrace, traceChanged }: { entry: SampleEntry; decision?: Decision; decide: (id: string, d: Decision | null) => void; nextHref: string | null; onTrace?: () => void; traceChanged?: boolean }) {
  const traced = entry.reasons.some((r) => r.code === "traced");
  const look = FIRST_LOOK[entry.id]?.call;
  const roadsMissing = entry.reasons.some((r) => r.code === "far-from-roads" || r.code === "no-roads");
  const primary: Decision = look === "hold" ? (roadsMissing && !entry.reasons.some((r) => r.code === "spread") ? "roads" : "hidden") : "approved";
  const OPTIONS: { d: Decision; label: string; Icon: typeof Check; show: boolean }[] = [
    { d: "approved", label: "Approve map", Icon: Check, show: entry.verdict !== "not-drawn" },
    { d: "roads", label: "Needs roads added", Icon: Route, show: entry.verdict !== "ready" },
    { d: "hidden", label: "Keep it hidden", Icon: EyeOff, show: true },
  ];
  const shown = OPTIONS.filter((o) => o.show).sort((a, b) => Number(b.d === primary) - Number(a.d === primary));
  return (
    <section aria-label="Your decision" className="rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-card">
      {traceChanged && !decision && (
        <p className="mb-3 flex gap-1.5 rounded-ch-input border border-ch-ochre-line bg-ch-ochre-soft px-3 py-2 text-[13.5px] leading-snug text-ch-ink">
          <PenLine aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>Your traces aren’t on this map yet: its checks and verdict are for the map as built. Download the trace file to have it rebuilt, then judge it again.</span>
        </p>
      )}
      {decision ? (
        <DecisionNote decision={decision} />
      ) : traceChanged ? (
        <p className="text-[14.5px] leading-snug text-ch-ink-2">Approving now approves the map without your traces.</p>
      ) : (
        <p className="text-[14.5px] leading-snug text-ch-ink-2">
          {entry.verdict === "ready" ? "Every check passed, so this map would go live on its own. You can still hold it back."
            : primary === "roads" ? "The first look found campground roads missing. Send it for roads, or approve it if the photo says otherwise."
            : primary === "hidden" ? "The first look found this isn’t one campground’s map. Keep it hidden, or approve it if the photo says otherwise."
            : traced ? "Some of its roads were traced from this photo (ochre on the photo). Approve the map if they follow real roads and the sites sit on real pads."
            : "Compare the sites with the aerial photo. Approve the map if they sit on real pads along real roads."}
        </p>
      )}
      <div className="mt-3 grid gap-2">
        {decision ? (
          <>
            {decision === "roads" && onTrace && <button type="button" onClick={onTrace} className={buttonClasses({ variant: "ink", size: "sm", fullWidth: true })}><PenLine aria-hidden="true" className="size-4" />Trace the missing roads</button>}
            {nextHref && <Link href={nextHref} className={buttonClasses({ variant: decision === "roads" && onTrace ? "quiet" : "ink", size: "sm", fullWidth: true })}>Next to look at<ArrowRight aria-hidden="true" className="size-4" /></Link>}
            <button type="button" onClick={() => decide(entry.id, null)} className={buttonClasses({ variant: "quiet", size: "sm", fullWidth: true })}><RotateCcw aria-hidden="true" className="size-4" />Undo</button>
          </>
        ) : shown.map(({ d, label, Icon }) => (
          <button key={d} type="button" onClick={() => decide(entry.id, d)} className={buttonClasses({ variant: d === primary && !traceChanged ? "ink" : "quiet", size: "sm", fullWidth: true })}><Icon aria-hidden="true" className="size-4" />{d === "approved" && traceChanged ? "Approve without my traces" : label}</button>
        ))}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-ch-ink-2">Lab: decisions are saved in this browser only.</p>
    </section>
  );
}

function ModePill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cx("inline-flex min-h-11 items-center gap-1.5 rounded-ch-chip border px-3.5 text-[13.5px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green", on ? "border-ch-ink bg-ch-ink text-ch-white" : "border-ch-line bg-ch-card text-ch-ink-2 hover:border-ch-muted")}>
      {children}
    </button>
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

/** Failing checks first: the reason a map needs a look is the first row the eye reaches. */
const RESULT_ORDER: QaCheck["result"][] = ["fail", "review", "pass", "none"];
const byResult = (checks: QaCheck[]) => [...checks].sort((a, b) => RESULT_ORDER.indexOf(a.result) - RESULT_ORDER.indexOf(b.result));

function Checks({ checks: raw }: { checks: QaCheck[] }) {
  const checks = byResult(raw);
  return (
    <>
      {/* A phone gets a list, so every result stays in view; from sm, a table. */}
      <ul className="divide-y divide-ch-line sm:hidden">
        {checks.map((c) => (
          <li key={c.code} className="grid gap-1 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[14px] font-semibold text-ch-ink">{c.label}</span>
              <span className="shrink-0">{RESULT[c.result]}</span>
            </div>
            <p className="text-[13.5px] tabular-nums text-ch-ink">{c.value}</p>
            <p className="text-[13px] text-ch-ink-2">Limit: {c.limit}</p>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
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
    </>
  );
}

const ROAD_SOURCE: Record<SampleEntry["sources"]["roads"], string> = {
  nps: "National Park Service GIS",
  osm: "OpenStreetMap",
  usfs: "Forest Service system roads",
  tiger: "US Census Bureau TIGER roads",
  none: "None: no source had roads here",
};
const SOURCE_WORD: Partial<Record<SampleEntry["sources"]["roads"], string>> = { nps: "the Park Service", osm: "OpenStreetMap", usfs: "the Forest Service", tiger: "the Census Bureau" };
const SOURCE_SHORT: Record<Exclude<SampleEntry["sources"]["roads"], "none">, string> = { nps: "Park Service", osm: "OpenStreetMap", usfs: "Forest Service", tiger: "Census TIGER" };
const WATER_SOURCE: Record<SampleEntry["sources"]["water"], string> = {
  usgs: "USGS hydrography",
  osm: "OpenStreetMap (USGS didn’t answer)",
  none: "Not fetched",
};

function Sources({ entry, map }: { entry: SampleEntry; map: SiteMapData | null }) {
  const pick = map?.sources?.roadPick;
  const traced = map?.sources?.traced;
  const rows: [string, ReactNode][] = [
    ["Sites", "Recreation.gov’s published points (RIDB, CC BY 4.0)"],
    ["Roads", traced?.replace
      ? <>Traced from the aerial photo, replacing {SOURCE_WORD[entry.sources.roads] ?? "the source"}’s roads<span className="block text-[13.5px] text-ch-ink-2">They were there, but drawn in the wrong places.</span></>
      : <>{ROAD_SOURCE[entry.sources.roads]}{pick && <span className="block text-[13.5px] text-ch-ink-2">{pick.why}.</span>}</>],
    ...(traced && (traced.roads || traced.points) ? [["Traced", <>{`${[traced.roads && `${traced.roads} road${traced.roads === 1 ? "" : "s"}`, traced.points && `${traced.points} point${traced.points === 1 ? "" : "s"}`].filter(Boolean).join(" and ")} from the aerial photo${traced.by ? `, by ${traced.by}` : ""}${traced.on ? `, ${traced.on}` : ""}.`}{traced.note && <span className="block text-[13.5px] text-ch-ink-2">{traced.note}</span>}</>] as [string, ReactNode]] : []),
    ["Lakes and rivers", WATER_SOURCE[entry.sources.water]],
    ["Aerial photo", "USDA NAIP, via USGS The National Map (public domain). For checking and tracing; never drawn on a camper’s map."],
  ];
  const fits = pick ? (Object.keys(SOURCE_SHORT) as (keyof typeof SOURCE_SHORT)[]).map((k) => [k, pick.fits[k] ?? null] as const) : [];
  return (
    <>
      <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[180px_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-bold text-ch-ink">{k}</dt>
            <dd className="text-ch-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
      {fits.length > 0 && (
        <div className="mt-4">
          <p id="fits-cap" className="pb-1.5 text-[13.5px] leading-snug text-ch-ink-2">How far the sites are from each source’s roads. The map uses one source; the closest fit wins unless the usual one is nearly as close.</p>
          <table aria-describedby="fits-cap" className="w-full text-left text-[14px]">
            <thead className="text-[12px] font-bold text-ch-muted">
              <tr className="border-b border-ch-line">
                <th scope="col" className="py-2 pr-2 font-bold">Source</th>
                <th scope="col" className="px-2 py-2 text-right font-bold">Median</th>
                <th scope="col" className="py-2 pl-2 text-right font-bold">9 in 10 within</th>
              </tr>
            </thead>
            <tbody>
              {fits.map(([k, fit]) => (
                <tr key={k} className="border-b border-ch-line last:border-b-0">
                  <th scope="row" className={cx("py-2 pr-2", k === entry.sources.roads ? "font-bold text-ch-ink" : "font-normal text-ch-ink-2")}>
                    <span className="inline-flex items-center gap-1">{SOURCE_SHORT[k]}{k === entry.sources.roads && <><Check aria-hidden="true" className="size-4" /><span className="text-[13px]">used</span></>}</span>
                  </th>
                  {fit ? (
                    <>
                      <td className="px-2 py-2 text-right tabular-nums text-ch-ink">{Math.round(fit.medianM)} m</td>
                      <td className="py-2 pl-2 text-right tabular-nums text-ch-ink">{Math.round(fit.p90M)} m</td>
                    </>
                  ) : <td colSpan={2} className="py-2 pl-2 text-right text-ch-muted">No roads here</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
