*Copied 2026-10-08 from the session that measured it; file paths it names (scripts, test images) were in that session's scratchpad and aren't kept.*

# Fixing the held campground maps: public sources and methods

Research only, 2026-10-08. Nothing in `/home/user/Tools` was edited. Scripts are in
`$S/scripts/`, images and data in `$S/research/` (S = this session's scratchpad).

## How the held set was counted

`held.py` joins every `decisions/*.json` row marked `hidden` (1,489 maps) with its first-look
note and its map file. The causes come from keyword matches in those notes, so they are
estimates, not a census:

| Cause (keyword match on the notes) | Held maps |
|---|---|
| Canopy hides lanes ("canopy", "under the trees" ...) | ~703 |
| Roads missing or off the lane | ~414 (overlaps the canopy group) |
| Site coordinates stacked, on water, stray | ~50 (38 Forest Service, 9 Corps) |
| Snow, winter, blur or cloud in the photo | ~28 (14 in Utah) |
| First-come or outline notes | ~68 |
| Pull-through webs | ~7 named |

By agency: Forest Service 1,078, Corps 259, Park Service 108, BLM 34. By state, the canopy holds
are led by OR 85, AK 85, WA 77, CA 76, AR 44, NC 22, MI 21, GA 19, ID 19, WI 18.

---

## A. Seeing under canopy

### A1. USGS 3DEP bare-earth elevation, rendered as micro-relief (the strongest finding)

- **Source:** `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer`
  (dynamic service, best available DEM at each spot; raster functions include Hillshade Gray,
  Hillshade Multidirectional, Slope Map, Slope Degrees, None). Coverage index:
  `https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer` (layer 24 =
  lidar projects with `dem_gsd_meters`, `ql`, `collect_end`).
- **Licence:** US federal work, public domain. Service copyright text: *"USGS National Map 3D
  Elevation Program (3DEP)."* USGS products carry the standard disclaimer; acknowledgement is
  requested, not required.
- **Coverage, measured against the held maps** (point query at each map's centre, `lidar_cov.py`,
  three passes; 6 queries still failed):
  - all 1,489 held: **1,143 have a DEM at 1 m or finer**, 95 only coarser lidar (mostly 3 m
    "legacy"), 236 no lidar, 9 point cloud only;
  - the ~703 canopy holds: **532 have 1 m or finer** (350 of them QL1), 40 only coarser, 118 none.
  - Canopy holds without 1 m by state: AK 65, OR 61, WA 11, MN 7, WI 4, CA 3, others 1-2.
- **Resolution:** 1 m (QL2) or 0.5 m (QL1) where lidar exists; the service resamples to
  whatever is asked.
- **Reached from this sandbox:** yes. `exportImage` with `renderingRule={"rasterFunction":"None"}`,
  `pixelType=F32`, `format=tiff` → `200`, 2.7-4.6 MB float TIFF in 2-4 s per map frame.
  Hillshade/Slope renders → `200` in 1-10 s.
- **What the stock renders show:** the server's Hillshade and Slope Map are too coarse a stretch
  for a campground; lanes barely show. **A local "micro-relief" render does show them:**
  elevation minus an 8 m smoothed copy, clipped to ±0.3 m, blended with a low-sun
  multidirectional hillshade (`scripts/micro.py`, numpy only).
- **Tested on 4 held maps:**
  - **Gulpha Gorge 247559 (AR, QL1/QL2):** all three interior lanes and both loops show as crowned
    lines with ditches (`t247559-micro-crop.png`). The NAIP photo shows none of the middle lanes.
  - **Lower Falls 250032 (WA):** "full canopy, no lane shows anywhere" on NAIP; the micro-relief
    shows the west loop, the spur roads and the main road (`t250032-pair.jpg`).
  - **Deep Creek 10041304 (NC, QL1):** the east loop shows **each pull-in pad** as a comb along the
    lane, and the west area shows rows of level pads (`t10041304-pair.jpg`).
  - **Yellowbottom 274721 (OR):** only a 2012 3 m "legacy" collection; mush. The index says so
    ahead of time (`dem_gsd_meters: 3`), so a map can be routed by its lidar quality.
- **What it would fix:** the canopy group, where lidar is 1 m or finer: ~532 maps, plus Oregon via
  DOGAMI (A2). Not every lane cuts the ground: a flat valley floor with gravel lanes level with
  the forest floor shows faintly. **Estimate (unverified beyond 4 maps): half to two-thirds of the
  532 become traceable, ~250-350 maps.**
- **Effort:** small. A third "photo" in the review page and the tracing tool (an image layer per
  map, made once by a build step from the float TIFF). It is relief, not a photo, so the review
  rules need one line: a lane may be traced from the relief where the photo shows only canopy,
  and the credit names USGS 3DEP. ~1-2 days.

### A2. Oregon: DOGAMI lidar (fills the biggest 3DEP gap)

- **Source:** `https://gis.dogami.oregon.gov/arcgis/rest/services/lidar/DIGITAL_TERRAIN_MODEL_MOSAIC/ImageServer`
  (also `..._HS`, `DIGITAL_TERRAIN_SLOPE_MODEL_MOSAIC`); footprints in
  `.../lidar/DOGAMI_Lidar_Project_Status/MapServer` (layers 1, 2 = completed projects).
- **Licence:** DOGAMI's lidar program description (quoted on its data.gov record): *"All DOGAMI
  lidar data is in the public domain, please reference DOGAMI as the data source."* The image
  service's own licence field is empty. **Treat as public domain with credit; the quote was read
  through a search summary, not the page itself (unverified).**
- **Coverage:** all **61 Oregon canopy holds with no 3DEP 1 m** sit inside a completed DOGAMI/OLC
  project (46 at 3 ft, 15 at 1 m). The mosaic falls back to a coarse DEM outside lidar, so check
  the footprint layer, not a pixel value.
- **Resolution:** 3 ft (0.91 m) or 1 m.
- **Reached:** yes, `200`, 3-7 MB float TIFF per map.
- **Tested:** Oak Fork 232868 (Timothy Lake) and Cultus Lake 251580: loops and spurs clear;
  Toketee 251907 faint (`og-sheet.jpg`). Yellowbottom faint (2012 collection).
- **Fixes:** most of the 61, est. ~40. **Effort:** the same pipeline as A1 with a second URL.

### A3. Forest Service regional bare-earth DEMs on IIPP

- **Source:** `https://imagery.geoplatform.gov/iipp/rest/services/Terrain/BareEarthDEM_multiYear_USFS_R{3_Southwest,5_PacificSW,9_Eastern,10_Alaska}_multiRes_Public/ImageServer`
- **Licence (from each service's metadata, read):** *"Additionally, the U.S. Forest Service waives
  copyright and related rights in the work worldwide through the CC0 (which can be found at
  https://creativecommons.org/public-domain/cc0/)."*
- **Resolution:** 0.3-0.5 m.
- **Coverage:** small. R10's extent is one block near Ketchikan; none of the 65 Alaska canopy
  holds and none of the MN/WI/CA gaps returned data at the map centre.
- **Reached:** yes (`200` JSON, `identify` returns `NoData` at the tested holds).
- **Fixes:** ~0 of the current gaps. Keep as a fallback.

### A4. Lidar point clouds and intensity

- **Source:** USGS 3DEP LPC as Entwine Point Tiles, `s3://usgs-lidar-public`
  (`https://s3-us-west-2.amazonaws.com/usgs-lidar-public/`); listing reached (`AK_BrooksCamp_2012/`
  etc.). Project names differ from the index's names, so a lookup table is needed.
- **Licence:** public domain (USGS).
- **What it adds over A1:** intensity separates gravel/asphalt from duff, which would mark a
  lane that is level with the forest floor. **Not tested:** no `laspy`/`pdal` here.
- **Effort:** medium-high (install a LAZ reader, fetch EPT nodes, grid intensity of ground
  returns). Only worth it after A1 if many lanes stay faint.

---

## B. Leaf-off or alternate-year imagery

### B1. State leaf-off orthoimagery (tested where it matters most)

| State | Service (reached = `200` + image) | Season, resolution | Licence | Held / canopy holds |
|---|---|---|---|---|
| **Arkansas** | `https://gis.arkansas.gov/arcgis/rest/services/ImageServices/IMAGERY_9IN_2023/ImageServer` (also `IMAGERY_1FT_2017`, `DEM_1M_2018`, `DEM_HALF_METER_2026`) | Jan 19-Feb 28 2023, 20 cm; 2017 also Jan-Feb | **Unverified.** Service licence field empty, metadata has no constraint. FEMA's 2020 SOP lists the 2017 set with "Fee associated? No". Needs written confirmation from the Arkansas GIS Office. | 60 / 44 |
| **North Carolina** | `https://services.nconemap.gov/secure/rest/services/Imagery/Orthoimagery_Latest/ImageServer` | leaf-off, 6 in, quarter of the state a year | Service says *"Please refer to https://www.nconemap.gov/pages/terms"* (page is script-rendered, not read). Older NC OneMap text: *"free to use by anyone without restriction"*. **Unverified for derived commercial maps.** | 30 / 22 |
| **Kentucky** | `https://kyraster.ky.gov/arcgis/rest/services/ImageServices/Ky_KYAPED_Phase3_3IN_WGS84WM/ImageServer` (and Phase2 6 in); also `s3://kyfromabove` | leaf-off, 3-6 in, 2010-2025 | AWS Open Data registry: *"Public Domain with Attribution"*; *"KyFromAbove acquires aerial imagery and LiDAR during leaf-off conditions."* | 19 / 13 |
| Virginia | VBMP leaf-off (2021 6 in, 2022 3 in) | spring leaf-off | Only found as William & Mary copies "for teaching purposes"; VGIN's own terms not found. **Not usable until VGIN confirms.** | 15 / 11 |
| Pennsylvania | PAMAP via PASDA | some leaf-off | PASDA catalog "Access Rights: Public"; no licence text found. Unverified. | 10 / 3 |
| New York | NYSDOP | many leaf-off | Some tiles classified; licence unclear. | 1 / 0 |
| Tennessee | STS-GIS / TDOT | unclear | Older county imagery sold; no open licence found. | 15 / 6 |
| Oregon OSIP | `imagery.oregonexplorer.info` | summer | Licence field names the program, no terms. **TLS certificate expired** from this sandbox (`curl: (60)`). | — |
| Washington | statewide 1 ft | — | Described as *"licensed imagery data"* (2016). Not usable. | — |

- **Tested:** Gulpha Gorge on Arkansas 2023 shows every lane and every trailer pad
  (`ar2023-247559.jpg`). Deep Creek on NC's leaf-off shows the loops and the pull-ins
  (`nc-latest-10041304.jpg`). A Kentucky Corps hold (232541) on KYAPED leaf-off shows the lanes
  through bare trees (`ky-sheet.jpg`).
- **Fixes:** AR + NC + KY ≈ **79 canopy holds, 109 held maps**, if the licences hold. Arkansas
  alone is 44 canopy holds.
- **Effort:** low technically (another `AerialSource` entry in `aerial.ts` per state). The
  real work is a licence email to each state office; Kentucky is the only one already in writing.

### B2. Past NAIP years (IIPP)

- **Source:** `https://imagery.geoplatform.gov/iipp/rest/services/NAIP/NAIP{2004..2023}_CONUS/ImageServer`
  plus `NAIP{year}_CONUS_AcquisitionDates/MapServer/<state layer>` (gives the flight date).
- **Licence:** USDA NAIP, public domain (as already credited in `aerial.ts`). The IIPP item text is a
  no-warranty disclaimer.
- **Coverage:** CONUS, every year a state was flown (roughly biennial). 0.3-1 m.
- **Reached:** yes. Deep Creek returned images for 2009-2022 (odd years blank there).
- **Finding:** some flights are late October (NC 2018: 29 Oct 2018 from the dates layer), but
  Deep Creek's 2018 and 2022 frames are still in leaf. **Past NAIP is not a leaf-off source.**
- **Fixes:** the ~28 snow/blur/cloud holds (14 in Utah), by picking a clean year. ~20 maps.
- **Effort:** low: a per-map year pick, the way `PICKS` already picks an Alaska service.

### B3. USGS NAIPPlus / HRO

- `https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer` (reached,
  `200`). Its text: NAIP *"and high resolution orthoimagery (HRO)"*, 6 in to 1 m. At the three
  tested holds it returned the same leaf-on NAIP. HRO is mostly older urban collections
  (unverified for any campground). **Little use.**

### B4. NOAA coastal imagery (Digital Coast)

- Public domain (federal). Coastal strip only. `coast.noaa.gov/arcgis/rest/services` reached
  (`200`). Not tested on a campground; relevant only to coastal maps like Assateague. Low priority.

---

## C. Better roads and site data

### C1. Forest Service INFRA recreation sites and subsites

- **Source:** `https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_RecInfraRecreationSites_02/MapServer`
  (0 = sites, 1 = subsites); `EDW_MVUM_01/02`; `EDW_RoadBasic_01` (already used).
- **Licence:** US federal work, public domain. (EDW layers carry the Forest Service no-warranty
  disclaimer; CC0 text was not checked on these.)
- **Coverage:** layer 1 has only **838 subsites nationwide** (types include LOOP, CAMP UNIT,
  CAMP UNIT - TRAILER/RV): a scattering, not campsite coverage. Layer 0 has **237 Alaska Region
  cabins** with their own points (used in D1).
- **Reached:** yes (`200`). MVUM adds no campground lanes beyond RoadBasic (it is the
  motor-vehicle subset). **FSTopo:** a regional AGOL copy exists, not checked (unverified).
- **Fixes:** cabins (D1); loop points for a handful of maps.

### C2. Corps of Engineers

- **Source:** `https://geospatial.sec.usace.army.mil/server/rest/services/Recreation/Recreation_Site/FeatureServer/0`
  (reached, `200`, **4,855 points**). Fields: area name, entrance lat/lon, acres, Camp/Boat/Beach flags.
- **Licence:** US federal work. No campsite or lane layer found. **Fixes:** none directly
  (it is one point per recreation area). The 259 Corps holds need A1/B1 instead.

### C3. Park Service

- **Source:** `https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets/NPS_Public_POIs/MapServer/0`
  (reached). **3,859 points of type "Campsite"**, plus "Campfire Ring", "Backcountry Campsite".
  NPS_Public_Roads is already used.
- **Licence:** NPS national datasets, public domain (federal).
- **Coverage on held maps:** only **6 of 108 NPS holds** have 3+ NPS campsite points: Assateague
  232507 (153), Glacier Basin 232462 (163), Big Bend backcountry 10028875 (66), Apostle Islands
  251865 (48), Chilkoot 10382456 (27), Houchin Ferry 258992 (12).
- **Effort:** small; use as a site-position check for those 6.

### C4. BLM

- `https://gis.blm.gov/arcgis/rest/services/transportation/BLM_Natl_GTLF_Public_Display` (roads)
  and `recreation/BLM_Natl_Recs_poly` / `_pts` (recreation polygons with a Campground subtype).
  Reached. Public domain. Only 34 BLM holds; the polygons could give first-come outlines for BLM
  sites (not tested).

### C5. Microsoft Road Detections

- **Source:** `https://github.com/microsoft/RoadDetections`; North America file
  `https://usaminedroads.z19.web.core.windows.net/drops/2025.04.28/Northern_America.zip`
  (3.96 GB, reached at ~10.7 MB/s).
- **Licence:** README: *"The data is freely available for download and use under the Open Data
  Commons Open Database License (ODbL)."* Mined from *"Bing Maps imagery including Maxar and
  Airbus."* **Owner's call:** the licence allows it (ODbL with credit, as for OSM), but the
  lines were detected on Bing imagery, which the project otherwise keeps out.
- **Coverage on held maps (the whole file streamed and filtered, 69.8 M lines, 13,533 kept):** of
  1,262 held maps with a compact frame outside Alaska, 1,193 have over 50 m of detected road in
  the frame; of 615 canopy holds, 584. **But the detections are of what Bing's photo shows.** On
  Gulpha Gorge they follow only the through-road and one visible lane; on Deep Creek, the main
  roads and the day-use loop. **None of the lanes hidden under the canopy is detected**
  (`msroads-sheet.jpg`). So it does nothing for cause 1. It might fill cause 2 where a lane is
  visible but missing from every source; that was not measured.
- **Effort:** a one-off stream filter (`msroads_filter.py`), then treat it as a fifth road source
  in `roads.mjs`, scored by the same fit.

### C6. Overture

- Transportation theme: ODbL, *"Most of the data in the transportation theme is sourced from
  OpenStreetMap"*, TomTom added from 2024-09. Places: CDLA-Permissive-2.0 (points). Base/land use:
  ODbL from OSM. **No campground lanes or `tourism=camp_site` outlines beyond what OSM already
  has.** Little to gain over the OSM extract the pipeline uses. Not downloaded.

### C7. Giving traces back to OpenStreetMap (note only)

- Our traces are our own work over public-domain NAIP and 3DEP, so we may license them to OSM.
  NAIP is on OSM's accepted imagery list, and 3DEP lidar hillshade is a common tracing layer
  (unverified for the current editor-layer index). Adding them by hand under a CampHawk account is
  ordinary mapping; a bulk upload is an "import" and needs the US community's import review.
  Whether to do it is the owner's decision.

---

## D. Fixing site coordinates

### D1. Forest Service Alaska cabin points (tested)

- **Source:** `EDW_RecInfraRecreationSites_02/MapServer/0`, `region='10' and site_type like '%CABIN%'`.
- **Licence:** federal, public domain.
- **Coverage:** 237 cabins. **148 of the 166 held Alaska cabin maps** name-match one within 5 km.
- **How far apart:** RIDB pin vs Forest Service point, quartiles **1 / 55 / 117 / 192 m**, max 4.6 km.
- **Spot check over the Forest Service Alaska photo** (`cabins-sheet.jpg`, circle = RIDB,
  square = Forest Service): Point Amargura and Peterson Lake have the RIDB pin on water and the
  Forest Service point on land by the shore; Dan Moller's Forest Service point sits ~20 m from the
  visible cabin, RIDB's 190 m away in forest; John Muir unclear. **3 of 4 better.**
- **Fixes:** the 51 "pin on water/forest" and 19 "cabin 20-150 m away" cases in Southeast Alaska,
  est. ~50-70 maps once a person confirms each against the photo.
- **Effort:** small: a "move the pin" proposal from the Forest Service point, confirmed by eye.

### D2. Park Service campsite points

- The 6 maps in C3. Public domain.

### D3. OSM `camp_pitch`

- Already read by the pipeline (`qa.metrics.pitches`). ODbL with credit. No new data.

### D4. Corps campsites

- No public Corps campsite layer found (C2). The 9 Corps coordinate holds stay manual.

---

## E. Automation to scale tracing

- **Prototype run here (`scripts/lanes.py`, numpy + scipy, CPU, <5 s per map):** a Hessian line
  filter on the lidar micro-relief, kept where slope < 12°. On Gulpha Gorge and Deep Creek it
  finds the main road's ditches and creek banks but **misses most interior lanes**
  (`lanes-sheet.jpg`). A naive detector is not good enough to propose lanes.
- **What is realistic on a CPU:**
  1. Show the micro-relief as a layer in the tracing tool (A1) and let a person trace. This is the
     bulk of the gain.
  2. "Snap" an existing road source (OSM, Forest Service, Microsoft) to the nearest lane crown in
     the relief within ~10 m (an active-contour or a least-cost path on the relief). It moves
     lines that are "drawn off the visible lane" (cause 2) and needs no model.
  3. Least-cost path between two points a person clicks, over a cost of slope plus relief
     roughness: a person clicks ends, the tool proposes the lane. Good for pull-through webs (cause 6).
- **Open models:** no open-licensed road model for lidar relief was found (unverified).
  `onnxruntime` is installed, so a small model could run on CPU if one turns up.
- **Microsoft Road Detections** (C5) is the only ready-made "proposal" dataset.

---

## F. Interior Alaska, no photo

### F1. USGS IfSAR Orthorectified Radar Image (ORI), tested

- **Source:** TNM Access dataset *"Ifsar Orthorectified Radar Image (ORI)"*; files at
  `https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/ORI/TIFF/` (zipped cells of 15′ tiles,
  5-25 GB per zip). One tile can be pulled with HTTP range requests (`ziplist.py`, `zipget.py`):
  Marion Creek's tile was 885 MB, 49 s.
- **Licence:**
  - USGS media page for the ORI: *"Public Domain"*;
  - the dataset metadata: *"Access_Constraints: None ... Acknowledgement of the originating
    agencies would be appreciated in products derived from these data."*;
  - **but the tile-level source XML says `accconst: Purchase`, `useconst: End User License
    Agreement`** (likely the contractor's original metadata). **Ask USGS to confirm before
    publishing.**
- **Coverage:** statewide Alaska (2010-2022 collections). The index answered for 9 of the 15
  no-photo maps; the rest failed with HTTP 400 (flaky service).
- **Resolution:** 0.625 m, radar intensity (grey, speckled, not a photo).
- **Tested:** **Marion Creek 10191011 (Dalton Highway): both loops, the cross lanes and the
  highway are plain, with the RIDB sites lining the lanes** (`ori-marion.png`).
- **Fixes:** most of the 6 Dalton Highway / White Mountains campground maps. Cabins (Kenai Refuge,
  Kenai Fjords, Lake Clark, Yakutat, Tongass) are single buildings that may show as bright points;
  not tested. Est. **5-10 of the 15.**
- **Effort:** medium: pre-cut one small PNG per map from the tile (Alaska Albers, EPSG:3338,
  `scripts/albers.py`), stored as a static asset, because there is no image service.

### F2. Others

- **IfSAR DSM/DTM:** 5 m, too coarse for lanes.
- **Sentinel-2:** 10 m; Copernicus terms allow use with *"Contains modified Copernicus Sentinel
  data"* (from memory, unverified). Too coarse for lanes; shows a clearing at most.
- **Landsat:** 30 m, public domain; too coarse.
- **Alaska state SPOT mosaic (SDMI):** licensed, not open (from memory, unverified).
- **3DEP lidar:** the index lists 3 m legacy lidar at Ophir Creek and the Kenai Refuge; nothing
  at the Dalton Highway sites.
- **Park Service imagery for Kenai Fjords / Lake Clark:** nothing found.

---

## Ranked shortlist

1. **3DEP lidar micro-relief as a tracing layer** (A1, plus A2 DOGAMI for Oregon). Covers 593 of
   ~703 canopy holds at ≤1 m. Tested: lanes show at Gulpha Gorge, Lower Falls and Deep Creek.
   Est. 250-400 maps. Public domain.
   - *Test on 3:* 233532 Kyen (CA, oak canopy), 119290 Willaby (WA), 232868 Oak Fork (OR, DOGAMI).
     Fetch the float DEM, render `micro.py`, trace the lanes over it, and compare the traced lanes
     with the sites. Pass if each site is within 20 m of a traced lane.
2. **State leaf-off photos: Arkansas 2023, North Carolina, Kentucky** (B1). ~79 canopy holds.
   Tested on one map each. Kentucky is public domain with attribution in writing; Arkansas and NC
   need an email first.
   - *Test on 3:* 232591 Gamaliel (AR), 234228 Standing Indian (NC), 232541 (KY). Add each as a
     photo source and run the first look again.
3. **IfSAR ORI for interior Alaska** (F1). Marion Creek tested. 5-10 of the 15 no-photo maps.
   Confirm the licence with USGS first (tile metadata conflicts).
   - *Test on 3:* 10276314 Arctic Circle, 10322643 Galbraith Lake, 10325233 Cripple Creek: cut a
     300 m frame each and run a first look.
4. **Forest Service cabin points for Alaska pins** (D1). 148 of 166 matched; 3 of 4 spot checks
   better than RIDB. Est. 50-70 maps.
   - *Test on 3:* 232935 Point Amargura, 232939 Peterson Lake, 232941 Dan Moller: propose the
     Forest Service point, a person confirms the cabin on the R10 photo, and the map is re-checked.
5. **Snap-and-propose from relief, plus past NAIP years for bad photos** (E2/E3, B2). Least-cost
   lanes for pull-through webs and lines drawn off the lane; a clean NAIP year for the ~28
   snow/blur holds.
   - *Test on 3:* 231907 Lucerne and 233425 Berry Bend (webs) with click-two-ends tracing on the
     relief, and one Utah snow hold with the NAIP year picker.
