"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Segmented } from "@/components/Segmented";
import { Spinner } from "@/components/Spinner";
import { cx } from "@/components/cx";
import { PRESS, PRESS_FILL, PRESS_ROW } from "@/components/press";
import { buildList } from "../build";
import { rentalList, rentalText, totalWeight } from "../bom";
import { SERIES } from "../catalog";
import { checks } from "../checks";
import { towerLoads } from "../loads";
import { describePart, partKey } from "../describe";
import { applyEdit, type RigEdit } from "../commands";
import { readDesign } from "../validate";
import { autoName, clampParams, fitBays, ftIn, newDesign, seriesFor, template, TEMPLATES, type Field } from "../templates";
import type { BraceMode, Part, RailMode, RigDesign, RigParams, TemplateId } from "../types";
import type { ViewerHandle } from "./RigViewer";

const RigViewer = dynamic(() => import("./RigViewer").then((m) => m.RigViewer), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center rounded-card bg-bg text-small text-muted">
      <span className="flex items-center gap-2"><Spinner /> Loading the 3D view…</span>
    </div>
  ),
});

export type SavedRigLite = { id: string; name: string; status: "draft" | "approved" | "built"; updatedAt: string; design: RigDesign };
type Result = { ok: true; id: string } | { ok: false; reason: string };
type ChatResult = { state: "changed"; design: RigDesign; edit: RigEdit; reply: string; by: "words" | "ai" } | { state: "unchanged"; reply: string };

export type RigActions = {
  chat: (design: RigDesign, message: string) => Promise<ChatResult>;
  save: (id: string | null, design: RigDesign) => Promise<Result>;
  approve: (id: string | null, design: RigDesign) => Promise<Result>;
  remove: (id: string) => Promise<{ ok: boolean }>;
};

