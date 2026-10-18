import "server-only";
import { createHash } from "node:crypto";
import { categorize } from "@/tools/money/categorize";
import type { CsvRow } from "@/tools/money/csv";
import { sql } from "./db";
import { getRules } from "./store";
import { refileAll } from "./sync";

/**
 * History from a bank's own CSV export, for months older than SimpleFIN's 90 days.
 *  - Only rows dated BEFORE the account's first synced transaction are kept, so an imported row
 *    can never double one that SimpleFIN already brought in. Overlap is simply skipped.
 *  - Ids are `csv:` + a hash of the row (with a count for identical rows in one file), so
 *    importing the same file twice adds nothing.
 *  - Categorized like synced rows, and transfers are re-paired across all history afterwards.
 *  - Undo deletes every imported row for that account and nothing else.
 */

export type ImportResult = { added: number; overlap: number; repeat: number; from: string | null; to: string | null };

export async function importRows(accountId: string, rows: readonly CsvRow[]): Promise<ImportResult> {
  const db = sql();
  const [{ first }] = await db<{ first: string | null }[]>`
    select to_char(min(posted), 'YYYY-MM-DD') as first from money.transactions
    where account_id = ${accountId} and left(id, 4) <> 'csv:'`;
  const keep = first ? rows.filter((r) => r.posted < first) : [...rows];
  const overlap = rows.length - keep.length;
  const rules = await getRules();

  const seen = new Map<string, number>();
  let added = 0;
  await db.begin(async (tx) => {
    for (const r of keep) {
      const base = `${accountId}|${r.posted}|${r.amount.toFixed(2)}|${r.description}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const id = `csv:${createHash("sha256").update(`${base}|${n}`).digest("hex").slice(0, 32)}`;
      const c = categorize({ amount: r.amount, description: r.description, payee: null, category: null, categorySource: null }, rules);
      const res = await tx`
        insert into money.transactions (id, account_id, posted, amount, description, memo, pending, category, category_source)
        values (${id}, ${accountId}, ${r.posted}::date, ${r.amount}, ${r.description}, ${r.memo}, false, ${c.category}, ${c.categorySource})
        on conflict (id) do nothing`;
      added += res.count;
    }
    await refileAll(tx, rules);
  });
  const dates = keep.map((r) => r.posted).sort();
  return { added, overlap, repeat: keep.length - added, from: dates[0] ?? null, to: dates[dates.length - 1] ?? null };
}

export async function undoImport(accountId: string): Promise<number> {
  const res = await sql()`delete from money.transactions where account_id = ${accountId} and left(id, 4) = 'csv:'`;
  return res.count;
}

/** Imported row count and date range per account, for Settings. */
export async function importedByAccount(): Promise<Map<string, { n: number; from: string; to: string }>> {
  const rows = await sql()<{ account_id: string; n: number; from: string; to: string }[]>`
    select account_id, count(*)::int as n, to_char(min(posted), 'YYYY-MM-DD') as from, to_char(max(posted), 'YYYY-MM-DD') as to
    from money.transactions where left(id, 4) = 'csv:' group by account_id`;
  return new Map(rows.map((r) => [r.account_id, { n: r.n, from: r.from, to: r.to }]));
}
