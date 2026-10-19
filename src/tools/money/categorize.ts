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
export const PEOPLE = "Paid to people";
export const INVESTING = "Savings & investing";

/** Categories that are money earned. Money in under any other category is a refund (or a
 *  friend paying back), and is netted against that category's spending, not counted as income. */
export const INCOME_CATEGORIES: ReadonlySet<string> = new Set(["Income", OTHER_INCOME]);

/** Categories offered in the picker, in display order. */
export const CATEGORIES = [
  "Income", OTHER_INCOME, "Groceries", "Dining", "Gas", "Auto", "Shopping", "Subscriptions",
  "Software", "Utilities", "Phone & internet", "Housing", "Loans", "Insurance", "Health", "Travel & camping",
  "Entertainment", "Pets", "Fees", "Cash", PEOPLE, INVESTING, TRANSFER, UNCATEGORIZED,
] as const;

// Keyword → category. Matched as whole words against the normalized description and payee
// (upper case, single spaces), so "MOBIL" no longer matches "US MOBILE" and "WATER" no longer
// matches "STILLWATER" (both real misfilings, 2026-10-18). A keyword also matches with a
// trailing S or 'S ("WENDY" → "WENDY'S"). First match wins, so specific lists come first.
// Built from the owner's real merchants (2026-10-18) plus common US chains.
const KEYWORDS: ReadonlyArray<readonly [category: string, words: readonly string[]]> = [
  // Before Transfer: Zelle's payee reads "Zelle Transfer to …", but paying a person is spending.
  [PEOPLE, ["ZELLE PAYMENT TO", "ZELLE TO", "VENMO PAYMENT", "VENMO", "CASH APP", "SQUARE CASH", "APPLE CASH SENT"]],
  [TRANSFER, [
    "ONLINE TRANSFER", "TRANSFER TO", "TRANSFER FROM", "XFER", "INTERNAL TRANSFER", "ONLINE REALTIME TRANSFER",
    "PAYMENT TO CHASE CARD", "CHASE CREDIT CRD", "AUTOPAY PAYMENT", "CRCARDPMT", "CARD PAYMENT",
    "PAYMENT THANK YOU", "MOBILE PAYMENT - THANK YOU", "U.S. BANK CREDIT", "USBANK CARD",
    "WEB AUTHORIZED PMT U.S. BANK",
    // Marcus savings is Goldman Sachs Bank: "GOLDMAN SACHS BA TRANSFER …" on the Chase side.
    "GOLDMAN SACHS BA", "MARCUS",
  ]],
  ["Income", [
    "PAYROLL", "DIRECT DEP", "DIR DEP", "SALARY", "STRIPE TRANSFER", "STRIPE PAYOUT", "IRS TREAS", "TAX REF",
    // Paper paychecks deposited from a phone (U.S. Bank: "ONLINE DEPOSIT", Chase: "REMOTE ONLINE DEPOSIT").
    "REMOTE ONLINE DEPOSIT", "ONLINE DEPOSIT", "MOBILE DEPOSIT", "CHECK DEPOSIT", "INTEREST PAID",
  ]],
  [INVESTING, ["FIDELITY", "FID BKG", "ROBINHOOD", "VANGUARD", "SCHWAB", "ACORNS", "BETTERMENT", "WEALTHFRONT", "COINBASE", "E*TRADE", "ETRADE"]],
  ["Loans", ["LOGIX", "FCU", "CREDIT UNION", "AUTO LOAN", "LOAN PMT", "LOAN PAYMENT", "NAVIENT", "NELNET", "MOHELA", "SOFI", "AFFIRM", "UPSTART"]],
  ["Housing", ["VALON", "MORTGAGE", "MR COOPER", "ROCKET MORTGAGE", "LOANCARE", "RENT", "RENT PAYMENT", "HOA", "PROPERTY TAX", "HOME DEPOT", "LOWE", "LOWES"]],
  ["Insurance", ["GEICO", "PROGRESSIVE", "STATE FARM", "ALLSTATE", "INSURANCE", "LEMONADE", "FARMERS INS", "STILLWATER", "MERCURY INS", "USAA"]],
  ["Software", [
    "ANTHROPIC", "CLAUDE.AI", "OPENAI", "CHATGPT", "VERCEL", "SUPABASE", "GITHUB", "CLOUDFLARE", "FLY.IO", "FLY IO",
    "APPLE DEVELOPER", "GOOGLE *CLOUD", "GOOGLE CLOUD", "GOOGLE *GSUITE", "GOOGLE WORKSPACE", "TWILIO", "RESEND",
    "NAMECHEAP", "SENTRY", "CANVA", "SIMPLEFIN", "LINK.COM* SIMPLEFIN", "TESTERS COMMUNITY", "CAMPHAWK", "CODEMAGIC",
    "REVENUECAT", "EXPO", "NOTION", "FIGMA", "ADOBE", "DROPBOX", "1PASSWORD",
  ]],
  ["Subscriptions", [
    "NETFLIX", "SPOTIFY", "HULU", "DISNEY PLUS", "DISNEYPLUS", "YOUTUBE", "APPLE.COM/BILL", "PARAMOUNT",
    "MAX.COM", "HBO", "PEACOCK", "AUDIBLE", "PATREON", "AMAZON PRIME", "PRIME VIDEO", "SIRIUSXM", "ICLOUD",
    "TIVIMATE", "SMARTERS", "GOOGLE *PLAY", "GOOGLE PLAY", "CRUNCHYROLL", "APPLE MUSIC", "APPLE TV",
  ]],
  ["Phone & internet", [
    "COMCAST", "XFINITY", "AT&T", "ATT*", "VERIZON", "T-MOBILE", "TMOBILE", "SPECTRUM", "MINT MOBILE", "STARLINK",
    "GOOGLE FI", "US MOBILE", "USMOBILE", "FLUME", "CRICKET", "BOOST MOBILE", "VISIBLE", "FRONTIER", "COX",
  ]],
  ["Utilities", [
    "PG&E", "PGE", "EDISON", "SDG&E", "WATER", "SEWER", "WASTE MGMT", "WASTE MANAGEMENT", "REPUBLIC SERVICES",
    "SOCALGAS", "SO CAL GAS", "SOCAL GAS", "SOUTHERN CALIFORNIA GAS", "SOUTHERN CALIFRONIA GAS", "ELECTRIC", "SUNRUN",
  ]],
  ["Groceries", [
    "SAFEWAY", "TRADER JOE", "WHOLE FOODS", "WHOLEFDS", "KROGER", "RALPHS", "VONS", "VONS.COM", "ALBERTSONS",
    "SPROUTS", "WINCO", "FOOD 4 LESS", "SMART & FINAL", "SMART FINAL", "GROCERY", "SAVE MART", "RALEY", "ALDI",
    "COSTCO WHSE", "WAL-MART SUPERCENTER", "WALMART SUPERCENTER", "STATER BROS", "GELSON", "PAVILIONS",
    "NORTHGATE", "VALLARTA", "H MART", "99 RANCH", "MARKET", "SUPERMARKET", "INSTACART",
  ]],
  ["Dining", [
    "DOORDASH", "UBER EATS", "UBEREATS", "GRUBHUB", "POSTMATES", "STARBUCKS", "DUTCH BROS", "PEET", "COFFEE BEAN",
    "MCDONALD", "CHIPOTLE", "TACO BELL", "IN-N-OUT", "IN N OUT", "CHICK-FIL-A", "SUBWAY", "PANERA", "WENDY",
    "BURGER KING", "CARL'S JR", "CARLS JR", "JACK IN THE BOX", "DEL TACO", "EL POLLO LOCO", "PANDA EXPRESS",
    "WINGSTOP", "DOMINO", "PAPA JOHN", "LITTLE CAESAR", "FIVE GUYS", "SHAKE SHACK", "JERSEY MIKE", "JIMMY JOHN",
    "RUBIO", "RAISING CANE", "POPEYES", "KFC", "ARBY", "SONIC DRIVE", "DAIRY QUEEN", "BASKIN", "COLD STONE",
    "COLDSTONE", "YOGURTLAND", "HANDEL", "JAMBA", "DENNY", "IHOP", "CHILI", "APPLEBEE", "OLIVE GARDEN",
    "CHEESECAKE", "BUFFALO WILD", "DAVE & BUSTERS", "TOMMY", "7-ELEVEN", "AMPM",
    "RESTAURANT", "CAFE", "COFFEE", "PIZZA", "PIZZERIA", "TST*", "SQ *", "GRILL", "TAQUERIA", "TACO", "TACOS",
    "BURRITO", "BURRITOS", "MEXICAN FOOD", "SUSHI", "RAMEN", "PHO", "THAI", "BBQ", "BURGER", "WINGS", "DELI",
    "DINER", "BISTRO", "EATERY", "KITCHEN", "STEAKHOUSE", "TAVERN", "PUB", "SALOON", "CANTINA", "BREWING",
    "BREWERY", "BREWS", "BAR", "BAKERY", "DONUT", "BAGEL", "BOBA", "ICE CREAM", "CREAMERY", "GELATO", "YOGURT",
    "SMOOTHIE", "JUICE", "TEA", "FOOD",
  ]],
  ["Gas", ["SHELL", "CHEVRON", "ARCO", "EXXON", "EXXONMOBIL", "MOBIL", "VALERO", "76", "CIRCLE K", "SINCLAIR", "COSTCO GAS", "FUEL", "SPEEDWAY", "MARATHON"]],
  ["Auto", ["AUTOZONE", "O'REILLY", "OREILLY", "NAPA", "JIFFY LUBE", "DMV", "CARWASH", "CAR WASH", "TESLA SUPERCHARGER", "PARKING", "AUTO PARKS", "FASTRAK", "PEP BOYS", "DISCOUNT TIRE"]],
  ["Health", ["CVS", "WALGREENS", "PHARMACY", "RITE AID", "KAISER", "MEDICAL", "DENTAL", "VISION", "CLINIC", "HOSPITAL"]],
  ["Travel & camping", [
    "RECREATION.GOV", "RECREATION GOV", "RESERVECALIFORNIA", "RESERVE CALIFORNIA", "KOA", "HIPCAMP",
    "AIRBNB", "HOTEL", "MARRIOTT", "HILTON", "LARKSPUR LANDING", "SOUTHWEST", "UNITED AIR", "DELTA AIR", "ALASKA AIR",
    "CAMPGROUND", "RV PARK", "STATE PARK", "NATL PARK", "YOSEMITE", "CAMPING WORLD", "REI",
  ]],
  ["Pets", ["PETCO", "PETSMART", "CHEWY", "VETERINARY", "VET", "ANIMAL HOSP", "BANFIELD"]],
  ["Entertainment", [
    "STEAM", "PLAYSTATION", "XBOX", "NINTENDO", "AMC", "REGAL", "CINEMA", "TICKETMASTER", "EVENTBRITE",
    "GOLF", "GLF*", "GC", "TOPGOLF", "GSPRO", "RAPSODO", "BOWL", "BOWLING", "U7BUY",
  ]],
  ["Shopping", [
    "AMAZON", "AMZN", "TARGET", "WALMART", "WAL-MART", "BEST BUY", "EBAY", "ETSY", "IKEA", "COSTCO", "HARBOR FREIGHT",
    "JOANN", "MICHAELS", "HOBBY LOBBY", "ROSS", "ROSS STORES", "MARSHALLS", "TJ MAXX", "TJMAXX", "HOMEGOODS", "KOHL",
    "OLD NAVY", "NORDSTROM", "MACY", "APPLE.COM/US", "APPLE STORE", "GAMESTOP", "DOLLAR TREE", "99 CENTS", "NIKE",
    "SHEIN", "TEMU", "ALIEXPRESS", "OFFICE DEPOT", "STAPLES", "THRIFTY",
  ]],
  ["Fees", ["FEE WAIVED", "FEE REIMBURSEMENT", "OVERDRAFT", "SERVICE FEE", "MONTHLY FEE", "MAINTENANCE FEE", "INTEREST CHARGE", "LATE FEE", "ATM FEE", "FOREIGN TRANSACTION"]],
  ["Cash", ["ATM WITHDRAWAL", "ATM W/D", "CASH WITHDRAWAL", "WITHDRAWAL AT"]],
];

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alnum = (ch: string) => /[A-Z0-9]/.test(ch);
/** A keyword as a whole word: word edges only where the keyword itself starts or ends with a
 *  letter or digit ("TST*" must still match "TST*JC AND SONS"), plus an optional S or 'S. */
