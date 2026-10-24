"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { center, labelOf, unionBounds, type VwObject } from "../geometry";
import { formatArea, formatLength, type Units } from "../units";
import { DEPT_LABEL } from "../show";
import { LengthField } from "./LengthField";

/** Fields a person edits on a lighting device from the panel. */
export const FIXTURE_FIELDS = ["Channel", "Unit Number", "Purpose", "Color", "Position", "Inst Type"] as const;

export type InspectorActions = {
  moveBy: (dx: number, dy: number) => void;
  rotate: (deg: number) => void;
  duplicate: () => void;
  remove: () => void;
  showInVectorworks: () => void;
  saveFields: (fields: Record<string, string>) => void;
  loadFields: (id: string) => void;
};

export function Inspector({
  items, units, busy, fields, actions,
}: {
  items: VwObject[]; units: Units; busy: boolean; fields: Record<string, string> | null; actions: InspectorActions;
}) {
  const [dx, setDx] = useState({ text: "", v: null as number | null });
  const [dy, setDy] = useState({ text: "", v: null as number | null });
  const one = items.length === 1 ? items[0] : null;
  const isFixture = one?.plugin === "Lighting Device";
  // Objects shown through a viewport or from a referenced file can't be changed from here.
  const readOnly = items.some((o) => o.source && o.source !== "native");
  const ids = items.map((o) => o.id).join(",");
  // "Really delete?" belongs to the selection it was asked about; a new selection drops it.
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const confirmDelete = confirmFor === ids;
  const setConfirmDelete = (on: boolean) => setConfirmFor(on ? ids : null);
  useEffect(() => {
    if (one && isFixture) actions.loadFields(one.id);
  }, [one?.id, isFixture]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!items.length) {
    return (
      <div>
        <Label>Nothing selected</Label>
        <p className="mt-3 text-body text-ink-2">Click something in the drawing, Shift-drag a box around a few, or pick one from the list below.</p>
      </div>
    );
  }

  const b = unionBounds(items)!;
  const c = one?.location ?? center(b);
  const len = (n: number | undefined) => formatLength(n, units);
  const pair = items.length === 2 ? gap(items[0], items[1]) : null;

  return (
    <div className="grid gap-5">
      <div>
        <Label>{one ? (one.plugin || one.type.replace(/_/g, " ")) : `${items.length} selected`}</Label>
        <h2 className="mt-2 text-h3 font-medium [overflow-wrap:anywhere]">{one ? labelOf(one) : items.map(labelOf).slice(0, 3).join(", ") + (items.length > 3 ? "…" : "")}</h2>
        {one && <p className="mt-1 text-small text-muted">Layer {one.layer} · Class {one.cls}</p>}
        {one?.dept && (
          <p className="mt-1 text-small text-muted">
            {DEPT_LABEL[one.dept]} <span className="text-muted">({one.dept_how === "set" ? "set by you" : "guessed from its names"})</span>
          </p>
        )}
        {readOnly && (
          <p className="mt-3 text-small">
            <State kind="note">
              {items.some((o) => o.source === "referenced") ? "From a referenced file: read-only here. Change it in its own file." : "Shown through a viewport: read-only here. Change it on its own layer."}
            </State>
          </p>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-small tabular-nums">
        <dt className="text-muted">Width</dt><dd className="text-right">{len(b[1][0] - b[0][0])}</dd>
        <dt className="text-muted">Depth</dt><dd className="text-right">{len(b[1][1] - b[0][1])}</dd>
        {one?.length !== undefined && (<><dt className="text-muted">Length</dt><dd className="text-right">{len(one.length)}</dd></>)}
        {one?.perimeter !== undefined && (<><dt className="text-muted">Perimeter</dt><dd className="text-right">{len(one.perimeter)}</dd></>)}
        {one?.area !== undefined && (<><dt className="text-muted">Area</dt><dd className="text-right">{formatArea(one.area, units)}</dd></>)}
        <dt className="text-muted">{one?.location ? "Insertion point" : "Center"}</dt>
        <dd className="text-right">{one?.where ?? `${len(c[0])}, ${len(c[1])}`}</dd>
        {one?.z !== undefined && (<><dt className="text-muted">Height</dt><dd className="text-right">{len(one.z)}</dd></>)}
        {one?.z_min !== undefined && one?.z_max !== undefined && (<><dt className="text-muted">Bottom to top</dt><dd className="text-right">{len(one.z_min)} to {len(one.z_max)}</dd></>)}
        {pair && (
          <>
            <dt className="text-muted">Center to center</dt><dd className="text-right">{len(pair.centers)}</dd>
            <dt className="text-muted">Clear gap</dt><dd className="text-right">{pair.gap > 0 ? len(pair.gap) : "Touching or overlapping"}</dd>
          </>
        )}
      </dl>

      {readOnly ? null : isFixture && <FixtureFields key={`${one!.id}:${JSON.stringify(fields)}`} fields={fields} busy={busy} onSave={actions.saveFields} />}

      {!readOnly && (<>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (dx.v === null && dy.v === null) return;
          actions.moveBy(dx.v ?? 0, dy.v ?? 0);
        }}
      >
        <p className="text-small font-medium text-ink">Move by</p>
        <div className="grid grid-cols-2 gap-3">
          <LengthField label="Across (+ right)" units={units} value={dx.text} placeholder={`0"`} onChange={(text, v) => setDx({ text, v })} />
          <LengthField label="Up (+ up)" units={units} value={dy.text} placeholder={`0"`} onChange={(text, v) => setDy({ text, v })} />
        </div>
        <Button type="submit" variant="quiet" disabled={busy || (dx.v === null && dy.v === null)}>Move</Button>
      </form>

      <div className="grid grid-cols-2 gap-2">
        {one && <Button variant="quiet" className="px-3" disabled={busy} onClick={() => actions.rotate(90)} aria-label="Rotate 90 degrees counter-clockwise">Rotate ↺ 90°</Button>}
        {one && <Button variant="quiet" className="px-3" disabled={busy} onClick={() => actions.rotate(-90)} aria-label="Rotate 90 degrees clockwise">Rotate ↻ 90°</Button>}
        <Button variant="quiet" className="col-span-2" disabled={busy} onClick={actions.duplicate}>Duplicate</Button>
        <Button variant="quiet" className="col-span-2" disabled={busy} onClick={actions.showInVectorworks}>Select in Vectorworks</Button>
      </div>

      <div className="border-t border-line pt-4">
        {confirmDelete ? (
          <div className="grid gap-2">
            <State kind="wrong">Delete {items.length === 1 ? "this" : `these ${items.length}`} from the drawing?</State>
            <div className="flex gap-2">
              <Button variant="quiet" disabled={busy} onClick={() => { setConfirmDelete(false); actions.remove(); }}>Yes, delete</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete…</Button>
        )}
      </div>
      </>)}
    </div>
  );
}

