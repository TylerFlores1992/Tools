/** The connector's fixtures must be what the site builds today (see scripts/rig-fixtures.mts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rigFixtures } from "./fixtures.ts";

const dir = join(import.meta.dirname, "..", "..", "..", "connectors", "vectorworks", "tests", "fixtures");

test("connector fixtures match the site's build lists (rerun scripts/rig-fixtures.mts)", () => {
  for (const [name, list] of Object.entries(rigFixtures())) {
    const saved = JSON.parse(readFileSync(join(dir, `rig-${name}.json`), "utf8"));
    assert.deepEqual(saved, JSON.parse(JSON.stringify(list)), name);
  }
});
