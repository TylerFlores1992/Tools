import type { Level, MailRow } from "./types.ts";

/**
 * The morning report, built from stored rows. Pure. Things that need the owner are CARRIED
 * FORWARD from earlier days until they tick ✓, the way the old Claude-written page worked;
 * everything else belongs to the day it arrived.
 */

export const CARRY_DAYS = 7;

export type ReportItem = { id: string; level: Level; title: string; detail: string | null; since: string | null; account: string; addr: string | null };
export type DoneLine = { account: string; text: string };
export type BulkSender = { addr: string; name: string; count: number; sample: string; oneClick: boolean; accounts: string[] };
export type AccountStatus = { id: string; label: string; ok: boolean | null; lastRunAt: string | null; error: string | null };

export type Report = {
  date: string;
  needsYou: ReportItem[];
  security: ReportItem[];
  junk: ReportItem[]; // today's likely spam, from senders no rule handles yet
  updates: ReportItem[]; // today's receipts, deliveries and notices
  done: DoneLine[];
  unsubscribeByHand: Array<{ id: string; sender: string; note: string; link: string | null }>;
  stillArriving: Array<{ sender: string; since: string; count: number }>;
  couldntDo: string[];
  bulk: BulkSender[];
  otherCount: number;
  total: number;
  aiCount: number; // of today's emails, how many the model sorted (0 means the code sorted them all)
};

// Mail a rule is moving out of the inbox (or already moved) is handled; a failed move stays listed.
const MOVING: ReadonlySet<string> = new Set(["trash", "unsubscribe", "file"]);

const RANK: Record<Level, number> = { urgent: 0, normal: 1, info: 2 };

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

export function accountLabel(id: string): string {
  if (id === "gmail") return "Gmail";
  return id.startsWith("yahoo:") ? id.slice(6) : id;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function buildReport(input: {
  date: string;
  rows: readonly MailRow[]; // at least the last CARRY_DAYS days
  dismissed: ReadonlySet<string>;
  unsubscribed: ReadonlyMap<string, string>; // from_addr → date unsubscribed (YYYY-MM-DD)
  ruleCoveredAddrs: ReadonlySet<string>; // senders a rule already handles (not offered again)
  accountErrors: readonly string[];
}): Report {
  const { date, rows, dismissed } = input;
  const today = rows.filter((r) => r.reportDate === date);
  const earliest = addDays(date, -(CARRY_DAYS - 1));
  const live = (r: MailRow) => r.reportDate >= earliest && r.reportDate <= date && !dismissed.has(r.id) && r.action !== "hide" && !(MOVING.has(r.action ?? "") && r.actionStatus !== "failed");

  const toItem = (r: MailRow): ReportItem => ({
    id: r.id, level: r.level, title: r.title, detail: r.detail, account: accountLabel(r.accountId),
    since: r.reportDate === date ? null : r.reportDate, addr: r.fromAddr,
  });
  const sort = (a: ReportItem, b: ReportItem) => RANK[a.level] - RANK[b.level] || (b.since ?? "9").localeCompare(a.since ?? "9");

  const needsYou = rows.filter((r) => r.bucket === "needs_you" && live(r)).map(toItem).sort(sort);
  // A verification code is only worth showing the day it came.
  const security = rows.filter((r) => r.bucket === "security" && live(r) && (r.level !== "info" || r.reportDate === date)).map(toItem).sort(sort);

  const junk = today.filter((r) => r.bucket === "junk" && !r.action && !(r.fromAddr && input.ruleCoveredAddrs.has(r.fromAddr))).map(toItem);
  const updates = today.filter((r) => r.bucket === "updates" && !r.action).map(toItem);

  const byAccount = new Map<string, { trashed: number; filed: Map<string, number>; unsubscribed: number }>();
  for (const r of today) {
    if (r.actionStatus !== "done") continue;
    const a = byAccount.get(r.accountId) ?? { trashed: 0, filed: new Map(), unsubscribed: 0 };
    if (r.action === "trash") a.trashed++;
    if (r.action === "file") a.filed.set(r.actionFolder ?? "Misc", (a.filed.get(r.actionFolder ?? "Misc") ?? 0) + 1);
    if (r.action === "unsubscribe") a.unsubscribed++;
    byAccount.set(r.accountId, a);
  }
  const done: DoneLine[] = [...byAccount.entries()]
    .map(([id, a]) => {
      const parts: string[] = [];
      if (a.unsubscribed) parts.push(`Unsubscribed from ${plural(a.unsubscribed, "sender")} (and trashed them)`);
      if (a.trashed) parts.push(`Trashed ${plural(a.trashed, "email")}`);
      for (const [f, n] of a.filed) parts.push(`Filed ${n} in ${f}`);
      return { account: accountLabel(id), text: `${parts.join(". ")}.` };
    })
    .filter((d) => d.text !== ".")
    .sort((a, b) => a.account.localeCompare(b.account));

  const unsubscribeByHand = today
    .filter((r) => r.action === "unsubscribe" && r.actionStatus === "manual" && !dismissed.has(r.id))
    .map((r) => ({ id: r.id, sender: r.fromName || r.fromAddr || "Unknown sender", note: r.actionNote ?? "", link: r.unsubHttp }));

  const arriving = new Map<string, { sender: string; since: string; count: number }>();
  for (const r of today) {
    if (!r.fromAddr) continue;
    const since = input.unsubscribed.get(r.fromAddr);
    if (!since || since > addDays(date, -3)) continue; // senders get a few days to stop
    const cur = arriving.get(r.fromAddr) ?? { sender: r.fromName || r.fromAddr, since, count: 0 };
    cur.count++;
    arriving.set(r.fromAddr, cur);
  }

  const couldntDo = [
    ...input.accountErrors,
    ...today.filter((r) => r.actionStatus === "failed").map((r) => `${accountLabel(r.accountId)}: ${r.title}. ${r.actionNote ?? "The action failed."}`),
  ];

  const bulkMap = new Map<string, BulkSender>();
  for (const r of today) {
    if (r.bucket !== "bulk" || !r.fromAddr || r.action || input.ruleCoveredAddrs.has(r.fromAddr)) continue;
    const b = bulkMap.get(r.fromAddr) ?? { addr: r.fromAddr, name: r.fromName || r.fromAddr, count: 0, sample: r.subject, oneClick: false, accounts: [] };
    b.count++;
    b.oneClick = b.oneClick || r.oneClick;
    const acct = accountLabel(r.accountId);
    if (!b.accounts.includes(acct)) b.accounts.push(acct);
    bulkMap.set(r.fromAddr, b);
  }
  const bulk = [...bulkMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    date,
    needsYou,
    security,
    junk,
    updates,
    done,
    unsubscribeByHand,
    stillArriving: [...arriving.values()],
    couldntDo,
    bulk,
    otherCount: today.filter((r) => r.bucket === "other" && !r.action).length,
    total: today.length,
    aiCount: today.filter((r) => r.sortedBy === "ai").length,
  };
}

/** A pattern for a new rule made from a sender: the address, lower-cased. */
export const ruleFromAddr = (addr: string) => addr.trim().toLowerCase();
