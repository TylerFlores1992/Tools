# Batch west-b

Waves 6, 7, 8 (us-west, multi). Branch `wip/maps-west-b`.

## Setup (2026-10-08)
- Network probe: every map host answers (ridb, imagery/hydro.nationalmap, tigerweb, services2.arcgis,
  tylerflores.dev 200; nps, fs.usda, api.openstreetmap 301). Geofabrik resets as known; the extract
  comes from openstreetmap.fr.
- RIDB export: files dated 2026-10-07 18:45 (same export the specs were planned on).
- osmium-tool 1.16.0 installed (needed `apt-get update` first).
- OSM extract us-west: OSM as of 2026-10-07T00:17:45Z.


## Wave 06 (us-west, multi)
- Built 94, failed 0
- Check: ready 64, review 30, not drawn 0
- First look: good 22, usable 42, hold 10, unsure 20
- Traced: none. Looked at 251616 (Santiam Flats), 272092 (Kinnikinnick) and 233895 (Walton Lake) for traces; the lanes' joins or the spurs sit under trees, too faint to place within 3 m.
- Split calls: 233739 (Swan Creek: two clusters 800 m apart; rebuilt, now 2 areas that follow them)
- Held, and why:
  - 232118 Turlo: only the highway drawn; sites cluster under trees by the buildings.
  - 232891 Goldledge: Forest Service loop drawn round the outside; the sites sit on undrawn inner roads.
  - 233102 Robinson Creek South: 010 to 024 sit 40 to 100 m from any drawn lane under trees; east loop crosses open ground.
  - 233303 Fry Creek: no roads at all; sites scattered on scrub with no visible pads.
  - 234001 Los Prietos: sites scattered on an open field, matching nothing on the photo.
  - 234135 Fashoda: highway drawn off the pavement; most sites on undrawn lanes and the bare lake bed.
  - 234761 Lost Claim: drawn loop doesn't match the visible lanes.
  - 251577 Allen Springs: Census loop crosses the forest; sites on an undrawn lane by the river.
  - 251616 Santiam Flats: only the highway drawn; the loop and river lane show but their joins are under trees.
  - 272092 Kinnikinnick: only the shore road drawn; peninsula lanes under trees.
- Anything new: hydro.nationalmap.gov (USGS water) didn't answer for a few maps; the build fell back to OSM water as designed. Many Pacific Northwest maps are under full canopy (20 unsure).

## Wave 07 (us-west, multi)
- Built 94, failed 0 (10163053 Sloway timed out on the first run; built on the retry)
- Check: ready 62, review 30, not drawn 2 (232022 Boulder Basin, 234106 Fremont: stacked sites)
- First look: good 19, usable 38, hold 8, unsure 29
- Traced: 232906 (Lower Billy Creek: the shore lane, joined to the highway; checked over the photo, within about 3 m)
- Split calls: 266144 (Sand Flats Group C: Datura A to D and E-1/E-10 1.2 km apart). After the rebuild the build calls it "2 groups of sites: dispersed camping, not drawn as areas yet" rather than drawing areas; the tests pass. Orchestrator: check this is what the area rules intend.
- Held, and why:
  - 10060948 Cavitt Creek Falls: only the highway drawn; paved lanes show, but their join to the highway is under trees.
  - 231906 Hideout Canyon boat-in: nothing drawn shows how the sites are reached.
  - 232022 Boulder Basin: not drawn (38% stacked).
  - 232186 Mount Rose: drawn lanes don't match the visible ones.
  - 232267 Red Feather: one loop drawn; most of 60 sites 50 to 200 m from any road.
  - 234106 Fremont: not drawn (50% stacked).
  - 234381 Stoddard Creek: drawn lanes don't follow the visible lanes; lower loop undrawn.
  - 251567 Contorta Flat: only the lake road drawn; sites across an open flat with no traceable lane.
- Anything new: the dune listings (234195, 234196, 234200) are already split into areas by the build; the sites are on bare sand, so two are unsure.

STATUS: started
