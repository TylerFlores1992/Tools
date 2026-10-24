"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Segmented } from "@/components/Segmented";
import { State } from "@/components/State";
import { cx } from "@/components/cx";
import { PanelClient, PanelError, loadPairing, pairingFromHash, savePairing, type DocInfo, type Pairing, type SetupChange } from "../client";
import { DEPARTMENTS, center, labelOf, type Department, type Pt, type VwObject } from "../geometry";
import { DEPT_LABEL, NEXT_VISIBILITY, type Report, type Setup, type Survey, type Visibility } from "../show";
import { formatLength, isImperial, nudgeSteps, INCHES, type Units } from "../units";
import { DrawingCanvas, type Tool } from "./DrawingCanvas";
import { Inspector } from "./Inspector";
import { RiggingView } from "./RiggingView";
import { DeptSwatch, SetupView } from "./SetupView";

type Tab = "drawing" | "rigging" | "setup";
const TABS: { value: Tab; label: string }[] = [
  { value: "drawing", label: "Drawing" },
  { value: "rigging", label: "Rigging" },
  { value: "setup", label: "Show setup" },
];
const VIS_WORD: Record<Visibility, string> = { shown: "shown", dimmed: "dimmed", hidden: "hidden" };

type Conn = "starting" | "unpaired" | "offline" | "ready";
type Note = { kind: "ok" | "wrong" | "note"; text: string } | null;

/** This browser's pairing: a fresh link from vwmcp-panel (#port=…&token=…) wins over a remembered one. */
function initialPairing(): Pairing | null {
  const fromHash = pairingFromHash(window.location.hash);
  if (fromHash) {
    savePairing(fromHash);
    history.replaceState(null, "", window.location.pathname + window.location.search); // the token leaves the URL
  }
  return fromHash ?? loadPairing();
}

const time = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/**
 * The Vectorworks panel: the open drawing, live from the owner's own computer through the
 * connector (vwmcp-panel). Select, drag, nudge, measure, edit fixtures; every change goes to
 * Vectorworks and comes back as the drawing now stands.
 */
