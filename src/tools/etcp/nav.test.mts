import { test } from "node:test";
import assert from "node:assert/strict";
import { STUDY_BASE, STUDY_PAGES, studyPageFor } from "./nav.ts";
import { PRACTICE_SETS } from "./questions.ts";

test("every practice set has a tab and a breadcrumb name, read from the data", () => {
  for (const s of PRACTICE_SETS) assert.equal(studyPageFor(`${STUDY_BASE}/practice/${s.slug}`)?.name, s.name);
  assert.equal(STUDY_PAGES.length, PRACTICE_SETS.length + 3);
});

test("the breadcrumb's current page ignores a trailing slash, query and hash", () => {
  assert.equal(studyPageFor(`${STUDY_BASE}/`)?.href, STUDY_BASE);
  assert.equal(studyPageFor(`${STUDY_BASE}/formulas#rope`)?.name, "Formula reference");
  assert.equal(studyPageFor(`${STUDY_BASE}/flashcards?x=1`)?.name, "Flashcards");
  assert.equal(studyPageFor("/workshop"), undefined);
});
