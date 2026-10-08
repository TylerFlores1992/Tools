// Which aerial photo a map is checked and traced over, in one place: the review page's check and
// tracing tool (AerialCheck.tsx, TraceTool.tsx, SiteMaps.tsx) and the studio scripts
// (aerial-check.mjs, aerial-grid.mjs, trace-from-grid.mjs) all ask here.
//
// Every source is public domain, from a US federal agency, so what is traced from it is our own
// work. Never Google, Esri or Bing, and never a "for viewing only" basemap (The National Map's
// USGSImageryOnly is licensed SPOT imagery in Alaska).
//
// - USDA NAIP via USGS (the default): the lower 48. NAIP never flew Alaska, and USGS's mosaic has
//   no Hawaii, so it answers blank there.
// - Hawaii: NAIP 2021 (flown Jan 2022, 0.6 m), the same USDA program, served by the Forest
//   Service's Geospatial Technology & Applications Center on the Interdepartmental Imagery
//   Publication Platform (IIPP).
// - Alaska: the Forest Service Alaska Region's orthophotos on IIPP (2009-2024, mostly 0.3 m),
//   which "waives copyright and related rights in the work worldwide through the CC0". The
//   four-band service (newest years) first; a few maps only the older three-band service covers;
//   some places neither does (interior Alaska, Lake Clark, Kenai Fjords' coast). Measured per map
//   on 2026-10-08 with studio/campground-maps/aerial-sources.mjs, recorded in PICKS below.
//
// Both hosts serve far more than 4,000 px a side, but USGS's NAIP doesn't (maxImageWidth/Height,
// read 2026-10-08): asked for more, it answers 200 with a 156-byte JSON error under an image/jpeg
// header, so the photo never loads. One limit for all keeps the callers simple.

export type Bbox = [number, number, number, number];
export type AerialKey = "naip" | "naip-hawaii" | "usfs-r10" | "usfs-r10-0.6m" | "usfs-r10-rgb";

export interface AerialSource {
  key: AerialKey;
  /** The ImageServer's exportImage endpoint. */
  service: string;
  /** Bands to ask for (a four-band service gives red, green, blue and near-infrared). */
  bands?: string;
  /** Short credit, under the photo. */
  short: string;
  /** Full credit: the review page's sources and a trace file's `photo`. */
  credit: string;
  /** Who to blame when it doesn't load. */
  host: string;
  /** Ask at exactly this many metres a pixel, whatever the width asked for: a photo the service
      only draws at its own scale. */
  fixedM?: number;
}

const IIPP = "https://imagery.geoplatform.gov/iipp/rest/services";

export const AERIAL: Record<AerialKey, AerialSource> = {
  naip: {
    key: "naip",
    service: "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage",
    short: "USDA NAIP via USGS (public domain)",
    credit: "USDA NAIP via USGS The National Map (public domain)",
    host: "USGS’s imagery service",
  },
  "naip-hawaii": {
    key: "naip-hawaii",
    service: `${IIPP}/NAIP/NAIP2021_Hawaii/ImageServer/exportImage`,
    bands: "0,1,2",
    short: "USDA NAIP 2021 Hawaii via IIPP (public domain)",
    credit: "USDA NAIP 2021 (Hawaii), via the Interdepartmental Imagery Publication Platform (public domain)",
    host: "The Forest Service’s imagery platform (IIPP)",
  },
  "usfs-r10": {
    key: "usfs-r10",
    service: `${IIPP}/Aerial_Imagery/RGBI_post2000_USFS_R10_Alaska_multiRes_Public/ImageServer/exportImage`,
    bands: "0,1,2",
    short: "U.S. Forest Service Alaska Region via IIPP (public domain, CC0)",
    credit: "U.S. Forest Service Alaska Region orthophotos, 2009-2024, via the Interdepartmental Imagery Publication Platform (public domain, CC0)",
    host: "The Forest Service’s imagery platform (IIPP)",
  },
  // The same service, where the only photo is the 2010 0.6 m one: IIPP draws it only when asked at
  // about 0.6 m a pixel, and answers blank finer or coarser (Spencer Glacier's 115 m frame at
  // 1,400 px; a 1.4 km unit frame at 1,000 px). Measured 2026-10-08.
  "usfs-r10-0.6m": {
    key: "usfs-r10-0.6m",
    service: `${IIPP}/Aerial_Imagery/RGBI_post2000_USFS_R10_Alaska_multiRes_Public/ImageServer/exportImage`,
    bands: "0,1,2",
    short: "U.S. Forest Service Alaska Region 2010 via IIPP (public domain, CC0)",
    credit: "U.S. Forest Service Alaska Region orthophotos, 2010 (0.6 m), via the Interdepartmental Imagery Publication Platform (public domain, CC0)",
    host: "The Forest Service’s imagery platform (IIPP)",
    fixedM: 0.6,
  },
  "usfs-r10-rgb": {
    key: "usfs-r10-rgb",
    service: `${IIPP}/Aerial_Imagery/RGB_post2000_USFS_R10_Alaska_multiRes_Public/ImageServer/exportImage`,
    short: "U.S. Forest Service Alaska Region via IIPP (public domain, CC0)",
    credit: "U.S. Forest Service Alaska Region orthophotos, 2006-2018, via the Interdepartmental Imagery Publication Platform (public domain, CC0)",
    host: "The Forest Service’s imagery platform (IIPP)",
  },
};

