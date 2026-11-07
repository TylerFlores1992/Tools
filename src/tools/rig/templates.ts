import { DECK } from "./catalog.ts";
import type { BraceMode, RailMode, RigDesign, RigParams, TemplateId } from "./types.ts";

export type Field =
  | { key: "width" | "depth" | "height" | "trim" | "braceLength"; label: string; kind: "length"; min: number; max: number; step: number }
  | { key: "series"; label: string; kind: "series" }
  | { key: "braces"; label: string; kind: "braces"; options: readonly BraceMode[] }
  | { key: "skirt"; label: string; kind: "toggle" }
  | { key: "rail"; label: string; kind: "rail"; options: readonly RailMode[] }
  | { key: "stairs"; label: string; kind: "count"; max: number };

export type Template = {
  id: TemplateId;
  name: string;
  blurb: string;
  fields: readonly Field[];
  defaults: RigParams;
};

const BASE: RigParams = { series: "box12", width: 120, depth: 120, height: 120, trim: 192, braces: "top", braceLength: 48, skirt: false, rail: "none", stairs: 0 };
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
      { key: "skirt", label: "Skirt", kind: "toggle" },
      { key: "rail", label: "Guardrails", kind: "rail", options: ["none", "back", "three"] },
      { key: "stairs", label: "Stairs", kind: "count", max: 2 },
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
    const v = Math.round(out[f.key] / f.step) * f.step;
    out[f.key] = Math.min(f.max, Math.max(f.min, v));
  }
  const braces = template(t).fields.find((f) => f.kind === "braces");
  if (braces && braces.kind === "braces" && !braces.options.includes(out.braces)) out.braces = braces.options[braces.options.length - 1];
  if (!braces) out.braces = "none";
  const fields = template(t).fields;
  for (const f of fields) if (f.kind === "count") out[f.key] = Math.min(f.max, Math.max(0, Math.round(Number(out[f.key]) || 0)));
  for (const k of Object.keys(STAGE_ONLY) as (keyof typeof STAGE_ONLY)[]) {
    if (!fields.some((f) => f.key === k)) (out as Record<string, unknown>)[k] = STAGE_ONLY[k];
  }
  out.skirt = out.skirt === true;
  if (!["none", "back", "three"].includes(out.rail)) out.rail = "none";
  return out;
}
