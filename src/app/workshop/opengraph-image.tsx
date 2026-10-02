import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "The workshop: every tool";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ eyebrow: "The workshop", title: "Tools" });
}
