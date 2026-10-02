import { ogImage, OG_SIZE } from "@/lib/og";
import { toolBySlug } from "@/lib/tools";

const tool = toolBySlug("etcp-rigger-study");
export const alt = tool.name;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ eyebrow: "Rigging · Study", title: tool.name });
}
