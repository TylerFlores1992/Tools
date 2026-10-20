import { clip, parseFrom, parseUnsubscribe, senderLabel } from "./headers.ts";
import type { Classified, IncomingMail, Rule } from "./types.ts";

/**
 * Sorting one email, deterministically. No model: every rule is a pattern a person can read and
 * a test pins. The order of the checks is the policy:
 *   1. the owner's own rules (`important` forces "needs you", `hide` drops it from the report);
 *   2. security (sign-ins, new devices, password changes, breaches);
 *   3. needs you (bills and payments, things expiring, action required, a person writing);
 *   4. bulk (anything with List-Unsubscribe or a marketing sender);
 *   5. other (counted, not listed).
 * A wrong "needs you" costs a glance; a security alert filed as bulk costs much more, so security
 * is checked before anything that could swallow it.
 */

const SECURITY = /\b(sign[- ]?in|signed in|log[- ]?in|logged in|new device|security (alert|notice|code)|unusual (activity|sign)|suspicious|password (was |has been )?(changed|reset)|reset your password|verification code|one[- ]time (pass)?code|two[- ]factor|2-step|2fa|data breach|breach(ed)?|compromised|confirm (it was|that it'?s) you|was this you|account (locked|access|recovery)|new (login|sign[- ]in)|security key|passkey)\b/i;
const SECURITY_URGENT = /\b(unusual|suspicious|breach(ed)?|compromised|locked|wasn'?t you|not you|unrecognized|unknown device|blocked)\b/i;
const CODE_ONLY = /\b(verification|security|one[- ]time|login|sign[- ]in) code\b|\bcode is\b|\byour code\b/i;

const BILL = /\b(bill|statement) (is )?(ready|available|due)|\bpayment (is )?(due|failed|declined|reminder|scheduled|received)|\bamount due\b|\bpast due\b|\bdue (on|by|date|soon|tomorrow|today)\b|\bautopay\b|\binvoice\b|\bminimum payment\b|\btrue-?up\b/i;
const BILL_URGENT = /\b(failed|declined|past due|overdue|final notice|returned payment|insufficient funds|late fee)\b/i;
const EXPIRING = /\bexpir(es|ing|ed|ation)\b|\brenew(al|s)?\b|\bends (on|soon|today|tomorrow)\b|\b(will be )?suspended\b|\bcancell?ation\b|\baction (required|needed)\b|\bplease (confirm|respond|review|verify)\b|\bresponse (requested|needed)\b|\bdeadline\b|\blast chance to (renew|keep)\b/i;
const EXPIRING_URGENT = /\b(final|today|tomorrow|suspended|expired|immediately|urgent)\b/i;

// Senders that are machines, not people. Used to keep "a person wrote to you" honest.
const ROBOT_ADDR = /^(no-?reply|do-?not-?reply|donotreply|notifications?|notify|alerts?|mailer(-daemon)?|bounce|news(letter)?|marketing|promo(tions)?|offers?|deals|hello|info|support|team|updates?|digest|billing|accounts?|service|customerservice|reply|email|mail|auto|automated|system|admin|postmaster)([._+-].*)?@/i;
const MARKETING = /\b(sale|% off|\d+% off|deal(s)? (of|for)|limited time|shop now|new arrivals|exclusive offer|free shipping|coupon|promo code|webinar|newsletter|weekly digest|unsubscribe)\b/i;

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

  const bulkish = Boolean(unsub.http || unsub.mailto) || MARKETING.test(mail.subject);
  // A newsletter's body says "sign in" and "log in" all the time; from a mailing list, only a
  // subject that says so is a security email (a login alert from a list sender still is).
  const securityText = bulkish ? mail.subject : text;

  if (SECURITY.test(securityText)) {
    // A bare verification code is information: it expires in minutes and was usually asked for.
    const codeOnly = CODE_ONLY.test(text) && !SECURITY_URGENT.test(text);
    return {
      bucket: "security",
      level: SECURITY_URGENT.test(text) ? "urgent" : codeOnly ? "info" : "normal",
      title: `${who}: ${subject}`,
      detail: detail(clip(mail.snippet, 160) || null),
    };
  }

  if (BILL.test(text)) {
    return { bucket: "needs_you", level: BILL_URGENT.test(text) ? "urgent" : "normal", title: subject, detail: detail(facts) };
  }
  if (EXPIRING.test(text) && !(bulkish && MARKETING.test(text))) {
    return { bucket: "needs_you", level: EXPIRING_URGENT.test(text) ? "urgent" : "normal", title: subject, detail: detail(facts) };
  }

  // A person, not a machine: no list headers, not a robot address, not marketing.
  if (!bulkish && sender.addr && !ROBOT_ADDR.test(sender.addr)) {
    return { bucket: "needs_you", level: "normal", title: subject, detail: `From ${who}` };
  }

  if (bulkish) return { bucket: "bulk", level: "info", title: subject, detail: detail() };
  return { bucket: "other", level: "info", title: subject, detail: detail() };
}
