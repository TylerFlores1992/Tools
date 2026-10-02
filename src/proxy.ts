import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Locks the CampHawk design lab (/lab/camphawk) behind a password: HTTP Basic auth against
 * the LAB_PASSWORD environment variable, which the owner sets in Vercel (never in code or
 * chat). Any username works. With no LAB_PASSWORD set the lab stays locked for everyone:
 * fail closed. `npm run smoke` checks production answers 401 without the password.
 *
 * Only this path runs through Proxy (see `matcher`); every other page is untouched.
 */
export function proxy(request: NextRequest) {
  const password = process.env.LAB_PASSWORD;
  if (password && passwordMatches(request.headers.get("authorization"), password)) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }
  return new NextResponse("This area is private.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="CampHawk lab", charset="UTF-8"',
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "no-store",
    },
  });
}

/** Compares in constant time (hashing first makes the lengths equal). */
function passwordMatches(header: string | null, password: string): boolean {
  if (!header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
  const given = decoded.slice(decoded.indexOf(":") + 1);
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return decoded.includes(":") && timingSafeEqual(hash(given), hash(password));
}

export const config = {
  matcher: ["/lab/camphawk", "/lab/camphawk/:path*"],
};
