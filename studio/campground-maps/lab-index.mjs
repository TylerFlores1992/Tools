// The lab's three hand-maintained lists, regenerated from the files present, so waves built in
// parallel (a rollout child per batch) never edit the same file:
//   - src/lab/camphawk/round2/maps/waves.json: one row per committed wave manifest
//     (public/private/camphawk/maps/waves/wave-NN.json);
//   - src/lab/camphawk/round2/maps/first-look/index.ts: one import per first-look/wave-NN.json;
//   - src/lab/camphawk/round2/maps/decisions.ts: one import per decisions/wave-NN.json.
//
//   node studio/campground-maps/lab-index.mjs           write them
//   node studio/campground-maps/lab-index.mjs --check   exit 1 if any is out of date (tested)
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
const LAB = join(ROOT, "src/lab/camphawk/round2/maps");
const MANIFESTS = join(ROOT, "public/private/camphawk/maps/waves");
const nn = (n) => String(n).padStart(2, "0");
const wavesIn = (dir) => (existsSync(dir) ? readdirSync(dir) : []).map((f) => f.match(/^wave-(\d+)\.json$/)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);

/** A manifest's row in waves.json. */
export const indexRow = (m) => ({ wave: m.wave, built: m.built, count: m.entries.length, summary: m.summary, order: m.drawn?.order ?? "", export: m.drawn?.export ?? "", ids: m.entries.map((e) => e.id) });

export function wavesJson(dir = MANIFESTS) {
  const waves = wavesIn(dir).map((n) => indexRow(JSON.parse(readFileSync(join(dir, `wave-${nn(n)}.json`), "utf8"))));
  return JSON.stringify({ waves }, null, 1) + "\n";
}

/** Rewrite a module's `import waveNN from "./<dir>wave-NN.json"` lines and its list line. */
export function withImports(src, waves, { from, list }) {
  const imp = new RegExp(`^import wave\\d+ from "\\./${from.replace(/[/.]/g, "\\$&")}wave-\\d+\\.json" with \\{ type: "json" \\};\\n`, "gm");
  const first = src.search(imp);
  if (first < 0) throw new Error(`no wave import to replace (${from})`);
  const lines = waves.map((n) => `import wave${nn(n)} from "./${from}wave-${nn(n)}.json" with { type: "json" };\n`).join("");
  let out = src.replace(imp, "");
  out = out.slice(0, first) + lines + out.slice(first);
  const re = new RegExp(`^(${list.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}) \\[[^\\]]*\\];$`, "m");
  if (!re.test(out)) throw new Error(`no list line: ${list.name}`);
  return out.replace(re, `$1 [${waves.map((n) => `wave${nn(n)} as ${list.type}`).join(", ")}];`);
}

export function outputs() {
  const looks = join(LAB, "first-look/index.ts"), decisions = join(LAB, "decisions.ts");
  return [
    [join(LAB, "waves.json"), wavesJson()],
    [looks, withImports(readFileSync(looks, "utf8"), wavesIn(join(LAB, "first-look")), { from: "", list: { name: "export const LOOK_FILES: LooksFile[] =", type: "LooksFile" } })],
    [decisions, withImports(readFileSync(decisions, "utf8"), wavesIn(join(LAB, "decisions")), { from: "decisions/", list: { name: "export const DECISION_FILES =", type: "DecisionFile" } })],
  ];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stale = outputs().filter(([f, text]) => readFileSync(f, "utf8") !== text);
  if (process.argv.includes("--check")) {
    for (const [f] of stale) console.error(`out of date: ${f}`);
    process.exit(stale.length ? 1 : 0);
  }
  for (const [f, text] of stale) writeFileSync(f, text);
  console.log(stale.length ? `wrote ${stale.map(([f]) => f.replace(ROOT + "/", "")).join(", ")}` : "up to date");
}
