// The review queue's waves: wave 0 is the 50-campground sample (bundled with the page); waves 1+
// are built by studio/campground-maps/build-wave.mjs, listed in waves.json, and their manifests are
// fetched from /private/camphawk/maps/waves/ when one is chosen (2,196 maps' manifests would be too
// much to bundle). Each wave's first look over the aerial photo is first-look/wave-NN.json (first-look/index.ts).
import index from "./waves.json" with { type: "json" };
import { SAMPLE, type Sample, type SampleEntry } from "./sample";
import { FIRST_LOOK, type FirstLook } from "./sample-review";
import { LOOK_FILES } from "./first-look";

/** A map in a wave. Why a campground is in its wave (watched on CampHawk, or most reserved) is
    never stored: the repository is public, and the watched list can point to a person. */
export type WaveEntry = SampleEntry;
/** A campground whose build failed (a source didn't answer): listed, never counted as a verdict. */
export type FailedEntry = { id: string; name: string; agency: string; state: string; recArea: string; error: string };
export type WaveInfo = {
  wave: number;
  built: string;
  count: number;
  summary: Sample["summary"];
  order: string;
  export: string;
  /** Every campground in the wave, so a link with only ?id= finds its wave. */
  ids: string[];
};
export type Looks = { by: string; on: string; looks: Record<string, { call: FirstLook; note: string }> };
export type Wave = {
  info: WaveInfo;
  /** Drawn at random (wave 0), so its shares estimate the whole population. */
  random: boolean;
  population: Sample["population"];
  entries: WaveEntry[];
  failed: FailedEntry[];
  looks: Looks | null;
};

const SAMPLE_INFO: WaveInfo = {
  wave: 0,
  built: SAMPLE.built,
  count: SAMPLE.entries.length,
  summary: SAMPLE.summary,
  order: `Drawn at random (seed ${SAMPLE.drawn.seed}), stratified by agency`,
  export: SAMPLE.drawn.export,
  ids: SAMPLE.entries.map((e) => e.id),
};

/** Every wave, oldest first: the sample, then what build-wave.mjs has listed. */
export const WAVES: WaveInfo[] = [SAMPLE_INFO, ...(index.waves as WaveInfo[]).filter((w) => w.wave > 0).sort((a, b) => a.wave - b.wave)];
export const LATEST_WAVE = WAVES.at(-1)!.wave;
export const waveLabel = (n: number) => (n === 0 ? "Sample" : `Wave ${n}`);
/** The wave a campground is in, if any. */
export const waveOf = (id: string) => WAVES.find((w) => w.ids.includes(id))?.wave ?? null;

export const SAMPLE_WAVE: Wave = {
  info: SAMPLE_INFO,
  random: true,
  population: SAMPLE.population,
  entries: SAMPLE.entries,
  failed: [],
  looks: { by: "the session that built the sample", on: "2026-10-07", looks: FIRST_LOOK },
};

const pad = (n: number) => String(n).padStart(2, "0");

/** A built wave's manifest entries, split into maps and failed builds. */
export function splitEntries(raw: (WaveEntry | (FailedEntry & { verdict?: undefined }))[]): { entries: WaveEntry[]; failed: FailedEntry[] } {
  const entries: WaveEntry[] = [], failed: FailedEntry[] = [];
  for (const e of raw) {
    if ("error" in e && e.error) failed.push(e as FailedEntry);
    else entries.push(e as WaveEntry);
  }
  return { entries, failed };
}

/** Load wave n (the sample synchronously; a later wave from the server). Throws if it won't load. */
export async function loadWave(n: number): Promise<Wave> {
  if (n === 0) return SAMPLE_WAVE;
  const info = WAVES.find((w) => w.wave === n);
  if (!info) throw new Error(`no wave ${n}`);
  const res = await fetch(`/private/camphawk/maps/waves/wave-${pad(n)}.json`);
  if (!res.ok) throw new Error(`wave ${n}: HTTP ${res.status}`);
  const manifest = await res.json();
  const file = LOOK_FILES.find((f) => f.wave === n);
  const looks = file ? { by: file.by, on: file.on, looks: file.looks } : null;
  return { info, random: false, population: manifest.population, ...splitEntries(manifest.entries), looks };
}

/** The first look's call as a status, in shape and word (never colour alone). */
export const LOOK_LEVEL: Record<FirstLook, "ok" | "warn" | "fail"> = { good: "ok", usable: "warn", unsure: "warn", hold: "fail" };

/**
 * Whether a map needs the owner's decision: anything the check held, and anything the first look
 * calls not usable or can't tell, even when every check passed. Wave 1 had four of the second
 * kind (Cave Spring, Bloomington East, Wheeler Gorge, Cagle); without this they'd go live unseen.
 */
export function needsDecision(e: { verdict: string }, call: FirstLook | undefined): boolean {
  return e.verdict !== "ready" || call === "hold" || call === "unsure";
}
