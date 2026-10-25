import "server-only";
import { sql } from "@/lib/money/db";
import type { ActionStatus, Bucket, Level, MailRow, Rule, RuleAction } from "@/tools/mail/types";

/**
 * Morning Mail's reads and writes, all in the `mail` schema, through the same locked-down
 * money_app connection as the money tracker (MONEY_DATABASE_URL).
 */

export type AccountRow = {
  id: string;
  kind: "gmail" | "yahoo";
  address: string;
  secretEnc: string | null;
  enabled: boolean;
  uidValidity: number | null;
  lastUid: number | null;
  lastRunAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
};

type DbMsg = {
  id: string; account_id: string; report_date: string; received_at: Date | null; from_name: string | null; from_addr: string | null;
  subject: string; bucket: Bucket; level: Level; title: string; detail: string | null; action: RuleAction | null; action_folder: string | null;
  action_status: ActionStatus | null; action_note: string | null; unsub_http: string | null; unsub_mailto: string | null; one_click: boolean;
  sorted_by?: string | null;
};

const toRow = (r: DbMsg): MailRow => ({
  id: r.id, accountId: r.account_id, reportDate: r.report_date, receivedAt: r.received_at?.toISOString() ?? null, fromName: r.from_name,
  fromAddr: r.from_addr, subject: r.subject, bucket: r.bucket, level: r.level, title: r.title, detail: r.detail, action: r.action,
  actionFolder: r.action_folder, actionStatus: r.action_status, actionNote: r.action_note, unsubHttp: r.unsub_http, unsubMailto: r.unsub_mailto,
  oneClick: r.one_click, sortedBy: r.sorted_by === "ai" ? "ai" : "code",
});

export async function getAccounts(): Promise<AccountRow[]> {
  const rows = await sql()<{
    id: string; kind: "gmail" | "yahoo"; address: string; secret_enc: string | null; enabled: boolean; uid_validity: string | null;
    last_uid: string | null; last_run_at: Date | null; last_ok_at: Date | null; last_error: string | null;
  }[]>`select id, kind, address, secret_enc, enabled, uid_validity::text, last_uid::text, last_run_at, last_ok_at, last_error
       from mail.accounts order by kind, address`;
  return rows.map((r) => ({
    id: r.id, kind: r.kind, address: r.address, secretEnc: r.secret_enc, enabled: r.enabled,
    uidValidity: r.uid_validity === null ? null : Number(r.uid_validity), lastUid: r.last_uid === null ? null : Number(r.last_uid),
    lastRunAt: r.last_run_at?.toISOString() ?? null, lastOkAt: r.last_ok_at?.toISOString() ?? null, lastError: r.last_error,
  }));
}

export async function upsertYahoo(address: string, secretEnc: string): Promise<void> {
  const id = `yahoo:${address}`;
  await sql()`insert into mail.accounts (id, kind, address, secret_enc) values (${id}, 'yahoo', ${address}, ${secretEnc})
              on conflict (id) do update set secret_enc = excluded.secret_enc, enabled = true, last_error = null`;
}

export async function ensureGmailAccount(): Promise<void> {
  await sql()`insert into mail.accounts (id, kind, address) values ('gmail', 'gmail', 'Gmail') on conflict (id) do nothing`;
}

export async function removeAccount(id: string): Promise<void> {
  await sql()`delete from mail.accounts where id = ${id}`;
}

export async function markAccountRun(id: string, ok: boolean, error: string | null, watermark?: { uidValidity: number; lastUid: number | null }): Promise<void> {
  if (watermark) {
    await sql()`update mail.accounts set last_run_at = now(), last_ok_at = case when ${ok} then now() else last_ok_at end, last_error = ${error},
                uid_validity = ${watermark.uidValidity}, last_uid = ${watermark.lastUid} where id = ${id}`;
  } else {
    await sql()`update mail.accounts set last_run_at = now(), last_ok_at = case when ${ok} then now() else last_ok_at end, last_error = ${error} where id = ${id}`;
  }
}

export async function getRules(): Promise<Rule[]> {
  const rows = await sql()<{ id: string; match_from: string | null; match_subject: string | null; action: RuleAction; folder: string | null }[]>`
    select id::text, match_from, match_subject, action, folder from mail.rules order by created_at`;
  return rows.map((r) => ({ id: Number(r.id), matchFrom: r.match_from, matchSubject: r.match_subject, action: r.action, folder: r.folder }));
}

