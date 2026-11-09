import { test } from "node:test";
import assert from "node:assert/strict";
import { pcView, WAKE_PATIENCE_MS } from "./status.ts";

test("the PC's state is always said in words", () => {
  assert.equal(pcView(true, null, 0).kind, "on");
  assert.equal(pcView(false, null, 0).text, "Asleep or off.");
  assert.equal(pcView(false, 1000, 66_000).text, "Waking… 1:05");
  assert.equal(pcView(false, 0, WAKE_PATIENCE_MS).kind, "gave-up");
  assert.equal(pcView(true, 0, WAKE_PATIENCE_MS * 2).kind, "on"); // an answer beats the clock
});
