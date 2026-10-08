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

import { pickOutline } from "../../src/lab/camphawk/round2/maps/first-come.ts";

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
 * @param {{ name: string, at: [number, number] | null, strayM?: number }[]} input.sites  every bookable overnight site (strayM: its point was left off as a stray)
 * @param {[[number, number], [number, number]][]} input.roadSegments   drawn roads, in metres
 * @param {string} input.roadSource  "nps" | "osm" | "usfs" | "tiger" | "traced" | "none"
 * @param {{ roads: number, points: number, sites?: number }} [input.traced]  what was traced from the aerial photo
 * @param {[number, number][][]} [input.outlineRings]  OSM campground outlines, in metres
 * @param {{ ref: string, at: [number, number] }[]} [input.pitches]  OSM numbered pitches, in metres
 */
export function checkMap({ sites, roadSegments, roadSource, traced = { roads: 0, points: 0 }, outlineRings = [], pitches = [] }) {
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
    traced: { roads: traced.roads, points: traced.points, sites: traced.sites ?? 0 },
  };

  const notDrawn = [];
  if (distinct < 2) notDrawn.push({ code: "one-spot", text: "Every site is on one spot" });
  else if (m.stackedShare > RULES.stackedNotDrawn) notDrawn.push({ code: "stacked", text: `${Math.round(m.stackedShare * 100)}% of sites share a spot with another` });

  const review = [];
  const strays = sites.filter((s) => !s.at && s.strayM);
  if (strays.length) review.push({ code: "unplaced", text: `${strays.map((s) => `${s.name}’s point is ${fmtKm(s.strayM)} from every other site, so it’s left off`).join("; ")}` });
  if (m.unplaced.length > strays.length) review.push({ code: "unplaced", text: `${m.unplaced.length - strays.length} site${m.unplaced.length - strays.length === 1 ? " has" : "s have"} no point` });
  if (m.stackedShare > RULES.stackedReview && !notDrawn.length) review.push({ code: "stacked", text: `${Math.round(m.stackedShare * 100)}% of sites share a spot` });
  if (outliers.length) review.push({ code: "outlier", text: `${outliers.length} site${outliers.length === 1 ? " is" : "s are"} over ${RULES.outlierM} m from any other` });
  if (span > RULES.spanReviewM) review.push({ code: "spread", text: `Sites spread over ${(span / 1000).toFixed(1)} km` });
  if (roadSource === "none") review.push({ code: "no-roads", text: "No roads to draw" });
  else if (m.roads.medianM > RULES.roadMedianM || m.roads.p90M > RULES.roadP90M) review.push({ code: "far-from-roads", text: `Sites sit far from the roads (median ${Math.round(m.roads.medianM)} m)` });
  if (m.outline && m.outline.insideShare < RULES.insideOutline) review.push({ code: "outline", text: `Only ${Math.round(m.outline.insideShare * 100)}% of sites inside OpenStreetMap’s campground outline` });
  if (m.pitches && m.pitches.matched >= RULES.pitchMinMatched && m.pitches.medianM > RULES.pitchMedianM) review.push({ code: "pitches", text: `OpenStreetMap places matching sites ${Math.round(m.pitches.medianM)} m away` });
  // Traced roads and points are someone's reading of a photo, not a published source: a person
  // approves them before the map goes live, however well the sites fit.
  const tracedText = tracedWords(m.traced);
  if (tracedText) review.push({ code: "traced", text: `${tracedText} traced from the aerial photo` });

  const verdict = notDrawn.length ? "not-drawn" : review.length ? "review" : "ready";
  return { verdict, reasons: notDrawn.length ? notDrawn : review, metrics: m, checks: checkList(m, roadSource) };
}

const pct = (v) => `${Math.round(v * 100)}%`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/** 2,300 km, 28 km, 2.2 km. */
const fmtKm = (m) => (m >= 10000 ? `${Math.round(m / 1000).toLocaleString("en-US")} km` : `${(m / 1000).toFixed(1)} km`);
/** "2 roads and 1 point", or "" when nothing was traced. */
const tracedWords = (t) => [t.roads && plural(t.roads, "road", "roads"), t.points && plural(t.points, "point", "points"), t.sites && plural(t.sites, "site position", "site positions")].filter(Boolean).join(" and ");
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
    { code: "traced", label: "Traced from the aerial photo", value: tracedWords(m.traced) || "Nothing", limit: "A person approves anything traced", result: tracedWords(m.traced) ? "review" : "none" },
  ];
}

