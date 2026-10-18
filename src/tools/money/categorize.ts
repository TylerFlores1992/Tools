import { merchantKey } from "./merchant.ts";
import { normalize } from "./normalize.ts";
import type { CategorySource, Rule, Txn } from "./types.ts";

/**
 * Sorting transactions into categories. Order of authority:
 *   1. manual — the owner picked it on a transaction; a re-sync never overwrites it.
 *   2. rule   — the owner said "always file <text> as <category>" (money.rules).
 *   3. auto   — the keyword list below, then a fallback by sign.
 * Transfers between the household's own accounts are excluded from money in / money out.
 */

export const TRANSFER = "Transfer";
export const UNCATEGORIZED = "Uncategorized";
export const OTHER_INCOME = "Other income";

/** Categories offered in the picker, in display order. */
export const CATEGORIES = [
  "Income", OTHER_INCOME, "Groceries", "Dining", "Gas", "Auto", "Shopping", "Subscriptions",
  "Software", "Utilities", "Phone & internet", "Housing", "Insurance", "Health", "Travel & camping",
  "Entertainment", "Pets", "Fees", "Cash", TRANSFER, UNCATEGORIZED,
] as const;

// Keyword → category. Matched against the normalized description (upper case, single spaces).
// First match wins, so more specific entries come before broader ones.
const KEYWORDS: ReadonlyArray<readonly [category: string, words: readonly string[]]> = [
  [TRANSFER, [
    "ONLINE TRANSFER", "TRANSFER TO", "TRANSFER FROM", "XFER", "INTERNAL TRANSFER",
    "PAYMENT TO CHASE CARD", "CHASE CREDIT CRD", "AUTOPAY PAYMENT", "CRCARDPMT", "CARD PAYMENT",
    "PAYMENT THANK YOU", "MOBILE PAYMENT - THANK YOU", "U.S. BANK CREDIT", "USBANK CARD",
  ]],
  ["Income", ["PAYROLL", "DIRECT DEP", "DIR DEP", "SALARY", "STRIPE TRANSFER", "STRIPE PAYOUT", "IRS TREAS", "TAX REF"]],
  ["Software", [
    "ANTHROPIC", "CLAUDE.AI", "OPENAI", "CHATGPT", "VERCEL", "SUPABASE", "GITHUB", "CLOUDFLARE",
    "APPLE DEVELOPER", "GOOGLE *CLOUD", "GOOGLE CLOUD", "TWILIO", "RESEND", "NAMECHEAP", "SENTRY",
  ]],
  ["Subscriptions", [
    "NETFLIX", "SPOTIFY", "HULU", "DISNEY PLUS", "DISNEYPLUS", "YOUTUBE", "APPLE.COM/BILL", "PARAMOUNT",
    "MAX.COM", "HBO", "PEACOCK", "AUDIBLE", "PATREON", "AMAZON PRIME", "PRIME VIDEO", "SIRIUSXM", "ICLOUD",
  ]],
  ["Groceries", [
    "SAFEWAY", "TRADER JOE", "WHOLE FOODS", "WHOLEFDS", "KROGER", "RALPHS", "VONS", "ALBERTSONS",
    "SPROUTS", "WINCO", "FOOD 4 LESS", "SMART & FINAL", "GROCERY", "SAVE MART", "RALEY", "ALDI", "COSTCO WHSE",
    "WAL-MART SUPERCENTER", "WALMART SUPERCENTER",
  ]],
  ["Dining", [
    "DOORDASH", "UBER EATS", "UBEREATS", "GRUBHUB", "STARBUCKS", "DUTCH BROS", "MCDONALD", "CHIPOTLE",
    "TACO BELL", "IN-N-OUT", "IN N OUT", "CHICK-FIL-A", "SUBWAY", "PANERA", "WENDY", "BURGER KING",
    "RESTAURANT", "CAFE", "COFFEE", "PIZZA", "TST*", "SQ *", "GRILL", "TAQUERIA", "BAR & GRILL", "DENNY",
  ]],
  ["Gas", ["SHELL", "CHEVRON", "ARCO", "EXXON", "MOBIL", "VALERO", "76 ", "CIRCLE K", "SINCLAIR", "COSTCO GAS", "FUEL"]],
  ["Auto", ["AUTOZONE", "O'REILLY", "OREILLY", "NAPA", "JIFFY LUBE", "DMV", "CARWASH", "CAR WASH", "TESLA SUPERCHARGER", "PARKING", "FASTRAK"]],
  ["Phone & internet", ["COMCAST", "XFINITY", "AT&T", "ATT*", "VERIZON", "T-MOBILE", "TMOBILE", "SPECTRUM", "MINT MOBILE", "STARLINK", "GOOGLE FI"]],
  ["Utilities", ["PG&E", "PGE", "EDISON", "SDG&E", "WATER", "SEWER", "WASTE MGMT", "REPUBLIC SERVICES", "SOCALGAS", "SO CAL GAS", "ELECTRIC"]],
  ["Housing", ["RENT", "MORTGAGE", "HOA", "PROPERTY TAX", "HOME DEPOT", "LOWE'S", "LOWES"]],
  ["Insurance", ["GEICO", "PROGRESSIVE", "STATE FARM", "ALLSTATE", "INSURANCE", "LEMONADE", "FARMERS INS"]],
  ["Health", ["CVS", "WALGREENS", "PHARMACY", "RITE AID", "KAISER", "MEDICAL", "DENTAL", "VISION", "CLINIC", "HOSPITAL"]],
  ["Travel & camping", [
    "RECREATION.GOV", "RECREATION GOV", "RESERVECALIFORNIA", "RESERVE CALIFORNIA", "KOA", "HIPCAMP",
    "AIRBNB", "HOTEL", "MARRIOTT", "HILTON", "SOUTHWEST", "UNITED AIR", "DELTA AIR", "ALASKA AIR",
    "CAMPGROUND", "RV PARK", "STATE PARK", "NATL PARK", "CAMPING WORLD", "REI ",
  ]],
  ["Pets", ["PETCO", "PETSMART", "CHEWY", "VETERINARY", "VET ", "ANIMAL HOSP", "BANFIELD"]],
  ["Entertainment", ["STEAM", "PLAYSTATION", "XBOX", "NINTENDO", "AMC ", "REGAL", "CINEMA", "TICKETMASTER", "EVENTBRITE"]],
  ["Shopping", ["AMAZON", "AMZN", "TARGET", "WALMART", "WAL-MART", "BEST BUY", "EBAY", "ETSY", "IKEA", "COSTCO", "HARBOR FREIGHT", "JOANN", "MICHAELS", "HOBBY LOBBY"]],
  ["Fees", ["OVERDRAFT", "SERVICE FEE", "MONTHLY FEE", "MAINTENANCE FEE", "INTEREST CHARGE", "LATE FEE", "ATM FEE", "FOREIGN TRANSACTION"]],
  ["Cash", ["ATM WITHDRAWAL", "ATM W/D", "CASH WITHDRAWAL", "WITHDRAWAL AT"]],
];

