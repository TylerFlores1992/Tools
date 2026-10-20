import { test } from "node:test";
import assert from "node:assert/strict";
import { TRANSFER, findRefunds } from "./categorize.ts";
import { buildBudget, fullMonths } from "./budget.ts";
import { findRecurring } from "./recurring.ts";
import { incomeSources, summarize, transfersAcross } from "./summary.ts";
import type { Account, Txn } from "./types.ts";

let n = 0;
const txn = (p: Partial<Txn> & Pick<Txn, "posted" | "amount" | "description">): Txn => ({
  id: `b${++n}`, accountId: "chase", payee: null, memo: null, pending: false, category: null, categorySource: "auto", ...p,
});
const acct = (id: string, owner: Account["owner"], balance: number): Account => ({
  id, orgName: null, name: id, displayName: null, owner, currency: "USD", balance, availableBalance: null, balanceDate: null, hidden: false,
});

test("refunds: GSPro −$250 then +$250 is a refund, not income", () => {
  const charge = txn({ posted: "2026-09-02", amount: -250, description: "GSPRO", category: "Entertainment" });
  const back = txn({ posted: "2026-09-20", amount: 250, description: "GSPRO", category: "Other income" });
  const pay = txn({ posted: "2026-09-05", amount: 1000, description: "CAST AND CREW PAYROLL", category: "Income" });
  const refunds = findRefunds([charge, back, pay]);
  assert.equal(refunds.get(back.id), "Entertainment");
  assert.equal(refunds.has(pay.id), false);
  const filed = [charge, { ...back, category: refunds.get(back.id)! }, pay];
  const s = summarize(filed, "2026-09");
  assert.equal(s.moneyIn, 1000);
  assert.equal(s.moneyOut, 0);
  assert.deepEqual(incomeSources(filed, "2026-09").map((x) => x.amount), [1000]);
});

test("refunds: money in larger than any charge, or before it, is not a refund", () => {
  const charge = txn({ posted: "2026-09-10", amount: -50, description: "RAPSODO INC", category: "Entertainment" });
  const bigger = txn({ posted: "2026-09-12", amount: 80, description: "RAPSODO INC", category: "Other income" });
  const before = txn({ posted: "2026-09-01", amount: 50, description: "RAPSODO INC", category: "Other income" });
  assert.equal(findRefunds([charge, bigger, before]).size, 0);
});

test("the monthly transfer to joint is a bill in the Mine view, and nowhere in Everything", () => {
  const txns: Txn[] = [];
  for (const [o, i] of [["2026-07-17", "2026-07-21"], ["2026-08-19", "2026-08-21"], ["2026-09-17", "2026-09-21"]]) {
    txns.push(txn({ posted: o, amount: -3950, description: "ONLINE TRANSFER TO US BANK", category: TRANSFER }));
    txns.push(txn({ accountId: "usb", posted: i, amount: 3950, description: "ELECTRONIC DEPOSIT JPMORGAN CHASE", category: TRANSFER }));
  }
  const mine = new Set(["chase"]);
  const across = transfersAcross(txns, mine, () => "Joint");
  const r = findRecurring(txns.filter((t) => mine.has(t.accountId)), "2026-10-01", across);
  assert.deepEqual(r.map((x) => [x.name, x.cadence, x.typical]), [["Transfer to Joint", "monthly", 3950]]);
  assert.deepEqual(findRecurring(txns, "2026-10-01"), []);
});

test("full months: only months the history fully covers, up to three", () => {
  const t = (d: string) => txn({ posted: d, amount: -1, description: "X" });
  assert.deepEqual(fullMonths([t("2026-07-21"), t("2026-10-02")], "2026-10-18"), ["2026-08", "2026-09"]);
  assert.deepEqual(fullMonths([t("2026-01-02")], "2026-10-18"), ["2026-07", "2026-08", "2026-09"]);
  assert.deepEqual(fullMonths([t("2026-10-02")], "2026-10-18"), []);
});

test("budget: bills + everyday (bills not counted twice, refunds taken off) vs income", () => {
  const txns = [
    ...["2026-08-01", "2026-09-01", "2026-10-01"].map((d) => txn({ posted: d, amount: -1000, description: "Valon Mortgage", category: "Housing" })),
    txn({ posted: "2026-08-10", amount: -300, description: "VONS", category: "Groceries" }),
    txn({ posted: "2026-09-10", amount: -500, description: "VONS", category: "Groceries" }),
    txn({ posted: "2026-09-12", amount: 100, description: "VONS REFUND", category: "Groceries" }),
    txn({ posted: "2026-08-05", amount: 3000, description: "PAYROLL", category: "Income" }),
    txn({ posted: "2026-09-05", amount: 2000, description: "PAYROLL", category: "Income" }),
    txn({ posted: "2026-07-05", amount: -1, description: "EARLY", category: "Dining" }),
  ];
  const rec = findRecurring(txns, "2026-10-05");
  const b = buildBudget(txns, rec, [acct("chase", "mine", 4000), acct("card", "mine", -500)], "2026-10-05");
  assert.deepEqual(b.months, ["2026-08", "2026-09"]);
  assert.equal(b.billsPerMonth, 1000);
  assert.deepEqual(b.everyday, [{ category: "Groceries", perMonth: 350 }]);
  assert.equal(b.needPerMonth, 1350);
  assert.equal(b.incomePerMonth, 2500);
  assert.equal(b.spare, 1150);
  assert.equal(b.cash, 3500);
  assert.equal(b.monthsCovered, 2.6);
  assert.deepEqual(b.upcoming.map((u) => [u.name, u.date]), [["Valon Mortgage", "2026-11-01"]]);
});
