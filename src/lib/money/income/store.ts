import "server-only";
import { matchDepositsAndEstimates } from "@/tools/money/income/match";
import { emptyTaxes, emptyYtd, withDefaults, type IncomeConfig, type Stub, type W2, type WorkEvent } from "@/tools/money/income/types";
import { sql } from "../db";
import { getTransactions } from "../store";

/** Reads and writes for Money → Income. Every query names the `money` schema (docs/sql/money-income.sql). */

type StubRow = {
  id: string; kind: Stub["kind"]; status: Stub["status"]; employer: string | null; payroll_company: string | null; show_name: string | null;
  pay_date: string | null; period_start: string | null; period_end: string | null; tax_year: number | null;
  gross: number | null; net: number | null; hours: number | null; check_number: string | null;
  taxes: Stub["taxes"]; deductions: Stub["deductions"]; earnings: Stub["earnings"]; ytd: Stub["ytd"]; w2: W2 | null; work_days: string[];
  notes: string | null; read_error: string | null; deposit_txn_id: string | null; deposit_match: Stub["depositMatch"]; estimated: boolean; created_at: Date;
};

const COLS = `id, kind, status, employer, payroll_company, show_name,
  to_char(pay_date, 'YYYY-MM-DD') as pay_date, to_char(period_start, 'YYYY-MM-DD') as period_start, to_char(period_end, 'YYYY-MM-DD') as period_end,
  tax_year, gross, net, hours, check_number, taxes, deductions, earnings, ytd, w2, work_days, notes, read_error, deposit_txn_id, deposit_match, estimated, created_at`;

const toStub = (r: StubRow): Stub => ({
  id: r.id, kind: r.kind, status: r.status, employer: r.employer, payrollCompany: r.payroll_company, showName: r.show_name,
  payDate: r.pay_date, periodStart: r.period_start, periodEnd: r.period_end, taxYear: r.tax_year,
  gross: r.gross, net: r.net, hours: r.hours, checkNumber: r.check_number,
  taxes: { ...emptyTaxes(), ...(r.taxes ?? {}) }, deductions: r.deductions ?? [], earnings: r.earnings ?? [],
  ytd: { ...emptyYtd(), ...(r.ytd ?? {}) }, w2: r.w2, workDays: r.work_days ?? [],
  notes: r.notes, readError: r.read_error, depositTxnId: r.deposit_txn_id, depositMatch: r.deposit_match, estimated: r.estimated, createdAt: r.created_at.toISOString(),
});

export async function listStubs(): Promise<Stub[]> {
  const rows = await sql()<StubRow[]>`select ${sql().unsafe(COLS)} from money.stubs order by coalesce(pay_date, created_at::date) desc, created_at desc`;
  return rows.map(toStub);
}

export async function getStub(id: string): Promise<Stub | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [r] = await sql()<StubRow[]>`select ${sql().unsafe(COLS)} from money.stubs where id = ${id}`;
  return r ? toStub(r) : null;
}

export async function getStubFile(id: string): Promise<{ mime: string; bytes: Buffer } | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [r] = await sql()<{ mime: string; bytes: Buffer }[]>`select mime, bytes from money.stub_files where stub_id = ${id}`;
  return r ?? null;
}

export async function createStub(kind: "stub" | "w2", mime: string, bytes: Buffer): Promise<string> {
  return sql().begin(async (tx) => {
    const [{ id }] = await tx<{ id: string }[]>`insert into money.stubs (kind, status) values (${kind}, 'reading') returning id`;
    await tx`insert into money.stub_files (stub_id, mime, bytes) values (${id}, ${mime}, ${bytes})`;
    return id;
  });
}

/** A stub whose stored file is byte-for-byte this one (the same PDF or photo added twice). */
export async function findStubByFile(bytes: Buffer): Promise<string | null> {
  const [r] = await sql()<{ stub_id: string }[]>`select stub_id from money.stub_files where md5(bytes) = md5(${bytes}::bytea) limit 1`;
  return r?.stub_id ?? null;
}

export type StubFields = Omit<Stub, "id" | "createdAt" | "depositTxnId" | "depositMatch" | "readError"> & { readError?: string | null };

export async function writeStub(id: string, f: StubFields, model?: string | null): Promise<void> {
  await sql()`
    update money.stubs set
      kind = ${f.kind}, status = ${f.status}, employer = ${f.employer}, payroll_company = ${f.payrollCompany}, show_name = ${f.showName},
      pay_date = ${f.payDate}::date, period_start = ${f.periodStart}::date, period_end = ${f.periodEnd}::date, tax_year = ${f.taxYear},
      gross = ${f.gross}, net = ${f.net}, hours = ${f.hours}, check_number = ${f.checkNumber},
      taxes = ${sql().json(f.taxes)}, deductions = ${sql().json(f.deductions)}, earnings = ${sql().json(f.earnings)},
      ytd = ${sql().json(f.ytd)}, w2 = ${f.w2 ? sql().json(f.w2) : null}, work_days = ${sql().json(f.workDays)},
      notes = ${f.notes}, read_error = ${f.readError ?? null}, model = coalesce(${model ?? null}, model), updated_at = now()
    where id = ${id}`;
}

export async function failStub(id: string, why: string): Promise<void> {
  await sql()`update money.stubs set status = 'failed', read_error = ${why}, updated_at = now() where id = ${id}`;
}

export async function deleteStub(id: string): Promise<void> {
  await sql()`delete from money.stubs where id = ${id}`;
}