export { normalize };

/** The keyword category for a description, or null if nothing matches. */
export function keywordCategory(description: string): string | null {
  const d = ` ${normalize(description)} `;
  for (const [category, words] of KEYWORDS) {
    if (words.some((w) => d.includes(w.endsWith(" ") ? ` ${w}` : w))) return category;
  }
  return null;
}

/**
 * Owner rules: case-insensitive "contains", checked against the description as written and its
 * merchant key (so a rule saved as "NETFLIX COM" matches "NETFLIX.COM 866-579-7172").
 * Longest pattern wins (most specific).
 */
export function ruleCategory(description: string, rules: readonly Rule[]): string | null {
  const d = normalize(description);
  const k = merchantKey(description);
  let best: Rule | null = null;
  for (const r of rules) {
    const p = normalize(r.pattern);
    if (p && (d.includes(p) || k.includes(p)) && (!best || p.length > normalize(best.pattern).length)) best = r;
  }
  return best?.category ?? null;
}

/** The category a transaction should have now, given its current one and the rules. */
export function categorize(
  t: Pick<Txn, "description" | "payee" | "amount" | "category" | "categorySource">,
  rules: readonly Rule[],
): { category: string; categorySource: CategorySource } {
  if (t.categorySource === "manual" && t.category) return { category: t.category, categorySource: "manual" };
  const text = [t.description, t.payee].filter(Boolean).join(" ");
  const ruled = ruleCategory(text, rules);
  if (ruled) return { category: ruled, categorySource: "rule" };
  const auto = keywordCategory(text);
  // A keyword like "COFFEE" on a deposit is a refund or a sale, not dining income.
  if (auto && !(t.amount > 0 && auto !== "Income" && auto !== TRANSFER)) return { category: auto, categorySource: "auto" };
  return { category: t.amount > 0 ? OTHER_INCOME : UNCATEGORIZED, categorySource: "auto" };
}

/**
 * Matches money that left one household account and arrived in another (same amount, opposite
 * sign, within `days` days) and returns the ids of both sides. Used to mark transfers the
 * keyword list missed, so moving $500 from Chase to U.S. Bank isn't counted as spending.
 * Each transaction pairs at most once.
 */
export function findTransferPairs(txns: readonly Txn[], days = 3): Set<string> {
  const out = new Set<string>();
  const outs = txns.filter((t) => t.amount < 0 && !t.pending).sort((a, b) => a.posted.localeCompare(b.posted));
  const ins = txns.filter((t) => t.amount > 0 && !t.pending);
  const used = new Set<string>();
  for (const o of outs) {
    const match = ins.find((i) =>
      !used.has(i.id) &&
      i.accountId !== o.accountId &&
      Math.abs(i.amount + o.amount) < 0.005 &&
      Math.abs(dayDiff(i.posted, o.posted)) <= days,
    );
    if (match) {
      used.add(match.id);
      out.add(o.id).add(match.id);
    }
  }
  return out;
}

export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}