// --- Split listings: the same check on each area (2026-10-08) ---
//
// A listing split into areas (src/lab/camphawk/round2/maps/areas.ts) is shown to a camper one
// area at a time, so each area is checked as its own map: its sites, the listing's roads, and
// only the OpenStreetMap outlines that reach the area (a separate area has its own outline or
// none, and another area's outline says nothing about it). The listing's own "spread" no longer
// applies; whether the listing's sites have points, share spots, or were traced still does.
//
// A split is drawn by a rule, not by the provider, so a person checks every split listing before
// it goes live ("areas"), however well each area fits. Dispersed listings (many small groups)
// aren't drawn as areas yet: they stay held ("dispersed").

/** Reasons that are about the whole listing, not one area. */
const LISTING_CODES = new Set(["unplaced", "stacked", "traced"]);

/**
 * @param {ReturnType<typeof checkMap>} whole  checkMap on the whole listing
 * @param {{ name: string, sites: string[], frame: {x:number,y:number,w:number,h:number} }[]} areas
 * @param {Parameters<typeof checkMap>[0]} input  what the whole listing was checked with
 * @returns {Omit<ReturnType<typeof checkMap>, "metrics"> & { metrics: ReturnType<typeof checkMap>["metrics"] & { areas?: number }, areas?: { name: string, verdict: string, reasons: { code: string, text: string }[] }[] }}
 */
export function checkAreas(whole, areas, input) {
  if (whole.verdict === "not-drawn") return whole;
  const perArea = areas.map((a) => {
    const keep = new Set(a.sites);
    const f = a.frame;
    const touches = (ring) => ring.some(([x, y]) => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h);
    const qa = checkMap({
      ...input,
      sites: input.sites.filter((s) => s.at && keep.has(s.name)),
      outlineRings: (input.outlineRings ?? []).filter(touches),
      traced: { roads: 0, points: 0 },
    });
    return { name: a.name, verdict: qa.verdict, reasons: qa.reasons.filter((r) => !LISTING_CODES.has(r.code)) };
  });
  const reasons = [
    { code: "areas", text: `Shown as ${areas.length} areas: a person checks the split` },
    ...whole.reasons.filter((r) => LISTING_CODES.has(r.code)),
    ...perArea.flatMap((a) => a.reasons.map((r) => ({ code: r.code, text: `${a.name}: ${r.text}` }))),
  ];
  const widest = Math.max(...areas.map((a) => Math.max(a.frame.w, a.frame.h)));
  const checks = whole.checks.map((c) => c.code !== "spread" ? c : {
    code: "spread", label: "How far the sites spread", value: `${(whole.metrics.spanM / 1000).toFixed(1)} km, shown as ${areas.length} areas (widest ${Math.round(widest)} m)`,
    limit: `Up to ${RULES.spanReviewM / 1000} km, or areas`, result: "review",
  });
  return { verdict: "review", reasons, metrics: { ...whole.metrics, areas: areas.length }, checks, areas: perArea };
}

/**
 * A listing too scattered to draw as areas: held, and said so.
 * @param {ReturnType<typeof checkMap>} whole
 * @param {number} groups
 */
export function checkDispersed(whole, groups) {
  if (whole.verdict === "not-drawn") return whole;
  return { ...whole, verdict: "review", reasons: [{ code: "dispersed", text: `${groups} groups of sites: dispersed camping, not drawn as areas yet` }, ...whole.reasons.filter((r) => r.code !== "spread")], metrics: { ...whole.metrics, dispersed: groups } };
}

// --- Single units: a place, not a site to pick (2026-10-08) ---
//
// A listing with one bookable unit (a cabin, lookout, guard station or group site) gets a location
// map (1.4 km across, build.mjs SINGLE_UNIT_PAD_M) with the unit's pin, the nearest road and trail,
// and its coordinates. There is nothing to tell apart, so the multi-site checks (stacking, spread,
// distance from roads for every site) don't apply. What can be wrong is the point itself, and
// whether the map shows any way to it. Fixed on 2026-10-08, before any single unit was built for a
// wave (the five built for the design comps were not checked against these numbers):
export const UNIT_RULES = {
  /** RIDB gives the listing its own point too. A unit farther than this from it needs a look
      (the same distance as a campground's outlier). */
  facilityAgreeM: 300,
  /** Half the location map's width: a road or trail within this is on the map. */
  accessM: 700,
};

