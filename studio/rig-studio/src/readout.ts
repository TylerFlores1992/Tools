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
  /** Where its faces are when they came in a separate part file (mesh_parts); "s<id>" for faces
   * shared by every copy of a symbol part. */
  mid?: number | string;
  /** Faces shared by every copy of a symbol part, in the main file's `shared` (connector 0.9.12+). */
  sm?: string;
  /** Matrix from the shared faces' own coordinates into the drawing: [3x3 by rows, then x, y, z]. */
  mx?: number[];
  /** Turned in 3D about x, y, z (degrees), when tipped (a symbol stood up). */
  rot3d?: [number, number, number];
  /** A hybrid symbol's part: its 2D graphics ("plan") or its 3D part ("3d"). */
  view?: "plan" | "3d";
  /** Fill opacity 0-100, when under 100. */
  fo?: number;
  /** Its place in the drawing's order, when the read-out came in several files. */
  k?: number;
  /** Line colour ("#rrggbb", absent = black), weight in mils (absent = hairline), no outline, hatched (connector 0.9+). */
  pen?: string;
  lw?: number;
  np?: 1;
  hatch?: 1;
  /** In a class that's switched off in Vectorworks: not drawn there, so not here. */
  hid?: 1;
  /** A text or dimension's words and height in inches. */
  text?: string;
  size?: number;
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
  /** Faces shared by every copy of a symbol part, when the read-out fits in one file. */
  shared?: Record<string, Mesh>;
  /** Classes switched off in the drawing (connector 0.9.3+). */
  hidden_classes?: string[];
  /** Each sheet's viewports: design layers (0 shown, -1 hidden, 2 greyed) and the classes they show
   * differently from the drawing (connector 0.9.2+). */
  viewports?: SheetView[];
};

export type SheetView = { sheet: string; name: string; layers: Record<string, number>; classes: Record<string, number> };

/** The ways a read-out can be shown: the design layers as Vectorworks has them, or as a sheet's
 * viewport does (a sheet can show layers and classes the design layers hide). */
