# Handoff: maps-akhi-imagery (public-domain aerial photos for Alaska and Hawaii)

*2026-10-08. Branch `wip/maps-akhi-imagery`. RIDB export used: the 2026-10-07 full export (`Facilities_API_v1.csv` dated 2026-10-07).*

## The answer in short
- **Alaska:** the U.S. Forest Service Alaska Region's orthophotos, which IIPP serves. They are dedicated to the public domain under CC0, and they give a real photo for **202 of the 217** Alaska maps: mostly 0.3 m, 2009 to 2024.
- **Hawaii:** USDA NAIP 2021 (0.6 m), also served by IIPP. It covers **both** Hawaii maps.
- **15 Alaska maps have no public-domain photo**, from any federal source I found. They are interior Alaska (Dalton Highway, White Mountains), Kenai Fjords, Lake Clark, Kenai Refuge, Yakutat's Esker Stream and two Tongass cabins.
- **All 219 have a new first look.** Totals: good 16, usable 17, hold 69, unsure 117.

## The sources and their licences
1. **U.S. Forest Service Alaska Region orthophotos**, via the Interdepartmental Imagery Publication Platform (IIPP; the Forest Service's GTAC with DOI's GeoPlatform).
   - Four-band (newest years), the default for Alaska: https://imagery.geoplatform.gov/iipp/rest/services/Aerial_Imagery/RGBI_post2000_USFS_R10_Alaska_multiRes_Public/ImageServer
   - Three-band (2006 to 2018): https://imagery.geoplatform.gov/iipp/rest/services/Aerial_Imagery/RGB_post2000_USFS_R10_Alaska_multiRes_Public/ImageServer
   - **Licence**, quoted from each service's own licence info (`…/ImageServer/info/iteminfo?f=pjson`, field `licenseInfo`, and `…/info/metadata`): *"Additionally, the U.S. Forest Service waives copyright and related rights in the work worldwide through the CC0 (which can be found at https://creativecommons.org/public-domain/cc0/)."*
   - Access line: *"These datasets were provided by the U.S. Forest Service Alaska Region (R10) and are served by the U.S. Forest Service Geospatial Technology & Applications Center (GTAC) … as part of the Interdepartmental Imagery Publication Platform (IIPP)."*
   - Every dataset in the catalog has `public: yes`.
   - The datasets under the 217 Alaska pins:
     - AK_Tongass_Chugach_2010_60cm (2010, 0.6 m)
     - Prince of Wales / Ketchikan-Misty 2019, Petersburg-Wrangell 2021, Chugach 2020, Tongass NF 2009-2010, Baranof 2024, Admiralty 2023, Chichagof 2020, Chilkat 2023, Mainland North 2024 (all 0.3 m)
     - In the three-band service: Chugach 2016 (0.15 m, leaf-off), Tongass 2006 to 2018, and Kodiak 2006 to 2011 (0.5 to 0.6 m)
2. **USDA NAIP 2021 Hawaii** (flown January 2022, 0.6 m), via IIPP: https://imagery.geoplatform.gov/iipp/rest/services/NAIP/NAIP2021_Hawaii/ImageServer
   - **Licence:** NAIP is USDA's public-domain program. USGS's own NAIP service describes NAIP as *"public domain, NAIP compressed orthoimagery"* (https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer?f=pjson).
   - The IIPP service's credit: *"provided by the USDA's Farm Production and Conservation office (FPAC)"*.
   - Its own licence field holds only a no-warranty disclaimer, with no restriction.
   - USGS's mosaic has no Hawaii, which is why it answers blank there.
3. **NAIP via USGS** stays the default everywhere else.

**Checked and not used:**
- The National Map's `USGSImageryOnly`: licensed SPOT imagery, ruled out in the brief.
- The TNM product API: `datasets=Imagery - NAIP` returns 0 products for Hawaii (NAIP there exists only on IIPP). It no longer lists High Resolution Orthoimagery.
- USGS 3DEP IfSAR ORI: public domain, but radar, and only as 0.9 to 25 GB zip tiles. It covers all 15 uncovered pins; at 2.5 m it is too coarse for pads anyway.
- NOAA NGS 2016 near-infrared mosaics: Anchorage, Kodiak, Dillingham and Ketchikan towns only.
- USGS 2016 coastal orthos: the north-west coast, none of these pins.
- NPS Lake Clark 2019 SfM: Iliamna Volcano and Johnson River only.
- USDA NRCS `alaska_delta_junction_2021`: its copyright line is USDA-NRCS-NGCE and USDA-FSA, no public-domain statement, and it is not near any pin.
- NRCS AHAP: registered to Maxar Vivid, so not clean.
- Esri, Google and Bing were never considered.
- No host was blocked: everything answered through the proxy.

