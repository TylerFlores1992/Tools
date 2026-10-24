import { test } from "node:test";
import assert from "node:assert/strict";
import { DEPARTMENTS } from "./geometry.ts";
import { DEPT_LABEL, DEPT_STYLE, NEXT_VISIBILITY, SEVERITY, STATUS, datumAxes } from "./show.ts";

test("every department has a label and a line style of its own (shape, not colour)", () => {
  const seen = new Set<string>();
  for (const d of DEPARTMENTS) {
    assert.ok(DEPT_LABEL[d], d);
    const key = `${DEPT_STYLE[d].dash ?? "solid"}/${DEPT_STYLE[d].width}`;
    assert.ok(!seen.has(key), `${d} looks like another department (${key})`);
    seen.add(key);
  }
});

test("datum axes: CL runs up/downstage, PL across, both through the datum", () => {
  const z = (pts: [number, number][]) => pts.map((p) => p.map((v) => v + 0)); // -0 → 0
  const { cl, pl } = datumAxes([10, 20], [0, 1], 100);
  assert.deepEqual(z(cl), [[10, -80], [10, 120]]);
  assert.deepEqual(z(pl), [[-90, 20], [110, 20]]);
  const r = datumAxes([0, 0], [0, -1], 10); // audience at the top of the page
  assert.deepEqual(z(r.cl), [[0, 10], [0, -10]]);
  assert.deepEqual(z(r.pl), [[10, 0], [-10, 0]]); // stage left is now on the page's left
});

test("states always carry a mark and a word, never colour alone", () => {
  for (const s of [...Object.values(STATUS), ...Object.values(SEVERITY)]) {
    assert.ok(s.mark.length >= 1 && s.word.length >= 2);
  }
  assert.equal(NEXT_VISIBILITY.shown, "dimmed");
  assert.equal(NEXT_VISIBILITY.hidden, "shown");
});
