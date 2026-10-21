import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import type { Txn } from "../types.ts";
import { calendarScript, calendarScriptTemplate, KEY_PLACEHOLDER, URL_PLACEHOLDER } from "./calendar-script.ts";
import { refreshPending, shouldRead } from "./refresh.ts";
import { dayPay, previousStub, sameEmployer, stubChecks, workedHours } from "./checks.ts";
import { parseStubForm } from "./form.ts";
import { healthPeriods } from "./health.ts";
import { findDeposit, matchDeposits } from "./match.ts";
import { missingStubs, payerOf } from "./missing.ts";
import { countedStubs, replacedBy } from "./reissue.ts";
import { estimateFromSimilar, remainingFromYtd, splitByNet } from "./estimate.ts";
import { benefitsByProgram, DI, PFL, taxableBenefits, unfiledEdd } from "./benefits.ts";
import { matchDepositsAndEstimates } from "./match.ts";
import { fromRead, noSsn, type ReadResult } from "./read.ts";
import { DEFAULT_CONFIG, emptyTaxes, emptyYtd, withDefaults, type IncomeConfig, type Stub, type WorkEvent } from "./types.ts";
import { federalTax, w2Check, withholdingEstimate } from "./withholding.ts";
import { defaultLinks, recolorIds, workDays } from "./workdays.ts";

let n = 0;
const stub = (p: Partial<Stub> = {}): Stub => ({
  id: `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`, kind: "stub", status: "saved",
  employer: "Cast & Crew", payrollCompany: "Cast & Crew", showName: "TAC", payDate: "2026-09-25", periodStart: "2026-09-14", periodEnd: "2026-09-20",
  taxYear: 2026, gross: 1000, net: 777.5, hours: null, checkNumber: null,
  taxes: { ...emptyTaxes(), federal: 100, socialSecurity: 62, medicare: 14.5, state: 33, sdi: 13 },
  deductions: [], earnings: [{ label: "Straight Time", kind: "regular", hours: 20, rate: 50, amount: 1000 }],
  ytd: emptyYtd(), w2: null, workDays: [], notes: null, readError: null, depositTxnId: null, depositMatch: null, createdAt: "2026-09-26T00:00:00Z",
  ...p,
});
const txn = (p: Partial<Txn> & Pick<Txn, "posted" | "amount">): Txn => ({
  id: `t${++n}`, accountId: "chase", description: "DEPOSIT", payee: null, memo: null, pending: false, category: "Income", categorySource: "auto", ...p,
});
const cfg = (p: Partial<IncomeConfig> = {}): IncomeConfig => withDefaults({ ...DEFAULT_CONFIG, ...p });

// ---- reading ----

const read = (p: Partial<ReadResult> = {}): ReadResult => ({
  documentType: "pay_stub", employer: "Entertainment Partners", payrollCompany: "EP", showName: "Uni",
  payDate: "2026-10-16", periodStart: "2026-10-05", periodEnd: "2026-10-11", checkNumber: "#00123",
  grossPay: 1200, netPay: 900,
  earnings: [
    { label: "ST", kind: "regular", hours: 16, rate: 50, amount: 800 },
    { label: "OT 1.5", kind: "overtime", hours: 4, rate: 75, amount: 300 },
    { label: "Meal Penalty", kind: "meal_penalty", hours: 1, rate: null, amount: 100 },
  ],
  taxes: { federal: -120, socialSecurity: 74.4, medicare: 17.4, state: 40, sdi: 15.6, local: null, other: null },
  deductions: [{ label: "Union dues", amount: 32.6 }],
  ytd: { gross: 20000, net: 15000, federal: 2000, socialSecurity: 1240, medicare: 290, state: 600, sdi: 260, hours: 400 },
  w2: null, unsure: ["SSN 123-45-6789 partly hidden"], ...p,
});

test("reading: SSN-shaped text is blanked everywhere, withholding is positive, meal penalties aren't hours", () => {
  assert.equal(noSsn("ssn 123-45-6789 acct 123456789012"), "ssn •••-••-•••• acct ••••");
  const r = fromRead(read({ employer: "Acme 123456789" }));
  assert.equal(r.employer, "Acme •••-••-••••");
  assert.ok(r.warnings.every((w) => !/\d{3}-\d{2}-\d{4}/.test(w)));
  assert.equal(r.taxes!.federal, 120);
  assert.equal(r.hours, 20);
  assert.equal(r.checkNumber, "00123");
  assert.equal(r.taxYear, 2026);
  assert.equal(fromRead(read({ payDate: "Oct 16" })).payDate, null);
  assert.equal(fromRead(read({ documentType: "other" })).warnings[0].startsWith("This doesn't look"), true);
});

test("reading a W-2 keeps its boxes", () => {
  const r = fromRead(read({ documentType: "w2", w2: { taxYear: 2026, box1Wages: 50000, box2Federal: 5000, box3SsWages: 51000, box4Ss: 3162, box5MedicareWages: 51000, box6Medicare: 739.5, box16StateWages: 50000, box17State: 1500, sdi: 663 } }));
  assert.equal(r.kind, "w2");
  assert.equal(r.w2!.box2Federal, 5000);
  assert.equal(r.taxYear, 2026);
});

// ---- checks ----

test("checks: a stub that adds up passes; a misread net is caught", () => {
  const good = stubChecks(stub(), null, cfg());
  assert.ok(good.every((c) => c.level === "ok"), JSON.stringify(good));
  const bad = stubChecks(stub({ net: 787.5 }), null, cfg());
  assert.ok(bad.some((c) => c.level === "look" && /net reads \$787\.50/.test(c.text)));
});

