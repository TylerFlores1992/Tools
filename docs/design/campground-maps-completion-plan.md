# Finishing every Recreation.gov campground map: the plan (2026-10-08)

*Owner: "find a solution for all of the usable and unusable maps so we can have everything
complete. Be thorough and search what we can do." Built on a census of every held and "usable"
map (`research/campground-maps-held-causes.md`) and a search for public data and methods
(`research/campground-maps-fix-sources.md`).
Pilots and their results are recorded here as they finish.*

## Where it stands
- **3,211 Recreation.gov maps built.**
  - 1,527 passed in the delegated waves 3 to 39, plus the owner's approvals in waves 0 to 2.
  - **1,489 are hidden.** 55 were hidden by the owner; 1,434 are held to fix after.
  - **689 passed as "usable"**: right, but missing something a "good" map has.
- Every count below is from the census: one blocking cause per map, taken from its first-look note
  and its measured checks. In a spot check of 30, about 25 matched the note exactly and the rest
  were a neighboring cause, so read the counts as close, not exact.

## The causes, and the fix for each

| Blocking cause | Hidden | Usable | Fix | Status |
|---|---|---|---|---|
| Canopy hides the lanes | 692 | 130 | **Trace over lidar relief** (below) | Built 2026-10-08; pilot running |
| Drawn road off the visible lane | 112 | 47 | Replace trace from the photo | Tool exists; needs tracing |
| Lanes visible but not drawn | 93 | 155 | Trace from the photo | Tool exists; needs tracing |
| Unit pin on nothing | 77 | 1 | Forest Service cabin points (Alaska); lidar for a clearing | Researched; not built |
| Unit pin 15–150 m off a visible building | 67 | 24 | **Move the pin** (site-move trace) | Built 2026-10-08; 40 of 79 now pass |
| Only the access road drawn | 58 | 13 | Trace from the photo or the lidar | Tool exists |
| A third or more of the sites roadless | 49 | 7 | Trace from the photo or the lidar | Tool exists |
| Dispersed sites, not one campground | 40 | 3 | Dispersed-area design | **Owner's decision** |
| Split into areas, split wrong | 39 | 23 | Split calls (gap / maxSpan), or the split design | Tool exists |
| No lane visible to trace | 37 | 47 | Lidar; else accept the sites where they are | Partly |
| Can't be drawn (sites on one spot) | 31 | 0 | Parking rows dropped (built); stacked twins need moves | Partly built |
| Photo can't show it (snow, flood, blur) | 29 | 6 | Lidar (snow doesn't hide the ground) or a past NAIP year | Built (lidar) |
| First-come: nothing at the pin | 24 | 0 | Move the pin to the campground the photo shows | Built (site move) |
| Site points misplaced | 24 | 13 | Move the points | Built (site move) |
| Sites stacked on one spot | 19 | 11 | Move the points | Built (site move) |
| Stray point km away | 15 | 0 | **Left off by rule** | Built 2026-10-08; with the parking rule, 8 of 17 rebuilt now pass |
| No public-domain photo (Alaska) | 15 | 0 | USGS IfSAR radar image | **Owner's decision** (licence unclear) |
| Unit pin wrong, listing's own point right | 12 | 0 | Move the pin to the listing's point | Built (site move); in the 79 below |
| Unit right, no road reaches it | 6 | 67 | Trace the last stretch; fly-in and boat-in are right as drawn | Tool exists |
| First-come: another campground's outline | 8 | 0 | **Outline-name check** | Built 2026-10-08 |
| Other | 47 | 142 | Case by case | — |

## What was built for this (2026-10-08)
- **Outline-name check:** a first-come map takes only an outline named for this campground, or an
  unnamed one (docs/design/campground-maps-first-come.md, "Outline names").
- **Site moves:** a trace can move a listed site to where the photo shows it
  (studio/campground-maps/README.md, Traces). The first real one is Windfall Lake Cabin.
- **Stray points and parking rows:**
  - A point 2 km or more from every other site is left off the map (at most two per listing,
    and only when five or more sites are left). The camper's search says why.
  - BLM's "Extra Vehicle" parking rows are no longer drawn as sites.
  - **Result (2026-10-09):** the two rules rebuilt 17 held maps. After a check over the photo,
    8 pass and are approved. The other 9 stay held for a second cause (roads off the lane, or
    canopy). Two more maps in the owner's waves 1 and 2 were rebuilt and are left for the owner.
