// The USDA aerial photo (NAIP, public domain) behind the review page's check and tracing tool.
// USGS's ImageServer serves at most 4,000 px a side (maxImageWidth/maxImageHeight, read
// 2026-10-08). Asked for more, it answers 200 with a 156-byte JSON error under an image/jpeg
// header, so the photo never loads. A tall, narrow frame (Diamond Lake is 536 × 3,495 m) crossed
// that at the page's 1,400 px width; the size is scaled down to fit and the browser stretches it.
export const NAIP = "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage";
export const NAIP_MAX_PX = 4000;

/** The pixel size to ask USGS for: `width` wide at the frame's shape, scaled so neither side passes the limit. */
export function naipSize(frame: { w: number; h: number }, width: number): { width: number; height: number } {
  const height = (width * frame.h) / frame.w;
  const scale = Math.min(1, NAIP_MAX_PX / Math.max(width, height));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

export function naipUrl(bbox: [number, number, number, number], frame: { w: number; h: number }, width = 1400): string {
  const s = naipSize(frame, width);
  const q = new URLSearchParams({ bbox: bbox.join(","), bboxSR: "4326", imageSR: "3857", size: `${s.width},${s.height}`, format: "jpg", f: "image" });
  return `${NAIP}?${q}`;
}
