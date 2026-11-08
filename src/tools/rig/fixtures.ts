import { buildList } from "./build.ts";
import { newDesign } from "./templates.ts";
import type { BuildList } from "./types.ts";

/** The build lists the connector's tests run (scripts/rig-fixtures.mts writes them). */
export function rigFixtures(): Record<string, BuildList> {
  return {
    "cube-top": buildList(newDesign("cube")),
    "cube-both": buildList(newDesign("cube", { braces: "both" })),
    goalpost: buildList(newDesign("goalpost")),
    tower: buildList(newDesign("tower")),
    flown: buildList(newDesign("flown")),
    stage: buildList(newDesign("stage")),
    roof: buildList(newDesign("roof")),
    "stage-full": buildList(newDesign("stage", { width: 144, depth: 96, height: 36, rail: "three", stairs: 2 })),
  };
}
