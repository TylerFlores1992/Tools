// The USDA aerial photo (NAIP, public domain): the default source in aerial.ts, which picks the
// photo for each map (NAIP has no Alaska or Hawaii) and holds the size limit. Kept for its name.
import { AERIAL, AERIAL_MAX_PX, exportUrl, photoSize, type Bbox } from "./aerial.ts";

export const NAIP = AERIAL.naip.service;
export const NAIP_MAX_PX = AERIAL_MAX_PX;
export const naipSize = photoSize;

export function naipUrl(bbox: Bbox, frame: { w: number; h: number }, width = 1400): string {
  return exportUrl(AERIAL.naip, bbox, photoSize(frame, width));
}
