// Planning sanity checks. They catch obvious mistakes early; they are not engineering, and the
// UI says so. Every finding is words first (the owner is colour-blind), with a level for a glyph.
import { BASEPLATE, DECK, ROOF } from "./catalog.ts";
import { towerLoads } from "./loads.ts";
import { fitBays, ftIn } from "./templates.ts";
import type { BuildList, RigDesign } from "./types.ts";

export type Finding = { id: string; level: "warn" | "ok" | "note"; text: string };

/** Longest unsupported span we'd plan without checking the manufacturer's load table, inches. */
export const SPAN_LIMIT = { box12: 30 * 12, box20: 40 * 12 } as const;

export function checks(design: RigDesign, list: BuildList): Finding[] {
  const p = design.params;
  const out: Finding[] = [];
  for (const [i, n] of list.notes.entries()) out.push({ id: `note-${i}`, level: "warn", text: n });

  if (design.template === "stage") return [...out, ...stageChecks(design)];
  if (design.template === "roof") return [...out, ...roofChecks(design, list)];

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

/** Height the walking surface is at, past which open sides usually need a guard (IBC, 30"). */
export const GUARD_FROM = 30;

function stageChecks(design: RigDesign): Finding[] {
  const p = design.params;
  const out: Finding[] = [];
  const top = p.height + DECK.top;
  if (top > GUARD_FROM) {
    if (p.rail === "three") out.push({ id: "rail", level: "ok", text: `Deck top is ${ftIn(top)}: rails on the back and both sides; the front is the open performance edge.` });
    else out.push({ id: "rail", level: "warn", text: `Deck top is ${ftIn(top)}, over 30": open sides other than the performance edge usually need a 42" guardrail. ${p.rail === "back" ? "Add rails on both sides too." : "Add rails on the back and both sides."}` });
  } else out.push({ id: "rail", level: "ok", text: `Deck top is ${ftIn(top)}: under 30", so guardrails are usually optional.` });
  if (p.stairs === 0 && top > 12) out.push({ id: "stairs", level: "warn", text: `No stairs: a ${ftIn(top)} step up needs a stair unit (or a ramp if anyone needs step-free access).` });
  if (p.height > 36) out.push({ id: "legs", level: "note", text: `${ftIn(p.height)} legs: check the deck maker's chart for leg bracing at this height.` });
  out.push({ id: "load", level: "note", text: "Check the decks' load rating against what goes on them: people, a drum riser, road cases." });
  return out;
}

const lb = (n: number) => `${Math.round(n).toLocaleString("en-US")} lb`;

function roofChecks(design: RigDesign, list: BuildList): Finding[] {
  const p = design.params;
  const out: Finding[] = [];
  const limit = SPAN_LIMIT[p.series];
  const bays = fitBays(p.bays, p.towers, p.width);
  const longest = Math.max(...bays);
  if (longest > limit) out.push({ id: "span-long", level: "warn", text: `The longest bay is ${ftIn(longest)} between towers, past ${ftIn(limit)}: check the truss maker's load table for that span before hanging anything on it.` });
  if (p.depth > limit) out.push({ id: "span-cross", level: "warn", text: `The cross beams span ${ftIn(p.depth)}, past ${ftIn(limit)}: check the load table for that span${p.spine ? " (the spine adds its weight at mid-span)" : ""}.` });
  const loads = towerLoads(design, list);
  const worst = loads.reduce((a, b) => (b.lb > a.lb ? b : a), loads[0]);
  const guess = p.towerLimit === ROOF.defaultLimit;
  const of = `${lb(p.towerLimit)}${guess ? " (a planning figure: a typical 1-ton self-climber hoist, not a rating)" : ""}`;
  if (worst) {
    const name = `${worst.side} tower ${worst.index + 1}`;
    const room = p.towerLimit - worst.lb;
    if (room < 0) out.push({ id: "towers", level: "warn", text: `The ${name} carries ${lb(worst.lb)} of grid alone, over the ${of} limit.` });
    else
      out.push({
        id: "towers",
        level: "ok",
        text: `The busiest tower (${name}) carries ${lb(worst.lb)} of grid; ${lb(room)} left for lights and cable at that tower, of ${of}.`,
      });
  }
  out.push({ id: "calcs", level: "note", text: "Get the rental house's structural calcs for this roof: they set the real tower and beam limits, wind limits and ballast." });
  return out;
}