export async function deleteStubFile(id: string): Promise<void> {
  await sql()`delete from money.stub_files where stub_id = ${id}`;
}

export async function setDeposit(id: string, txnId: string | null, mode: "auto" | "manual" | "none"): Promise<void> {
  await sql()`update money.stubs set deposit_txn_id = ${txnId}, deposit_match = ${mode}, updated_at = now() where id = ${id}`;
}

/** Links saved stubs to their bank deposits (src/tools/money/income/match.ts). Returns how many. */
export async function rematchDeposits(): Promise<number> {
  const stubs = await listStubs();
  if (!stubs.some((s) => s.status === "saved" && !s.depositTxnId)) return 0;
  const since = new Date(Date.now() - 500 * 86_400_000).toISOString().slice(0, 10);
  const txns = await getTransactions(since);
  const { matched, superseded } = matchDepositsAndEstimates(stubs, txns);
  // A real stub that claims an estimate's deposit replaces the estimate.
  for (const id of superseded) await deleteStub(id);
  for (const [stubId, txnId] of matched) await setDeposit(stubId, txnId, "auto");
  return matched.size;
}

// ---- settings ----

export type IncomeSettings = { config: IncomeConfig; keyHash: string | null; keyCreatedAt: string | null; lastRunAt: string | null; lastSummary: unknown };

export async function getIncomeSettings(): Promise<IncomeSettings> {
  const [r] = await sql()<{ config: unknown; calendar_key_hash: string | null; calendar_key_created_at: Date | null; calendar_last_run_at: Date | null; calendar_last_summary: unknown }[]>`
    select config, calendar_key_hash, calendar_key_created_at, calendar_last_run_at, calendar_last_summary from money.income_settings where id = 1`;
  return {
    config: withDefaults(r?.config),
    keyHash: r?.calendar_key_hash ?? null,
    keyCreatedAt: r?.calendar_key_created_at?.toISOString() ?? null,
    lastRunAt: r?.calendar_last_run_at?.toISOString() ?? null,
    lastSummary: r?.calendar_last_summary ?? null,
  };
}

export async function saveConfig(config: IncomeConfig): Promise<void> {
  await sql()`insert into money.income_settings (id, config) values (1, ${sql().json(config)})
              on conflict (id) do update set config = excluded.config, updated_at = now()`;
}

export async function setCalendarKeyHash(hash: string): Promise<void> {
  await sql()`insert into money.income_settings (id, calendar_key_hash, calendar_key_created_at) values (1, ${hash}, now())
              on conflict (id) do update set calendar_key_hash = excluded.calendar_key_hash, calendar_key_created_at = now(), updated_at = now()`;
}

export async function recordCalendarRun(summary: unknown): Promise<void> {
  await sql()`update money.income_settings set calendar_last_run_at = now(), calendar_last_summary = ${sql().json((summary ?? {}) as never)}, updated_at = now() where id = 1`;
}

// ---- calendar ----

export async function listEvents(): Promise<WorkEvent[]> {
  const rows = await sql()<{ event_id: string; title: string; start_day: string; end_day: string; color: string | null; recolored_at: Date | null }[]>`
    select event_id, title, to_char(start_day, 'YYYY-MM-DD') as start_day, to_char(end_day, 'YYYY-MM-DD') as end_day, color, recolored_at
    from money.work_events order by start_day`;
  return rows.map((r) => ({ eventId: r.event_id, title: r.title, startDay: r.start_day, endDay: r.end_day, color: r.color, recoloredAt: r.recolored_at?.toISOString() ?? null }));
}

/** Replaces the events whose start falls in [from, to] with what the calendar sent. */
export async function replaceEvents(events: WorkEvent[], from: string, to: string): Promise<void> {
  await sql().begin(async (tx) => {
    const keys = events.map((e) => e.eventId);
    if (keys.length) await tx`delete from money.work_events where start_day between ${from}::date and ${to}::date and event_id not in ${tx(keys)}`;
    else await tx`delete from money.work_events where start_day between ${from}::date and ${to}::date`;
    for (const e of events) {
      await tx`insert into money.work_events (event_id, title, start_day, end_day, color, seen_at)
               values (${e.eventId}, ${e.title}, ${e.startDay}::date, ${e.endDay}::date, ${e.color}, now())
               on conflict (event_id) do update set title = excluded.title, start_day = excluded.start_day, end_day = excluded.end_day,
                 color = excluded.color, seen_at = now()`;
    }
  });
}

export async function markRecolored(keys: string[], paidColor: string): Promise<void> {
  if (!keys.length) return;
  await sql()`update money.work_events set recolored_at = now(), color = ${paidColor} where event_id in ${sql()(keys)}`;
}

/** File an EDD deposit as Paid Family Leave or Disability Insurance (benefits.ts). Once per deposit. */
export async function fileBenefit(txnId: string, program: string): Promise<void> {
  await sql()`
    insert into money.stubs (kind, status, employer, payroll_company, show_name, pay_date, tax_year, gross, net, taxes, deductions, earnings, ytd, deposit_txn_id, deposit_match)
    select 'benefit', 'saved', 'California EDD', 'California EDD', ${program}, t.posted, extract(year from t.posted)::int, t.amount, t.amount,
      '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, t.id, 'manual'
    from money.transactions t
    where t.id = ${txnId} and t.amount > 0
      and not exists (select 1 from money.stubs s where s.kind = 'benefit' and s.deposit_txn_id = t.id)`;
}

export async function unfileBenefit(id: string): Promise<void> {
  await sql()`delete from money.stubs where id = ${id} and kind = 'benefit'`;
}
