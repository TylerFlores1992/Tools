// The tracing tool's arithmetic (Site maps review page): where a click on the aerial photo is in
// degrees, snapping to a road, and the trace file the build reads (studio/campground-maps/trace.mjs,
// which checks the same file). Pure, so it is tested (trace.test.mts).
//
// A map's local metres are linear in longitude and latitude (studio/campground-maps/geo.mjs), and
// its bbox is its frame in degrees, so converting is a straight interpolation between the two.
import type { MapPoi, MapRoad, SiteMapData } from ".";
import { AERIAL } from "./aerial.ts";

export type LonLat = [number, number];
export type XY = [number, number];
export type TracePointType = "Restroom" | "Water";
export type TraceFile = {
  version: 1;
  map: string;
  traced: string;
  by: string;
  photo: string;
  roads: TraceRoad[];
  points: { type: TracePointType; at: LonLat }[];
  /** The trace replaces the source's roads (they're there but drawn in the wrong places). */
  replace?: boolean;
  note: string;
};
/** A traced road: a campground road (drawn thin) unless `through`; a name is drawn along it. */
export type TraceRoad = { coords: LonLat[]; through?: boolean; name?: string };

/** A road as the file writes it: only the keys that say something. */
export const cleanRoad = (r: TraceRoad): TraceRoad => ({ coords: r.coords, ...(r.through ? { through: true } : {}), ...(r.name?.trim() ? { name: r.name.trim() } : {}) });
/** What the tool edits: the file's roads and points, in degrees. */
export type TraceDraft = { roads: TraceRoad[]; points: { type: TracePointType; at: LonLat }[]; replace?: boolean };

export const TRACE_POINT_TYPES: TracePointType[] = ["Restroom", "Water"];
export const PHOTO_CREDIT = AERIAL.naip.credit;
export const EMPTY_DRAFT: TraceDraft = { roads: [], points: [] };

type Framed = Pick<SiteMapData, "frame"> & { bbox: [number, number, number, number] };

/** Map metres → degrees, rounded to 7 places (about a centimetre). */
export function toDeg(map: Framed, [x, y]: XY): LonLat {
  const [w, s, e, n] = map.bbox, f = map.frame;
  const lon = w + ((x - f.x) / f.w) * (e - w);
  const lat = n - ((y - f.y) / f.h) * (n - s);
  return [Math.round(lon * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7];
}

/** Degrees → map metres. */
export function toXY(map: Framed, [lon, lat]: LonLat): XY {
  const [w, s, e, n] = map.bbox, f = map.frame;
  return [f.x + ((lon - w) / (e - w)) * f.w, f.y + ((n - lat) / (n - s)) * f.h];
}

/** The segments of an SVG path the builders write ("M x yLx y…M…"; rings end in Z). */
export function segmentsOfPath(d: string): [XY, XY][] {
  const out: [XY, XY][] = [];
  for (const part of d.split("M").filter(Boolean)) {
    const closed = part.trim().endsWith("Z");
    const pts = part.replace(/Z\s*$/, "").split("L").map((p) => p.trim().split(/\s+/).map(Number) as XY).filter((p) => p.length === 2 && p.every(Number.isFinite));
    for (let i = 1; i < pts.length; i++) out.push([pts[i - 1], pts[i]]);
    if (closed && pts.length > 2) out.push([pts.at(-1)!, pts[0]]);
  }
  return out;
}

/** The nearest point on any segment within `maxM`, or the point itself. Joins a traced lane to the
    road it leaves from, so the drawn map has no gap at the junction. */
export function snap(p: XY, segments: [XY, XY][], maxM: number): { at: XY; snapped: boolean } {
  let best: { at: XY; d: number } | null = null;
  for (const [[ax, ay], [bx, by]] of segments) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L)) : 0;
    const q: XY = [ax + t * dx, ay + t * dy];
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d <= maxM && (!best || d < best.d)) best = { at: q, d };
  }
  return best ? { at: best.at, snapped: true } : { at: p, snapped: false };
}

/** A line's length in metres. */
export const lengthM = (pts: XY[]) => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

const pathD = (pts: XY[]) => "M" + pts.map(([x, y]) => `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`).join("L");

/** The map a camper would see with this draft in place of whatever was traced before. */
export function withDraft(map: SiteMapData, draft: TraceDraft): SiteMapData {
  if (!map.bbox) return map;
  const framed = map as Framed;
  // A draft that replaces the roads is the whole road layer; otherwise it adds to the source's.
  const traced = draft.roads.filter((r) => r.coords.length > 1);
  const roads: MapRoad[] = [
    ...(draft.replace && traced.length ? [] : map.sourceRoads ?? map.roads.filter((r) => !r.traced)),
    ...traced.map((r) => ({ name: r.name?.trim() ?? "", cls: r.through ? "Local" : "Service", oneWay: "", traced: true, d: pathD(r.coords.map((c) => toXY(framed, c))) })),
  ];
  const pois: MapPoi[] = [
    ...map.pois.filter((p) => !p.traced),
    ...draft.points.map((p) => ({ name: "", type: p.type, at: toXY(framed, p.at), traced: true })),
  ];
  return { ...map, roads, pois };
}

/** The draft a map starts with: what was traced and built into it, or nothing. */
export const draftOf = (map: SiteMapData): TraceDraft =>
  map.trace
    ? { roads: map.trace.roads.map(cleanRoad), points: map.trace.points.map((p) => ({ type: p.type, at: p.at })), ...(map.trace.replace ? { replace: true } : {}) }
    : EMPTY_DRAFT;

/** The file to save as studio/campground-maps/traces/<map>.json. */
/** `photo` is the credit of the photo it was traced over (aerial.ts), NAIP's unless said. */
export function traceFile(mapKey: string, draft: TraceDraft, by: string, today: string, note = "", photo = PHOTO_CREDIT): TraceFile {
  return {
    version: 1,
    map: mapKey,
    traced: today,
    by,
    photo,
    roads: draft.roads.filter((r) => r.coords.length > 1).map(cleanRoad),
    points: draft.points.map((p) => ({ type: p.type, at: p.at })),
    ...(draft.replace ? { replace: true } : {}),
    note,
  };
}

/** Two drafts with the same roads and points (in order). */
export const sameDraft = (a: TraceDraft, b: TraceDraft) => JSON.stringify(a) === JSON.stringify(b);
