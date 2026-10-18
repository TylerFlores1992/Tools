/**
 * The money tracker's logic: categorizing, transfer pairing, recurring detection, the SimpleFIN
 * protocol handling and monthly totals. Bank data is real money; a wrong total misleads.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, OTHER_INCOME, TRANSFER, UNCATEGORIZED, categorize, findTransferPairs, keywordCategory, matchTransfers, ruleCategory } from "./categorize.ts";
import { addDays, findRecurring, merchantKey, monthlyEquivalent } from "./recurring.ts";
import { SimpleFinError, claimAccessUrl, claimUrlFromSetupToken, fetchAccounts, parseAccountSet, splitAccessUrl, syncWindows, toLocalDate } from "./simplefin.ts";
import { isMonth, money, shiftMonth, signedMoney, summarize, transfersAcross } from "./summary.ts";
import type { Txn } from "./types.ts";

let n = 0;
const txn = (p: Partial<Txn> & Pick<Txn, "posted" | "amount" | "description">): Txn => ({
  id: `t${++n}`, accountId: "chase", payee: null, memo: null, pending: false, category: null, categorySource: null, ...p,
});

// ---- categorizing ----

test("keywords: common merchants land in the right category", () => {
  assert.equal(keywordCategory("SAFEWAY #1234 SAN JOSE CA"), "Groceries");
  assert.equal(keywordCategory("DOORDASH*TACOS"), "Dining");
  assert.equal(keywordCategory("NETFLIX.COM 866-579-7172"), "Subscriptions");
  assert.equal(keywordCategory("VERCEL INC."), "Software");
  assert.equal(keywordCategory("RECREATION.GOV 877-444-6777"), "Travel & camping");
  assert.equal(keywordCategory("Online Transfer to SAV ...1234"), TRANSFER);
  assert.equal(keywordCategory("ACME CORP PAYROLL PPD ID: 123"), "Income");
  assert.equal(keywordCategory("XYZZY LLC"), null);
});

test("keywords: short words only match as whole words", () => {
  // "76 " is a gas brand; it must not match a store number like "#2376".
  assert.equal(keywordCategory("76 - SAN JOSE"), "Gas");
  assert.notEqual(keywordCategory("BOOKSTORE #2376 OAKLAND"), "Gas");
  // "VET " must not match "CORVETTE".
  assert.notEqual(keywordCategory("CORVETTE PARTS"), "Pets");
});

test("rules: case-insensitive contains, longest pattern wins", () => {
  const rules = [{ pattern: "costco", category: "Groceries" }, { pattern: "COSTCO GAS", category: "Gas" }];
  assert.equal(ruleCategory("COSTCO GAS #123", rules), "Gas");
  assert.equal(ruleCategory("Costco Whse #9", rules), "Groceries");
  assert.equal(ruleCategory("Target", rules), null);
});

test("rules saved from a merchant key match next month's raw description", () => {
  const pattern = merchantKey("NETFLIX.COM 866-579-7172 CA 09/05");
  assert.equal(ruleCategory("NETFLIX.COM 866-579-7172 CA 10/05", [{ pattern, category: "Entertainment" }]), "Entertainment");
  assert.equal(ruleCategory("SPOTIFY USA", [{ pattern, category: "Entertainment" }]), null);
});

test("categorize: manual beats rule beats keyword; re-sync keeps manual", () => {
  const rules = [{ pattern: "SAFEWAY", category: "Shopping" }];
  const t = txn({ posted: "2026-10-01", amount: -40, description: "SAFEWAY #1" });
  assert.deepEqual(categorize(t, []), { category: "Groceries", categorySource: "auto" });
  assert.deepEqual(categorize(t, rules), { category: "Shopping", categorySource: "rule" });
  assert.deepEqual(categorize({ ...t, category: "Pets", categorySource: "manual" }, rules), { category: "Pets", categorySource: "manual" });
});

test("categorize: unknown money in is Other income, unknown money out is Uncategorized", () => {
  assert.equal(categorize(txn({ posted: "2026-10-01", amount: 25, description: "VENMO CASHOUT" }), []).category, OTHER_INCOME);
  assert.equal(categorize(txn({ posted: "2026-10-01", amount: -25, description: "XYZZY LLC" }), []).category, UNCATEGORIZED);
  // A refund from a coffee shop is not Dining income.
  assert.equal(categorize(txn({ posted: "2026-10-01", amount: 5, description: "STARBUCKS REFUND" }), []).category, OTHER_INCOME);
});

test("the picker offers every category the keyword list can produce", () => {
  for (const d of ["SAFEWAY", "DOORDASH", "SHELL", "AUTOZONE", "AMAZON", "NETFLIX", "VERCEL", "PG&E", "COMCAST", "RENT", "GEICO", "CVS", "KOA", "STEAM", "PETCO", "OVERDRAFT", "ATM WITHDRAWAL", "PAYROLL", "XFER"]) {
    const c = keywordCategory(d);
    assert.ok(c && (CATEGORIES as readonly string[]).includes(c), `${d} → ${c}`);
  }
});

test("transfer pairs: same amount, opposite sign, different accounts, within 5 days", () => {
  const out = txn({ accountId: "chase", posted: "2026-10-01", amount: -500, description: "ZELLE TO JOINT" });
  const inn = txn({ accountId: "usbank", posted: "2026-10-03", amount: 500, description: "ZELLE FROM TYLER" });
  const far = txn({ accountId: "usbank", posted: "2026-10-09", amount: 500, description: "DEPOSIT" });
  const same = txn({ accountId: "chase", posted: "2026-10-01", amount: 500, description: "REFUND" });
  const pairs = findTransferPairs([out, inn, far, same]);
  assert.deepEqual([...pairs].sort(), [out.id, inn.id].sort());
});

test("transfer pairs: each side pairs once", () => {
  const a = txn({ accountId: "chase", posted: "2026-10-01", amount: -100, description: "X" });
  const b = txn({ accountId: "chase", posted: "2026-10-01", amount: -100, description: "Y" });
  const c = txn({ accountId: "usbank", posted: "2026-10-01", amount: 100, description: "Z" });
  assert.equal(findTransferPairs([a, b, c]).size, 2);
});

test("transfer pairs: a Chase → U.S. Bank transfer that lands four days later still pairs, nearest first", () => {
  const out = txn({ accountId: "chase", posted: "2026-09-17", amount: -3950, description: "ONLINE TRANSFER TO US BANK" });
  const early = txn({ accountId: "usbank", posted: "2026-09-12", amount: 3950, description: "ELECTRONIC DEPOSIT" });
  const landed = txn({ accountId: "usbank", posted: "2026-09-21", amount: 3950, description: "ELECTRONIC DEPOSIT JPMORGAN CHASE" });
  const m = matchTransfers([out, early, landed]);
  assert.equal(m.get(out.id), landed.id);
  assert.equal(m.get(landed.id), out.id);
  assert.equal(m.has(early.id), false);
});

test("Marcus (Goldman Sachs Bank) transfers are transfers", () => {
  assert.equal(keywordCategory("GOLDMAN SACHS BA TRANSFER 000300005964662 WEB ID: 1234"), TRANSFER);
});

// ---- recurring ----

test("merchant key drops dates, digits and card noise", () => {
  assert.equal(merchantKey("NETFLIX.COM 866-579-7172 CA"), merchantKey("NETFLIX.COM 866-579-7172 CA 10/02"));
  assert.equal(merchantKey("POS PURCHASE SPOTIFY USA 1234"), merchantKey("SPOTIFY USA 9876"));
  assert.notEqual(merchantKey("SPOTIFY USA"), merchantKey("NETFLIX.COM"));
});

const monthly = (desc: string, amount: number, dates: string[], acct = "chase") =>
  dates.map((posted) => txn({ accountId: acct, posted, amount, description: `${desc} ${posted.replace(/-/g, "")}` }));

test("recurring: a monthly subscription is found, with the next date", () => {
  const txns = monthly("NETFLIX.COM", -15.49, ["2026-07-05", "2026-08-05", "2026-09-05", "2026-10-05"]);
  const r = findRecurring(txns, "2026-10-18");
  assert.equal(r.length, 1);
  assert.equal(r[0].cadence, "monthly");
  assert.equal(r[0].typical, 15.49);
  assert.equal(r[0].direction, "out");
  assert.equal(r[0].status, "active");
  assert.equal(r[0].next, addDays("2026-10-05", 31));
  assert.equal(r[0].varies, false);
});

test("recurring: a biweekly paycheck is found as money in", () => {
  const dates = ["2026-08-07", "2026-08-21", "2026-09-04", "2026-09-18", "2026-10-02", "2026-10-16"];
  const r = findRecurring(monthly("ACME PAYROLL", 2100, dates), "2026-10-18");
  assert.equal(r.length, 1);
  assert.equal(r[0].cadence, "every 2 weeks");
  assert.equal(r[0].direction, "in");
});

test("recurring: a utility bill that varies is flagged as varying", () => {
  const txns = [
    ...monthly("PG&E WEB ONLINE", -120, ["2026-07-20"]),
    ...monthly("PG&E WEB ONLINE", -98, ["2026-08-19"]),
    ...monthly("PG&E WEB ONLINE", -141, ["2026-09-20"]),
  ];
  const r = findRecurring(txns, "2026-10-01");
  assert.equal(r.length, 1);
  assert.equal(r[0].varies, true);
});

test("recurring: a store you visit often is not a subscription", () => {
  const txns = monthly("SAFEWAY #1234", -60, ["2026-09-01", "2026-09-03", "2026-09-10", "2026-09-30"]);
  txns[1].amount = -12; txns[2].amount = -140;
  assert.deepEqual(findRecurring(txns, "2026-10-05"), []);
  // Even on a monthly rhythm, amounts all over the place mean shopping, not a bill.
  const shop = monthly("TARGET T-1234", -60, ["2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"]);
  shop[1].amount = -12; shop[2].amount = -140;
  assert.deepEqual(findRecurring(shop, "2026-10-05"), []);
});

test("recurring: two charges aren't enough for a monthly series", () => {
  assert.deepEqual(findRecurring(monthly("HULU", -9.99, ["2026-09-01", "2026-10-01"]), "2026-10-05"), []);
});

test("recurring: one that hasn't come in a while is marked stopped", () => {
  const r = findRecurring(monthly("SPOTIFY USA", -11.99, ["2026-05-03", "2026-06-03", "2026-07-03"]), "2026-10-18");
  assert.equal(r[0].status, "stopped");
});

test("recurring: transfers and pending charges are ignored", () => {
  const txns = monthly("ONLINE TRANSFER TO SAV", -200, ["2026-07-01", "2026-08-01", "2026-09-01"]).map((t) => ({ ...t, category: TRANSFER }));
  assert.deepEqual(findRecurring(txns, "2026-09-05"), []);
});

test("monthly equivalent", () => {
  assert.equal(monthlyEquivalent({ cadence: "yearly", typical: 120 }), 10);
  assert.equal(Math.round(monthlyEquivalent({ cadence: "weekly", typical: 12 }) * 100), 5200);
});

// ---- SimpleFIN ----

const b64 = (s: string) => Buffer.from(s).toString("base64");

test("setup token decodes to its claim URL; junk is refused in words", () => {
  const claim = "https://beta-bridge.simplefin.org/simplefin/claim/abc123";
  assert.equal(claimUrlFromSetupToken(`  ${b64(claim)}\n`), claim);
  assert.throws(() => claimUrlFromSetupToken(""), SimpleFinError);
  assert.throws(() => claimUrlFromSetupToken(b64("not a url")), SimpleFinError);
  assert.throws(() => claimUrlFromSetupToken(b64("http://insecure.example/claim")), SimpleFinError);
});

test("access URL: credentials move into a Basic header, out of the URL", () => {
  const { base, authorization } = splitAccessUrl("https://u%40x:p%3Aw@bridge.example/simplefin/");
  assert.equal(base, "https://bridge.example/simplefin");
  assert.ok(!base.includes("@"));
  assert.equal(Buffer.from(authorization.slice(6), "base64").toString(), "u@x:p:w");
  assert.throws(() => splitAccessUrl("https://bridge.example/simplefin"), SimpleFinError);
});

test("claim: POSTs once and returns the access URL; a used token says so", async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  const ok = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method });
    return new Response("https://user:pass@bridge.example/simplefin\n", { status: 200 });
  }) as typeof fetch;
  assert.equal(await claimAccessUrl(b64("https://bridge.example/claim/1"), ok), "https://user:pass@bridge.example/simplefin");
  assert.deepEqual(calls, [{ url: "https://bridge.example/claim/1", method: "POST" }]);
  const used = (async () => new Response("", { status: 403 })) as typeof fetch;
  await assert.rejects(claimAccessUrl(b64("https://bridge.example/claim/1"), used), /already used/);
});

test("fetchAccounts: sends Basic auth and the date range, without credentials in the URL", async () => {
  const seen: Array<{ url: string; auth: string | null }> = [];
  const f = (async (url: string, init?: RequestInit) => {
    seen.push({ url, auth: new Headers(init?.headers).get("Authorization") });
    return Response.json({ errors: [], accounts: [] });
  }) as typeof fetch;
  await fetchAccounts("https://u:p@bridge.example/simplefin", 1000, 2000, f);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, "https://bridge.example/simplefin/accounts?start-date=1000&end-date=2000&pending=1");
  assert.equal(seen[0].auth, `Basic ${b64("u:p")}`);
  const revoked = (async () => new Response("", { status: 403 })) as typeof fetch;
  await assert.rejects(fetchAccounts("https://u:p@bridge.example/simplefin", 0, 1, revoked), (e: unknown) => e instanceof SimpleFinError && e.kind === "auth");
});

test("parse: amounts, local dates, pending, ids namespaced by account, bad rows skipped", () => {
  // 2026-10-18 04:30 UTC is still Oct 17 in California.
  const evening = Date.UTC(2026, 9, 18, 4, 30) / 1000;
  const set = {
    errors: ["Chase: connection needs attention"],
    accounts: [{
      id: "ACT-1", name: "Total Checking", currency: "USD", balance: "1234.5", "available-balance": "1200.00",
      "balance-date": evening, org: { name: "Chase" },
      transactions: [
        { id: "T1", posted: evening, amount: "-42.10", description: " SAFEWAY #12 " },
        { id: "T2", posted: 0, transacted_at: evening, amount: "-5.00", description: "PENDING COFFEE", pending: true },
        { id: "T3", posted: evening, amount: "abc", description: "bad amount" },
        { id: "", posted: evening, amount: "1", description: "no id" },
      ],
    }],
  };
  const p = parseAccountSet(set);
  assert.deepEqual(p.errors, ["Chase: connection needs attention"]);
  assert.equal(p.accounts[0].balance, 1234.5);
  assert.equal(p.accounts[0].orgName, "Chase");
  assert.equal(p.txns.length, 2);
  assert.equal(p.txns[0].id, "ACT-1:T1");
  assert.equal(p.txns[0].posted, "2026-10-17");
  assert.equal(p.txns[0].amount, -42.1);
  assert.equal(p.txns[0].description, "SAFEWAY #12");
  assert.equal(p.txns[1].pending, true);
  assert.equal(toLocalDate(evening), "2026-10-17");
});

test("sync windows cover the whole range in chunks, newest first, without gaps", () => {
  const now = 1_800_000_000;
  const w = syncWindows(now, 100, 45);
  assert.equal(w.length, 3);
  assert.equal(w[0].end, now);
  assert.equal(w[w.length - 1].start, now - 100 * 86_400);
  for (let i = 1; i < w.length; i++) assert.equal(w[i].end, w[i - 1].start);
});

// ---- totals ----

test("summary: money in/out/net for the month, transfers excluded, by category", () => {
  const txns = [
    txn({ posted: "2026-10-01", amount: 3000, description: "PAYROLL", category: "Income" }),
    txn({ posted: "2026-10-02", amount: -80.25, description: "SAFEWAY", category: "Groceries" }),
    txn({ posted: "2026-10-03", amount: -19.75, description: "SAFEWAY", category: "Groceries" }),
    txn({ posted: "2026-10-04", amount: -500, description: "XFER", category: TRANSFER }),
    txn({ posted: "2026-09-30", amount: -999, description: "LAST MONTH", category: "Shopping" }),
  ];
  const s = summarize(txns, "2026-10");
  assert.equal(s.moneyIn, 3000);
  assert.equal(s.moneyOut, 100);
  assert.equal(s.net, 2900);
  assert.equal(s.count, 3);
  assert.deepEqual(s.byCategory[0], { category: "Groceries", out: 100, in: 0, count: 2 });
});

test("summary: can be limited to some accounts", () => {
  const txns = [
    txn({ accountId: "chase", posted: "2026-10-02", amount: -10, description: "A", category: "Dining" }),
    txn({ accountId: "usbank", posted: "2026-10-02", amount: -30, description: "B", category: "Dining" }),
  ];
  assert.equal(summarize(txns, "2026-10", new Set(["usbank"])).moneyOut, 30);
});

test("Mine → Joint is money out of Mine and into Joint, and neither in Everything", () => {
  const owner: Record<string, string> = { chase: "mine", card: "mine", usbank: "joint" };
  const name = (id: string) => (owner[id] === "joint" ? "Joint" : "your accounts");
  const txns = [
    txn({ accountId: "chase", posted: "2026-10-02", amount: -1000, description: "ONLINE TRANSFER TO US BANK", category: TRANSFER }),
    txn({ accountId: "usbank", posted: "2026-10-05", amount: 1000, description: "ELECTRONIC DEPOSIT", category: TRANSFER }),
    // Paying his own card from his own checking: the card's purchases already count.
    txn({ accountId: "chase", posted: "2026-10-09", amount: -300, description: "PAYMENT TO CHASE CARD", category: TRANSFER }),
    txn({ accountId: "card", posted: "2026-10-09", amount: 300, description: "PAYMENT THANK YOU", category: TRANSFER }),
    txn({ accountId: "card", posted: "2026-10-03", amount: -300, description: "SAFEWAY", category: "Groceries" }),
    txn({ accountId: "usbank", posted: "2026-10-10", amount: -900, description: "PG&E", category: "Utilities" }),
  ];
  const mine = new Set(["chase", "card"]);
  const joint = new Set(["usbank"]);
  const all = new Set(["chase", "card", "usbank"]);
  const inView = (ids: Set<string>) => txns.filter((t) => ids.has(t.accountId));

  const m = summarize(inView(mine), "2026-10", undefined, transfersAcross(txns, mine, name));
  assert.equal(m.moneyOut, 1300);
  assert.equal(m.moneyIn, 0);
  assert.ok(m.byCategory.some((c) => c.category === "Transfer to Joint" && c.out === 1000));

  const j = summarize(inView(joint), "2026-10", undefined, transfersAcross(txns, joint, name));
  assert.equal(j.moneyIn, 1000);
  assert.equal(j.moneyOut, 900);
  assert.ok(j.byCategory.some((c) => c.category === "Transfer from your accounts" && c.in === 1000));

  const e = summarize(txns, "2026-10", undefined, transfersAcross(txns, all, name));
  assert.equal(e.moneyOut, 1200);
  assert.equal(e.moneyIn, 0);
});

test("months and money formatting", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.ok(isMonth("2026-10") && !isMonth("2026-13") && !isMonth("2026-1") && !isMonth(undefined));
  assert.equal(money(-1234.5), "$1,234.50");
  assert.equal(signedMoney(-12), "−$12.00");
  assert.equal(signedMoney(12), "+$12.00");
});
