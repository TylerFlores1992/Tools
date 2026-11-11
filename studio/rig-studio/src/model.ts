// What Rig Studio keeps in its artifact database (docs/RIG-STUDIO.md has the same shapes for
// sessions that read and write it), plus small pure helpers the page and its tests share.
import type { Sketch, SketchLoad } from "../../../src/tools/rig/sketch.ts";

export type Status = "draft" | "approved" | "built";

/** projects/{pid} */
export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: Status;
  /** Latest version number. */
  current: number;
  approved: number | null;
  built: number | null;
  /** The project's Dropbox folder. */
  dropbox: { path: string; display: string } | null;
  /** Dropbox file id → the modified time last looked at, so changed files can be flagged. */
  seen: Record<string, string>;
  /** Off the main list (nothing deleted). */
  archived?: boolean;
  /** Kept at the top of the list; earlier pins first. */
  pinnedAt?: string | null;
};

/** The order of the project list: pinned first (in the order they were pinned), then the most
 * recently changed. */
export function sortProjects<T extends Pick<Project, "updatedAt" | "pinnedAt">>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (!!a.pinnedAt !== !!b.pinnedAt) return a.pinnedAt ? -1 : 1;
    if (a.pinnedAt && b.pinnedAt) return a.pinnedAt.localeCompare(b.pinnedAt);
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/** projects/{pid}/versions/{v0001} */
export type Version = { n: number; note: string; by: "you" | "claude" | "session"; at: string; sketch: Sketch };

export type Fixture = { x: number; y: number; z: number; lb: number; type?: string; id?: string };
/** A drawn outline, in inches. `h` (from a Vectorworks read-out): a 3D object's height above `z`,
 * drawn as a block; `fill`: its fill colour from the drawing. */
/** A drawing's real 3D faces (from a read-out): corners `v` as x, y, z in steps of `q` inches (each
 * corner once), faces `f` as [n, i1..in, n, ...]. */
export type Mesh = { q: number; v: number[]; f: number[] };
export type Shape = { pts: [number, number][]; z?: number; closed?: boolean; label?: string; h?: number; fill?: string; m?: Mesh; /** Only in this view (a hybrid symbol's 2D plan graphics or its 3D part). */ v?: "plan" | "3d"; /** The layer's elevation, added to the faces' heights. */ mz?: number; /** Its place in the drawing's order, for a flat fill: later ones are drawn on top. */ n?: number; /** Fill opacity 0-100 when see-through. */ fo?: number;
  /** The line's colour in the drawing ("#rrggbb"); absent = black. */ pen?: string;
  /** Line weight in mils, when heavier than hairline. */ lw?: number;
  /** No outline (its pen is off). */ np?: 1;
  /** Hatched: drawn with diagonal lines over its fill. */ hatch?: 1;
  /** Text (or a dimension's figure) at pts[0], height in inches, turned by rot degrees; a dimension's line is pts[1]-pts[2]. */ text?: string; size?: number; rot?: number; dim?: 1 };
/** Truss and rigging already in a drawing (from a Vectorworks read-out). `b` when a truss's length is known. */
export type RigItem = { kind: "truss" | "hoist" | "other"; name: string; at: [number, number, number]; b?: [number, number, number]; bbox?: [number, number, number, number]; fields?: Record<string, string>; layer?: string };

/** projects/{pid}/layers/{lid}: reference drawings the rig is laid out over. */
export type Layer = {
  id: string;
  name: string;
  /** The drawing layer this is part of, when a big one is stored in several documents (each holds
   * at most 256 KB): the Layers list shows one row per group. */
  group?: string;
  kind: "image" | "fixtures" | "shapes" | "rig";
  visible: boolean;
  at: string;
  /** Where it came from, so a newer copy in Dropbox can be flagged. */
  source?: { name: string; dropboxId?: string; modified?: string; from: "upload" | "dropbox" | "vectorworks" | "session" };
  // image
  asset?: string;
  px?: [number, number];
  widthIn?: number;
  x?: number;
  y?: number;
  z?: number;
  rot?: number;
  opacity?: number;
  // fixtures
  fixtures?: Fixture[];
  /** Fixtures' weight counts on the rig. */
  onRig?: boolean;
  // shapes
  shapes?: Shape[];
  // rig (existing truss and rigging)
  rig?: RigItem[];
};

/** projects/{pid}/chat/{mid} */
export type Message = { role: "you" | "claude" | "session"; text: string; at: string; job?: string; version?: number; images?: string[] };

