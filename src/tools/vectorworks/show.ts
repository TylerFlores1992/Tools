// The show around the drawing: departments, the datum, and the rigging report, as the connector
// sends them (connectors/vectorworks/src/vwmcp/service.py, report.py). Pure data + maths; tested.

import type { Department, Pt } from "./geometry";

export const DEPT_LABEL: Record<Department, string> = {
  venue: "Venue",
  rigging: "Rigging",
  lighting: "Lighting",
  audio: "Audio",
  video: "Video",
  scenic: "Scenic",
  staging: "Staging",
  other: "Other",
};

/**
 * How each department is drawn. The owner is red-green colour-blind, so departments differ by
 * line pattern and weight, never by colour; the legend shows each pattern next to its name.
 */
export const DEPT_STYLE: Record<Department, { dash?: string; width: number }> = {
  venue: { dash: "1 4", width: 1.4 }, // dotted: the building, background
  rigging: { width: 2 }, // heavy solid: what the rigger owns
  lighting: { width: 1.2 }, // solid
  audio: { dash: "7 3", width: 1.3 }, // dashed
  video: { dash: "12 4", width: 1.3 }, // long dash
  scenic: { dash: "8 3 2 3", width: 1.3 }, // dash-dot
  staging: { dash: "2 2", width: 1 }, // fine dots
  other: { width: 0.8 }, // hairline
};

export type Visibility = "shown" | "dimmed" | "hidden";

export const NEXT_VISIBILITY: Record<Visibility, Visibility> = { shown: "dimmed", dimmed: "hidden", hidden: "shown" };

export type Limits = {
  weight_unit: "lb" | "kg";
  point_limit: number | null;
  beam_limit: number | null;
  total_limit: number | null;
  max_bridle_angle: number;
  high_steel: number | null;
  dynamic_factor: number;
  truss_weight_per_ft: number;
  cable_allowance_per_ft: number;
  chain_weight_per_ft: number;
  hoist_warn_fraction: number;
  default_hoist_wll: number | string | null;
  min_point_spacing: number | null;
};

export type Setup = {
  document: string;
  datum_origin: Pt;
  upstage: Pt;
  cl_name: string;
  pl_name: string;
  datum_note: string;
  datum_set: boolean;
  metric: boolean;
  x_positive: "SL" | "SR";
  departments: Record<string, Department>;
  limits: Limits;
};

export type Check = { severity: "danger" | "warning" | "info"; text: string; ids: string[] };

export type PointRow = {
  id: string;
  point: string;
  kind: string;
  position: string;
  x: number;
  y: number;
  x_text: string;
  y_text: string;
  where: string;
  z_text: string;
  hoist: string;
  capacity_text: string;
  trim: string;
  load_text: string;
  load_source: "Braceworks" | "statics" | "estimate" | "load object" | "unknown";
  point_load_text: string;
  dynamic_text: string;
  utilization: number | null;
  steel: {
    type: "dead hang" | "bridle" | "no steel" | "unknown";
    beams: string[];
    bridle?: { leg_a_text: string; leg_b_text: string; angle: number; tension_a: number; tension_b: number };
  };
  status: "ok" | "high" | "over" | "unknown";
  notes: string[];
  source: string;
};

export type Report = {
  unit: "lb" | "kg";
  points: PointRow[];
  trusses: { truss: string; length_text: string; hoists: string[]; items: number; method: string | null }[];
  beams: { beam: string; total_text: string; limit_text: string }[];
  total_text: string;
  total_limit_text: string;
  checks: Check[];
  summary: { points: number; danger: number; warning: number };
  markout: { n: number; point: string; id: string; across: string; updown: string; steel: string }[];
  changes: { added: string[]; removed: string[]; moved: { point: string; by: number }[]; load_changed: { point: string }[] } | null;
  changes_since: string | null;
  setup: Setup;
};

export type Survey = {
  document: string;
  counts: { native: number; viewport: number; referenced: number };
  layers: { name: string; type: string; objects: number; dept: Department; dept_how: string; referenced_file: string | null; visibility: string }[];
  classes: { name: string; objects: number; dept: Department }[];
  viewports: { name: string; layer: string; objects: number; referenced: boolean }[];
  plugins: { name: string; count: number; kind: string; fields: string[] }[];
  situation: string[];
  setup: Setup;
};

/** The CL and PL (or DSE) lines through the datum, long enough to cross the view: [a, b] in drawing units. */
export function datumAxes(origin: Pt, upstage: Pt, reach: number): { cl: [Pt, Pt]; pl: [Pt, Pt] } {
  const n = Math.hypot(upstage[0], upstage[1]) || 1;
  const [ux, uy] = [upstage[0] / n, upstage[1] / n];
  const [lx, ly] = [uy, -ux]; // stage left: upstage turned 90° clockwise
  return {
    cl: [[origin[0] - ux * reach, origin[1] - uy * reach], [origin[0] + ux * reach, origin[1] + uy * reach]],
    pl: [[origin[0] - lx * reach, origin[1] - ly * reach], [origin[0] + lx * reach, origin[1] + ly * reach]],
  };
}

/** Status in words, with the mark that carries it (never colour alone). */
export const STATUS: Record<PointRow["status"], { mark: string; word: string }> = {
  ok: { mark: "✓", word: "OK" },
  high: { mark: "!", word: "Over 80% of hoist" },
  over: { mark: "✕", word: "Over a limit" },
  unknown: { mark: "?", word: "Load unknown" },
};

export const SEVERITY: Record<Check["severity"], { mark: string; word: string }> = {
  danger: { mark: "✕", word: "Danger" },
  warning: { mark: "!", word: "Warning" },
  info: { mark: "i", word: "Note" },
};
