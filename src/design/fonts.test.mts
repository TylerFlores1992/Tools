/**
 * Every font the CSS names must be loaded, and every font loaded must be used.
 *
 * Why: CampHawk's CSS kept naming a font weeks after it was dropped (headings silently fell
 * back), and a font file that nothing uses still costs every visitor a download.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { GLOBALS_CSS } from "./css.ts";

const LAYOUT = join(import.meta.dirname, "..", "app", "layout.tsx");
const layout = readFileSync(LAYOUT, "utf8");
const css = readFileSync(GLOBALS_CSS, "utf8");

const loaded = [...layout.matchAll(/localFont\(\{[\s\S]*?src:\s*"([^"]+)"[\s\S]*?variable:\s*"(--font-[a-z0-9-]+)"/g)].map((m) => ({ src: m[1], variable: m[2] }));

// Section layouts may load extra faces with next/font/google (only the CampHawk lab does, for
// CampHawk's own fonts). They count as loaded if applied in that same layout.
const sectionLayouts = (function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) return walk(p);
    return e === "layout.tsx" && p !== LAYOUT ? [p] : [];
  });
})(join(import.meta.dirname, "..", "app"));
const googleLoaded = sectionLayouts.flatMap((file) => {
  const src = readFileSync(file, "utf8");
  if (!src.includes('from "next/font/google"')) return [];
  return [...src.matchAll(/const (\w+) = \w+\(\{[\s\S]*?variable:\s*"(--font-[a-z0-9-]+)"/g)].map((m) => ({ file, name: m[1], variable: m[2], applied: src.includes(`\${${m[1]}.variable}`) }));
});

test("layout.tsx loads fonts the way this test reads them", () => {
  assert.ok(loaded.length >= 2, `expected at least 2 localFont() calls, found ${loaded.length}`);
});

test("every loaded font file exists and is applied to <html>", () => {
  for (const f of loaded) {
    assert.ok(existsSync(join(LAYOUT, "..", f.src)), `font file missing: ${f.src}`);
    const name = layout.match(new RegExp(`const (\\w+) = localFont\\(\\{[\\s\\S]*?variable:\\s*"${f.variable}"`))?.[1];
    assert.ok(name && layout.includes(`\${${name}.variable}`), `${f.variable} is loaded but never applied to <html>`);
  }
});

test("fonts loaded by section layouts are applied there", () => {
  for (const f of googleLoaded) assert.ok(f.applied, `${f.file}: ${f.variable} is loaded but never applied`);
});

test("every --font-* the CSS references is loaded, and every loaded font is referenced", () => {
  const referenced = new Set([...css.matchAll(/var\((--font-(?!sans\b|mono\b|ch-)[a-z0-9-]+)\)/g)].map((m) => m[1]));
  const vars = new Set([...loaded.map((f) => f.variable), ...googleLoaded.map((f) => f.variable)]);
  for (const r of referenced) assert.ok(vars.has(r), `globals.css uses ${r}, which layout.tsx never loads`);
  for (const v of vars) assert.ok(referenced.has(v), `layout.tsx loads ${v}, which globals.css never uses`);
});
