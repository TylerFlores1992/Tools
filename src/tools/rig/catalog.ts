// The gear the Rig Planner knows. Weights are typical aluminum box truss and Schedule 40 steel
// pipe figures, rounded; they are for planning, not engineering. Check the rental house's sheet.

export type SeriesId = "box12" | "box20";

export type TrussSeries = {
  id: SeriesId;
  label: string;
  /** Outside width and height of the cross-section, inches. */
  width: number;
  height: number;
  /** Main chord outside diameter, inches. */
  chordOd: number;
  /** Outside face to chord centerline, inches. */
  chordInset: number;
  /** Pounds per foot of straight section. */
  lbPerFt: number;
  /** Pounds per corner block. */
  cornerLb: number;
  /** Stock straight lengths, inches, longest first. */
  stock: readonly number[];
};

export const SERIES: Record<SeriesId, TrussSeries> = {
  box12: {
    id: "box12",
    label: '12" box truss',
    width: 12,
    height: 12,
    chordOd: 2,
    chordInset: 1,
    lbPerFt: 4.3,
    cornerLb: 14,
    stock: [120, 96, 60, 48, 30, 24, 12],
  },
  box20: {
    id: "box20",
    label: '20.5" box truss',
    width: 20.5,
    height: 20.5,
    chordOd: 2,
    chordInset: 1,
    lbPerFt: 7.5,
    cornerLb: 32,
    stock: [120, 96, 60, 48, 30, 24, 12],
  },
};

export const PIPE = {
  label: '1.5" Sched 40 pipe',
  od: 1.9,
  lbPerFt: 2.72,
  /** Stock lengths, inches. */
  stock: [24, 36, 48, 60, 72, 96, 120, 144, 168, 192, 252] as readonly number[],
};

export const CLAMP = {
  label: "Cheeseborough (swivel coupler)",
  /** Centerline-to-centerline distance between the two tubes it holds, inches. */
  offset: 3,
  lb: 2.9,
};

export const BASEPLATE = { label: '24" × 24" steel base plate', size: 24, thickness: 0.5, lb: 48 };

/** Pin-and-clip (or bolt) sets per truss joint: one per chord. */
export const CONNECTORS_PER_JOINT = 4;
export const CONNECTOR_LB = 0.4;

/** How far a brace pipe runs past each cheeseborough, inches. */
export const PIPE_STICKOUT = 3;

/**
 * Stage decks as Vectorworks' own library draws them (Libraries > Defaults > Stage Deck), measured
 * on "Stage Deck 4ft x 8ft x 2ft" and "4ft x 4ft x 2ft" on 2026-11-07: a 3" frame whose underside
 * sits 3" below the nominal height, a 1" top on it (so the walking surface is 1" above nominal),
 * legs 1.625" in from each edge, six on a 4×8 (corners and the middle of the long sides) and four
 * on a 4×4. Legs come in 4" steps from 8" to 60". Weights are typical aluminum-frame decks.
 */
export const DECK = {
  sizes: {
    96: { label: "4' × 8' stage deck", lb: 95 },
    48: { label: "4' × 4' stage deck", lb: 50 },
  } as Record<number, { label: string; lb: number }>,
  width: 48,
  frame: 3,
  top: 1,
  legInset: 1.625,
  legMin: 8,
  legMax: 60,
  legStep: 4,
  legLbPerIn: 0.15,
};

export const SKIRT = { label: "Stage skirting", stock: [192, 144, 96, 48] as readonly number[], lbPerFt: 0.3 };
/** 42" is the usual guard height (IBC); check the venue's rules. */
export const RAIL = { label: "Stage guardrail section", height: 42, stock: [96, 48] as readonly number[], lbPerFt: 3.2 };
export const STAIRS = { label: "Stage stair unit", width: 36, maxRise: 7.5, tread: 11, lb: 20, lbPerStep: 15 };
