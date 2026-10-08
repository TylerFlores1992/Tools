// Which source draws a campground's roads: the one its sites actually sit along. Pure (no I/O), so
// it is tested (scripts/campground-maps-roads.test.mts). Everything is in the map's local metres.
//
// Each map still draws its roads from ONE source: two sources' copies of one road would draw it
// twice, a few metres apart. Until 2026-10-07 the source was picked by agency (the Park Service
// when it had roads in the frame, else OpenStreetMap, else the Forest Service). The 50-campground
// sample showed what that costs: Twin Peaks' Park Service roads have only the outer loop, so its
// sites sat a median 66 m from the drawn roads while OpenStreetMap had all twelve inner rows.
//
// The rule: measure how far every site is from each source's roads, and take the source with the
// shortest "9 in 10 sites within" distance (p90). That distance is what a missing loop moves: the
// sites along it are suddenly far from every drawn road. The usual order (Park Service,
// OpenStreetMap, Forest Service, Census) still wins when its fit is close to the best, so a source
// is only passed over when another is clearly better.
//
// The margin was set on 2026-10-07 after measuring the sample (scratch, not committed): 5 m or a
// quarter of the best p90, whichever is larger. Small differences between two sources that both
// follow the real roads are noise; Twin Peaks' 118 m against 13 m is not.

import { toSegments } from "./qa.mjs";

export const ROAD_ORDER = ["nps", "osm", "usfs", "tiger"];
export const MARGIN = { minM: 5, share: 0.25 };

const r1 = (v) => Math.round(v * 10) / 10;

/** How well one source's roads fit the sites: median and p90 distance, in metres. Null with no roads. */
export function roadFit(points, segments) {
  if (!segments.length || !points.length) return null;
  const d = points.map((p) => toSegments(p, segments)).sort((a, b) => a - b);
  const median = d.length % 2 ? d[d.length >> 1] : (d[d.length / 2 - 1] + d[d.length / 2]) / 2;
  const p90 = d[Math.min(d.length - 1, Math.ceil(0.9 * d.length) - 1)];
  return { medianM: r1(median), p90M: r1(p90) };
}

/**
 * Pick the road source. `fits` maps a source key to its roadFit (or null when it has no roads in
 * the frame). Returns { source, why } where source is "none" when no source has roads.
 */
export function pickRoadSource(fits) {
  const have = ROAD_ORDER.filter((k) => fits[k]);
  if (!have.length) return { source: "none", why: "No source has roads here" };
  const best = [...have].sort((a, b) => fits[a].p90M - fits[b].p90M || fits[a].medianM - fits[b].medianM || ROAD_ORDER.indexOf(a) - ROAD_ORDER.indexOf(b))[0];
  const limit = fits[best].p90M + Math.max(MARGIN.minM, MARGIN.share * fits[best].p90M);
  const source = have.find((k) => fits[k].p90M <= limit);
  const first = have[0];
  const why = source === first
    ? have.length === 1 ? "The only source with roads here" : "The usual source, and its roads fit the sites as well as any"
    : `Its roads fit the sites better: 9 in 10 within ${Math.round(fits[source].p90M)} m, against ${Math.round(fits[first].p90M)} m`;
  return { source, why };
}