/** jobs/{jid}: a full Claude session started from the page. */
export type Job = {
  id: string;
  pid: string;
  project: string;
  request: string;
  where: "cloud" | "pc";
  /** waking: the cloud worker is checking or waking the PC; the page hands the job over after. */
  status: "queued" | "waking" | "running" | "done" | "failed";
  progress?: string;
  /** Waking: the PC answered (the cloud worker sets it). */
  awake?: boolean;
  /** Waking: the page has started the PC worker with `text`. */
  handed?: boolean;
  /** Waking: the job message for the PC worker. */
  text?: string;
  /** "readout": asked of the PC's connector through a request file in Dropbox (no session). */
  kind?: "readout";
  /** The Dropbox file id a file job is about (its status shows under that file). */
  file?: string;
  reply?: string;
  at: string;
  updated?: string;
  session?: string;
  version?: number;
  /** Off the Home list (the record is kept). */
  archived?: boolean;
  pinnedAt?: string | null;
};

/** Sessions on Home: pinned first (in the order pinned), then newest. */
export function sortJobs<T extends Pick<Job, "at" | "pinnedAt">>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (!!a.pinnedAt !== !!b.pinnedAt) return a.pinnedAt ? -1 : 1;
    if (a.pinnedAt && b.pinnedAt) return a.pinnedAt.localeCompare(b.pinnedAt);
    return b.at.localeCompare(a.at);
  });
}

/** config/workers: the two scheduled tasks the page starts sessions with. */
export type Workers = { cloud?: string; pc?: string; artifact?: string; wake?: boolean };

/**
 * Which scheduled task a job fires. With `wake` on (the PC waker is set up, config/pcwaker), a PC
 * job first goes to the cloud worker, which checks the PC and wakes it if it's asleep; when the
 * job says `awake`, the page starts the PC worker itself (an unattended session may not start
 * another scheduled task, and a sleeping PC can't start one on itself).
 */
export function routeJob(w: Workers | null, where: "cloud" | "pc"): { trigger?: string; wake: boolean } {
  if (where === "pc" && w?.wake && w.cloud && w.pc) return { trigger: w.cloud, wake: true };
  return { trigger: where === "pc" ? w?.pc : w?.cloud, wake: false };
}

const HANDOFF_WINDOW_MS = 30 * 60_000;

/** A waking job the page should now hand to the PC worker (awake, not yet handed, not stale). */
export function needsHandoff(j: Job, now: number): boolean {
  return j.status === "waking" && !!j.awake && !j.handed && !!j.text && now - Date.parse(j.at) < HANDOFF_WINDOW_MS;
}

/** Is a job still going? (A file's button waits while one is.) */
export const jobActive = (j: Job) => j.status === "queued" || j.status === "waking" || j.status === "running";

/** The job's state in words, with a symbol that isn't colour: ◌ going, ✓ done, ✕ stopped. */
export function jobWords(j: Job): string {
  if (j.status === "done") return `✓ Done. ${j.reply ?? ""}`.trim();
  if (j.status === "failed") return `✕ Stopped. ${j.reply ?? j.progress ?? ""}`.trim();
  if (j.status === "waking") return `◌ ${j.progress || "Checking whether your PC is on…"}`;
  if (j.status === "queued") return `◌ ${j.progress || "Starting the session…"}`;
  return `◌ ${j.progress || "Working…"}`;
}

export const vid = (n: number) => `v${String(n).padStart(4, "0")}`;

export function slug(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
  return `${s || "project"}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Feet and inches the way a rigger writes them: 22'-4½". */
export function ftIn(inches: number): string {
  const neg = inches < 0;
  let x = Math.round(Math.abs(inches) * 2) / 2;
  const ft = Math.floor(x / 12);
  x -= ft * 12;
  const whole = Math.floor(x);
  const half = x - whole >= 0.5 ? "½" : "";
  const inch = whole || half ? `${whole || ""}${half}"` : "";
  const out = ft ? `${ft}'${inch ? `-${inch}` : ""}` : inch || `0"`;
  return neg ? `−${out}` : out;
}

export function ago(iso: string | undefined, now = Date.now()): string {
  if (!iso) return "";
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "yesterday" : d < 30 ? `${d} days ago` : new Date(iso).toLocaleDateString();
}

/**
 * A length as Vectorworks writes it (20'-6", 246", 6.25m, 1800mm, or a bare number in document
 * units) → inches. `upi` is the document's units per inch.
 */
