import type { Txn } from "./types.ts";

/**
 * SimpleFIN Bridge client (https://www.simplefin.org/protocol.html).
 *
 *  1. The owner creates a one-time Setup Token at SimpleFIN Bridge: base64 of a claim URL.
 *  2. POSTing to that URL once returns the Access URL: https://user:pass@host/path. That URL is
 *     the long-lived credential (read-only bank data). It's stored in money.settings, never in
 *     code or logs.
 *  3. GET <access>/accounts?start-date=…&end-date=… returns accounts with their transactions.
 *
 * Bridge refreshes from the banks about once a day and limits each connection to roughly 24
 * requests a day, so the site syncs once a day plus the owner's "Sync now".
 */

export class SimpleFinError extends Error {
  constructor(message: string, readonly kind: "token" | "auth" | "network" | "response") {
    super(message);
  }
}

/** Decodes a pasted Setup Token into its claim URL. Tolerates whitespace and a pasted URL. */
export function claimUrlFromSetupToken(token: string): string {
  const t = token.replace(/\s+/g, "");
  if (!t) throw new SimpleFinError("Paste the setup token from SimpleFIN Bridge.", "token");
  let url: string;
  if (/^https:\/\//i.test(t)) url = t;
  else {
    try {
      url = Buffer.from(t, "base64").toString("utf8").trim();
    } catch {
      throw new SimpleFinError("That doesn’t look like a SimpleFIN setup token.", "token");
    }
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SimpleFinError("That doesn’t look like a SimpleFIN setup token.", "token");
  }
  if (parsed.protocol !== "https:") throw new SimpleFinError("That doesn’t look like a SimpleFIN setup token.", "token");
  return parsed.toString();
}

/**
 * Splits an Access URL into a credential-free base URL and a Basic auth header. Node's fetch
 * refuses URLs with credentials in them, so they travel in the header instead.
 */
export function splitAccessUrl(access: string): { base: string; authorization: string } {
  let u: URL;
  try {
    u = new URL(access.trim());
  } catch {
    throw new SimpleFinError("The saved SimpleFIN connection is unreadable. Connect again.", "auth");
  }
  if (u.protocol !== "https:" || !u.username) {
    throw new SimpleFinError("The saved SimpleFIN connection is unreadable. Connect again.", "auth");
  }
  const user = decodeURIComponent(u.username);
  const pass = decodeURIComponent(u.password);
  u.username = "";
  u.password = "";
  return {
    base: u.toString().replace(/\/+$/, ""),
    authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`,
  };
}

type Fetch = typeof fetch;

/** Exchanges a Setup Token for the Access URL. A token works once. */
export async function claimAccessUrl(setupToken: string, f: Fetch = fetch): Promise<string> {
  const claim = claimUrlFromSetupToken(setupToken);
  let res: Response;
  try {
    res = await f(claim, { method: "POST", headers: { "Content-Length": "0" }, cache: "no-store" });
  } catch {
    throw new SimpleFinError("Couldn’t reach SimpleFIN. Try again in a minute.", "network");
  }
  if (res.status === 403) {
    throw new SimpleFinError("That setup token was already used or has expired. Make a new one in SimpleFIN Bridge.", "token");
  }
  if (!res.ok) throw new SimpleFinError(`SimpleFIN answered ${res.status}. Try again in a minute.`, "response");
  const access = (await res.text()).trim();
  splitAccessUrl(access); // validates
  return access;
}

// ---- The /accounts response ----

export type SfAccount = {
  id: string;
  name: string;
  currency: string;
  balance: string;
  "available-balance"?: string;
  "balance-date": number;
  org?: { name?: string; domain?: string };
  transactions?: SfTransaction[];
};

export type SfTransaction = {
  id: string;
  posted: number; // unix seconds; 0 while pending at some banks
  amount: string;
  description: string;
  payee?: string;
  memo?: string;
  transacted_at?: number;
  pending?: boolean;
};

export type SfAccountSet = { errors?: string[]; errlist?: { code?: string; msg?: string }[]; accounts: SfAccount[] };

export type ParsedAccount = {
  id: string;
  orgName: string | null;
  name: string;
  currency: string;
  balance: number | null;
  availableBalance: number | null;
  balanceDate: string | null;
};

export type ParsedTxn = Omit<Txn, "category" | "categorySource"> & { transactedAt: string | null };

const num = (s: string | undefined): number | null => {
  if (s === undefined || s === null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/** Unix seconds → YYYY-MM-DD in the household's time zone (a 9pm purchase is that day, not tomorrow's UTC). */
export function toLocalDate(unixSeconds: number, timeZone = "America/Los_Angeles"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(unixSeconds * 1000));
}

/** Turns a SimpleFIN account set into rows. Bad rows are skipped, not fatal. */
export function parseAccountSet(set: SfAccountSet): { accounts: ParsedAccount[]; txns: ParsedTxn[]; errors: string[] } {
  const errors = [
    ...(set.errors ?? []),
    ...(set.errlist ?? []).map((e) => e.msg || e.code || "").filter(Boolean),
  ];
  const accounts: ParsedAccount[] = [];
  const txns: ParsedTxn[] = [];
  for (const a of set.accounts ?? []) {
    if (!a?.id || !a.name) continue;
    accounts.push({
      id: a.id,
      orgName: a.org?.name ?? a.org?.domain ?? null,
      name: a.name,
      currency: a.currency || "USD",
      balance: num(a.balance),
      availableBalance: num(a["available-balance"]),
      balanceDate: a["balance-date"] ? new Date(a["balance-date"] * 1000).toISOString() : null,
    });
    for (const t of a.transactions ?? []) {
      const amount = num(t.amount);
      const when = t.posted || t.transacted_at;
      if (!t?.id || amount === null || !when) continue;
      txns.push({
        id: `${a.id}:${t.id}`,
        accountId: a.id,
        posted: toLocalDate(when),
        amount,
        description: (t.description ?? "").trim(),
        payee: t.payee?.trim() || null,
        memo: t.memo?.trim() || null,
        pending: Boolean(t.pending) || !t.posted,
        transactedAt: t.transacted_at ? new Date(t.transacted_at * 1000).toISOString() : null,
      });
    }
  }
  return { accounts, txns, errors };
}

/** Fetches accounts and transactions posted between two dates (unix seconds). */
export async function fetchAccounts(access: string, startUnix: number, endUnix: number, f: Fetch = fetch): Promise<SfAccountSet> {
  const { base, authorization } = splitAccessUrl(access);
  const url = `${base}/accounts?start-date=${Math.floor(startUnix)}&end-date=${Math.floor(endUnix)}&pending=1`;
  let res: Response;
  try {
    res = await f(url, { headers: { Authorization: authorization, Accept: "application/json" }, cache: "no-store" });
  } catch {
    throw new SimpleFinError("Couldn’t reach SimpleFIN.", "network");
  }
  if (res.status === 403 || res.status === 401) {
    throw new SimpleFinError("SimpleFIN refused the saved connection. It may have been revoked; connect again.", "auth");
  }
  if (res.status === 402) throw new SimpleFinError("SimpleFIN says the subscription needs payment.", "auth");
  if (!res.ok) throw new SimpleFinError(`SimpleFIN answered ${res.status}.`, "response");
  try {
    return (await res.json()) as SfAccountSet;
  } catch {
    throw new SimpleFinError("SimpleFIN sent something unreadable.", "response");
  }
}

/**
 * Date windows to request, newest first. Bridge caps one request's range, so a long backfill is
 * split. `days` back from `nowUnix`, in chunks of at most `chunkDays`.
 */
export function syncWindows(nowUnix: number, days: number, chunkDays = 45): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  let end = nowUnix;
  const stop = nowUnix - days * 86_400;
  while (end > stop) {
    const start = Math.max(stop, end - chunkDays * 86_400);
    out.push({ start, end });
    end = start;
  }
  return out;
}