## A service quirk worth knowing
The 2010 0.6 m dataset only draws when asked at about **0.6 m a pixel**. Asked finer or coarser, IIPP answers a transparent frame. The 1.4 km unit frames at 1,000 px were fine, because that is about 1.4 m/px and inside its pyramid. But Spencer Glacier's 115 m frame at 1,400 px, and Spencer Bench's frame, came back blank. `aerial.ts` marks that case `usfs-r10-0.6m` (`fixedM: 0.6`), and every caller asks for it at its own scale (`sizeFor`).

## Coverage, per map
Summary:
- `usfs-r10` (four-band): 182
- `usfs-r10-rgb` (three-band): 18. 11 because only it covers them, 7 because its leaf-off 2016 or 2008 photo shows the loops that the summer photo hides.
- `usfs-r10-0.6m`: 2
- `naip-hawaii`: 2
- `none`: 15

"Real photo" means under half of the frame is blank, or of the 300 m around the first site where the frame isn't wholly blank. A scratch Python pass measured all 219 (frame at 1,000 px plus a 300 m zoom, both services). `studio/campground-maps/aerial-sources.mjs` does the same from the repo, one map at a time (about 20 s each). Its full run hit the session's 30-minute limit after 91 maps; all 91 agreed with `aerial.ts`. Run it in chunks.