const word = (w: string) => {
  const k = w.trim();
  const lead = alnum(k[0]) ? "(?<![A-Z0-9])" : "";
  const tail = alnum(k[k.length - 1]) ? "(?:'?S)?(?![A-Z0-9])" : "";
  return `${lead}${esc(k)}${tail}`;
};
/** One regex per category: any of its keywords. */
const MATCHERS: ReadonlyArray<readonly [string, RegExp]> = KEYWORDS.map(([c, words]) => [c, new RegExp(words.map(word).join("|"))]);

export { normalize };

/** The keyword category for a description, or null if nothing matches. */
export function keywordCategory(description: string): string | null {
  const d = normalize(description);
  for (const [category, re] of MATCHERS) if (re.test(d)) return category;
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
  // Money in with a spending keyword is a refund ("AMAZON MKTPLACE PMTS +$327"): it keeps the
  // category and nets against it. Money coming back out of savings or a loan, or sent by a person, is still money in.
  if (auto && !(t.amount > 0 && (auto === INVESTING || auto === "Loans" || auto === PEOPLE))) return { category: auto, categorySource: "auto" };
  return { category: t.amount > 0 ? OTHER_INCOME : UNCATEGORIZED, categorySource: "auto" };
}

/**
 * Matches money that left one household account and arrived in another (same amount, opposite
 * sign, within `days` days) and returns each side's counterpart. Bank-to-bank transfers can
 * take four calendar days to land (Chase → U.S. Bank, measured 2026-10-18), hence 5. Each
 * transaction pairs at most once, with the nearest-dated match.
 */