/** Said where no public-domain photo covers a map. */
export const NO_PHOTO = "No public-domain aerial photo covers this place: USDA’s NAIP never flew Alaska, and the Forest Service’s Alaska photos don’t reach here.";

/** Maps whose source isn't their place's default: measured on 2026-10-08 (aerial-sources.mjs).
    "none" is a map no public-domain source answers for. Keyed by RIDB facility id. */
export const PICKS: Record<string, AerialKey | "none"> = {
  // Only the older three-band Forest Service service has these.
  "234629": "usfs-r10-rgb", "10382456": "usfs-r10-rgb", "233045": "usfs-r10-rgb", "233052": "usfs-r10-rgb",
  "233088": "usfs-r10-rgb", "233089": "usfs-r10-rgb", "233090": "usfs-r10-rgb", "233091": "usfs-r10-rgb",
  "233093": "usfs-r10-rgb", "233094": "usfs-r10-rgb", "233095": "usfs-r10-rgb",
  // Only the 2010 0.6 m photo, which must be asked for at its own scale.
  "10300372": "usfs-r10-0.6m", "251714": "usfs-r10-0.6m",
  // Neither Forest Service service: the Dalton Highway and White Mountains (BLM), Kenai Fjords and
  // Lake Clark (Park Service), and Tongass cabins outside the flown blocks.
  "10191011": "none", "10276314": "none", "10322643": "none", "10325233": "none", "10325252": "none",
  "10325266": "none", "252494": "none", "233317": "none", "251861": "none", "233040": "none",
  "233046": "none", "232469": "none", "259345": "none", "10006208": "none", "10075403": "none",
};

/** Hawaii's main islands, and Alaska (the Aleutians cross 180°). */
export const inHawaii = (lon: number, lat: number) => lon >= -161 && lon <= -154 && lat >= 18.5 && lat <= 22.5;
export const inAlaska = (lon: number, lat: number) => lat >= 51 && lat <= 72 && (lon <= -129.9 || lon >= 172);

/** The photo a map is judged over, or null where none covers it. By the map's id when measured
    (PICKS), else by where it is. */
export function aerialSource(map: { facilityId?: string; bbox: Bbox }): AerialSource | null {
  const pick = map.facilityId ? PICKS[map.facilityId] : undefined;
  if (pick) return pick === "none" ? null : AERIAL[pick];
  const [w, s, e, n] = map.bbox;
  const lon = (w + e) / 2, lat = (s + n) / 2;
  if (inHawaii(lon, lat)) return AERIAL["naip-hawaii"];
  if (inAlaska(lon, lat)) return AERIAL["usfs-r10"];
  return AERIAL.naip;
}

export const AERIAL_MAX_PX = 4000;

/** The pixel size to ask for: `width` wide at the frame's shape, scaled so neither side passes the limit. */
export function photoSize(frame: { w: number; h: number }, width: number): { width: number; height: number } {
  const height = (width * frame.h) / frame.w;
  const scale = Math.min(1, AERIAL_MAX_PX / Math.max(width, height));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

/** The pixel size to ask a source for, for `metres` × the frame's shape: `width` wide, unless the
    source draws only at a fixed scale. */
export function sizeFor(src: AerialSource, frame: { w: number; h: number }, width: number): { width: number; height: number } {
  return photoSize(frame, src.fixedM ? Math.max(1, Math.round(frame.w / src.fixedM)) : width);
}

/** One photo of `bbox` (degrees) from a source, at an exact pixel size, in Web Mercator. */
export function exportUrl(src: AerialSource, bbox: Bbox, size: { width: number; height: number }): string {
  const q = new URLSearchParams({ bbox: bbox.join(","), bboxSR: "4326", imageSR: "3857", size: `${size.width},${size.height}`, format: "jpg", f: "image" });
  if (src.bands) q.set("bandIds", src.bands);
  return `${src.service}?${q}`;
}

/** The photo of a whole map's frame, or null where no source covers it. */
export function aerialUrl(map: { facilityId?: string; bbox: Bbox }, frame: { w: number; h: number }, width = 1400): string | null {
  const src = aerialSource(map);
  return src && exportUrl(src, map.bbox, sizeFor(src, frame, width));
}
