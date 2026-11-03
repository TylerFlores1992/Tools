import { test } from "node:test";
import assert from "node:assert/strict";
import { LOCK_MS, MAX_FAILURES, MAX_TRACKED, Throttle, WINDOW_MS, clientKey } from "./throttle.ts";

test("locks an address after MAX_FAILURES wrong tries inside the window", () => {
  const t = new Throttle();
  for (let i = 0; i < MAX_FAILURES - 1; i++) assert.equal(t.fail("a", 1000 + i), false);
  assert.equal(t.lockedFor("a", 2000), 0);
  assert.equal(t.fail("a", 2000), true);
  assert.equal(t.lockedFor("a", 2000), LOCK_MS);
  assert.equal(t.lockedFor("a", 2000 + LOCK_MS), 0);
});

test("wrong tries older than the window don't count", () => {
  const t = new Throttle();
  for (let i = 0; i < MAX_FAILURES - 1; i++) t.fail("a", 0);
  assert.equal(t.fail("a", WINDOW_MS + 1), false);
  assert.equal(t.lockedFor("a", WINDOW_MS + 1), 0);
});

test("one address being locked doesn't lock another", () => {
  const t = new Throttle();
  for (let i = 0; i < MAX_FAILURES; i++) t.fail("a", 10);
  assert.ok(t.lockedFor("a", 10) > 0);
  assert.equal(t.lockedFor("b", 10), 0);
});

test("the right password clears the count", () => {
  const t = new Throttle();
  for (let i = 0; i < MAX_FAILURES - 1; i++) t.fail("a", 10);
  t.succeed("a");
  assert.equal(t.fail("a", 11), false);
});

test("memory stays bounded", () => {
  const t = new Throttle();
  for (let i = 0; i < MAX_TRACKED + 50; i++) t.fail(`k${i}`, 1);
  assert.equal(t.size, MAX_TRACKED);
});

test("client key uses the first forwarded address and never contains it", () => {
  const a = clientKey("203.0.113.9, 10.0.0.1", null, "s");
  assert.equal(a, clientKey("203.0.113.9", "198.51.100.1", "s"));
  assert.notEqual(a, clientKey("203.0.113.10", null, "s"));
  assert.notEqual(a, clientKey("203.0.113.9", null, "other salt"));
  assert.ok(!a.includes("203"));
  assert.equal(clientKey(null, "198.51.100.1", "s"), clientKey("198.51.100.1", null, "s"));
});
