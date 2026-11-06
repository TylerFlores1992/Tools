/**
 * The sender buttons' answer, and the wiring that keeps the page where you were. The buttons used
 * to redirect to /private/mail?ruled=…, and that navigation scrolled to the top after every press.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ruleNote, type RuleOutcome } from "./rule-note.ts";

const base: RuleOutcome = { addr: "deals@em.shop.com", action: "trash", touched: 0, dup: false, gmail: false, yahoo: false };

test("a new trash rule says what it does, and how many of the week's emails it moved, and where", () => {
  assert.equal(ruleNote(base), "Mail from deals@em.shop.com goes to Trash from now on.");
  assert.equal(
    ruleNote({ ...base, touched: 3, gmail: true, yahoo: true }),
    "Mail from deals@em.shop.com goes to Trash from now on. 3 emails from the last week were handled the same way; Yahoo moves them in the next minute; Gmail moves them at its next run.",
  );
  assert.equal(
    ruleNote({ ...base, touched: 1 }),
    "Mail from deals@em.shop.com goes to Trash from now on. 1 email from the last week was handled the same way.",
  );
});

test("Not junk and Ignore move nothing, so they never claim a count", () => {
  assert.equal(ruleNote({ ...base, action: "important", touched: 4, gmail: true }), "Mail from deals@em.shop.com always shows under Needs you from now on.");
  assert.equal(ruleNote({ ...base, action: "hide", touched: 4 }), "Mail from deals@em.shop.com is left out of this page from now on.");
});

test("a second tap says the rule was already there and nothing new was done", () => {
  assert.equal(ruleNote({ ...base, dup: true, touched: 5 }), "That rule was already there: mail from deals@em.shop.com goes to Trash. Nothing new was done.");
});

test("an unknown action or a missing sender gives no sentence", () => {
  assert.equal(ruleNote({ ...base, action: "delete" }), null);
  assert.equal(ruleNote({ ...base, addr: "" }), null);
});

const ROOT = join(import.meta.dirname, "../../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

test("the sender action answers in place: it never redirects (a redirect scrolls the page to the top)", () => {
  const src = read("src/app/private/mail/actions.ts");
  const start = src.indexOf("export async function ruleFromSender(");
  assert.notEqual(start, -1, "ruleFromSender not found");
  const end = src.indexOf("\nexport ", start + 1);
  const body = src.slice(start, end === -1 ? undefined : end);
  assert.doesNotMatch(body, /\bredirect\(/);
  assert.match(body, /Promise<SenderResult>/);
});

test("the page's sender buttons send the answer to the toast, inside the toaster", () => {
  const page = read("src/app/private/mail/page.tsx");
  assert.match(page, /<SenderForm action=\{ruleFromSender\}>/);
  assert.doesNotMatch(page, /<form action=\{ruleFromSender\}>/);
  const open = page.indexOf("<MailToaster>");
  const close = page.indexOf("</MailToaster>");
  assert.ok(open !== -1 && close > open, "the page body is wrapped in MailToaster");
  // Every sender button renders inside that body (SenderButton is used only there and in Items, which the body renders).
  assert.ok(page.slice(open, close).includes("<SenderButton"), "sender buttons sit inside the toaster");
});
