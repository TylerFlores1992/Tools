import { isIP } from "node:net";

/**
 * Is this IP address somewhere a server-side fetch must never go? Loopback, private networks,
 * link-local (cloud metadata lives at 169.254.169.254), carrier NAT, multicast, reserved and
 * documentation ranges, and the IPv6 forms of all of them (mapped and NAT64 included).
 * Anything that isn't a valid address counts as not public. Pure; tested in public-host.test.mts.
 */
export function isPublicAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return publicV4(v4(ip));
  if (kind === 6) {
    const h = v6(ip);
    return h ? publicV6(h) : false;
  }
  return false;
}

function v4(ip: string): number {
  return ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);
}

const inV4 = (n: number, base: string, bits: number) => {
  const size = 2 ** (32 - bits);
  return Math.floor(n / size) === Math.floor(v4(base) / size);
};

const V4_BLOCKED: Array<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

function publicV4(n: number): boolean {
  return !V4_BLOCKED.some(([base, bits]) => inV4(n, base, bits));
}

/** Eight 16-bit groups, or null if it doesn't parse. Accepts "::" and a trailing dotted IPv4. */
function v6(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    if (isIP(dotted[1]) !== 4) return null;
    const n = v4(dotted[1]);
    s = s.slice(0, -dotted[1].length) + `${Math.floor(n / 65536).toString(16)}:${(n % 65536).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array.from({ length: fill }, () => "0"), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

function publicV6(h: number[]): boolean {
  const zeroUntil = (k: number) => h.slice(0, k).every((g) => g === 0);
  if (zeroUntil(8)) return false; // ::
  if (zeroUntil(7) && h[7] === 1) return false; // ::1
  const embedded = h[6] * 65536 + h[7];
  if (zeroUntil(5) && h[5] === 0xffff) return publicV4(embedded); // ::ffff:a.b.c.d
  if (zeroUntil(6)) return publicV4(embedded); // ::a.b.c.d (deprecated compatible form)
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((g) => g === 0)) return publicV4(embedded); // NAT64
  if ((h[0] & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((h[0] & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((h[0] & 0xffc0) === 0xfec0) return false; // fec0::/10 old site-local
  if ((h[0] & 0xff00) === 0xff00) return false; // multicast
  if (h[0] === 0x2001 && h[1] === 0x0db8) return false; // documentation
  if (h[0] === 0x0100 && h.slice(1, 4).every((g) => g === 0)) return false; // discard 100::/64
  if (h[0] === 0x2002) return publicV4(h[1] * 65536 + h[2]); // 6to4 wraps an IPv4
  return true;
}