| Wave | Id | Name | Photo | Datasets over the frame (year, finest m/px) | Real photo? | Call |
|---|---|---|---|---|---|---|
| 02 | 232213 | RUSSIAN RIVER | usfs-r10-rgb | AK_Chugach_2016 (2016, 0.16) | yes | hold |
| 25 | 10191011 | Marion Creek Campground | none | — | no | unsure |
| 25 | 10276314 | Arctic Circle Campground | none | — | no | unsure |
| 25 | 10322643 | Galbraith Lake Campground | none | — | no | unsure |
| 25 | 10325233 | Cripple Creek Campground | none | — | no | hold |
| 25 | 10325252 | Mount Prindle Campground | none | — | no | hold |
| 25 | 10325266 | Ophir Creek Campground | none | — | no | hold |
| 25 | 252494 | White Mountains National Recreation Area - Alaska Cabins | none | — | no | unsure |
| 25 | 10296828 | Hidden Lake Campground | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 25 | 233317 | KENAI NATIONAL WILDLIFE REFUGE CABINS | none | — | no | unsure |
| 25 | 234629 | Kodiak National Wildlife Refuge Cabins | usfs-r10-rgb | AK_KodiakIsland_2006 (2006, 0.60); AK_KodiakIsland_2009 (2009, 0.50) | yes | hold |
| 25 | 10300372 | Spencer Glacier Whistle Stop Group Campground | usfs-r10-0.6m | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes, at 0.6 m/px only | hold |
| 25 | 232141 | SIGNAL CREEK CAMPGROUND | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 25 | 232324 | WILLIWAW CAMPGROUND | usfs-r10-rgb | AK_Chugach_2016 (2016, 0.14) | yes | usable |
| 25 | 232330 | LAST CHANCE CAMPGROUND | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 25 | 232352 | PTARMIGAN CREEK | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | good |
| 25 | 232353 | COOPER CREEK SOUTH | usfs-r10-rgb | AK_Chugach_2016 (2016, 0.15) | yes | hold |
| 25 | 232360 | EAGLES NEST CAMPGROUND | usfs-r10-rgb | AK_Tongass_2006_2008 (2008, 1.00); AK_Tongass_2013 (2013, 0.80); AK_Tongass_Census_2006 (2006, 1.00) | yes | hold |
| 25 | 233909 | QUARTZ CREEK CAMPGROUND | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 25 | 233974 | HARRIS RIVER CAMPGROUND | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | good |
| 25 | 233994 | Starrigavan Campground and Day Use | usfs-r10-rgb | AK_Tongass_2006_2008 (2008, 1.00); AK_Tongass_2014 (2014, 0.05); AK_Tongass_2017 (2017, 0.12); AK_Tongass_Census_2006 (2006, 1.00) | yes | usable |
| 25 | 234108 | TENDERFOOT CREEK | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 25 | 234110 | PORCUPINE (AK) | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 25 | 234112 | GRANITE CREEK | usfs-r10-rgb | AK_Chugach_2016 (2016, 0.17) | yes | hold |
| 25 | 234504 | MENDENHALL CAMPGROUND | usfs-r10-rgb | AK_Tongass_2006_2008 (2008, 1.00); AK_Tongass_2018 (2018, 0.12); AK_Tongass_Juneau_2006 (2006, 0.31) | yes | usable |
| 25 | 251356 | AUK VILLAGE CAMPGROUND | usfs-r10 | RGBI_AK_Tongass_Chilkat (2023, 0.30) | yes | unsure |
| 25 | 10119505 | Haleakalā National Park (Wilderness Tent Permit) | naip-hawaii | NAIP 2021 Hawaii (flown 2022-01, 0.6) | yes | usable |
| 25 | 10382456 | Chilkoot Trail Camping Permits | usfs-r10-rgb | AK_Tongass_2006_2008 (2008, 1.00) | yes | hold |
| 25 | 234783 | Haleakalā National Park (Cabin Permits) | naip-hawaii | NAIP 2021 Hawaii (flown 2022-01, 0.6) | yes | hold |
| 25 | 251861 | Kenai Fjords National Park Cabins | none | — | no | unsure |
| 33 | 10300370 | Trail River Cabin | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 33 | 120890 | POLK CAMP | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | usable |
| 33 | 232922 | BIG SHAHEEN CABIN | usfs-r10 | AK_Tongass_Admiralty_2023_30cm (2023, 0.30) | yes | hold |
| 33 | 232924 | LAKE ALEXANDER CABIN | usfs-r10 | AK_Tongass_Admiralty_2023_30cm (2023, 0.30) | yes | usable |
| 33 | 232928 | ADMIRALTY COVE CABIN | usfs-r10 | AK_Tongass_Admiralty_2023_30cm (2023, 0.30) | yes | unsure |
| 33 | 232935 | POINT AMARGURA CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 33 | 232938 | LAUGHTON GLACIER CABIN | usfs-r10 | RGBI_AK_Tongass_Chilkat (2023, 0.30) | yes | hold |
| 33 | 232939 | PETERSON LAKE CABIN | usfs-r10 | RGBI_AK_Tongass_Chilkat (2023, 0.30) | yes | hold |
| 33 | 232940 | JOHN MUIR CABIN | usfs-r10 | RGBI_AK_Tongass_Chilkat (2023, 0.30) | yes | hold |
| 33 | 232941 | DAN MOLLER CABIN | usfs-r10 | RGBI_AK_Tongass_MainlandNorth_2024 (2024, 0.30) | yes | unsure |
| 33 | 232942 | TURNER LAKE WEST CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); RGBI_AK_Tongass_MainlandNorth_2024 (2024, 0.30) | yes | unsure |
| 33 | 232943 | TURNER LAKE EAST CABIN | usfs-r10 | RGBI_AK_Tongass_MainlandNorth_2024 (2024, 0.30) | yes | unsure |
| 33 | 232944 | TAKU GLACIER CABIN | usfs-r10 | RGBI_AK_Tongass_MainlandNorth_2024 (2024, 0.30) | yes | unsure |
| 33 | 232945 | EAGLE GLACIER CABIN | usfs-r10 | RGBI_AK_Tongass_Chilkat (2023, 0.30) | yes | hold |
| 33 | 232946 | DENVER CABOOSE CABIN | usfs-r10 | RGBI_AK_Tongass_Chilkat (2023, 0.30) | yes | hold |
| 33 | 232947 | BERNERS BAY CABIN | usfs-r10 | RGBI_AK_Tongass_Chilkat (2023, 0.30) | yes | unsure |
| 33 | 232948 | WINDFALL LAKE CABIN | usfs-r10 | RGBI_AK_Tongass_Chilkat (2023, 0.30) | yes | hold |
| 33 | 232950 | BLIND PASS CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 33 | 232951 | FISH CREEK CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 33 | 232953 | HELM BAY CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 33 | 232959 | PHOCENA BAY CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 33 | 232963 | DOUBLE BAY CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 33 | 232968 | HOOK POINT CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 33 | 232972 | MCKINLEY TRAIL CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 33 | 232974 | SAN JUAN BAY CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 33 | 232975 | JACK BAY CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 33 | 232978 | GREEN ISLAND CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 33 | 232983 | SHELTER BAY CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | usable |
| 33 | 232987 | CROW PASS CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 33 | 232988 | WINSTANLEY ISLAND CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 33 | 232989 | PIGOT BAY CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 33 | 232991 | SHRODE LAKE CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 33 | 232994 | HARRISON LAGOON CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 33 | 232995 | PAULSON BAY CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 33 | 232998 | GOOSE BAY CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | usable |
| 33 | 233000 | UPPER PARADISE LAKE CABIN | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | usable |
| 33 | 233001 | CRESCENT LAKE CABIN | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 33 | 233002 | CASTLE FLATS CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 33 | 233004 | CASTLE RIVER CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 33 | 233005 | BREILAND SLOUGH CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | hold |
| 33 | 233006 | UPPER RUSSIAN LAKE CABIN | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 33 | 233007 | Aspen Flats Cabin (Chugach National Forest, AK) | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | good |
| 33 | 233009 | TROUT LAKE CABIN | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | good |
| 33 | 233010 | ROMIG CABIN | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 33 | 233013 | JUNEAU LAKE CABIN | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | good |
| 33 | 233014 | SWAN LAKE CABIN SEWARD | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | good |
| 33 | 233016 | WEST SWAN LAKE CABIN | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | usable |
| 33 | 233018 | DEVILS PASS CABIN | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | good |
| 33 | 233019 | KAH SHEETS BAY CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | hold |
| 33 | 233020 | EAST CREEK CABIN | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | good |
| 33 | 233021 | CARIBOU CREEK CABIN | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 33 | 233022 | CASCADE CREEK CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 33 | 233023 | FOX CREEK CABIN (AK) | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 33 | 233024 | RAVENS ROOST CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | usable |
| 33 | 233025 | BEECHER PASS CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 33 | 233026 | Barber Cabin (Chugach National Forest, AK) | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | good |
| 33 | 233027 | SPURT COVE CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 33 | 233028 | CRESCENT SADDLE CABIN | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | good |
| 33 | 233029 | DALE CLEMENS CABIN | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | good |
| 33 | 233031 | WEST POINT CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | hold |
| 33 | 233037 | LAKE EVA CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); RGBI_AK_TongassNF_Baranof_30cm (2024, 0.30) | yes | hold |
| 33 | 233038 | SHELIKOF CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30) | yes | unsure |
| 33 | 233039 | BRENTS BEACH CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30) | yes | unsure |
| 33 | 233040 | FREDS CREEK CABIN | none | — | no | unsure |
| 33 | 233041 | BARANOF LAKE CABIN | usfs-r10 | RGBI_AK_TongassNF_Baranof_30cm (2024, 0.30) | yes | unsure |
| 33 | 233045 | SAMSING COVE CABIN | usfs-r10-rgb | AK_Tongass_2006_2008 (2008, 1.00) | yes | hold |
| 33 | 233046 | SEVENFATHOM BAY CABIN | none | — | no | unsure |
| 33 | 233047 | ALLAN POINT CABIN | usfs-r10 | RGBI_AK_TongassNF_Baranof_30cm (2024, 0.30) | yes | unsure |
| 33 | 233048 | MOSER ISLAND CABIN | usfs-r10 | AK_Tongass_NF_Chichagof_2020 (2020, 0.30) | yes | unsure |
| 33 | 233049 | APPLETON COVE CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); RGBI_AK_TongassNF_Baranof_30cm (2024, 0.30) | yes | unsure |
| 33 | 233050 | NORTH BEACH CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30) | yes | unsure |
| 33 | 233051 | PIPER ISLAND CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); AK_Tongass_NF_Chichagof_2020 (2020, 0.30) | yes | unsure |
| 33 | 233052 | KANGA BAY CABIN | usfs-r10-rgb | AK_Tongass_2006_2008 (2008, 1.00) | yes | unsure |
| 33 | 233053 | WHITE SULPHUR SPRINGS CABIN | usfs-r10 | AK_Tongass_NF_Chichagof_2020 (2020, 0.30) | yes | hold |
| 33 | 233055 | CONTROL LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 33 | 233057 | KARTA LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 33 | 233058 | KARTA RIVER CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 33 | 233059 | RED BAY LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 33 | 233062 | SARKAR LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 33 | 233064 | STANEY CREEK CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 33 | 233065 | SWEET WATER LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 33 | 233068 | SHAKES SLOUGH 2 CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 33 | 233070 | MOUNT RYNDA CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | hold |
| 33 | 233076 | GARNET LEDGE CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 33 | 233078 | STEAMER BAY CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 33 | 233079 | BERG BAY CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 33 | 233082 | ANAN BAY CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 33 | 233105 | SALMON LAKE CABIN SITKA | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); RGBI_AK_TongassNF_Baranof_30cm (2024, 0.30) | yes | unsure |
| 33 | 233171 | TWELVEMILE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 33 | 233179 | STARRIGAVAN CREEK CABIN | usfs-r10 | RGBI_AK_TongassNF_Baranof_30cm (2024, 0.30) | yes | unsure |
| 33 | 233401 | Eight Fathom Cabin | usfs-r10 | AK_Tongass_NF_Chichagof_2020 (2020, 0.30) | yes | usable |
| 33 | 234721 | KENNEL CREEK CABIN (AK) | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); AK_Tongass_NF_Chichagof_2020 (2020, 0.30) | yes | good |
| 33 | 251714 | SPENCER BENCH CABIN | usfs-r10-0.6m | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes, at 0.6 m/px only | unsure |
| 33 | 232469 | Fure's Cabin | none | — | no | unsure |
| 33 | 259345 | Priest Rock Cabin | none | — | no | unsure |
| 34 | 10341414 | Porcupine Cabin | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 34 | 232919 | FLORENCE LAKE (EAST) CABIN | usfs-r10 | AK_Tongass_Admiralty_2023_30cm (2023, 0.30) | yes | unsure |
| 34 | 232921 | HASSELBORG CREEK CABIN | usfs-r10 | AK_Tongass_Admiralty_2023_30cm (2023, 0.30) | yes | unsure |
| 34 | 232923 | LITTLE SHAHEEN CABIN | usfs-r10 | AK_Tongass_Admiralty_2023_30cm (2023, 0.30) | yes | unsure |
| 34 | 232925 | JIMS LAKE CABIN | usfs-r10 | AK_Tongass_Admiralty_2023_30cm (2023, 0.30) | yes | hold |
| 34 | 232926 | CHURCH BIGHT CABIN | usfs-r10 | AK_Tongass_Admiralty_2023_30cm (2023, 0.30) | yes | unsure |
| 34 | 232927 | PYBUS BAY CABIN | usfs-r10 | AK_Tongass_Admiralty_2023_30cm (2023, 0.30) | yes | unsure |
| 34 | 232929 | YOUNG LAKE (NORTH) CABIN | usfs-r10 | AK_Tongass_Admiralty_2023_30cm (2023, 0.30) | yes | unsure |
| 34 | 232930 | YOUNG LAKE (SOUTH) CABIN | usfs-r10 | AK_Tongass_Admiralty_2023_30cm (2023, 0.30) | yes | good |
| 34 | 232931 | Black Bear Lake Cabin (Tongass National Forest, AK) | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 34 | 232932 | JOSEPHINE LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 34 | 232933 | KEGAN CREEK CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 232934 | KEGAN COVE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 34 | 232936 | TROLLERS COVE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 232937 | GREENTOP CABIN | usfs-r10 | AK_Tongass_NF_Chichagof_2020 (2020, 0.30) | yes | unsure |
| 34 | 232949 | ANCHOR PASS CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 34 | 232952 | HECKMAN LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 34 | 232954 | HELM CREEK CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 232955 | JORDAN LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 232956 | MCDONALD LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | usable |
| 34 | 232957 | PATCHING LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 232958 | PLENTY CUTTHROAT CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 232960 | REFLECTION LAKE CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30); AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 34 | 232961 | SOUTHEAST HECKMAN CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 232962 | ALAVA BAY CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 232964 | TIEDEMAN SLOUGH CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 34 | 232965 | BAKEWELL LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 34 | 232966 | MARTIN LAKE CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | usable |
| 34 | 232967 | CHECATS LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 34 | 232969 | ELLA NARROWS CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 232970 | BEACH RIVER CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 34 | 232971 | HUGH SMITH LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 34 | 232973 | LOG JAM BAY CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 34 | 232976 | NELLIE MARTIN RIVER CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 34 | 232977 | HUMPBACK LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 232979 | MANZANITA LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 232980 | MCKINLEY LAKE CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 34 | 232981 | SOFTUK BAR CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 34 | 232982 | PORT CHALMERS CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 34 | 232984 | WILSON NARROWS CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 232985 | POWER CREEK CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | hold |
| 34 | 232986 | WILSON VIEW CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 34 | 232990 | WINSTANLEY LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 232992 | COGHILL LAKE CABIN | usfs-r10 | AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | unsure |
| 34 | 232993 | SALT CHUCK EAST CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | hold |
| 34 | 232996 | PETERSBURG LAKE CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | hold |
| 34 | 232997 | KADAKE BAY CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 232999 | DEVILS ELBOW CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 233003 | LOWER PARADISE LAKE CABIN | usfs-r10 | AK_Chugach_2020 (2020, 0.30); AK_Tongass_Chugach_2010_60cm (2010, 0.60) | yes | usable |
| 34 | 233011 | BIG JOHN BAY CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 233012 | SWAN LAKE CABIN PETERSBURG | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 233015 | TOWERS ARM CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 233017 | KAH SHEETS LAKE CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | usable |
| 34 | 233030 | PORTAGE BAY CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 233032 | GOULDING LAKE CABIN | usfs-r10 | AK_Tongass_NF_Chichagof_2020 (2020, 0.30) | yes | unsure |
| 34 | 233033 | KOOK LAKE CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); AK_Tongass_NF_Chichagof_2020 (2020, 0.30) | yes | hold |
| 34 | 233034 | SITKOH LAKE (EAST) CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); AK_Tongass_NF_Chichagof_2020 (2020, 0.30) | yes | unsure |
| 34 | 233035 | SITKOH LAKE (WEST) CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); AK_Tongass_NF_Chichagof_2020 (2020, 0.30); RGBI_AK_TongassNF_Baranof_30cm (2024, 0.30) | yes | hold |
| 34 | 233036 | SULOIA LAKE CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); AK_Tongass_NF_Chichagof_2020 (2020, 0.30) | yes | unsure |
| 34 | 233042 | AVOSS LAKE CABIN | usfs-r10 | RGBI_AK_TongassNF_Baranof_30cm (2024, 0.30) | yes | unsure |
| 34 | 233043 | DAVIDOF LAKE CABIN | usfs-r10 | RGBI_AK_TongassNF_Baranof_30cm (2024, 0.30) | yes | unsure |
| 34 | 233044 | PLOTNIKOF LAKE CABIN | usfs-r10 | RGBI_AK_TongassNF_Baranof_30cm (2024, 0.30) | yes | unsure |
| 34 | 233054 | BARNES LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | hold |
| 34 | 233056 | HONKER LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 233060 | SALMON BAY LAKE CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 233061 | SALMON LAKE CABIN THORNE BAY | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 233063 | SHIPLEY BAY CABIN | usfs-r10 | AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 233066 | KATHLEEN LAKE CABIN | usfs-r10 | AK_Tongass_Admiralty_2023_30cm (2023, 0.30) | yes | unsure |
| 34 | 233067 | SHAKES SLOUGH 1 CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 233069 | TWIN LAKES CABIN (AK) | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 233071 | MOUNT FLEMER CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | hold |
| 34 | 233072 | LITTLE DRY ISLAND CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | usable |
| 34 | 233073 | GUT ISLAND 1 CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | hold |
| 34 | 233074 | KOKNUK CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | hold |
| 34 | 233075 | SERGIEF ISLAND CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 233077 | VIRGINIA LAKE CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 233080 | FROSTY BAY CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 233081 | MARTEN LAKE CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 233083 | ANAN LAKE CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 233084 | EAGLE LAKE CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30); AK_Tongass_PrinceOfWales_KetchikanMisty_2019 (2019, 0.30) | yes | unsure |
| 34 | 233085 | MALLARD SLOUGH CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 233086 | GUT ISLAND 2 CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | hold |
| 34 | 233087 | HARDING RIVER CABIN | usfs-r10 | AK_Tongass_NF_2009_2010 (2010, 0.30); AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | unsure |
| 34 | 233088 | SITUK LAKE CABIN | usfs-r10-rgb | AK_Tongass_2006_2008 (2008, 1.00) | yes | unsure |
| 34 | 233089 | EAGLE CABIN | usfs-r10-rgb | AK_Tongass_2006_2008 (2008, 1.00) | yes | good |
| 34 | 233090 | RAVEN CABIN | usfs-r10-rgb | AK_Tongass_2006_2008 (2008, 1.00) | yes | unsure |
| 34 | 233091 | Tanis Mesa Cabin | usfs-r10-rgb | AK_Tongass_2006_2008 (2008, 1.00) | yes | hold |
| 34 | 233093 | ALSEK RIVER CABIN | usfs-r10-rgb | AK_Tongass_2006_2008 (2008, 1.00) | yes | unsure |
| 34 | 233094 | MIDDLE DANGEROUS RIVER CABIN | usfs-r10-rgb | AK_Tongass_2006_2008 (2008, 1.00) | yes | unsure |
| 34 | 233095 | ITALIO RIVER CABIN | usfs-r10-rgb | AK_Tongass_2006_2008 (2008, 1.00) | yes | unsure |
| 34 | 234671 | MIDDLE RIDGE CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | good |
| 34 | 253458 | DEEP BAY CABIN | usfs-r10 | AK_Tongass_Petersburg_Wrangell_2021 (2021, 0.30) | yes | good |
| 34 | 10006208 | Joe Thompson Cabin | none | — | no | unsure |
| 34 | 10075403 | Esker Stream Cabin | none | — | no | unsure |

