"use client";

import { isFirstCome } from "../maps/first-come";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Download, Eye, EyeOff, PenLine, RotateCcw, Route } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import { StatusMark } from "../../ui/StatusMark";
import { CamperMap } from "../AreaMaps";
import type { SiteMapData } from "../maps";
import { tidyCase } from "../maps/name";
import { AGENCY_SHORT, REASON_LABEL, VERDICT, reasonCounts, wilson, type Check as QaCheck, type Verdict } from "../maps/sample";
import { FIRST_LOOK_WORD, type FirstLook } from "../maps/sample-review";
import { LATEST_WAVE, LOOK_LEVEL, SAMPLE_WAVE, WAVES, loadWave, needsDecision, waveLabel, waveOf, type Looks, type Wave, type WaveEntry } from "../maps/waves";
import { AdminFrame } from "./AdminFrame";
import { MapThumb } from "./MapThumb";
import { AerialCheck } from "./AerialCheck";
import { TraceTool } from "./TraceTool";
import { useSavedTraceIds, useTraceDraft } from "./useTraceDraft";
import { withDraft } from "../maps/trace";
import { RECORDED, decisionsFileFor, suggestedDecision, type Decision } from "../maps/decisions";

// Site maps: the queue where CampHawk's automatically drawn campground maps wait for a person
// (a lab mock of a CampHawk admin section). The evidence is the interface: every verdict says
// its reasons in words, every check shows its measurement against its limit, and every map can
// be laid over the aerial photo of the same ground. Maps come in waves (maps/waves.ts): the
// random sample, then waves ordered by demand. Decisions recorded with the maps
// (maps/decisions/) show for everyone; a click here is kept in this browser on top of them, and
// "Download decisions" turns a wave's into the file a session records.

const ORDER: Verdict[] = ["review", "not-drawn", "ready"];
const FILTERS = [["all", "All"], ["review", "Needs a look"], ["not-drawn", "Can’t be drawn"], ["ready", "Ready"]] as const;
type Filter = (typeof FILTERS)[number][0];
/** How many cards show before "Show more": a wave is about 100. */
const PAGE = 48;

/* ---------- decisions: recorded with the maps, then this browser's clicks on top ---------- */

const KEY = "lab-site-map-decisions";
const EVT = "lab-site-map-decisions";
// A click is saved here; "open" reopens a map whose decision is recorded with the maps (Undo).
type Local = Record<string, Decision | "open">;
/** "1 unit" for a single unit (a cabin, lookout or group site), else "N sites". */
const sitesWord = (n: number, kind?: string) => (kind === "firstcome" ? "first-come campground" : n === 1 ? "1 unit" : `${n} sites`);

function readLocal(): Local {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") ?? {}; } catch { return {}; }
}
const RECORDED_ONLY: Record<string, Decision> = Object.fromEntries(Object.entries(RECORDED).map(([id, r]) => [id, r.decision]));
function merge(local: Local): Record<string, Decision> {
  const out = { ...RECORDED_ONLY };
  for (const [id, d] of Object.entries(local)) { if (d === "open") delete out[id]; else out[id] = d; }
  return out;
}
let cache: { raw: string | null; value: Record<string, Decision> } = { raw: null, value: RECORDED_ONLY };
function snapshot() {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { /* storage blocked: only the recorded decisions */ }
  if (raw !== cache.raw) cache = { raw, value: merge(readLocal()) };
  return cache.value;
}
function useDecisions(): [Record<string, Decision>, (id: string, d: Decision | null) => void] {
  const value = useSyncExternalStore(
    (on) => { window.addEventListener(EVT, on); window.addEventListener("storage", on); return () => { window.removeEventListener(EVT, on); window.removeEventListener("storage", on); }; },
    snapshot,
    () => RECORDED_ONLY,
  );
  const set = (id: string, d: Decision | null) => {
    const next = { ...readLocal() };
    const recorded = RECORDED[id]?.decision;
    if (d === recorded) delete next[id];
    else if (d) next[id] = d;
    else if (recorded) next[id] = "open";
    else delete next[id];
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not saved */ }
    window.dispatchEvent(new Event(EVT));
  };
  return [value, set];
}

// The queue's order: maps that need a look first, and among them the ones a first look found fine
// (a quick approval) ahead of the ones that need work.
const LOOK_ORDER = ["good", "usable", "unsure", "hold"];
// First the maps that would go live unless someone decides (every check passed, the first look
// held them or couldn't tell), then the rest that need a decision, then the rest; within each, by
// verdict, then the first look, then name.
const rank = (e: WaveEntry, looks: Looks | null) => !needsDecision(e, looks?.looks[e.id]?.call) ? 2 : e.verdict === "ready" ? 0 : 1;
const sortEntries = (entries: WaveEntry[], looks: Looks | null) => [...entries].sort((a, b) =>
  rank(a, looks) - rank(b, looks)
  || ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict)
  || LOOK_ORDER.indexOf(looks?.looks[a.id]?.call ?? "hold") - LOOK_ORDER.indexOf(looks?.looks[b.id]?.call ?? "hold")
  || tidyCase(a.name).localeCompare(tidyCase(b.name)));