- **Lidar relief:** the ground under the trees, from USGS 3DEP lidar (public domain) and, in
  Oregon, DOGAMI's lidar (public domain, credit DOGAMI). It is rendered as fine relief: the
  ground minus a smoothed copy of itself, with a low-sun hillshade.
  - Crowned lanes, ditches and levelled pads show under full canopy.
  - It's on the review page (Photo / Lidar relief) and in the tracing tool, and `LIDAR=1` works
    on aerial-grid and aerial-check.
  - A trace drawn over the relief credits it in the map's credits.

## Public data searched (`research/campground-maps-fix-sources.md`)

**Used:**
- **USGS 3DEP lidar:** a federal work, public domain. 1 m or finer lidar covers 1,143 of the 1,489
  hidden maps, and 532 of the ~700 canopy holds.
- **Oregon DOGAMI lidar:** "All DOGAMI lidar data is in the public domain, please reference
  DOGAMI as the data source" (DOGAMI's lidar program record on data.gov). It covers the 56–61
  Oregon canopy holds that 3DEP doesn't cover at 1 m.

**Researched, not used yet:**
- **State leaf-off photos (Arkansas 2023, North Carolina, Kentucky):** they show lanes through
  bare trees for about 79 canopy holds.
  - Kentucky is "Public Domain with Attribution".
  - Arkansas and North Carolina state no licence on their services; they need an email to the
    state before use.
  - Lidar covers the same maps, so they're a cross-check, not needed.
- **USGS IfSAR orthorectified radar image (Alaska, 0.625 m):** it shows Marion Creek's loops
  plainly. USGS calls it public domain, but the tile metadata says "Purchase" and mentions an end
  user licence. **Ask USGS before publishing anything traced from it.** It would cover 5–10 of
  the 15 Alaska maps that have no photo.
- **Forest Service cabin points (Alaska):** 148 of the 166 held Alaska cabin maps match one by
  name. These points sit a median 117 m from the Recreation.gov pin, and in 3 of 4 spot checks
  the Forest Service point was the one at the cabin. As a point source for "pin on nothing" units
  (a federal work, public domain), it would cover an estimated 50–70.
- **Past NAIP years (2004–2023):** they're not leaf-off, so they help only snow, blur or cloud
  holds (~28).

**Ruled out:**
- Virginia's leaf-off photos (a university copy "for teaching purposes").
- Washington's photos (licensed).
- Microsoft's road detections. They find only lanes visible on Bing's photo, never hidden ones,
  and they were mined from Bing imagery.
- Overture: no campground outlines beyond OpenStreetMap.
- The Corps' recreation points (no campsites).
- An automatic lane detector on the relief, which found ditches and creek banks, not inner lanes.

## Decisions for the owner
1. **The dispersed-area design (40 maps):** listings that aren't one campground (backcountry
   permits, boat-in shores). Should they show as a list of places, or a map per area, or stay off?
2. **USGS IfSAR for interior Alaska (5–10 maps):** write to USGS to confirm the licence?
3. **Arkansas and North Carolina leaf-off photos:** ask the states? This is optional, because
   lidar covers the same maps.
4. **The size of the tracing campaign** (below): run it all, or by demand, highest first?

## The campaign
- **Lidar pilot (running):** 25 high-demand canopy holds with 1 m lidar (22) or DOGAMI (3). It
  measures how many the relief makes traceable, and the time per map.
- **Pin moves (done 2026-10-09):** 79 unit maps held because the pin sat off the cabin, lookout or
  station.
  - 35 pins moved to the building the photo shows. Four of them went to the listing's own point,
    0.8–10 km away, where the photo shows the building and the old pin showed nothing.
  - Four more pins were already right on a closer look.
  - All 40 were checked over the photo after the rebuild and approved.
  - 39 stay held: no building shows plainly, several buildings could be it, or the photo can't
    tell. Crescent Lake was moved and then put back, because a row of lakeside cabins makes the
    station's cabin ambiguous. The Forest Service cabin points (above) are the next source to try
    on these.
- **Then, in batches by demand,** each with a final check over the photo and the relief:
  - ~600 canopy holds over lidar;
  - ~320 photo traces (lanes visible but not drawn, roads off the lane, only the access road,
    roadless thirds);
  - the "usable" maps' undrawn lanes (~155), to make them good.