export async function listRules(): Promise<Array<Rule & { hits: number; lastHitAt: string | null }>> {
  const rows = await sql()<{ id: string; match_from: string | null; match_subject: string | null; action: RuleAction; folder: string | null; hits: number; last_hit_at: Date | null }[]>`
    select id::text, match_from, match_subject, action, folder, hits, last_hit_at from mail.rules order by created_at desc`;
  return rows.map((r) => ({ id: Number(r.id), matchFrom: r.match_from, matchSubject: r.match_subject, action: r.action, folder: r.folder, hits: r.hits, lastHitAt: r.last_hit_at?.toISOString() ?? null }));
}

export async function addRule(r: Omit<Rule, "id">): Promise<number> {
  const [row] = await sql()<{ id: string }[]>`
    insert into mail.rules (match_from, match_subject, action, folder) values (${r.matchFrom}, ${r.matchSubject}, ${r.action}, ${r.folder}) returning id::text`;
  return Number(row.id);
}

export async function deleteRule(id: number): Promise<void> {
  await sql()`delete from mail.rules where id = ${id}`;
}

export async function knownIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await sql()<{ id: string }[]>`select id from mail.messages where id in ${sql()(ids)}`;
  return new Set(rows.map((r) => r.id));
}

export type NewMessage = Omit<MailRow, "receivedAt" | "sortedBy"> & { receivedAt: string | null; snippet: string; ruleId: number | null; sortedBy: "ai" | "code" };

export async function insertMessage(m: NewMessage): Promise<boolean> {
  const rows = await sql()`
    insert into mail.messages (id, account_id, report_date, received_at, from_name, from_addr, subject, snippet, unsub_http, unsub_mailto, one_click,
      bucket, level, title, detail, rule_id, action, action_folder, action_status, action_note, sorted_by)
    values (${m.id}, ${m.accountId}, ${m.reportDate}::date, ${m.receivedAt}, ${m.fromName}, ${m.fromAddr}, ${m.subject}, ${m.snippet}, ${m.unsubHttp},
      ${m.unsubMailto}, ${m.oneClick}, ${m.bucket}, ${m.level}, ${m.title}, ${m.detail}, ${m.ruleId}, ${m.action}, ${m.actionFolder}, ${m.actionStatus}, ${m.actionNote}, ${m.sortedBy})
    on conflict (id) do nothing returning 1`;
  if (rows.length && m.ruleId !== null) {
    await sql()`update mail.rules set hits = hits + 1, last_hit_at = now() where id = ${m.ruleId}`;
  }
  return rows.length > 0;
}

export async function setActionStatus(id: string, status: ActionStatus, note: string | null, action?: RuleAction, folder?: string | null): Promise<void> {
  if (action) await sql()`update mail.messages set action = ${action}, action_folder = ${folder ?? null}, action_status = ${status}, action_note = ${note} where id = ${id}`;
  else await sql()`update mail.messages set action_status = ${status}, action_note = ${note} where id = ${id}`;
}

/** Rows whose mailbox action has not happened yet, for one account (last 3 days). */
export async function pendingActions(accountId: string): Promise<MailRow[]> {
  const rows = await sql()<DbMsg[]>`
    select id, account_id, to_char(report_date, 'YYYY-MM-DD') as report_date, received_at, from_name, from_addr, subject, bucket, level, title, detail,
      action, action_folder, action_status, action_note, unsub_http, unsub_mailto, one_click
    from mail.messages where account_id = ${accountId} and action_status = 'pending' and action in ('trash','file','unsubscribe')
      and report_date >= (now() at time zone 'America/Los_Angeles')::date - 3`;
  return rows.map(toRow);
}

export async function getRows(since: string): Promise<MailRow[]> {
  const rows = await sql()<DbMsg[]>`
    select id, account_id, to_char(report_date, 'YYYY-MM-DD') as report_date, received_at, from_name, from_addr, subject, bucket, level, title, detail,
      action, action_folder, action_status, action_note, unsub_http, unsub_mailto, one_click, sorted_by
    from mail.messages where report_date >= ${since}::date order by received_at desc nulls last`;
  return rows.map(toRow);
}

/** Recent rows matching a sender with no action yet: what a brand-new rule should apply to. */
export async function unactionedFrom(fromAddr: string, since: string): Promise<Array<MailRow & { snippet: string }>> {
  const rows = await sql()<(DbMsg & { snippet: string })[]>`
    select id, account_id, to_char(report_date, 'YYYY-MM-DD') as report_date, received_at, from_name, from_addr, subject, bucket, level, title, detail,
      action, action_folder, action_status, action_note, unsub_http, unsub_mailto, one_click, snippet
    from mail.messages where from_addr = ${fromAddr} and action is null and report_date >= ${since}::date`;
  return rows.map((r) => ({ ...toRow(r), snippet: r.snippet }));
}