const fmt = (n: number) => n.toLocaleString("en-US");
const dayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const pad2 = (n: number) => String(n).padStart(2, "0");

/** The wave a URL asks for: ?wave=, else the wave of ?id=, else the newest. */
function waveFrom(raw: string | null, id: string | null): number {
  const asked = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
  if (asked !== null && WAVES.some((w) => w.wave === asked)) return asked;
  return (id ? waveOf(id) : null) ?? LATEST_WAVE;
}

function useWave(n: number): { wave: Wave | null; state: "loading" | "ready" | "error" } {
  const [got, setGot] = useState<{ n: number; wave: Wave | null } | null>(null);
  useEffect(() => {
    if (n === 0) return;
    let live = true;
    loadWave(n).then((w) => w, () => null).then((w) => { if (live) setGot({ n, wave: w }); });
    return () => { live = false; };
  }, [n]);
  if (n === 0) return { wave: SAMPLE_WAVE, state: "ready" };
  if (!got || got.n !== n) return { wave: null, state: "loading" };
  return got.wave ? { wave: got.wave, state: "ready" } : { wave: null, state: "error" };
}

export function SiteMaps() {
  const params = useSearchParams();
  const id = params.get("id");
  const n = waveFrom(params.get("wave"), id);
  const home = usePathname() ?? "";
  const { wave, state } = useWave(n);
  return (
    <AdminFrame page="Site maps (admin)" home={home}>
      {wave ? (id ? <Detail wave={wave} id={id} home={home} /> : <Queue wave={wave} home={home} />)
        : <p role={state === "error" ? "alert" : "status"} className="rounded-ch-card border border-ch-line bg-ch-card px-5 py-8 text-center text-[15px] text-ch-ink-2">{state === "error" ? `${waveLabel(n)} didn’t load. Reload the page to try again.` : `Loading ${waveLabel(n).toLowerCase()}…`}</p>}
    </AdminFrame>
  );
}

/* ---------- the queue ---------- */

const LOOK_FILTERS: [string, string][] = [["", "Any"], ["good", "Good"], ["usable", "Roads incomplete"], ["hold", "Not usable"], ["unsure", "Can’t tell"], ["none", "Not looked at yet"]];
const DECIDED_FILTERS: [string, string][] = [["", "Any"], ["no", "Not decided"], ["yes", "Decided"]];
const field = "min-h-11 w-full min-w-0 cursor-pointer rounded-ch-input border border-ch-line bg-ch-card px-3 text-[14px] text-ch-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green";

