/**
 * Reading a bank's own CSV export, for history older than SimpleFIN's 90 days.
 *
 * The columns are found by their header names, not their position, because every bank (and
 * every account type at one bank) orders them differently. What we know, written 2026-10-18 from
 * the banks' export formats as commonly documented, NOT from a file the owner sent:
 *   Chase checking:  Details, Posting Date, Description, Amount, Type, Balance, Check or Slip #
 *   Chase card:      Transaction Date, Post Date, Description, Category, Type, Amount, Memo
 *   U.S. Bank:       Date, Transaction, Name, Memo, Amount
 * Money out is negative in all three. A file that reads the other way round can be imported
 * with "flip signs", and an import can be undone.
 */

export type CsvRow = { posted: string; amount: number; description: string; memo: string | null };
export type CsvResult = { rows: CsvRow[]; skipped: number; error?: string };

/** RFC 4180-ish: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) out.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) out.push(row);
  return out;
}

const key = (h: string) => h.trim().toLowerCase().replace(/[^a-z#]+/g, " ").trim();

/** The first header that matches, in order of preference. */
function find(headers: string[], names: string[]): number {
  for (const n of names) {
    const i = headers.indexOf(n);
    if (i !== -1) return i;
  }
  return -1;
}

/** "10/07/2026", "2026-10-07", "10/7/26" → "2026-10-07". Anything else → null. */
export function csvDate(s: string): string | null {
  const v = s.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(v);
  if (!m) return null;
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  const mo = Number(m[1]);
  const d = Number(m[2]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "-1,234.56", "$12.00", "(12.00)" → a number. Empty or junk → null. */
export function csvAmount(s: string): number | null {
  let v = s.trim().replace(/[$,\s]/g, "");
  if (!v) return null;
  let neg = false;
  if (/^\(.*\)$/.test(v)) { neg = true; v = v.slice(1, -1); }
  if (!/^[-+]?\d*\.?\d+$/.test(v)) return null;
  const n = Number(v);
  return Math.round((neg ? -n : n) * 100) / 100;
}

export function readBankCsv(text: string, flip = false): CsvResult {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], skipped: 0, error: "That file has no rows. Download it again as CSV from the bank." };
  const headers = table[0].map(key);
  const date = find(headers, ["posting date", "post date", "date", "transaction date", "posted date"]);
  const desc = find(headers, ["description", "name", "payee", "merchant"]);
  const amount = find(headers, ["amount"]);
  const debit = find(headers, ["debit", "withdrawal", "withdrawals"]);
  const credit = find(headers, ["credit", "deposit", "deposits"]);
  const memo = find(headers, ["memo"]);
  if (date === -1 || desc === -1 || (amount === -1 && debit === -1 && credit === -1)) {
    return { rows: [], skipped: 0, error: "Couldn’t find the date, description and amount columns. Is this the bank’s CSV download?" };
  }
  const rows: CsvRow[] = [];
  let skipped = 0;
  for (const r of table.slice(1)) {
    const posted = csvDate(r[date] ?? "");
    let n: number | null;
    if (amount !== -1) n = csvAmount(r[amount] ?? "");
    else {
      const d = debit === -1 ? null : csvAmount(r[debit] ?? "");
      const c = credit === -1 ? null : csvAmount(r[credit] ?? "");
      n = d === null && c === null ? null : (c ?? 0) - Math.abs(d ?? 0);
    }
    const description = (r[desc] ?? "").trim().replace(/\s+/g, " ");
    if (!posted || n === null || n === 0 || !description) { skipped++; continue; }
    const m = memo === -1 ? "" : (r[memo] ?? "").trim();
    rows.push({ posted, amount: flip ? -n : n, description: description.slice(0, 300), memo: m ? m.slice(0, 300) : null });
  }
  if (rows.length === 0) return { rows, skipped, error: "No transactions could be read from that file." };
  return { rows, skipped };
}