export function VectorworksPanel() {
  const [pairing, setPairing] = useState<Pairing | null>(initialPairing);
  const [conn, setConn] = useState<Conn>(() => (pairing ? "starting" : "unpaired"));
  const [doc, setDoc] = useState<DocInfo | null>(null);
  const [objects, setObjects] = useState<VwObject[]>([]);
  const [units, setUnits] = useState<Units>(INCHES);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [stepIndex, setStepIndex] = useState("1");
  const [layer, setLayer] = useState("");
  const [fitSignal, setFitSignal] = useState(0);
  const [measure, setMeasure] = useState<Pt[]>([]);
  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState("");
  const [pasted, setPasted] = useState("");
  const [tab, setTab] = useState<Tab>("drawing");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [visibility, setVisibility] = useState<Partial<Record<Department, Visibility>>>({});

  const client = useMemo(() => (pairing ? new PanelClient(pairing) : null), [pairing]);
  const steps = useMemo(() => nudgeSteps(units), [units]);
  const step = steps[Number(stepIndex)]?.value ?? steps[0].value;
  const inFlight = useRef(0);

  const fail = useCallback((e: unknown) => {
    const err = e instanceof PanelError ? e : new PanelError(String(e), "vectorworks");
    if (err.kind === "offline") setConn("offline");
    if (err.kind === "unpaired") setConn("unpaired");
    setNote({ kind: "wrong", text: err.message });
  }, []);

  /**
   * Runs one thing against Vectorworks with the page marked busy, and says how it went.
   * A quiet run (re-reading the drawing) leaves the last message alone, so "Undid …" stays
   * readable after the re-read that follows it.
   */
  const run = useCallback(
    async <T,>(fn: (c: PanelClient) => Promise<T>, done?: (r: T) => string | void, opts: { quiet?: boolean } = {}): Promise<T | undefined> => {
      if (!client) return;
      inFlight.current++;
      setBusy(true);
      if (!opts.quiet) setNote(null);
      try {
        const r = await fn(client);
        const msg = done?.(r);
        if (msg) setNote({ kind: "ok", text: msg });
        return r;
      } catch (e) {
        fail(e);
      } finally {
        inFlight.current--;
        if (!inFlight.current) setBusy(false);
      }
    },
    [client, fail],
  );

  // Opening the pairing link while this page is already open only changes the hash.
  useEffect(() => {
    const onHash = () => {
      const p = pairingFromHash(window.location.hash);
      if (!p) return;
      savePairing(p);
      history.replaceState(null, "", window.location.pathname + window.location.search);
      setNote(null);
      setConn("starting");
      setPairing(p);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  /** Reads the document and drawing. Call after client.alive() said yes. */
  const load = useCallback(
    (opts: { fit?: boolean } = {}) =>
      run(async (c) => {
        const [d, drawing] = [await c.document(), await c.drawing(layer || undefined)];
        setDoc(d);
        setUnits(drawing.units ?? d.units);
        setObjects(drawing.objects);
        if (drawing.setup) setSetup(drawing.setup);
        setSelected((s) => new Set([...s].filter((id) => drawing.objects.some((o) => o.id === id))));
        setConn("ready");
        setReadAt(time());
        if (opts.fit) setFitSignal((n) => n + 1);
        return drawing;
      }, (drawing) => (drawing.truncated ? `Showing the first ${drawing.count} objects.` : undefined), { quiet: true }),
    [layer, run],
  );

  const refresh = useCallback(
    (opts: { fit?: boolean } = {}) => {
      if (!client) return;
      void client.alive().then((ok) => {
        if (ok) return load(opts);
        setConn("offline");
        setNote(null);
      });
    },
    [client, load],
  );

  // First look, and again whenever the pairing or the layer filter changes.
  useEffect(() => {
    if (!client) return;
    let live = true;
    void client.alive().then((ok) => {
      if (!live) return;
      if (ok) return load({ fit: true });
      setConn("offline");
    });
    return () => {
      live = false;
    };
  }, [client, load]);

  // Changed something in Vectorworks? Coming back to this tab reads the drawing again.
  useEffect(() => {
    if (!autoRefresh) return;
    const onVisible = () => document.visibilityState === "visible" && conn !== "unpaired" && !inFlight.current && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [autoRefresh, conn, refresh]);

  /** Replace updated objects in place, add new ones, drop deleted ones. */
  const merge = useCallback((updated: VwObject[] = [], deleted: string[] = []) => {
    const del = new Set(deleted);
    setObjects((all) => {
      const byId = new Map(updated.map((o) => [o.id, o]));
      const kept = all.filter((o) => !del.has(o.id)).map((o) => byId.get(o.id) ?? o);
      const fresh = updated.filter((o) => !all.some((a) => a.id === o.id));
      return [...kept, ...fresh];
    });
  }, []);

  const onSelect = useCallback((ids: string[], mode: "replace" | "toggle" | "add") => {
    setSelected((cur) => {
      if (mode === "replace") return new Set(ids);
      const next = new Set(cur);
      for (const id of ids) {
        if (mode === "toggle" && next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    setFields(null);
  }, []);

  const moveBy = useCallback(
    (ids: string[], dx: number, dy: number) =>
      run((c) => c.op<{ objects: VwObject[] }>("move_objects", { ids, dx, dy }), (r) => {
        merge(r.objects);
        return `Moved ${ids.length === 1 ? "it" : `${ids.length} objects`} ${formatLength(dx, units)} across, ${formatLength(dy, units)} up.`;
      }),
    [run, merge, units],
  );

  const items = objects.filter((o) => selected.has(o.id));
  const ids = items.map((o) => o.id);

  const actions = {
    moveBy: (dx: number, dy: number) => moveBy(ids, dx, dy),
    rotate: (deg: number) =>
      run((c) => c.op<VwObject>("rotate_object", { id: ids[0], angle: deg }), (o) => {
        merge([o]);
        return `Rotated ${deg > 0 ? "counter-clockwise" : "clockwise"} ${Math.abs(deg)}°.`;
      }),
    duplicate: () =>
      run((c) => c.op<{ objects: VwObject[] }>("duplicate_objects", { ids, dx: step, dy: -step }), (r) => {
        merge(r.objects);
        setSelected(new Set(r.objects.map((o) => o.id)));
        return `Duplicated, offset ${formatLength(step, units)}.`;
      }),
    remove: () =>
      run((c) => c.op<{ deleted: string[] }>("delete_objects", { ids }), (r) => {
        merge([], r.deleted);
        setSelected(new Set());
        return `Deleted ${r.deleted.length === 1 ? "1 object" : `${r.deleted.length} objects`}. Undo below if that was a mistake.`;
      }),
    showInVectorworks: () => run((c) => c.op("select_objects", { ids, zoom: true }), () => "Selected in Vectorworks."),
    loadFields: (id: string) =>
      run((c) => c.op<VwObject>("get_object", { id }), (o) => {
        setFields(o.fields ?? {});
      }),
    saveFields: (values: Record<string, string>) =>
      run((c) => c.op<{ fields: Record<string, string> }>("set_record_fields", { id: ids[0], record: "Lighting Device", values }), (r) => {
        setFields(r.fields);
        merge([{ ...items[0], channel: r.fields.Channel ?? items[0].channel }]);
        return `Saved ${Object.keys(values).join(", ")}.`;
      }),
  };

  const undo = () =>
    run((c) => c.op<{ undone: string }>("undo_last"), (r) => {
      refresh();
      return r.undone;
    });

  const useVwSelection = () =>
    run((c) => c.op<{ objects: VwObject[] }>("list_objects", { selected_only: true, limit: 500 }), (r) => {
      merge(r.objects);
      setSelected(new Set(r.objects.map((o) => o.id)));
      return r.objects.length ? `Picked up ${r.objects.length} selected in Vectorworks.` : "Nothing is selected in Vectorworks.";
    });

  const workRigging = () =>
    run((c) => c.rigging(), (r) => {
      setReport(r);
      setSetup(r.setup);
      return r.summary.danger ? `${r.summary.danger} danger ${r.summary.danger === 1 ? "check" : "checks"} to look at.` : "Rigging worked out.";
    });

  const lookThrough = () =>
    run((c) => c.survey(), (sv) => {
      setSurvey(sv);
      setSetup(sv.setup);
    });

  const saveSetup = (change: SetupChange) =>
    run((c) => c.setup(change), () => {
      refresh();
      if (survey && change.departments) void lookThrough();
      if (report) void workRigging();
      return change.datum ? "Datum saved." : change.limits ? "Limits saved." : "Departments saved.";
    });

  const saveRevision = (label: string) =>
    run((c) => c.saveRevision(label), (r) => {
      setReport(r);
      return `Saved “${label}”. The next look lists what changed since.`;
    });

  const downloadCsv = () =>
    run((c) => c.riggingCsv(), (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(doc?.document || "points").replace(/\.vwx$/i, "")} - points.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return "Point list downloaded.";
    });

  /** From a report row or check: show it in the drawing, selected. */
  const pick = (id: string) => {
    setTab("drawing");
    if (objects.some((o) => o.id === id)) onSelect([id], "replace");
  };

  // Departments in the drawing, and how each is shown here.
  const present = DEPARTMENTS.filter((d) => objects.some((o) => (o.dept ?? "other") === d));
  const visOf = (d: Department): Visibility => visibility[d] ?? "shown";
  const drawn = objects.filter((o) => visOf(o.dept ?? "other") !== "hidden");
  const dimmed = new Set(present.filter((d) => visOf(d) === "dimmed"));
  const sameInVectorworks = () => {
    // A layer follows its department when all its objects belong to one.
    const byLayer = new Map<string, Set<Department>>();
    for (const o of objects) {
      if (o.source && o.source !== "native") continue;
      byLayer.set(o.layer, (byLayer.get(o.layer) ?? new Set()).add(o.dept ?? "other"));
    }
    const layers: Record<string, "visible" | "gray" | "hidden"> = {};
    for (const [name, ds] of byLayer) {
      if (ds.size !== 1) continue;
      const v = visOf([...ds][0]);
      layers[name] = v === "shown" ? "visible" : v === "dimmed" ? "gray" : "hidden";
    }
    return run((c) => c.op("set_visibility", { layers }), () => `Vectorworks now shows the same: ${Object.keys(layers).length} layers set.`);
  };
  const selectedPoint: Pt | null = items.length === 1 ? (items[0].location ?? center(items[0].bbox)) : null;
  const datum = setup?.datum_set ? { origin: setup.datum_origin, upstage: setup.upstage, cl: setup.cl_name, pl: setup.pl_name } : null;

  const fixtures = objects.filter((o) => o.plugin === "Lighting Device").sort((a, b) => (Number(a.channel) || 1e9) - (Number(b.channel) || 1e9));
  const listed = objects.filter((o) => !filter || labelOf(o).toLowerCase().includes(filter.toLowerCase()) || o.type.includes(filter.toLowerCase())).slice(0, 200);
  const measured = measure.length === 2 ? Math.hypot(measure[1][0] - measure[0][0], measure[1][1] - measure[0][1]) : null;

  if (conn === "starting") return <Card><p className="text-body text-ink-2">Looking for the connector…</p></Card>;

  if (conn === "unpaired" || !pairing) {
    return (
      <Card>
        <State kind="note">Not paired with this computer yet.</State>
        <p className="mt-3 max-w-[64ch] text-body text-ink-2">
          On the computer that runs Vectorworks, start <code className="font-mono text-small">vwmcp-panel</code> and open the link it prints. The pairing stays in this browser. Steps are below, under <a href="#setup" className="underline underline-offset-4 hover:text-ink">Set up</a>.
        </p>
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const p = pairingFromHash(pasted.split("#")[1] ?? "");
            if (!p) return setNote({ kind: "wrong", text: "That isn't a pairing link. Copy the whole line vwmcp-panel printed." });
            savePairing(p);
            setNote(null);
            setConn("starting");
            setPairing(p);
          }}
        >
          <label className="grid min-w-0 flex-1 gap-1.5 text-small text-ink-2">
            Or paste the pairing link
            <span className="field flex min-h-11 items-center rounded-input border border-control bg-surface">
              <input value={pasted} onChange={(e) => setPasted(e.target.value)} size={1} autoComplete="off" className="w-full min-w-0 bg-transparent px-3 py-2 font-mono text-small text-ink outline-none" />
            </span>
          </label>
          <Button type="submit" variant="quiet">Pair</Button>
        </form>
        {note && <p className="mt-3 text-small" role="status"><State kind={note.kind}>{note.text}</State></p>}
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1 text-small" aria-live="polite">
          {conn === "offline" ? (
            <State kind="wrong">The connector isn’t answering on this computer. Start vwmcp-panel, then Refresh.</State>
          ) : (
            <State kind="ok">
              Connected{doc ? <> to <b className="font-medium text-ink">{doc.document || "an untitled drawing"}</b></> : null}
              {doc?.version ? ` · Vectorworks ${doc.version.split(" ")[0]}` : ""}
              {` · ${isImperial(units) ? "feet and inches" : units.unit_name.trim() || "metric"}`}
              {readAt ? ` · read ${readAt}` : ""}
            </State>
          )}
          <span role="status">
            {busy ? <State kind="note">Waiting for Vectorworks…</State> : note ? <State kind={note.kind}>{note.text}</State> : null}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="quiet" disabled={busy} onClick={() => refresh()}>Refresh</Button>
          <Button variant="quiet" disabled={busy || conn !== "ready"} onClick={useVwSelection}>Use Vectorworks selection</Button>
          <Button variant="ghost" disabled={busy || conn !== "ready"} onClick={undo}>Undo last change</Button>
        </div>
      </div>

      <div role="tablist" aria-label="Views" className="inline-flex justify-self-start overflow-x-auto rounded-full border border-line bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={`tab-${t.value}`}
            aria-selected={tab === t.value}
            aria-controls={`panel-${t.value}`}
            onClick={() => setTab(t.value)}
            className="flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-small text-ink-2 transition-colors duration-150 hover:text-ink aria-selected:bg-primary aria-selected:text-on-primary"
          >
            {tab === t.value && <span aria-hidden="true">✓</span>}
            {t.label}
            {t.value === "rigging" && report && report.summary.danger > 0 && <span className="font-mono text-label">· {report.summary.danger} ✕</span>}
          </button>
        ))}
      </div>

      {tab === "rigging" && (
        <div role="tabpanel" id="panel-rigging" aria-labelledby="tab-rigging">
          <RiggingView report={report} busy={busy} onRefresh={workRigging} onPick={pick} onSaveRevision={saveRevision} onDownloadCsv={downloadCsv} />
        </div>
      )}
      {tab === "setup" && (
        <div role="tabpanel" id="panel-setup" aria-labelledby="tab-setup">
          <SetupView key={JSON.stringify(setup)} survey={survey} setup={setup} units={units} busy={busy} selectedPoint={selectedPoint} onSave={saveSetup} onSurvey={lookThrough} />
        </div>
      )}

      {tab === "drawing" && (<div role="tabpanel" id="panel-drawing" aria-labelledby="tab-drawing" className="grid min-w-0 grid-cols-1 gap-6">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Drawing" className="min-w-0 overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
            <Segmented label="Tool" value={tool} onChange={(t) => { setTool(t); setMeasure([]); }} options={[{ value: "select", label: "Select" }, { value: "measure", label: "Measure" }]} />
            <Segmented label="Snap and nudge step" value={stepIndex} onChange={setStepIndex} options={steps.map((s, i) => ({ value: String(i), label: s.label }))} />
            {doc && doc.layers.length > 1 && (
              <label className="flex items-center gap-2 text-small text-ink-2">
                Layer
                <select value={layer} onChange={(e) => setLayer(e.target.value)} className="field min-h-10 rounded-input border border-control bg-surface px-3 text-small text-ink">
                  <option value="">All layers</option>
                  {doc.layers.map((l) => <option key={l.name} value={l.name}>{l.name}{l.type === "sheet" ? " (sheet)" : ""}</option>)}
                </select>
              </label>
            )}
            <Button variant="ghost" className="ml-auto min-h-10" onClick={() => setFitSignal((n) => n + 1)}>Fit</Button>
          </div>
          {present.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 sm:px-5" role="group" aria-label="Departments">
              {present.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setVisibility({ ...visibility, [d]: NEXT_VISIBILITY[visOf(d)] })}
                  aria-label={`${DEPT_LABEL[d]}: ${VIS_WORD[visOf(d)]}. Press to change.`}
                  className={cx(
                    "flex min-h-9 items-center gap-2 rounded-full border px-3 text-small transition-colors duration-150 hover:border-control",
                    visOf(d) === "shown" ? "border-line-2 text-ink" : visOf(d) === "dimmed" ? "border-line text-ink-2" : "border-line text-muted line-through",
                  )}
                >
                  <DeptSwatch dept={d} />
                  {DEPT_LABEL[d]}
                  <span className="font-mono text-label uppercase text-muted">{VIS_WORD[visOf(d)]}</span>
                </button>
              ))}
              <Button variant="ghost" className="min-h-9 px-3 text-small" disabled={busy} onClick={sameInVectorworks}>Same in Vectorworks</Button>
            </div>
          )}
          <DrawingCanvas
            objects={drawn} units={units} selected={selected} onSelect={onSelect} onMove={moveBy}
            tool={tool} step={step} fitSignal={fitSignal} measure={measure} onMeasure={setMeasure} busy={busy}
            dimmed={dimmed} datum={datum}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-small text-muted sm:px-5">
            {tool === "measure" ? (
              <span aria-live="polite" className="tabular-nums">
                {measured !== null ? <>Distance <b className="font-medium text-ink">{formatLength(measured, units)}</b> · click again to start over</> : "Click two points. Near an object, a click snaps to its middle."}
              </span>
            ) : (
              <span>Drag to move · Shift-click or Shift-drag to add · arrows nudge · F fits</span>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="size-4 accent-ember" />
              Re-read when I come back to this tab
            </label>
          </div>
        </section>

        <Card className="min-w-0 lg:sticky lg:top-6">
          <Inspector items={items} units={units} busy={busy} fields={fields} actions={actions} />
        </Card>
      </div>

      <div className={cx("grid grid-cols-1 gap-6 [&>*]:min-w-0", fixtures.length ? "lg:grid-cols-2" : "")}>
        {fixtures.length > 0 && (
          <Card>
            <h2 className="text-h3 font-medium">Lighting devices</h2>
            <p className="mt-1 text-small text-muted">{fixtures.length} in the drawing, by channel. Pick one to edit it.</p>
            <ul className="mt-4 grid max-h-[420px] gap-1 overflow-y-auto pr-1">
              {fixtures.map((f) => (
                <li key={f.id}>
                  <ObjectRow o={f} units={units} on={selected.has(f.id)} onPick={() => onSelect([f.id], "replace")} />
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-h3 font-medium">Objects</h2>
              <p className="mt-1 text-small text-muted">{objects.length} {layer ? `on ${layer}` : "in the drawing"}{listed.length < objects.length ? `, ${listed.length} shown` : ""}.</p>
            </div>
            <label className="grid gap-1.5 text-small text-ink-2">
              Find
              <span className="field flex min-h-10 items-center rounded-input border border-control bg-surface">
                <input value={filter} onChange={(e) => setFilter(e.target.value)} size={14} className="min-w-0 bg-transparent px-3 py-1.5 text-small text-ink outline-none" />
              </span>
            </label>
          </div>
          <ul className="mt-4 grid max-h-[420px] gap-1 overflow-y-auto pr-1">
            {listed.map((o) => (
              <li key={o.id}>
                <ObjectRow o={o} units={units} on={selected.has(o.id)} onPick={() => onSelect([o.id], "replace")} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
      </div>)}
    </div>
  );
}

function ObjectRow({ o, units, on, onPick }: { o: VwObject; units: Units; on: boolean; onPick: () => void }) {
  const size = o.length !== undefined ? formatLength(o.length, units) : `${formatLength(o.width, units)} × ${formatLength(o.height, units)}`;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-tag px-3 text-left text-small text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink aria-pressed:bg-surface-2 aria-pressed:text-ink"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="w-4 shrink-0 text-ember">{on ? "✓" : ""}</span>
        <span className="truncate">{labelOf(o)}</span>
        <span className="shrink-0 font-mono text-label uppercase text-muted">{o.plugin === "Lighting Device" ? (o.fields?.["Inst Type"] ?? "fixture") : o.type.replace(/_/g, " ")}</span>
      </span>
      <span className="shrink-0 tabular-nums text-muted">{size}</span>
      {on && <span className="sr-only">(selected)</span>}
    </button>
  );
}
