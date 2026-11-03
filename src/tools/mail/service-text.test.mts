import { test } from "node:test";
import assert from "node:assert/strict";
import { gmailProblem, imapProblem, unsubscribeOnce, type Pressed } from "./service-text.ts";

function counter(results: Record<string, boolean>) {
  const calls: (string | null)[] = [];
  const press = async (url: string | null): Promise<Pressed> => {
    calls.push(url);
    return { ok: Boolean(url && results[url]), note: url && results[url] ? "ok" : "no" };
  };
  return { calls, press };
}

test("one sender is pressed once, however many emails carry its link", async () => {
  const { calls, press } = counter({ "https://a/1": true, "https://a/2": true });
  const once = unsubscribeOnce(press);
  for (const u of ["https://a/1", "https://a/2", "https://a/1"]) assert.equal((await once("News@A.com", u)).ok, true);
  assert.deepEqual(calls, ["https://a/1"]);
});

test("the same link is never pressed twice, even after it failed", async () => {
  const { calls, press } = counter({});
  const once = unsubscribeOnce(press);
  await once("x@b.com", "https://b/1");
  await once("x@b.com", "https://b/1");
  assert.deepEqual(calls, ["https://b/1"]);
});

test("a failing sender stops after the try limit", async () => {
  const { calls, press } = counter({});
  const once = unsubscribeOnce(press, 2);
  for (let i = 0; i < 5; i++) await once("x@c.com", `https://c/${i}`);
  assert.equal(calls.length, 2);
  const last = await once("x@c.com", "https://c/9");
  assert.equal(last.ok, false);
  assert.match(last.note, /Not tried again/);
});

test("different senders are counted apart", async () => {
  const { calls, press } = counter({ "https://d/1": true, "https://e/1": true });
  const once = unsubscribeOnce(press);
  await once("a@d.com", "https://d/1");
  await once("b@e.com", "https://e/1");
  assert.equal(calls.length, 2);
});

test("Yahoo failures read as sentences, never raw server text", () => {
  assert.match(imapProblem({ authenticationFailed: true }), /did not accept/);
  assert.match(imapProblem({ code: "ETIMEDOUT" }), /Couldn't reach/);
  assert.match(imapProblem({ responseText: "[UNAVAILABLE] Server busy" }), /busy/);
  const odd = imapProblem({ responseText: "A0042 NO [ALERT] weird internal thing 0xdeadbeef" });
  assert.doesNotMatch(odd, /0xdeadbeef|A0042|ALERT/);
  assert.match(odd, /^Yahoo couldn't/);
});

test("Gmail failures read as sentences, never the script's error", () => {
  assert.equal(gmailProblem("Exception: Invalid argument: id"), "It was no longer in Gmail.");
  assert.match(gmailProblem("Service invoked too many times for one day: gmail"), /busy/);
  const odd = gmailProblem("TypeError: Cannot read properties of undefined (reading 'moveToTrash')");
  assert.equal(odd, "Gmail couldn't move this email.");
});
