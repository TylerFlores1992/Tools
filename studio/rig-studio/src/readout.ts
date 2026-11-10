// A Vectorworks read-out (<name>.rigread.json, written by the connector's read_out tool) turned
// into Rig Studio reference layers: lighting fixtures, the existing truss and rigging, and the
// drawing's outlines one layer per Vectorworks layer. Inches throughout; the drawing's own origin.
import type { Fixture, Layer, Mesh, RigItem, Shape } from "./model.ts";
import { parseLength } from "./model.ts";

export type ReadoutObject = {
  t: string;
  layer: string;
  cls: string;
  bbox: [number, number, number, number];
  name?: string;
  at?: [number, number, number];
  rot?: number;
  symbol?: string;
  plugin?: string;
  fields?: Record<string, string>;
  pts?: [number, number][];
  closed?: boolean;
  z?: [number, number];
  source?: string;
  fill?: string;
  /** The symbol this shape was drawn from (read-outs draw what's inside symbols). */
  in?: string;
  /** Its real 3D faces (connector 0.7+). */
  mesh?: Mesh;
  /** Where its faces are when they came in a separate part file (mesh_parts). */
  mid?: number;
};

export type Readout = {
  readout: 1;
  document: string;
  path?: string;
  version?: string;
  units: "in";
  layers: { name: string; type: string; elevation?: number; visible?: boolean }[];
  classes: string[];
  objects: ReadoutObject[];
  trimmed?: number;
  truncated?: boolean;
  /** Part files beside this one holding the 3D faces ("<drawing>.rigmesh1.json"…), when it was too big for one. */
  mesh_parts?: string[];
};

/** Put the faces from the part files back on their objects. Returns how many objects got faces. */
export function attachMeshes(r: Readout, parts: { meshes?: Record<string, Mesh> }[]): number {
  const all: Record<string, Mesh> = {};
  for (const p of parts) Object.assign(all, p.meshes ?? {});
  let n = 0;
  for (const o of r.objects) {
    if (o.mid === undefined) continue;
    const m = all[String(o.mid)];
    if (m && Array.isArray(m.v) && Array.isArray(m.f)) {
      o.mesh = m;
      n++;
    }
  }
  return n;
}

export function isReadout(x: unknown): x is Readout {
  const r = x as Readout;
  return !!r && r.readout === 1 && r.units === "in" && Array.isArray(r.objects) && Array.isArray(r.layers);
}

const TRUSS = /truss/i;
const RIGGING = /hoist|motor|chain|rigging point|bridle|dead ?hang|load|base plate|tower|sleeve|head ?block|ground support/i;
const FIXTURE = "Lighting Device";

/** A length field in inches ("10'", "120", "3.05m"), or null. */
function len(fields: Record<string, string> | undefined, ...names: string[]): number | null {
  for (const n of names) {
    const v = fields?.[n];
    if (v !== undefined && v !== "") {
      const x = parseLength(v, 1);
      if (x !== null && x > 0) return x;
    }
  }
  return null;
}

function weight(fields: Record<string, string> | undefined): number {
  const raw = String(fields?.["Weight"] ?? fields?.["Inst Weight"] ?? "");
  const m = raw.match(/\d+(?:\.\d+)?/);
  if (!m) return 0;
  return Math.round(Number(m[0]) * (/kg/i.test(raw) ? 2.20462 : 1) * 10) / 10;
}

/** A handful of a plug-in's fields worth keeping for Claude (sizes, capacities, names), not all 200. */
function keyFields(fields: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    if (!v || v.length > 60) continue;
    if (/length|type|size|capacity|weight|height|trim|model|manufacturer|load|span|name|id|label|series/i.test(k)) out[k] = v;
    if (Object.keys(out).length >= 14) break;
  }
  return out;
}

/** One straight truss: from its insertion along its rotation for its length, when it has one. */
function trussItem(o: ReadoutObject): RigItem {
  const at = o.at ?? [(o.bbox[0] + o.bbox[2]) / 2, (o.bbox[1] + o.bbox[3]) / 2, 0];
  const L = len(o.fields, "Length", "Truss Length", "Overall Length", "Section Length");
  const item: RigItem = { kind: "truss", name: o.plugin || o.symbol || "Truss", at, fields: keyFields(o.fields), layer: o.layer };
  if (L) {
    const a = ((o.rot ?? 0) * Math.PI) / 180;
    item.b = [at[0] + Math.cos(a) * L, at[1] + Math.sin(a) * L, at[2]];
  } else item.bbox = o.bbox;
  return item;
}

const chunk = <T,>(xs: T[], size: number) => Array.from({ length: Math.ceil(xs.length / size) }, (_, i) => xs.slice(i * size, (i + 1) * size));

/**
 * The layers for a read-out. Shapes come one layer per Vectorworks design layer, split so no
 * layer document passes ~150 KB; only the stage- and venue-looking ones start visible.
 */