/**
 * @param {object} input
 * @param {{ name: string, at: [number, number] | null }} input.site
 * @param {[number, number] | null} input.facilityAt  the listing's own RIDB point, in the map's metres
 * @param {[[number, number], [number, number]][]} input.roadSegments
 * @param {[[number, number], [number, number]][]} input.trailSegments
 * @param {string} input.roadSource
 * @param {{ roads: number, points: number, sites?: number }} [input.traced]
 */
export function checkUnit({ site, facilityAt, roadSegments, trailSegments, roadSource, traced = { roads: 0, points: 0 } }) {
  const at = site.at;
  const r0 = (v) => (v === null || !Number.isFinite(v) ? null : Math.round(v));
  const facilityM = at && facilityAt ? r0(Math.hypot(at[0] - facilityAt[0], at[1] - facilityAt[1])) : null;
  const roadM = at && roadSegments.length ? r0(toSegments(at, roadSegments)) : null;
  const trailM = at && trailSegments.length ? r0(toSegments(at, trailSegments)) : null;
  const m = { kind: "unit", sites: 1, placed: at ? 1 : 0, unplaced: at ? [] : [site.name], facilityM, roadM, trailM, roads: { source: roadSource }, traced: { roads: traced.roads, points: traced.points, sites: traced.sites ?? 0 } };
  if (!at) return { verdict: "not-drawn", reasons: [{ code: "unplaced", text: "The unit has no point" }], metrics: m, checks: unitChecks(m) };
  const reach = (d) => d !== null && d <= UNIT_RULES.accessM;
  const review = [];
  if (facilityM !== null && facilityM > UNIT_RULES.facilityAgreeM) review.push({ code: "facility-point", text: `The listing’s own point is ${facilityM >= 1000 ? `${(facilityM / 1000).toFixed(1)} km` : `${facilityM} m`} from the unit’s` });
  if (!reach(roadM) && !reach(trailM)) review.push({ code: "no-access", text: `No road or trail on the map within ${UNIT_RULES.accessM} m` });
  const tracedText = tracedWords(m.traced);
  if (tracedText) review.push({ code: "traced", text: `${tracedText} traced from the aerial photo` });
  return { verdict: review.length ? "review" : "ready", reasons: review, metrics: m, checks: unitChecks(m) };
}

