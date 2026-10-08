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
import wave06 from "./wave-06.json" with { type: "json" };
import wave07 from "./wave-07.json" with { type: "json" };
import wave08 from "./wave-08.json" with { type: "json" };
import wave09 from "./wave-09.json" with { type: "json" };
import wave10 from "./wave-10.json" with { type: "json" };
import wave11 from "./wave-11.json" with { type: "json" };
import wave12 from "./wave-12.json" with { type: "json" };
import wave13 from "./wave-13.json" with { type: "json" };
import wave14 from "./wave-14.json" with { type: "json" };
import wave15 from "./wave-15.json" with { type: "json" };
import wave16 from "./wave-16.json" with { type: "json" };
import wave17 from "./wave-17.json" with { type: "json" };
import wave18 from "./wave-18.json" with { type: "json" };
import wave19 from "./wave-19.json" with { type: "json" };
import wave20 from "./wave-20.json" with { type: "json" };
import wave21 from "./wave-21.json" with { type: "json" };
import wave22 from "./wave-22.json" with { type: "json" };
import wave23 from "./wave-23.json" with { type: "json" };
import wave24 from "./wave-24.json" with { type: "json" };
import wave25 from "./wave-25.json" with { type: "json" };
import wave26 from "./wave-26.json" with { type: "json" };
import wave27 from "./wave-27.json" with { type: "json" };
import wave28 from "./wave-28.json" with { type: "json" };
import wave29 from "./wave-29.json" with { type: "json" };
import wave30 from "./wave-30.json" with { type: "json" };
import wave31 from "./wave-31.json" with { type: "json" };
import wave32 from "./wave-32.json" with { type: "json" };
import wave33 from "./wave-33.json" with { type: "json" };
import wave34 from "./wave-34.json" with { type: "json" };
import wave35 from "./wave-35.json" with { type: "json" };
import wave36 from "./wave-36.json" with { type: "json" };
import wave37 from "./wave-37.json" with { type: "json" };
import wave38 from "./wave-38.json" with { type: "json" };
import wave39 from "./wave-39.json" with { type: "json" };

export type LooksFile = { version: 1; wave: number; by: string; on: string; looks: Record<string, { call: FirstLook; note: string }> };

export const LOOK_FILES: LooksFile[] = [wave01 as LooksFile, wave02 as LooksFile, wave03 as LooksFile, wave04 as LooksFile, wave05 as LooksFile, wave06 as LooksFile, wave07 as LooksFile, wave08 as LooksFile, wave09 as LooksFile, wave10 as LooksFile, wave11 as LooksFile, wave12 as LooksFile, wave13 as LooksFile, wave14 as LooksFile, wave15 as LooksFile, wave16 as LooksFile, wave17 as LooksFile, wave18 as LooksFile, wave19 as LooksFile, wave20 as LooksFile, wave21 as LooksFile, wave22 as LooksFile, wave23 as LooksFile, wave24 as LooksFile, wave25 as LooksFile, wave26 as LooksFile, wave27 as LooksFile, wave28 as LooksFile, wave29 as LooksFile, wave30 as LooksFile, wave31 as LooksFile, wave32 as LooksFile, wave33 as LooksFile, wave34 as LooksFile, wave35 as LooksFile, wave36 as LooksFile, wave37 as LooksFile, wave38 as LooksFile, wave39 as LooksFile];
