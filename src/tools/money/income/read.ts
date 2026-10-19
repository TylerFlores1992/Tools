import { z } from "zod";
import { emptyTaxes, emptyW2, emptyYtd, type Earning, type EarningKind, type Stub, type Taxes, type W2, type Ytd } from "./types.ts";

/**
 * What the AI is asked to read off a pay stub or W-2 photo, and how its answer becomes a stub.
 * The model only ever proposes: every value lands on a review screen and nothing is counted until
 * the owner saves it. Social Security numbers are never asked for, and anything shaped like one
 * is blanked out of every text field before it is stored (`noSsn`).
 */

const money = z.number().nullable().describe("Dollars as a plain number (1234.56), null if not on the document");

export const READ_SCHEMA = z.object({
  documentType: z.enum(["pay_stub", "w2", "other"]),
  employer: z.string().nullable().describe("The employer as printed (often the payroll company is the employer of record)"),
  payrollCompany: z.string().nullable().describe("Payroll service if shown, e.g. Cast & Crew, Entertainment Partners, GreenSlate, Revolution"),
  showName: z.string().nullable().describe("Production, show or event name if shown"),
  payDate: z.string().nullable().describe("Check or pay date, YYYY-MM-DD"),
  periodStart: z.string().nullable().describe("Pay period / week start, YYYY-MM-DD"),
  periodEnd: z.string().nullable().describe("Pay period end or week ending, YYYY-MM-DD"),
  checkNumber: z.string().nullable(),
  grossPay: money,
  netPay: money,
  earnings: z.array(z.object({
    label: z.string().describe("The line as printed, e.g. 'Straight Time', 'OT 1.5', 'Meal Penalty'"),
    kind: z.enum(["regular", "overtime", "double_time", "meal_penalty", "holiday", "vacation", "kit_rental", "reimbursement", "other"]),
    hours: z.number().nullable(),
    rate: z.number().nullable(),
    amount: z.number(),
  })).describe("Current-period earnings lines only, not year-to-date"),
  taxes: z.object({
    federal: money, socialSecurity: money.describe("OASDI / FICA SS"), medicare: money,
    state: money.describe("State income tax withheld (CA SIT/PIT)"), sdi: money.describe("CA SDI / VPDI"),
    local: money, other: money,
  }).describe("Current-period employee taxes withheld"),
  deductions: z.array(z.object({ label: z.string(), amount: z.number() })).describe("Current-period employee deductions other than taxes (union dues, 401k, garnishments)"),
  ytd: z.object({
    gross: money, net: money, federal: money, socialSecurity: money, medicare: money, state: money, sdi: money,
    hours: z.number().nullable(),
  }).describe("Year-to-date column, if the stub has one"),
  w2: z.object({
    taxYear: z.number().nullable(),
    box1Wages: money, box2Federal: money, box3SsWages: money, box4Ss: money,
    box5MedicareWages: money, box6Medicare: money, box16StateWages: money, box17State: money,
    sdi: money.describe("CA SDI from box 14 if listed"),
  }).nullable().describe("Only for a W-2"),
  unsure: z.array(z.string()).describe("Short notes on anything blurry, cut off or ambiguous"),
});

export type ReadResult = z.infer<typeof READ_SCHEMA>;

export const READ_PROMPT = [
  "This is a photo or PDF of a US pay stub (check stub) or a W-2, for a stagehand paid by entertainment payroll companies.",
  "Read it exactly as printed. Never guess a number: use null when a value is missing or unreadable, and say so in `unsure`.",
  "Dates as YYYY-MM-DD. Money as plain numbers without $ or commas. Withheld amounts as positive numbers.",
  "Earnings lines: current period only (not YTD). Classify each line's kind: straight time = regular, 1.5x = overtime,",
  "2x = double_time, meal penalties = meal_penalty, holiday/vacation pay (often a percentage line) = holiday or vacation.",
  "Do NOT return any Social Security number, bank account number or full address anywhere.",
].join(" ");

const SSN = /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g;
const ACCT = /\b\d{9,17}\b/g;
/** Blanks anything shaped like an SSN or a bank account number. */
export const noSsn = (s: string | null | undefined): string | null =>
  s == null ? null : s.replace(SSN, "•••-••-••••").replace(ACCT, "••••").trim() || null;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const day = (s: string | null | undefined): string | null => (s && DATE.test(s) && !Number.isNaN(Date.parse(s)) ? s : null);
const num = (n: number | null | undefined): number | null => (typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) / 100 : null);
const pos = (n: number | null | undefined): number | null => { const v = num(n); return v === null ? null : Math.abs(v); };

/** The model's answer → stub fields (kind, dates, money cleaned; SSN-shaped text blanked). */
export function fromRead(r: ReadResult): Partial<Stub> & { kind: "stub" | "w2"; warnings: string[] } {
  const warnings = (r.unsure ?? []).map((u) => noSsn(u)!).filter(Boolean).slice(0, 8);
  if (r.documentType === "other") warnings.unshift("This doesn't look like a pay stub or W-2. Check what was read before saving.");
  const taxes: Taxes = { ...emptyTaxes() };
  for (const k of Object.keys(taxes) as Array<keyof Taxes>) taxes[k] = pos(r.taxes?.[k]);
  const ytd: Ytd = { ...emptyYtd() };
  for (const k of Object.keys(ytd) as Array<keyof Ytd>) ytd[k] = pos(r.ytd?.[k]);
  const earnings: Earning[] = (r.earnings ?? [])
    .map((e) => ({ label: noSsn(e.label) ?? "Pay", kind: e.kind as EarningKind, hours: num(e.hours), rate: num(e.rate), amount: num(e.amount) ?? 0 }))
    .slice(0, 30);
  let w2: W2 | null = null;
  if (r.documentType === "w2" && r.w2) {
    w2 = { ...emptyW2() };
    for (const k of Object.keys(w2) as Array<keyof W2>) w2[k] = k === "taxYear" ? (r.w2.taxYear ?? null) : pos(r.w2[k]);
  }
  const hours = earnings.reduce((n, e) => n + (countsAsHours(e.kind) && e.hours ? e.hours : 0), 0);
  return {
    kind: r.documentType === "w2" ? "w2" : "stub",
    employer: noSsn(r.employer),
    payrollCompany: noSsn(r.payrollCompany),
    showName: noSsn(r.showName),
    payDate: day(r.payDate),
    periodStart: day(r.periodStart),
    periodEnd: day(r.periodEnd),
    checkNumber: r.checkNumber ? r.checkNumber.replace(/[^\w-]/g, "").slice(0, 20) || null : null,
    gross: pos(r.grossPay),
    net: pos(r.netPay),
    hours: hours ? Math.round(hours * 100) / 100 : null,
    taxes,
    deductions: (r.deductions ?? []).map((d) => ({ label: noSsn(d.label) ?? "Deduction", amount: pos(d.amount) ?? 0 })).slice(0, 20),
    earnings,
    ytd,
    w2,
    taxYear: w2?.taxYear ?? (day(r.payDate) ? Number(r.payDate!.slice(0, 4)) : null),
    warnings,
  };
}

/** Hours that are time worked (meal penalties, kit rental and vacation/holiday pay are money, not hours). */
export const countsAsHours = (k: EarningKind) => k === "regular" || k === "overtime" || k === "double_time";
