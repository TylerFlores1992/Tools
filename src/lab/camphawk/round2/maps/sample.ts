// The 50-campground Recreation.gov sample (studio/campground-maps/build-sample.mjs): each map's
// automatic check and a small thumbnail. The full maps are in public/private/camphawk/maps/ and are
// fetched when one is opened.
import manifest from "./sample-manifest.json" with { type: "json" };
import type { Level } from "../../ui/StatusMark";
import type { SiteMapData } from ".";

export type Verdict = "ready" | "review" | "not-drawn";
export type ReasonCode = "one-spot" | "stacked" | "unplaced" | "outlier" | "spread" | "no-roads" | "far-from-roads" | "outline" | "pitches" | "traced";
export type Reason = { code: ReasonCode; text: string };
export type Metrics = {
  sites: number;
  placed: number;
  unplaced: string[];
  stackedShare: number;
  distinctPoints: number;
  outliers: string[];
  spanM: number;
  roads: { source: string; medianM: number | null; p90M: number | null };
  outline: { insideShare: number } | null;
  pitches: { matched: number; medianM: number } | null;
  traced?: { roads: number; points: number };
};
/** One automatic check as the build measured it (studio/campground-maps/qa.mjs, checkList). */
export type Check = { code: ReasonCode; label: string; value: string; limit: string; result: "pass" | "review" | "fail" | "none" };
export type Thumb = { frame: { x: number; y: number; w: number; h: number }; roads: { service: boolean; d: string }[]; water: string[]; dots: [number, number][] };
export type SampleEntry = {
  id: string;
  name: string;
  agency: string;
  state: string;
  recArea: string;
  verdict: Verdict;
  reasons: Reason[];
  checks: Check[];
  metrics: Metrics;
  sources: NonNullable<SiteMapData["sources"]> & { water: "usgs" | "osm" | "none" };
  thumb: Thumb;
};
export type Sample = {
  built: string;
  drawn: { seed: number; count: number; export: string };
  population: {
    campgrounds: number;
    singleUnit: { campgrounds: number; note: string };
    multiSite: { campgrounds: number; byAgency: Record<string, number> };
  };
  summary: { ready: number; review: number; notDrawn: number; failed: number };
  entries: SampleEntry[];
};

export const SAMPLE = manifest as unknown as Sample;

/** The three answers, each a shape and a word in CampHawk's admin vocabulary (StatusMark). */
export const VERDICT: Record<Verdict, { level: Level; word: string }> = {
  ready: { level: "ok", word: "Ready" },
  review: { level: "warn", word: "Needs a look" },
  "not-drawn": { level: "fail", word: "Can’t be drawn" },
};

/** Why a map needs a look, as the summary groups it. */
export const REASON_LABEL: Record<ReasonCode, string> = {
  "far-from-roads": "Sites far from the drawn roads",
  "no-roads": "No roads to draw",
  unplaced: "Some sites have no point",
  outlier: "A site far from all the others",
  spread: "Sites spread over more than 1.5 km",
  stacked: "Sites sharing one spot",
  outline: "Sites outside OpenStreetMap’s outline",
  pitches: "OpenStreetMap places sites elsewhere",
  "one-spot": "Every site on one spot",
  traced: "Roads traced from the photo, to approve",
};

/** "Forest Service" → "Forest Service"; the long agency names, shortened for a card. */
export const AGENCY_SHORT: Record<string, string> = {
  "US Army Corps of Engineers": "Army Corps",
  "National Park Service": "Park Service",
  "Bureau of Land Management": "BLM",
  "Forest Service": "Forest Service",
  "Bureau of Reclamation": "Reclamation",
  "Fish and Wildlife Service": "Fish and Wildlife",
};

/**
 * A 95% interval for a share seen in a sample (Wilson score), as whole percentages. With 50
 * campgrounds the true share could sit well either side of the one we saw, and the page says so.
 */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 0];
  const p = k / n, d = 1 + (z * z) / n;
  const mid = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, Math.round((mid - half) * 100)), Math.min(100, Math.round((mid + half) * 100))];
}

/** Every reason across the sample, counted by kind, most common first. */
export function reasonCounts(entries: SampleEntry[]): { code: ReasonCode; count: number }[] {
  const n = new Map<ReasonCode, number>();
  for (const e of entries) if (e.verdict !== "ready") for (const r of new Set(e.reasons.map((x) => x.code))) n.set(r, (n.get(r) ?? 0) + 1);
  return [...n].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || REASON_LABEL[a.code].localeCompare(REASON_LABEL[b.code]));
}
