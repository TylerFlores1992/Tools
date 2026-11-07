/**
 * Writes the site's build lists for every template to connectors/vectorworks/tests/fixtures/, so
 * the connector's tests build exactly what the phone produces. `src/tools/rig/fixtures.test.mts`
 * fails if these drift from the code; rerun `npx tsx scripts/rig-fixtures.mts` after a change.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { rigFixtures } from "../src/tools/rig/fixtures.ts";

const dir = join(import.meta.dirname, "..", "connectors", "vectorworks", "tests", "fixtures");
for (const [name, list] of Object.entries(rigFixtures())) writeFileSync(join(dir, `rig-${name}.json`), JSON.stringify(list, null, 1) + "\n");
console.log("wrote", Object.keys(rigFixtures()).length, "fixtures");
