import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPublicAddress } from "./public-host";

/**
 * Fetches a link someone pasted (a calendar's share link) without letting it reach inside our
 * network: https only, on the normal port, to a host whose every DNS answer is a public address,
 * and redirects followed by hand (at most MAX_REDIRECTS), each one checked the same way.
 *
 * Not covered: DNS rebinding between our lookup and fetch's own (a host that answers public, then
 * private, within milliseconds). The window is tiny and the reply is only parsed as a calendar,
 * never shown raw, but it isn't zero.
 */

export const MAX_REDIRECTS = 3;

export class UnsafeLink extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeLink";
  }
}

type Lookup = (host: string) => Promise<string[]>;
type Deps = { lookup?: Lookup; fetchImpl?: typeof fetch };

const defaultLookup: Lookup = async (host) => (await dnsLookup(host, { all: true, verbatim: true })).map((a) => a.address);

/** Throws UnsafeLink when the URL may not be fetched. */
export async function checkPublicUrl(raw: string, lookup: Lookup = defaultLookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeLink("That link isn’t a web address.");
  }
  if (url.protocol !== "https:") throw new UnsafeLink("The link should start with https:// or webcal://.");
  if (url.port && url.port !== "443") throw new UnsafeLink("That link uses an unusual port, so it can’t be read from here.");
  if (url.username || url.password) throw new UnsafeLink("That link has a password in it, so it can’t be read from here.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  if (isIP(host)) addresses = [host];
  else {
    try {
      addresses = await lookup(host);
    } catch {
      throw new UnsafeLink("That link’s website couldn’t be found.");
    }
  }
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
    throw new UnsafeLink("That link points somewhere this site won’t read from.");
  }
  return url;
}

/** GET a public https URL, following up to MAX_REDIRECTS redirects, each re-checked. */
export async function fetchPublic(raw: string, init: RequestInit = {}, deps: Deps = {}): Promise<Response> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await checkPublicUrl(current, deps.lookup);
    const res = await fetchImpl(url, { ...init, redirect: "manual" });
    if (res.status < 300 || res.status > 399 || res.status === 304) return res;
    const location = res.headers.get("location");
    if (!location) return res;
    current = new URL(location, url).toString();
  }
  throw new UnsafeLink("That link redirects too many times.");
}
