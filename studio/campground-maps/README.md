# Campground site maps

CampHawk's own campground maps, drawn from public data. Nothing is copied or traced from a
provider's map picture. Plan, research and the per-provider route: `docs/design/campground-maps.md`.

```sh
# 1. RIDB full export (no key, 248 MB zip, ~440 MB unzipped; don't commit it)
curl -LO https://ridb.recreation.gov/downloads/RIDBFullExport_V1_CSV.zip && unzip RIDBFullExport_V1_CSV.zip -d ridb
# 2. Build one campground (RIDB facility id; 232447 is Upper Pines)
node studio/campground-maps/build.mjs ridb 232447
# → src/lab/camphawk/round2/maps/ridb-232447.json (about 45 KB)
```

The script fetches the rest live. Add the campground to `MAPS` in
`src/lab/camphawk/round2/maps/index.ts`.

## Sources and terms (checked 2026-10-07)

| Layer | Source | Terms |
|---|---|---|
| Site points, type, accessibility, max vehicle length, people, shade | RIDB full export, `Campsites_API_v1.csv` + `CampsiteAttributes_API_v1.csv` | CC BY 4.0 (data.gov record). Credit Recreation.gov; don't imply endorsement. |
| Campground roads, restrooms, kiosk, parking, shuttle stop, trails | NPS national datasets, `mapservices.nps.gov/arcgis/rest/services/NationalDatasets/NPS_Public_*_Geographic` | Federal government data. The service credits "National Park Service". |
| River | USGS NHD, `hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer` (layers 6, 9) | US government work (USGS). |

**Never used:** recreation.gov's own `/api/camps` endpoints (robots.txt disallows `/api/*`,
and its terms ban scraping), provider map images, and Google, Esri or Bing imagery for tracing
(their terms forbid it outside OSM).

## Known gaps in the data

- RIDB writes `0` for facts it doesn't have (driveway length, site size). The build drops
  zeros instead of showing "0 ft".
- RIDB points are the provider's own placement. Spot checks show sites along the NPS loop
  roads, but nobody has surveyed them. The map says "positions are approximate".
- 19% of Recreation.gov campsites have no point (measured on the 2026-10-06 export: 106,502 of
  130,763 have one). Those campgrounds get the "no map yet" state.