export function readoutViews(r: Pick<Readout, "viewports">): { key: string; label: string }[] {
  const seen = new Set<string>();
  const out = [{ key: "", label: "Design layers" }];
  for (const v of r.viewports ?? []) {
    const key = `${v.sheet}/${v.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label: v.name && v.name !== v.sheet ? `Sheet ${v.sheet} (${v.name})` : `Sheet ${v.sheet}` });
  }
  return out;
}

/** Put the part files back together with the read-out: the faces onto their objects, and the
 * shapes that didn't fit in the main file back into its objects. Returns how many objects got faces. */
export function attachMeshes(r: Readout, parts: { meshes?: Record<string, Mesh>; objects?: ReadoutObject[] }[]): number {
  const all: Record<string, Mesh> = {};
  for (const p of parts) Object.assign(all, p.meshes ?? {});
  for (const p of parts) if (Array.isArray(p.objects)) r.objects.push(...p.objects);
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
const HEX = /^#[0-9a-f]{6}$/i;
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
/** Taller than this and around the whole drawing: a building, not part of the set. */
const BUILDING_TOP = 240;
const BUILDING = "\u0000building";
/** A building's wall or door frame: stands on the floor (within this), at least this tall, and within
 * this of the building's outline. */
const WALL_FOOT = 12;
const DOOR_HIGH = 84;
const WALL_REACH = 36;

const CURVED = /circle|circular|\barc\b|curve|curved|round|ring/i;
/** A large piece about as deep as it is wide: a ring of truss, not a straight run. */
const squareRing = (o: ReadoutObject) => {
  const w = o.bbox[2] - o.bbox[0], d = o.bbox[3] - o.bbox[1];
  return Math.min(w, d) > 240 && Math.min(w, d) / Math.max(w, d) > 0.6;
};

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
export function readoutLayers(r: Readout, source: Layer["source"], at: string, viewKey = ""): Omit<Layer, "id">[] {
  // Shown as a sheet's viewport: its layer and class visibility instead of the design layers'.
  const view = viewKey ? r.viewports?.find((v) => `${v.sheet}/${v.name}` === viewKey) : undefined;
  const docHidden = new Set(r.hidden_classes ?? []);
  const clsHidden = (c: string) => (view && c in view.classes ? view.classes[c] === -1 : docHidden.has(c));
  let topCls = "";
  const fixtures: Fixture[] = [];
  const rig: RigItem[] = [];
  const shapes = new Map<string, Shape[]>();
  const elev = new Map(r.layers.map((l) => [l.name, l.elevation ?? 0]));
  // The drawing's own order (what Vectorworks paints on top comes later): layers in the read-out's
  // layer order, then each object's place in the drawing (`k`, kept when the read-out was split).
  const layerRank = new Map(r.layers.map((l, i) => [l.name, i]));
  const ordered = r.objects.some((o) => o.k !== undefined) ? [...r.objects].sort((a, b) => (a.k ?? 0) - (b.k ?? 0)) : r.objects;
  let seq = 0;
  let order = 0;
  // Whether a layer shows in Vectorworks (as the sheet's viewport has it, or the design layer itself).
  const layerVis = new Map(r.layers.map((l) => [l.name, l.visible]));
  const shown = (layer: string) => (view && layer in view.layers ? view.layers[layer] !== -1 : layerVis.get(layer));
  const hiddenFixtures: Fixture[] = [];
  const hiddenRig: RigItem[] = [];
  // A building drawn around everything (a venue's walls and roof): its own row, starting hidden, or
  // in 3D nothing inside it can be seen (Weakest Link's 50' walls and roof hid the whole set).
  const floor = [Infinity, Infinity, -Infinity, -Infinity];
  for (const o of r.objects) {
    if (o.in || shown(o.layer) === false || (o.z && o.z[1] >= BUILDING_TOP)) continue;
    floor[0] = Math.min(floor[0], o.bbox[0]); floor[1] = Math.min(floor[1], o.bbox[1]);
    floor[2] = Math.max(floor[2], o.bbox[2]); floor[3] = Math.max(floor[3], o.bbox[3]);
  }
  const fw = floor[2] - floor[0], fd = floor[3] - floor[1];
  const enclosing = (o: ReadoutObject) =>
    !o.in && !!o.z && o.z[1] >= BUILDING_TOP && fw > 0 && fd > 0 &&
    o.bbox[2] - o.bbox[0] >= 0.85 * fw && o.bbox[3] - o.bbox[1] >= 0.85 * fd;
  // The building's own walls and doorways go with it: loose pieces on its layer that stand on the
  // floor, are door height or more, and sit along its outline (Weakest Link's 55' side wall and the
  // door frames in its corners stayed behind and hid the set).
  const shells = r.objects.filter(enclosing);
  const venuePiece = (o: ReadoutObject) =>
    !o.in && !!o.z && o.z[0] <= WALL_FOOT && o.z[1] - o.z[0] >= DOOR_HIGH &&
    shells.some((b) => b.layer === o.layer && b !== o &&
      (o.bbox[0] - b.bbox[0] <= WALL_REACH || b.bbox[2] - o.bbox[2] <= WALL_REACH ||
       o.bbox[1] - b.bbox[1] <= WALL_REACH || b.bbox[3] - o.bbox[3] <= WALL_REACH));
  // A symbol with no 2D graphics of its own shows its 3D part in Top/Plan too (Vectorworks draws it
  // from above, as a wireframe): only a copy that has plan graphics hides its 3D part there. Weakest
  // Link's 1,583 deck, leg and truss copies are 3D only, so Plan showed none of the set.
  const planless = new Set<ReadoutObject>();
  {
    let copy: ReadoutObject[] = [];
    let hasPlan = false;
    const close = () => { if (!hasPlan) for (const c of copy) planless.add(c); };
    for (const o of ordered) {
      if (!o.in) { close(); copy = []; hasPlan = false; continue; }
      copy.push(o);
      if (o.view === "plan") hasPlan = true;
    }
    close();
  }
  const tag = (o: ReadoutObject) => (o.view && !(o.view === "3d" && planless.has(o)) ? { v: o.view } : {});
  for (const o of ordered) {
    order = (layerRank.get(o.layer) ?? 0) * 1_000_000 + seq++;
    const name = `${o.plugin ?? ""} ${o.symbol ?? ""} ${o.name ?? ""} ${o.cls}`;
    // Lights and rig on layers or classes Vectorworks doesn't show go in rows that start hidden, as there.
    const off = shown(o.layer) === false || (view && r.hidden_classes ? clsHidden(o.cls) : !!o.hid);
    const fixtures_ = off ? hiddenFixtures : fixtures;
    const rig_ = off ? hiddenRig : rig;
    if (o.plugin === FIXTURE && o.at) {
      const f = o.fields ?? {};
      fixtures_.push({ x: o.at[0], y: o.at[1], z: o.at[2] || len(f, "Z Location", "Z") || 0, lb: weight(f), type: String(f["Inst Type"] ?? f["Instrument Type"] ?? f["Symbol Name"] ?? "Fixture").slice(0, 60), id: f["Channel"] ? `ch ${f["Channel"]}` : undefined });
    } else if ((o.plugin || o.symbol) && !o.in && TRUSS.test(name)) {
      // Listed for Claude and the loads, but only boxed when the drawing has nothing of its own to
      // draw: a symbol's parts or real faces already show it as it is. Boxes for those floated
      // beside the real truss (stood-up towers drawn flat, spacers as cubes) and an 80' circle
      // became a square slab over the stage (Weakest Link).
      const own = !!(o.symbol || o.mesh || o.mid !== undefined || o.sm !== undefined) || CURVED.test(name) || squareRing(o);
      rig_.push({ ...trussItem(o), ...(own ? { drawn: true as const } : {}) });
    } else if ((o.plugin || o.symbol) && !o.in && RIGGING.test(name)) {
      rig_.push({ kind: /hoist|motor|chain/i.test(name) ? "hoist" : "other", name: o.plugin || o.symbol || "Rigging", at: o.at ?? [(o.bbox[0] + o.bbox[2]) / 2, (o.bbox[1] + o.bbox[3]) / 2, 0], fields: keyFields(o.fields), layer: o.layer });
    }
    // Classes switched off in Vectorworks don't draw there, so they don't here either. As a sheet: the
    // viewport's classes, the object's own and the class of the symbol it's part of.
    if (!o.in) topCls = o.cls;
    if (view && r.hidden_classes ? clsHidden(o.cls) || (!!o.in && clsHidden(topCls)) : o.hid) continue;
    const ink = { ...(o.pen && HEX.test(o.pen) ? { pen: o.pen } : {}), ...(o.lw && o.lw > 7 ? { lw: o.lw } : {}) };
    if ((o.t === "text" || o.t === "dimension") && o.at && o.text) {
      // Words as the plan shows them: the text itself, or a dimension's figure and its line.
      const text = o.text.replace(/\r\n?|\n/g, "\n").replace(/^\n+|\n+$/g, "");
      if (!text) continue;
      const base = elev.get(o.layer) ?? 0;
      const at: [number, number] = [o.at[0], o.at[1]];
      const pts: [number, number][] = o.t === "dimension" && o.pts?.length === 2 ? [at, o.pts[0], o.pts[1]] : [at];
      const list = shapes.get(o.layer) ?? [];
      list.push({ pts, z: base, text, size: Math.max(1, o.size ?? 9), ...(o.rot ? { rot: o.rot } : {}), ...(o.t === "dimension" ? { dim: 1 as const } : {}), ...tag(o), ...ink });
      shapes.set(o.layer, list);
      continue;
    }
    // Every outline is drawn too, rig pieces included: a 3D plug-in (a door, a deck) or a symbol's
    // parts come as blocks with their bottom, height and fill colour.
    if (o.pts && o.pts.length >= 2 && o.plugin !== FIXTURE) {
      const base = elev.get(o.layer) ?? 0;
      const z = o.z ? o.z[0] + base : base;
      const h = o.z ? Math.max(0, o.z[1] - o.z[0]) : 0;
      const list = shapes.get(o.layer) ?? [];
      // Real faces for things with height; a flat object (bottom = top) is drawn as a flat fill, so it
      // keeps its opacity and its place in the drawing's order.
      const faces = o.mesh ?? (o.sm !== undefined ? r.shared?.[o.sm] : undefined);
      const mesh = faces && faces.v.length >= 9 && h > 0 ? { m: faces, ...(o.mx?.length === 12 ? { mx: o.mx } : {}), ...(base ? { mz: base } : {}) } : {};
      const into = enclosing(o) || venuePiece(o) ? (shapes.get(BUILDING) ?? shapes.set(BUILDING, []).get(BUILDING)!) : list;
      into.push({ pts: o.pts, z, closed: !!o.closed, ...(h > 0 ? { h } : {}), ...(o.fill && /^#[0-9a-f]{6}$/i.test(o.fill) ? { fill: o.fill } : {}), ...(o.name ? { label: o.name } : {}), ...tag(o), ...(o.closed && o.fill && !(o.z && o.z[1] > o.z[0]) ? { n: order } : {}), ...(o.fo !== undefined && o.fo < 100 ? { fo: o.fo } : {}), ...ink, ...(o.np ? { np: 1 as const } : {}), ...(o.hatch && o.closed ? { hatch: 1 as const } : {}), ...mesh });
      shapes.set(o.layer, list);
    }
  }
  // Named after the file in Dropbox (a converted older drawing reads out as "x_v2025_v2026").
  const doc = (source?.name ?? r.document).replace(/\.rigread\.json$/i, "").replace(/\.vwx$/i, "");
  const out: Omit<Layer, "id">[] = [];
  if (fixtures.length) out.push({ name: `${doc}: lighting`, kind: "fixtures", visible: true, onRig: true, at, fixtures, source });
  if (hiddenFixtures.length) out.push({ name: `${doc}: lighting on hidden layers`, kind: "fixtures", visible: false, onRig: true, at, fixtures: hiddenFixtures, source });
  for (const [i, part] of chunk(rig, 600).entries()) out.push({ name: `${doc}: existing rig${i ? ` (${i + 1})` : ""}`, group: `${doc}: existing rig`, kind: "rig", visible: true, at, rig: part, source });
  for (const [i, part] of chunk(hiddenRig, 600).entries()) out.push({ name: `${doc}: existing rig on hidden layers${i ? ` (${i + 1})` : ""}`, group: `${doc}: existing rig on hidden layers`, kind: "rig", visible: false, at, rig: part, source });
  const looksLikeStage = /stage|deck|venue|site|floor|ground|plan|audience|house|base/i;
  for (const [layer, list] of shapes) {
    let size = 0;
    let part: Shape[] = [];
    const parts: Shape[][] = [];
    for (const s of list) {
      const n = 40 + (s.text?.length ?? 0) + s.pts.length * 18 + (s.m ? (s.m.v.length + s.m.f.length) * 6 : 0);
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
    const vis = layer === BUILDING ? false : view && layer in view.layers ? view.layers[layer] !== -1 : r.layers.find((l) => l.name === layer)?.visible;
    const title = layer === BUILDING ? "building around everything" : layer;
    for (const [i, p] of parts.entries()) out.push({ name: `${doc}: ${title}${parts.length > 1 ? ` (${i + 1})` : ""}`, group: `${doc}: ${title}`, kind: "shapes", visible: vis ?? looksLikeStage.test(layer), at, shapes: p, source });
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
