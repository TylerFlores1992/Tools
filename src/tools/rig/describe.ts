// A tapped part in words, and which design settings change it.
import { CLAMP, DECK, PIPE, RAIL, ROOF, SERIES, SKIRT, STAIRS } from "./catalog.ts";
import { ftIn } from "./templates.ts";
import type { BuildList, Part, RigParams } from "./types.ts";

export type PartInfo = { title: string; detail: string; fields: (keyof RigParams)[] };

const ROLE: Record<string, string> = {
  floor: "Floor section", leg: "Leg", top: "Top section", header: "Header", mast: "Mast section", grid: "Grid section",
  tower: "Tower section", beam: "Long beam", cross: "Cross beam", spine: "Spine",
};

export function describePart(part: Part, list: BuildList): PartInfo {
  const s = SERIES[list.series.id];
  switch (part.kind) {
    case "truss": {
      const alongY = Math.abs(part.end[1] - part.start[1]) > 0.5;
      const vertical = Math.abs(part.end[2] - part.start[2]) > 0.5;
      const field: keyof RigParams = vertical ? "height" : alongY ? "depth" : "width";
      const detail = part.length < 12 ? `${s.label} spacer, ${part.length}"` : `${s.label}, ${ftIn(part.length)} section`;
      if (part.role === "tower") return { title: ROLE.tower, detail, fields: ["trim", "towers", "towerLimit"] };
      if (part.role === "beam") return { title: ROLE.beam, detail, fields: ["width", "towers", "trim"] };
      if (part.role === "cross") return { title: ROLE.cross, detail, fields: ["depth", "trim"] };
      if (part.role === "spine") return { title: ROLE.spine, detail, fields: ["spine", "trim"] };
      return { title: ROLE[part.role] ?? "Truss section", detail, fields: part.role === "grid" ? [field, "trim", "series"] : [field, "series"] };
    }
    case "corner":
      if (part.role === "sleeve") return { title: "Self-climber sleeve", detail: `${ROOF.sleeve.label} at ${ftIn(part.center[2] - s.height / 2)} trim, ${part.size}" square`, fields: ["trim", "towerLimit"] };
      if (part.role === "head") return { title: "Head block", detail: `${ROOF.head.label}, ${part.size}" square, on top of the tower`, fields: ["trim"] };
      return { title: "Corner block", detail: `${s.label} block, ${part.size}" cube, ${part.ways} faces used`, fields: ["series"] };
    case "pipe":
      return { title: "Knee brace", detail: `${PIPE.label}, ${ftIn(part.length)}, at 45°`, fields: ["braces", "braceLength"] };
    case "clamp":
      return { title: "Cheeseborough", detail: `${CLAMP.label}: one jaw on the brace, one on the truss chord`, fields: ["braces", "braceLength"] };
    case "baseplate":
      return { title: "Base plate", detail: `${part.size}" × ${part.size}" steel plate`, fields: ["height"] };
    case "deck":
      return { title: "Stage deck", detail: `${DECK.sizes[part.length]?.label ?? "Stage deck"}, top at ${ftIn(part.height + DECK.top)}`, fields: ["width", "depth", "height"] };
    case "leg":
      return { title: "Deck leg", detail: `${ftIn(part.height)} leg`, fields: ["height"] };
    case "skirt":
      return { title: "Skirting", detail: `${SKIRT.label}, ${ftIn(part.length)} piece, ${ftIn(part.drop)} drop`, fields: ["skirt"] };
    case "rail":
      return { title: "Guardrail", detail: `${RAIL.label}, ${ftIn(part.length)}, ${RAIL.height}" tall`, fields: ["rail"] };
    case "stairs":
      return { title: "Stairs", detail: `${STAIRS.label}: ${part.risers - 1} steps up to ${ftIn(part.rise)}`, fields: ["stairs"] };
  }
}

/**
 * What a part IS, independent of its numbering: ids are counters, so a design change can renumber
 * them. A selection follows this key so the sheet stays on the same kind of part.
 */
export function partKey(p: Part): string {
  const axis = (a: readonly number[], b: readonly number[]) => (Math.abs(b[2] - a[2]) > 0.5 ? "z" : Math.abs(b[1] - a[1]) > 0.5 ? "y" : "x");
  switch (p.kind) {
    case "truss":
      return `truss:${p.role}:${axis(p.start, p.end)}`;
    case "pipe":
      return `pipe:${p.start[2] < p.end[2] - 0.5 && p.start[2] < 30 ? "low" : "high"}`;
    case "clamp":
      return `clamp:${p.chordDir.map((x) => Math.round(Math.abs(x))).join("")}`;
    case "deck":
      return `deck:${p.length}`;
    case "corner":
      return p.role ? `corner:${p.role}` : "corner";
    default:
      return p.kind;
  }
}