## What code changed
**One place picks the photo: `src/lab/camphawk/round2/maps/aerial.ts`.**
- `aerialSource(map)` decides in this order:
  1. a measured pick per RIDB id (`PICKS`, which includes `"none"`);
  2. else Hawaii goes to `naip-hawaii`;
  3. else Alaska goes to `usfs-r10` (the Aleutians past 180° included);
  4. else `naip`.
- Each source carries its endpoint, bands (`bandIds=0,1,2` for four-band services), a short and a full credit, its host's name for error copy, and an optional fixed scale.
- `aerialUrl` and `exportUrl` build the request; `photoSize` and `sizeFor` hold the 4,000 px limit and the fixed scale.
- `naip.ts` now re-exports from it, keeping its API.

**Lab callers:**
- `admin/AerialCheck.tsx` and `admin/TraceTool.tsx` ask `aerialUrl`, credit `source.short` under the photo, and name the source's host when the photo fails. Where there's no source they show "No public-domain aerial photo covers this place…" (`NO_PHOTO`) instead of a broken image.
- `TraceTool` writes the source's credit into the trace file's `photo` (through `traceFile(…, photo)` in `maps/trace.ts`).
- `admin/SiteMaps.tsx`'s Sources row "Aerial photo" names the map's own source, or that none covers it.