export function readoutLayers(r: Readout, source: Layer["source"], at: string): Omit<Layer, "id">[] {
  const fixtures: Fixture[] = [];
  const rig: RigItem[] = [];
  const shapes = new Map<string, Shape[]>();
  const elev = new Map(r.layers.map((l) => [l.name, l.elevation ?? 0]));
  for (const o of r.objects) {
    const name = `${o.plugin ?? ""} ${o.symbol ?? ""} ${o.name ?? ""} ${o.cls}`;
    if (o.plugin === FIXTURE && o.at) {
      const f = o.fields ?? {};
      fixtures.push({ x: o.at[0], y: o.at[1], z: o.at[2] || len(f, "Z Location", "Z") || 0, lb: weight(f), type: String(f["Inst Type"] ?? f["Instrument Type"] ?? f["Symbol Name"] ?? "Fixture").slice(0, 60), id: f["Channel"] ? `ch ${f["Channel"]}` : undefined });
    } else if ((o.plugin || o.symbol) && !o.in && TRUSS.test(name)) {
      rig.push(trussItem(o));
    } else if ((o.plugin || o.symbol) && !o.in && RIGGING.test(name)) {
      rig.push({ kind: /hoist|motor|chain/i.test(name) ? "hoist" : "other", name: o.plugin || o.symbol || "Rigging", at: o.at ?? [(o.bbox[0] + o.bbox[2]) / 2, (o.bbox[1] + o.bbox[3]) / 2, 0], fields: keyFields(o.fields), layer: o.layer });
    }
    // Every outline is drawn too, rig pieces included: a 3D plug-in (a door, a deck) or a symbol's
    // parts come as blocks with their bottom, height and fill colour.
    if (o.pts && o.pts.length >= 2 && o.plugin !== FIXTURE) {
      const base = elev.get(o.layer) ?? 0;
      const z = o.z ? o.z[0] + base : base;
      const h = o.z ? Math.max(0, o.z[1] - o.z[0]) : 0;
      const list = shapes.get(o.layer) ?? [];
      const mesh = o.mesh && o.mesh.v.length >= 9 ? { m: o.mesh, ...(base ? { mz: base } : {}) } : {};
      list.push({ pts: o.pts, z, closed: !!o.closed, ...(h > 0 ? { h } : {}), ...(o.fill && /^#[0-9a-f]{6}$/i.test(o.fill) ? { fill: o.fill } : {}), ...(o.name ? { label: o.name } : {}), ...mesh });
      shapes.set(o.layer, list);
    }
  }
  // Named after the file in Dropbox (a converted older drawing reads out as "x_v2025_v2026").
  const doc = (source?.name ?? r.document).replace(/\.rigread\.json$/i, "").replace(/\.vwx$/i, "");
  const out: Omit<Layer, "id">[] = [];
  if (fixtures.length) out.push({ name: `${doc}: lighting`, kind: "fixtures", visible: true, onRig: true, at, fixtures, source });
  for (const [i, part] of chunk(rig, 600).entries()) out.push({ name: `${doc}: existing rig${i ? ` (${i + 1})` : ""}`, kind: "rig", visible: true, at, rig: part, source });
  const looksLikeStage = /stage|deck|venue|site|floor|ground|plan|audience|house|base/i;
  for (const [layer, list] of shapes) {
    let size = 0;
    let part: Shape[] = [];
    const parts: Shape[][] = [];
    for (const s of list) {
      const n = 40 + s.pts.length * 18 + (s.m ? (s.m.v.length + s.m.f.length) * 6 : 0);
      if (size + n > 150_000 && part.length) {
        parts.push(part);
        part = [];
        size = 0;
      }
      part.push(s);
      size += n;
    }
    if (part.length) parts.push(part);
    // Shown as in the drawing: the layers visible there start visible here (older read-outs: by name).
    const vis = r.layers.find((l) => l.name === layer)?.visible;
    for (const [i, p] of parts.entries()) out.push({ name: `${doc}: ${layer}${parts.length > 1 ? ` (${i + 1})` : ""}`, kind: "shapes", visible: vis ?? looksLikeStage.test(layer), at, shapes: p, source });
  }
  return out;
}

/** What a read-out holds, in a sentence, for the page and for Claude. */
export function readoutSummary(r: Readout): string {
  const lds = r.objects.filter((o) => o.plugin === FIXTURE).length;
  const truss = r.objects.filter((o) => (o.plugin || o.symbol) && TRUSS.test(`${o.plugin ?? ""} ${o.symbol ?? ""} ${o.name ?? ""} ${o.cls}`)).length;
  const shapes = r.objects.filter((o) => o.pts).length;
  return `${r.document}: ${lds} lighting fixtures, ${truss} truss pieces, ${shapes} outlines on ${r.layers.filter((l) => l.type !== "sheet").length} design layers${r.trimmed ? ` (${r.trimmed} small outlines left out to fit)` : ""}.`;
}
