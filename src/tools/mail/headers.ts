/** Parsing the few headers Morning Mail reads. Pure. */

export type Sender = { name: string | null; addr: string | null };

/** `"SCE Billing" <noreply@sce.com>` → { name: "SCE Billing", addr: "noreply@sce.com" }. */
export function parseFrom(raw: string): Sender {
  const s = (raw ?? "").trim();
  if (!s) return { name: null, addr: null };
  const angle = s.match(/^(.*?)<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  if (angle) {
    const name = angle[1].trim().replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"').trim();
    return { name: name || null, addr: angle[2].toLowerCase() };
  }
  const bare = s.match(/([^\s<>"]+@[^\s<>"]+)/);
  if (bare) return { name: null, addr: bare[1].toLowerCase() };
  return { name: s, addr: null };
}

/** The best short name for a sender: the display name, else the domain's first label. */
export function senderLabel(s: Sender): string {
  if (s.name) return s.name;
  if (s.addr) {
    const domain = s.addr.split("@")[1] ?? "";
    const parts = domain.split(".");
    const core = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    return core ? core.charAt(0).toUpperCase() + core.slice(1) : s.addr;
  }
  return "Unknown sender";
}

export type Unsubscribe = { http: string | null; mailto: string | null; oneClick: boolean };

/**
 * List-Unsubscribe: `<https://x/u?id=1>, <mailto:u@x?subject=unsub>`. One-click (RFC 8058) only
 * when List-Unsubscribe-Post says `List-Unsubscribe=One-Click` AND there is an https URL.
 */
export function parseUnsubscribe(listUnsubscribe: string | null, listUnsubscribePost: string | null): Unsubscribe {
  let http: string | null = null;
  let mailto: string | null = null;
  for (const m of (listUnsubscribe ?? "").matchAll(/<\s*([^>\s]+)\s*>/g)) {
    const u = m[1];
    if (!http && /^https:\/\//i.test(u)) http = u;
    else if (!mailto && /^mailto:/i.test(u)) mailto = u;
  }
  const oneClick = Boolean(http) && /list-unsubscribe\s*=\s*one-click/i.test(listUnsubscribePost ?? "");
  return { http, mailto, oneClick };
}

/** Collapse whitespace and cut to `n` characters on a word boundary. */
export function clip(s: string, n: number): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > n * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

/** One header's value from mailparser's raw lines (`{ key: "list-unsubscribe", line: "List-Unsubscribe: <…>" }`). */
export function rawHeader(lines: ReadonlyArray<{ key: string; line: string }> | undefined, name: string): string | null {
  const hit = (lines ?? []).find((l) => l.key.toLowerCase() === name);
  if (!hit) return null;
  const value = hit.line.slice(hit.line.indexOf(":") + 1).replace(/\r?\n\s+/g, " ").trim();
  return value || null;
}
