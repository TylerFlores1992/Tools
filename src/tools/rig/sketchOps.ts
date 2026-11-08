// Small, checkable edits to a sketch: what Claude sends from Rig Studio's chat (and what a full
// session can send too) instead of retyping the whole rig. Each edit is validated as a whole.
import { readSketch, type Sketch } from "./sketch.ts";
import type { Vec3 } from "./types.ts";

export type SketchOp =
  | { op: "add_run"; a: Vec3; b: Vec3; id?: string; label?: string }
  | { op: "add_tower"; x: number; y: number; height?: number; id?: string; label?: string }
  | { op: "add_point"; at: Vec3; kind?: "hoist" | "deadhang"; capacity?: number; id?: string; label?: string }
  | { op: "add_load"; at: Vec3; lb: number; label: string; id?: string }
  | { op: "remove"; ids: string[] }
  | { op: "move"; ids: string[]; by: Vec3 }
  | { op: "update"; id: string; [field: string]: unknown }
  | { op: "set"; name?: string; series?: "box12" | "box20"; towerLimit?: number }
  | { op: "clear" };

const PREFIX = { runs: "r", towers: "t", points: "p", loads: "l" } as const;

function nextId(sk: Sketch, kind: keyof typeof PREFIX, taken: Set<string>): string {
  for (let i = 1; ; i++) {
    const id = `${PREFIX[kind]}${i}`;
    if (!taken.has(id)) {
      taken.add(id);
      return id;
    }
  }
}

const shift = (p: Vec3, d: Vec3): Vec3 => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];

/** Apply edits in order. Returns the new sketch and what changed, or the problems in words. */
export function applyOps(start: Sketch, ops: SketchOp[]): { sketch: Sketch; changes: string[] } | { problems: string[] } {
  const sk: Sketch = structuredClone(start);
  const taken = new Set([...sk.runs, ...sk.towers, ...sk.points, ...sk.loads].map((x) => x.id));
  const changes: string[] = [];
  const problems: string[] = [];
  const all = () => [...sk.runs, ...sk.towers, ...sk.points, ...sk.loads];
  for (const [i, o] of ops.entries()) {
    const where = `edit ${i + 1} (${(o as { op?: string }).op ?? "?"})`;
    switch (o.op) {
      case "add_run":
        sk.runs.push({ id: o.id ?? nextId(sk, "runs", taken), a: o.a, b: o.b, ...(o.label ? { label: o.label } : {}) });
        changes.push(`added run ${o.label ?? sk.runs[sk.runs.length - 1].id}`);
        break;
      case "add_tower":
        sk.towers.push({ id: o.id ?? nextId(sk, "towers", taken), x: o.x, y: o.y, ...(o.height ? { height: o.height } : {}), ...(o.label ? { label: o.label } : {}) });
        changes.push(`added tower ${o.label ?? sk.towers[sk.towers.length - 1].id}`);
        break;
      case "add_point":
        sk.points.push({ id: o.id ?? nextId(sk, "points", taken), at: o.at, kind: o.kind ?? "hoist", capacity: o.capacity ?? 2000, ...(o.label ? { label: o.label } : {}) });
        changes.push(`added ${o.kind === "deadhang" ? "dead-hang" : "hoist"} ${o.label ?? sk.points[sk.points.length - 1].id}`);
        break;
      case "add_load":
        sk.loads.push({ id: o.id ?? nextId(sk, "loads", taken), at: o.at, lb: o.lb, label: o.label });
        changes.push(`added ${o.label} (${o.lb} lb)`);
        break;
      case "remove": {
        const missing = o.ids.filter((id) => !all().some((x) => x.id === id));
        if (missing.length) problems.push(`${where}: no ${missing.join(", ")}`);
        const gone = new Set(o.ids);
        sk.runs = sk.runs.filter((x) => !gone.has(x.id));
        sk.towers = sk.towers.filter((x) => !gone.has(x.id));
        sk.points = sk.points.filter((x) => !gone.has(x.id));
        sk.loads = sk.loads.filter((x) => !gone.has(x.id));
        changes.push(`removed ${o.ids.length}`);
        break;
      }
      case "move": {
        const ids = new Set(o.ids);
        let n = 0;
        for (const r of sk.runs) if (ids.has(r.id)) ((r.a = shift(r.a, o.by)), (r.b = shift(r.b, o.by)), n++);
        for (const t of sk.towers) if (ids.has(t.id)) ((t.x += o.by[0]), (t.y += o.by[1]), n++);
        for (const p of sk.points) if (ids.has(p.id)) ((p.at = shift(p.at, o.by)), n++);
        for (const l of sk.loads) if (ids.has(l.id)) ((l.at = shift(l.at, o.by)), n++);
        if (n < ids.size) problems.push(`${where}: some ids weren't found`);
        changes.push(`moved ${n}`);
        break;
      }
      case "update": {
        const { op: _op, id, ...fields } = o;
        void _op;
        const target = all().find((x) => x.id === id) as Record<string, unknown> | undefined;
        if (!target) problems.push(`${where}: no ${id}`);
        else {
          Object.assign(target, fields, { id });
          changes.push(`changed ${id}`);
        }
        break;
      }
      case "set":
        if (o.name !== undefined) sk.name = o.name;
        if (o.series !== undefined) sk.series = o.series;
        if (o.towerLimit !== undefined) sk.towerLimit = o.towerLimit;
        changes.push("changed settings");
        break;
      case "clear":
        sk.runs = [];
        sk.towers = [];
        sk.points = [];
        sk.loads = [];
        changes.push("cleared the drawing");
        break;
      default:
        problems.push(`${where}: unknown edit`);
    }
  }
  if (problems.length) return { problems };
  const r = readSketch(sk);
  if (!r.sketch) return { problems: r.problems };
  return { sketch: r.sketch, changes };
}