**Studio scripts:**
- `aerial-check.mjs`, `aerial-grid.mjs` and `trace-from-grid.mjs` import `aerial.ts`. `trace-from-grid.mjs` writes the source's credit as the trace's `photo`.
- `aerial-check` says when no source covers a map, or when the photo comes back blank (a flat-frame check). It stamps the source key in the PNG header.
- `AERIAL=<key>` on `aerial-check` and `aerial-grid` asks another source, to compare two photos of one place.
- New `aerial-sources.mjs` measures, for any maps, which source answers (frame and site zoom, blank share, catalog years and pixel sizes) and prints the `PICKS` a change would need.

**Other files:**
- `scripts/e2e.mts` stubs both imagery hosts.
- `studio/campground-maps/README.md`: the sources table now has one row each for NAIP, NAIP Hawaii and Forest Service Alaska, with the licence quotes, and says where the choice lives.

## Tests and mutations
**`src/lab/camphawk/round2/maps/aerial.test.mts`, 8 tests, all passing.** They check that:
- the lower 48 get NAIP;
- Haleakalā gets NAIP Hawaii;
- Russian River and the Aleutians get Forest Service Alaska, with bands;
- the picks win, including `none` for Marion Creek, and the leaf-off pick;
- every pick names a real source;
- every source is a federal `.gov` imagery host, credits public domain, and is never a viewing-only basemap;
- the size limit and bands reach every URL;
- the fixed-scale source is asked at 0.6 m/px.

