// Finds Tailwind classes written in source files. Shared by the design guards.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Class strings in className attributes (quoted, braced or template literal) and cx() calls. */
export function classStrings(source: string): string[] {
  const out: string[] = [];
  const patterns = [
    /className\s*=\s*"([^"]*)"/g,
    /className\s*=\s*\{\s*"([^"]*)"\s*\}/g,
    /className\s*=\s*\{\s*'([^']*)'\s*\}/g,
    /className\s*=\s*\{\s*`([^`]*)`\s*\}/g,
    /\bcx\(\s*"([^"]*)"/g,
  ];
  for (const re of patterns) for (const m of source.matchAll(re)) out.push(m[1]);
  return out;
}

export function classesIn(source: string): string[] {
  return classStrings(source)
    .map((s) => s.replace(/\$\{[^}]*\}/g, " "))
    .flatMap((s) => s.split(/\s+/))
    .filter(Boolean);
}

export function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(tsx|ts)$/.test(p) && !/\.test\./.test(p) ? [p] : [];
  });
}