function FixtureFields({ fields, busy, onSave }: { fields: Record<string, string> | null; busy: boolean; onSave: (f: Record<string, string>) => void }) {
  const [draft, setDraft] = useState<Record<string, string>>({}); // reset by the key when fields reload
  if (!fields) return <p className="text-small text-muted" aria-live="polite">Reading the fixture’s fields…</p>;
  const changed = Object.fromEntries(Object.entries(draft).filter(([k, v]) => v !== (fields[k] ?? "")));
  return (
    <form
      className="grid gap-3 rounded-input border border-line p-4"
      onSubmit={(e) => { e.preventDefault(); if (Object.keys(changed).length) onSave(changed); }}
    >
      <p className="text-small font-medium text-ink">Fixture fields</p>
      <div className="grid grid-cols-2 gap-3">
        {FIXTURE_FIELDS.map((f) => (
          <label key={f} className="grid min-w-0 gap-1.5 text-small text-ink-2">
            {f}
            <span className="field flex min-h-11 items-center rounded-input border border-control bg-surface">
              <input
                value={draft[f] ?? fields[f] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
                size={1}
                className="w-full min-w-0 bg-transparent px-3 py-2 text-body text-ink outline-none"
              />
            </span>
          </label>
        ))}
      </div>
      <Button type="submit" variant="quiet" disabled={busy || !Object.keys(changed).length}>
        {Object.keys(changed).length ? `Save ${Object.keys(changed).length} ${Object.keys(changed).length === 1 ? "change" : "changes"}` : "No changes"}
      </Button>
    </form>
  );
}

function gap(a: VwObject, b: VwObject) {
  const ca = a.location ?? center(a.bbox);
  const cb = b.location ?? center(b.bbox);
  const gx = Math.max(0, Math.max(a.bbox[0][0], b.bbox[0][0]) - Math.min(a.bbox[1][0], b.bbox[1][0]));
  const gy = Math.max(0, Math.max(a.bbox[0][1], b.bbox[0][1]) - Math.min(a.bbox[1][1], b.bbox[1][1]));
  return { centers: Math.hypot(cb[0] - ca[0], cb[1] - ca[1]), gap: Math.hypot(gx, gy) };
}