`naip.test.mts` still passes (4 tests).

**Mutants: 6 of 6 killed.** For each, the test failed and `git diff` showed the break in place; each was reverted by edit.
1. Hawaii falls through to NAIP: 1 failure.
2. Picks ignored: 1 failure.
3. Alaska falls to NAIP: 2 failures.
4. `bandIds` dropped: 2 failures.
5. Aleutians branch removed: 1 failure.
6. Fixed scale ignored in `sizeFor`: 1 failure.

One slip: I reverted mutant 1 with `git checkout -- aerial.ts`. The file was committed, so nothing was lost; every revert after that was by edit.

**`npm run verify` passed:** typecheck, lint, 270 tests and the build, on the wiring commit.
- After the last code change (7 leaf-off picks), `npm run verify` ran again before the final push. Typecheck and lint passed; tests were 270 pass and 1 fail, the expected index-sync test (`waves.json` is out of date until the orchestrator runs `lab-index.mjs` on merge). Because verify stops at that failure, I ran `next build` on its own: it passed.
- `npx tsx --test scripts/campground-maps-*.test.mts src/lab/camphawk/round2/maps/*.test.mts`: 141 pass and 1 fail, the expected index-sync test (`waves.json` is regenerated on merge). It passes on the base without my wave edits.

## First look, per wave
How I looked:
- Every multi-site map in waves 02 and 25 over its frame on both Forest Service services, side by side, zoomed with `aerial-grid` where a frame was over about 400 m or a call was close.
- Every single unit in waves 33 and 34 zoomed 300 m around its pin, six to an image.
- Each Kodiak refuge cabin and each Haleakalā cabin and tent area zoomed separately.

