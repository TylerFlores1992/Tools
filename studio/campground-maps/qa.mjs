// The automatic check a campground map must pass before anyone sees it. Pure (no I/O), so it is
// tested (scripts/campground-maps-qa.test.mts). Everything is in the map's local metres.
//
// A wrong map is worse than no map: someone drives to the wrong loop. So the gate has three
// answers, and only "ready" goes live without a person looking:
//   - "ready":     every check passes.
// Each reason is { code, text }: the code groups them, the text is what a reviewer reads.
//
//   - "review":    a person compares it with the aerial photo first (one or more reasons).
//   - "not-drawn": the data can't make a map (the campground shows "not drawn yet").
//
// The thresholds were fixed on 2026-10-07 BEFORE the 50-campground sample was built, from Upper
// Pines (checked by hand against the Park Service's roads) and from California State Parks'
// points, which sit a median 1-9 m from real roads. They are not tuned to the sample's results.

export const RULES = {
  /** Two points closer than this are "the same spot". */
  stackM: 2,
  /** More than this share on shared spots: the provider put sites on one point. Not drawable. */
  stackedNotDrawn: 0.25,
  /** Any stacking above this needs a look. */
  stackedReview: 0.05,
  /** A site with no other site this close is likely a typo'd point (it also blows up the frame). */
  outlierM: 300,
  /** Sites spread wider than this aren't one campground map (dispersed sites, a trail's camps). */
  spanReviewM: 1500,
  /** Sites to the nearest drawn road. Upper Pines (measured): median 14 m, 90th percentile 16 m,
      worst 19 m. Twice and about four times that leaves room for a pad set back on a long spur. */
  roadMedianM: 30,
  roadP90M: 75,
  /** Share of sites inside OpenStreetMap's campground outline, when one exists. */
  insideOutline: 0.8,
  /** OSM pitches with a matching number, and how far they may sit from RIDB's point. */
  pitchMinMatched: 3,
  pitchMedianM: 20,
};

const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quantile = (xs, q) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]; };
const r1 = (v) => (v === null ? null : Math.round(v * 10) / 10);

/** Distance from a point to the nearest of many segments [[ax, ay], [bx, by]]. */
export function toSegments([x, y], segs) {
  let best = Infinity;
  for (const [[ax, ay], [bx, by]] of segs) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

/** Even-odd point in polygon (one ring of [x, y]). */
export function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** "007" and "7" are the same site number; "A07" and "A7" too. Other names compare as written. */
export const sameNumber = (a, b) => {
  const norm = (s) => String(s).trim().toUpperCase().replace(/^([A-Z]*)0*(\d+)$/, "$1$2");
  return norm(a) === norm(b);
};

/**
 * @param {object} input
 * @param {{ name: string, at: [number, number] | null }[]} input.sites  every bookable overnight site
 * @param {[[number, number], [number, number]][]} input.roadSegments   drawn roads, in metres
 * @param {string} input.roadSource  "nps" | "osm" | "usfs" | "none"
 * @param {[number, number][][]} input.outlineRings  OSM campground outlines, in metres
 * @param {{ ref: string, at: [number, number] }[]} input.pitches  OSM numbered pitches, in metres
 */
export function checkMap({ sites, roadSegments, roadSource, outlineRings = [], pitches = [] }) {
  const placed = sites.filter((s) => s.at);
  const pts = placed.map((s) => s.at);
  const near = (i) => { let best = Infinity; for (let j = 0; j < pts.length; j++) if (j !== i) best = Math.min(best, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])); return best; };
  const nn = pts.map((_, i) => near(i));
  const stacked = nn.filter((d) => d < RULES.stackM).length;
  const distinct = new Set(pts.map(([x, y]) => `${Math.round(x / RULES.stackM)},${Math.round(y / RULES.stackM)}`)).size;
  const outliers = pts.length >= 3 ? placed.filter((_, i) => nn[i] > RULES.outlierM).map((s) => s.name) : [];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const span = pts.length ? Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) : 0;
  const road = roadSegments.length ? pts.map((p) => toSegments(p, roadSegments)) : [];
  const inside = outlineRings.length ? pts.filter((p) => outlineRings.some((r) => inRing(p, r))).length : null;
  const pitchPairs = pitches.flatMap((p) => { const s = placed.find((x) => sameNumber(x.name, p.ref)); return s ? [Math.hypot(s.at[0] - p.at[0], s.at[1] - p.at[1])] : []; });

  const m = {
    sites: sites.length,
    placed: placed.length,
    unplaced: sites.filter((s) => !s.at).map((s) => s.name),
    stackedShare: pts.length ? r1((stacked / pts.length) * 1000) / 1000 : 0,
    distinctPoints: distinct,
    outliers,
    spanM: Math.round(span),
    roads: { source: roadSource, medianM: r1(median(road)), p90M: r1(quantile(road, 0.9)) },
    outline: inside === null ? null : { insideShare: Math.round((inside / pts.length) * 100) / 100 },
    pitches: pitchPairs.length ? { matched: pitchPairs.length, medianM: r1(median(pitchPairs)) } : null,
  };

  const notDrawn = [];
  if (distinct < 2) notDrawn.push({ code: "one-spot", text: "Every site is on one spot" });
  else if (m.stackedShare > RULES.stackedNotDrawn) notDrawn.push({ code: "stacked", text: `${Math.round(m.stackedShare * 100)}% of sites share a spot with another` });

  const review = [];
  if (m.unplaced.length) review.push({ code: "unplaced", text: `${m.unplaced.length} site${m.unplaced.length === 1 ? " has" : "s have"} no point` });
  if (m.stackedShare > RULES.stackedReview && !notDrawn.length) review.push({ code: "stacked", text: `${Math.round(m.stackedShare * 100)}% of sites share a spot` });
  if (outliers.length) review.push({ code: "outlier", text: `${outliers.length} site${outliers.length === 1 ? " is" : "s are"} over ${RULES.outlierM} m from any other` });
  if (span > RULES.spanReviewM) review.push({ code: "spread", text: `Sites spread over ${(span / 1000).toFixed(1)} km` });
  if (roadSource === "none") review.push({ code: "no-roads", text: "No roads to draw" });
  else if (m.roads.medianM > RULES.roadMedianM || m.roads.p90M > RULES.roadP90M) review.push({ code: "far-from-roads", text: `Sites sit far from the roads (median ${Math.round(m.roads.medianM)} m)` });
  if (m.outline && m.outline.insideShare < RULES.insideOutline) review.push({ code: "outline", text: `Only ${Math.round(m.outline.insideShare * 100)}% of sites inside OpenStreetMap’s campground outline` });
  if (m.pitches && m.pitches.matched >= RULES.pitchMinMatched && m.pitches.medianM > RULES.pitchMedianM) review.push({ code: "pitches", text: `OpenStreetMap places matching sites ${Math.round(m.pitches.medianM)} m away` });

  const verdict = notDrawn.length ? "not-drawn" : review.length ? "review" : "ready";
  return { verdict, reasons: notDrawn.length ? notDrawn : review, metrics: m, checks: checkList(m, roadSource) };
}

