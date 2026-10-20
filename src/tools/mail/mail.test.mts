/**
 * Morning Mail's logic. Cases are modeled on real items from the Claude-written reports it
 * replaces (SCE true-up, US Mobile expiring, Netflix new device, an X login, a person's email).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { billFacts, classify, pickRule, ruleMatches } from "./classify.ts";
import { clip, parseFrom, parseUnsubscribe, senderLabel } from "./headers.ts";
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
  assert.equal(classify(mail({ from: "Sentry <noreply@sentry.io>", subject: "Weekly report for camphawk" }), null).bucket, "other");
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
  ];
  assert.equal(buildReport({ ...base, date: "2026-10-18", rows }).needsYou.length, 0);
});

test("addDays crosses months", () => {
  assert.equal(addDays("2026-11-01", -1), "2026-10-31");
});