| Wave | Maps (AK/HI) | good | usable | hold | unsure |
|---|---|---|---|---|---|
| 02 | 1 | 0 | 0 | 1 | 0 |
| 25 | 29 (27 AK, 2 HI) | 2 | 4 | 13 | 10 |
| 33 | 95 | 10 | 8 | 28 | 49 |
| 34 | 94 | 4 | 5 | 27 | 58 |
| **All** | **219** | **16** | **17** | **69** | **117** |

- **Traced:** 253458 Deep Bay Cabin. The 50 m gravel lane from the Forest Service road to the cabin's lot, plain on the photo. It was rebuilt with `build-wave.mjs … wave-34.json 253458` (OSM via the API) and checked over the photo: within about 2 m. Nothing else was plain enough: canopy hides the lanes and spurs in most Southeast campgrounds.
- **Split calls:** none.
- **Wave 34's "Standard" listings:** none in Alaska or Hawaii. The 23 units whose one site is typed "STANDARD NONELECTRIC" are all single Tongass cabins named S02 and so on, so they were judged as units. Childs Glacier (10165215, state blank) isn't AK/HI in the manifest and was left as it was.
- **The four "every site on one spot" listings** keep their facts and stay `hold`: Cripple Creek, Mount Prindle, Ophir Creek, Chilkoot Trail.