export function parseLength(raw: unknown, upi = 1): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw / upi : null;
  const s = String(raw ?? "").trim().replace(/[″”]/g, '"').replace(/[′’]/g, "'");
  if (!s) return null;
  const ftin = s.match(/^(-?\d+(?:\.\d+)?)\s*'\s*-?\s*(?:(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?\s*"?)?$/);
  if (ftin) {
    const ft = Number(ftin[1]);
    const inch = Number(ftin[2] ?? 0) + (ftin[3] ? Number(ftin[3]) / Number(ftin[4]) : 0);
    return ft * 12 + Math.sign(ft || 1) * inch;
  }
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|m|in|"|ft)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  switch (m[2]) {
    case "mm":
      return n / 25.4;
    case "cm":
      return n / 2.54;
    case "m":
      return (n * 1000) / 25.4;
    case "ft":
      return n * 12;
    case "in":
    case '"':
      return n;
    default:
      return n / upi;
  }
}

/**
 * Lighting devices as the connector's get_lighting_devices returns them ({units, devices: [{id,
 * location: [x, y], z, fields: {"Inst Type", "Weight": "55 lb", …}, bbox}]}) → fixtures in inches.
 */
export function fixturesFromVectorworks(res: unknown): Fixture[] {
  const r = res as { units?: { units_per_inch?: number }; devices?: Record<string, unknown>[] };
  const upi = r?.units?.units_per_inch || 1;
  const out: Fixture[] = [];
  for (const d of r?.devices ?? []) {
    const bbox = d.bbox as [[number, number], [number, number]] | undefined;
    const loc = (d.location as [number, number] | undefined) ?? (bbox ? [(bbox[0][0] + bbox[1][0]) / 2, (bbox[0][1] + bbox[1][1]) / 2] : undefined);
    if (!loc) continue;
    const f = (d.fields ?? (d.records as Record<string, Record<string, unknown>> | undefined)?.["Lighting Device"] ?? {}) as Record<string, unknown>;
    const zField = parseLength(f["Z Location"] ?? f["Z"], upi);
    const z = typeof d.z === "number" ? d.z / upi : (zField ?? 0);
    const w = String(f["Weight"] ?? "").match(/\d+(?:\.\d+)?/);
    const kg = /kg/i.test(String(f["Weight"] ?? ""));
    out.push({
      x: loc[0] / upi,
      y: loc[1] / upi,
      z,
      lb: w ? Math.round(Number(w[0]) * (kg ? 2.20462 : 1) * 10) / 10 : 0,
      type: String(f["Inst Type"] ?? f["Instrument Type"] ?? d.name ?? "Fixture").slice(0, 60),
      id: String(d.id ?? ""),
    });
  }
  return out;
}

/** A CSV with x, y, z (feet unless the header says in), weight and type columns → fixtures. */
export function fixturesFromCsv(text: string): { fixtures: Fixture[]; problem?: string } {
  const rows = text.split(/\r?\n/).filter((l) => l.trim());
  if (rows.length < 2) return { fixtures: [], problem: "The file needs a header row and at least one fixture." };
  const split = (l: string) => l.split(/,|\t/).map((c) => c.trim().replace(/^"|"$/g, ""));
  const head = split(rows[0]).map((h) => h.toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h === n || h.startsWith(n + " ") || h.startsWith(n + "(")));
  const [ix, iy, iz] = [col("x"), col("y"), col("z", "height", "trim")];
  if (ix < 0 || iy < 0) return { fixtures: [], problem: "Couldn't find x and y columns in the header." };
  const inches = head.some((h) => /\b(in|inch|inches)\b|"/.test(h));
  const k = inches ? 1 : 12;
  const iw = col("weight", "lb", "lbs");
  const it = col("type", "instrument type", "fixture", "name");
  const fixtures: Fixture[] = [];
  for (const r of rows.slice(1)) {
    const c = split(r);
    const x = parseLength(c[ix], 1 / k);
    const y = parseLength(c[iy], 1 / k);
    if (x === null || y === null) continue;
    fixtures.push({ x, y, z: iz >= 0 ? (parseLength(c[iz], 1 / k) ?? 0) : 0, lb: iw >= 0 ? Number(c[iw]) || 0 : 0, type: it >= 0 ? c[it] : undefined });
  }
  return fixtures.length ? { fixtures } : { fixtures, problem: "No rows had numbers in the x and y columns." };
}

/** Fixtures whose weight counts on the rig, as loads for the planning checks. */
export function layerLoads(layers: Layer[]): SketchLoad[] {
  return layers.flatMap((l) =>
    l.kind === "fixtures" && l.onRig && l.visible ? (l.fixtures ?? []).filter((f) => f.lb > 0).map((f, i) => ({ id: `${l.id}:${i}`, at: [f.x, f.y, f.z] as [number, number, number], lb: f.lb, label: f.type ?? "Fixture" })) : [],
  );
}

