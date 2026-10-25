import { clip, parseFrom, parseUnsubscribe, senderLabel, type Sender } from "./headers.ts";
import type { Classified, IncomingMail, Rule } from "./types.ts";

/**
 * Sorting one email, deterministically. No model: every rule is a pattern a person can read and
 * a test pins. The order of the checks is the policy:
 *   1. the owner's own rules (`important` forces "needs you", `hide` drops it from the report);
 *   2. likely junk (forged-looking names and subjects, template leftovers, known scam shapes);
 *   3. security (sign-ins, new devices, password changes, breaches);
 *   4. needs you (bills, things expiring, requests, a person writing);
 *   5. updates (receipts, deliveries, order and account notices: worth a glance, never a task);
 *   6. bulk (anything with List-Unsubscribe or a marketing sender);
 *   7. other (counted, not listed).
 * A wrong "needs you" costs a glance; a security alert filed as bulk costs much more, so security
 * is checked before anything that could swallow it. Junk comes first because a scam dressed as a
 * security alert must not reach the security list, and no real alert carries those signs.
 */

// Strong words count anywhere in the email. Weak ones ("sign in", "log in") are in the footer of
// half the mail anyone gets ("Log in to view your statement"), so they count only in a subject.
const SECURITY_STRONG = /\b(new device|security (alert|notice|code)|unusual (activity|sign)|suspicious|password (was |has been )?(changed|reset)|reset your password|app password|verification code|one[- ]time (pass)?code|two[- ]factor|2-step|2fa|data breach|breach(ed)?|compromised|confirm (it was|that it'?s) you|was this you|account (locked|access|recovery)|new (login|sign[- ]in)|security key|passkey)\b/i;
const SECURITY_WEAK = /\b(sign[- ]?in|signed in|log[- ]?in|logged in)\b/i;
const SECURITY_URGENT = /\b(unusual|suspicious|breach(ed)?|compromised|locked|wasn'?t you|not you|unrecognized|unknown device|blocked)\b/i;
const CODE_ONLY = /\b(verification|security|one[- ]time|login|sign[- ]in) code\b|\bcode is\b|\byour code\b/i;
// Google sends the account's recovery address a copy of every alert. The real one is in the
// other inbox; the copy is information.
const ALERT_COPY = /\bthis is a copy of a security alert\b/i;

const BILL = /\b(bill|statement) (is )?(ready|available|due)|\byour [\w&'-]+ (bill|statement)\b|\bpayment (is )?(due|failed|declined|reminder|scheduled)|\bamount due\b|\bpast due\b|\bdue (on|by|date|soon|tomorrow|today)\b|\bautopay\b|\binvoice (is )?(due|ready|available|attached|#)|\bminimum payment\b|\btrue-?up\b/i;
const BILL_URGENT = /\b(failed|declined|past due|overdue|final notice|returned payment|insufficient funds|late fee)\b/i;
const EXPIRING = /\bexpire[sd]?\b|\bexpir(ing|ation)\b|\brenew(al|s)?\b|\bends (on|soon|today|tomorrow)\b|\b(will be )?suspended\b|\bcancell?ation\b|\baction (required|needed)\b|\bplease (confirm|respond|review|verify)\b|\bresponse (requested|needed)\b|\bdeadline\b|\blast chance to (renew|keep)\b/i;
const EXPIRING_URGENT = /\b(final|today|tomorrow|suspended|expired|immediately|urgent)\b/i;
// Someone asking for something by name, even from a shared work address.
const REQUEST = /\b(invitation|access|meeting|visit|approval|signature|time[- ]off) request\b|\brequest(s|ed)? (for )?your (approval|signature|review)\b|\bplease sign\b|\bsignature (needed|required)\b/i;

// Receipts, deliveries and account notices. Read on the subject only: a bill's body says "receipt".
const UPDATES = /\breceipt\b|\byour order\b|\border (confirmed|confirmation|#|number|update|status)\b|\b(has |have )?shipped\b|\bout for delivery\b|\bdelivered\b|\bpackage\b|\btracking\b|\b(share|leave) (your )?feedback\b|\brate your\b|\breview your (purchase|order|item)\b|\bprivacy (notice|policy|statement)\b|\bterms (of (service|use)|and conditions)\b|\bupdates? to (our|your)\b|\b(weekly|monthly) (summary|report|recap|digest)\b|\bwelcome to\b|\bconfirm your e-?mail\b|\bverify your e-?mail\b|\bthanks? (you )?for (signing|joining|subscribing)\b|\bpayment (received|confirmation)\b|\byou(r)? (paid|payment of)\b/i;

// Senders that are machines, not people. Used to keep "a person wrote to you" honest.
const ROBOT_ADDR = /^(no-?reply|do-?not-?reply|donotreply|notifications?|notify|alerts?|mailer(-daemon)?|bounce|news(letter)?|marketing|promo(tions)?|offers?|deals|hello|info|support|team|updates?|digest|billing|invoices?|accounts?|service|customerservice|reply|email|mail|auto|automated|system|admin|postmaster|feedback|orders?|shipping|receipts?|weekly)([._+-].*)?@/i;
const MARKETING = /\b(sale|% off|\d+% off|deal(s)? (of|for)|limited time|shop now|new arrivals|exclusive offer|free shipping|coupon|promo code|webinar|newsletter|weekly digest|unsubscribe|black friday|cyber monday|flash (sale|deal)|flash black friday)\b/i;
// Words a company name has and a person's name does not.
const ORG_WORD = /^(team|tools?|support|bank|inc\.?|llc|ltd|pbc|ab|corp\.?|co\.?|weekly|daily|newsletter|news|store|shop|service|services|health|cent(er|re)|alerts?|webmaster|notifications?|from|at|the|via|of|and|&|app|online|digital|official|deals?|hunters?|club|group|partners?|education|support|naturally|restoration|clinic|offers?|rewards?|security|billing|account|accounts|customer|care|hq)$/i;
const FREE_MAIL = /@(gmail|googlemail|yahoo|ymail|rocketmail|aol|outlook|hotmail|live|msn|icloud|me|mac|proton|protonmail|gmx|mail|zoho)\.[a-z]{2,3}(\.[a-z]{2})?$/i;

// ---- junk signals ----------------------------------------------------------------------------
// Each one is something a real sender has no reason to do. One is enough.

/** A capital I standing in for a lowercase l inside a word: "DeaI", "WaIk", "ComfortabIy". */
function homoglyphWord(text: string): string | null {
  for (const w of text.split(/[^A-Za-z]+/)) {
    if (w.length < 3 || w === w.toUpperCase()) continue; // "AI", "OK", "NASA"
    for (let i = 1; i < w.length; i++) {
      if (w[i] !== "I" || !/[a-z]/.test(w[i - 1])) continue;
      if (i + 1 < w.length && !/[a-z]/.test(w[i + 1])) continue; // "vidIQ", "iOS"-style brand caps
      if (/^(Ma?c|O)$/.test(w.slice(0, i))) continue; // McIntyre, MacIntosh
      return w;
    }
  }
  return null;
}
// A pill, loan or miracle pitch. Only junk when the sender also has no unsubscribe link and
// mails from a throwaway marketing subdomain (em., help., guide., smtp1., …).
const SPAM_TOPIC = /\b(credit line|cash advance|payday|loan (approved|offer)|dental implants?|implants?|keto|cbd|weight ?loss|lose \d+ ?(lbs?|pounds)|liver|uti?s?|urinary|prostate|testosterone|blood sugar|neuropathy|tinnitus|sweepstakes|you('ve| have)? won|claim your|gift card|oprah|shark tank|crazy deals?|miracle|doctors? (hate|stunned|baffled)|car warranty|medicare|walk more|knee pain|joint pain|hearing aid)\b/i;
const SPAM_SUBDOMAIN = /@(em|e|m|g|t|go|help|guide|contact|smtp\d*|news|info|mail\d*|send|click|offers?|promo|deals?|mkt|marketing)\.[a-z0-9-]+\.[a-z.]+$/i;
const ORDER_SCAM = /\b(thank you for your (order|purchase|payment)|order (confirmation|receipt)|invoice|receipt|renewal|subscription (renewed|confirmation)|geek squad|norton|mcafee|paypal)\b/i;

export function junkSignals(mail: IncomingMail, sender: Sender = parseFrom(mail.from)): string[] {
  const name = sender.name ?? "";
  const addr = sender.addr ?? "";
  const subject = mail.subject ?? "";
  const unsub = Boolean(mail.listUnsubscribe && /<\s*(https|mailto):/i.test(mail.listUnsubscribe));
  const out: string[] = [];
  const glyph = homoglyphWord(`${name} ${subject}`);
  if (glyph) out.push(`"${glyph}" is spelled with a capital I for an l`);
  if (/[A-Za-z]_[A-Za-z]/.test(name)) out.push("the name is joined with underscores");
  if (/\S {3,}\S/.test(name)) out.push("the name is padded with spaces");
  if (/\[\[[A-Z_]+\]\]|\{\{\s*[a-z_]+\s*\}\}/i.test(`${subject} ${mail.snippet}`)) out.push("it still has template placeholders in it");
  if (FREE_MAIL.test(addr) && ORDER_SCAM.test(subject) && !nameInLocalPart(name, addr)) out.push("an order or invoice from a personal address");
  if (!unsub && SPAM_SUBDOMAIN.test(addr) && SPAM_TOPIC.test(`${name} ${subject}`)) out.push("a sales pitch from a throwaway mail address");
  return out;
}

/** A word of the display name (3+ letters) appears in the address: "Tori Rose" <torirose11@…>. */
function nameInLocalPart(name: string, addr: string): boolean {
  const local = (addr.split("@")[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return name.toLowerCase().split(/[^a-z]+/).some((w) => w.length >= 3 && local.includes(w));
}

/**
 * A person's name, not a brand: one to four capitalised words, no digits, no company words, not
 * the address itself. A one-word name must also appear in the address, because "Imagine" from
 * pachak@… is a campaign, while "Raymond" from raymond@… is a colleague.
 */
export function looksLikePerson(sender: Sender): boolean {
  const name = (sender.name ?? "").trim();
  const addr = sender.addr ?? "";
  if (!name || !addr || name.includes("@") || /[\d_,|:!?]/.test(name)) return false;
  const words = name.split(/\s+/);
  if (words.length > 4) return false;
  if (!words.every((w) => /^[A-Z][A-Za-z'’.-]*$/.test(w) && !ORG_WORD.test(w))) return false;
  if (words.length === 1) {
    // "eBay" <ebay@ebay.com>: the name is the domain, so it is the company writing.
    const [local, domain = ""] = addr.toLowerCase().split("@");
    const core = domain.split(".").slice(-2, -1)[0] ?? "";
    return nameInLocalPart(name, addr) && local.replace(/[^a-z]/g, "") !== core.replace(/[^a-z]/g, "");
  }
  return true;
}

// ---- monitoring and one-time codes (owner, 2026-10-25) ------------------------------------------

/** Starts every "it recovered" notice's detail line; the report pairs these with their outage. */
export const RESOLVED_MARK = "Resolved";
// "## Incident resolved" (Better Stack), "[Resolved]", "is back up", "recovered".
const RESOLVED = /\bincident (has been |was |automatically )?resolved\b|\[resolved\]|\bresolved:|\bis (back )?up again\b|\bis back up\b|\bhas recovered\b|\brecovered\b.*\b(monitor|incident|outage)\b/i;
const MONITOR_SENDER = /@(alerts\.)?(betterstack\.com|uptimerobot\.com|statuscake\.com|pingdom\.com|cronitor\.io)$|^alerts?@/i;

/** A monitor saying an outage it reported has ended. Information, and it closes the outage. */
export function isResolvedNotice(mail: Pick<IncomingMail, "from" | "subject" | "snippet">): boolean {
  const addr = parseFrom(mail.from).addr ?? "";
  return MONITOR_SENDER.test(addr) && RESOLVED.test(`${mail.subject} ${mail.snippet.slice(0, 200)}`);
}

// A one-time code: worth knowing, rarely urgent. Most arrive because he just asked for one.
const ONE_TIME_CODE = /\b(verification|security|one[- ]time|login|sign[- ]in|confirmation|access) code\b|\bcode is\b|\byour code\b|\b\d{4,8} is your\b|\byour \d{1,2}-digit code\b|\bverify your (profile|identity|account|login)\b/i;
// What makes a code worth a second look: something blocked, locked, breached or plainly odd.
// Not "if this wasn't you": every code email says that.
const CODE_ALARM = /\b(suspicious|unusual activity|breach(ed)?|compromised|locked|blocked|unrecognized|unknown device)\b/i;

/** Security mail that is only a one-time code with nothing alarming in it. */
export function isRoutineCode(mail: Pick<IncomingMail, "subject" | "snippet">): boolean {
  const text = `${mail.subject} ${mail.snippet}`;
  return ONE_TIME_CODE.test(text) && !CODE_ALARM.test(text);
}

/** Plain-language amount and due date, if the text carries them ("$806.67 · due 10/26"). */
export function billFacts(text: string): string | null {
  const amount = text.match(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/);
  const due =
    text.match(/\bdue (?:on |by )?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(?:, \d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i) ??
    text.match(/\b(?:expires?|ends) (?:on )?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(?:, \d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  const parts: string[] = [];
  if (amount) parts.push(amount[0].replace(/\s/g, ""));
  if (due) parts.push(`${/expire|ends/i.test(due[0]) ? "ends" : "due"} ${due[1]}`);
  return parts.length ? parts.join(" · ") : null;
}

/** Case-insensitive "contains" on From (name or address) and Subject. Both given = both must match. */
export function ruleMatches(rule: Pick<Rule, "matchFrom" | "matchSubject">, from: string, subject: string): boolean {
  const f = (rule.matchFrom ?? "").trim().toLowerCase();
  const s = (rule.matchSubject ?? "").trim().toLowerCase();
  if (!f && !s) return false;
  if (f && !from.toLowerCase().includes(f)) return false;
  if (s && !subject.toLowerCase().includes(s)) return false;
  return true;
}

/** The most specific matching rule: both fields beat one, then the longer pattern wins. */
export function pickRule<R extends Rule>(rules: readonly R[], from: string, subject: string): R | null {
  let best: R | null = null;
  let bestScore = -1;
  for (const r of rules) {
    if (!ruleMatches(r, from, subject)) continue;
    const score = (r.matchFrom ? 1000 : 0) + (r.matchSubject ? 1000 : 0) + (r.matchFrom ?? "").length + (r.matchSubject ?? "").length;
    if (score > bestScore) { best = r; bestScore = score; }
  }
  return best;
}

export function classify(mail: IncomingMail, rule: Rule | null): Classified {
  const sender = parseFrom(mail.from);
  const who = senderLabel(sender);
  const subject = clip(mail.subject || "(no subject)", 100);
  const text = `${mail.subject} ${mail.snippet}`;
  const unsub = parseUnsubscribe(mail.listUnsubscribe, mail.listUnsubscribePost);
  const facts = billFacts(text);
  const detail = (extra?: string | null) => [`From ${who}`, extra].filter(Boolean).join(" · ");

  if (rule?.action === "important") {
    return { bucket: "needs_you", level: "normal", title: subject, detail: detail(facts ?? clip(mail.snippet, 140)) };
  }

  if (isResolvedNotice(mail)) {
    return { bucket: "other", level: "info", title: subject, detail: `${RESOLVED_MARK} · From ${who}` };
  }

  const junk = junkSignals(mail, sender);
  if (junk.length) {
    const addr = sender.addr ? ` <${sender.addr}>` : "";
    return { bucket: "junk", level: "info", title: subject, detail: `From ${who}${addr} · ${junk[0]}` };
  }

  const bulkish = Boolean(unsub.http || unsub.mailto) || MARKETING.test(mail.subject);
  // A newsletter's body says "new device" in a product announcement; from a mailing list, only a
  // subject that says so is a security email (a login alert from a list sender still is).
  const securityHit = SECURITY_STRONG.test(bulkish ? mail.subject : text) || SECURITY_WEAK.test(mail.subject);

  if (securityHit) {
    // A bare verification code is information: it expires in minutes and was usually asked for.
    const codeOnly = isRoutineCode(mail) || (CODE_ONLY.test(text) && !SECURITY_URGENT.test(text));
    const copy = ALERT_COPY.test(text);
    return {
      bucket: "security",
      level: copy || codeOnly ? "info" : SECURITY_URGENT.test(text) ? "urgent" : "normal",
      title: `${who}: ${subject}`,
      detail: detail(clip(mail.snippet, 160) || null),
    };
  }

  if (BILL.test(text) && !(bulkish && MARKETING.test(text))) {
    return { bucket: "needs_you", level: BILL_URGENT.test(text) ? "urgent" : "normal", title: subject, detail: detail(facts) };
  }
  if (EXPIRING.test(text) && !(bulkish && MARKETING.test(text))) {
    return { bucket: "needs_you", level: EXPIRING_URGENT.test(text) ? "urgent" : "normal", title: subject, detail: detail(facts) };
  }
  if (REQUEST.test(mail.subject) && !bulkish) {
    return { bucket: "needs_you", level: "normal", title: subject, detail: detail() };
  }

  if (UPDATES.test(mail.subject)) {
    return { bucket: "updates", level: "info", title: subject, detail: detail() };
  }

  // A person, not a machine: no list headers, not a robot address, a name that reads as a name.
  if (!bulkish && !ROBOT_ADDR.test(sender.addr ?? "") && looksLikePerson(sender)) {
    return { bucket: "needs_you", level: "normal", title: subject, detail: `From ${who}` };
  }

  if (bulkish) return { bucket: "bulk", level: "info", title: subject, detail: detail() };
  return { bucket: "other", level: "info", title: subject, detail: detail() };
}

/** A stored row back into the shape `classify` reads, for re-sorting mail already in the report. */
export function mailFromStored(r: {
  id: string; accountId: string; receivedAt: string | null; fromName: string | null; fromAddr: string | null; subject: string; snippet: string;
  unsubHttp: string | null; unsubMailto: string | null; oneClick: boolean;
}): IncomingMail {
  const addr = r.fromAddr ?? "";
  return {
    id: r.id, accountId: r.accountId, receivedAt: r.receivedAt,
    from: r.fromName && addr ? `"${r.fromName.replace(/"/g, "")}" <${addr}>` : addr || (r.fromName ?? ""),
    subject: r.subject, snippet: r.snippet,
    listUnsubscribe: [r.unsubHttp, r.unsubMailto].filter(Boolean).map((x) => `<${x}>`).join(", ") || null,
    listUnsubscribePost: r.oneClick ? "List-Unsubscribe=One-Click" : null,
  };
}
