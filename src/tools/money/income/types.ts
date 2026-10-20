// Shapes for Money → Income: pay stubs, W-2s and the work calendar. Pure, shared with server code.

export type EarningKind =
  | "regular" | "overtime" | "double_time" | "meal_penalty" | "holiday" | "vacation" | "kit_rental" | "reimbursement" | "other";

export type Earning = { label: string; kind: EarningKind; hours: number | null; rate: number | null; amount: number };

export type Taxes = {
  federal: number | null;
  socialSecurity: number | null;
  medicare: number | null;
  state: number | null;
  sdi: number | null;
  local: number | null;
  other: number | null;
};

export const TAX_KEYS = ["federal", "socialSecurity", "medicare", "state", "sdi", "local", "other"] as const satisfies ReadonlyArray<keyof Taxes>;
export const TAX_LABEL: Record<keyof Taxes, string> = {
  federal: "Federal income tax",
  socialSecurity: "Social Security",
  medicare: "Medicare",
  state: "CA income tax",
  sdi: "CA SDI",
  local: "Local tax",
  other: "Other tax",
};

export type Ytd = {
  gross: number | null;
  net: number | null;
  federal: number | null;
  socialSecurity: number | null;
  medicare: number | null;
  state: number | null;
  sdi: number | null;
  hours: number | null;
};

/** The W-2 boxes worth checking. Box numbers in the names so the review form can say "Box 1". */
export type W2 = {
  taxYear: number | null;
  box1Wages: number | null;
  box2Federal: number | null;
  box3SsWages: number | null;
  box4Ss: number | null;
  box5MedicareWages: number | null;
  box6Medicare: number | null;
  box16StateWages: number | null;
  box17State: number | null;
  sdi: number | null; // usually in box 14 as "CASDI"
};

export type StubStatus = "reading" | "review" | "saved" | "failed";

export type Stub = {
  id: string;
  /** "benefit": an EDD payment (Paid Family Leave or Disability Insurance), filed from a bank deposit (benefits.ts). */
  kind: "stub" | "w2" | "benefit";
  status: StubStatus;
  employer: string | null;
  payrollCompany: string | null;
  showName: string | null;
  payDate: string | null; // YYYY-MM-DD
  periodStart: string | null;
  periodEnd: string | null;
  taxYear: number | null;
  gross: number | null;
  net: number | null;
  hours: number | null;
  checkNumber: string | null;
  taxes: Taxes;
  deductions: Array<{ label: string; amount: number }>;
  earnings: Earning[];
  ytd: Ytd;
  w2: W2 | null;
  workDays: string[]; // "<event id>|YYYY-MM-DD"
  notes: string | null;
  readError: string | null;
  depositTxnId: string | null;
  depositMatch: "auto" | "manual" | "none" | null;
  /** Not read from a stub: worked out from another stub's year-to-date or similar stubs (estimate.ts). */
  estimated?: boolean;
  createdAt: string;
};

export type WorkEvent = { eventId: string; title: string; startDay: string; endDay: string; color: string | null; recoloredAt: string | null };

export type Rate = { employer: string; rate: number };

export type IncomeConfig = {
  /** Google Calendar colour ids: 6 = Tangerine (worked), 11 = Tomato (paid). */
  workColor: string;
  paidColor: string;
  recolor: boolean;
  /** Days after a work day before missing pay counts as late. */
  payLagDays: number;
  defaultHoursPerDay: number;
  rates: Rate[];
  defaultRate: number | null;
  health: { name: string; hoursPerPeriod: number; periodMonths: number; firstMonth: number; bankCap: number };
  tax: { filing: "single" | "joint"; otherWages: number; otherFederalWithheld: number; overtimeDeduction: boolean };
};

export const DEFAULT_CONFIG: IncomeConfig = {
  workColor: "6",
  paidColor: "11",
  recolor: true,
  payLagDays: 14,
  defaultHoursPerDay: 10,
  rates: [],
  defaultRate: null,
  health: { name: "Health plan", hoursPerPeriod: 400, periodMonths: 6, firstMonth: 1, bankCap: 450 },
  tax: { filing: "joint", otherWages: 0, otherFederalWithheld: 0, overtimeDeduction: false },
};

export function withDefaults(raw: unknown): IncomeConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<IncomeConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...r,
    rates: Array.isArray(r.rates) ? r.rates.filter((x) => x && typeof x.employer === "string" && Number.isFinite(x.rate)) : [],
    health: { ...DEFAULT_CONFIG.health, ...(r.health ?? {}) },
    tax: { ...DEFAULT_CONFIG.tax, ...(r.tax ?? {}) },
  };
}

export const emptyTaxes = (): Taxes => ({ federal: null, socialSecurity: null, medicare: null, state: null, sdi: null, local: null, other: null });
export const emptyYtd = (): Ytd => ({ gross: null, net: null, federal: null, socialSecurity: null, medicare: null, state: null, sdi: null, hours: null });
export const emptyW2 = (): W2 => ({
  taxYear: null, box1Wages: null, box2Federal: null, box3SsWages: null, box4Ss: null,
  box5MedicareWages: null, box6Medicare: null, box16StateWages: null, box17State: null, sdi: null,
});
