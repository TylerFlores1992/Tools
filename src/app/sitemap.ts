import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { TOOLS } from "@/lib/tools";

// Only pages that exist and should be found. /lab is deliberately absent.
export default function sitemap(): MetadataRoute.Sitemap {
  const tools = TOOLS.filter((t) => t.status === "live" && t.tier !== 3).map((t) => ({ url: `${SITE.url}/workshop/${t.slug}`, changeFrequency: "monthly" as const, priority: 0.8 }));
  return [
    { url: SITE.url, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE.url}/workshop`, changeFrequency: "weekly", priority: 0.9 },
    ...tools,
  ];
}
