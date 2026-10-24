"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { Segmented } from "@/components/Segmented";
import { State } from "@/components/State";
import type { SetupChange } from "../client";
import { DEPARTMENTS, type Department, type Pt } from "../geometry";
import { DEPT_LABEL, DEPT_STYLE, type Setup, type Survey } from "../show";
import { formatLength, parseLength, type Units } from "../units";
import { LengthField } from "./LengthField";

type Upstage = "up" | "down" | "left" | "right";
const UPSTAGE: { value: Upstage; label: string }[] = [
  { value: "up", label: "Up the page" },
  { value: "down", label: "Down" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];
const fromVector = (u: Pt): Upstage => (Math.abs(u[0]) > Math.abs(u[1]) ? (u[0] > 0 ? "right" : "left") : u[1] < 0 ? "down" : "up");

/** Small sample of a department's line pattern, for the legend. */
export function DeptSwatch({ dept }: { dept: Department }) {
  const s = DEPT_STYLE[dept];
  return (
    <svg aria-hidden="true" width="28" height="10" viewBox="0 0 28 10" className="shrink-0 text-ink-2">
      <line x1="1" y1="5" x2="27" y2="5" stroke="currentColor" strokeWidth={s.width + 0.4} strokeDasharray={s.dash} />
    </svg>
  );
}

/**
 * Setting a show up the way a head rigger does: see what arrived and from where, put the datum
 * where the show measures from, say what the venue allows, and sort layers into departments.
 */
export function SetupView({
  survey, setup, units, busy, selectedPoint, onSave, onSurvey,
}: {
  survey: Survey | null;
  setup: Setup | null;
  units: Units;
  busy: boolean;
  selectedPoint: Pt | null;
  onSave: (change: SetupChange) => void;
  onSurvey: () => void;
}) {
  const s = setup;
  const len = (v: number | null | undefined) => (v === null || v === undefined ? "" : formatLength(v, units));
  const [ox, setOx] = useState(s ? len(s.datum_origin[0]) : "");
  const [oy, setOy] = useState(s ? len(s.datum_origin[1]) : "");
  const [up, setUp] = useState<Upstage>(s ? fromVector(s.upstage) : "up");
  const [cl, setCl] = useState(s?.cl_name ?? "CL");
  const [pl, setPl] = useState(s?.pl_name ?? "PL");
  const [unit, setUnit] = useState<"lb" | "kg">(s?.limits.weight_unit ?? "lb");
  const num = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const [lim, setLim] = useState({
    point_limit: num(s?.limits.point_limit), beam_limit: num(s?.limits.beam_limit), total_limit: num(s?.limits.total_limit),
    dynamic_factor: num(s?.limits.dynamic_factor ?? 1.2), truss_weight_per_ft: num(s?.limits.truss_weight_per_ft), cable_allowance_per_ft: num(s?.limits.cable_allowance_per_ft),
  });
  const [steel, setSteel] = useState(len(s?.limits.high_steel));
  const [depts, setDepts] = useState<Record<string, Department | "auto">>({});

  const datumOk = parseLength(ox, units) !== null && parseLength(oy, units) !== null;
  const perLen = unit === "lb" ? "per ft" : "per m";

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Label>What arrived</Label>
            <h2 className="mt-2 text-h3 font-medium [overflow-wrap:anywhere]">{survey?.document ?? "This drawing"}</h2>
          </div>
          <Button variant="quiet" disabled={busy} onClick={onSurvey}>{survey ? "Look again" : "Look through the file"}</Button>
        </div>
        {survey && (
          <div className="mt-4 grid gap-4">
            <p className="text-small text-ink-2 tabular-nums">
              {survey.counts.native} {survey.counts.native === 1 ? "object" : "objects"} in this file · {survey.counts.viewport} through viewports · {survey.counts.referenced} from referenced files
            </p>
            {survey.situation.length > 0 && (
              <ul className="grid gap-1.5 text-small">
                {survey.situation.map((t, i) => <li key={i}><State kind="note">{t}</State></li>)}
              </ul>
            )}
            {survey.viewports.length > 0 && (
              <div>
                <p className="text-small font-medium text-ink">Design layer viewports</p>
                <ul className="mt-1 grid gap-1 text-small text-ink-2">
                  {survey.viewports.map((v) => (
                    <li key={v.name + v.layer}>{v.name || "(unnamed)"} on {v.layer}: {v.objects} {v.objects === 1 ? "object" : "objects"} · {v.referenced ? "referenced file, read-only" : "this file"}</li>
                  ))}
                </ul>
              </div>
            )}
            {survey.plugins.length > 0 && (
              <div>
                <p className="text-small font-medium text-ink">Plug-in objects found</p>
                <ul className="mt-1 grid gap-1 text-small text-ink-2">
                  {survey.plugins.map((p) => (
                    <li key={p.name}>{p.name} × {p.count}{p.kind ? ` · read as ${p.kind.replace("_", " ")}` : ""}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <Label>Datum</Label>
          <p className="mt-2 text-small text-ink-2">Where {cl} meets {pl}: the point every position is measured from. {s?.datum_set ? "" : "Not set yet."}</p>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const x = parseLength(ox, units), y = parseLength(oy, units);
              if (x === null || y === null) return;
              onSave({ datum: { origin: [x, y], upstage: up, cl_name: cl.trim() || "CL", pl_name: pl.trim() || "PL" } });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <LengthField label="Datum X (drawing)" units={units} value={ox} onChange={(t) => setOx(t)} />
              <LengthField label="Datum Y (drawing)" units={units} value={oy} onChange={(t) => setOy(t)} />
            </div>
            {selectedPoint && (
              <Button variant="ghost" className="justify-self-start" onClick={() => { setOx(len(selectedPoint[0])); setOy(len(selectedPoint[1])); }}>
                Use the selected object’s position
              </Button>
            )}
            <div className="grid gap-1.5">
              <p className="text-small text-ink-2">Upstage is toward the page’s…</p>
              <Segmented label="Upstage direction" value={up} onChange={setUp} options={UPSTAGE} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Centerline is called" value={cl} onChange={setCl} />
              <TextField label="Measure up/downstage from" value={pl} onChange={setPl} hint="PL, DSE, setting line…" />
            </div>
            <Button type="submit" variant="quiet" disabled={busy || !datumOk}>Save datum</Button>
          </form>
        </Card>

        <Card>
          <Label>Venue limits</Label>
          <p className="mt-2 text-small text-ink-2">From the venue’s rigging packet. Leave blank what it doesn’t say.</p>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const n = (v: string) => (v.trim() === "" ? null : Number(v));
              onSave({
                limits: {
                  weight_unit: unit, point_limit: n(lim.point_limit), beam_limit: n(lim.beam_limit), total_limit: n(lim.total_limit),
                  dynamic_factor: n(lim.dynamic_factor) ?? 1, truss_weight_per_ft: n(lim.truss_weight_per_ft) ?? 0, cable_allowance_per_ft: n(lim.cable_allowance_per_ft) ?? 0,
                  high_steel: steel.trim() === "" ? null : steel,
                },
              });
            }}
          >
            <Segmented label="Weight unit" value={unit} onChange={setUnit} options={[{ value: "lb", label: "lb" }, { value: "kg", label: "kg" }]} />
            <div className="grid grid-cols-2 gap-3">
              <NumField label={`Per point (${unit})`} value={lim.point_limit} onChange={(v) => setLim({ ...lim, point_limit: v })} />
              <NumField label={`Per beam (${unit})`} value={lim.beam_limit} onChange={(v) => setLim({ ...lim, beam_limit: v })} />
              <NumField label={`Roof total (${unit})`} value={lim.total_limit} onChange={(v) => setLim({ ...lim, total_limit: v })} />
              <LengthField label="High steel (floor to bottom chord)" units={units} value={steel} onChange={(t) => setSteel(t)} />
              <NumField label="Dynamic factor" value={lim.dynamic_factor} onChange={(v) => setLim({ ...lim, dynamic_factor: v })} />
              <NumField label={`Truss weight (${unit} ${perLen})`} value={lim.truss_weight_per_ft} onChange={(v) => setLim({ ...lim, truss_weight_per_ft: v })} />
              <NumField label={`Cable allowance (${unit} ${perLen})`} value={lim.cable_allowance_per_ft} onChange={(v) => setLim({ ...lim, cable_allowance_per_ft: v })} />
            </div>
            <Button type="submit" variant="quiet" disabled={busy}>Save limits</Button>
          </form>
        </Card>
      </div>

      {survey && (
        <Card>
          <Label>Departments</Label>
          <p className="mt-2 text-small text-ink-2">Guessed from layer names. Change any that are wrong; it’s remembered for this file.</p>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(e) => { e.preventDefault(); if (Object.keys(depts).length) { onSave({ departments: depts }); setDepts({}); } }}
          >
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {survey.layers.filter((l) => l.objects > 0).map((l) => {
                const key = `layer:${l.name}`;
                const value = depts[key] ?? (l.dept_how === "set" ? l.dept : "auto");
                return (
                  <li key={l.name} className="grid gap-1.5">
                    <label className="flex min-w-0 items-center gap-2 text-small text-ink-2" htmlFor={`dept-${l.name}`}>
                      <DeptSwatch dept={l.dept} />
                      <span className="truncate">{l.name}</span>
                      <span className="shrink-0 text-muted">({l.objects})</span>
                    </label>
                    <select
                      id={`dept-${l.name}`}
                      value={value}
                      onChange={(e) => setDepts({ ...depts, [key]: e.target.value as Department | "auto" })}
                      className="field min-h-10 rounded-input border border-control bg-surface px-3 text-small text-ink"
                    >
                      <option value="auto">Guess ({DEPT_LABEL[l.dept]})</option>
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{DEPT_LABEL[d]}</option>)}
                    </select>
                  </li>
                );
              })}
            </ul>
            <Button type="submit" variant="quiet" className="justify-self-start" disabled={busy || !Object.keys(depts).length}>Save departments</Button>
          </form>
        </Card>
      )}
    </div>
  );
}

function TextField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-small text-ink-2">
      {label}
      <span className="field flex min-h-11 items-center rounded-input border border-control bg-surface">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={hint} size={1} className="w-full min-w-0 bg-transparent px-3 py-2 text-body text-ink outline-none placeholder:text-muted" />
      </span>
    </label>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const bad = value.trim() !== "" && !Number.isFinite(Number(value));
  return (
    <label className="grid min-w-0 gap-1.5 text-small text-ink-2">
      {label}
      <span className={`field flex min-h-11 items-center rounded-input border bg-surface ${bad ? "border-wrong" : "border-control"}`}>
        <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" size={1} aria-invalid={bad || undefined} className="w-full min-w-0 bg-transparent px-3 py-2 text-body tabular-nums text-ink outline-none" />
      </span>
      {bad && <span role="alert" className="flex items-center gap-1.5 text-wrong"><span aria-hidden="true">✕</span> Enter a number.</span>}
    </label>
  );
}