function Queue({ wave, home }: { wave: Wave; home: string }) {
  const params = useSearchParams();
  const n = wave.info.wave;
  const raw = params.get("show");
  const filter: Filter = FILTERS.some(([v]) => v === raw) ? (raw as Filter) : "all";
  const look = params.get("look") ?? "", agency = params.get("agency") ?? "", state = params.get("state") ?? "", decidedF = params.get("decided") ?? "", tracedF = params.get("traced") === "1";
  // The native History API syncs with useSearchParams (Next's SPA guide): a filter changes at
  // once, with no server round trip, and a filter is not a new page. The wave stays in the URL.
  const setParam = (changes: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    q.delete("id");
    q.set("wave", String(n));
    for (const [k, v] of Object.entries(changes)) { if (v) q.set(k, v); else q.delete(k); }
    window.history.replaceState(null, "", `${home}?${q}`);
  };
  const [decisions] = useDecisions();
  const localTraces = useSavedTraceIds();
  const { entries, population, looks, info, random } = wave;
  const N = entries.length;
  const summary = { ready: entries.filter((e) => e.verdict === "ready").length, review: entries.filter((e) => e.verdict === "review").length, notDrawn: entries.filter((e) => e.verdict === "not-drawn").length };
  const [lo, hi] = wilson(summary.ready, N);
  const multi = population.multiSite.campgrounds;
  const sorted = useMemo(() => sortEntries(entries, looks), [entries, looks]);
  const hasTraces = (e: WaveEntry) => e.reasons.some((r) => r.code === "traced") || localTraces.has(e.id);
  const shown = sorted.filter((e) =>
    (filter === "all" || e.verdict === filter)
    && (!look || (look === "none" ? !looks?.looks[e.id] : looks?.looks[e.id]?.call === look))
    && (!agency || e.agency === agency)
    && (!state || e.state === state)
    && (!tracedF || hasTraces(e))
    && (!decidedF || (decidedF === "yes") === Boolean(decisions[e.id])));
  const [limit, setLimit] = useState(PAGE);
  const filterKey = [n, filter, look, agency, state, decidedF, tracedF].join("|");
  const [lastKey, setLastKey] = useState(filterKey);
  if (lastKey !== filterKey) { setLastKey(filterKey); setLimit(PAGE); }
  const reasons = reasonCounts(entries);
  const notReady = N - summary.ready;
  const decidedHere = entries.filter((e) => decisions[e.id]).length;
  const decided = entries.filter((e) => e.verdict !== "ready" && decisions[e.id]).length;
  // Maps held for nothing but their traced roads: one approval each.
  const onlyTraced = entries.filter((e) => e.verdict === "review" && e.reasons.every((r) => r.code === "traced")).length;
  const agencies = [...new Set(entries.map((e) => e.agency))].sort();
  const states = [...new Set(entries.map((e) => e.state).filter(Boolean))].sort();
  const callCount = (call: FirstLook) => entries.filter((e) => looks?.looks[e.id]?.call === call).length;
  const usable = callCount("good") + callCount("usable");
  const toDecide = entries.filter((e) => needsDecision(e, looks?.looks[e.id]?.call));
  const decidedOfThose = toDecide.filter((e) => decisions[e.id]).length;
  const flaggedReady = toDecide.filter((e) => e.verdict === "ready").length;
  const lookCount = (v: Verdict, call: FirstLook) => entries.filter((e) => e.verdict === v && looks?.looks[e.id]?.call === call).length;
  const extraFilters = [look, agency, state, decidedF, tracedF ? "1" : ""].filter(Boolean).length;

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-balance font-ch-display text-ch-title font-bold leading-tight text-ch-ink">Site maps</h1>
          <p className="mt-1 max-w-[70ch] text-[15px] leading-relaxed text-ch-ink-2">
            {random
              ? <>{N} Recreation.gov campgrounds, drawn at random from the {fmt(multi)} with two or more sites, built from public data and checked automatically.</>
              : <>{N} Recreation.gov campgrounds picked by CampHawk demand: the ones its users watch, then the most-booked of each agency (Recreation.gov’s overnight reservations, fiscal 2025). Built from public data and checked automatically.</>}
            {" "}A map goes live on its own only when every check passes; the rest wait here for a person and the aerial photo, where roads no public source has can be traced.
          </p>
        </div>
        {WAVES.length > 1 && (
          <label className="grid shrink-0 gap-1 text-[13px] font-bold text-ch-ink-2">
            Wave
            <select value={n} onChange={(ev) => { const q = new URLSearchParams({ wave: ev.target.value }); window.history.replaceState(null, "", `${home}?${q}`); }} className={cx(field, "sm:w-60")}>
              {WAVES.map((w) => <option key={w.wave} value={w.wave}>{`${waveLabel(w.wave)}: ${w.count} campgrounds`}</option>)}
            </select>
          </label>
        )}
      </div>

      {/* The headline, then the other two answers, then the campgrounds that need no map. */}
      <section aria-label="Results" className="grid grid-cols-2 gap-3 lg:grid-cols-[1.35fr_1fr_1fr_1.2fr]">
        <div className="col-span-2 rounded-ch-card bg-ch-forest p-5 text-ch-white shadow-ch-card lg:col-span-1">
          {looks && !random ? (
            <>
              {/* A demand-ordered wave: what the photo says is the headline; the check is the detail. */}
              <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-ch-white/85"><CircleCheck aria-hidden="true" className="size-4" />Usable after one look</p>
              <p className="mt-2 font-ch-display text-[40px] font-extrabold leading-none tabular-nums">{usable}<span className="text-[22px] font-bold text-ch-white/80"> of {N}</span></p>
              <p className="mt-2.5 text-[14px] font-bold leading-snug">{[`${callCount("good")} good`, `${callCount("usable")} with roads missing`, `${callCount("hold")} not usable`, callCount("unsure") && `${callCount("unsure")} can’t tell`].filter(Boolean).join(" · ")}</p>
              <p className="mt-1 text-[13px] leading-snug text-ch-white/80">On the aerial photo. {summary.ready} passed every check on their own. Picked by demand, not at random: these numbers describe this wave only.</p>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-ch-white/85"><CircleCheck aria-hidden="true" className="size-4" />Ready on their own</p>
              <p className="mt-2 font-ch-display text-[40px] font-extrabold leading-none tabular-nums">{summary.ready}<span className="text-[22px] font-bold text-ch-white/80"> of {N}</span></p>
              {looks && <p className="mt-2.5 text-[14px] font-bold leading-snug">{[`${lookCount("ready", "good")} good`, `${lookCount("ready", "usable")} with roads missing`, lookCount("ready", "unsure") && `${lookCount("ready", "unsure")} unclear`, lookCount("ready", "hold") && `${lookCount("ready", "hold")} not usable`].filter(Boolean).join(" · ")}</p>}
              <p className="mt-1 text-[13px] leading-snug text-ch-white/80">
                {random ? <>On the aerial photo. Across all {fmt(multi)}: likely {lo}–{hi}%.</> : <>Picked by demand, not at random: these numbers describe this wave only.</>}
              </p>
            </>
          )}
        </div>
        {looks ? (
          <div className="rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-card sm:p-5">
            <StatusMark level="warn" label="To decide" className="text-[13.5px]" />
            <p className="mt-2 font-ch-display text-[32px] font-extrabold leading-none tabular-nums text-ch-ink">{toDecide.length}<span className="text-[18px] font-bold text-ch-muted"> of {N}</span></p>
            <p className="mt-2 text-[14px] leading-snug text-ch-ink-2">{[`${summary.review} the check held${flaggedReady ? `, and ${flaggedReady} the first look held though every check passed (listed first).` : "."}`, onlyTraced && `${onlyTraced} only need their traced roads approved.`, `${decidedOfThose} decided.`].filter(Boolean).join(" ")}</p>
          </div>
        ) : <Tile verdict="review" count={summary.review} n={N} note={[onlyTraced && `${onlyTraced} only need their traced roads approved.`, decided ? `${decided} decided so far.` : "Each waits for a person and the aerial photo."].filter(Boolean).join(" ")} />}
        <Tile verdict="not-drawn" count={summary.notDrawn} n={N} note="Shown as “not drawn yet” on the campground page" />
        <div className="col-span-2 rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-card sm:p-5 lg:col-span-1">
          <p className="text-[13.5px] font-bold text-ch-ink-2">No map needed</p>
          <p className="mt-2 font-ch-display text-[32px] font-extrabold leading-none tabular-nums text-ch-ink">{fmt(population.singleUnit.campgrounds)}</p>
          <p className="mt-2 text-[14px] leading-snug text-ch-ink-2">of the {fmt(population.campgrounds)} campgrounds are a single cabin, lookout or group site. Counted, not sampled.</p>
        </div>
      </section>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-ch-display text-[20px] font-bold text-ch-ink">The {N} maps</h2>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {FILTERS.map(([v, label]) => {
            const count = v === "all" ? N : entries.filter((e) => e.verdict === v).length;
            if (!count && filter !== v) return null; // a filter that shows nothing isn't offered
            const on = filter === v;
            return (
              <button key={v} type="button" aria-pressed={on} onClick={() => setParam({ show: v === "all" ? null : v })}
                className={cx("inline-flex min-h-11 items-center gap-1.5 rounded-ch-chip border px-3.5 text-[13.5px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green", on ? "border-ch-ink bg-ch-ink text-ch-white" : "border-ch-line bg-ch-card text-ch-ink-2 hover:border-ch-muted")}>
                {label}<span className={cx("tabular-nums", on ? "text-ch-white/80" : "text-ch-muted")}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Narrow the wave down; every choice is in the URL, so a filtered list can be sent as a link. */}
      <div role="group" aria-label="Narrow the list" className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-ch-card border border-ch-line bg-ch-card p-3 shadow-ch-card sm:grid-cols-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
        <Select label="First look" value={look} options={LOOK_FILTERS} onChange={(v) => setParam({ look: v })} />
        <Select label="Agency" value={agency} options={[["", "Any"], ...agencies.map((a) => [a, AGENCY_SHORT[a] ?? a] as [string, string])]} onChange={(v) => setParam({ agency: v })} />
        <Select label="State" value={state} options={[["", "Any"], ...states.map((s) => [s, s] as [string, string])]} onChange={(v) => setParam({ state: v })} />
        <Select label="Decision" value={decidedF} options={DECIDED_FILTERS} onChange={(v) => setParam({ decided: v })} />
        <label className="col-span-2 flex min-h-11 cursor-pointer items-center gap-2 text-[14px] font-bold text-ch-ink sm:col-span-1">
          <input type="checkbox" checked={tracedF} onChange={(ev) => setParam({ traced: ev.target.checked ? "1" : null })} className="size-5 accent-ch-ink" />
          With traced roads
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13.5px] text-ch-ink-2">
        <p role="status">{shown.length === N ? `All ${N} maps.` : `${shown.length} of ${N} maps match.`}{looks ? ` ${decidedOfThose} of the ${toDecide.length} to decide are decided${decidedHere ? "; download them below the list when you’re done" : ""}.` : ""}</p>
        {extraFilters > 0 && <button type="button" onClick={() => setParam({ look: null, agency: null, state: null, decided: null, traced: null })} className="inline-flex min-h-11 items-center font-bold text-ch-ink underline underline-offset-2">Clear {extraFilters === 1 ? "the filter" : `${extraFilters} filters`}</button>}
      </div>

      {shown.length ? (
        <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {shown.slice(0, limit).map((e) => <Card key={e.id} entry={e} wave={n} looks={looks} home={home} decision={decisions[e.id]} traced={localTraces.has(e.id)} />)}
        </ul>
      ) : (
        <p className="mt-3 rounded-ch-card border border-dashed border-ch-line bg-ch-card px-5 py-8 text-center text-[15px] text-ch-ink-2">No maps match.</p>
      )}
      {shown.length > limit && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} className={buttonClasses({ variant: "quiet", size: "sm" })}>Show {Math.min(PAGE, shown.length - limit)} more ({shown.length - limit} not shown)</button>
        </div>
      )}

      <DownloadDecisions wave={n} ids={[...entries.map((e) => e.id), ...wave.failed.map((f) => f.id)]} decisions={decisions} count={decidedHere} />

      {wave.failed.length > 0 && (
        <section aria-labelledby="failed-h" className="mt-6 rounded-ch-card border border-ch-line bg-ch-card shadow-ch-card">
          <div className="border-b border-ch-line px-4 py-3 sm:px-5">
            <h2 id="failed-h" className="font-ch-display text-ch-h font-bold text-ch-ink">Didn’t build ({wave.failed.length})</h2>
            <p className="text-[13.5px] text-ch-muted">A source didn’t answer. These show “not drawn yet” until a rebuild works.</p>
          </div>
          <ol className="divide-y divide-ch-line">
            {wave.failed.map((f) => (
              <li key={f.id} className="px-4 py-3 sm:px-5">
                <p className="text-[14.5px] font-bold text-ch-ink">{tidyCase(f.name)} <span className="font-normal text-ch-muted">· {[AGENCY_SHORT[f.agency] ?? f.agency, f.state].filter(Boolean).join(" · ")}</span></p>
                <p className="mt-0.5 break-words text-[13px] text-ch-ink-2">{f.error}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <h2 className="mt-10 font-ch-display text-[20px] font-bold text-ch-ink">How the check did</h2>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
      <CrossCheck entries={entries} looks={looks} />
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
        {random
          ? <>Drawn {info.built} from the {info.export} ({info.order.toLowerCase()}). The range is a 95% interval for {N} draws. Build: <code className="font-mono text-[12px]">studio/campground-maps/build-sample.mjs</code>.</>
          : <>Built {info.built} from the {info.export}. Order: {info.order}. Build: <code className="font-mono text-[12px]">studio/campground-maps/build-wave.mjs</code>.</>}
      </p>
    </>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className="grid min-w-0 gap-1 text-[13px] font-bold text-ch-ink-2">
      {label}
      <select value={value} onChange={(ev) => onChange(ev.target.value)} className={field}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/** Saves this wave's decisions as the file a session records with the maps (maps/decisions/). */
function DownloadDecisions({ wave, ids, decisions, count }: { wave: number; ids: string[]; decisions: Record<string, Decision>; count: number }) {
  const [problems, setProblems] = useState<string[]>([]);
  if (!count) return null;
  const save = () => {
    const today = new Date().toISOString().slice(0, 10);
    const { file, problems: p } = decisionsFileFor(wave, ids, decisions, today);
    setProblems(p);
    if (p.length) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 1) + "\n"], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `wave-${pad2(wave)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section aria-labelledby="dl-h" className="mt-6 flex flex-col gap-3 rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <h2 id="dl-h" className="font-ch-display text-ch-h font-bold text-ch-ink">Your decisions on this wave</h2>
        <p className="text-[14px] leading-snug text-ch-ink-2">{count} decided. Save them as a file and send it to the session, which records them with the maps.</p>
        {problems.length > 0 && <p role="alert" className="mt-1 text-[13.5px] font-bold text-ch-alert-deep">The file wasn’t saved: {problems.join("; ")}.</p>}
      </div>
      <button type="button" onClick={save} className={buttonClasses({ variant: "ink", size: "sm", className: "shrink-0" })}><Download aria-hidden="true" className="size-4" />Download decisions</button>
    </section>
  );
}

const LOOKS: FirstLook[] = ["good", "usable", "hold", "unsure"];
const LOOK_HEAD: Record<FirstLook, string> = { good: "Good", usable: "Roads incomplete", hold: "Not usable", unsure: "Can’t tell" };

/** The automatic verdicts against a first look over the aerial photo: where the check was right,
    too strict (held a good map), or too loose (passed a map that isn't usable). */
function CrossCheck({ entries, looks }: { entries: WaveEntry[]; looks: Looks | null }) {
  if (!looks) {
    return (
      <section aria-labelledby="cross-h" className="rounded-ch-card border border-ch-line bg-ch-card px-4 py-3 shadow-ch-card sm:px-5">
        <h3 id="cross-h" className="font-ch-display text-ch-h font-bold text-ch-ink">Did the check get it right?</h3>
        <p className="mt-1 text-[14px] text-ch-ink-2">Nobody has looked at this wave over the aerial photo yet, so there’s nothing to compare the check with.</p>
      </section>
    );
  }
  const call = (id: string) => looks.looks[id]?.call;
  const rows = (["ready", "review"] as Verdict[]).map((v) => {
    const es = entries.filter((e) => e.verdict === v);
    return { v, n: es.length, counts: LOOKS.map((l) => es.filter((e) => call(e.id) === l).length) };
  });
  const passedBad = rows[0].counts[2];
  const passedUnsure = rows[0].counts[3];
  // Held maps a first look found usable: some only because roads were traced from the photo.
  const held = entries.filter((e) => e.verdict === "review" && ["good", "usable"].includes(call(e.id) ?? ""));
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
        {passedBad === 0 ? "No map it passed looked unusable." : `${passedBad} map${passedBad === 1 ? "" : "s"} it passed looked unusable.`} {rows[0].counts[1]} of the {rows[0].n} it passed are missing some roads. {held.length} of the {rows[1].n} it held are usable on the photo{heldTraced ? `, ${heldTraced} of them with roads traced from it` : ""}, which makes <strong className="font-bold text-ch-ink">{rows[0].n - passedBad + held.length} of {entries.length} ready to go live after one look</strong>{passedUnsure ? `, counting the ${passedUnsure} it passed that the photo can’t settle` : ""}.
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

function Card({ entry: e, wave, looks, home, decision, traced }: { entry: WaveEntry; wave: number; looks: Looks | null; home: string; decision?: Decision; traced?: boolean }) {
  const v = VERDICT[e.verdict];
  const name = tidyCase(e.name);
  const look = looks?.looks[e.id];
  return (
    <li className="group relative flex overflow-hidden rounded-ch-card border border-ch-line bg-ch-card shadow-ch-card transition-colors focus-within:border-ch-ink hover:border-ch-muted sm:flex-col">
      {/* The box keeps its shape whatever the campground's (square in a phone's row, 4:3 on a
          card); the drawing fits inside it. */}
      <div className="relative aspect-square w-28 shrink-0 border-r border-ch-line bg-ch-shell sm:aspect-[4/3] sm:w-auto sm:border-b sm:border-r-0">
        <div className="absolute inset-1.5 sm:inset-2"><MapThumb id={e.id} thumb={e.thumb} label={`${name}: ${e.metrics.placed} sites`} /></div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 sm:gap-1.5 sm:p-4">
        {look ? <StatusMark level={LOOK_LEVEL[look.call]} label={FIRST_LOOK_WORD[look.call]} className="whitespace-normal text-[13px]" /> : <StatusMark level={v.level} label={v.word} className="text-[13px]" />}
        <h3 className="font-ch-display text-[17px] font-bold leading-snug text-ch-ink">
          <Link href={`${home}?wave=${wave}&id=${e.id}`} className="after:absolute after:inset-0 focus-visible:outline-none group-focus-within:underline">{name}</Link>
        </h3>
        <p className="text-[13.5px] text-ch-muted">{[AGENCY_SHORT[e.agency] ?? e.agency, e.state, sitesWord(e.metrics.sites, "kind" in e.metrics ? e.metrics.kind : undefined)].filter(Boolean).join(" · ")}</p>
        {look && <p className="line-clamp-3 text-[13.5px] leading-snug text-ch-ink-2">{look.note}</p>}
        <p className={cx("text-[13px] leading-snug", look ? "mt-auto pt-1 text-ch-muted" : "text-ch-ink-2")}>
          {look && <span className="font-bold text-ch-ink-2">Checks: </span>}
          {e.reasons.length === 0 ? `${look ? "all" : "All"} ${e.checks.length} ${look ? "passed" : "checks passed"}.` : `${e.reasons[0].text}${e.reasons.length > 1 ? `, and ${e.reasons.length - 1} more reason${e.reasons.length > 2 ? "s" : ""}` : ""}.`}
        </p>
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

function Detail({ wave, id, home }: { wave: Wave; id: string; home: string }) {
  const [decisions, decide] = useDecisions();
  const { map, state } = useMap(id);
  const [draft, setDraft, changed, discard] = useTraceDraft(id, map);
  // Check the map, or trace what it's missing; ?tool=trace opens the tracing tool.
  const params = useSearchParams();
  const [tool, setTool] = useState<"check" | "trace">(params.get("tool") === "trace" ? "trace" : "check");
  // What campers would see with the reviewer's traces in place (the same map until they trace).
  const shown = map?.bbox ? withDraft(map, draft) : map;
  const n = wave.info.wave;
  const sorted = useMemo(() => sortEntries(wave.entries, wave.looks), [wave]);
  const back = <Link href={`${home}?wave=${n}`} className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-bold text-ch-ink-2 underline-offset-2 hover:underline"><ArrowLeft aria-hidden="true" className="size-4" />All maps</Link>;
  const entry = wave.entries.find((e) => e.id === id) ?? null;
  const failed = wave.failed.find((f) => f.id === id);
  if (failed) return <>{back}<h1 className="mt-2 font-ch-display text-ch-title font-bold text-ch-ink">{tidyCase(failed.name)}</h1><p className="mt-2 text-[15px] text-ch-ink-2">This map didn’t build: {failed.error}</p></>;
  if (!entry) return <>{back}<p className="mt-4 text-[15px] text-ch-ink-2">There’s no map “{id}” in {n === 0 ? "the sample" : `wave ${n}`}.</p></>;

  const v = VERDICT[entry.verdict];
  const name = tidyCase(entry.name);
  const decision = decisions[entry.id];
  const at = sorted.findIndex((e) => e.id === entry.id);
  const nextEntry = [...sorted.slice(at + 1), ...sorted.slice(0, at)].find((e) => needsDecision(e, wave.looks?.looks[e.id]?.call) && !decisions[e.id]);
  const nextHref = nextEntry ? `${home}?wave=${n}&id=${nextEntry.id}` : null;
  const look = wave.looks?.looks[entry.id];
  const lookNote = look && wave.looks ? <FirstLookNote look={look} by={wave.looks.by} on={wave.looks.on} /> : null;
  // "Trace the missing roads" opens the tool and brings the photo into view.
  const openTrace = () => { setTool("trace"); requestAnimationFrame(() => document.getElementById("aerial-h")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })); };
  const decisionBox = <DecisionBox entry={entry} look={look?.call} decision={decision} decide={decide} nextHref={nextHref} onTrace={map?.bbox ? openTrace : undefined} traceChanged={changed} />;

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
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {look ? <StatusMark level={LOOK_LEVEL[look.call]} label={`First look: ${FIRST_LOOK_WORD[look.call]}`} className="whitespace-normal text-[14px]" /> : <StatusMark level={v.level} label={v.word} className="text-[14px]" />}
            {changed && <span className="inline-flex items-center gap-1 text-[13.5px] font-bold text-ch-ochre-ink"><PenLine aria-hidden="true" className="size-4" />your traces aren’t built yet</span>}
          </p>
          <h1 className="mt-1 text-balance font-ch-display text-ch-title font-bold leading-tight text-ch-ink">{name}</h1>
          <p className="mt-1 text-[15px] text-ch-ink-2">{[entry.agency, entry.recArea, entry.state, sitesWord(entry.metrics.sites, "kind" in entry.metrics ? entry.metrics.kind : undefined), waveLabel(n)].filter(Boolean).join(" · ")}</p>
          {look && <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[14px] text-ch-ink-2"><span className="font-bold">The automatic check:</span><StatusMark level={v.level} label={entry.verdict === "ready" ? `all ${entry.checks.length} passed` : v.word} className="text-[14px]" /></p>}
          {entry.reasons.length > 0 && (
            <ul className="mt-3 grid list-disc gap-1 pl-5 text-[15px] text-ch-ink marker:text-ch-muted">
              {entry.reasons.map((r) => <li key={r.code}>{r.text}</li>)}
            </ul>
          )}
          {lookNote && <div className="mt-4 lg:hidden">{lookNote}</div>}

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
          {entry.areas && (
            <Panel id="area-checks-h" title={`Each area’s checks (${entry.areas.length} areas)`} className="mt-4">
              <p className="text-[14px] text-ch-ink-2">The same checks on each area’s own map. A split is drawn by a rule, so a person checks it even when every area passes.</p>
              <ol className="mt-3 grid gap-2.5">
                {entry.areas.map((a, i) => (
                  <li key={i} className="grid gap-0.5">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-[15px] font-bold text-ch-ink">{i + 1}. {a.name}</span><StatusMark level={VERDICT[a.verdict].level} label={a.verdict === "ready" ? "Passes" : VERDICT[a.verdict].word} className="text-[13px]" /></span>
                    {a.reasons.length > 0 && <span className="text-[14px] text-ch-ink-2">{a.reasons.map((r) => r.text).join("; ")}</span>}
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          <div className="mt-6">
            <h2 className="font-ch-display text-[20px] font-bold text-ch-ink">What campers would see</h2>
            <p className="mt-0.5 text-[14px] text-ch-ink-2">{changed ? "With your traces in place. They aren’t built yet, so the checks above don’t include them." : shown && isFirstCome(shown) ? "A first-come campground: the campground page shows its area and how to get a site." : shown?.sites.length === 1 ? "One unit: the campground page shows where it is." : shown?.split?.kind === "areas" ? `The campground page shows this listing as ${shown.split.areas.length} areas, one at a time.` : "The campground page’s site map, drawn from this data."}</p>
            {state === "ready" && shown ? (
              <CamperMap map={shown} name={name} provider="Recreation.gov" picked={null} openIds={[]} selectedId={null} onSelect={() => {}} note="No night is picked here, so every site is a plain dot." />
            ) : <div className="mt-3"><Pending state={state} /></div>}
          </div>

          <Panel id="sources-h" title="Where each layer came from" className="mt-4">
            <Sources entry={entry} map={map} />
          </Panel>
        </div>

        <aside aria-label="Review" className="hidden gap-4 lg:sticky lg:top-6 lg:grid">
          {lookNote}
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

function FirstLookNote({ look, by, on }: { look: { call: FirstLook; note: string }; by: string; on: string }) {
  return (
    <div className="rounded-ch-card bg-ch-shell px-4 py-3.5">
      <p className="text-[13px] font-bold text-ch-ink-2">First look over the aerial photo</p>
      <p className="mt-1 text-[15px] leading-snug text-ch-ink"><span className="sr-only">{FIRST_LOOK_WORD[look.call]}. </span>{look.note}</p>
      <p className="mt-1.5 text-[13px] leading-snug text-ch-ink-2">By {by}, {dayOf(on)}. One look; your decision is separate.</p>
    </div>
  );
}

/** What a reviewer does with a map. The firm (ink) button follows the evidence: approve when the
    first look found nothing wrong, otherwise the outcome the first look points to. */
function DecisionBox({ entry, look, decision, decide, nextHref, onTrace, traceChanged }: { entry: WaveEntry; look?: FirstLook; decision?: Decision; decide: (id: string, d: Decision | null) => void; nextHref: string | null; onTrace?: () => void; traceChanged?: boolean }) {
  const traced = entry.reasons.some((r) => r.code === "traced");
  const primary = suggestedDecision(entry.reasons, look);
  const OPTIONS: { d: Decision; label: string; Icon: typeof Check; show: boolean }[] = [
    { d: "approved", label: "Approve map", Icon: Check, show: entry.verdict !== "not-drawn" },
    { d: "roads", label: "Needs roads added", Icon: Route, show: entry.verdict !== "not-drawn" },
    { d: "hidden", label: "Keep it hidden", Icon: EyeOff, show: true },
  ];
  // A fixed order on every map, so a hundred decisions don't become a hundred mis-clicks; the
  // suggestion is filled and says so.
  const shown = OPTIONS.filter((o) => o.show);
  return (
    <section aria-label="Your decision" className="rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-card">
      {traceChanged && !decision && (
        <p className="mb-3 flex gap-1.5 rounded-ch-input border border-ch-ochre-line bg-ch-ochre-soft px-3 py-2 text-[13.5px] leading-snug text-ch-ink">
          <PenLine aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>Your traces aren’t on this map yet: its checks and verdict are for the map as built. Download the trace file to have it rebuilt, then judge it again.</span>
        </p>
      )}
      {decision ? (
        <>
          <DecisionNote decision={decision} />
          {RECORDED[entry.id]?.decision === decision && <p className="mt-1 text-[13px] leading-snug text-ch-ink-2">Recorded with the maps, {dayOf(RECORDED[entry.id].on)}.</p>}
        </>
      ) : traceChanged ? (
        <p className="text-[14.5px] leading-snug text-ch-ink-2">Approving now approves the map without your traces.</p>
      ) : (
        <p className="text-[14.5px] leading-snug text-ch-ink-2">
          {primary === "roads" ? "The first look found it not usable as drawn: its note says what’s missing. Send it for roads, or approve it if the photo says otherwise."
            : primary === "hidden" ? "The first look found this listing spread out or its sites stacked, so it isn’t one campground’s map yet. Keep it hidden, or approve it if the photo says otherwise."
            : entry.verdict === "ready" ? "Every check passed, so this map would go live on its own. You can still hold it back."
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
          <button key={d} type="button" onClick={() => decide(entry.id, d)} className={buttonClasses({ variant: d === primary && !traceChanged ? "ink" : "quiet", size: "sm", fullWidth: true })}><Icon aria-hidden="true" className="size-4" />{d === "approved" && traceChanged ? "Approve without my traces" : label}{d === primary && !traceChanged && <span className="text-[12px] font-normal">· Suggested</span>}</button>
        ))}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-ch-ink-2">Lab: a decision made here is saved in this browser until it’s recorded with the maps.</p>
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

const ROAD_SOURCE: Record<WaveEntry["sources"]["roads"], string> = {
  nps: "National Park Service GIS",
  osm: "OpenStreetMap",
  usfs: "Forest Service system roads",
  tiger: "US Census Bureau TIGER roads",
  none: "None: no source had roads here",
};
const SOURCE_WORD: Partial<Record<WaveEntry["sources"]["roads"], string>> = { nps: "the Park Service", osm: "OpenStreetMap", usfs: "the Forest Service", tiger: "the Census Bureau" };
const SOURCE_SHORT: Record<Exclude<WaveEntry["sources"]["roads"], "none">, string> = { nps: "Park Service", osm: "OpenStreetMap", usfs: "Forest Service", tiger: "Census TIGER" };
const WATER_SOURCE: Record<WaveEntry["sources"]["water"], string> = {
  usgs: "USGS hydrography",
  osm: "OpenStreetMap (USGS didn’t answer)",
  none: "Not fetched",
};

function Sources({ entry, map }: { entry: WaveEntry; map: SiteMapData | null }) {
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
