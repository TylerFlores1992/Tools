import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