const DRAFT_KEY = "rig.draft.v1";
const TABS = [
  { value: "design", label: "Design" },
  { value: "parts", label: "Parts" },
  { value: "checks", label: "Checks" },
  { value: "saved", label: "Saved" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const BRACE_LABEL: Record<BraceMode, string> = { none: "None", top: "Top", bottom: "Bottom", both: "Both" };
const RAIL_LABEL: Record<RailMode, string> = { none: "None", back: "Back", three: "Back + sides" };
type Status = SavedRigLite["status"] | "changed";
const STATUS: Record<Status, string> = {
  draft: "Draft",
  approved: "Approved, waiting for Vectorworks",
  built: "Built in Vectorworks ✓",
  changed: "Approved version waiting · you've changed it since",
};
const same = (a: RigDesign, b: RigDesign) => JSON.stringify(a) === JSON.stringify(b);
/** A design ready to send: an emptied name falls back to the automatic one. */
const ready = (d: RigDesign): RigDesign => ({ ...d, name: d.name.trim() || autoName(d.template, d.params) });

export function RigPlanner({ actions, saved, initial, storeReady }: { actions: RigActions; saved: SavedRigLite[] | null; initial: { id: string; design: RigDesign; status: SavedRigLite["status"] } | null; storeReady: boolean }) {
  const router = useRouter();
  const [design, setDesign] = useState<RigDesign>(() => initial?.design ?? newDesign("cube"));
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [status, setStatus] = useState<Status | null>(initial?.status ?? null);
  const [tab, setTab] = useState<Tab>("design");
  const [pick, setPick] = useState<{ id: string; key: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [approved, setApproved] = useState<string | null>(null);
  const viewer = useRef<ViewerHandle>(null);
  const loaded = useRef(false);
  /** The design as it is right now, for answers that arrive after more edits. */
  const latest = useRef(design);
  useEffect(() => {
    latest.current = design;
  }, [design]);
  /** Changed since it was opened or last saved: guards the phone's draft and "Open". */
  const dirty = useRef(false);

  // Keep a draft on this phone so a dropped connection never loses work.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    if (initial) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { design: unknown; id: unknown };
        const restored = readDesign(d?.design);
        if (restored) {
          // After this render, so the server's first paint and the phone's agree.
          queueMicrotask(() => {
            setDesign(restored);
            setId(typeof d.id === "string" ? d.id : null);
          });
        }
      }
    } catch {}
  }, [initial]);
  useEffect(() => {
    // An opened link doesn't overwrite the phone's draft until you change something.
    if (initial && !dirty.current) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ design, id }));
    } catch {}
  }, [design, id, initial]);

  const list = useMemo(() => buildList(design), [design]);
  const rental = useMemo(() => rentalList(list), [list]);
  const findings = useMemo(() => checks(design, list), [design, list]);
  const loads = useMemo(() => towerLoads(design, list), [design, list]);
  const warns = findings.filter((f) => f.level === "warn").length;
  // Ids are counters and can renumber after an edit: follow the same kind of part instead.
  const part: Part | null = !pick ? null : (() => {
    const byId = list.parts.find((p) => p.id === pick.id);
    if (byId && partKey(byId) === pick.key) return byId;
    return list.parts.find((p) => partKey(p) === pick.key) ?? null;
  })();
  const info = part ? describePart(part, list) : null;
  const selected = part?.id ?? null;
  const setSelected = (pid: string | null) => {
    const p = pid ? list.parts.find((x) => x.id === pid) : null;
    setPick(p ? { id: p.id, key: partKey(p) } : null);
  };

  const say = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 5000);
  };

  const edit = (next: RigDesign) => {
    dirty.current = true;
    setDesign(next);
    setApproved(null);
    if (status === "approved" || status === "built") setStatus("changed");
  };
  const setParam = <K extends keyof RigParams>(k: K, val: RigParams[K]) => {
    const params = clampParams(design.template, { ...design.params, [k]: val });
    const auto = design.name === autoName(design.template, design.params);
    edit({ ...design, params, name: auto ? autoName(design.template, params) : design.name });
  };
  const pickTemplate = (t: TemplateId) => {
    if (t === design.template) return;
    edit(newDesign(t, { series: seriesFor(t, design.params.series) }));
    setSelected(null);
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)] lg:gap-6">
      {/* 3D view */}
      <section aria-label="3D view" className="relative h-[52svh] min-h-[320px] lg:sticky lg:top-24 lg:h-[calc(100svh-8rem)]">
        <RigViewer ref={viewer} list={list} selected={selected} onSelect={setSelected} label={`${design.name}: ${list.parts.length} parts in 3D. Drag to turn it, pinch to zoom, tap a part to edit it.`} />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <p className="pointer-events-auto max-w-[60%] rounded-full border border-line bg-surface/90 px-3 py-1.5 text-small text-ink-2 backdrop-blur">
            <span className="text-ink">{design.name}</span>
            {status && <span className="block text-muted">{STATUS[status]}</span>}
          </p>
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <ArButton viewer={viewer} say={say} />
            <button type="button" onClick={() => viewer.current?.resetView()} className={cx("min-h-11 rounded-full border border-line bg-surface/90 px-4 text-small text-ink-2 backdrop-blur hover:text-ink", PRESS, PRESS_FILL)}>
              Reset view
            </button>
          </div>
        </div>
        <p className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center"><span className="rounded-full bg-surface/90 px-3 py-1 text-small text-ink-2">Drag to turn · pinch to zoom · tap a part</span></p>
      </section>

      {/* Panel */}
      <section aria-label="Rig settings" className="mt-4 pb-40 lg:mt-0 lg:pb-32">
        <Segmented label="Panel" options={TABS.map((t) => ({ value: t.value, label: t.value === "checks" && warns ? `Checks · ${warns}` : t.label }))} value={tab} onChange={setTab} />

        {tab === "design" && (
          <div className="mt-5 space-y-6">
            <div>
              <h2 className="text-label text-muted">Start from</h2>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {TEMPLATES.map((t) => {
                  const on = t.id === design.template;
                  return (
                    <button key={t.id} type="button" aria-pressed={on} onClick={() => pickTemplate(t.id)} className={cx("min-h-16 rounded-input border p-3 text-left transition-colors", PRESS_ROW, on ? "border-ink bg-surface-2" : cx("border-line bg-surface hover:border-control", PRESS_FILL))}>
                      <span className="flex items-center gap-2 text-body text-ink">{on && <span aria-hidden="true">✓</span>}{t.name}</span>
                      <span className="mt-0.5 block text-small text-muted">{t.blurb}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="block">
              <span className="text-label text-muted">Name</span>
              <span className="field mt-2 block rounded-input border border-control bg-surface">
                <input
                  value={design.name}
                  maxLength={80}
                  placeholder={autoName(design.template, design.params)}
                  onChange={(e) => edit({ ...design, name: e.target.value })}
                  onBlur={() => !design.name.trim() && edit(ready(design))}
                  className="min-h-12 w-full bg-transparent px-4 text-body text-ink outline-none placeholder:text-muted"
                />
              </span>
            </label>
            <Fields design={design} fields={template(design.template).fields} setParam={setParam} />
            {design.template === "roof" && (
              <div>
                <p className="text-label text-muted">Bays, tower to tower</p>
                <p className="mt-2 text-body tabular-nums text-ink">{fitBays(design.params.bays, design.params.towers, design.params.width).map(ftIn).join(" · ")}</p>
                <p className="mt-1 text-small text-muted">To move towers, type the bays in the chat, e.g. “bays 22&apos;4&quot; 42&apos;4&quot; 22&apos;4&quot;”.</p>
              </div>
            )}
            <SaveBar
              id={id}
              design={ready(design)}
              actions={actions}
              storeReady={storeReady}
              onSaved={(newId, st, sent) => {
                setId(newId);
                // Only claim what was actually saved: edits made while it was sending stay unsaved.
                const unchanged = same(sent, ready(latest.current));
                setStatus(st === "approved" && !unchanged ? "changed" : st);
                if (unchanged) dirty.current = false;
                if (st === "approved" && unchanged) setApproved(newId);
                router.refresh();
              }}
              say={say}
            />
            {approved && <ApprovedCard id={approved} say={say} />}
          </div>
        )}

        {tab === "parts" && (
          <div className="mt-5">
            <h2 className="text-h3 font-normal">To rent</h2>
            <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
              {rental.map((l) => (
                <li key={l.key} className="flex items-baseline gap-3 px-4 py-3">
                  <span className="w-12 shrink-0 text-right text-body tabular-nums text-ink">{l.qty}</span>
                  <span className="min-w-0 flex-1 text-body text-ink-2">
                    {l.item}
                    {l.note && <span className="block text-small text-muted">{l.note}</span>}
                  </span>
                  <span className="shrink-0 text-small tabular-nums text-muted">{Math.round(l.lb)} lb</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-body text-ink-2">About <span className="tabular-nums text-ink">{Math.round(totalWeight(rental))} lb</span> all in. Typical weights; check the rental house&apos;s sheet.</p>
            <ShareButton text={rentalText(ready(design).name, rental)} say={say} />
            <details className="mt-6">
              <summary className={cx("min-h-11 cursor-pointer rounded-tag py-2 text-body text-ink", PRESS)}>Pick a part to edit ({list.parts.length})</summary>
              <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {list.parts.map((p) => {
                  const d = describePart(p, list);
                  return (
                    <li key={p.id}>
                      <button type="button" onClick={() => setSelected(p.id)} className={cx("min-h-11 w-full rounded-tag px-3 text-left text-small text-ink-2 hover:text-ink", PRESS_ROW, PRESS_FILL)}>
                        {d.title} · <span className="text-muted">{d.detail}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          </div>
        )}

        {tab === "checks" && (
          <div className="mt-5">
            <h2 className="text-h3 font-normal">Checks</h2>
            <p className="mt-1 text-small text-muted">Catches the obvious early. Not engineering: the truss maker&apos;s load tables and a qualified rigger have the last word.</p>
            <ul className="mt-3 space-y-2">
              {findings.map((f) => (
                <li key={f.id} className="flex gap-3 rounded-input border border-line bg-surface p-3 text-body text-ink-2">
                  <span aria-hidden="true" className={cx("w-5 shrink-0 text-center", f.level === "warn" ? "text-wrong" : f.level === "ok" ? "text-ice" : "text-muted")}>{f.level === "warn" ? "!" : f.level === "ok" ? "✓" : "i"}</span>
                  <span><span className="sr-only">{f.level === "warn" ? "Warning: " : f.level === "ok" ? "OK: " : "Note: "}</span>{f.text}</span>
                </li>
              ))}
            </ul>
            {loads.length > 0 && (
              <>
                <h3 className="mt-6 text-label text-muted">Grid weight on each tower</h3>
                <ul className="mt-2 divide-y divide-line rounded-card border border-line bg-surface">
                  {loads.map((l) => {
                    const over = l.lb > design.params.towerLimit;
                    return (
                      <li key={`${l.side}-${l.index}`} className="flex items-baseline gap-3 px-4 py-2.5 text-body">
                        <span className="flex-1 text-ink-2">{l.side === "front" ? "Front" : "Back"} tower {l.index + 1}</span>
                        <span className="tabular-nums text-ink">{Math.round(l.lb).toLocaleString("en-US")} lb</span>
                        <span className={cx("w-28 text-right text-small tabular-nums", over ? "text-wrong" : "text-muted")}>
                          {over ? "✕ over limit" : `${Math.round((l.lb / design.params.towerLimit) * 100)}% of limit`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-small text-muted">The grid&apos;s own weight only, shared by where each piece sits. Lights and cable come on top.</p>
              </>
            )}
          </div>
        )}

        {tab === "saved" && (
          <SavedList
            saved={saved}
            storeReady={storeReady}
            currentId={id}
            actions={actions}
            say={say}
            onOpen={(r) => {
              if (dirty.current && !window.confirm(`Open “${r.name}”? Your unsaved changes to “${ready(design).name}” will be replaced.`)) return;
              dirty.current = false;
              setDesign(r.design);
              setId(r.id);
              setStatus(r.status);
              setSelected(null);
              setTab("design");
            }}
            onRemoved={(rid) => {
              if (rid === id) {
                setId(null);
                setStatus(null);
                setApproved(null);
              }
              router.refresh();
            }}
          />
        )}
      </section>

      {/* Tapped part */}
      {part && info && (
        <PartSheet title={info.title} onClose={() => setSelected(null)} className="fixed inset-x-0 bottom-0 z-40 rounded-t-card border-t border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-card lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[420px] lg:rounded-card lg:border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-label text-muted">Selected</p>
              <h2 data-sheet-title tabIndex={-1} className="mt-1 rounded-tag text-h3 font-normal outline-none">{info.title}</h2>
              <p className="mt-1 text-small text-ink-2">{info.detail}</p>
            </div>
            <Button variant="quiet" onClick={() => setSelected(null)}>Done</Button>
          </div>
          <div className="mt-4">
            <Fields design={design} fields={template(design.template).fields.filter((f) => info.fields.includes(f.key))} setParam={setParam} />
            {!template(design.template).fields.some((f) => info.fields.includes(f.key)) && <p className="text-small text-muted">Nothing to change on this one in this template.</p>}
          </div>
        </PartSheet>
      )}

      {/* Chat */}
      {!part && (
        <ChatBar
          latest={latest}
          actions={actions}
          onResult={(sent, r) => {
            // More edits arrived while it was thinking: apply the request to the design as it is now.
            const now = latest.current;
            const next = same(sent, now) ? r.design : applyEdit(now, r.edit).design;
            edit(next);
            setSelected(null);
          }}
          say={say}
        />
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4 lg:bottom-28">
        {toast && <p className="pointer-events-auto max-w-[560px] rounded-btn border border-line bg-surface-2 px-4 py-3 text-body text-ink shadow-card">{toast}</p>}
      </div>
    </div>
  );
}

function Fields({ design, fields, setParam }: { design: RigDesign; fields: readonly Field[]; setParam: <K extends keyof RigParams>(k: K, v: RigParams[K]) => void }) {
  return (
    <div className="space-y-5">
      {fields.map((f) => {
        if (f.kind === "length") return <Stepper key={f.key} label={f.label} value={design.params[f.key]} min={f.min} max={f.max} step={f.step} onChange={(v) => setParam(f.key, v)} />;
        if (f.kind === "series")
          return (
            <div key={f.key}>
              <p className="text-label text-muted">{f.label}</p>
              <div className="mt-2"><Segmented label={f.label} options={Object.values(SERIES).map((s) => ({ value: s.id, label: s.label.replace(" truss", "") }))} value={design.params.series} onChange={(v) => setParam("series", v)} /></div>
            </div>
          );
        const choice = (control: ReactNode) => (
          <div key={f.key}>
            <p className="text-label text-muted">{f.label}</p>
            <div className="mt-2 overflow-x-auto">{control}</div>
          </div>
        );
        if (f.kind === "toggle")
          return choice(<Segmented label={f.label} options={[{ value: "off", label: f.off }, { value: "on", label: f.on }]} value={design.params[f.key] ? "on" : "off"} onChange={(v) => setParam(f.key, v === "on")} />);
        if (f.kind === "weight")
          return <Stepper key={f.key} label={f.label} value={design.params[f.key]} min={f.min} max={f.max} step={f.step} format={(v) => `${v.toLocaleString("en-US")} lb`} less="less" more="more" onChange={(v) => setParam(f.key, v)} />;
        if (f.kind === "rail")
          return choice(<Segmented label={f.label} options={f.options.map((o) => ({ value: o, label: RAIL_LABEL[o] }))} value={design.params.rail} onChange={(v) => setParam("rail", v)} />);
        if (f.kind === "count")
          return choice(<Segmented label={f.label} options={Array.from({ length: f.max - f.min + 1 }, (_, i) => f.min + i).map((n) => ({ value: String(n), label: n ? String(n) : "None" }))} value={String(design.params[f.key])} onChange={(v) => setParam(f.key, Number(v))} />);
        return choice(<Segmented label={f.label} options={f.options.map((o) => ({ value: o, label: BRACE_LABEL[o] }))} value={design.params.braces} onChange={(v) => setParam("braces", v)} />);
      })}
    </div>
  );
}

function Stepper({ label, value, min, max, step, onChange, format = ftIn, less = "shorter", more = "longer" }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string; less?: string; more?: string }) {
  const lid = useId();
  const btn = cx("grid size-12 shrink-0 place-items-center rounded-btn border border-control bg-surface text-h3 text-ink disabled:border-line disabled:text-muted", PRESS, PRESS_FILL);
  return (
    <div>
      <p id={lid} className="text-label text-muted">{label}</p>
      <div className="mt-2 flex items-center gap-3" role="group" aria-labelledby={lid}>
        <button type="button" className={btn} aria-label={`${label}: ${less}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>−</button>
        <output aria-live="polite" className="min-w-20 flex-1 text-center text-h3 tabular-nums text-ink">{format(value)}</output>
        <button type="button" className={btn} aria-label={`${label}: ${more}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>+</button>
      </div>
    </div>
  );
}

function SaveBar({ id, design, actions, storeReady, onSaved, say }: { id: string | null; design: RigDesign; actions: RigActions; storeReady: boolean; onSaved: (id: string, s: "draft" | "approved", sent: RigDesign) => void; say: (m: string) => void }) {
  const [busy, setBusy] = useState<"save" | "approve" | null>(null);
  const run = async (kind: "save" | "approve") => {
    if (busy) return;
    setBusy(kind);
    const sent = design;
    try {
      const r = await (kind === "save" ? actions.save(id, sent) : actions.approve(id, sent));
      if (r.ok) {
        onSaved(r.id, kind === "save" ? "draft" : "approved", sent);
        say(kind === "save" ? "✓ Saved." : "✓ Approved. Ready for Vectorworks.");
      } else say(`✕ ${r.reason}`);
    } catch {
      say("✕ Couldn't reach the site. Your design is kept on this phone.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap gap-3 border-t border-line pt-5">
      <Button variant="quiet" aria-disabled={!!busy} onClick={() => run("save")}>{busy === "save" ? <><Spinner /> Saving…</> : "Save"}</Button>
      <Button aria-disabled={!!busy} onClick={() => run("approve")}>{busy === "approve" ? <><Spinner /> Sending…</> : "Send to Vectorworks"}</Button>
      {!storeReady && <p className="w-full text-small text-muted">Saving to the site isn&apos;t switched on yet; this phone keeps your design meanwhile.</p>}
    </div>
  );
}

function ApprovedCard({ id, say }: { id: string; say: (m: string) => void }) {
  const [copied, setCopied] = useState(false);
  const line = `build design ${id}`;
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-body text-ink"><span aria-hidden="true">✓ </span>Approved as design <span className="font-mono">{id}</span>.</p>
      <p className="mt-2 text-small text-ink-2">At your computer, with Vectorworks open, tell Claude:</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded-tag bg-surface-2 px-3 py-2 font-mono text-small text-ink">{line}</code>
        <Button
          variant="quiet"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(line);
              setCopied(true);
            } catch {
              say("✕ Couldn't copy. Press and hold the line to copy it.");
            }
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function ShareButton({ text, say }: { text: string; say: (m: string) => void }) {
  return (
    <Button
      variant="quiet"
      className="mt-4"
      onClick={async () => {
        try {
          if (navigator.share) await navigator.share({ text });
          else {
            await navigator.clipboard.writeText(text);
            say("✓ Rental list copied.");
          }
        } catch (e) {
          if ((e as Error)?.name !== "AbortError") say("✕ Couldn't share or copy the list.");
        }
      }}
    >
      Share the rental list
    </Button>
  );
}

function SavedList({ saved, storeReady, currentId, actions, say, onOpen, onRemoved }: { saved: SavedRigLite[] | null; storeReady: boolean; currentId: string | null; actions: RigActions; say: (m: string) => void; onOpen: (r: SavedRigLite) => void; onRemoved: (id: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!storeReady || saved === null) return <p className="mt-5 text-body text-ink-2">Saved designs show up here once saving to the site is switched on.</p>;
  if (!saved.length) return <p className="mt-5 text-body text-ink-2">Nothing saved yet. Press Save or Send to Vectorworks on the Design tab.</p>;
  return (
    <ul className="mt-5 space-y-2">
      {saved.map((r) => (
        <li key={r.id} className="flex items-center gap-3 rounded-input border border-line bg-surface p-3">
          <button type="button" onClick={() => onOpen(r)} className={cx("min-h-11 min-w-0 flex-1 rounded-tag text-left", PRESS_ROW)}>
            <span className="block truncate text-body text-ink">{r.id === currentId && <><span aria-hidden="true">● </span><span className="sr-only">(open now) </span></>}{r.name}</span>
            <span className="block text-small text-muted">{STATUS[r.status]} · <span className="font-mono">{r.id}</span></span>
          </button>
          <Button
            variant="ghost"
            aria-disabled={busy === r.id}
            onClick={async () => {
              if (busy || !window.confirm(`Delete “${r.name}”?`)) return;
              setBusy(r.id);
              const res = await actions.remove(r.id).catch(() => ({ ok: false }));
              setBusy(null);
              say(res.ok ? "✓ Deleted." : "✕ Couldn't delete it. Try again.");
              if (res.ok) onRemoved(r.id);
            }}
          >
            {busy === r.id ? <Spinner /> : "Delete"}
          </Button>
        </li>
      ))}
    </ul>
  );
}

type SpeechRec = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

const noSubscribe = () => () => {};
const hasSpeech = () => {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
};

function ChatBar({ latest, actions, onResult, say }: { latest: React.RefObject<RigDesign>; actions: RigActions; onResult: (sent: RigDesign, r: Extract<ChatResult, { state: "changed" }>) => void; say: (m: string) => void }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [listening, setListening] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  const canListen = useSyncExternalStore(noSubscribe, hasSpeech, () => false);

  const send = (msg: string) => {
    const m = msg.trim();
    if (!m || pending) return;
    const sent = latest.current;
    start(async () => {
      try {
        const r = await actions.chat(sent, m);
        if (r.state === "changed") {
          onResult(sent, r);
          setText("");
          say(`✓ ${r.reply}`);
        } else say(r.reply);
      } catch {
        say("✕ Couldn't reach the site. Try again.");
      }
    });
  };

  const listen = () => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = false;
    r.onresult = (e) => {
      const said = e.results[0]?.[0]?.transcript ?? "";
      setText(said);
      send(said);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(text);
      }}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[min(520px,40vw)] lg:rounded-card lg:border"
    >
      <div className="mx-auto flex max-w-[720px] items-center gap-2">
        <label className="field flex min-w-0 flex-1 items-center rounded-input border border-control bg-surface">
          <span className="sr-only">Tell it what to change</span>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="“Make it 12 feet tall”" enterKeyHint="send" className="min-h-12 w-full bg-transparent px-4 text-body text-ink outline-none placeholder:text-muted" />
        </label>
        {canListen && (
          <button type="button" onClick={listen} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Say it"} className={cx("grid size-12 shrink-0 place-items-center rounded-btn border border-control bg-surface text-ink", PRESS, PRESS_FILL, listening && "border-ember")}>
            <span aria-hidden="true">{listening ? "■" : "🎙"}</span>
          </button>
        )}
        <Button type="submit" aria-disabled={pending} className="px-4">{pending ? <><Spinner /><span className="sr-only">Working</span></> : "Go"}</Button>
      </div>
    </form>
  );
}

function ArButton({ viewer, say }: { viewer: React.RefObject<ViewerHandle | null>; say: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-disabled={busy}
      onClick={async () => {
        if (busy) return;
        const a = document.createElement("a");
        if (!a.relList.supports("ar")) {
          say("Full-size view opens on an iPhone or iPad (AR Quick Look). It isn't available in this browser.");
          return;
        }
        setBusy(true);
        try {
          const blob = await viewer.current!.usdz();
          a.rel = "ar";
          const url = URL.createObjectURL(blob);
          a.href = url;
          a.download = "rig.usdz";
          a.appendChild(document.createElement("img"));
          a.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch {
          say("✕ Couldn't make the full-size model. Try again.");
        } finally {
          setBusy(false);
        }
      }}
      className={cx("flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-small text-on-primary", PRESS)}
    >
      {busy ? <><Spinner /> Making it…</> : "See it full size"}
    </button>
  );
}

/** The tapped part's sheet: focus goes to its title, Escape closes it, focus returns after. */
function PartSheet({ title, onClose, className, children }: { title: string; onClose: () => void; className: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("[data-sheet-title]")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (back && document.contains(back)) back.focus();
    };
  }, []);
  return (
    <div ref={box} role="dialog" aria-label={title} className={className}>
      {children}
    </div>
  );
}
