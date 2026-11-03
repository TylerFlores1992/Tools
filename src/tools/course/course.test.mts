import assert from "node:assert/strict";
import { test } from "node:test";
import { CommandSchema, toRequest } from "./commands";

test("accepts the commands the page sends", () => {
  for (const c of [
    { kind: "control", action: "start" },
    { kind: "tap", x: 0, y: 1 },
    { kind: "scroll", dy: -400 },
    { kind: "type", text: "hello" },
    { kind: "key", key: "Enter" },
    { kind: "open", url: "https://example.com/course" },
  ]) assert.equal(CommandSchema.safeParse(c).success, true, JSON.stringify(c));
});

test("refuses anything else", () => {
  for (const c of [
    { kind: "control", action: "shutdown" },
    { kind: "tap", x: 2, y: 0 },
    { kind: "type", text: "x".repeat(501) },
    { kind: "open", url: "file:///c:/secrets.txt" },
    { kind: "open", url: "javascript:alert(1)" },
    { kind: "answer", choice: "a" },
  ]) assert.equal(CommandSchema.safeParse(c).success, false, JSON.stringify(c));
});

test("a command becomes a path and a body", () => {
  assert.deepEqual(toRequest({ kind: "tap", x: 0.5, y: 0.25 }), { path: "tap", body: { x: 0.5, y: 0.25 } });
});

test("polls every 3 s while the home server answers, and backs off to 15 then 30 s after failures", async () => {
  const { nextPollDelay, POLL_MS } = await import("./poll");
  assert.equal(nextPollDelay(0), POLL_MS);
  assert.equal(nextPollDelay(1), 15_000);
  assert.equal(nextPollDelay(2), 30_000);
  assert.equal(nextPollDelay(9), 30_000);
});

test("a command's status stays until the server agrees; a poll from before it can't flip it back", async () => {
  const { dropExpected, EXPECT_GRACE_MS } = await import("./poll");
  const done = 10_000;
  // The poll that was already running when Pause was pressed reports "running": keep "paused".
  assert.equal(dropExpected({ asked: "paused", reported: "running", sending: false, pollStarted: done - 2000, commandDoneAt: done }), false);
  // One that started just after the command still might not see it: keep it.
  assert.equal(dropExpected({ asked: "paused", reported: "running", sending: false, pollStarted: done + 1000, commandDoneAt: done }), false);
  // The server agrees: drop the stand-in, the real status takes over.
  assert.equal(dropExpected({ asked: "paused", reported: "paused", sending: false, pollStarted: done - 2000, commandDoneAt: done }), true);
  // Well after the command and still not paused: the command didn't take, show the truth.
  assert.equal(dropExpected({ asked: "paused", reported: "running", sending: false, pollStarted: done + EXPECT_GRACE_MS + 1, commandDoneAt: done }), true);
  // Nothing asked: nothing to drop.
  assert.equal(dropExpected({ asked: null, reported: "running", sending: false, pollStarted: done + 99_999, commandDoneAt: done }), false);
});
