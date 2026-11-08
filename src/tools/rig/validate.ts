import { z } from "zod";
import { clampParams, template } from "./templates.ts";
import type { RigDesign } from "./types.ts";

const DESIGN = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1).max(80),
  template: z.enum(["cube", "goalpost", "tower", "flown", "stage", "roof"]),
  params: z.object({
    series: z.enum(["box12", "box20"]),
    width: z.number().finite(),
    depth: z.number().finite(),
    height: z.number().finite(),
    trim: z.number().finite(),
    braces: z.enum(["none", "top", "bottom", "both"]),
    braceLength: z.number().finite(),
    // Added with the stage (2026-11-07): designs saved before it don't have them.
    skirt: z.boolean().default(false),
    rail: z.enum(["none", "back", "three"]).default("none"),
    stairs: z.number().finite().default(0),
    // Added with the ground-support roof (2026-11-07).
    towers: z.number().finite().default(4),
    bays: z.array(z.number().finite()).max(12).default([]),
    spine: z.boolean().default(true),
    towerLimit: z.number().finite().default(2000),
  }),
});

/** Anything from a form, the browser or the AI → a design inside its template's limits, or null. */
export function readDesign(raw: unknown): RigDesign | null {
  const r = DESIGN.safeParse(raw);
  if (!r.success) return null;
  const d = r.data;
  template(d.template);
  return { version: 1, name: d.name, template: d.template, params: clampParams(d.template, d.params) };
}

/** Short ids people can say out loud: "build design k7m2q". No 0/o or 1/l. */
export function newId(rand: () => number = Math.random): string {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 5 }, () => abc[Math.floor(rand() * abc.length)]).join("");
}
