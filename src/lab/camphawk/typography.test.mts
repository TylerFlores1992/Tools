/**
 * The CampHawk lab sets type one way (round-10 critique: straight and curly apostrophes were mixed,
 * sometimes in one sentence, and "8 AM" and "7-day" broke across lines):
 *   - apostrophes are curly (’), never `&apos;` or a straight ' between letters in copy;
 *   - "8 AM" keeps a non-breaking space, and "N-day" a non-breaking hyphen.
 * Scans JSX text and string literals in src/lab/camphawk; comments are stripped first.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const LAB = import.meta.dirname;
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const RULES: ReadonlyArray<readonly [string, RegExp]> = [
  ["&apos; (use ’)", /&apos;/],
  ["straight apostrophe (use ’)", /(?<=[A-Za-z0-9])'(?=[A-Za-z])/],
  ["straight plural possessive (use ’)", /(?<=[a-z]s)'(?= [a-z])/],
  ["breakable 8 AM (use a non-breaking space)", /\b\d{1,2} AM\b/],
  ["breakable N-day (use a non-breaking hyphen)", /(\d|\})-day\b/],
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(p) && !/\.test\./.test(p) ? [p] : [];
  });
}

test("the detector catches each slip and passes the fixed forms", () => {
  const hit = (s: string) => RULES.some(([, re]) => re.test(s));
  for (const bad of ["don&apos;t", `"It's mine"`, "other states' counts", "at 8 AM", "a 7-day trial", "${TRIAL_DAYS}-day"]) assert.ok(hit(bad), bad);
  for (const good of ["other states’ counts", "don’t", "at 8 AM", "a 7‑day trial", "Auto-Cart"]) assert.ok(!hit(good), good);
});

test("lab copy uses curly apostrophes and keeps 8 AM and N-day together", () => {
  const hits: string[] = [];
  for (const f of files(LAB)) {
    strip(readFileSync(f, "utf8")).split("\n").forEach((line, i) => {
      for (const [what, re] of RULES) if (re.test(line)) hits.push(`${relative(LAB, f)}:${i + 1}: ${what}`);
    });
  }
  assert.deepEqual(hits, [], hits.join("\n"));
});
