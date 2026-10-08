# Site maps for split listings and single units: the design contract

*2026-10-08. Lab only. Comps: `/private/camphawk/golden-hour/admin/site-maps/layouts`
(`?split=pick|stack&unit=card|wide&s=<id>&u=<id>`). Components: `src/lab/camphawk/round2/AreaMaps.tsx`;
the area split: `src/lab/camphawk/round2/maps/areas.ts` (tested in `areas.test.mts`).*

## Brief
1. **Subject and audience:** a camper on the campground page, often on a phone, deciding whether a
   site suits them and where it is. Daylight, at home or in a car park; the page is light.
2. **Mode:** Operate. Clarity first; CampHawk's own look (`camphawk-design`, `ch-*` tokens) in the details.
3. **The one job:** a camper can find any site of a split listing and read its surroundings; for a
   single unit, find where the one place is and how to reach it. Proof: Find a site lands on the
   right area; the unit's nearest road and coordinates are one glance away.
4. **Fixed:** the site map itself (drawing, dots, pins, Find a site, zoom, key), the copy rules,
   never colour alone, the palette, CampHawk's design skill.
5. **Free:** how a listing's areas are introduced and arranged; how a single unit's map is framed
   and what sits beside it.

## Why these two exist (measured, wave 1)
- **Split listings were 10 of wave 1's 20 held maps.** One map of Seven Points (six clusters around a
  lake) or Diamond Lake (ten loops along 3.5 km) draws each loop too small to read.
- **1,016 of 3,212 Recreation.gov listings are a single unit**: 377 cabins, 203 group sites, 88 guard
  stations, 71 lookouts, 4 yurts, 273 others. A site map has nothing to tell apart; a location map is
  the useful thing.

## How areas are found (`splitAreas`, not a design choice)
- **Fits in 1.5 km:** one map, as today, **unless a person marks it a split listing** (`oneMap: 0`).
  - Measured on waves 1 and 2 after the first looks: no span separates split listings from big
    campgrounds.
  - At 1.5 km it catches 14 of the 29 the photo called split and splits 2 of the usable maps; at
    1.2 km, 19 and 6; at 800 m, 27 and 27.
  - So the automatic default is conservative, and the first look's call (or the owner's) turns
    the split on. This threshold was set after seeing results, and says so.
- **Sites named by loop** ("A001", "F12"): whole loops in order along the listing, merged while
  they fit in 1 km.
  - If those areas still overlap on the ground (Diamond Lake's G, H and K loops are parallel rows
    ~1.5 km long), the listing is cut by position instead and the areas are named by where they
    are: "North end: loops A, B and D–F", "Middle 1…", "South end…".
- **Otherwise:** groups by 200 m gaps; a group wider than 1 km is cut at its widest gap.
- **Many small groups** (more than 12, or under 4 sites each on average): dispersed, a list rather than
  areas (Au Sable).
- **Names come from the sites:** "Loop A", "Loops B–F", "Sites 001–043". Ranges that would
  interleave ("Sites 003–060" beside "Sites 042–214") are named by position instead.

## Split listings: two directions
**A · One area at a time.**
- **Thesis:** the overview answers "where", and one area's full site map answers "which site". It
  refuses the default of one tiny map of everything.
- **Layout:**
  - an overview of the whole listing with each area outlined and numbered, and a list of areas
    beside it (on a phone, below it);
  - below, one area's site map, titled "1 · Loops A–C".
  - Picking a number or a list row switches area. Find a site searches every area and switches.
- **Signature:** the numbered outlines on the overview match the area titles.
- **Cost:** one tap to see another area; the page stays the length of one map.

**B · Every area, in order.**
- **Thesis:** nothing hidden behind a tap; the page is the listing, area by area.
- **Layout:** the same overview with numbered links, a numbered list of areas, then every area's
  site map in turn, each titled with its number.
- **Cost:** a long page (Seven Points is about 6,900 px at 1440 and 7,000 px on a phone).

## Single units: two directions
**A · Map and facts side by side.**
- **Layout:** a square location map (1.4 km across) with the one place marked by an ink pin and its
  kind ("Fire lookout"). Beside it:
  - what it is ("One fire lookout, sleeps up to 15.");
  - the nearest road on the map and its straight-line distance;
  - its coordinates, with "Open in a maps app".
- **Thesis:** a single unit is a place, not a site to pick.

**B · Wide map with terrain, facts on it.**
- **Layout:** a wide strip of the same map with **USGS 3DEP shaded relief** (public domain, asked for
  live like the aerial photo) multiplied under the roads and water, and the facts in a card over its
  corner (below it on a phone).
- **Thesis:** lookouts and cabins sit on ridges and in valleys; the ground's shape tells you more
  than an empty grey square.
- **Cost:** a live call to USGS per view, or a baked image at build time (not built). The relief is
  real data, not decoration, but it is a new layer and a new look.

## Self-check against the defaults (`tells.md`)
- Nothing here is drawn as a picture. The map is geometry from data, and the relief is a real
  survey.
- No new colours: ink for the selected area and the unit pin (the map's existing "found" ink), the map
  tokens for water and roads. Ochre is not used, because nothing here is "yours".
- State is never colour alone: the selected area is a solid outline, a filled number and
  `aria-pressed`; other areas are dashed.

## Picked and built (2026-10-08)
**The owner picked split A and single A.** Both are built into the waves: the build records each
listing's areas (`split`), the check runs on every area, units get their own check, and the review
page and the lab campground page show campers' view (`CamperMap`). The page never works a split out
for itself; it shows the one the build recorded, so a listing kept as one map stays one. Results
and the first look over the areas: `docs/design/campground-maps.md`, "Areas built in".

## Not settled
- **Dispersed listings** (Au Sable): the build skips roads and water over 5 km, so the comp shows dots
  with no river. A river-and-access-points overview needs its own build path.
- ~~**Building it into the rollout.**~~ **Done 2026-10-08.**
- ~~**Single units' check.**~~ **Done 2026-10-08** (`qa.mjs` `checkUnit`); no unit wave built yet.
- **Coarse areas:** areas are cut at 1 km, so clusters closer than that share one (Lithia Springs,
  Sweetwater, South Sandusky, Dam Site, Lost Lake). A tighter cut for listings a person called
  split is the likely fix; not built.

## Critique (two rounds, a separate critic agent) and the recommendation
| Direction | Round 1 | Round 2 |
|---|---|---|
| Split A · one area at a time | 6 | 7 |
| Split B · every area in order | 4.5 | 4.5 |
| Single A · map and facts side by side | 5.5 | 7 |
| Single B · wide map, facts on it | 6.5 | 6.5 |

**Recommended: split A, and single A** (with the terrain relief that started in B). The critic picked
the same two.

**What round 1 changed:**
- outlines that hug each area's sites instead of boxes;
- numbers outside the outlines, on leaders, with 44 px targets;
- previous and next area buttons;
- the unplaced sites counted;
- on unit maps: north and scale, a pin whose tip is the point, the nearest trail and the nearest
  road separately, lighter roads, and terrain.

**What round 2 changed:** Diamond Lake cut by position, so no area overlaps another (tested), and
the site count is the sites on the areas' maps.

**Still open after two rounds (the ceiling):**
- The relief is soft at some lookouts (USGS's 1/3 arc-second is the finest it serves there).
- The gap between the overview and the list at 1440.
- No inset showing the current area on the area map.
- Au Sable (dispersed) has no river drawn.
