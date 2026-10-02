/**
 * Two-leg bridle statics. Pure functions, no UI.
 *
 * Geometry (one consistent length unit, one consistent force unit — the maths doesn't care
 * which, so ft/lb and m/kg both work):
 *   - Left beam point A at (0, 0).
 *   - Right beam point B at (span, rise): `rise` > 0 when the right beam is higher.
 *   - Bridle point (apex) P at (x, −drop): `x` from the left beam, `drop` below the left beam.
 * The load W hangs straight down from P. Static, weightless legs, no shock loading.
 */

export type BridleInput = { span: number; load: number; x: number; drop: number; rise: number };

export type Leg = {
  /** Leg length from beam point to apex. */
  length: number;
  /** Horizontal distance from beam point to apex. */
  horizontal: number;
  /** Vertical distance from beam point down to apex. */
  vertical: number;
  /** Leg angle above horizontal, degrees. */
  angle: number;
  /** Tension in the leg. NaN when the geometry is invalid. */
  tension: number;
  /** Vertical share of the load this beam carries. NaN when invalid. */
  verticalForce: number;
};

export type BridleResult = {
  valid: boolean;
  /** Why it's invalid, in words a rigger would use. Empty when valid. */
  problem: string;
  left: Leg;
  right: Leg;
  /** Angle between the two legs at the apex, degrees. */
  includedAngle: number;
  /** Horizontal force pulling each beam toward the other (equal and opposite). NaN when invalid. */
  horizontalForce: number;
};

const deg = (r: number) => (r * 180) / Math.PI;

export function solveBridle({ span, load, x, drop, rise }: BridleInput): BridleResult {
  const hL = x, vL = drop;
  const hR = span - x, vR = rise + drop;
  const lenL = Math.hypot(hL, vL), lenR = Math.hypot(hR, vR);
  const aL = deg(Math.atan2(vL, hL)), aR = deg(Math.atan2(vR, hR));

  let problem = "";
  if (!(span > 0)) problem = "The span between the beams must be more than zero.";
  else if (!(x > 0 && x < span)) problem = "Keep the bridle point between the two beams.";
  else if (!(drop > 0 && vR > 0)) problem = "The bridle point has to hang below both beams.";
  else if (!(load >= 0)) problem = "The load can't be negative.";
  const valid = problem === "";

  let tL = NaN, tR = NaN;
  if (valid) {
    // Solve tL·uL + tR·uR = (0, W), with u the unit vectors from the apex up each leg.
    const uLx = -hL / lenL, uLy = vL / lenL, uRx = hR / lenR, uRy = vR / lenR;
    const det = uLx * uRy - uRx * uLy;
    tL = (-uRx * load) / det;
    tR = (uLx * load) / det;
  }
  return {
    valid,
    problem,
    left: { length: lenL, horizontal: hL, vertical: vL, angle: aL, tension: tL, verticalForce: valid ? (tL * vL) / lenL : NaN },
    right: { length: lenR, horizontal: hR, vertical: vR, angle: aR, tension: tR, verticalForce: valid ? (tR * vR) / lenR : NaN },
    includedAngle: 180 - aL - aR,
    horizontalForce: valid ? (tL * hL) / lenL : NaN,
  };
}

/** The hand formula for level beams (the one on the ETCP sheet): T = W·L·(other side's H) / (span·drop). */
export function levelBeamTension(load: number, legLength: number, otherHorizontal: number, span: number, drop: number) {
  return (load * legLength * otherHorizontal) / (span * drop);
}

export const FT_PER_M = 1 / 0.3048;
export const LB_PER_KG = 1 / 0.45359237;
export type Units = "imperial" | "metric";

/** Convert a whole input between unit systems (lengths and load), so switching keeps the same rig. */
export function convertInput(i: BridleInput, from: Units, to: Units): BridleInput {
  if (from === to) return i;
  const len = to === "metric" ? 1 / FT_PER_M : FT_PER_M;
  const force = to === "metric" ? 1 / LB_PER_KG : LB_PER_KG;
  return { span: i.span * len, x: i.x * len, drop: i.drop * len, rise: i.rise * len, load: i.load * force };
}
