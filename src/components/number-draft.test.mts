/** A half-typed number ("-", ".") is still typing, not an error; garbage is an error at once. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readDraft } from "./number-draft.ts";

test("drafts on the way to a number are still typing", () => {
  for (const t of ["", " ", "-", "+", ".", ",", "-.", "-,", "+."]) assert.deepEqual(readDraft(t), { kind: "typing" }, JSON.stringify(t));
});

test("complete numbers parse, including a trailing point and a decimal comma", () => {
  assert.deepEqual(readDraft("-2"), { kind: "number", n: -2 });
  assert.deepEqual(readDraft("1."), { kind: "number", n: 1 });
  assert.deepEqual(readDraft("1,5"), { kind: "number", n: 1.5 });
  assert.deepEqual(readDraft(" 14 "), { kind: "number", n: 14 });
  assert.deepEqual(readDraft("-.5"), { kind: "number", n: -0.5 });
});

test("text that can't become a number is invalid straight away", () => {
  for (const t of ["abc", "1.2.3", "--", "-a", "1e", "12x"]) assert.deepEqual(readDraft(t), { kind: "invalid" }, t);
});
