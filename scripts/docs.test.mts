/**
 * Documentation guards.
 *
 * CLAUDE.md is loaded into every turn of every session, so every line costs something every
 * turn. CampHawk's was pruned from 20,414 lines to 1,309 — and had regrown to 3,203 eleven
 * days later. Good intentions did not hold; this cap does. History goes to docs/, detail to
 * skills (which load only when their description matches).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const CAP = 120;

test(`CLAUDE.md stays a router: at most ${CAP} lines`, () => {
  const lines = readFileSync(join(ROOT, "CLAUDE.md"), "utf8").split("\n").length;
  assert.ok(lines <= CAP, `CLAUDE.md is ${lines} lines (cap ${CAP}). Move detail into a skill or docs/, don't raise the cap.`);
});

test("CLAUDE.md imports nothing large: @imports are inlined and save no tokens", () => {
  const imports = [...readFileSync(join(ROOT, "CLAUDE.md"), "utf8").matchAll(/^@(\S+)/gm)].map((m) => m[1]);
  for (const f of imports) {
    const lines = readFileSync(join(ROOT, f), "utf8").split("\n").length;
    assert.ok(lines <= 40, `@${f} is ${lines} lines and is inlined into every turn`);
  }
});

test("every skill has a trigger-style description (paths or symptoms), not just a summary", () => {
  const dir = join(ROOT, ".claude", "skills");
  const skills = readdirSync(dir);
  assert.ok(skills.length >= 2, "expected the design and ui-audit skills");
  for (const s of skills) {
    const md = readFileSync(join(dir, s, "SKILL.md"), "utf8");
    const desc = md.match(/^description:\s*(.+)$/m)?.[1] ?? "";
    assert.ok(desc.length >= 120, `${s}: description is too thin to match on (${desc.length} chars)`);
    assert.match(desc, /[`/]|\.tsx?|\.css/, `${s}: description names no file paths — write it as a trigger`);
  }
});

test("the session handover exists", () => {
  assert.ok(existsSync(join(ROOT, "docs", "NEXT-SESSION.md")), "docs/NEXT-SESSION.md is missing");
});
