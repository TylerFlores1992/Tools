// Each wave's first look over the aerial photo (playbook §4.5): one JSON per wave,
// { version: 1, wave, by, on, looks: { <id>: { call, note } } }, imported here so the page bundles
// it (a few KB a wave). Add a line per wave. Checked by ../waves.test.mts against the wave's
// manifest. The sample's (wave 0) are in ../sample-review.ts.
import type { FirstLook } from "../sample-review";
import wave01 from "./wave-01.json" with { type: "json" };
import wave02 from "./wave-02.json" with { type: "json" };
import wave03 from "./wave-03.json" with { type: "json" };
import wave04 from "./wave-04.json" with { type: "json" };
import wave05 from "./wave-05.json" with { type: "json" };
import wave22 from "./wave-22.json" with { type: "json" };
import wave23 from "./wave-23.json" with { type: "json" };
import wave24 from "./wave-24.json" with { type: "json" };
import wave25 from "./wave-25.json" with { type: "json" };
import wave30 from "./wave-30.json" with { type: "json" };
import wave31 from "./wave-31.json" with { type: "json" };
import wave32 from "./wave-32.json" with { type: "json" };
import wave33 from "./wave-33.json" with { type: "json" };
import wave34 from "./wave-34.json" with { type: "json" };
import wave35 from "./wave-35.json" with { type: "json" };
import wave36 from "./wave-36.json" with { type: "json" };
import wave39 from "./wave-39.json" with { type: "json" };

export type LooksFile = { version: 1; wave: number; by: string; on: string; looks: Record<string, { call: FirstLook; note: string }> };

export const LOOK_FILES: LooksFile[] = [wave01 as LooksFile, wave02 as LooksFile, wave03 as LooksFile, wave04 as LooksFile, wave05 as LooksFile, wave22 as LooksFile, wave23 as LooksFile, wave24 as LooksFile, wave25 as LooksFile, wave30 as LooksFile, wave31 as LooksFile, wave32 as LooksFile, wave33 as LooksFile, wave34 as LooksFile, wave35 as LooksFile, wave36 as LooksFile, wave39 as LooksFile];
