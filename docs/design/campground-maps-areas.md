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
- **Fits in 1.5 km** (the check's spread limit): one map, as today.
- **Sites named by loop** ("A001", "F12"): whole loops, merged in letter order while they fit in 1 km.
  A loop is never cut in two.
- **Otherwise:** groups by 200 m gaps; a group wider than 1 km is cut at its widest gap.
- **Many small groups** (more than 12, or under 4 sites each on average): dispersed, a list rather than
  areas (Au Sable).
- **Names come from the sites:** "Loop A", "Loops B–F", "Sites 001–043".

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

## Not settled (after the owner picks)
- **Dispersed listings** (Au Sable): the build skips roads and water over 5 km, so the comp shows dots
  with no river. A river-and-access-points overview needs its own build path.
- **Building it into the rollout:** `build-wave.mjs` should record the areas (and the single-unit
  frame) so the review page shows campers' view, and the checks should judge each area, not the
  whole listing.
- **Single units' check:** today every one reads "every site is on one spot" (not drawn). They need
  their own check: a point, and a road or trail within reach.
