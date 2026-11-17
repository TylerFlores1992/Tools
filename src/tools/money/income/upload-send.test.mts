/**
 * Sending a stub photo from the phone: retried when the send itself fails, never when the site
 * answered, and a failure that survives the retries says why.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MAX_UPLOAD_BYTES, RETRY_DELAYS_MS, sendFailureMessage, sendWithRetry, tooBigMessage } from "./upload-send.ts";

const noWait = async () => {};

test("a send that throws is tried again, and the answer of a later try comes back", async () => {
  let calls = 0;
  const waits: number[] = [];
  const res = await sendWithRetry(async () => {
    calls++;
    if (calls < 3) throw new TypeError("Failed to fetch");
    return "read";
  }, RETRY_DELAYS_MS, async (ms) => { waits.push(ms); });
  assert.equal(res, "read");
  assert.equal(calls, 3);
  assert.deepEqual(waits, [...RETRY_DELAYS_MS]);
});

test("a send the site answered (even with an error) is never retried", async () => {
  let calls = 0;
  const res = await sendWithRetry(async () => { calls++; return { ok: false, error: "Over 4 MB." }; }, RETRY_DELAYS_MS, noWait);
  assert.deepEqual(res, { ok: false, error: "Over 4 MB." });
  assert.equal(calls, 1);
});

test("after every try fails, the last error comes out", async () => {
  let calls = 0;
  await assert.rejects(
    sendWithRetry(async () => { calls++; throw new Error(`try ${calls}`); }, RETRY_DELAYS_MS, noWait),
    /try 3/,
  );
  assert.equal(calls, RETRY_DELAYS_MS.length + 1);
});

test("a failure says why: offline, a dropped connection, turned away, or unknown", () => {
  assert.match(sendFailureMessage(new TypeError("Failed to fetch"), false), /offline/);
  assert.match(sendFailureMessage(new TypeError("Failed to fetch"), true), /connection dropped.*\(Failed to fetch\)/);
  assert.match(sendFailureMessage(new TypeError("Load failed"), true), /connection dropped/);
  assert.match(sendFailureMessage(new Error("An unexpected response was received from the server."), true), /turned this upload away/);
  assert.match(sendFailureMessage(new Error("something else"), true), /didn’t go through.*\(something else\)/);
  assert.match(sendFailureMessage(undefined, true), /didn’t go through\. Tap Try again\.$/);
});

test("a photo still over the site's limit after shrinking is refused before sending", () => {
  assert.equal(tooBigMessage(MAX_UPLOAD_BYTES), null);
  assert.match(tooBigMessage(MAX_UPLOAD_BYTES + 1) ?? "", /Too big to send \(4\.0 MB/);
});

test("the limit here is the server's limit", () => {
  const actions = readFileSync(join(import.meta.dirname, "../../../app/private/money/income/actions.ts"), "utf8");
  const m = actions.match(/const MAX_BYTES = ([\d_]+);/);
  assert.ok(m, "MAX_BYTES not found in actions.ts");
  assert.equal(Number(m[1].replaceAll("_", "")), MAX_UPLOAD_BYTES);
});

test("the upload form sends through the retry, keeps the screen on, and frees each photo", () => {
  const form = readFileSync(join(import.meta.dirname, "ui/IncomeForms.tsx"), "utf8");
  assert.match(form, /await sendWithRetry\(\(\) => \{[\s\S]{0,120}return uploadOne\(form\);/);
  assert.doesNotMatch(form, /const res: OneResult = await uploadOne\(form\)/);
  assert.match(form, /const release = await keepAwake\(\);/);
  assert.match(form, /bitmap\?\.close\(\);/);
  assert.match(form, /sendFailureMessage\(e, navigator\.onLine\)/);
});