/** Recent rows no rule acted on, with what re-sorting them needs. */
export async function recentUnactioned(since: string): Promise<Array<MailRow & { snippet: string }>> {
  const rows = await sql()<(DbMsg & { snippet: string })[]>`
    select id, account_id, to_char(report_date, 'YYYY-MM-DD') as report_date, received_at, from_name, from_addr, subject, bucket, level, title, detail,
      action, action_folder, action_status, action_note, unsub_http, unsub_mailto, one_click, snippet
    from mail.messages where action is null and report_date >= ${since}::date`;
  return rows.map((r) => ({ ...toRow(r), snippet: r.snippet }));
}

export async function setClassification(id: string, c: { bucket: Bucket; level: Level; title: string; detail: string | null }, sortedBy: "ai" | "code"): Promise<void> {
  await sql()`update mail.messages set bucket = ${c.bucket}, level = ${c.level}, title = ${c.title}, detail = ${c.detail}, sorted_by = ${sortedBy} where id = ${id}`;
}

export async function getDismissed(): Promise<Set<string>> {
  const rows = await sql()<{ item_id: string }[]>`select item_id from mail.dismissed where at > now() - interval '30 days'`;
  return new Set(rows.map((r) => r.item_id));
}

export async function setDismissed(id: string, title: string, on: boolean): Promise<void> {
  if (on) await sql()`insert into mail.dismissed (item_id, title) values (${id}, ${title}) on conflict (item_id) do nothing`;
  else await sql()`delete from mail.dismissed where item_id = ${id}`;
}

export async function getUnsubscribed(): Promise<Map<string, string>> {
  const rows = await sql()<{ from_addr: string; d: string }[]>`select from_addr, to_char(at at time zone 'America/Los_Angeles', 'YYYY-MM-DD') as d from mail.unsubscribed`;
  return new Map(rows.map((r) => [r.from_addr, r.d]));
}

export async function recordUnsubscribed(fromAddr: string, method: string): Promise<void> {
  await sql()`insert into mail.unsubscribed (from_addr, method) values (${fromAddr}, ${method}) on conflict (from_addr) do nothing`;
}

export async function getGmailSettings(): Promise<{ keyHash: string | null; keyCreatedAt: string | null; lastRunAt: string | null; lastSummary: unknown }> {
  const [r] = await sql()<{ gmail_key_hash: string | null; gmail_key_created_at: Date | null; gmail_last_run_at: Date | null; gmail_last_summary: unknown }[]>`
    select gmail_key_hash, gmail_key_created_at, gmail_last_run_at, gmail_last_summary from mail.settings where id = 1`;
  return { keyHash: r?.gmail_key_hash ?? null, keyCreatedAt: r?.gmail_key_created_at?.toISOString() ?? null, lastRunAt: r?.gmail_last_run_at?.toISOString() ?? null, lastSummary: r?.gmail_last_summary ?? null };
}

export async function setGmailKeyHash(hash: string): Promise<void> {
  await sql()`update mail.settings set gmail_key_hash = ${hash}, gmail_key_created_at = now(), updated_at = now() where id = 1`;
}

export async function recordGmailRun(summary: unknown): Promise<void> {
  await sql()`update mail.settings set gmail_last_run_at = now(), gmail_last_summary = ${sql().json(summary as never)}, updated_at = now() where id = 1`;
}

export async function startRun(source: string): Promise<number> {
  const [r] = await sql()<{ id: string }[]>`insert into mail.runs (source) values (${source}) returning id::text`;
  return Number(r.id);
}

export async function finishRun(id: number, ok: boolean, message: string, counts: Record<string, number>): Promise<void> {
  await sql()`update mail.runs set finished_at = now(), ok = ${ok}, message = ${message}, counts = ${sql().json(counts)} where id = ${id}`;
}

export async function recentRuns(limit = 10): Promise<Array<{ source: string; startedAt: string; ok: boolean | null; message: string | null }>> {
  const rows = await sql()<{ source: string; started_at: Date; ok: boolean | null; message: string | null }[]>`
    select source, started_at, ok, message from mail.runs order by started_at desc limit ${limit}`;
  return rows.map((r) => ({ source: r.source, startedAt: r.started_at.toISOString(), ok: r.ok, message: r.message }));
}

/** History: per day, how many needed you and how many emails were seen. */
export async function dayCounts(since: string): Promise<Array<{ date: string; total: number; needs: number }>> {
  return sql()<{ date: string; total: number; needs: number }[]>`
    select to_char(report_date, 'YYYY-MM-DD') as date, count(*)::int as total, count(*) filter (where bucket in ('needs_you','security'))::int as needs
    from mail.messages where report_date >= ${since}::date group by report_date order by report_date desc`;
}
