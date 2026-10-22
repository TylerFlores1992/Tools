import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: "#05070e",
    theme_color: "#05070e",
    // The wolf's eye from the home hero, full bleed (studio/app-icon/make.mjs). "maskable" lets
    // Android crop it to its own shape instead of shrinking it onto a white circle. The launch
    // screen Android draws is this icon on background_color; the intro in the layout picks up
    // from exactly that.
    icons: [
      { src: "/icons/icon-192.png", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icons/icon-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/icons/icon-192.png", type: "image/png", sizes: "192x192", purpose: "maskable" },
      { src: "/icons/icon-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