test("checks: line math, overtime multiple, rate below yours, payroll-tax rates", () => {
  const s = stub({
    gross: 1300, net: 1077.5,
    taxes: { ...emptyTaxes(), federal: 100, socialSecurity: 40, medicare: 18.85, state: 33, sdi: 16.9 },
    earnings: [
      { label: "ST", kind: "regular", hours: 20, rate: 50, amount: 1000 },
      { label: "OT", kind: "overtime", hours: 4, rate: 70, amount: 300 },
    ],
  });
  const c = stubChecks(s, null, cfg({ defaultRate: 52 }));
  assert.ok(c.some((x) => /OT: 4 h × \$70\.00 is \$280\.00, not \$300\.00/.test(x.text)));
  assert.ok(c.some((x) => /expected 1\.5× \$50\.00 = \$75\.00/.test(x.text)));
  assert.ok(c.some((x) => /below your \$52\.00 rate/.test(x.text)));
  assert.ok(c.some((x) => /Social Security is 3\.08%/.test(x.text)));
});

test("checks: year-to-date carries on from the last stub from the same employer", () => {
  const prev = stub({ payDate: "2026-09-18", ytd: { ...emptyYtd(), gross: 5000 } });
  const ok = stub({ ytd: { ...emptyYtd(), gross: 6000 } });
  assert.equal(previousStub(ok, [prev, ok])?.id, prev.id);
  assert.ok(stubChecks(ok, prev, cfg()).some((c) => c.level === "ok" && /carries on/.test(c.text)));
  const gap = stub({ ytd: { ...emptyYtd(), gross: 7500 } });
  assert.ok(stubChecks(gap, prev, cfg()).some((c) => c.level === "look" && /A stub may be missing/.test(c.text)));
  assert.equal(previousStub(stub({ employer: "Other", payrollCompany: "Other" }), [prev]), null);
});

test("California daily overtime: 1× to 8 h, 1.5× to 12, 2× after", () => {
  assert.equal(dayPay(8, 50), 400);
  assert.equal(dayPay(10, 50), 550);
  assert.equal(dayPay(14, 50), 400 + 300 + 200);
});

// ---- deposits ----

test("deposits: same amount, near the pay date, unclaimed; a named one wins; two equal checks take two deposits", () => {
  const s = stub({ net: 777.5, payDate: "2026-09-25" });
  const early = txn({ posted: "2026-09-20", amount: 777.5 });
  const late = txn({ posted: "2026-11-01", amount: 777.5 });
  const wrong = txn({ posted: "2026-09-26", amount: 777.51 });
  const plain = txn({ posted: "2026-09-26", amount: 777.5 });
  const named = txn({ posted: "2026-09-29", amount: 777.5, description: "CAST AND CREW PAYROLL" });
  assert.equal(findDeposit(s, [early, late, wrong], new Set()), null);
  assert.equal(findDeposit(s, [plain, named], new Set())?.id, named.id);
  assert.equal(findDeposit(s, [plain, named], new Set([named.id]))?.id, plain.id);
  // A phone deposit still pending is in the bank; a posted one wins over it.
  const pend = txn({ posted: "2026-09-26", amount: 777.5, pending: true });
  assert.equal(findDeposit(s, [pend], new Set())?.id, pend.id, "a pending deposit matches");
  assert.equal(findDeposit(s, [pend, { ...plain, posted: "2026-09-28" }], new Set())?.id, plain.id, "posted beats pending");
  const a = stub({ net: 500, payDate: "2026-10-02", id: "a0000000-0000-0000-0000-000000000000" });
  const b = stub({ net: 500, payDate: "2026-10-09", id: "b0000000-0000-0000-0000-000000000000" });
  const d1 = txn({ posted: "2026-10-03", amount: 500 });
  const d2 = txn({ posted: "2026-10-10", amount: 500 });
  const m = matchDeposits([b, a], [d1, d2]);
  assert.equal(m.get(a.id), d1.id);
  assert.equal(m.get(b.id), d2.id);
  assert.equal(matchDeposits([stub({ net: 500, depositMatch: "none" })], [d1]).size, 0);
});

// ---- calendar ----

const ev = (id: string, startDay: string, endDay: string, color = "6", title = "TAC"): WorkEvent => ({ eventId: id, title, startDay, endDay, color, recoloredAt: null });

test("work days: waiting, late, stub in, paid, and old weeks already marked paid", () => {
  const events = [ev("e1", "2026-09-14", "2026-09-18"), ev("e2", "2026-10-12", "2026-10-12", "6", "Uni"), ev("e3", "2026-08-03", "2026-08-04", "11"), ev("e4", "2026-10-25", "2026-10-25")];
  const s = stub({ workDays: ["e1|2026-09-14", "e1|2026-09-15"], depositTxnId: "t1" });
  const days = workDays(events, [s], cfg({ defaultRate: 50, payLagDays: 14 }), "2026-10-19");
  const by = (k: string) => days.find((d) => d.key === k)!;
  assert.equal(by("e1|2026-09-14").status, "paid");
  assert.equal(by("e1|2026-09-16").status, "waiting");
  assert.equal(by("e1|2026-09-16").late, true);
  assert.equal(by("e2|2026-10-12").status, "waiting");
  assert.equal(by("e2|2026-10-12").late, false);
  assert.equal(by("e2|2026-10-12").expected, 550);
  assert.equal(by("e3|2026-08-03").status, "marked");
  assert.equal(by("e4|2026-10-25").status, "scheduled");
  // Stub saved, money not in the bank yet.
  assert.equal(workDays(events, [{ ...s, depositTxnId: null }], cfg(), "2026-10-19").find((d) => d.key === "e1|2026-09-14")!.status, "stub");
});

test("recolour: only an event whose every day is paid, not already the paid colour, and only when on", () => {
  const events = [ev("a", "2026-09-14", "2026-09-15"), ev("b", "2026-09-16", "2026-09-16"), ev("c", "2026-09-17", "2026-09-17", "11")];
  const s = stub({ workDays: ["a|2026-09-14", "a|2026-09-15", "b|2026-09-16", "c|2026-09-17"], depositTxnId: "t" });
  const partly = stub({ workDays: [], depositTxnId: null });
  const days = workDays(events, [s, partly], cfg(), "2026-10-19");
  assert.deepEqual(recolorIds(events, days, cfg()), ["a", "b"]);
  assert.deepEqual(recolorIds(events, days, cfg({ recolor: false })), []);
  const half = workDays(events, [{ ...s, workDays: ["a|2026-09-14"] }], cfg(), "2026-10-19");
  assert.deepEqual(recolorIds(events, half, cfg()), []);
});

