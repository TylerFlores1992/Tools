// Planning sanity checks. They catch obvious mistakes early; they are not engineering, and the
// UI says so. Every finding is words first (the owner is colour-blind), with a level for a glyph.
import { BASEPLATE } from "./catalog.ts";
import { ftIn } from "./templates.ts";
import type { BuildList, RigDesign } from "./types.ts";

export type Finding = { id: string; level: "warn" | "ok" | "note"; text: string };

/** Longest unsupported span we'd plan without checking the manufacturer's load table, inches. */
export const SPAN_LIMIT = { box12: 30 * 12, box20: 40 * 12 } as const;

export function checks(design: RigDesign, list: BuildList): Finding[] {
  const p = design.params;
  const out: Finding[] = [];
  for (const [i, n] of list.notes.entries()) out.push({ id: `note-${i}`, level: "warn", text: n });

  const limit = SPAN_LIMIT[p.series];
  const span = design.template === "tower" ? 0 : Math.max(p.width, design.template === "goalpost" ? 0 : p.depth);
  if (span > limit) out.push({ id: "span", level: "warn", text: `A ${ftIn(span)} span is past ${ftIn(limit)}: check the truss maker's load table before hanging anything on it.` });

  const ground = design.template === "cube" || design.template === "goalpost" || design.template === "tower";
  if (ground) {
    const base = design.template === "cube" ? Math.min(p.width, p.depth) : BASEPLATE.size;
    const ratio = p.height / base;
    if (ratio > 3) {
      const fix = design.template === "cube" ? "brace it or tie it off" : "add outriggers, ballast or guy lines";
      out.push({ id: "tip", level: "warn", text: `It's ${ratio.toFixed(1)} times taller than its base is wide: ${fix}.` });
    } else out.push({ id: "tip", level: "ok", text: `Height to base is ${ratio.toFixed(1)} to 1.` });
  }

  if (design.template === "cube") {
    if (p.braces === "none" && p.height > 8 * 12) out.push({ id: "braces", level: "warn", text: "Over 8' with no knee braces: the frame relies on the corner blocks alone to stay square." });
    if (p.braces === "bottom") out.push({ id: "braces-top", level: "note", text: "Braces at the bottom only: the top corners carry the most racking. Top braces usually come first." });
  }
  if (design.template === "goalpost" && p.braces === "none") out.push({ id: "braces", level: "warn", text: "No knee braces: a goal post racks side to side without them." });

  if (design.template === "flown") {
    const pickups = 4 + 2 * (Math.max(0, Math.ceil(p.width / limit) - 1) + Math.max(0, Math.ceil(p.depth / limit) - 1));
    out.push({ id: "pickups", level: "note", text: `Plan at least ${pickups} pickup points: one at each corner block${pickups > 4 ? ", plus mid-span points on the long sides" : ""}.` });
  }

  const clamps = list.parts.filter((x) => x.kind === "clamp").length;
  if (clamps) out.push({ id: "clamps", level: "note", text: `${clamps} cheeseboroughs: make sure they're sized for both the 1.9" pipe and the truss chord.` });
  return out;
}
