/**
 * /work is the one place the site carries the owner's name and résumé (owner's call, 2026-10-26),
 * and it is unlisted: shared by link only. These guards keep it that way.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECTS, RESUME } from "./work.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

test("/work and /work/resume tell search engines not to index them", () => {
  for (const p of ["src/app/work/page.tsx", "src/app/work/resume/page.tsx"]) {
    assert.match(read(p), /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/, `${p} must be noindex`);
  }
});

test("/work isn't linked from the nav, footer or sitemap", () => {
  for (const p of ["src/components/SiteHeader.tsx", "src/components/SiteFooter.tsx", "src/app/sitemap.ts"]) {
    assert.doesNotMatch(read(p), /["'`/]work\b/, `${p} mentions /work`);
  }
});

test("the résumé PDF the page offers exists", () => {
  assert.ok(existsSync(join(ROOT, "public", RESUME.pdf)), `run npm run resume to make ${RESUME.pdf}`);
});

test("every project screenshot exists, and private tools say their data is made up", () => {
  for (const p of PROJECTS) {
    if (!p.shot) continue;
    assert.ok(existsSync(join(ROOT, "public", p.shot.src)), `${p.shot.src} missing`);
    if (p.state === "in-use") assert.match(p.shot.note ?? "", /made-up/, `${p.name}: a private tool's screenshot must say it's made-up data`);
  }
});
