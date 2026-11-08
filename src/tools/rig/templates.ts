import { DECK, ROOF } from "./catalog.ts";
import type { BraceMode, RailMode, RigDesign, RigParams, TemplateId } from "./types.ts";

export type Field =
  /** `step` is what a stepper press moves; `snap` (default: step) is the grid a typed value rounds to. */
  | { key: "width" | "depth" | "height" | "trim" | "braceLength"; label: string; kind: "length"; min: number; max: number; step: number; snap?: number }
  | { key: "series"; label: string; kind: "series" }
  | { key: "braces"; label: string; kind: "braces"; options: readonly BraceMode[] }
  | { key: "skirt" | "spine"; label: string; kind: "toggle"; on: string; off: string }
  | { key: "rail"; label: string; kind: "rail"; options: readonly RailMode[] }
  | { key: "stairs" | "towers"; label: string; kind: "count"; min: number; max: number }
  | { key: "towerLimit"; label: string; kind: "weight"; min: number; max: number; step: number };

export type Template = {
  id: TemplateId;
  name: string;
  blurb: string;
  fields: readonly Field[];
  defaults: RigParams;
  /** Starts on its own truss size instead of carrying over the one in use (the roof is 20.5" box). */
  ownSeries?: boolean;
};

const BASE: RigParams = {
  series: "box12", width: 120, depth: 120, height: 120, trim: 192, braces: "top", braceLength: 48,
  skirt: false, rail: "none", stairs: 0,
  towers: 4, bays: [], spine: true, towerLimit: ROOF.defaultLimit,
};
/** Settings only the stage uses, and what they are everywhere else. */
const STAGE_ONLY = { skirt: false, rail: "none", stairs: 0 } as const;
const FT = 12;

export const TEMPLATES: readonly Template[] = [
  {
    id: "cube",
    name: "Cube",
    blurb: "Floor ring, four legs, top ring. Knee braces optional.",
    defaults: { ...BASE },
    fields: [
      { key: "width", label: "Width", kind: "length", min: 4 * FT, max: 40 * FT, step: FT },
      { key: "depth", label: "Depth", kind: "length", min: 4 * FT, max: 40 * FT, step: FT },
      { key: "height", label: "Height", kind: "length", min: 4 * FT, max: 30 * FT, step: FT },
      { key: "series", label: "Truss", kind: "series" },
      { key: "braces", label: "Knee braces", kind: "braces", options: ["none", "top", "bottom", "both"] },
      { key: "braceLength", label: "Brace pipe", kind: "length", min: 2 * FT, max: 8 * FT, step: FT },
    ],
  },
  {
    id: "goalpost",
    name: "Goal post",
    blurb: "Two legs on base plates and a header.",
    defaults: { ...BASE, width: 20 * FT, height: 14 * FT },
    fields: [
      { key: "width", label: "Span", kind: "length", min: 6 * FT, max: 40 * FT, step: FT },
      { key: "height", label: "Height", kind: "length", min: 6 * FT, max: 30 * FT, step: FT },
      { key: "series", label: "Truss", kind: "series" },
      { key: "braces", label: "Knee braces", kind: "braces", options: ["none", "top"] },
      { key: "braceLength", label: "Brace pipe", kind: "length", min: 2 * FT, max: 8 * FT, step: FT },
    ],
  },
  {
    id: "tower",
    name: "Tower",
    blurb: "One vertical mast on a base plate.",
    defaults: { ...BASE, height: 16 * FT, braces: "none" },
    fields: [
      { key: "height", label: "Height", kind: "length", min: 4 * FT, max: 30 * FT, step: FT },
      { key: "series", label: "Truss", kind: "series" },
    ],
  },
  {
    id: "flown",
    name: "Flown grid",
    blurb: "A rectangle of truss hung at a trim height.",
    defaults: { ...BASE, width: 20 * FT, depth: 16 * FT, braces: "none" },
    fields: [
      { key: "width", label: "Width", kind: "length", min: 4 * FT, max: 60 * FT, step: FT },
      { key: "depth", label: "Depth", kind: "length", min: 4 * FT, max: 60 * FT, step: FT },
      { key: "trim", label: "Trim", kind: "length", min: 6 * FT, max: 60 * FT, step: FT },
      { key: "series", label: "Truss", kind: "series" },
    ],
  },
  {
    id: "stage",
    name: "Stage",
    blurb: "4×8 decks on legs. Skirt, rails and stairs optional.",
    defaults: { ...BASE, width: 16 * FT, depth: 8 * FT, height: 24, braces: "none", skirt: true },
    fields: [
      { key: "width", label: "Width", kind: "length", min: 4 * FT, max: 48 * FT, step: DECK.width },
      { key: "depth", label: "Depth", kind: "length", min: 4 * FT, max: 32 * FT, step: DECK.width },
      { key: "height", label: "Deck height", kind: "length", min: DECK.legMin, max: DECK.legMax, step: DECK.legStep },
      { key: "skirt", label: "Skirt", kind: "toggle", on: "Front and sides", off: "None" },
      { key: "rail", label: "Guardrails", kind: "rail", options: ["none", "back", "three"] },
      { key: "stairs", label: "Stairs", kind: "count", min: 0, max: 2 },
    ],
  },
  {
    id: "roof",
    name: "Ground-support roof",
    ownSeries: true,
    blurb: "Self-climbing towers with a grid: perimeter, cross beams, spine.",
    // The defaults are the Air Pro self-climber roof (Aspect Lighting, 2022), measured from its drawing.
    defaults: { ...BASE, series: "box20", width: 1044, depth: 504.5, trim: 300, braces: "none", towers: 4, bays: [268, 508, 268], spine: true },
    fields: [
      { key: "width", label: "Length (tower to tower)", kind: "length", min: 10 * FT, max: 120 * FT, step: 6, snap: 0.5 },
      { key: "depth", label: "Width (tower to tower)", kind: "length", min: 10 * FT, max: 60 * FT, step: 6, snap: 0.5 },
      { key: "trim", label: "Trim (bottom of grid)", kind: "length", min: 10 * FT, max: 50 * FT, step: 6, snap: 0.5 },
      { key: "towers", label: "Towers per side", kind: "count", min: 2, max: 6 },
      { key: "spine", label: "Center spine", kind: "toggle", on: "Yes", off: "No" },
      { key: "towerLimit", label: "Limit per tower", kind: "weight", min: 500, max: 6000, step: 250 },
      { key: "series", label: "Truss", kind: "series" },
    ],
  },
];

