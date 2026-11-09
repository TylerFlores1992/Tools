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
export type Shape = { pts: [number, number][]; z?: number; closed?: boolean; label?: string };

/** projects/{pid}/layers/{lid}: reference drawings the rig is laid out over. */
export type Layer = {
  id: string;
  name: string;
  kind: "image" | "fixtures" | "shapes";
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
  status: "queued" | "running" | "done" | "failed";
  progress?: string;
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
export type Workers = { cloud?: string; pc?: string; artifact?: string };

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
  const s = l.shapes ?? [];
  return `${l.id} "${l.name}": ${s.length} outlines${s[0]?.label ? ` (${s.slice(0, 5).map((x) => x.label).join(", ")})` : ""}`;
}