test("default links: calendar days inside the pay period that no other stub has", () => {
  const events = [ev("e1", "2026-09-13", "2026-09-16"), ev("e2", "2026-09-22", "2026-09-22")];
  const other = stub({ workDays: ["e1|2026-09-16"] });
  const mine = stub({ status: "review", periodStart: "2026-09-14", periodEnd: "2026-09-20" });
  assert.deepEqual(defaultLinks(mine, events, [other]), ["e1|2026-09-14", "e1|2026-09-15"]);
  // Only a week-ending date: the 7 days up to it.
  assert.deepEqual(defaultLinks({ ...mine, periodStart: null }, events, []), ["e1|2026-09-14", "e1|2026-09-15", "e1|2026-09-16"]);
});

test("the calendar script sends work-coloured events and recolours what the server names", () => {
  assert.ok(calendarScriptTemplate().includes(URL_PLACEHOLDER) && calendarScriptTemplate().includes(KEY_PLACEHOLDER));
  assert.ok(!calendarScriptTemplate().includes("`"));
  const set: Record<string, string> = {};
  const mk = (id: string, title: string, color: string, s: string, e: string) => ({
    getId: () => id, getTitle: () => title, getColor: () => color, isAllDayEvent: () => true,
    getAllDayStartDate: () => new Date(`${s}T12:00:00Z`), getAllDayEndDate: () => new Date(`${e}T12:00:00Z`),
    setColor: (c: string) => { set[id] = c; },
  });
  const calls: Array<Record<string, unknown>> = [];
  const triggerEvery: number[] = [];
  let readNow = true;
  const ctx = {
    console: { log() {} },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => ({ timeBased: () => ({ everyMinutes: (n: number) => { triggerEvery.push(n); return { create() {} }; } }) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    CalendarApp: { getDefaultCalendar: () => ({ getEvents: () => [mk("w1", "TAC", "6", "2026-09-14", "2026-09-19"), mk("x", "Dentist", "", "2026-09-20", "2026-09-21"), mk("p1", "Uni", "11", "2026-10-12", "2026-10-13")] }) },
    Session: { getScriptTimeZone: () => "UTC" },
    Utilities: { sleep() {}, formatDate: (d: Date) => d.toISOString().slice(0, 10) },
    UrlFetchApp: {
      fetch: (_u: string, o: { payload: string; headers: { Authorization: string } }) => {
        const p = JSON.parse(o.payload);
        calls.push(p);
        assert.equal(o.headers.Authorization, "Bearer k3y");
        const body = p.op === "hello" ? { from: "2026-01-01T00:00:00", to: "2026-12-19T00:00:00", colors: ["6", "11"], read: readNow, why: readNow ? "due" : "fresh" } : p.op === "events" ? { recolor: ["w1|2026-09-14", "missing|2026-01-01"], paidColor: "11" } : { ok: true };
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify(body) };
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(calendarScript("https://tylerflores.dev/api/money/calendar", "k3y"), ctx);
  const summary = vm.runInContext("moneyCalendar()", ctx);
  const sent = (calls.find((c) => c.op === "events")!.events as Array<{ key: string; startDay: string; endDay: string }>);
  assert.deepEqual(sent.map((e) => [e.key, e.startDay, e.endDay]), [["w1|2026-09-14", "2026-09-14", "2026-09-18"], ["p1|2026-10-12", "2026-10-12", "2026-10-12"]]);
  assert.deepEqual(set, { w1: "11" });
  assert.deepEqual(calls.at(-1)!.recolored, ["w1|2026-09-14"]);
  assert.equal(summary.recolored, 1);
  // A wake the server says isn't due sends only the hello; setup forces a read and checks every minute.
  readNow = false;
  calls.length = 0;
  assert.equal(JSON.stringify(vm.runInContext("moneyCalendar()", ctx)), JSON.stringify({ skipped: "fresh" }));
  assert.deepEqual(calls.map((c) => c.op), ["hello"]);
  calls.length = 0;
  vm.runInContext("setup()", ctx);
  assert.deepEqual(triggerEvery, [1]);
  assert.ok(calls.some((c) => c.op === "events"), "setup reads even when not due");
});

test("calendar refresh: read on first run, after Refresh, or when the last read is 15 minutes old", () => {
  const t0 = Date.parse("2026-10-20T18:00:00Z");
  const iso = (ms: number) => new Date(ms).toISOString();
  assert.deepEqual(shouldRead(null, null, t0), { read: true, why: "first" });
  assert.deepEqual(shouldRead(iso(t0 - 5 * 60_000), null, t0), { read: false, why: "fresh" });
  assert.deepEqual(shouldRead(iso(t0 - 15 * 60_000), null, t0), { read: true, why: "due" });
  assert.deepEqual(shouldRead(iso(t0 - 14 * 60_000), null, t0).read, false);
  assert.deepEqual(shouldRead(iso(t0 - 5 * 60_000), iso(t0 - 60_000), t0), { read: true, why: "refresh" });
  assert.deepEqual(shouldRead(iso(t0 - 60_000), iso(t0 - 5 * 60_000), t0), { read: false, why: "fresh" }, "a refresh already answered");
  assert.equal(refreshPending(iso(t0 - 5 * 60_000), iso(t0 - 60_000)), true);
  assert.equal(refreshPending(iso(t0 - 60_000), iso(t0 - 5 * 60_000)), false);
  assert.equal(refreshPending(null, null), false);
});

// ---- health, tax, W-2 ----

test("health hours: counted per period by period end, straight + overtime hours only", () => {
  const s1 = stub({ periodEnd: "2026-08-01", earnings: [{ label: "ST", kind: "regular", hours: 40, rate: 50, amount: 2000 }, { label: "MP", kind: "meal_penalty", hours: 2, rate: null, amount: 50 }] });
  const s2 = stub({ periodEnd: "2026-06-20", earnings: [{ label: "OT", kind: "overtime", hours: 10, rate: 75, amount: 750 }] });
  assert.equal(workedHours(s1), 40);
  const p = healthPeriods([s1, s2], cfg(), "2026-10-19");
  const cur = p.find((x) => x.current)!;
  assert.equal(cur.from, "2026-07-01");
  assert.equal(cur.to, "2026-12-31");
  assert.equal(cur.hours, 40);
  assert.equal(p.find((x) => x.from === "2026-01-01")!.hours, 10);
});

test("federal tax 2026 brackets (Rev. Proc. 2025-32)", () => {
  assert.equal(federalTax(24800, "joint"), 2480);
  assert.equal(federalTax(100800, "joint"), 2480 + 76000 * 0.12);
  assert.equal(federalTax(12400, "single"), 1240);
  assert.equal(federalTax(0, "single"), 0);
});

test("withholding estimate: two scenarios, gap = tax − withheld", () => {
  const stubs = [stub({ payDate: "2026-03-01", gross: 30000, taxes: { ...emptyTaxes(), federal: 1000 } }), stub({ payDate: "2026-09-01", gross: 30000, taxes: { ...emptyTaxes(), federal: 1000 } })];
  const e = withholdingEstimate(stubs, cfg({ tax: { filing: "joint", otherWages: 0, otherFederalWithheld: 0, overtimeDeduction: false } }), "2026-10-19");
  assert.equal(e.wagesSoFar, 60000);
  const s0 = e.scenarios[0];
  assert.equal(s0.tax, federalTax(60000 - 32200, "joint"));
  assert.equal(s0.gap, Math.round((s0.tax - 2000) * 100) / 100);
  assert.ok(e.scenarios[1].wages > 60000);
});

test("W-2 check: withholding boxes match the stubs; box 1 above gross means a stub is missing", () => {
  const stubs = [stub(), stub()];
  const r = w2Check({ taxYear: 2026, box1Wages: 1900, box2Federal: 200, box3SsWages: null, box4Ss: 124, box5MedicareWages: null, box6Medicare: 29, box16StateWages: null, box17State: 66, sdi: 26 }, stubs);
  assert.ok(r.lines.every((l) => !l.differs), JSON.stringify(r.lines));
  const r2 = w2Check({ taxYear: 2026, box1Wages: 3000, box2Federal: 250, box3SsWages: null, box4Ss: 124, box5MedicareWages: null, box6Medicare: 29, box16StateWages: null, box17State: 66, sdi: 26 }, stubs);
  assert.deepEqual(r2.lines.filter((l) => l.differs).map((l) => l.label.slice(0, 10)), ["Gross pay ", "Federal in"]);
  assert.ok(sameEmployer({ employer: "Cast & Crew Payroll", payrollCompany: null }, { employer: "Beast Games LLC", payrollCompany: "Cast & Crew Payroll" }));
  assert.ok(!sameEmployer({ employer: "EP", payrollCompany: null }, { employer: "GreenSlate", payrollCompany: "GreenSlate" }));
});

// ---- the review form ----

test("review form: money parsed, blank lines skipped, work days kept, SSN blanked", () => {
  const f: Record<string, string> = {
    kind: "stub", employer: "Acme 123-45-6789", payDate: "2026-10-16", periodEnd: "2026-10-11", gross: "$1,200.00", net: "900",
    earn_label_0: "ST", earn_kind_0: "regular", earn_hours_0: "16", earn_rate_0: "50", earn_amount_0: "800",
    earn_label_1: "OT", earn_kind_1: "overtime", earn_hours_1: "4", earn_rate_1: "75", earn_amount_1: "300",
    earn_label_2: "", earn_amount_2: "",
    tax_federal: "120", ded_label_0: "Dues", ded_amount_0: "32.60",
  };
  const p = parseStubForm((k) => f[k] ?? null, (k) => (k === "workDay" ? ["e1|2026-10-06", "bad"] : []));
  assert.equal(p.gross, 1200);
  assert.equal(p.employer, "Acme •••-••-••••");
  assert.equal(p.earnings.length, 2);
  assert.equal(p.hours, 20);
  assert.equal(p.taxes.federal, 120);
  assert.equal(p.deductions[0].amount, 32.6);
  assert.deepEqual(p.workDays, ["e1|2026-10-06"]);
  assert.equal(p.periodStart, null);
  assert.equal(p.taxYear, 2026);
});

// ---- stubs still missing ----

test("payers: real bank descriptions name the payroll company; refunds, EDD, transfers never count", () => {
  const p = (description: string, amount = 100) => payerOf({ description, payee: null, amount })?.name ?? null;
  assert.match(p("REV BUSINES SRV PAYROLL PPD ID: 843766818")!, /Revolution/);
  assert.equal(p("GREENSLATE, LLC PAYROLL PPD ID: 7271144329"), "GreenSlate");
  assert.equal(p("Cast and Crew P Payroll"), "Cast & Crew");
  assert.equal(p("GEP PAYROLL SVCS DIRECT PAY PPD ID: 1731692325"), "GEP Payroll Services");
  assert.equal(p("TakeOne E5MXLY3M PAYROLL PPD ID: 9828629003"), "TakeOne");
  assert.equal(p("NEW CAPS LLC PR DEPOSIT PPD ID: 2274217142"), "New Caps LLC");
  assert.equal(p("KILLSWITCH INC PAYROLL PPD ID: 9111111101"), "Killswitch INC");
  assert.match(p("REMOTE ONLINE DEPOSIT # 1")!, /Paper checks/);
  for (const never of ["IRS TREAS 310 TAX REF PPD ID: 9111736959", "California EDD DI Deposit PPD ID: 364483541",
    "FRANCHISE TAX BD CASTTAXRFD", "EXTERNAL TRANSFER DEPOSIT 53F8B9BE83AB6BB", "TakeOne 2Y4XTNDT PAYMENTS PPD ID: 9828629003",
    "Zelle payment from SOMEONE", "Stripe", "Amazon", "EDD UI PAYROLL DEPOSIT", "GREENSLATE PAYROLL REFUND", "ONLINE TRANSFER CHECK DEPOSIT"]) assert.equal(p(never), null, never);
  assert.equal(p("GREENSLATE, LLC PAYROLL", -50), null, "money out is never pay");
});

test("missing stubs: unmatched pay deposits by payer; a matched one drops off; a CSV copy in another account counts once", () => {
  const a = txn({ posted: "2026-06-18", amount: 1960.5, description: "GREENSLATE, LLC PAYROLL PPD ID: 7271144329", accountId: "checking" });
  const copy = txn({ posted: "2026-06-18", amount: 1960.5, description: "GREENSLATE, LLC PAYROLL PPD ID: 7271144329", accountId: "card" });
  const b = txn({ posted: "2026-06-25", amount: 1800, description: "GREENSLATE, LLC PAYROLL PPD ID: 7271144329", accountId: "checking" });
  // Two real checks of the same amount on the same day, in one account: both count.
  const c1 = txn({ posted: "2026-10-18", amount: 1090.35, description: "Online Deposit", accountId: "checking" });
  const c2 = txn({ posted: "2026-10-18", amount: 1090.35, description: "Online Deposit", accountId: "checking" });
  const old = txn({ posted: "2025-12-30", amount: 500, description: "GREENSLATE, LLC PAYROLL", accountId: "checking" });
  const edd = txn({ posted: "2026-02-01", amount: 900, description: "California EDD DI Deposit", accountId: "checking" });
  const s = stub({ depositTxnId: b.id, net: 1800 });
  const out = missingStubs([a, copy, b, c1, c2, old, edd], [s], 2026);
  const gs = out.find((g) => g.key === "greenslate")!;
  assert.deepEqual(gs.deposits.map((d) => d.posted), ["2026-06-18"], "one deposit, not two copies; the matched one is gone");
  assert.equal(gs.total, 1960.5);
  const checks = out.find((g) => g.key === "checks")!;
  assert.equal(checks.deposits.length, 2);
  assert.equal(checks.total, 2180.7);
  assert.equal(out.length, 2, "last year's and EDD's are not listed");
  // Filed by hand as anything but Income (the "Not pay" button): gone. Filed by hand as Income: still listed.
  const settled = txn({ posted: "2026-08-14", amount: 101.22, description: "REMOTE ONLINE DEPOSIT # 1", category: "Other income", categorySource: "manual" });
  const keptPay = txn({ posted: "2026-08-15", amount: 900, description: "REMOTE ONLINE DEPOSIT # 1", category: "Income", categorySource: "manual" });
  assert.deepEqual(missingStubs([settled, keptPay], [], 2026).flatMap((g) => g.deposits.map((d) => d.amount)), [900]);
  // The stub matched to the CSV copy instead still clears it.
  assert.equal(missingStubs([a, copy], [stub({ depositTxnId: copy.id })], 2026).length, 0);
});

// ---- reissued weeks ----

test("reissue: a later stub for the same week that takes back the first check's take-home replaces it", () => {
  const tx = (federal: number, socialSecurity: number, medicare: number, state: number, sdi: number, other: number | null) => ({ ...emptyTaxes(), federal, socialSecurity, medicare, state, sdi, other });
  // Project Goose, week of Apr 19: original, then the union reissue with a NET PRIOR line.
  const a1 = stub({ employer: "Momentum Showdowns, LLC", payDate: "2026-04-30", periodStart: "2026-04-19", periodEnd: "2026-04-25", gross: 2054.54, net: 1589.52, taxes: tx(195.88, 114.98, 26.89, 37.16, 24.11, 66) });
  const a2 = stub({ employer: "Cranetown Media LLC", payDate: "2026-08-14", periodStart: "2026-04-19", periodEnd: "2026-04-25", gross: 2071.98, net: 10.26, taxes: tx(199.72, 116.06, 27.14, 37.94, 24.34, 67), deductions: [{ label: "NET PRIOR", amount: 1589.52 }] });
  // Week of May 17: the reissue doesn't itemize the take-back; gross − taxes − net equals the first check.
  const b1 = stub({ payDate: "2026-05-28", periodStart: "2026-05-17", periodEnd: "2026-05-23", gross: 5645.82, net: 3638.35, taxes: tx(1086.78, 325.6, 76.15, 450.67, 68.27, null) });
  const b2 = stub({ payDate: "2026-08-14", periodStart: "2026-05-17", periodEnd: "2026-05-23", gross: 7735.63, net: 956.59, taxes: tx(1818.21, 455.16, 106.45, 375.43, 95.44, 290), deductions: [] });
  // Same amounts, different weeks (Schooled, Jun 18 and Jul 30): both real.
  const c1 = stub({ payDate: "2026-06-18", periodStart: "2026-05-31", periodEnd: "2026-06-06", gross: 3025, net: 2022.01, taxes: tx(509.35, 187.55, 43.86, 222.9, 39.33, null) });
  const c2 = stub({ payDate: "2026-07-30", periodStart: "2026-07-19", periodEnd: "2026-07-25", gross: 3025, net: 2022.01, taxes: tx(509.35, 187.55, 43.86, 222.9, 39.33, null) });
  // Same week, a later stub that doesn't take this one back (a separate check): both real.
  const d1 = stub({ payDate: "2026-09-03", periodStart: "2026-08-23", periodEnd: "2026-08-29", gross: 1000, net: 777.5 });
  const d2 = stub({ payDate: "2026-09-10", periodStart: "2026-08-23", periodEnd: "2026-08-29", gross: 400, net: 311 , taxes: { ...emptyTaxes(), federal: 89 } });
  const unsaved = stub({ status: "review", payDate: "2026-08-20", periodStart: "2026-04-19", periodEnd: "2026-04-25", gross: 2071.98, net: 10.26, deductions: [{ label: "NET PRIOR", amount: 1589.52 }] });
  // A check from another week with the same take-home as a1: the week has to match, not just the amount.
  const e1 = stub({ payDate: "2026-04-10", periodStart: "2026-03-29", periodEnd: "2026-04-04", gross: 2000, net: 1589.52 });
  // An earlier stub never "replaces" a later one, even when the amounts line up backwards.
  const f1 = stub({ payDate: "2026-09-17", periodStart: "2026-09-06", periodEnd: "2026-09-12", gross: 900, net: 400, taxes: emptyTaxes(), deductions: [{ label: "NET PRIOR", amount: 500 }] });
  const f2 = stub({ payDate: "2026-09-24", periodStart: "2026-09-06", periodEnd: "2026-09-12", gross: 600, net: 500, taxes: { ...emptyTaxes(), federal: 100 } });
  // The NET PRIOR line alone is enough when gross wasn't read.
  const g1 = stub({ payDate: "2026-10-01", periodStart: "2026-09-20", periodEnd: "2026-09-26", gross: 800, net: 640 });
  const g2 = stub({ payDate: "2026-10-15", periodStart: "2026-09-20", periodEnd: "2026-09-26", gross: null, net: 12, deductions: [{ label: "Net Prior", amount: 640 }] });
  const all = [e1, unsaved, a1, a2, b1, b2, c1, c2, d1, d2, f1, f2, g1, g2];
  const r = replacedBy(all);
  assert.deepEqual([...r.entries()].sort(), [[a1.id, a2.id], [b1.id, b2.id], [g1.id, g2.id]].sort());
  const counted = countedStubs(all).map((s) => s.id);
  assert.deepEqual(counted.sort(), [e1, a2, b2, c1, c2, d1, d2, f1, f2, g2].map((s) => s.id).sort(), "originals out; a stub still in review never replaces anything");
  // Withholding counts the reissue's taxes once, not both.
  const est = withholdingEstimate([a1, a2], cfg(), "2026-10-20");
  assert.ok(est, "estimate");
  assert.equal(federalOf(est!), 199.72);
});

function federalOf(e: NonNullable<ReturnType<typeof withholdingEstimate>>): number {
  return e.withheldSoFar;
}

// ---- estimates ----

const taxSum = (t: { taxes: Record<string, number | null> }) => Object.values(t.taxes).reduce<number>((n, v) => n + (v ?? 0), 0);

test("estimates: a later stub's year-to-date gives the missing checks exactly; split by take-home, each balanced", () => {
  // NBCUniversal, Oct 15 2026: the only stub, with the year's YTD.
  const latest = stub({ employer: "Universal City Studios LLC", payDate: "2026-10-15", gross: 2268, net: 1585.57, hours: 40,
    taxes: { ...emptyTaxes(), federal: 332.36, socialSecurity: 140.62, medicare: 32.88, state: 147.09, sdi: 29.48 },
    earnings: [{ label: "STRAIGHT TIME", kind: "regular", hours: 40, rate: 56.7, amount: 2268 }],
    ytd: { gross: 16349.94, net: 11776.16, federal: 2170.14, socialSecurity: 1013.7, medicare: 237.07, state: 940.32, sdi: 212.55, hours: 288.6 } });
  const rest = remainingFromYtd(latest, [latest])!;
  assert.equal(rest.gross, 14081.94);
  assert.equal(rest.net, 10190.59);
  assert.equal(rest.taxes.federal, 1837.78);
  assert.equal(rest.hours, 248.6);
  const checks = [713.36, 1590.56, 1595.59, 1050.26, 1323.77, 1595.57, 735.93, 1585.55];
  assert.equal(Math.round(checks.reduce((n, x) => n + x, 0) * 100) / 100, rest.net, "the bank agrees with the YTD");
  const parts = splitByNet(rest, checks);
  for (const p of parts) assert.ok(Math.abs(p.gross - taxSum(p) - p.net) < 0.005, "each estimate adds up");
  const tot = (f: (t: (typeof parts)[number]) => number) => Math.round(parts.reduce((n, t) => n + f(t), 0) * 100) / 100;
  assert.equal(tot((t) => t.gross), 14081.94);
  assert.equal(tot((t) => t.taxes.federal ?? 0), 1837.78);
  assert.equal(tot((t) => t.taxes.state ?? 0), 793.23);
  assert.equal(Math.round(tot((t) => t.hours) * 10) / 10, 248.6);
  // A stub from another employer, or a later one, isn't subtracted.
  const other = stub({ employer: "Green 16 LLC", payDate: "2026-07-30", gross: 3025, net: 2022.01 });
  const later = stub({ employer: "Universal City Studios LLC", payDate: "2026-10-22", gross: 2268, net: 1585.57 });
  assert.equal(remainingFromYtd(latest, [latest, other, later])!.gross, 14081.94);
});

test("estimates: from the closest saved stubs by take-home, leaving out reissues; gross − taxes = take-home", () => {
  const near1 = stub({ payDate: "2026-06-25", gross: 2420, net: 1678.26, taxes: { ...emptyTaxes(), federal: 364.15, socialSecurity: 150.04, medicare: 35.09, state: 161, sdi: 31.46 } });
  const near2 = stub({ payDate: "2026-07-02", gross: 2860, net: 1928.26, taxes: { ...emptyTaxes(), federal: 469.75, socialSecurity: 177.32, medicare: 41.47, state: 206.02, sdi: 37.18 } });
  const far = stub({ payDate: "2026-04-01", gross: 400, net: 351.12, taxes: { ...emptyTaxes(), federal: 9.04, socialSecurity: 24.8, medicare: 5.8, state: 4.04, sdi: 5.2 } });
  const e = estimateFromSimilar(1769.22, [far, near1, near2], 2)!;
  assert.ok(Math.abs(e.gross - taxSum(e) - e.net) < 0.005);
  const ratio = ((2420 / 1678.26) + (2860 / 1928.26)) / 2;
  assert.ok(Math.abs(e.gross - 1769.22 * ratio) < 0.05, `gross ${e.gross} from the two nearest`);
  // A reissue (tiny take-home after taking back the first check) is never a "similar" stub.
  const orig = stub({ payDate: "2026-04-30", periodStart: "2026-04-19", periodEnd: "2026-04-25", gross: 2054.54, net: 1589.52, taxes: { ...emptyTaxes(), federal: 465.02 } });
  const reissue = stub({ payDate: "2026-08-14", periodStart: "2026-04-19", periodEnd: "2026-04-25", gross: 2071.98, net: 10.26, taxes: { ...emptyTaxes(), federal: 472.2 }, deductions: [{ label: "NET PRIOR", amount: 1589.52 }] });
  const small = estimateFromSimilar(18.29, [orig, reissue, far], 1)!;
  assert.ok(small.gross < 25, `estimated from the $351 stub, not the reissue: ${small.gross}`);
  assert.equal(estimateFromSimilar(0, [far]), null);
});

test("estimates: a real stub for the same check takes the deposit and replaces the estimate", () => {
  const dep = txn({ posted: "2026-09-03", amount: 1595.59, description: "REMOTE ONLINE DEPOSIT # 1" });
  const est = stub({ estimated: true, payDate: "2026-08-27", net: 1595.59, depositTxnId: dep.id, depositMatch: "auto" });
  const real = stub({ payDate: "2026-08-27", net: 1595.59 });
  const r1 = matchDepositsAndEstimates([est, real], [dep]);
  assert.deepEqual(r1.superseded, [est.id]);
  assert.equal(r1.matched.get(real.id), dep.id);
  // An estimate still waiting on a pending deposit goes when the real stub arrives too.
  const est2 = stub({ estimated: true, payDate: "2026-10-08", net: 1585.55 });
  const real2 = stub({ payDate: "2026-10-08", net: 1585.55 });
  assert.deepEqual(matchDepositsAndEstimates([est2, real2], []).superseded, [est2.id]);
  // Without a real stub, an estimate finds its deposit like any stub.
  const r3 = matchDepositsAndEstimates([stub({ estimated: true, payDate: "2026-08-27", net: 1595.59 })], [dep]);
  assert.equal(r3.matched.size, 1);
  assert.equal(r3.superseded.length, 0);
});

// ---- EDD benefits ----

test("EDD: deposits filed as Paid Family Leave count toward the federal estimate; Disability doesn't; neither is wages", () => {
  const pfl1 = txn({ posted: "2026-05-04", amount: 4477.14, description: "California EDD DI Deposit PPD ID: 364483541" });
  const pfl2 = txn({ posted: "2026-06-09", amount: 1790.86, description: "California EDD DI Deposit PPD ID: 364483541" });
  const di = txn({ posted: "2026-01-14", amount: 3362, description: "California EDD DI Deposit PPD ID: 364483541" });
  const notEdd = txn({ posted: "2026-01-14", amount: 50, description: "Zelle from SOMEONE" });
  const pending = txn({ posted: "2026-10-20", amount: 100, description: "California EDD DI Deposit", pending: true });
  const ben = (t: Txn, program: string) => stub({ kind: "benefit", employer: "California EDD", showName: program, payDate: t.posted, taxYear: 2026, gross: t.amount, net: t.amount, taxes: emptyTaxes(), earnings: [], depositTxnId: t.id, depositMatch: "manual" });
  const wage = stub({ payDate: "2026-03-05", gross: 40000, net: 30000, taxes: { ...emptyTaxes(), federal: 3000 } });
  const filed = [ben(pfl1, PFL), ben(pfl2, PFL), ben(di, DI)];
  assert.deepEqual(unfiledEdd([pfl1, pfl2, di, notEdd, pending], [wage, filed[0]]).map((t) => t.id), [di.id, pfl2.id], "unfiled EDD deposits only, oldest first");
  assert.equal(taxableBenefits([...filed, wage], 2026), 6268);
  assert.deepEqual(benefitsByProgram(filed, 2026).map((b) => [b.program, b.total, b.federallyTaxable]), [[PFL, 6268, true], [DI, 3362, false]]);
  const without = withholdingEstimate([wage], cfg({ tax: { ...DEFAULT_CONFIG.tax, filing: "joint", otherWages: 0, otherFederalWithheld: 0 } }), "2026-10-20");
  const withB = withholdingEstimate([wage, ...filed], cfg({ tax: { ...DEFAULT_CONFIG.tax, filing: "joint", otherWages: 0, otherFederalWithheld: 0 } }), "2026-10-20");
  assert.equal(withB.wagesSoFar, 40000, "benefits aren't wages");
  assert.equal(withB.benefits, 6268);
  assert.equal(withB.withheldSoFar, without.withheldSoFar, "nothing withheld on benefits");
  // 40,000 + 6,268 − 32,200 = 14,068 taxable at 10%; 40,000 − 32,200 = 7,800 at 10%.
  assert.equal(withB.scenarios[0].tax - without.scenarios[0].tax, 626.8);
});

// ---- work calendar ----

test("calendar: Sunday-first weeks, padded with nulls; months shift across years", async () => {
  const { monthGrid, shiftCalMonth, isCalMonth, calStatus, monthCounts } = await import("./calendar.ts");
  const oct = monthGrid("2026-10"); // Oct 1 2026 is a Thursday
  assert.equal(oct[0].length, 7);
  assert.deepEqual(oct[0].slice(0, 5), [null, null, null, null, "2026-10-01"]);
  assert.equal(oct.flat().filter(Boolean).length, 31);
  assert.equal(oct.flat().length % 7, 0);
  assert.equal(oct[oct.length - 1].filter(Boolean).pop(), "2026-10-31");
  assert.deepEqual(monthGrid("2026-02")[0][0], "2026-02-01", "Feb 1 2026 is a Sunday: no padding");
  assert.equal(monthGrid("2026-02").flat().filter(Boolean).length, 28);
  const nov = monthGrid("2026-11"); // starts on a Sunday, 30 days: the last week is padded
  assert.equal(nov.length, 5);
  assert.deepEqual(nov[4], ["2026-11-29", "2026-11-30", null, null, null, null, null]);
  assert.equal(shiftCalMonth("2026-01", -1), "2025-12");
  assert.equal(shiftCalMonth("2026-12", 1), "2027-01");
  assert.ok(isCalMonth("2026-10") && !isCalMonth("2026-13") && !isCalMonth(undefined) && !isCalMonth("2026-1"));
  const day = (day: string, status: "paid" | "waiting" | "stub" | "scheduled" | "marked", late = false) => ({ key: day, eventId: "e", day, title: "Show", status, late, ageDays: 0, stubId: null, expected: null });
  assert.equal(calStatus(day("2026-10-01", "waiting", true)), "late");
  assert.equal(calStatus(day("2026-10-01", "waiting")), "waiting");
  assert.equal(calStatus(day("2026-10-01", "paid", true)), "paid", "only a waiting day can be late");
  assert.deepEqual(monthCounts([day("2026-10-01", "paid"), day("2026-10-02", "marked"), day("2026-10-03", "waiting", true), day("2026-09-30", "paid"), day("2026-10-20", "scheduled")], "2026-10"),
    [{ status: "paid", count: 2 }, { status: "late", count: 1 }, { status: "scheduled", count: 1 }]);
});

// ---- .ics import ----

test("ics: all-day ends are exclusive, UTC times land on the Pacific day, repeats and cancellations are left out", async () => {
  const { parseIcs, icsEventId } = await import("./ics.ts");
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT", "UID:a1", "SUMMARY:TAC \\, day 1", "DTSTART;VALUE=DATE:20260914", "DTEND;VALUE=DATE:20260917", "END:VEVENT",
    // 05:00Z on the 20th is 10 PM on the 19th in Pacific (PDT); ends 2 AM Pacific on the 20th.
    "BEGIN:VEVENT", "UID:n1", "SUMMARY:Night shoot", "DTSTART:20260920T050000Z", "DTEND:20260920T090000Z", "BEGIN:VALARM", "TRIGGER:-PT1H", "END:VALARM", "END:VEVENT",
    "BEGIN:VEVENT", "UID:t1", "SUMMARY:Load in", "DTSTART;TZID=America/Los_Angeles:20260922T070000", "DTEND;TZID=America/Los_Angeles:20260923T000000", "END:VEVENT",
    "BEGIN:VEVENT", "UID:r1", "SUMMARY:Gym", "DTSTART;VALUE=DATE:20260901", "RRULE:FREQ=WEEKLY", "END:VEVENT",
    "BEGIN:VEVENT", "UID:c1", "SUMMARY:Cancelled gig", "STATUS:CANCELLED", "DTSTART;VALUE=DATE:20260925", "END:VEVENT",
    "BEGIN:VEVENT", "UID:late", "SUMMARY:After the switch", "DTSTART;VALUE=DATE:20261006", "END:VEVENT",
    "BEGIN:VEVENT", "UID:folded", "SUMMARY:Long", " title", "DTSTART;VALUE=DATE:20260301", "END:VEVENT",
    // A reminder's own SUMMARY isn't the event's; an end at exactly midnight Pacific (07:00Z) stays on the start day.
    "BEGIN:VEVENT", "UID:m1", "BEGIN:VALARM", "SUMMARY:Reminder", "END:VALARM", "SUMMARY:Day call", "DTSTART:20260401T150000Z", "DTEND:20260402T070000Z", "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const r = parseIcs(ics, "2026-01-01", "2026-10-05");
  assert.deepEqual(r.events.map((e) => [e.uid, e.title, e.startDay, e.endDay]), [
    ["folded", "Longtitle", "2026-03-01", "2026-03-01"],
    ["m1", "Day call", "2026-04-01", "2026-04-01"],
    ["a1", "TAC , day 1", "2026-09-14", "2026-09-16"],
    ["n1", "Night shoot", "2026-09-19", "2026-09-20"],
    ["t1", "Load in", "2026-09-22", "2026-09-22"],
  ]);
  assert.deepEqual([r.repeating, r.canceled, r.outside], [1, 1, 1]);
  assert.equal(icsEventId(r.events[2]), "ics:a1|2026-09-14");
});

test("calendar bars: an event's same-status run is one bar; overlapping events stack in lanes", async () => {
  const { weekBars, monthJobs } = await import("./calendar.ts");
  const d = (eventId: string, day: string, status: "paid" | "waiting" | "marked", late = false) => ({ key: `${eventId}|${day}`, eventId, day, title: eventId.toUpperCase(), status, late, ageDays: 0, stubId: null, expected: null });
  const week = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"];
  const days = [
    d("tac", "2026-10-12", "paid"), d("tac", "2026-10-13", "marked"), d("tac", "2026-10-14", "waiting"),
    d("uni", "2026-10-13", "waiting"), d("uni", "2026-10-15", "waiting"),
    d("old", "2026-10-03", "paid"),
  ];
  const bars = weekBars(week, days).map((b) => [b.eventId, b.status, b.col, b.span, b.lane]);
  assert.deepEqual(bars, [
    ["tac", "paid", 1, 2, 0], // Mon-Tue: paid and calendar-marked paid are one bar
    ["uni", "waiting", 2, 1, 1], // Tue overlaps TAC: second lane
    ["tac", "waiting", 3, 1, 0], // Wed: TAC's status changes, a new bar back in lane 0
    ["uni", "waiting", 4, 1, 0], // Thu: not next to Tue, its own bar
  ]);
  assert.deepEqual(weekBars([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"], days).map((b) => [b.eventId, b.col]), [["old", 6]]);
  assert.deepEqual(monthJobs(days, "2026-10").map((j) => [j.eventId, j.days.length]), [["old", 1], ["tac", 3], ["uni", 2]]);
});
