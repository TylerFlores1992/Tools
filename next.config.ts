import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The hero film's folder is named for a hash of its files (src/lib/hero-media.ts), so a new
  // render is a new URL and browsers can keep these for a year without asking again.
  async headers() {
    return [
      {
        source: "/media/hero/:version/:file",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  // The CampHawk lab moved under the private area (2026-10-02). Old links still land there,
  // and the private area's sign-in takes it from that point.
  async redirects() {
    return [
      { source: "/lab/camphawk", destination: "/private/camphawk", permanent: false },
      { source: "/lab/camphawk/:path*", destination: "/private/camphawk/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
