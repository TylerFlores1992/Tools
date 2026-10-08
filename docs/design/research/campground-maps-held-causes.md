*Copied 2026-10-08 from the session that measured it; file paths it names (scripts, test images) were in that session's scratchpad and aren't kept.*

# Why Recreation.gov campground maps are held or only "usable" (measured 2026-10-08)

Read-only. Every number below is counted from the repo files (decisions/, first-look/, sample-review.ts, the built maps, wave manifests) and the FY2025 RIDB reservation counts; per-map detail is in `held-causes.json`.

## Totals

- Maps built: 3,211 (wave 0 sample 50, waves 1-39 3,161). Decisions recorded: 3,102 (1,613 approved, 1,489 hidden); 109 in the owner waves have no decision (wave 0: 27, wave 1: 44, wave 2: 38).
- **Hidden: 1489** — owner waves 0-2: 55; delegated waves 3-39: 1434.
  - by first-look call: hold 687, unsure 631, usable 171 (the usable ones were held on the final check's re-read against the usable bar, or kept hidden by the owner).
- **Approved with first look "usable": 689** — owner 35, delegated 654.
- Not in the totals: 32 owner-wave maps with a "usable" look and no decision yet (listed in the JSON with decision "undecided").

| Kind | Hidden | (of which hold / unsure / usable-called) | Approved usable | Undecided usable |
|---|---|---|---|---|
| multi-site | 947 | 440 / 343 / 164 | 497 | 32 |
| areas | 71 | 57 / 9 / 5 | 36 | 0 |
| dispersed | 25 | 22 / 3 / 0 | 1 | 0 |
| unit | 402 | 134 / 268 / 0 | 112 | 0 |
| firstcome | 44 | 34 / 8 / 2 | 43 | 0 |
| **all** | **1489** | 687 / 631 / 171 | **689** | 32 |

| Wave group | Hidden | Approved usable |
|---|---|---|
| Owner, waves 0-2 | 55 | 35 |
| Delegated final check, waves 3-39 | 1434 | 654 |

Kind: `firstcome` = a one-"Standard"-site first-come listing; `unit` = single cabin/lookout/group site; `areas`/`dispersed` = the build split the listing; everything else `multi-site`.

**Photo:** hidden — naip 1302, usfs-r10 154, usfs-r10-rgb 15, none 15, usfs-r10-0.6m 2, naip-hawaii 1; approved usable — naip 673, usfs-r10 13, usfs-r10-rgb 2, naip-hawaii 1.

**Road source (multi-site/areas/dispersed only):** hidden — osm 732, usfs 121, tiger 70, none 61, nps 59; approved usable — osm 420, nps 43, usfs 37, tiger 33, none 1.

## Causes

Each map gets every cause its first-look note (and decision note) states, plus four measured from the map: `NO_PHOTO` (aerial.ts picks "none"), `NOT_DRAWN` (qa verdict), `STRAY_POINT` (qa outliers: at most 2, nearest other site >= 2 km, or the note says so), `ROADLESS_THIRD` (note says so, or >= 1/3 of placed sites > 40 m from every drawn road; distances computed from the map's own road paths, since `sites[].out` is a direction vector, not metres). **Blocking** = the first cause in this order: listing/point data wrong → unit/first-come specifics → the photo can't show it → road geometry wrong → lanes missing → minor. For `unsure` calls the photo cause (no photo / unfit / canopy) comes first; weak canopy mentions ("spurs the trees hide") rank after the lane codes.

| Cause | Hidden: blocking | Hidden: any | Usable: blocking | Usable: any | Examples (hidden first) | Dominant agency / states | Fix |
|---|---|---|---|---|---|---|---|
| `NO_PHOTO` No public-domain aerial photo covers the place (Alaska interior, Kenai Fjords, Lake Clark, Tongass cabins outside flown blocks) | 15 | 15 | 0 | 0 | 252494 White Mountains National Rec (AK); 233317 KENAI NATIONAL WILDLIFE REFU (AK); 251861 Kenai Fjords National Park C (AK) | BLM 7, NPS 5 · AK 15 | Different imagery source (none public-domain known); or owner's call to pass on the map alone |
| `NOT_DRAWN` The automatic check can't draw it: every site on one spot, or over 25% stacked (incl. BLM 'Extra Vehicle' twins) | 31 | 34 | 0 | 0 | 251431 Oregon Inlet Campground (NC); 256367 Pictured Rocks National Lake (MI); 253730 Cumberland Island National S (GA) | USFS 18, BLM 5 · CA 9, ? 4, ID 4 | Data fix in the build: drop 'Extra Vehicle' twins / one-spot listings need another source of points |
| `STRAY_POINT` One or two RIDB points hundreds of m to thousands of km from the rest, blowing up the frame | 15 | 15 | 0 | 0 | 232553 Clear Springs (TX) (TX); 233518 INDIAN CREEK (MO) (MO); 233703 BURNS RUN WEST (OK) | USACE 9, USFS 5 · OK 3, MO 3, CO 2 | Build rule: drop far outliers (the 300 m outlier rule flags but doesn't drop); or move the point |
| `DISPERSED` Not one campground: dispersed / backcountry / boat-in sites spread over km | 40 | 46 | 3 | 3 | 10028875 Big Bend Backcountry Camping (TX); 233700 BLOOMINGTON EAST (KS); 232567 DAM SITE(GREERS FERRY) (AR); 231932 STRAWBERRY BAY (UT); 10294618 Englebright Lake Boat-In Cam (CA) | USFS 25, NPS 7 · MI 14, CA 6, UT 5 | Can't fix as a site map: needs the dispersed-area design (a list of places, or a map per area) |
| `SPLIT_AREAS` Split listing shown as areas, but the split is wrong or an area is too small/empty to read | 39 | 46 | 23 | 23 | 232507 ASSATEAGUE ISLAND NATIONAL S (MD); 232607 Holiday (Texas) (TX); 231980 DIAMOND LAKE (OR); 232498 SANTA CRUZ ISLAND SCORPION (CA); 233553 Mill Creek Camping (Berlin L (OH) | USACE 35, USFS 21 · AR 10, OR 9, OK 5 | Split calls (gap/maxSpan), or the split-listing design |
| `STACKED` Several sites on one spot / pad (stacked points, reused numbers) | 19 | 77 | 11 | 15 | 233510 HIGHLAND RIDGE (WI); 10207636 Look Rock Campground (TN); 10054654 Spadra (AR); 10300216 Zephyr Cove RV & Campground (NV); 232745 WILLIS CREEK (TX) | USFS 14, USACE 14 · AR 5, TX 3, AZ 3 | Move points (or dedupe twins); RIDB coordinates wrong |
| `SITES_MISPLACED` Site points not on the pads: shifted off, on water, on the road line, on an invented grid, in farmland | 24 | 41 | 13 | 13 | 249979 POTWISHA CAMPGROUND (CA); 232541 CANAL (KY); 234590 MORGANTON POINT (GA); 233483 Dam West Campground (IL); 234062 FORT SPOKANE (WA) | USFS 21, USACE 10 · CA 9, UT 5, MO 4 | Move points from the photo, or a better point source (OSM pitches where mapped) |
| `UNIT_LISTING_POINT_RIGHT` Unit pin on nothing, while the listing's own (facility) point sits on the building | 12 | 12 | 0 | 3 | 234248 FIVEMILE BUTTE LOOKOUT (OR); 234247 CLEAR LAKE CABIN LOOKOUT (?); 234713 PINE VALLEY GUARD STATION (UT) | USFS 12 · UT 3, MT 2, ID 2 | Rule: fall back to the listing's point when the unit pin is on nothing (not built) |
| `UNIT_BUILDING_NEARBY` Unit pin 15-150 m off a building/clearing that plainly is the unit | 67 | 104 | 24 | 47 | 232948 WINDFALL LAKE CABIN (AK); 232940 JOHN MUIR CABIN (AK); 233272 SWAN GUARD STATION (MT); 234457 CAMP FOUR AND HALF CABIN (CA); 234241 RADEKE CABIN (NH) | USFS 85, NPS 3 · CA 17, AK 15, OR 9 | Move the pin to the visible building ('move pin' trace, not built) |
| `UNIT_PIN_ON_NOTHING` Unit pin on water, meadow, muskeg, scrub or unbroken forest with nothing that could be the unit | 77 | 178 | 1 | 7 | 234379 OWL CREEK CABIN (MT); 233010 ROMIG CABIN (AK); 10300370 Trail River Cabin (AK); 232786 FRENCH GULCH (CA) | USFS 78 · AK 38, CA 13, OR 6 | Can't fix from this photo alone: needs a better point (agency data) or a person who knows the place |
| `UNIT_POINTS_DISAGREE` Unit pin and the listing's own point >300 m apart and neither confirmed | 7 | 58 | 3 | 17 | 233095 ITALIO RIVER CABIN (AK); 234275 BONANZA CCC GROUP CAMPGROUND (ID); 231964 Big Pine Equestrian Group Ca (CA); 233903 RIVER EDGE (OR); 233358 SUMMIT LAKE STOCK CORRAL (CA) | USFS 8, NPS 2 · CA 3, AK 3, AZ 1 | Agency data / owner's call |
| `FC_CLOSED` First-come listing says closed | 0 | 1 | 1 | 1 | 10165165 Blair Lake Campground (?) | USFS 1 · ? 1 | None: show the closed notice |
| `FC_OUTLINE_OTHER_CAMPGROUND` First-come: the OSM outline within reach belongs to another campground (name mismatch / two listings share one ring) | 8 | 8 | 0 | 0 | 10165200 Caribou Campground (?); 10165430 Lower O'Brien Campground (?); 10191075 Lake Cleveland Campground -  (?) | USFS 8 · ? 6, AZ 1, CA 1 | Build rule: match the outline's name to the listing's |
| `FC_OUTLINE_SPLIT` First-come: OSM outlines the campground as several small rings; the map takes one | 1 | 1 | 0 | 0 | 10165315 Gothic (?) | USFS 1 · ? 1 | Merge rings / trace the outline |
| `FC_OUTLINE_WRONG` First-come: the outline is a parking lot / something else | 1 | 4 | 0 | 0 | 10165270 Dexter (?) | USFS 1 · ? 1 | Trace the outline from the photo |
| `FC_NOTHING_AT_PIN` First-come: no outline and nothing near the pin is plainly a campground | 24 | 28 | 0 | 0 | 10165440 Matchless (?); 10165686 Tabor (?); 10165535 Piety Island (?) | USFS 24 · ? 22, OR 2 | Trace an outline where the photo shows one; otherwise agency point |
| `FC_POINT_OFF` First-come: listed point outside the outline (40-120 m, on the approach road, in the river) | 0 | 2 | 17 | 18 | 10165205 Casino Creek (?); 10165385 Iron Creek Campground (ID) (?) | USFS 17 · ? 13, CA 4 | Accept (usable) or snap the point to the entrance |
| `PHOTO_UNFIT` The photo itself can't show it: winter/snow, flood, too dark/soft/blurred, frame past the photo's edge | 29 | 32 | 6 | 7 | 232702 SEVEN POINTS (TN) (TN); 232103 Spruces - Big Cottonwood (UT); 232684 RAGLAND BOTTOM (TN); 232025 BRIDGER LAKE CAMPGROUND (UT); 232104 STATELINE (UT) | USFS 23, USACE 8 · UT 19, TN 5, OK 2 | Different NAIP year (leaf-off/snow-free) or another public-domain source |
| `CANOPY` Canopy hides the lanes/pads, so the roads can't be traced or confirmed | 692 | 878 | 130 | 204 | 232493 FISH CREEK CAMPGROUND (MT); 232448 Tuolumne Meadows Campground (CA); 10124502 Azalea Campground (CA); 10171274 Apgar Campground (MT); 258832 Headwaters Campground at Fla (WY) | USFS 605, USACE 143 · OR 95, AK 91, CA 87 | Leaf-off imagery (older NAIP year) or lidar-derived roads (USGS 3DEP hillshade); else can't fix |
| `UNIT_NOT_CONFIRMED` Unit pin in the right area (group camp, station compound) but which building/pad is the unit isn't plain | 16 | 65 | 7 | 15 | 233256 CAMP 4 GROUP CAMPGROUND (CA); 253457 Hittle Bottom Group Site (UT); 251903 GROUP LANDING (FL); 234569 SNYDER GUARD STATION (WY) (WY); 232239 Rock Creek Lake Group Camp ( (CA) | USFS 22, BLM 1 · CA 6, AK 6, UT 2 | Accept as 'about here' or get the agency's point |
| `ROAD_OFF_LANE` Source road drawn off the visible lane: coarse/angular TIGER or USFS polygon, OSM 'bubble' loop, area outline drawn as road, phantom road | 112 | 187 | 47 | 64 | 234039 MANZANITA LAKE (CA); 233489 Downstream (MT) (MT); 234156 BUTTE LAKE (CA); 10075120 Boulder Beach Campground (NV); 234038 Chisos Basin Campground (Big (TX) | USFS 93, USACE 43 · CA 36, OR 19, OK 13 | 'Replace' trace from the photo |
| `DENSE_WEB` A dense web of pull-through / herringbone lanes, too many to trace with the grid tool | 2 | 5 | 4 | 5 | 232039 DUCK CREEK (UT); 234530 RIBBONWOOD EQUESTRIAN CG (CA); 231987 EAST SULLIVAN (WA); 231903 FIREFIGHTERS CAMPGROUND (UT) | USFS 5, BLM 1 · UT 2, CA 1, WA 1 | Trace with the review page's tracing tool |
| `ROADS_MISSING` Only the access road / highway is drawn, or no source has any campground road | 58 | 166 | 13 | 14 | 234060 Newhalem Creek Campground (?); 232673 PINEY GROVE (MS); 232194 CAVE SPRING (AZ); 250877 Red Rock Canyon Campground (NV); 233655 TULE (CA) | USFS 40, USACE 21 · CA 11, OR 9, ? 6 | Trace from photo where visible; else needs another road source |
| `LANES_VISIBLE_UNDRAWN` Lanes/spurs plainly visible on the photo but not drawn | 93 | 261 | 155 | 197 | 232462 Rocky Mountain National Park (CO); 234052 Black Canyon Of The Gunnison (CO); 232781 HUME LAKE (?); 232463 Rocky Mountain National Park (CO); 232572 DEFEATED CREEK PARK (TN) | USFS 178, USACE 48 · CA 45, OR 30, UT 27 | Trace from photo |
| `NO_LANE_VISIBLE` Sites off the drawn roads on open ground where no lane shows (pads off the lane, faint tracks) | 37 | 137 | 47 | 54 | 233671 West Overlook Campground (IA); 233635 SPARROWFOOT (MO); 233182 SANDY FLAT (CA); 232250 SERRANO (CA); 234032 Alexander Springs Recreation (FL) | USFS 65, USACE 15 · CA 11, OR 10, UT 9 | Can't trace: accept (sites right) or move points |
| `LANES_UNDRAWN_UNSPECIFIED` Short spurs/lanes not drawn; the note doesn't say whether they show | 10 | 247 | 70 | 134 | 232271 SHERWIN CREEK (CA); 232717 TAR CAMP (AR); 233672 WHEATLAND PARK (MO); 232496 Furnace Creek Campground (CA); 234674 SEAWALL CAMPGROUND (?) | USFS 44, USACE 24 · CA 10, UT 9, ? 8 | Trace where visible |
| `ONE_SITE_OFF` A single site placed 40-500 m off the rest, likely a misplaced point | 0 | 18 | 1 | 19 | 233699 RUARK BLUFF WEST (MO) | USACE 1 · MO 1 | Move one point |
| `ROADLESS_THIRD` A third or more of the sites with no drawn road (note says so, or >=1/3 of sites >40 m from any drawn road) | 49 | 485 | 7 | 21 | 232615 KENDALL CAMPGROUND (KY); 234181 POTTERS CREEK PARK (TX); 232669 PICKENSVILLE CG (PICKENSVILL (AL); 10004152 Camp 4 (CA); 233264 KALISPELL ISLAND BOAT-IN CAM (ID) | USFS 25, USACE 18 · CA 10, ? 5, AR 5 | Trace from photo if visible; under canopy: imagery |
| `WALKIN_NO_LANE` Walk-in / boat-in / tent sites with footpaths, correctly roadless | 0 | 51 | 10 | 30 | 232445 WATCHMAN CAMPGROUND (UT); 232451 Hodgdon Meadow Campground (CA) | NPS 4, USFS 4 · CA 3, OR 2, UT 1 | Can't fix by roads: genuinely roadless (design could draw paths) |
| `UNIT_NO_ACCESS` Unit pin right, but no drawn road or trail reaches it (incl. boat/fly-in) | 6 | 122 | 67 | 67 | 233045 SAMSING COVE CABIN (AK); 232994 HARRISON LAGOON CABIN (AK); 232975 JACK BAY CABIN (AK); 234337 FORD CABIN (MT); 234607 MAXEY CABIN (MT) | USFS 68, USACE 2 · AK 17, MT 13, OR 8 | Trace the last stretch where it shows; fly/boat-in is correct as is |
| `FC_NO_OUTLINE` First-come: no outline, pin 'About here' only | 0 | 31 | 11 | 15 | 10165716 Twin Peaks (CO) (?); 10165255 Deer Creek Campground (?) | USFS 11 · ? 10, AZ 1 | Trace the outline from the photo |
| `FC_OUTLINE_ROUGH` First-come: outline roughly the campground (extra forest/lot, one loop outside) | 0 | 0 | 5 | 6 | 10165661 South Mineral (?); 10165530 Pettit Lake Campground (?) | USFS 5 · ? 5 | Accept, or trace |
| `SITES_UNPLACED` Some sites have no point in RIDB | 1 | 138 | 2 | 98 | 10145521 Woods Ferry Campground (SC) (SC); 233598 RIANA - ABIQUIU LAKE (NM); 255134 LEFT TAILRACE (SD) | USACE 2, USFS 1 · SC 1, NM 1, SD 1 | Data |
| `UNCLASSIFIED` Note didn't match any rule | 4 | 0 | 11 | 0 | 234184 CURRIER GUARD STATION (OR); 233037 LAKE EVA CABIN (AK); 231955 OBSIDIAN FLAT (CA); 232369 CAMP DICK (CO); 232865 Pine Point Campground (Timot (OR) | USFS 14, USACE 1 · CA 5, OR 3, ID 2 |  |
| **total** | **1489** | | **689** | | | | |

## By kind of fix (blocking cause)

| Fix family | Hidden | Approved usable | Hidden, owner waves | Hidden, delegated |
|---|---|---|---|---|
| Listing/point data (move points, build rules) | 176 | 54 | 4 | 172 |
| Dispersed / split listings (design, not data) | 79 | 26 | 18 | 61 |
| First-come outline/point | 34 | 34 | 0 | 34 |
| Imagery can't show it (canopy, no/unfit photo) | 736 | 136 | 25 | 711 |
| Unit pin on nothing / unconfirmed (needs better point) | 93 | 8 | 0 | 93 |
| Trace from the photo (replace or add) | 324 | 296 | 8 | 316 |
| Genuinely roadless / accept | 43 | 124 | 0 | 43 |
| Unclassified | 4 | 11 | 0 | 4 |

## Hidden: blocking cause by kind

| Kind | Top blocking causes |
|---|---|
| multi-site (947) | `CANOPY` 475, `ROAD_OFF_LANE` 110, `LANES_VISIBLE_UNDRAWN` 91, `ROADS_MISSING` 56, `ROADLESS_THIRD` 49, `NO_LANE_VISIBLE` 37 |
| areas (71) | `SPLIT_AREAS` 33, `STRAY_POINT` 13, `CANOPY` 8, `DISPERSED` 6, `STACKED` 3, `ROADS_MISSING` 2 |
| dispersed (25) | `DISPERSED` 21, `NO_PHOTO` 3, `STRAY_POINT` 1 |
| unit (402) | `CANOPY` 199, `UNIT_PIN_ON_NOTHING` 77, `UNIT_BUILDING_NEARBY` 67, `UNIT_NOT_CONFIRMED` 16, `UNIT_LISTING_POINT_RIGHT` 12, `UNIT_POINTS_DISAGREE` 7 |
| firstcome (44) | `FC_NOTHING_AT_PIN` 24, `CANOPY` 10, `FC_OUTLINE_OTHER_CAMPGROUND` 8, `FC_OUTLINE_WRONG` 1, `FC_OUTLINE_SPLIT` 1 |

**Canopy, the largest single cause (692 hidden):** by call unsure 527, hold 131, usable 34; by kind multi-site 475, unit 199, firstcome 10, areas 8; by photo naip 601, usfs-r10 90, usfs-r10-rgb 1; agencies Forest Service 524, US Army Corps of Engineers 108, National Park Service 50; states AK 91, OR 86, WA 80, CA 73, ? 56, AR 32, NC 23, GA 22.

**Usable bar, measured:** of 534 approved-usable multi-site/areas maps, 16 have a third or more of their placed sites more than 40 m from every drawn road (owner waves 1, delegated 15). Median share > 40 m: 0.00; > 20 m: 0.17. Examples: 10294618 Englebright Lake Boat-In Campg (1.00); 233264 KALISPELL ISLAND BOAT-IN CAMPG (1.00); 10039993 Garden Point Boat-in Campgroun (1.00); 231893 JACKS CREEK GROUP AREA (1.00); 10119505 Haleakalā National Park (Wilde (1.00); 251263 Rohrbach Group Campground (0.90). (A site 40 m from a drawn road can still sit on a visible spur, so this is a flag for a second look, not a verdict.)

## The 30 most-reserved hidden maps (FY2025 overnight camping reservations, RIDB)

Waves 3-39 were ordered most-reserved first within each region (specs carry the order, not the counts); counts here are from the FY2025 RIDB reservations file, per facility.

| # | Id | Name | State | Wave | Kind | Call | Reservations FY25 | Blocking | Other causes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 232507 | ASSATEAGUE ISLAND NATIONAL SEASHORE CAMPGROUND | MD | 2 | areas | hold | 21,662 | `SPLIT_AREAS` | SITES_UNPLACED |
| 2 | 234039 | MANZANITA LAKE | CA | 3 | multi-site | hold | 13,619 | `ROAD_OFF_LANE` | ROADS_MISSING, CANOPY |
| 3 | 251431 | Oregon Inlet Campground | NC | 14 | multi-site | hold | 12,948 | `NOT_DRAWN` | STACKED |
| 4 | 232493 | FISH CREEK CAMPGROUND | MT | 3 | multi-site | unsure | 12,415 | `CANOPY` | LANES_UNDRAWN_UNSPECIFIED |
| 5 | 232448 | Tuolumne Meadows Campground | CA | 3 | multi-site | hold | 10,568 | `CANOPY` | SITES_UNPLACED |
| 6 | 232462 | Rocky Mountain National Park Glacier Basin Campground | CO | 22 | multi-site | usable | 10,553 | `LANES_VISIBLE_UNDRAWN` | ROADLESS_THIRD |
| 7 | 10124502 | Azalea Campground | CA | 3 | multi-site | unsure | 10,552 | `CANOPY` | SITES_UNPLACED |
| 8 | 232593 | GUNTER HILL | AL | 1 | multi-site | hold | 9,053 | `CANOPY` | ROADS_MISSING, ROADLESS_THIRD |
| 9 | 249979 | POTWISHA CAMPGROUND | CA | 3 | multi-site | hold | 8,861 | `SITES_MISPLACED` | ROADS_MISSING, LANES_UNDRAWN_UNSPECIFIED, ROADLESS_THIRD |
| 10 | 232489 | North Rim Campground (AZ) | AZ | 3 | multi-site | hold | 8,796 | `CANOPY` | LANES_UNDRAWN_UNSPECIFIED |
| 11 | 247559 | Gulpha Gorge Campground | AR | 14 | multi-site | unsure | 8,135 | `CANOPY` | SITES_UNPLACED |
| 12 | 232607 | Holiday (Texas) | TX | 1 | areas | hold | 7,669 | `SPLIT_AREAS` | LANES_UNDRAWN_UNSPECIFIED |
| 13 | 234060 | Newhalem Creek Campground | ? | 3 | multi-site | hold | 7,648 | `ROADS_MISSING` | LANES_UNDRAWN_UNSPECIFIED |
| 14 | 232727 | TWIN LAKES (SC) | GA | 1 | multi-site | hold | 7,630 | `CANOPY` | ROADLESS_THIRD |
| 15 | 231980 | DIAMOND LAKE | OR | 1 | areas | hold | 7,327 | `SPLIT_AREAS` | SITES_UNPLACED |
| 16 | 10028875 | Big Bend Backcountry Camping | TX | 14 | dispersed | hold | 7,272 | `DISPERSED` | ROADS_MISSING, WALKIN_NO_LANE, ROADLESS_THIRD |
| 17 | 234052 | Black Canyon Of The Gunnison South Rim Campground | CO | 22 | multi-site | usable | 6,787 | `LANES_VISIBLE_UNDRAWN` | ROADLESS_THIRD |
| 18 | 232474 | GREENBELT CAMPGROUND | MD | 14 | multi-site | unsure | 6,624 | `CANOPY` | LANES_UNDRAWN_UNSPECIFIED, SITES_UNPLACED |
| 19 | 233420 | BAILEYS POINT | KY | 1 | multi-site | hold | 6,587 | `CANOPY` | ROADS_MISSING, ROADLESS_THIRD |
| 20 | 232615 | KENDALL CAMPGROUND | KY | 1 | multi-site | hold | 6,524 | `ROADLESS_THIRD` | LANES_VISIBLE_UNDRAWN, SITES_UNPLACED |
| 21 | 233700 | BLOOMINGTON EAST | KS | 1 | areas | hold | 6,263 | `DISPERSED` | SPLIT_AREAS, LANES_UNDRAWN_UNSPECIFIED |
| 22 | 232541 | CANAL | KY | 1 | multi-site | hold | 6,241 | `SITES_MISPLACED` | CANOPY, ROADLESS_THIRD |
| 23 | 232432 | MATHEWS ARM CAMPGROUND | VA | 14 | multi-site | unsure | 6,231 | `CANOPY` |  |
| 24 | 232037 | DOGWOOD | CA | 1 | multi-site | unsure | 6,158 | `CANOPY` | SITES_MISPLACED, WALKIN_NO_LANE, SITES_UNPLACED |
| 25 | 232567 | DAM SITE(GREERS FERRY) | AR | 1 | areas | hold | 6,063 | `DISPERSED` | SPLIT_AREAS, CANOPY, ROADLESS_THIRD |
| 26 | 232673 | PINEY GROVE | MS | 1 | multi-site | hold | 6,057 | `ROADS_MISSING` | ROADLESS_THIRD |
| 27 | 256367 | Pictured Rocks National Lakeshore Backcountry Camping Permit | MI | 19 | multi-site | hold | 6,011 | `NOT_DRAWN` | DISPERSED, STACKED, ROADS_MISSING, LANES_UNDRAWN_UNSPECIFIED, WALKIN_NO_LANE, ROADLESS_THIRD |
| 28 | 233613 | SOUTH SANDUSKY CAMPGROUND | IL | 2 | areas | hold | 5,660 | `SPLIT_AREAS` |  |
| 29 | 232702 | SEVEN POINTS (TN) | TN | 2 | multi-site | hold | 5,608 | `PHOTO_UNFIT` | CANOPY, ROADLESS_THIRD |
| 30 | 233408 | AXTEL | KY | 2 | multi-site | hold | 5,589 | `SPLIT_AREAS` | LANES_VISIBLE_UNDRAWN |

Reservations in hidden maps: 1,145,605 FY25 overnight reservations (1353 of 1489 hidden maps have any); approved-usable maps: 827,066.

## Method and assumptions

- Population: every built map (3,211) whose recorded decision is `hidden`, or whose first look is `usable` and decision `approved`; plus 32 owner-wave `usable` maps with no decision, kept apart. A later wave's decision file would win (none overlap). First looks: wave 0 from `sample-review.ts`, waves 1-39 from `first-look/` (the first-come and Alaska/Hawaii re-looks are already in those files).
- Causes are read from the notes by keyword rules (`held/classify.py`), refined over ~250 hand-read notes. A random audit of 30 hidden maps agreed with the blocking code for about 25; the misses were neighbouring codes (canopy vs roads-missing vs a third roadless, one stacked). Expect some mislabelling between neighbouring road codes (e.g. `LANES_VISIBLE_UNDRAWN` vs `NO_LANE_VISIBLE` when a note says lanes "show faintly"). The blocking order is a choice, stated above, not something the notes record.
- `roadlessShare` uses the drawn `roads` only (not trails or lots), 40 m as the "no drawn road" proxy; units and first-come maps have none.
- State is blank in RIDB for some listings (shown as ?; most first-come Pike-San Isabel and some NPS/USFS).
- Photo source follows `aerial.ts` (PICKS, then Hawaii/Alaska boxes, else NAIP).
- Reservation counts: `counts-fy25.json` built earlier by `reservations-count.py` from RIDB `reservations2025.zip` (overnight CAMPING rows per facility).
