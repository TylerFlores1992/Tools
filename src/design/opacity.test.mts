/**
 * No partial opacity on elements in src/.
 *
 * Why: `opacity-80` on a row faded its muted label to 3.51:1 (found by Lighthouse on
 * /workshop, 2026-10-02). Opacity multiplies into every colour inside the element, so it
 * silently breaks the contrast that src/design/contrast.test.mts guarantees for tokens.
 * Show/hide transitions (opacity-0 ↔ opacity-100) are fine. Need a dimmer text? Use a token.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { classesIn, sourceFiles } from "./classes.ts";

const SRC = join(import.meta.dirname, "..");
const PARTIAL = /(^|:)opacity-(?!0$|100$)[\w[\].%-]+$/;

test("self-test: partial opacity is caught, show/hide is allowed", () => {
  assert.deepEqual(["opacity-80", "hover:opacity-50", "opacity-[.7]", "opacity-0", "data-[x=y]:opacity-100"].map((c) => PARTIAL.test(c)), [true, true, true, false, false]);
});

test("no partial opacity classes in src/", () => {
  const files = sourceFiles(SRC);
  assert.ok(files.length >= 10, "walk is broken");
  const bad = files.flatMap((f) => classesIn(readFileSync(f, "utf8")).filter((c) => PARTIAL.test(c)).map((c) => `${relative(SRC, f)}: ${c}`));
  assert.deepEqual(bad, [], bad.join("\n"));
});
