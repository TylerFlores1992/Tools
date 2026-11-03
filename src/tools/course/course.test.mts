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
