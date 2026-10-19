import { countsAsHours, noSsn } from "./read.ts";
import { TAX_KEYS, emptyTaxes, emptyW2, emptyYtd, type Earning, type EarningKind, type Stub, type W2, type Ytd } from "./types.ts";

/** The review form's field names, and turning a submitted form back into stub fields. Pure. */

export const EARNING_KINDS: Array<[EarningKind, string]> = [
  ["regular", "Straight time"], ["overtime", "Overtime 1.5×"], ["double_time", "Double time 2×"], ["meal_penalty", "Meal penalty"],
  ["holiday", "Holiday pay"], ["vacation", "Vacation pay"], ["kit_rental", "Kit / box rental"], ["reimbursement", "Reimbursement"], ["other", "Other"],
];
export const YTD_KEYS = ["gross", "net", "federal", "socialSecurity", "medicare", "state", "sdi", "hours"] as const satisfies ReadonlyArray<keyof Ytd>;
export const W2_FIELDS: Array<[keyof W2, string]> = [
  ["taxYear", "Tax year"], ["box1Wages", "Box 1 wages"], ["box2Federal", "Box 2 federal tax"], ["box3SsWages", "Box 3 Social Security wages"],
  ["box4Ss", "Box 4 Social Security tax"], ["box5MedicareWages", "Box 5 Medicare wages"], ["box6Medicare", "Box 6 Medicare tax"],
  ["box16StateWages", "Box 16 state wages"], ["box17State", "Box 17 state tax"], ["sdi", "CA SDI (box 14)"],
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const parseMoney = (v: string | null | undefined): number | null => {
  if (v == null) return null;
  const s = v.replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(Math.abs(n) * 100) / 100 : null;
};
const text = (v: string | null | undefined, max = 120) => noSsn((v ?? "").trim().slice(0, max));

type Get = (name: string) => string | null;

export function parseStubForm(get: Get, getAll: (name: string) => string[]): Omit<Stub, "id" | "createdAt" | "status" | "depositTxnId" | "depositMatch" | "readError"> {
  const kind = get("kind") === "w2" ? "w2" : "stub";
  const date = (k: string) => { const v = (get(k) ?? "").trim(); return DATE.test(v) ? v : null; };
  const taxes = emptyTaxes();
  for (const k of TAX_KEYS) taxes[k] = parseMoney(get(`tax_${k}`));
  const ytd = emptyYtd();
  for (const k of YTD_KEYS) ytd[k] = parseMoney(get(`ytd_${k}`));
  const earnings: Earning[] = [];
  for (let i = 0; i < 40; i++) {
    const amount = parseMoney(get(`earn_amount_${i}`));
    const label = text(get(`earn_label_${i}`), 60);
    if (amount === null && !label) continue;
    if (amount === null) continue;
    const kindRaw = get(`earn_kind_${i}`) as EarningKind | null;
    earnings.push({
      label: label ?? "Pay",
      kind: EARNING_KINDS.some(([k]) => k === kindRaw) ? kindRaw! : "other",
      hours: parseMoney(get(`earn_hours_${i}`)),
      rate: parseMoney(get(`earn_rate_${i}`)),
      amount,
    });
  }
  const deductions: Array<{ label: string; amount: number }> = [];
  for (let i = 0; i < 30; i++) {
    const amount = parseMoney(get(`ded_amount_${i}`));
    if (amount === null) continue;
    deductions.push({ label: text(get(`ded_label_${i}`), 60) ?? "Deduction", amount });
  }
  let w2: W2 | null = null;
  if (kind === "w2") {
    w2 = emptyW2();
    for (const [k] of W2_FIELDS) {
      const v = parseMoney(get(`w2_${k}`));
      (w2 as Record<keyof W2, number | null>)[k] = k === "taxYear" ? (v ? Math.round(v) : null) : v;
    }
  }
  const payDate = date("payDate");
  const worked = earnings.reduce((n, e) => n + (countsAsHours(e.kind) && e.hours ? e.hours : 0), 0);
  return {
    kind,
    employer: text(get("employer")),
    payrollCompany: text(get("payrollCompany")),
    showName: text(get("showName")),
    payDate,
    periodStart: date("periodStart"),
    periodEnd: date("periodEnd"),
    taxYear: w2?.taxYear ?? (payDate ? Number(payDate.slice(0, 4)) : null),
    gross: parseMoney(get("gross")),
    net: parseMoney(get("net")),
    hours: worked ? Math.round(worked * 100) / 100 : parseMoney(get("hours")),
    checkNumber: text(get("checkNumber"), 20),
    taxes,
    deductions,
    earnings,
    ytd,
    w2,
    workDays: getAll("workDay").filter((k) => /^.{1,400}\|\d{4}-\d{2}-\d{2}$/.test(k)).slice(0, 60),
    notes: text(get("notes"), 500),
  };
}