const pct = (v) => `${Math.round(v * 100)}%`;
/**
 * Every check as a reviewer reads it: what was measured, the limit, and the result ("pass",
 * "review", "fail", or "none" when there was nothing to check against). The lab's review page
 * shows these as they are, so a threshold lives in RULES and nowhere else.
 */
function checkList(m, roadSource) {
  const roadFar = m.roads.medianM > RULES.roadMedianM || m.roads.p90M > RULES.roadP90M;
  return [
    { code: "unplaced", label: "Sites with a point", value: `${m.placed} of ${m.sites}`, limit: "All of them", result: m.unplaced.length ? "review" : "pass" },
    { code: "stacked", label: "Sites sharing a spot", value: pct(m.stackedShare), limit: `Up to ${pct(RULES.stackedReview)}; over ${pct(RULES.stackedNotDrawn)} can’t be drawn`, result: m.distinctPoints < 2 || m.stackedShare > RULES.stackedNotDrawn ? "fail" : m.stackedShare > RULES.stackedReview ? "review" : "pass" },
    { code: "outlier", label: "Sites far from all the others", value: m.outliers.length ? m.outliers.join(", ") : "None", limit: `None over ${RULES.outlierM} m`, result: m.outliers.length ? "review" : "pass" },
    { code: "spread", label: "How far the sites spread", value: m.spanM >= 1000 ? `${(m.spanM / 1000).toFixed(1)} km` : `${m.spanM} m`, limit: `Up to ${RULES.spanReviewM / 1000} km`, result: m.spanM > RULES.spanReviewM ? "review" : "pass" },
    roadSource === "none"
      ? { code: "far-from-roads", label: "Distance to the drawn roads", value: "No roads to draw", limit: `Median up to ${RULES.roadMedianM} m`, result: "review" }
      : { code: "far-from-roads", label: "Distance to the drawn roads", value: `Median ${Math.round(m.roads.medianM)} m; 9 in 10 within ${Math.round(m.roads.p90M)} m`, limit: `Median up to ${RULES.roadMedianM} m; 9 in 10 within ${RULES.roadP90M} m`, result: roadFar ? "review" : "pass" },
    m.outline
      ? { code: "outline", label: "Inside OpenStreetMap’s campground outline", value: pct(m.outline.insideShare), limit: `At least ${pct(RULES.insideOutline)}`, result: m.outline.insideShare < RULES.insideOutline ? "review" : "pass" }
      : { code: "outline", label: "Inside OpenStreetMap’s campground outline", value: "No outline mapped", limit: `At least ${pct(RULES.insideOutline)}`, result: "none" },
    m.pitches
      ? { code: "pitches", label: "OpenStreetMap’s numbered sites agree", value: `${m.pitches.matched} matched; median ${Math.round(m.pitches.medianM)} m apart`, limit: `Within ${RULES.pitchMedianM} m (needs ${RULES.pitchMinMatched} matches)`, result: m.pitches.matched < RULES.pitchMinMatched ? "none" : m.pitches.medianM > RULES.pitchMedianM ? "review" : "pass" }
      : { code: "pitches", label: "OpenStreetMap’s numbered sites agree", value: "None mapped", limit: `Within ${RULES.pitchMedianM} m`, result: "none" },
  ];
}