export function matchTransfers(txns: readonly Txn[], days = 5): Map<string, string> {
  const out = new Map<string, string>();
  const outs = txns.filter((t) => t.amount < 0 && !t.pending).sort((a, b) => a.posted.localeCompare(b.posted));
  const ins = txns.filter((t) => t.amount > 0 && !t.pending);
  const used = new Set<string>();
  for (const o of outs) {
    let best: Txn | undefined;
    for (const i of ins) {
      if (used.has(i.id) || i.accountId === o.accountId || Math.abs(i.amount + o.amount) >= 0.005) continue;
      const gap = Math.abs(dayDiff(i.posted, o.posted));
      if (gap > days) continue;
      if (!best || gap < Math.abs(dayDiff(best.posted, o.posted))) best = i;
    }
    if (best) {
      used.add(best.id);
      out.set(o.id, best.id).set(best.id, o.id);
    }
  }
  return out;
}

/** The ids of both sides of every matched transfer. */
export function findTransferPairs(txns: readonly Txn[], days = 5): Set<string> {
  return new Set(matchTransfers(txns, days).keys());
}

/**
 * Refunds nothing recognized by keyword: money in from the same merchant as an earlier charge of
 * at least that much, within `days` days (GSPro −$250 then +$250). Returns refund id → the
 * charge's category. Only money in still filed as Other income / Uncategorized is considered.
 */
export function findRefunds(txns: readonly Txn[], days = 120): Map<string, string> {
  const out = new Map<string, string>();
  const charges = new Map<string, Txn[]>();
  for (const t of txns) {
    if (t.amount >= 0 || t.pending) continue;
    const k = merchantKey(t.payee || t.description);
    if (k) (charges.get(k) ?? charges.set(k, []).get(k)!).push(t);
  }
  const used = new Set<string>();
  for (const t of [...txns].sort((a, b) => a.posted.localeCompare(b.posted))) {
    if (t.amount <= 0 || t.pending || (t.category !== OTHER_INCOME && t.category !== UNCATEGORIZED)) continue;
    const list = charges.get(merchantKey(t.payee || t.description));
    if (!list) continue;
    const c = list
      .filter((x) => !used.has(x.id) && x.posted <= t.posted && dayDiff(t.posted, x.posted) <= days && -x.amount >= t.amount - 0.005)
      .sort((a, b) => Math.abs(a.amount + t.amount) - Math.abs(b.amount + t.amount) || b.posted.localeCompare(a.posted))[0];
    if (!c) continue;
    used.add(c.id);
    out.set(t.id, c.category && c.category !== TRANSFER ? c.category : UNCATEGORIZED);
  }
  return out;
}

export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}
