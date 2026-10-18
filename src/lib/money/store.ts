import "server-only";
import { ruleCategory } from "@/tools/money/categorize";
import type { Account, CategorySource, Owner, Rule, Txn } from "@/tools/money/types";
import { sql } from "./db";

/** Reads and writes for the money pages. Every query names the `money` schema. */

type AccountRow = {
  id: string; org_name: string | null; name: string; display_name: string | null; owner: Owner | null;
  currency: string; balance: number | null; available_balance: number | null; balance_date: Date | null; hidden: boolean;
};
type TxnRow = {
  id: string; account_id: string; posted: string; amount: number; description: string; payee: string | null;
  memo: string | null; pending: boolean; category: string | null; category_source: CategorySource | null;
};

const toAccount = (r: AccountRow): Account => ({
  id: r.id, orgName: r.org_name, name: r.name, displayName: r.display_name, owner: r.owner, currency: r.currency,
  balance: r.balance, availableBalance: r.available_balance, balanceDate: r.balance_date ? r.balance_date.toISOString() : null, hidden: r.hidden,
});

const toTxn = (r: TxnRow): Txn => ({
  id: r.id, accountId: r.account_id, posted: r.posted, amount: r.amount, description: r.description, payee: r.payee,
  memo: r.memo, pending: r.pending, category: r.category, categorySource: r.category_source,
});

export async function getConnection(): Promise<{ connected: boolean; connectedAt: string | null }> {
  const [row] = await sql()<{ connected: boolean; connected_at: Date | null }[]>`
    select simplefin_access_url is not null as connected, connected_at from money.settings where id = 1`;
  return { connected: Boolean(row?.connected), connectedAt: row?.connected_at?.toISOString() ?? null };
}

export async function getAccessUrl(): Promise<string | null> {
  const [row] = await sql()<{ simplefin_access_url: string | null }[]>`select simplefin_access_url from money.settings where id = 1`;
  return row?.simplefin_access_url ?? null;
}

export async function saveAccessUrl(url: string | null): Promise<void> {
  await sql()`
    update money.settings
    set simplefin_access_url = ${url}, connected_at = ${url ? sql()`now()` : null}, updated_at = now()
    where id = 1`;
}

export async function getAccounts(): Promise<Account[]> {
  const rows = await sql()<AccountRow[]>`
    select id, org_name, name, display_name, owner, currency, balance, available_balance, balance_date, hidden
    from money.accounts order by hidden, coalesce(owner, 'zzz'), org_name, name`;
  return rows.map(toAccount);
}

export async function updateAccount(id: string, patch: { owner: Owner | null; displayName: string | null; hidden: boolean }): Promise<void> {
  await sql()`
    update money.accounts
    set owner = ${patch.owner}, display_name = ${patch.displayName}, hidden = ${patch.hidden}, updated_at = now()
    where id = ${id}`;
}

/** Transactions posted on or after `since` (YYYY-MM-DD), newest first. */
export async function getTransactions(since: string): Promise<Txn[]> {
  const rows = await sql()<TxnRow[]>`
    select id, account_id, to_char(posted, 'YYYY-MM-DD') as posted, amount, description, payee, memo, pending, category, category_source
    from money.transactions where posted >= ${since}::date
    order by posted desc, created_at desc`;
  return rows.map(toTxn);
}

export async function getRules(): Promise<Rule[]> {
  return sql()<Rule[]>`select pattern, category from money.rules order by pattern`;
}

export async function deleteRule(pattern: string): Promise<void> {
  await sql()`delete from money.rules where pattern = ${pattern}`;
}

/** The owner picked a category. With `always`, file every match of `pattern` the same way. */
export async function setCategory(txnId: string, category: string, always: { pattern: string } | null): Promise<void> {
  await sql().begin(async (tx) => {
    await tx`update money.transactions set category = ${category}, category_source = 'manual', updated_at = now() where id = ${txnId}`;
    if (always) {
      await tx`insert into money.rules (pattern, category) values (${always.pattern}, ${category})
               on conflict (pattern) do update set category = excluded.category`;
      // Re-file existing matches that the owner hasn't set by hand, using the same matcher as sync.
      const candidates = await tx<{ id: string; description: string; payee: string | null }[]>`
        select id, description, payee from money.transactions where category_source is distinct from 'manual'`;
      const rule = [{ pattern: always.pattern, category }];
      const ids = candidates.filter((c) => ruleCategory([c.description, c.payee].filter(Boolean).join(" "), rule)).map((c) => c.id);
      if (ids.length) {
        await tx`update money.transactions set category = ${category}, category_source = 'rule', updated_at = now() where id in ${tx(ids)}`;
      }
    }
  });
}

export type SyncRun = {
  id: number; startedAt: string; finishedAt: string | null; ok: boolean | null; trigger: string | null;
  accounts: number | null; newTxns: number | null; updatedTxns: number | null; errors: string[]; message: string | null;
};

export async function getSyncRuns(limit = 10): Promise<SyncRun[]> {
  const rows = await sql()<{
    id: number; started_at: Date; finished_at: Date | null; ok: boolean | null; trigger: string | null;
    accounts: number | null; new_txns: number | null; updated_txns: number | null; errors: string[] | null; message: string | null;
  }[]>`select id, started_at, finished_at, ok, trigger, accounts, new_txns, updated_txns, errors, message
       from money.sync_runs order by started_at desc limit ${limit}`;
  return rows.map((r) => ({
    id: Number(r.id), startedAt: r.started_at.toISOString(), finishedAt: r.finished_at?.toISOString() ?? null, ok: r.ok,
    trigger: r.trigger, accounts: r.accounts, newTxns: r.new_txns, updatedTxns: r.updated_txns, errors: r.errors ?? [], message: r.message,
  }));
}

/** Manual syncs in the last 24 hours (Bridge allows about 24 requests a day per connection). */
export async function manualSyncsToday(): Promise<number> {
  const [r] = await sql()<{ n: number }[]>`
    select count(*)::int as n from money.sync_runs where trigger = 'manual' and started_at > now() - interval '24 hours'`;
  return r?.n ?? 0;
}
