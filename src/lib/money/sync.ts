import "server-only";
import { OTHER_INCOME, TRANSFER, UNCATEGORIZED, categorize, findTransferPairs } from "@/tools/money/categorize";
import { SimpleFinError, fetchAccounts, parseAccountSet, syncWindows, toLocalDate, type ParsedAccount, type ParsedTxn } from "@/tools/money/simplefin";
import type { CategorySource } from "@/tools/money/types";
import { sql } from "./db";
import { getAccessUrl, getRules } from "./store";

/**
 * Pulls accounts and transactions from SimpleFIN into the money schema.
 *  - First sync backfills 90 days (two requests); later syncs re-read the last 14 days, which
 *    picks up late-posting and pending→posted changes.
 *  - Pending transactions in the window are replaced each time (a bank may give the posted
 *    version a new id).
 *  - Categories set by hand are never overwritten.
 * Every run is logged in money.sync_runs, with errors in words.
 */

export type SyncResult = { ok: boolean; accounts: number; newTxns: number; updatedTxns: number; errors: string[]; message: string };

export async function runSync(trigger: "cron" | "manual" | "connect"): Promise<SyncResult> {
  const db = sql();
  const [{ id: runId }] = await db<{ id: number }[]>`insert into money.sync_runs (trigger) values (${trigger}) returning id`;

  const finish = async (r: SyncResult) => {
    await db`update money.sync_runs set finished_at = now(), ok = ${r.ok}, accounts = ${r.accounts}, new_txns = ${r.newTxns},
             updated_txns = ${r.updatedTxns}, errors = ${r.errors}, message = ${r.message} where id = ${runId}`;
    return r;
  };

  const access = await getAccessUrl();
  if (!access) return finish({ ok: false, accounts: 0, newTxns: 0, updatedTxns: 0, errors: [], message: "Not connected to SimpleFIN yet." });

  try {
    const [{ n: existing }] = await db<{ n: number }[]>`select count(*)::int as n from money.transactions`;
    const now = Math.floor(Date.now() / 1000);
    const windows = syncWindows(now, existing === 0 ? 90 : 14, 45);

    const accounts = new Map<string, ParsedAccount>();
    const txns = new Map<string, ParsedTxn>();
    const errors: string[] = [];
    for (const w of windows) {
      const parsed = parseAccountSet(await fetchAccounts(access, w.start, w.end));
      for (const a of parsed.accounts) if (!accounts.has(a.id)) accounts.set(a.id, a); // newest window has freshest balance
      for (const t of parsed.txns) txns.set(t.id, t);
      for (const e of parsed.errors) if (!errors.includes(e)) errors.push(e);
    }

    const since = toLocalDate(windows[windows.length - 1].start);
    const rules = await getRules();
    let newTxns = 0;
    let updatedTxns = 0;

    await db.begin(async (tx) => {
      for (const a of accounts.values()) {
        await tx`
          insert into money.accounts (id, org_name, name, currency, balance, available_balance, balance_date, updated_at)
          values (${a.id}, ${a.orgName}, ${a.name}, ${a.currency}, ${a.balance}, ${a.availableBalance}, ${a.balanceDate}, now())
          on conflict (id) do update set org_name = excluded.org_name, name = excluded.name, currency = excluded.currency,
            balance = excluded.balance, available_balance = excluded.available_balance, balance_date = excluded.balance_date, updated_at = now()`;
      }

      const accountIds = [...accounts.keys()];
      if (accountIds.length) {
        await tx`delete from money.transactions where pending and account_id in ${tx(accountIds)} and posted >= ${since}::date`;
      }

      const incomingIds = [...txns.keys()];
      const current = new Map<string, { category: string | null; category_source: CategorySource | null }>();
      if (incomingIds.length) {
        const rows = await tx<{ id: string; category: string | null; category_source: CategorySource | null }[]>`
          select id, category, category_source from money.transactions where id in ${tx(incomingIds)}`;
        for (const r of rows) current.set(r.id, r);
      }

      for (const t of txns.values()) {
        const prev = current.get(t.id);
        const c = categorize({ ...t, category: prev?.category ?? null, categorySource: prev?.category_source ?? null }, rules);
        const [row] = await tx<{ inserted: boolean }[]>`
          insert into money.transactions (id, account_id, posted, transacted_at, amount, description, payee, memo, pending, category, category_source)
          values (${t.id}, ${t.accountId}, ${t.posted}::date, ${t.transactedAt}, ${t.amount}, ${t.description}, ${t.payee}, ${t.memo},
                  ${t.pending}, ${c.category}, ${c.categorySource})
          on conflict (id) do update set posted = excluded.posted, transacted_at = excluded.transacted_at, amount = excluded.amount,
            description = excluded.description, payee = excluded.payee, memo = excluded.memo, pending = excluded.pending,
            category = case when money.transactions.category_source = 'manual' then money.transactions.category else excluded.category end,
            category_source = case when money.transactions.category_source = 'manual' then 'manual' else excluded.category_source end,
            updated_at = now()
          returning (xmax = 0) as inserted`;
        if (row?.inserted) newTxns++;
        else updatedTxns++;
      }

      // Money moved between the household's own accounts that no keyword caught, or caught on
      // one side only (Chase says "Online Transfer to US Bank", U.S. Bank says "Electronic Deposit
      // Jpmorgan Chase"). Only auto-filed rows in a catch-all bucket or already Transfer are
      // eligible, so a real purchase is never hidden. The whole history is re-matched: it is a few
      // hundred rows, and it means a fix to the matcher reaches old months on the next sync.
      const recent = await tx<{ id: string; account_id: string; posted: string; amount: number; category: string | null; category_source: CategorySource | null }[]>`
        select id, account_id, to_char(posted, 'YYYY-MM-DD') as posted, amount, category, category_source
        from money.transactions where not pending`;
      const eligible = recent
        .filter((r) => r.category_source === "auto" && (r.category === UNCATEGORIZED || r.category === OTHER_INCOME || r.category === TRANSFER))
        .map((r) => ({ id: r.id, accountId: r.account_id, posted: r.posted, amount: r.amount, description: "", payee: null, memo: null, pending: false, category: r.category, categorySource: r.category_source }));
      const already = new Set(eligible.filter((r) => r.category === TRANSFER).map((r) => r.id));
      const pairs = [...findTransferPairs(eligible)].filter((id) => !already.has(id));
      if (pairs.length) {
        await tx`update money.transactions set category = ${TRANSFER}, category_source = 'auto', updated_at = now() where id in ${tx(pairs)}`;
      }
    });

    return finish({
      ok: true,
      accounts: accounts.size,
      newTxns,
      updatedTxns,
      errors,
      message: errors.length ? "Synced, but SimpleFIN reported a problem with a bank." : "Synced.",
    });
  } catch (e) {
    const message = e instanceof SimpleFinError ? e.message : "The sync failed. Nothing was changed.";
    if (!(e instanceof SimpleFinError)) console.error("money sync failed", e instanceof Error ? e.name : "unknown");
    return finish({ ok: false, accounts: 0, newTxns: 0, updatedTxns: 0, errors: [], message });
  }
}
