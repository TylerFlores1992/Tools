import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import type { Txn } from "../types.ts";
import { calendarScript, calendarScriptTemplate, KEY_PLACEHOLDER, URL_PLACEHOLDER } from "./calendar-script.ts";
import { dayPay, previousStub, sameEmployer, stubChecks, workedHours } from "./checks.ts";
import { parseStubForm } from "./form.ts";
import { healthPeriods } from "./health.ts";
import { findDeposit, matchDeposits } from "./match.ts";
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
  const ctx = {
    console: { log() {} },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create() {} }) }) }) }) },
    CalendarApp: { getDefaultCalendar: () => ({ getEvents: () => [mk("w1", "TAC", "6", "2026-09-14", "2026-09-19"), mk("x", "Dentist", "", "2026-09-20", "2026-09-21"), mk("p1", "Uni", "11", "2026-10-12", "2026-10-13")] }) },
    Session: { getScriptTimeZone: () => "UTC" },
    Utilities: { sleep() {}, formatDate: (d: Date) => d.toISOString().slice(0, 10) },
    UrlFetchApp: {
      fetch: (_u: string, o: { payload: string; headers: { Authorization: string } }) => {
        const p = JSON.parse(o.payload);
        calls.push(p);
        assert.equal(o.headers.Authorization, "Bearer k3y");
        const body = p.op === "hello" ? { from: "2026-01-01T00:00:00", to: "2026-12-19T00:00:00", colors: ["6", "11"] } : p.op === "events" ? { recolor: ["w1|2026-09-14", "missing|2026-01-01"], paidColor: "11" } : { ok: true };
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
