// Campground site maps CampHawk draws itself, from public data (studio/campground-maps/).
// One JSON per campground, built by `node studio/campground-maps/build.mjs`. Coordinates are
// metres on a local north-up plane; `frame` is the box the map shows.
import upperPines from "./ridb-232447.json" with { type: "json" };

export type MapSite = {
  name: string;
  /** RIDB's campsite type, upper case ("STANDARD NONELECTRIC"). */
  type: string;
  /** Null when the provider publishes no point for this site. */
  at: [number, number] | null;
  /** Unit vector pointing away from the nearest campground road: where the number goes. */
  out?: [number, number];
  accessible: boolean;
  /** The loop it's on, where the source says (State Parks via RC's own area names). */
  loop?: string;
  /** Parking spur size, where State Parks records it. Not a vehicle limit. */
  spurFt?: number;
  spurWidthFt?: number;
  maxVehicleFt?: number;
  maxPeople?: number;
  backIn?: boolean;
  shade?: boolean;
};
export type SiteMapData = {
  facilityId: string;
  source: { ridbExport: string; built: string };
  /** The map's credit line; Recreation.gov maps use the built-in one. */
  credits?: string;
  /** Set when a source hasn't approved this use yet: the map is never deployed. */
  pending?: string;
  /** What the build left off on purpose, for a person to check. */
  review?: { duplicateNumbers: string[]; notInStateParksData: string[] };
  frame: { x: number; y: number; w: number; h: number };
  /** The frame in degrees [west, south, east, north] (maps built since 2026-10-07). */
  bbox?: [number, number, number, number];
  name?: string;
  /** Which source drew each layer (maps built since 2026-10-07). */
  sources?: { roads: string; water: string; osm: boolean };
  /** What the automatic checks compared against (OpenStreetMap's outline and numbered pitches). */
  evidence?: { outline: string; pitches: { ref: string; at: [number, number] }[] };
  labels: { text: string; kind: "road" | "trail" | "water"; at: [number, number]; angle: number }[];
  roads: { name: string; cls: string; oneWay: string; d: string }[];
  trails: { name: string; d: string }[];
  lots: { d: string }[];
  water: { fcode: number; d: string }[];
  buildings: { name: string; type: string; d: string }[];
  pois: { name: string; type: string; at: [number, number] }[];
  sites: MapSite[];
};

/** Lab campground id → its drawn map. A campground missing here has no map yet. */
const MAPS: Record<string, SiteMapData> = {
  "upper-pines": upperPines as SiteMapData,
};

export const mapFor = (campgroundId: string): SiteMapData | null => MAPS[campgroundId] ?? null;

/** Maps built from data still awaiting its owner's permission (California State Parks). They are
    written to public/lab-local/ (git-ignored), so they load on a local run and are absent from
    every deploy, where the page shows "not drawn yet". */
export const LOCAL_MAPS: Record<string, string> = {
  "jedediah-smith": "/lab-local/csp-jedediah-smith.json",
};

/** "STANDARD NONELECTRIC" → "standard nonelectric"; RV stays an initialism. Reads after a comma. */
export const siteTypeLabel = (type: string) => type.toLowerCase().replace(/\brv\b/g, "RV");

/** Where on the map, as a percentage of the frame (for HTML overlays on the SVG). */
export function pct(map: SiteMapData, [x, y]: [number, number]): { left: string; top: string } {
  const f = map.frame;
  return { left: `${(((x - f.x) / f.w) * 100).toFixed(2)}%`, top: `${(((y - f.y) / f.h) * 100).toFixed(2)}%` };
}

export const restrooms = (map: SiteMapData) => map.pois.filter((p) => p.type === "Restroom");

/** Straight-line distance to the nearest restroom, in feet rounded to 10 (never a walking route). */
export function nearestRestroomFt(map: SiteMapData, site: MapSite): number | null {
  if (!site.at) return null;
  const [sx, sy] = site.at;
  let best = Infinity;
  for (const r of restrooms(map)) best = Math.min(best, Math.hypot(r.at[0] - sx, r.at[1] - sy));
  return Number.isFinite(best) ? Math.round((best * 3.28084) / 10) * 10 : null;
}

/** A scale bar that is a round number of feet and about a fifth of the visible width (the whole
    frame, or a zoomed part of it: `zoom` is drawn width over visible width). */
export function scaleBar(map: SiteMapData, zoom = 1): { ft: number; metres: number } {
  const target = (map.frame.w / zoom / 5) * 3.28084;
  const ft = [25, 50, 100, 200, 250, 300, 500, 1000, 2000].reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  return { ft, metres: ft / 3.28084 };
}

/** Every tenth site gets a small number on the map, so any site can be found from its neighbours. */
export const isWaymark = (name: string) => /^\d+$/.test(name) && Number(name) % 10 === 0;
