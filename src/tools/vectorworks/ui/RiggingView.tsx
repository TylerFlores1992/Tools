"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { SEVERITY, STATUS, type Report } from "../show";

const LOAD_FROM: Record<string, string> = {
  Braceworks: "Braceworks",
  statics: "statics (2 picks)",
  estimate: "estimate (3+ picks)",
  "load object": "load object",
  unknown: "unknown",
};

/**
 * The rigging as it stands in the drawing: what to fix first, totals against the venue's limits,
 * every point, the mark-out order, and what changed since the last saved revision.
 */
export function RiggingView({
  report, busy, onRefresh, onPick, onSaveRevision, onDownloadCsv,
}: {
  report: Report | null;
  busy: boolean;
  onRefresh: () => void;
  onPick: (id: string) => void;
  onSaveRevision: (label: string) => void;
  onDownloadCsv: () => void;
}) {
  const [label, setLabel] = useState("");
  const [showInfo, setShowInfo] = useState(false);

  if (!report) {
    return (
      <Card>
        <Label>Rigging</Label>
        <p className="mt-3 max-w-[64ch] text-body text-ink-2">Work out every point from the drawing: loads, dead hangs and bridles, checks against the hoists and the venue’s limits, beam and roof totals, and the mark-out order.</p>
        <Button className="mt-4" disabled={busy} onClick={onRefresh}>Work out the rigging</Button>
      </Card>
    );
  }

  const checks = report.checks.filter((c) => showInfo || c.severity !== "info");
  const infoCount = report.checks.filter((c) => c.severity === "info").length;
  const ch = report.changes;
  const changeCount = ch ? ch.added.length + ch.removed.length + ch.moved.length + ch.load_changed.length : 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label>Rigging · {report.unit === "kg" ? "kilograms" : "pounds"}</Label>
          <p className="mt-2 text-body text-ink-2 tabular-nums">
            {report.summary.points} {report.summary.points === 1 ? "point" : "points"} · roof total <b className="font-medium text-ink">{report.total_text}</b>
            {report.total_limit_text !== "–" ? ` of ${report.total_limit_text}` : ""}
          </p>
          <p className="mt-1 text-small text-muted">{report.setup.datum_note}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="quiet" disabled={busy} onClick={onRefresh}>Work it out again</Button>
          <Button variant="quiet" disabled={busy} onClick={onDownloadCsv}>Download point list (CSV)</Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-h3 font-medium">Checks</h2>
          {infoCount > 0 && (
            <label className="flex items-center gap-2 text-small text-ink-2">
              <input type="checkbox" checked={showInfo} onChange={(e) => setShowInfo(e.target.checked)} className="size-4 accent-ink" />
              Show {infoCount} {infoCount === 1 ? "note" : "notes"}
            </label>
          )}
        </div>
        {checks.length === 0 ? (
          <p className="mt-3 text-small"><State kind="ok">Nothing over a limit, nothing missing.</State></p>
        ) : (
          <ul className="mt-3 grid gap-2" aria-label="Checks">
            {checks.map((c, i) => (
              <li key={i} className="flex items-start gap-3 text-small">
                <span aria-hidden="true" className={c.severity === "danger" ? "mt-0.5 w-4 shrink-0 text-center font-mono text-wrong" : "mt-0.5 w-4 shrink-0 text-center font-mono text-ink-2"}>{SEVERITY[c.severity].mark}</span>
                <span className={c.severity === "danger" ? "text-wrong" : c.severity === "warning" ? "text-ink" : "text-ink-2"}>
                  <b className="font-medium">{SEVERITY[c.severity].word}:</b> {c.text}
                  {c.ids.length > 0 && (
                    <button type="button" onClick={() => onPick(c.ids[0])} className="ml-2 underline underline-offset-4 hover:text-ink">Show</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="min-w-0">
        <h2 className="text-h3 font-medium">Points</h2>
        <p className="mt-1 text-small text-muted">X from {report.setup.cl_name}, Y from {report.setup.pl_name}. Point load includes the hoist and chain; the next column adds the dynamic factor ×{report.setup.limits.dynamic_factor}.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-small tabular-nums">
            <thead className="text-muted">
              <tr className="border-b border-line">
                {["Point", "Across", "Up/down", "Hook", "Hoist", "Load", "Point load", "With dynamic", "Steel", "Status"].map((h) => (
                  <th key={h} scope="col" className="px-2 py-2 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.points.map((p) => (
                <tr key={p.id} className="border-b border-line align-top">
                  <th scope="row" className="px-2 py-2 font-medium text-ink">
                    <button type="button" onClick={() => onPick(p.id)} className="underline-offset-4 hover:underline">{p.point || "(no ID)"}</button>
                    {p.position && <span className="block font-normal text-muted">{p.position}</span>}
                  </th>
                  <td className="px-2 py-2">{p.x_text}</td>
                  <td className="px-2 py-2">{p.y_text}</td>
                  <td className="px-2 py-2">{p.z_text}</td>
                  <td className="px-2 py-2">{p.hoist || (p.kind === "load" ? "load" : "–")}<span className="block text-muted">{p.capacity_text !== "–" ? p.capacity_text : ""}</span></td>
                  <td className="px-2 py-2">{p.load_text}<span className="block text-muted">{LOAD_FROM[p.load_source] ?? p.load_source}</span></td>
                  <td className="px-2 py-2 text-ink">{p.point_load_text}</td>
                  <td className="px-2 py-2">{p.dynamic_text}{p.utilization !== null && <span className="block text-muted">{Math.round(p.utilization * 100)}% of hoist</span>}</td>
                  <td className="px-2 py-2">
                    {p.steel.type}{p.steel.beams.length ? ` (${p.steel.beams.join(" / ")})` : ""}
                    {p.steel.bridle && (
                      <span className="block text-muted">legs {p.steel.bridle.leg_a_text} / {p.steel.bridle.leg_b_text} · {Math.round(p.steel.bridle.angle)}°</span>
                    )}
                    {p.source === "referenced" && <span className="block text-muted">from a referenced file</span>}
                  </td>
                  <td className="px-2 py-2">
                    <span className={p.status === "over" ? "text-wrong" : p.status === "ok" ? "text-ice" : "text-ink"}>
                      <span aria-hidden="true">{STATUS[p.status].mark} </span>{STATUS[p.status].word}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <h2 className="text-h3 font-medium">Mark-out order</h2>
          <p className="mt-1 text-small text-muted">Downstage to upstage, one sweep per row, rounded for the tape.</p>
          <ol className="mt-3 grid max-h-[420px] gap-1 overflow-y-auto pr-1 text-small tabular-nums">
            {report.markout.map((m) => (
              <li key={m.n} className="grid grid-cols-[2rem_1fr_auto] gap-2 rounded-tag px-2 py-1.5 hover:bg-surface-2">
                <span className="text-muted">{m.n}.</span>
                <button type="button" onClick={() => onPick(m.id)} className="text-left text-ink underline-offset-4 hover:underline">{m.point || "(no ID)"}</button>
                <span className="text-ink-2">{m.across}, {m.updown}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <h2 className="text-h3 font-medium">Totals</h2>
          <dl className="mt-3 grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5 text-small tabular-nums">
            {report.beams.map((b) => (
              <div key={b.beam} className="contents">
                <dt className="text-muted">{b.beam}</dt><dd className="text-right">{b.total_text}</dd><dd className="text-right text-muted">limit {b.limit_text}</dd>
              </div>
            ))}
            <dt className="font-medium text-ink">Roof</dt><dd className="text-right font-medium text-ink">{report.total_text}</dd><dd className="text-right text-muted">limit {report.total_limit_text}</dd>
          </dl>
          {report.trusses.length > 0 && (
            <ul className="mt-4 grid gap-1 border-t border-line pt-3 text-small text-ink-2">
              {report.trusses.map((t) => (
                <li key={t.truss}>{t.truss}: {t.length_text}, {t.hoists.length} picks, {t.items} items{t.method ? ` · ${t.method}` : ""}</li>
              ))}
            </ul>
          )}
          <form
            className="mt-5 grid gap-2 border-t border-line pt-4"
            onSubmit={(e) => { e.preventDefault(); if (label.trim()) { onSaveRevision(label.trim()); setLabel(""); } }}
          >
            <label className="grid gap-1.5 text-small text-ink-2">
              Save this point list as a revision
              <span className="field flex min-h-11 items-center rounded-input border border-control bg-surface">
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Advance v2" size={1} className="w-full min-w-0 bg-transparent px-3 py-2 text-body text-ink outline-none placeholder:text-muted" />
              </span>
            </label>
            <Button type="submit" variant="quiet" disabled={busy || !label.trim()}>Save revision</Button>
          </form>
          {report.changes_since && (
            <div className="mt-4 text-small" aria-live="polite">
              <p className="font-medium text-ink">Since “{report.changes_since}”</p>
              {changeCount === 0 ? (
                <p className="mt-1 text-ink-2">No points added, removed, moved or changed load.</p>
              ) : (
                <ul className="mt-1 grid gap-0.5 text-ink-2">
                  {ch!.added.length > 0 && <li>Added: {ch!.added.join(", ")}</li>}
                  {ch!.removed.length > 0 && <li>Removed: {ch!.removed.join(", ")}</li>}
                  {ch!.moved.length > 0 && <li>Moved: {ch!.moved.map((m) => m.point).join(", ")}</li>}
                  {ch!.load_changed.length > 0 && <li>Load changed: {ch!.load_changed.map((m) => m.point).join(", ")}</li>}
                </ul>
              )}
            </div>
          )}
        </Card>
      </div>
      <p className="max-w-[72ch] text-small text-muted">
        Loads come from Braceworks when it has calculated; otherwise from statics (two picks on a truss) or a continuous-beam estimate (three or more), which depends on how level the hoists are. Check estimates with Braceworks, load cells or an engineer before you fly.
      </p>
    </div>
  );
}