export function template(id: TemplateId): Template {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`No template "${id}"`);
  return t;
}

export const ftIn = (inches: number): string => {
  const ft = Math.floor(inches / 12 + 1e-9);
  const rest = Math.round((inches - ft * 12) * 10) / 10;
  if (!ft) return `${rest}"`;
  return rest ? `${ft}'${rest}"` : `${ft}'`;
};

/** A default name from the dimensions, e.g. "10' × 10' × 10' cube". */
export function autoName(t: TemplateId, p: RigParams): string {
  switch (t) {
    case "cube":
      return `${ftIn(p.width)} × ${ftIn(p.depth)} × ${ftIn(p.height)} cube`;
    case "goalpost":
      return `${ftIn(p.width)} goal post, ${ftIn(p.height)} tall`;
    case "tower":
      return `${ftIn(p.height)} tower`;
    case "flown":
      return `${ftIn(p.width)} × ${ftIn(p.depth)} grid at ${ftIn(p.trim)}`;
    case "stage":
      return `${ftIn(p.width)} × ${ftIn(p.depth)} stage, ${ftIn(p.height)} high`;
    case "roof":
      return `${ftIn(p.width)} × ${ftIn(p.depth)} roof at ${ftIn(p.trim)}`;
  }
}

export function newDesign(t: TemplateId, overrides: Partial<RigParams> = {}): RigDesign {
  const params = { ...template(t).defaults, ...overrides };
  return { version: 1, name: autoName(t, params), template: t, params };
}

/** Clamp every length to its template's limits and snap to the step. */
export function clampParams(t: TemplateId, p: RigParams): RigParams {
  const out = { ...p };
  for (const f of template(t).fields) {
    if (f.kind !== "length") continue;
    const snap = f.snap ?? f.step;
    const v = Math.round(out[f.key] / snap) * snap;
    out[f.key] = Math.min(f.max, Math.max(f.min, v));
  }
  const braces = template(t).fields.find((f) => f.kind === "braces");
  if (braces && braces.kind === "braces" && !braces.options.includes(out.braces)) out.braces = braces.options[braces.options.length - 1];
  if (!braces) out.braces = "none";
  const fields = template(t).fields;
  for (const f of fields) {
    if (f.kind === "count") out[f.key] = Math.min(f.max, Math.max(f.min, Math.round(Number(out[f.key]) || 0)));
    if (f.kind === "weight") out[f.key] = Math.min(f.max, Math.max(f.min, Math.round((Number(out[f.key]) || f.min) / f.step) * f.step));
  }
  out.spine = out.spine !== false;
  out.bays = t === "roof" ? fitBays(out.bays, out.towers, out.width) : [];
  for (const k of Object.keys(STAGE_ONLY) as (keyof typeof STAGE_ONLY)[]) {
    if (!fields.some((f) => f.key === k)) (out as Record<string, unknown>)[k] = STAGE_ONLY[k];
  }
  out.skirt = out.skirt === true;
  if (!["none", "back", "three"].includes(out.rail)) out.rail = "none";
  return out;
}

/**
 * Bays between tower centers along the long side: one fewer than the towers, adding up to the
 * length. A different count starts over evenly; a different length scales them, on a ½" grid.
 */
export function fitBays(bays: readonly number[] | undefined, towers: number, width: number): number[] {
  const n = Math.max(1, towers - 1);
  const half = (x: number) => Math.round(x * 2) / 2;
  const list = Array.isArray(bays) ? bays.filter((b) => Number.isFinite(b) && b > 0) : [];
  let out: number[];
  if (list.length !== n) out = Array.from({ length: n }, () => half(width / n));
  else {
    const sum = list.reduce((a, b) => a + b, 0);
    out = Math.abs(sum - width) < 0.01 ? [...list] : list.map((b) => half((b * width) / sum));
  }
  out[n - 1] = half(width - out.slice(0, -1).reduce((a, b) => a + b, 0));
  return out;
}

/** The truss size a template switch starts with. */
export const seriesFor = (t: TemplateId, current: RigParams["series"]) => (template(t).ownSeries ? template(t).defaults.series : current);
