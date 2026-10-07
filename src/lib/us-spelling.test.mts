/**
 * User-visible copy is US English (the audience is mostly US riggers working in ft and lb).
 * Scans JSX text and string literals in src/; comments are stripped first.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(import.meta.dirname, "..");
const BRITISH = /\b(colours?|favourite|behaviour|centre|metre(?!s? per)|organis(e|ed|ing|ation)|recognis(e|ed)|analys(e|ed)|licence|catalogue|grey|travelled|cancelled|cancelling|practise|maths|tick the box)\b/i;

// One left-to-right pass: whichever comment starts first wins (a "//" line holding a "/**" glob
// once opened a block that hid real copy from the scan; see the CampHawk typography test).
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, (m, pre: string | undefined) => (m.startsWith("/*") ? m.replace(/[^\n]/g, "") : pre ?? ""));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(p) && !/\.test\./.test(p) ? [p] : [];
  });
}

test("the detector catches British spellings and ignores US ones", () => {
  assert.ok(BRITISH.test("the colour of"));
  assert.ok(BRITISH.test("do the maths"));
  assert.ok(BRITISH.test("Tick the box above"), "US forms say check the box");
  assert.ok(!BRITISH.test("the color of the math"));
});

test("no British spellings in user-visible copy", () => {
  const hits: string[] = [];
  for (const f of files(SRC)) {
    strip(readFileSync(f, "utf8")).split("\n").forEach((line, i) => {
      const m = line.match(BRITISH);
      if (m) hits.push(`${relative(SRC, f)}:${i + 1}: "${m[0]}"`);
    });
  }
  assert.deepEqual(hits, [], hits.join("\n"));
});