/** A short description of a layer for Claude: where it is and what's in it, not every point. */
export function layerSummary(l: Layer): string {
  if (l.kind === "image") return `${l.id} "${l.name}": drawing underlay, ${ftIn(l.widthIn ?? 0)} wide, lower-left corner at x ${ftIn(l.x ?? 0)}, y ${ftIn(l.y ?? 0)}, ${l.visible ? "shown" : "hidden"}`;
  if (l.kind === "fixtures") {
    const f = l.fixtures ?? [];
    if (!f.length) return `${l.id} "${l.name}": no fixtures`;
    const xs = f.map((p) => p.x);
    const ys = f.map((p) => p.y);
    const zs = [...new Set(f.map((p) => Math.round(p.z)))].sort((a, b) => a - b);
    const lb = f.reduce((s, p) => s + p.lb, 0);
    return `${l.id} "${l.name}": ${f.length} fixtures, x ${ftIn(Math.min(...xs))} to ${ftIn(Math.max(...xs))}, y ${ftIn(Math.min(...ys))} to ${ftIn(Math.max(...ys))}, heights ${zs.slice(0, 8).map(ftIn).join(", ")}${zs.length > 8 ? "…" : ""}, ${Math.round(lb)} lb${l.onRig ? " (counted on the rig)" : ""}`;
  }
  if (l.kind === "rig") {
    const r = l.rig ?? [];
    const truss = r.filter((x) => x.kind === "truss");
    const hoists = r.filter((x) => x.kind === "hoist").length;
    return `${l.id} "${l.name}": existing rig from the drawing, ${truss.length} truss pieces (${truss.filter((t) => t.b).length} with a length), ${hoists} hoists, ${r.length - truss.length - hoists} other rigging`;
  }
  const s = l.shapes ?? [];
  return `${l.id} "${l.name}": ${s.length} outlines${s[0]?.label ? ` (${s.slice(0, 5).map((x) => x.label).join(", ")})` : ""}`;
}

/** Read-out requests and answers travel as small files beside the drawing in Dropbox. */
export const REQUEST_SUFFIX = ".rigrequest.json";
export const STATUS_SUFFIX = ".rigstatus.json";
export const READOUT_PICKUP_MS = 20 * 60_000;
export const isNoteFile = (name: string) => name.toLowerCase().endsWith(REQUEST_SUFFIX) || name.toLowerCase().endsWith(STATUS_SUFFIX) || /\.rigmesh\d+\.json$/i.test(name);
export const statusName = (vwxName: string) => vwxName.replace(/\.vwx$/i, "") + STATUS_SUFFIX;
export const requestName = (vwxName: string, job: string) => `${vwxName.replace(/\.vwx$/i, "")}.${job}${REQUEST_SUFFIX}`;

/** What the PC's status file says, as job fields (or null if it's about another job). */
export function fromStatus(st: { job?: string; state?: string; message?: string } | null, jobId: string): Partial<Job> | null {
  if (!st || st.job !== jobId) return null;
  if (st.state === "done") return { status: "done", reply: st.message ?? "Read out on your PC." };
  if (st.state === "failed") return { status: "failed", reply: st.message ?? "Your PC couldn't read it out." };
  if (st.state === "reading") return { status: "running", progress: st.message ?? "Your PC is reading it out…" };
  return null;
}

/** Rows for the Layers list: a drawing layer stored in several documents is one row. Older layers
 * without `group` are grouped by their "<name> (n)" names from the same source. */
export type LayerRow = { key: string; name: string; layers: Layer[] };
export function layerRows(layers: Layer[]): LayerRow[] {
  const rows: LayerRow[] = [];
  const byKey = new Map<string, LayerRow>();
  for (const l of layers) {
    const m = /^(.*) \((\d+)\)$/.exec(l.name);
    const name = l.group ?? (m && l.source ? m[1] : l.name);
    const key = l.group || (m && l.source) ? `${l.source?.dropboxId ?? l.source?.name ?? ""}|${l.kind}|${name}` : `id|${l.id}`;
    let row = byKey.get(key);
    if (!row) {
      row = { key, name, layers: [] };
      byKey.set(key, row);
      rows.push(row);
    }
    row.layers.push(l);
  }
  return rows;
}

/** A database write that waits and tries again when the store is busy (too many writes at once, a
 * blip); anything else (full, bad document) fails at once. */
export async function saveWithRetry<T>(write: () => Promise<T>, tries = 4, wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms))): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await write();
    } catch (er) {
      const code = (er as { code?: string }).code;
      if (i >= tries || (code !== "resource_exhausted" && code !== "unavailable")) throw er;
      await wait(800 * i + Math.random() * 400);
    }
  }
}
