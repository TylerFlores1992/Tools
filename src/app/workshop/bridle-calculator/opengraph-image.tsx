import { ogImage, OG_SIZE } from "@/lib/og";
import { toolBySlug } from "@/lib/tools";

const tool = toolBySlug("bridle-calculator");
export const alt = `${tool.name} calculator`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ eyebrow: "Rigging · Calculator", title: tool.name });
}
