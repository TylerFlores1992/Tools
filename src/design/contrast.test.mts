/**
 * Every colour pair the UI uses (src/design/tokens.ts) must meet its WCAG minimum in BOTH
 * themes, and the states a red-green colour-blind visitor must tell apart must stay apart.
 *
 * Why: CampHawk shipped a muted grey at 3.2:1 and nothing caught it. Here a token change
 * that breaks a pair fails `npm test`, naming the pair, the theme and the ratio.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicates, readThemes } from "./css.ts";
import { COLOR_TOKENS, CONTRAST_PAIRS, DISTINCT_PAIRS } from "./tokens.ts";
import { contrast, distance, over, parseColor, simulate, type RGB } from "./color.ts";

const themes = readThemes();
const THEMES = { dark: themes.dark, light: themes.light } as const;

function solid(theme: Record<string, string>, name: string): RGB {
  const raw = theme[name];
  assert.ok(raw, `token --fw-${name} is missing`);
  const bg = parseColor(theme.bg);
  return over(parseColor(raw), [bg[0], bg[1], bg[2]]);
}

test("every documented colour token is defined in every theme block", () => {
  for (const [label, block] of Object.entries(themes)) {
    for (const { name } of COLOR_TOKENS) assert.ok(block[name], `--fw-${name} missing from the ${label} block`);
  }
});

test("no token is declared twice in one block (the later one would silently win)", () => {
  assert.deepEqual(duplicates, [], duplicates.join("\n"));
});

test("theme copies cannot drift: light media block = [data-theme=light], night = dark", () => {
  assert.deepEqual(themes.lightMedia, themes.light, "the prefers-color-scheme:light block and :root[data-theme=light] differ");
  assert.deepEqual(themes.night, themes.dark, ".theme-night differs from the dark :root block");
});

test("the contrast maths matches known WCAG values (or every pair below proves nothing)", () => {
  assert.equal(contrast([0, 0, 0], [255, 255, 255]).toFixed(2), "21.00");
  assert.equal(contrast([118, 118, 118], [255, 255, 255]).toFixed(2), "4.54");
  assert.ok(CONTRAST_PAIRS.length >= 15, "the pair list looks truncated");
});

for (const [themeName, theme] of Object.entries(THEMES)) {
  for (const p of CONTRAST_PAIRS) {
    test(`${themeName}: ${p.fg} on ${p.bg} ≥ ${p.min}:1 (${p.use})`, () => {
      const r = contrast(solid(theme, p.fg), solid(theme, p.bg));
      assert.ok(r >= p.min, `${p.fg} on ${p.bg} is ${r.toFixed(2)}:1 in ${themeName}, needs ${p.min}:1`);
    });
  }
}

// Distance threshold in straight RGB units. 60 is clearly separable side by side; the
// owner-facing rule is still "never colour alone", so this only stops hues collapsing.
const MIN_DISTANCE = 60;
for (const [themeName, theme] of Object.entries(THEMES)) {
  for (const p of DISTINCT_PAIRS) {
    for (const kind of ["deutan", "protan"] as const) {
      test(`${themeName}: ${p.a} vs ${p.b} stay distinct under ${kind} (${p.why})`, () => {
        const d = distance(simulate(solid(theme, p.a), kind), simulate(solid(theme, p.b), kind));
        assert.ok(d >= MIN_DISTANCE, `${p.a} vs ${p.b} under ${kind} in ${themeName}: distance ${d.toFixed(0)} < ${MIN_DISTANCE}`);
      });
    }
  }
}

test("the simulation is live: pure red and pure green collapse together under deuteranopia", () => {
  const normal = distance([200, 40, 40], [40, 160, 40]);
  const deutan = distance(simulate([200, 40, 40], "deutan"), simulate([40, 160, 40], "deutan"));
  assert.ok(deutan < normal / 2, `expected red/green to converge under deutan (${deutan.toFixed(0)} vs ${normal.toFixed(0)})`);
});
