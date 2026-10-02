// Reads the raw token values (--fw-*) out of globals.css for each theme block.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const GLOBALS_CSS = join(import.meta.dirname, "..", "app", "globals.css");

export type ThemeBlocks = {
  dark: Record<string, string>;
  light: Record<string, string>;
  lightMedia: Record<string, string>;
  night: Record<string, string>;
};

/** Token names declared more than once in one block. The later one silently wins. */
export const duplicates: string[] = [];

function vars(body: string, label: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--fw-([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (m[1] in out) duplicates.push(`${label}: --fw-${m[1]}`);
    out[m[1]] = m[2].trim();
  }
  return out;
}

/** The body of the first `{…}` block that follows `selector` in `css`, or throws. */
function block(css: string, selector: string, from = 0): string {
  const at = css.indexOf(selector, from);
  if (at < 0) throw new Error(`globals.css: selector not found: ${selector}`);
  const open = css.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`globals.css: unbalanced block after ${selector}`);
}

export function readThemes(css = readFileSync(GLOBALS_CSS, "utf8")): ThemeBlocks {
  return {
    dark: vars(block(css, ":root {"), "dark"),
    lightMedia: vars(block(css, ':root:not([data-theme="dark"])'), "lightMedia"),
    light: vars(block(css, ':root[data-theme="light"]'), "light"),
    night: vars(block(css, ".theme-night"), "night"),
  };
}
