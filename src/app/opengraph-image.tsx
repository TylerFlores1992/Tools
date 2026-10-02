import { ogImage, OG_SIZE } from "@/lib/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name}: ${SITE.headline.join(" ")}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ eyebrow: SITE.domain, title: SITE.headline[0], accent: SITE.headline[1] });
}
