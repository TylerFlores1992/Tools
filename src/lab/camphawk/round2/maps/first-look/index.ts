// Each wave's first look over the aerial photo (playbook §4.5): one JSON per wave,
// { version: 1, wave, by, on, looks: { <id>: { call, note } } }, imported here so the page bundles
// it (a few KB a wave). Add a line per wave. Checked by ../waves.test.mts against the wave's
// manifest. The sample's (wave 0) are in ../sample-review.ts.
import type { FirstLook } from "../sample-review";
import wave01 from "./wave-01.json" with { type: "json" };
import wave02 from "./wave-02.json" with { type: "json" };

export type LooksFile = { version: 1; wave: number; by: string; on: string; looks: Record<string, { call: FirstLook; note: string }> };

export const LOOK_FILES: LooksFile[] = [wave01 as LooksFile, wave02 as LooksFile];
