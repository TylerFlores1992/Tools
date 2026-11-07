import type { SeriesId } from "./catalog.ts";

export type Vec3 = [number, number, number];

export type TemplateId = "cube" | "goalpost" | "tower" | "flown";
export type BraceMode = "none" | "top" | "bottom" | "both";

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

export type Part = TrussPart | CornerPart | PipePart | ClampPart | BaseplatePart;
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
