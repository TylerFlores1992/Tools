import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SIGN_IN_PATH, verifySession } from "@/lib/private-auth";

/**
 * Guards the private area (/private/*: the CampHawk lab and future projects). A visitor without
 * a valid session cookie is sent to the site's own sign-in page (password only, no username),
 * which brings them back here afterwards. Files (images and the like) get a plain 401 instead.
 *
 * The password is LAB_PASSWORD, set by the owner in Vercel. Unset or empty means locked for
 * everyone: fail closed. `npm run smoke` checks production keeps the area locked.
 *
 * Only /private runs through Proxy (see `matcher`); every other page is untouched.
 */
const PRIVATE_HEADERS = { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, no-store" };

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // The sign-in page (and its Server Action, which posts to the same path) is the way in.
  if (pathname === SIGN_IN_PATH) return withHeaders(NextResponse.next());

  if (verifySession(request.cookies.get(SESSION_COOKIE)?.value, process.env.LAB_PASSWORD)) {
    return withHeaders(NextResponse.next());
  }

  if (/\.[a-z0-9]+$/i.test(pathname)) {
    return withHeaders(new NextResponse("This area is private.", { status: 401 }));
  }

  const url = request.nextUrl.clone();
  url.pathname = SIGN_IN_PATH;
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return withHeaders(NextResponse.redirect(url, 307));
}

function withHeaders(res: NextResponse) {
  for (const [k, v] of Object.entries(PRIVATE_HEADERS)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: ["/private", "/private/:path*"],
};
