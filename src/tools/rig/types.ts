import type { SeriesId } from "./catalog.ts";

export type Vec3 = [number, number, number];

export type TemplateId = "cube" | "goalpost" | "tower" | "flown" | "stage";
export type BraceMode = "none" | "top" | "bottom" | "both";
/** Stage guardrails: none, along the back, or the back and both sides (the front stays open). */
export type RailMode = "none" | "back" | "three";

/** Every setting a template can use, inches unless noted. Each template reads only its own. */
export type RigParams = {
  series: SeriesId;
  width: number;
  depth: number;
  height: number;
  /** Flown rigs: floor to the bottom of the truss. */
  trim: number;
  braces: BraceMode;
  /** Brace pipe length. */
  braceLength: number;
  /** Stage: skirting on the front and both sides. */
  skirt: boolean;
  /** Stage: guardrails. */
  rail: RailMode;
  /** Stage: stair units on the front edge. */
  stairs: number;
};

export type RigDesign = {
  version: 1;
  name: string;
  template: TemplateId;
  params: RigParams;
};

export type TrussRole = "floor" | "leg" | "top" | "header" | "mast" | "grid";

export type TrussPart = { id: string; kind: "truss"; role: TrussRole; length: number; start: Vec3; end: Vec3; roll: number };
export type CornerPart = { id: string; kind: "corner"; size: number; ways: number; center: Vec3 };
export type PipePart = { id: string; kind: "pipe"; od: number; length: number; start: Vec3; end: Vec3 };
export type ClampPart = { id: string; kind: "clamp"; type: "swivel"; at: Vec3; pipeDir: Vec3; chordDir: Vec3; normal: Vec3; offset: number };
export type BaseplatePart = { id: string; kind: "baseplate"; size: number; center: Vec3 };

/**
 * A stage deck. `at` is where Vectorworks' library symbol goes: the plan center, Z = the underside
 * of the frame (height − 3"). `length` runs along X at rotation 0, along Y at 90.
 */
export type DeckPart = { id: string; kind: "deck"; width: number; length: number; rotation: 0 | 90; height: number; at: Vec3 };
/** A deck leg standing on the floor at `at`. `height` is the deck's nominal height (the leg's name). */
export type LegPart = { id: string; kind: "leg"; height: number; at: Vec3 };
/** Skirting hung from the deck edge: `start`→`end` is its top line, `drop` how far it hangs. */
export type SkirtPart = { id: string; kind: "skirt"; length: number; start: Vec3; end: Vec3; drop: number };
/** A guardrail section standing on the deck edge: `start`→`end` on the walking surface. */
export type RailPart = { id: string; kind: "rail"; length: number; start: Vec3; end: Vec3; height: number };
/** A stair unit: `at` is the middle of its top edge, on the floor under the deck edge; it runs out along `out`. */
export type StairPart = { id: string; kind: "stairs"; width: number; rise: number; risers: number; run: number; at: Vec3; out: Vec3 };

export type Part = TrussPart | CornerPart | PipePart | ClampPart | BaseplatePart | DeckPart | LegPart | SkirtPart | RailPart | StairPart;
export type PartKind = Part["kind"];

export type BuildList = {
  version: 1;
  name: string;
  units: "in";
  series: { id: SeriesId; label: string; width: number; height: number; chordOd: number; chordInset: number };
  parts: Part[];
  /** Things the geometry couldn't do exactly (a run with no stock combination, a brace that doesn't fit). */
  notes: string[];
};
