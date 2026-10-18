import "server-only";
import { addDays } from "@/tools/money/recurring";
import { toLocalDate } from "@/tools/money/simplefin";
import type { Account, Rule, Txn } from "@/tools/money/types";
import { isConfigured } from "./db";
import { getAccounts, getConnection, getRules, getSyncRuns, getTransactions, type SyncRun } from "./store";

export type MoneyData =
  | { state: "not-configured" }
  | { state: "unreachable" }
  | { state: "ok"; connected: boolean; accounts: Account[]; txns: Txn[]; rules: Rule[]; runs: SyncRun[]; today: string };

/** Everything a money page shows, about 13 months of it (enough for yearly bills). */
export async function loadMoney(): Promise<MoneyData> {
  if (!isConfigured()) return { state: "not-configured" };
  const today = toLocalDate(Date.now() / 1000);
  try {
    // One at a time on purpose: see the pipelining note in db.ts.
    const conn = await getConnection();
    const accounts = await getAccounts();
    const txns = await getTransactions(addDays(today, -400));
    const rules = await getRules();
    const runs = await getSyncRuns(10);
    return { state: "ok", connected: conn.connected, accounts, txns, rules, runs, today };
  } catch (e) {
    console.error("money load failed", e instanceof Error ? e.name : "unknown");
    return { state: "unreachable" };
  }
}

/** Which accounts a view covers. Hidden accounts are never counted. */
export function accountsFor(accounts: readonly Account[], view: string): Set<string> {
  return new Set(accounts.filter((a) => !a.hidden && (view === "all" || a.owner === view)).map((a) => a.id));
}

export const accountLabel = (a: Account) => a.displayName || [a.orgName, a.name].filter(Boolean).join(" · ");
