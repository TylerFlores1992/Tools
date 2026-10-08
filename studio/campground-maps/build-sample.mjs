// Builds every campground in specs/ridb-sample.json (the 50-campground sample, wave 0) and writes
// the lab's review manifest. The same builder as every wave (build-wave.mjs).
//
//   NODE_USE_ENV_PROXY=1 node studio/campground-maps/build-sample.mjs <ridb-dir> [facility-id…]
//
// With ids, only those campgrounds are rebuilt (after adding a trace, say) and the rest of the
// manifest is kept as it was. Maps go to public/private/camphawk/maps/ridb-<id>.json; the
// manifest, bundled with the page (it predates waves), to src/lab/camphawk/round2/maps/sample-manifest.json.
// OpenStreetMap comes from an extract where one covers the campground, else the API.
import { join } from "node:path";
import { buildWave } from "./build-wave.mjs";

const [ridbDir, ...only] = process.argv.slice(2);
if (!ridbDir) { console.error("usage: build-sample.mjs <ridb-dir> [facility-id…]"); process.exit(1); }
await buildWave({
  ridbDir,
  specFile: join(import.meta.dirname, "specs/ridb-sample.json"),
  manifestFile: join(import.meta.dirname, "../../src/lab/camphawk/round2/maps/sample-manifest.json"),
  only,
  osm: "auto",
});
