// Roads and service points a person traced from the aerial photo, where no public source has them.
// Pure checks, plus the read from disk. Tested in scripts/campground-maps-trace.test.mts.
//
// A trace file is studio/campground-maps/traces/<map>.json, the same file the lab's tracing tool
// (Site maps review page) downloads:
//
//   { "version": 1, "map": "ridb-274721", "traced": "2026-10-07", "by": "…",
//     "photo": "USDA NAIP via USGS The National Map (public domain)",
//     "roads":  [{ "coords": [[lon, lat], …], "through": true? }],
//     "points": [{ "type": "Restroom" | "Water", "at": [lon, lat] }],
//     "replace": true?, "note": "…" }
//
// Coordinates are degrees (WGS84), so a trace survives a rebuild that moves the frame. The photo
// is public domain; tracing from it is our own work, with nothing to license.
//
// A traced road adds to the source's roads: it is a campground road (drawn thin) unless it says
// "through": true. With "replace": true the trace replaces the source's roads entirely, for a map
// whose roads a source has but draws in the wrong places (Lost Creek's are up to 20 m off the
// visible dirt roads); the person then traces every road the map should show, through roads too.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const TRACE_VERSION = 1;
export const POINT_TYPES = ["Restroom", "Water"];
export const TRACES = join(import.meta.dirname, "traces");

/** How far past the map's frame a traced point may sit, as a share of the frame's size: a lane
    may run a little off the edge to meet the road it joins, but not to another campground. */
const SLACK = 0.25;

const isPair = (c) => Array.isArray(c) && c.length === 2 && c.every((v) => typeof v === "number" && Number.isFinite(v));

/**
 * Every problem with a trace file, in words; empty when it's fine. `bbox` is the map's frame in
 * degrees [west, south, east, north].
 */
export function traceProblems(trace, mapKey, bbox) {
  const out = [];
  if (!trace || typeof trace !== "object") return ["not a trace file"];
  if (trace.version !== TRACE_VERSION) out.push(`version must be ${TRACE_VERSION}`);
  if (trace.map !== mapKey) out.push(`it is for ${JSON.stringify(trace.map)}, not ${mapKey}`);
  if (!Array.isArray(trace.roads)) out.push("roads must be a list");
  if (!Array.isArray(trace.points)) out.push("points must be a list");
  if (trace.replace !== undefined && typeof trace.replace !== "boolean") out.push("replace must be true or false");
  if (out.length) return out;
  const [w, s, e, n] = bbox;
  const dx = (e - w) * SLACK, dy = (n - s) * SLACK;
  const near = ([lon, lat]) => lon >= w - dx && lon <= e + dx && lat >= s - dy && lat <= n + dy;
  trace.roads.forEach((r, i) => {
    if (!Array.isArray(r?.coords) || r.coords.length < 2) out.push(`road ${i + 1} needs at least two points`);
    else if (!r.coords.every(isPair)) out.push(`road ${i + 1} has a point that isn't [lon, lat]`);
    else if (!r.coords.every(near)) out.push(`road ${i + 1} runs far outside the map`);
    if (r?.through !== undefined && typeof r.through !== "boolean") out.push(`road ${i + 1}: through must be true or false`);
  });
  trace.points.forEach((p, i) => {
    if (!POINT_TYPES.includes(p?.type)) out.push(`point ${i + 1} must be one of ${POINT_TYPES.join(", ")}`);
    if (!isPair(p?.at)) out.push(`point ${i + 1} isn't at [lon, lat]`);
    else if (!near(p.at)) out.push(`point ${i + 1} is far outside the map`);
  });
  if (trace.replace === true && !trace.roads.length) out.push("a trace that replaces the roads needs at least one road");
  return out;
}

/** The trace for a map, or null when nobody has traced it. Throws on a broken file: a trace that
    silently fails to apply is a map that silently keeps its gap. */
export function readTrace(mapKey, bbox, dir = TRACES) {
  const file = join(dir, `${mapKey}.json`);
  if (!existsSync(file)) return null;
  const trace = JSON.parse(readFileSync(file, "utf8"));
  const problems = traceProblems(trace, mapKey, bbox);
  if (problems.length) throw new Error(`${file}: ${problems.join("; ")}`);
  return trace;
}