**Why so many `unsure`:** most Tongass and Chugach cabins sit under full rainforest canopy. At 0.3 m a cabin under trees doesn't show, so the call is `unsure` and the note says canopy. Resolution isn't the limit there: where a cabin is in the open, 0.3 m shows it plainly, down to its roof color and dock.

**Why so many `hold`:** 55 unit pins are held. In 51 the pin is on open water, a gravel bar, a beach, a meadow, muskeg or unbroken forest, with nothing that is the unit (where a cabin would show). In 19 units, a building that is likely the cabin shows 20 to 150 m from the pin: 8 are `usable` (within about 50 m), 11 are `hold`. Those are listing-point errors, now visible for the first time. Notes name the distance and direction, for example:
- Windfall Lake: the cabin is 120 m south-west;
- Lake Eva: the cabin is 60 m north-east, about where the listing's own point is;
- Control Lake: 110 m south-west.

**Multi-site campgrounds (wave 25 and Russian River):**
- **good:** Ptarmigan Creek, Harris River.
- **usable:** Williwaw, Starrigavan, Mendenhall, and Haleakalā's tent areas (on the meadows by the cabins, no pads at 0.6 m).
- **hold, with the reason in each note:**
  - Russian River: about 30 sites on undrawn lanes.
  - Cooper Creek South, Tenderfoot Creek, Porcupine (AK): sites far off the drawn roads. Porcupine's shore road plainly shows and isn't drawn; with 012 to 028 also off any lane, a trace alone wouldn't make it usable, so I left it for the owner.
  - Eagles Nest: the drawn highway is 10 to 20 m off the real road.
  - Quartz Creek: a third of the sites have no drawn road.
  - Granite Creek: 7 sites toward the river, 012 on a gravel bar.
  - Spencer Glacier: the A and B track isn't drawn; 0.6 m only.
  - Haleakalā cabins: two of three pins miss their cabins.
  - Kodiak refuge cabins: Chief Cove's pin is on water, Blue Fox Bay's on a bare beach, and several show no building.
- **unsure:** Signal Creek, Last Chance, Auk Village (canopy); Hidden Lake (half covered); and the 3 Dalton Highway campgrounds, White Mountains, Kenai Refuge and Kenai Fjords cabins (no photo).

## The 15 maps with no public-domain photo
Every one has the call `unsure`, or keeps its `hold` where the old note said "not drawn". Their notes say no public-domain photo covers them.

| Id | Name | Where |
|---|---|---|
| 10191011, 10276314, 10322643 | Marion Creek, Arctic Circle, Galbraith Lake | Dalton Highway (BLM) |
| 10325233, 10325252, 10325266, 252494 | Cripple Creek, Mount Prindle, Ophir Creek, White Mountains cabins | White Mountains NRA (BLM) |
| 233317 | Kenai NWR cabins | Kenai Peninsula, outside the Chugach blocks |
| 251861 | Kenai Fjords NP cabins | the park's coast |
| 232469, 259345, 10006208 | Fure's, Priest Rock, Joe Thompson cabins | Katmai and Lake Clark |
| 10075403 | Esker Stream Cabin | Yakutat forelands, east of the flown blocks |
| 233040, 233046 | Freds Creek, Sevenfathom Bay cabins | Tongass, Kruzof and Baranof outer coast, outside the flown blocks |

**Evidence:**
- Both Forest Service services return a transparent frame there, and their catalogs list no dataset over those bboxes.
- USGS NAIP returns blank.
- The only other federal public-domain cover I found is 3DEP IfSAR ORI, which is radar, 2.5 m, and in 0.1 to 25 GB zips.

**Owner's call:** pass these on the map alone, or wait for another source.

## Anything new
- **Listing points off the cabin are common in Southeast Alaska.** Of the 183 units with a photo, 51 pins are on water, gravel, beach, meadow, muskeg or forest with nothing that is the unit, and 19 have the likely cabin visible 20 to 150 m away. That is a listing problem, not a map one: the map draws RIDB's point. If the owner wants these units at all, a "move the pin to the visible cabin" correction (traced point) would be the fix. That is a new kind of trace; I didn't build it.
- **Leaf-off beats newer:** in the Chugach, the 2016 leaf-off 0.15 m photo shows loops that the 2020 summer photo hides. I picked it for 7 maps, and others may benefit. `AERIAL=usfs-r10-rgb` compares the two.
- **IIPP's fixed-scale quirk** with the 2010 0.6 m photos (above). The review page asks at the right scale through `aerial.ts`.
- **Not touched:** `waves.json`, `first-look/index.ts`, `decisions.ts`, the specs, and `docs/` (the playbook's §10 2a and `NEXT-SESSION.md` are the orchestrator's to update with this result).

Time: about 5 hours (research and coverage 1.5 h, wiring and tests 1 h, first look 2.5 h).

STATUS: complete
