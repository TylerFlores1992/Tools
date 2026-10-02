/**
 * Every Tailwind class written in src/ must generate CSS.
 *
 * Why: Tailwind v4 silently emits NOTHING for a class it doesn't know — a token that was
 * renamed, a typo, or a stock colour like `bg-gray-500` (the stock palette is deleted in
 * globals.css). `tsc`, eslint and `next build` all pass. CampHawk shipped seven such classes
 * before a test like this existed. This one asks Tailwind itself, using the real globals.css,
 * so it covers every utility, not just colours.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
// Unstable but exact: it is the compiler's own answer. Pinned via the exact tailwindcss
// version in package.json, and the self-test below fails loudly if its shape changes.
import { __unstable__loadDesignSystem } from "@tailwindcss/node";
import { GLOBALS_CSS } from "./css.ts";
import { classesIn, sourceFiles } from "./classes.ts";

const SRC = join(import.meta.dirname, "..");
const css = readFileSync(GLOBALS_CSS, "utf8");
const ds = await __unstable__loadDesignSystem(css, { base: join(SRC, "app") });
// Plain CSS classes defined in globals.css itself (e.g. `.theme-night`) are legitimate too.
const PLAIN = new Set([...css.matchAll(/^\s*\.([a-z][a-z0-9-]*)\s*[,{]/gm)].map((m) => m[1]));
// Marker classes that generate nothing themselves but enable group-*/peer-* variants.
const MARKER = /^(group|peer)(\/[a-z0-9-]+)?$/;
const generates = (classes: string[]) =>
  ds.candidatesToCss(classes).map((out, i) => PLAIN.has(classes[i]) || MARKER.test(classes[i]) || (out !== null && out.trim() !== ""));

test("self-test: the compiler accepts real tokens and rejects deleted or invented ones", () => {
  assert.deepEqual(generates(["bg-surface", "text-ember", "rounded-card", "text-display", "font-mono", "hover:bg-surface-2"]), [true, true, true, true, true, true]);
  // Stock palette is deleted; invented tokens and typos generate nothing.
  assert.deepEqual(generates(["bg-gray-500", "text-white", "bg-surfce", "rounded-cardd"]), [false, false, false, false]);
  assert.ok(PLAIN.has("theme-night"), "expected .theme-night to be read from globals.css");
  assert.deepEqual(generates(["group", "peer", "group/row", "groupx"]), [true, true, true, false]);
});

test("self-test: the extractor finds classes in every supported form", () => {
  const src = `<a className="a b" /><b className={"c"} /><i className={'d'} /><s className={\`e \${x} f\`} />{cx("g h")}`;
  assert.deepEqual(classesIn(src), ["a", "b", "c", "d", "e", "f", "g", "h"]);
});

test("every class in src/ generates CSS", () => {
  const files = sourceFiles(SRC);
  assert.ok(files.length >= 5, `scanned only ${files.length} files: the walk is broken`);
  const bad: string[] = [];
  let checked = 0;
  for (const f of files) {
    const classes = classesIn(readFileSync(f, "utf8"));
    checked += classes.length;
    generates(classes).forEach((ok, i) => { if (!ok) bad.push(`${relative(SRC, f)}: ${classes[i]}`); });
  }
  assert.ok(checked > 20, `found only ${checked} classes: the extractor is broken`);
  assert.deepEqual(bad, [], `these classes render NOTHING in Tailwind v4:\n${bad.join("\n")}`);
});
