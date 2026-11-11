/** X and Y reference lines: the two lines every Vectorworks plan is measured off on site (usually
 * the center line and a beam, the plaster line or the downstage edge), drawn across the drawing
 * with their names and a figure every few feet, so any spot can be read as "8' left of CL, 12'
 * upstage of the beam". They live in their own layer; nothing in the rig or the drawing changes. */
import { ftIn, type Layer, type Shape } from "./model.ts";

/** origin: where the lines cross (drawing inches); xLine runs left-right (Y = 0 on it: "Beam A",
 * "Plaster line", "DS edge"); yLine runs up and downstage (X = 0 on it: "CL"); stepFt between figures. */
export type Reference = NonNullable<Layer["reference"]>;

export const REFERENCE_PREFIX = "Reference: ";
export const referenceName = (r: Pick<Reference, "xLine" | "yLine">) => `${REFERENCE_PREFIX}${r.yLine} / ${r.xLine}`;

/** Ink the two lines are drawn in. Never the only signal: each line carries its name in words. */
const PEN = "#7a2fb8";

/** The box the lines should span: the shown drawing layers, plus a margin; a 60' square if empty. */
export function drawingExtent(layers: Layer[], origin: [number, number], also: [number, number][] = []): [number, number, number, number] {
  let e = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of also) e = [Math.min(e[0], x), Math.min(e[1], y), Math.max(e[2], x), Math.max(e[3], y)];
  for (const l of layers) {
    if (!l.visible || l.kind !== "shapes" || l.name.startsWith(REFERENCE_PREFIX) || l.name.startsWith("Measurements:")) continue;
    for (const s of l.shapes ?? []) for (const [x, y] of s.pts) e = [Math.min(e[0], x), Math.min(e[1], y), Math.max(e[2], x), Math.max(e[3], y)];
    for (const f of l.fixtures ?? []) e = [Math.min(e[0], f.x), Math.min(e[1], f.y), Math.max(e[2], f.x), Math.max(e[3], f.y)];
  }
  if (!Number.isFinite(e[0])) e = [origin[0] - 360, origin[1] - 360, origin[0] + 360, origin[1] + 360];
  // The lines always reach the origin, and run a little past the drawing.
  e = [Math.min(e[0], origin[0]), Math.min(e[1], origin[1]), Math.max(e[2], origin[0]), Math.max(e[3], origin[1])];
  const pad = Math.max(48, 0.06 * Math.max(e[2] - e[0], e[3] - e[1]));
  return [e[0] - pad, e[1] - pad, e[2] + pad, e[3] + pad];
}

/** The figure for a distance off a line: "0" on it, else feet and inches with a side. */
function figure(d: number, neg: string, pos: string): string {
  if (Math.abs(d) < 0.25) return "0";
  return `${ftIn(Math.abs(d))} ${d < 0 ? neg : pos}`;
}

/** The shapes of the two reference lines across `ext`: each line with its name at both ends, and a
 * tick with its distance from the other line every `stepFt` feet. */
export function referenceShapes(r: Reference, ext: [number, number, number, number], z = 2): Shape[] {
  const [ox, oy] = r.origin;
  const [x0, y0, x1, y1] = ext;
  const span = Math.max(x1 - x0, y1 - y0);
  const size = Math.max(8, Math.min(30, span / 70));
  const tick = size * 0.6;
  const line = (pts: [number, number][]): Shape => ({ pts, z, closed: false, label: "", h: 0, pen: PEN, lw: 20 });
  const text = (at: [number, number], t: string, rot = 0, k = 1): Shape => ({ pts: [at], z, closed: false, label: "", h: 0, text: t, size: size * k, rot, pen: PEN });
  const out: Shape[] = [
    line([[x0, oy], [x1, oy]]),
    line([[ox, y0], [ox, y1]]),
    // Names sit past the ends of the lines, where the rig and the drawing never cover them.
    text([x0 - size * (r.xLine.length * 0.38 + 3), oy], `${r.xLine} (Y = 0)`, 0, 1.2),
    text([x1 + size * (r.xLine.length * 0.38 + 3), oy], `${r.xLine} (Y = 0)`, 0, 1.2),
    text([ox, y0 - size * 1.6], `${r.yLine} (X = 0)`, 0, 1.2),
    text([ox, y1 + size * 1.6], `${r.yLine} (X = 0)`, 0, 1.2),
  ];
  const step = Math.max(1, r.stepFt) * 12;
  // Ticks along the X line say the distance house left or right (HL / HR, -X / +X) of the Y line; ticks along the Y line say
  // the distance up or downstage of the X line ("US" is +Y, away from the audience, as in the sketch).
  for (let x = ox + Math.ceil((x0 - ox) / step) * step; x <= x1; x += step) {
    if (Math.abs(x - ox) < 1) continue;
    out.push(line([[x, oy - tick], [x, oy + tick]]));
    out.push(text([x, oy - tick - size * 0.9], figure(x - ox, "HL", "HR"), 0, 0.75));
  }
  for (let y = oy + Math.ceil((y0 - oy) / step) * step; y <= y1; y += step) {
    if (Math.abs(y - oy) < 1) continue;
    out.push(line([[ox - tick, y], [ox + tick, y]]));
    out.push(text([ox + tick + size * 2.2, y], figure(y - oy, "DS", "US"), 0, 0.75));
  }
  return out;
}

/** A point said from the reference: "8'-6" HR of CL, 12' US of Beam A". */
export function fromReference(r: Reference, p: [number, number]): string {
  return `${figure(p[0] - r.origin[0], "HL", "HR")} of ${r.yLine}, ${figure(p[1] - r.origin[1], "DS", "US")} of ${r.xLine}`;
}
