/**
 * Morning Mail's logic. Cases are modeled on real items from the Claude-written reports it
 * replaces (SCE true-up, US Mobile expiring, Netflix new device, an X login, a person's email).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { billFacts, classify, junkSignals, looksLikePerson, mailFromStored, pickRule, ruleMatches } from "./classify.ts";
import { clip, parseFrom, parseUnsubscribe, rawHeader, senderLabel } from "./headers.ts";
import { cleanFolder, planAction, safeUnsubscribeUrl } from "./plan.ts";
import { addDays, buildReport } from "./report.ts";
import type { IncomingMail, MailRow, Rule } from "./types.ts";

let n = 0;
const mail = (p: Partial<IncomingMail> & Pick<IncomingMail, "from" | "subject">): IncomingMail => ({
  id: `gmail:${++n}`, accountId: "gmail", receivedAt: null, snippet: "", listUnsubscribe: null, listUnsubscribePost: null, ...p,
});
const rule = (p: Partial<Rule> & Pick<Rule, "action">): Rule => ({ id: ++n, matchFrom: null, matchSubject: null, folder: null, ...p });

// ---- headers ----

test("From parsing: display name, bare address, quoted name", () => {
  assert.deepEqual(parseFrom('"SCE Billing" <NoReply@sce.com>'), { name: "SCE Billing", addr: "noreply@sce.com" });
  assert.deepEqual(parseFrom("parveen.k@parks.ca.gov"), { name: null, addr: "parveen.k@parks.ca.gov" });
  assert.deepEqual(parseFrom("Netflix <info@account.netflix.com>"), { name: "Netflix", addr: "info@account.netflix.com" });
  assert.equal(senderLabel(parseFrom("alerts@zillow.com")), "Zillow");
  assert.deepEqual(parseFrom(""), { name: null, addr: null });
});

test("List-Unsubscribe: one-click needs the POST header AND an https link", () => {
  const h = "<mailto:u@list.example.com?subject=unsub>, <https://list.example.com/u?id=9>";
  assert.deepEqual(parseUnsubscribe(h, "List-Unsubscribe=One-Click"), { http: "https://list.example.com/u?id=9", mailto: "mailto:u@list.example.com?subject=unsub", oneClick: true });
  assert.equal(parseUnsubscribe(h, null).oneClick, false);
  assert.equal(parseUnsubscribe("<http://insecure.example.com/u>", "List-Unsubscribe=One-Click").oneClick, false);
  assert.deepEqual(parseUnsubscribe(null, null), { http: null, mailto: null, oneClick: false });
});

test("clip cuts on a word and collapses whitespace", () => {
  assert.equal(clip("a   b\n c", 50), "a b c");
  assert.equal(clip("Your statement for October is ready to view online", 20), "Your statement for…");
});

// ---- classify ----

test("security: new device, login, breach; codes are info; suspicious is urgent", () => {
  const netflix = classify(mail({ from: "Netflix <info@account.netflix.com>", subject: "A new device is using your account" }), null);
  assert.equal(netflix.bucket, "security");
  assert.equal(netflix.level, "normal");
  assert.match(netflix.title, /^Netflix: /);
  assert.equal(classify(mail({ from: "X <info@x.com>", subject: "New login to X from Chrome on Mac" }), null).bucket, "security");
  assert.equal(classify(mail({ from: "Google <no-reply@accounts.google.com>", subject: "Some of your saved passwords were found in a data breach" }), null).level, "urgent");
  assert.equal(classify(mail({ from: "Bank <alerts@bank.com>", subject: "Suspicious sign-in attempt blocked" }), null).level, "urgent");
  assert.equal(classify(mail({ from: "X <verify@x.com>", subject: "Your X verification code is 123456" }), null).level, "info");
});

test("security wins over bulk headers (a login alert from a mailing-list sender is still security)", () => {
  const c = classify(mail({ from: "Shop <news@shop.com>", subject: "New sign-in to your Shop account", listUnsubscribe: "<https://shop.com/u>" }), null);
  assert.equal(c.bucket, "security");
});

test("a newsletter whose body mentions signing in is not security; its subject still counts", () => {
  const news = classify(mail({ from: "Vercel <news@vercel.com>", subject: "MiniMax M3.1 Flash is free until October 22", snippet: "Sign in to the dashboard to try it", listUnsubscribe: "<https://vercel.com/u>" }), null);
  assert.equal(news.bucket, "bulk");
  // The same words from a sender without list headers are still a security email.
  assert.equal(classify(mail({ from: "Shop <alerts@shop.com>", subject: "Your order", snippet: "New sign-in to your Shop account" }), null).bucket, "security");
});

test("needs you: bills with amount and due date; failed payment is urgent", () => {
  const sce = classify(mail({ from: "SCE <noreply@sce.com>", subject: "Your SCE bill is ready", snippet: "Amount due $806.67. Due Oct 26, 2026. Annual true-up." }), null);
  assert.equal(sce.bucket, "needs_you");
  assert.equal(sce.level, "normal");
  assert.match(sce.detail ?? "", /\$806\.67 · due Oct 26, 2026/);
  assert.equal(classify(mail({ from: "Visa <alerts@card.com>", subject: "Your payment failed" }), null).level, "urgent");
});

test("needs you: expiring plan; 'tomorrow' and 'suspended' are urgent", () => {
  const usm = classify(mail({ from: "US Mobile <support@usmobile.com>", subject: "Your plan expires 10/21", snippet: "Renew in the app or turn on AutoPay." }), null);
  assert.equal(usm.bucket, "needs_you");
  assert.match(usm.detail ?? "", /ends 10\/21|due/);
  assert.equal(classify(mail({ from: "Domains <billing@registrar.com>", subject: "Your domain expires tomorrow" }), null).level, "urgent");
});

test("needs you: a person writing (no list headers, not a robot address)", () => {
  const c = classify(mail({ from: "Parveen Kasraee <parveen.k@parks.ca.gov>", subject: "Records reply PRA 26-977" }), null);
  assert.equal(c.bucket, "needs_you");
  assert.equal(c.title, "Records reply PRA 26-977", "the subject leads, like every other row");
  assert.equal(c.detail, "From Parveen Kasraee");
});

test("bulk: list headers or marketing; a robot without lists is other", () => {
  assert.equal(classify(mail({ from: "Zillow <alerts@zillow.com>", subject: "Your market update", listUnsubscribe: "<https://zillow.com/u>" }), null).bucket, "bulk");
  assert.equal(classify(mail({ from: "Store <hello@store.com>", subject: "40% off everything this weekend" }), null).bucket, "bulk");
  assert.equal(classify(mail({ from: "Sentry <noreply@sentry.io>", subject: "New issue in camphawk" }), null).bucket, "other");
  assert.equal(classify(mail({ from: "Sentry <noreply@sentry.io>", subject: "Weekly report for camphawk" }), null).bucket, "updates");
});

test("marketing that says 'renew' or 'ends soon' is bulk, not a bill", () => {
  const c = classify(mail({ from: "Store <deals@store.com>", subject: "Sale ends soon: 30% off renewals", listUnsubscribe: "<https://store.com/u>" }), null);
  assert.equal(c.bucket, "bulk");
});

test("an 'important' rule forces needs you", () => {
  const r = rule({ action: "important", matchFrom: "sentry.io" });
  assert.equal(classify(mail({ from: "Sentry <noreply@sentry.io>", subject: "Weekly report" }), r).bucket, "needs_you");
});

test("billFacts reads amounts and dates in the shapes bills use", () => {
  assert.equal(billFacts("Amount due: $1,234.50 due by 11/02/2026"), "$1,234.50 · due 11/02/2026");
  assert.equal(billFacts("Your plan expires Oct 21"), "ends Oct 21");
  assert.equal(billFacts("hello"), null);
});

// ---- rules ----

test("rules: contains on From and Subject; both given means both must match; most specific wins", () => {
  assert.ok(ruleMatches({ matchFrom: "zillow.com", matchSubject: null }, "Zillow <alerts@zillow.com>", "x"));
  assert.ok(!ruleMatches({ matchFrom: "zillow.com", matchSubject: "price cut" }, "Zillow <alerts@zillow.com>", "Market update"));
  assert.ok(!ruleMatches({ matchFrom: "", matchSubject: "" }, "a", "b"));
  const broad = rule({ action: "file", matchFrom: "zillow.com", folder: "Real estate" });
  const exact = rule({ action: "trash", matchFrom: "zillow.com", matchSubject: "market update" });
  assert.equal(pickRule([broad, exact], "alerts@zillow.com", "Your market update")?.action, "trash");
  assert.equal(pickRule([broad, exact], "alerts@zillow.com", "Price cut")?.action, "file");
  assert.equal(pickRule([broad], "x@y.com", "z"), null);
});

// ---- plan ----

test("plan: nothing happens without a rule", () => {
  assert.deepEqual(planAction(mail({ from: "a@b.com", subject: "x" }), null), { action: null, folder: null, status: null, note: null });
});

test("plan: unsubscribe only presses a one-click link; others are listed for the owner", () => {
  const r = rule({ action: "unsubscribe", matchFrom: "x" });
  const one = mail({ from: "x@list.com", subject: "s", listUnsubscribe: "<https://list.com/u>", listUnsubscribePost: "List-Unsubscribe=One-Click" });
  assert.equal(planAction(one, r).status, "pending");
  const page = mail({ from: "x@list.com", subject: "s", listUnsubscribe: "<https://list.com/u>" });
  assert.equal(planAction(page, r).status, "manual");
  const mailto = mail({ from: "x@list.com", subject: "s", listUnsubscribe: "<mailto:u@list.com>" });
  assert.match(planAction(mailto, r).note ?? "", /never sends/);
});

test("plan: file defaults to Misc and cleans the folder name", () => {
  assert.equal(planAction(mail({ from: "a@b.com", subject: "x" }), rule({ action: "file", matchFrom: "a" })).folder, "Misc");
  assert.equal(cleanFolder('  ../Bills/"House"  '), "Bills/House");
  assert.equal(cleanFolder("   "), null);
});

test("one-click URLs: https to a real host only", () => {
  assert.ok(safeUnsubscribeUrl("https://list.example.com/u?id=1"));
  for (const bad of ["http://list.example.com/u", "https://localhost/u", "https://10.0.0.1/u", "https://user:pw@list.example.com/u", "https://intranet/u", "not a url", null]) {
    assert.equal(safeUnsubscribeUrl(bad), null, String(bad));
  }
});

// ---- report ----

const row = (p: Partial<MailRow> & Pick<MailRow, "id" | "reportDate" | "bucket">): MailRow => ({
  accountId: "gmail", receivedAt: null, fromName: null, fromAddr: null, subject: "s", level: "normal", title: p.id, detail: null,
  action: null, actionFolder: null, actionStatus: null, actionNote: null, unsubHttp: null, unsubMailto: null, oneClick: false, ...p,
});
const base = { dismissed: new Set<string>(), unsubscribed: new Map<string, string>(), ruleCoveredAddrs: new Set<string>(), accountErrors: [] as string[] };

test("report: needs-you carries forward until dismissed; urgent first; older than 7 days drops", () => {
  const rows = [
    row({ id: "a", reportDate: "2026-10-18", bucket: "needs_you", level: "normal" }),
    row({ id: "b", reportDate: "2026-10-16", bucket: "needs_you", level: "urgent" }),
    row({ id: "c", reportDate: "2026-10-10", bucket: "needs_you" }),
    row({ id: "d", reportDate: "2026-10-17", bucket: "needs_you" }),
  ];
  const r = buildReport({ ...base, date: "2026-10-18", rows, dismissed: new Set(["d"]) });
  assert.deepEqual(r.needsYou.map((i) => i.id), ["b", "a"]);
  assert.equal(r.needsYou[0].since, "2026-10-16");
  assert.equal(r.needsYou[1].since, null);
});

test("report: verification codes show only on their day", () => {
  const rows = [
    row({ id: "code-old", reportDate: "2026-10-17", bucket: "security", level: "info" }),
    row({ id: "code-new", reportDate: "2026-10-18", bucket: "security", level: "info" }),
    row({ id: "device", reportDate: "2026-10-17", bucket: "security", level: "normal" }),
  ];
  assert.deepEqual(buildReport({ ...base, date: "2026-10-18", rows }).security.map((i) => i.id).sort(), ["code-new", "device"]);
});

test("report: done lines per account, counted only for actions that happened", () => {
  const rows = [
    row({ id: "1", reportDate: "2026-10-18", bucket: "bulk", action: "trash", actionStatus: "done" }),
    row({ id: "2", reportDate: "2026-10-18", bucket: "bulk", action: "trash", actionStatus: "done" }),
    row({ id: "3", reportDate: "2026-10-18", bucket: "bulk", action: "file", actionFolder: "Misc", actionStatus: "done", accountId: "yahoo:t@yahoo.com" }),
    row({ id: "4", reportDate: "2026-10-18", bucket: "bulk", action: "trash", actionStatus: "failed", actionNote: "Yahoo refused the move." }),
  ];
  const r = buildReport({ ...base, date: "2026-10-18", rows });
  assert.deepEqual(r.done, [{ account: "Gmail", text: "Trashed 2 emails." }, { account: "t@yahoo.com", text: "Filed 1 in Misc." }]);
  assert.equal(r.couldntDo.length, 1);
  assert.match(r.couldntDo[0], /Yahoo refused/);
});

test("report: a sender still mailing 3+ days after an unsubscribe is listed; a fresh one is not", () => {
  const rows = [
    row({ id: "1", reportDate: "2026-10-18", bucket: "bulk", fromAddr: "old@list.com", fromName: "Old List" }),
    row({ id: "2", reportDate: "2026-10-18", bucket: "bulk", fromAddr: "new@list.com" }),
  ];
  const unsubscribed = new Map([["old@list.com", "2026-10-10"], ["new@list.com", "2026-10-17"]]);
  assert.deepEqual(buildReport({ ...base, date: "2026-10-18", rows, unsubscribed }).stillArriving, [{ sender: "Old List", since: "2026-10-10", count: 1 }]);
});

test("report: bulk senders are grouped and offered for a rule unless a rule already covers them", () => {
  const rows = [
    row({ id: "1", reportDate: "2026-10-18", bucket: "bulk", fromAddr: "a@z.com", fromName: "Zillow", oneClick: true }),
    row({ id: "2", reportDate: "2026-10-18", bucket: "bulk", fromAddr: "a@z.com", fromName: "Zillow", accountId: "yahoo:t@yahoo.com" }),
    row({ id: "3", reportDate: "2026-10-18", bucket: "bulk", fromAddr: "b@shop.com", fromName: "Shop" }),
  ];
  const r = buildReport({ ...base, date: "2026-10-18", rows, ruleCoveredAddrs: new Set(["b@shop.com"]) });
  assert.equal(r.bulk.length, 1);
  assert.deepEqual({ ...r.bulk[0] }, { addr: "a@z.com", name: "Zillow", count: 2, sample: "s", oneClick: true, accounts: ["Gmail", "t@yahoo.com"] });
});

test("report: hidden and trashed items never show as needing you", () => {
  const rows = [
    row({ id: "h", reportDate: "2026-10-18", bucket: "needs_you", action: "hide", actionStatus: "done" }),
    row({ id: "t", reportDate: "2026-10-18", bucket: "needs_you", action: "trash", actionStatus: "done" }),
    // "Always trash" pressed and the move not made yet: handled, so it leaves the list at once.
    row({ id: "p", reportDate: "2026-10-18", bucket: "needs_you", action: "trash", actionStatus: "pending" }),
    row({ id: "f", reportDate: "2026-10-18", bucket: "needs_you", action: "file", actionStatus: "pending" }),
  ];
  assert.equal(buildReport({ ...base, date: "2026-10-18", rows }).needsYou.length, 0);
  // A move that failed is still the owner's to deal with.
  const failed = [row({ id: "x", reportDate: "2026-10-18", bucket: "needs_you", action: "trash", actionStatus: "failed" })];
  assert.deepEqual(buildReport({ ...base, date: "2026-10-18", rows: failed }).needsYou.map((i) => i.id), ["x"]);
});

test("addDays crosses months", () => {
  assert.equal(addDays("2026-11-01", -1), "2026-10-31");
});

// ---- junk, updates and the stricter "a person wrote" (2026-10-21: spam was reaching Needs you) ----
// Every case below is a copy of an email that really arrived, with the names changed where they
// were a real person's.

const bucket = (p: Partial<IncomingMail> & Pick<IncomingMail, "from" | "subject">) => classify(mail(p), null).bucket;

test("junk: a capital I for an l, in the name or the subject", () => {
  assert.equal(bucket({ from: '"DeaI Hunters" <healthbeat@guide.purehealthservice.com>', subject: "Oprah + Deal Watchdogs = Crazy Deals" }), "junk");
  assert.equal(bucket({ from: '"Step Naturally" <news.info@buyprimepath.com>', subject: "WaIk More ComfortabIy Every Day" }), "junk");
  assert.equal(bucket({ from: '"SmiIe Center" <x@help.homeeaseplus.com>', subject: "Hello" }), "junk");
  // Real words with a capital I are not that: acronyms, Mc/Mac names, a word that starts with I.
  assert.deepEqual(junkSignals(mail({ from: '"Ian McIntyre" <ian@studio.com>', subject: "AI notes for the IATSE call, iPhone shots" })), []);
  assert.deepEqual(junkSignals(mail({ from: '"Ops" <ops@x.com>', subject: "MacIntosh and O'Inn" })), []);
});

test("junk: underscores or padded spaces in the name, template leftovers", () => {
  assert.equal(bucket({ from: '"Liver_Support" <a@buysprouthub.com>', subject: "Your liver" }), "junk");
  assert.equal(bucket({ from: '"cranberry       juice" <levyolois@help.homeeaseplus.com>', subject: "Recurring UTls? Here's what to know.." }), "junk");
  assert.equal(bucket({ from: '"Ann" <ann@x.com>', subject: "Hi", snippet: "[[PAGE_NAME]] [[PAGE_NAME]]" }), "junk");
});

test("junk: an order or invoice from a personal address that is not the name on it", () => {
  assert.equal(bucket({ from: '"KEVIN MOORE" <didfuncon0@gmail.com>', subject: "Thank You for Your Order GL1-CAA~4NLO0C" }), "junk");
  // A friend selling you something from their own address is still a person.
  assert.notEqual(bucket({ from: '"Kevin Moore" <kevin.moore@gmail.com>', subject: "Thank you for your order of the tickets" }), "junk");
  // A company's mail. subdomain is not a personal address (Anthropic's receipts come from one).
  assert.equal(bucket({ from: '"Anthropic, PBC" <invoice+statements@mail.anthropic.com>', subject: "Your receipt from Anthropic, PBC #2579" }), "updates");
});

test("junk: a sales pitch from a throwaway subdomain with no unsubscribe link", () => {
  assert.equal(bucket({ from: '"Imagine" <pachak@em.secureprimehealth.com>', subject: "Imagine a credit line up to $1000" }), "junk");
  assert.equal(bucket({ from: '"Dental Implant ClearChoice" <honest@smtp1.honestobject.com>', subject: "See if you qualify" }), "junk");
  // The same pitch from a list with an unsubscribe link is a newsletter, not junk.
  assert.equal(bucket({ from: '"Imagine" <pachak@em.secureprimehealth.com>', subject: "Imagine a credit line up to $1000", listUnsubscribe: "<https://x.com/u>" }), "bulk");
  // A bank's own credit-line email is not from a throwaway subdomain.
  assert.notEqual(bucket({ from: '"Bank" <alerts@notifications.bank.com>', subject: "Your credit line increase" }), "junk");
});

test("junk wins over security: a scam dressed as an alert does not reach the security list", () => {
  assert.equal(bucket({ from: '"Account_Security" <x@em.example.com>', subject: "Unusual sign-in detected" }), "junk");
});

test("updates: receipts, deliveries, feedback, privacy notices, welcomes, weekly summaries", () => {
  assert.equal(bucket({ from: '"eBay" <ebay@ebay.com>', subject: "📦PACKAGE DELIVERED: Toshiba 1TB External..." }), "updates");
  assert.equal(bucket({ from: '"eBay" <ebay@ebay.com>', subject: "OUT FOR DELIVERY: 256GB M.2 SATA SSD 2..." }), "updates");
  assert.equal(bucket({ from: '"eBay" <ebay@ebay.com>', subject: "Tyler, share feedback on your recent purchase" }), "updates");
  assert.equal(bucket({ from: '"eBay" <ebay@info.ebay.com>', subject: "Updates to our User Privacy Notice 2026" }), "updates");
  assert.equal(bucket({ from: '"27 Kilobyte AB" <invoice+statements+acct_1@stripe.com>', subject: "Your receipt from 27 Kilobyte AB #2599" }), "updates");
  assert.equal(bucket({ from: '"Better Stack Weekly" <weekly@weekly.betterstack.com>', subject: "Weekly summary for Your team" }), "updates");
  assert.equal(bucket({ from: '"AlternativeTo" <support@alternativeto.net>', subject: "Welcome to AlternativeTo, Tyler" }), "updates");
});

test("a person: a name that reads as a name; brands, one-word campaigns and addresses do not", () => {
  assert.equal(looksLikePerson(parseFrom('"Tori Rose Teixeira" <torirose11@gmail.com>')), true);
  assert.equal(looksLikePerson(parseFrom('"Raymond" <raymond@nbcuni.com>')), true);
  assert.equal(looksLikePerson(parseFrom('"Bing Webmaster Tools" <bingwb@microsoft.com>')), false);
  assert.equal(looksLikePerson(parseFrom('"Better Stack Weekly" <weekly@x.com>')), false);
  assert.equal(looksLikePerson(parseFrom('"Imagine" <pachak@em.x.com>')), false);
  assert.equal(looksLikePerson(parseFrom('"Anthropic, PBC" <a@x.com>')), false);
  assert.equal(looksLikePerson(parseFrom('"27 Kilobyte AB" <a@x.com>')), false);
  assert.equal(looksLikePerson(parseFrom("nbcusafe@nbcuni.com")), false);
  // A brand writing from its own name at its own domain is not a person either.
  assert.equal(looksLikePerson(parseFrom('"eBay" <ebay@ebay.com>')), false);
  assert.equal(bucket({ from: '"Tori Rose Teixeira" <torirose11@gmail.com>', subject: "P&T Fool Us S12 // VTR1 10/19 Production Documents" }), "needs_you");
  assert.equal(bucket({ from: '"Bing Webmaster Tools" <bingwb@microsoft.com>', subject: "Improve the search presence of camphawk.app" }), "other");
});

test("a request by name still needs you, even from a shared work address", () => {
  assert.equal(bucket({ from: "nbcusafe@nbcuni.com", subject: "Invitation Request - Raymond Schrefel's Visit" }), "needs_you");
});

test("security: 'log in' in a body is a footer, not an alert; an alert copy is information", () => {
  const usb = classify(mail({ from: '"U.S. Bank" <usbank@notifications.usbank.com>', subject: "Your latest credit card statement is ready.", snippet: "Log in to mobile or online banking to view your statement." }), null);
  assert.equal(usb.bucket, "needs_you");
  // In a subject it still counts.
  assert.equal(bucket({ from: '"Bank" <a@bank.com>', subject: "Did you just log in?" }), "security");
  assert.equal(bucket({ from: '"Yahoo" <no-reply@cc.yahoo.com>', subject: "An app password was created for your Yahoo account" }), "security");
  const copy = classify(mail({ from: '"Google" <no-reply@accounts.google.com>', subject: "Security alert for t@gmail.com", snippet: "This is a copy of a security alert sent to t@gmail.com." }), null);
  assert.deepEqual([copy.bucket, copy.level], ["security", "info"]);
});

test("bills and expiry: 'your X bill' and 'about to expire'; Black Friday is marketing", () => {
  assert.equal(bucket({ from: '"Sunrun" <noreply@sunrun.com>', subject: "Your Sunrun bill, plus a video explaining how your bill works" }), "needs_you");
  assert.equal(bucket({ from: '"US Mobile" <hello@usmobile.com>', subject: "One of your US Mobile lines is about to expire" }), "needs_you");
  assert.equal(bucket({ from: '"Team at US Mobile" <hello@usmobile.com>', subject: "Flash Black Friday: Unlimited from $10/mo" }), "bulk");
});

test("rawHeader reads a header from mailparser's raw lines, folded lines joined", () => {
  const lines = [{ key: "from", line: "From: a@b.com" }, { key: "list-unsubscribe", line: "List-Unsubscribe: <https://x.com/u>,\r\n <mailto:u@x.com>" }];
  assert.equal(rawHeader(lines, "list-unsubscribe"), "<https://x.com/u>, <mailto:u@x.com>");
  assert.equal(rawHeader(lines, "list-unsubscribe-post"), null);
  assert.equal(rawHeader(undefined, "list-unsubscribe"), null);
});

test("a stored row classifies the way the email did when it arrived", () => {
  const m = mail({ from: '"cranberry       juice" <levyolois@help.homeeaseplus.com>', subject: "Recurring UTls?", listUnsubscribe: "<https://x.com/u>, <mailto:u@x.com>", listUnsubscribePost: "List-Unsubscribe=One-Click" });
  const s = parseFrom(m.from);
  const u = parseUnsubscribe(m.listUnsubscribe, m.listUnsubscribePost);
  const back = mailFromStored({ id: m.id, accountId: m.accountId, receivedAt: null, fromName: s.name, fromAddr: s.addr, subject: m.subject, snippet: m.snippet, unsubHttp: u.http, unsubMailto: u.mailto, oneClick: u.oneClick });
  assert.deepEqual(classify(back, null), classify(m, null));
  assert.deepEqual(parseUnsubscribe(back.listUnsubscribe, back.listUnsubscribePost), u);
});

test("report: today's junk and updates are listed; junk from a sender a rule covers is not", () => {
  const r = buildReport({
    date: "2026-10-21",
    rows: [
      row({ id: "j1", reportDate: "2026-10-21", bucket: "junk", fromAddr: "spam@em.x.com" }),
      row({ id: "j2", reportDate: "2026-10-21", bucket: "junk", fromAddr: "ruled@em.x.com" }),
      row({ id: "j3", reportDate: "2026-10-20", bucket: "junk", fromAddr: "old@em.x.com" }),
      row({ id: "u1", reportDate: "2026-10-21", bucket: "updates", fromAddr: "ebay@ebay.com" }),
    ],
    dismissed: new Set(), unsubscribed: new Map(), ruleCoveredAddrs: new Set(["ruled@em.x.com"]), accountErrors: [],
  });
  assert.deepEqual(r.junk.map((i) => i.id), ["j1"]);
  assert.equal(r.junk[0].addr, "spam@em.x.com");
  assert.deepEqual(r.updates.map((i) => i.id), ["u1"]);
  assert.deepEqual(r.needsYou, []);
});