function unitChecks(m) {
  const dist = (d) => (d === null ? "None on the map" : d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d} m`);
  const reach = (d) => d !== null && d <= UNIT_RULES.accessM;
  return [
    { code: "unplaced", label: "The unit has a point", value: m.placed ? "Yes" : "No", limit: "Yes", result: m.placed ? "pass" : "fail" },
    m.facilityM === null
      ? { code: "facility-point", label: "Agrees with the listing’s own point", value: "No listing point", limit: `Within ${UNIT_RULES.facilityAgreeM} m`, result: "none" }
      : { code: "facility-point", label: "Agrees with the listing’s own point", value: dist(m.facilityM), limit: `Within ${UNIT_RULES.facilityAgreeM} m`, result: m.facilityM > UNIT_RULES.facilityAgreeM ? "review" : "pass" },
    { code: "no-access", label: "A road or trail on the map", value: `Road: ${dist(m.roadM)}; trail: ${dist(m.trailM)}`, limit: `One within ${UNIT_RULES.accessM} m`, result: !m.placed ? "none" : reach(m.roadM) || reach(m.trailM) ? "pass" : "review" },
    { code: "traced", label: "Traced from the aerial photo", value: tracedWords(m.traced) || "Nothing", limit: "A person approves anything traced", result: tracedWords(m.traced) ? "review" : "none" },
  ];
}

/** A first-come campground booked as one "Standard" site (docs/design/campground-maps-first-come.md):
    its point is a payment placeholder, so the map draws OpenStreetMap's outline of the campground.
    Farther than this from the point, an outline is someone else's (the lab's OUTLINE_REACH_M). */
export const FIRST_COME_RULES = { outlineReachM: 250 };

/**
 * The first-come check: the placeholder has a point, an OpenStreetMap outline holds it or lies
 * within reach, and the listing isn't marked closed. Never "ready" on a guess: no outline or a
 * closed listing waits for a person.
 * @param {{ site: { name: string, at: [number, number] | null }, outlines?: { ring: [number, number][], name: string }[], name?: string, closed?: boolean, traced?: { roads: number, points: number, sites?: number } }} input
 * @returns {{ verdict: "ready" | "review" | "not-drawn", reasons: { code: string, text: string }[], metrics: { kind: "firstcome", sites: number, placed: number, unplaced: string[], outlineM: number | null, outlineName: string | null, otherName: string | null, closed: boolean, traced: { roads: number, points: number, sites?: number } }, checks: { code: string, label: string, value: string, limit: string, result: string }[] }}
 */
export function checkFirstCome({ site, outlines = [], name = "", closed = false, traced = { roads: 0, points: 0 } }) {
  const at = site.at;
  // The same pick the camper's map makes (first-come.ts): the outline named for this campground, or
  // an unnamed one, never one named for another campground.
  const { pick, other } = at ? pickOutline(at, outlines, name, FIRST_COME_RULES.outlineReachM) : { pick: null, other: null };
  const outlineM = pick ? Math.round(pick.pointOutsideM) : null;
  const m = { kind: "firstcome", sites: 1, placed: at ? 1 : 0, unplaced: at ? [] : [site.name], outlineM, outlineName: pick?.name ?? null, otherName: !pick && other ? other.name : null, closed, traced: { roads: traced.roads, points: traced.points, sites: traced.sites ?? 0 } };
  if (!at) return { verdict: "not-drawn", reasons: [{ code: "unplaced", text: "The listing has no point" }], metrics: m, checks: firstComeChecks(m) };
  const review = [];
  if (!pick && other) review.push({ code: "outline-other-name", text: `OpenStreetMap’s campground outline here is “${other.name}”, not this campground` });
  else if (!pick) {
    const ringM = (r) => (inRing(at, r) ? 0 : toSegments(at, r.slice(1).map((b, i) => [r[i], b]).concat([[r[r.length - 1], r[0]]])));
    const nearest = outlines.length ? Math.round(Math.min(...outlines.map((o) => ringM(o.ring)))) : null;
    review.push({ code: "no-outline", text: nearest === null ? "OpenStreetMap doesn’t outline the campground" : `OpenStreetMap’s nearest campground outline is ${nearest} m from the listed point` });
  }
  if (closed) review.push({ code: "closed", text: "Recreation.gov’s listing says it’s closed" });
  const tracedText = tracedWords(m.traced);
  if (tracedText) review.push({ code: "traced", text: `${tracedText} traced from the aerial photo` });
  return { verdict: review.length ? "review" : "ready", reasons: review, metrics: m, checks: firstComeChecks(m) };
}

function firstComeChecks(m) {
  const near = m.outlineM !== null && m.outlineM <= FIRST_COME_RULES.outlineReachM;
  return [
    { code: "unplaced", label: "The listing has a point", value: m.placed ? "Yes" : "No", limit: "Yes", result: m.placed ? "pass" : "fail" },
    { code: "no-outline", label: "OpenStreetMap outlines the campground", value: m.outlineM === null ? (m.otherName ? `Only another campground’s, “${m.otherName}”` : "No outline nearby") : m.outlineM === 0 ? "Yes, around the listed point" : `${m.outlineM} m from the listed point`, limit: `Within ${FIRST_COME_RULES.outlineReachM} m`, result: !m.placed ? "none" : near ? "pass" : "review" },
    { code: "outline-other-name", label: "The outline is this campground’s", value: m.outlineName ? `Named “${m.outlineName}”` : m.outlineM !== null ? "Unnamed" : m.otherName ? `Named “${m.otherName}”` : "No outline", limit: "Not named for another campground", result: !m.placed || (m.outlineM === null && !m.otherName) ? "none" : m.otherName ? "review" : "pass" },
    { code: "closed", label: "Open, by Recreation.gov’s listing", value: m.closed ? "Says closed" : "Not marked closed", limit: "Not closed", result: m.closed ? "review" : "pass" },
    { code: "traced", label: "Traced from the aerial photo", value: tracedWords(m.traced) || "Nothing", limit: "A person approves anything traced", result: tracedWords(m.traced) ? "review" : "none" },
  ];
}
