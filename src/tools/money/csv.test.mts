import { test } from "node:test";
import assert from "node:assert/strict";
import { csvAmount, csvDate, parseCsv, readBankCsv } from "./csv.ts";

test("csv: quotes, doubled quotes, commas and newlines inside a field, CRLF, BOM", () => {
  const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n"two\nlines",z\r\n\r\n');
  assert.deepEqual(rows, [["a", "b"], ["x, y", 'say "hi"'], ["two\nlines", "z"]]);
});

test("csv dates and amounts", () => {
  assert.equal(csvDate("10/07/2026"), "2026-10-07");
  assert.equal(csvDate("1/5/26"), "2026-01-05");
  assert.equal(csvDate("2026-03-09"), "2026-03-09");
  assert.equal(csvDate("13/01/2026"), null);
  assert.equal(csvDate("Pending"), null);
  assert.equal(csvAmount("-1,234.56"), -1234.56);
  assert.equal(csvAmount("$12.00"), 12);
  assert.equal(csvAmount("(12.50)"), -12.5);
  assert.equal(csvAmount(""), null);
  assert.equal(csvAmount("abc"), null);
});

test("Chase checking export: Posting Date, Description, Amount", () => {
  const text = [
    "Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #,",
    'DEBIT,03/02/2026,"SAFEWAY #1234 SAN JOSE CA",-82.15,DEBIT_CARD,1500.00,,',
    "CREDIT,03/01/2026,PAYROLL ACME,2500.00,ACH_CREDIT,1582.15,,",
  ].join("\n");
  const r = readBankCsv(text);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.rows.map((x) => [x.posted, x.amount, x.description]), [
    ["2026-03-02", -82.15, "SAFEWAY #1234 SAN JOSE CA"],
    ["2026-03-01", 2500, "PAYROLL ACME"],
  ]);
});

test("Chase card export prefers Post Date over Transaction Date", () => {
  const text = "Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n02/27/2026,03/01/2026,NETFLIX.COM,Entertainment,Sale,-15.49,\n";
  assert.equal(readBankCsv(text).rows[0].posted, "2026-03-01");
});

test("U.S. Bank export: Date, Transaction, Name, Memo, Amount; flip signs", () => {
  const text = '"Date","Transaction","Name","Memo","Amount"\n"2026-04-03","DEBIT","PG&E WEB ONLINE","Download from usbank.com.","-120.33"\n';
  const r = readBankCsv(text);
  assert.deepEqual(r.rows[0], { posted: "2026-04-03", amount: -120.33, description: "PG&E WEB ONLINE", memo: "Download from usbank.com." });
  assert.equal(readBankCsv(text, true).rows[0].amount, 120.33);
});

test("debit and credit columns instead of one amount", () => {
  const text = "Date,Description,Debit,Credit\n01/02/2026,COFFEE,4.50,\n01/03/2026,REFUND,,4.50\n";
  assert.deepEqual(readBankCsv(text).rows.map((x) => x.amount), [-4.5, 4.5]);
});

test("junk rows are skipped and counted; a wrong file says so in words", () => {
  const r = readBankCsv("Posting Date,Description,Amount\n,,\nPending,THING,-1\n03/02/2026,OK,-1\n");
  assert.equal(r.rows.length, 1);
  assert.equal(r.skipped, 1);
  assert.match(readBankCsv("foo,bar\n1,2\n").error ?? "", /date, description and amount/);
  assert.match(readBankCsv("").error ?? "", /no rows/);
});
