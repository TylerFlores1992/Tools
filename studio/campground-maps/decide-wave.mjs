// The final check's decisions for a rollout wave (playbook §5.4): the owner delegated pass or hold
// to the orchestrating session (2026-10-08: "you completing the final check and passing what is
// acceptable and holding the rest to fix for after"). Writes decisions/wave-NN.json from the wave's
// first look: `good` and `usable` pass (approved), `hold` and `unsure` are held (hidden), and the
// final check's own calls override the first look for the ids it names.
//
//   node studio/campground-maps/decide-wave.mjs <wave> --checked=<n> [--hold=id,id] [--pass=id,id] [--on=YYYY-MM-DD]
//
// --checked is how many maps the final check looked at over the photo (it goes into the source line).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LAB = join(import.meta.dirname, "../../src/lab/camphawk/round2/maps");
const nn = (n) => String(n).padStart(2, "0");

/**
 * The decisions file for one wave. Every built map in the manifest gets one decision.
 * @param {{ wave: number, manifest: { entries: { id: string, error?: string }[] }, looks: Record<string, { call: string }>, hold?: string[], pass?: string[], checked: number, on: string, by?: string }} opts
 */
export function decideWave({ wave, manifest, looks, hold = [], pass = [], checked, on, by = "Claude (final check, owner's delegation)" }) {
  const decisions = manifest.entries.filter((e) => !e.error).map((e) => {
    const call = looks[e.id]?.call;
    if (!call) throw new Error(`wave ${wave}: no first look for ${e.id}`);
    const override = hold.includes(e.id) ? "hidden" : pass.includes(e.id) ? "approved" : null;
    const decision = override ?? (call === "good" || call === "usable" ? "approved" : "hidden");
    const note = override
      ? `Final check overrode the first look (${call}): ${decision === "approved" ? "passed" : "held"}.`
      : decision === "approved" ? `Passed: first look ${call}.` : `Held to fix after: first look ${call}.`;
    return { id: e.id, decision, by, on, note };
  });
  const unknown = [...hold, ...pass].filter((id) => !decisions.some((d) => d.id === id));
  if (unknown.length) throw new Error(`wave ${wave}: not in the wave: ${unknown.join(", ")}`);
  return {
    version: 1, wave,
    source: `The final check (${on}): ${checked} maps looked at over the photo against the first look (every traced map, every split listing, and a random sample of the rest); good and usable pass, hold and unsure are held to fix after${hold.length || pass.length ? `; ${hold.length + pass.length} overridden` : ""}.`,
    decisions,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const wave = Number(process.argv[2]);
  const args = Object.fromEntries(process.argv.slice(3).map((a) => a.replace(/^--/, "").split("=")));
  if (!wave || !args.checked) { console.error("usage: decide-wave.mjs <wave> --checked=<n> [--hold=id,id] [--pass=id,id] [--on=YYYY-MM-DD]"); process.exit(1); }
  const manifest = JSON.parse(readFileSync(join(import.meta.dirname, `../../public/private/camphawk/maps/waves/wave-${nn(wave)}.json`), "utf8"));
  const looks = JSON.parse(readFileSync(join(LAB, `first-look/wave-${nn(wave)}.json`), "utf8")).looks;
  const list = (s) => (s ? s.split(",").filter(Boolean) : []);
  const file = decideWave({ wave, manifest, looks, hold: list(args.hold), pass: list(args.pass), checked: Number(args.checked), on: args.on ?? new Date().toISOString().slice(0, 10) });
  writeFileSync(join(LAB, `decisions/wave-${nn(wave)}.json`), JSON.stringify(file, null, 1) + "\n");
  const n = (d) => file.decisions.filter((x) => x.decision === d).length;
  console.log(`wave ${wave}: ${n("approved")} approved, ${n("hidden")} hidden`);
}
