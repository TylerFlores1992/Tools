// A tapped part in words, and which design settings change it.
import { CLAMP, PIPE, SERIES } from "./catalog.ts";
import { ftIn } from "./templates.ts";
import type { BuildList, Part, RigParams } from "./types.ts";

export type PartInfo = { title: string; detail: string; fields: (keyof RigParams)[] };

const ROLE: Record<string, string> = { floor: "Floor section", leg: "Leg", top: "Top section", header: "Header", mast: "Mast section", grid: "Grid section" };

export function describePart(part: Part, list: BuildList): PartInfo {
  const s = SERIES[list.series.id];
  switch (part.kind) {
    case "truss": {
      const alongY = Math.abs(part.end[1] - part.start[1]) > 0.5;
      const vertical = Math.abs(part.end[2] - part.start[2]) > 0.5;
      const field: keyof RigParams = vertical ? "height" : alongY ? "depth" : "width";
      return { title: ROLE[part.role] ?? "Truss section", detail: `${s.label}, ${ftIn(part.length)} section`, fields: part.role === "grid" ? [field, "trim", "series"] : [field, "series"] };
    }
    case "corner":
      return { title: "Corner block", detail: `${s.label} block, ${part.size}" cube, ${part.ways} faces used`, fields: ["series"] };
    case "pipe":
      return { title: "Knee brace", detail: `${PIPE.label}, ${ftIn(part.length)}, at 45°`, fields: ["braces", "braceLength"] };
    case "clamp":
      return { title: "Cheeseborough", detail: `${CLAMP.label}: one jaw on the brace, one on the truss chord`, fields: ["braces", "braceLength"] };
    case "baseplate":
      return { title: "Base plate", detail: `${part.size}" × ${part.size}" steel plate`, fields: ["height"] };
  }
}
