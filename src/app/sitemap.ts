import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { TOOLS } from "@/lib/tools";
import { PRACTICE_SETS } from "@/tools/etcp/questions";

// Only pages that exist and should be found. /lab is deliberately absent.
export default function sitemap(): MetadataRoute.Sitemap {
  const tools = TOOLS.filter((t) => t.status === "live" && t.tier !== 3).map((t) => ({ url: `${SITE.url}/workshop/${t.slug}`, changeFrequency: "monthly" as const, priority: 0.8 }));
  const study = `${SITE.url}/workshop/etcp-rigger-study`;
  const studyPages = [...PRACTICE_SETS.map((s) => `${study}/practice/${s.slug}`), `${study}/flashcards`, `${study}/formulas`].map((url) => ({ url, changeFrequency: "monthly" as const, priority: 0.6 }));
  return [
    { url: SITE.url, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE.url}/workshop`, changeFrequency: "weekly", priority: 0.9 },
    ...tools,
    ...studyPages,
  ];
}
