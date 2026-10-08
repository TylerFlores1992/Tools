# Finishing the campground maps: the playbook

*Written 2026-10-08, after the 50-campground sample, pick-by-fit roads and the tracing tool.
Lab only (tylerflores.dev's CampHawk lab); camphawk.app is a separate repository and a separate
step (§9).*

**This file is the plan for drawing every Recreation.gov and ReserveCalifornia campground map the
way the work was done on 2026-10-07: measured, checked against the ground, honest about what's
missing, reviewed by a person.** A session given "complete the maps" (the `campground-maps` skill
loads this) should be able to do the next step from here alone.

- **The research and history are in `docs/design/campground-maps.md`.** Read its "short answer"
  and the last three sections before starting. This file says what to do. That one says why, and
  what was found.
- **The builders and their commands are in `studio/campground-maps/README.md`.**
- **Where the last session stopped is in `docs/NEXT-SESSION.md`**, under "Campground site maps".

---

## 1. Where it stands (2026-10-08)

| | Recreation.gov | ReserveCalifornia |
|---|---|---|
| Site points | RIDB, CC BY 4.0, open now | California State Parks' layer, **waiting on permission** |
| Campgrounds to draw | 2,196 with two or more sites (+1,016 single units, §5) | 341 RC areas in CampHawk's catalog |
| Built so far | Upper Pines (live); the 50-campground sample, **all 50 decided** (45 publishable, 5 hidden); **wave 1 (100 by demand) decided** (31 approved, 25 hidden); **wave 2 (100) decided** (23 approved, 39 hidden); **split listings shown and checked as areas, single units checked as places** (the owner's pick of the look, 2026-10-08; 27 listings rebuilt as areas, waiting on the owner) | Jedediah Smith, local only |
| Measured result | Usable after one look: sample 45 of 50 (90%; 79–96%); wave 1 75 of 100 (66–82%); wave 2 61 of 100 (51–70%); waves 1–2 are by demand, not random | 87% of sites match a State Parks point |
| Blocked by | nothing (owner's go-ahead per wave) | State Parks' answer (records request due ~2026-10-17) |

**What is built and tested:**
- **`build.mjs`** draws a Recreation.gov map: RIDB sites; roads picked by fit from four sources
  (`roads.mjs`); restrooms, water and parking; lakes and rivers; traces; and the automatic check
  (`qa.mjs`).
- **`build-sample.mjs`** builds a list of campgrounds and writes the review manifest. It can also
  rebuild only the ids given.
- **`build-csp.mjs`** draws an RC map from State Parks' points and RC's unit list (`match.mjs`). It
  does not yet have pick-by-fit, traces or the QA manifest (§6.2).
- **Traces:**
  - `trace.mjs` checks a trace file;
  - `traces/` holds 13 traced sample maps;
  - `trace-from-grid.mjs` writes a trace file from grid metres;
  - `aerial-grid.mjs` draws the photo with a metre grid, for a session to trace from;
  - `aerial-check.mjs` draws maps over the photo for a first look.
- **The review page** (`/private/camphawk/golden-hour/admin/site-maps`, live in the lab since PR #22,
  2026-10-08, production smoke 29/29) has:
  - a queue of the sample;
  - each map's checks, the aerial check and the tracing tool;
  - the road-source fits;
  - Approve / Needs roads / Keep hidden.

**The rollout tooling (§4) is built (2026-10-08):** OpenStreetMap from regional extracts
(`osm-extract.mjs`, `osm.mjs`), the population and waves (`population.mjs`), `build-wave.mjs`, and
the review page at scale (waves, filters, Show more, Download decisions). Wave 1's results are in
the design doc's "Wave 1".

**Areas and units are built in (2026-10-08, owner's pick: split A, single A):**
- The build decides how a camper sees each listing (`build.mjs` `viewOf`):
  - one unit → its location map;
  - a listing spread over 1.5 km, or one a reviewer called split → areas;
  - too many small groups → dispersed (held);
  - anything else → one map.
- **`splits.json`** holds a reviewer's calls either way, each with who, when and why. `split: true`
  shows a listing as areas even inside 1.5 km; `split: false` keeps it one map (the two the owner
  approved as one map, Strawberry Bay and Gros Ventre, are kept that way: a test fails if an
  approved map is split by the rule).
- **The check runs on each area** (`qa.mjs` `checkAreas`), and **every split waits for a person**
  (reason `areas`), since a rule drew it. Units get their own check (`checkUnit`).
- The map records its areas (`split`) and the wave's manifest each area's check; the review page
  shows campers' view (`CamperMap`) and each area's checks.

---

## 2. The rules, every time (non-negotiable)

**Honesty**
- **A wrong map is worse than no map.** Someone drives to the wrong loop. When in doubt, the
  campground shows "We haven't drawn a map of X yet".
- **Say what was measured and what was estimated.** Give a sample's share with its 95% interval
  (`wilson()` in `src/lab/camphawk/round2/maps/sample.ts`). Never write a number nobody counted.
- **Thresholds are fixed before the results are seen.** If one changes after a measurement (as
  pick-by-fit's margin did), say so in the code comment and the design doc.
- **Say what you didn't check:** under canopy, not on a real phone, review time not measured, and
  so on. "Can't tell" is a valid first-look call.
- **Unknown never rounds to a verdict.** A site with no point is listed, never guessed. A number
  recorded twice is left off and reported (Jedediah Smith's 56).
- **Trace only what you can see on the photo.** Each trace file's `note` says what was left out
  and why.

**Data and licenses**
- **Recreation.gov:** RIDB only (CC BY 4.0; credit it). **Never** recreation.gov's `/api/camps`:
  robots.txt disallows it and the terms ban scraping.
- **OpenStreetMap is ODbL.** Every map that uses any OSM layer carries "© OpenStreetMap
  contributors" (the build does this). A road name taken from OSM counts as OSM data.
- **Federal GIS** (Park Service, Forest Service, USGS, Census TIGER) and **USDA NAIP photos** are
  public domain. Tracing from NAIP is our own work.
- **Never trace from Google, Esri or Bing imagery.** Their terms forbid it.
- **California State Parks' campsite data stays out of this public repository and every deploy
  until they approve** (`public/lab-local/` is git-ignored). After approval, follow their terms
  exactly (§6.1).
- **RC's map pictures and their pixel positions are never used for a map.** They are a private
  yardstick only (§6.3): never committed, never published.
- **`campsite-finder` (camphawk.app) is not changed from this repository.** Bringing maps into
  CampHawk is its own step (§9), gated on the owner.

**Design** (the camper's map, the review page, any new screen)
- **CampHawk's look binds it** (`camphawk-design` skill, `ch-*` tokens only).
  - Green = an open site.
  - Ochre = yours (traces).
  - Blue = the hand-off to a provider, so **water is never blue**.
  - Red = you must act.
- **Never colour alone.** The owner is red-green colour-blind, so every state has a shape and a
  word (`StatusMark`, tick pins, squares on traced roads).
- **Camper map rules, all already built and tested:**
  - Open sites are green tick pins with numbers.
  - A site number sits beside its own dot, only where every other dot is at least 6 px farther.
  - Service symbols are outlines.
  - Find a site; zoom draws the map at least 1,600 px wide.
  - Distances are called straight lines.
  - The credits line names each layer's source.
- **Copy:** sentence case, US spelling (`src/lib/us-spelling.test.mts` checks identifiers too),
  plain words, no internals shown to campers.

**Engineering** (CLAUDE.md's standing rules apply)
- **Work on a branch, open a PR, merge.** Never push to `main`.
- **`npm run verify` before every push.**
- **Commit before experimenting**; revert by edit, never `git checkout -- <file>`.
- **Mutation-test every new guard:** break the thing, see the test fail, and confirm the break
  applied (a mutation that no-ops proves nothing). The harness that did this is in §7.
- **Never read an exit code through a pipe:** `cmd > log 2>&1; echo $?`, then read the log.
- **In a session container, network commands need `NODE_USE_ENV_PROXY=1`.** Never disable TLS or
  unset the proxy.

---

## 3. Before you start (every session)

1. **Orient.** `git fetch origin main`, read `docs/NEXT-SESSION.md`, then this file's §1 and
   §10. Branch from `origin/main`.
2. **State Parks' answer.**
   - Search the owner's Gmail (connector) for `from:parks.ca.gov` and
     `subject:(Public Records OR campsite)` since 2026-10-07.
   - **Read; never reply** without the owner.
   - If an answer came, go to §6.1 and tell the owner what it says, word for word where terms are
     involved.
3. **The RIDB export** (248 MB, not committed): download
   `https://ridb.recreation.gov/downloads/RIDBFullExport_V1_CSV.zip` into the scratchpad and
   unzip it. A rollout uses the newest export and records its date (`source.ridbExport`,
   `drawn.export`).
4. **The network. Check it first; nothing works without it.**
   - **What the map work reaches** (the builders, the photo tools, the smoke test):
     ```
     ridb.recreation.gov
     imagery.nationalmap.gov
     hydro.nationalmap.gov
     tigerweb.geo.census.gov
     mapservices.nps.gov
     apps.fs.usda.gov
     api.openstreetmap.org
     services2.arcgis.com
     california-rdr.prod.cali.rd12.recreation-management.tylerapp.com
     tylerflores.dev
     download.geofabrik.de
     ```
     Probe them in one go: `for h in <hosts>; do curl -sS -o /dev/null -I --max-time 15 -w "%{http_code} $h\n" https://$h/; done`.
     A `403` on CONNECT (`curl: (56) CONNECT tunnel failed, response 403`) is the environment's
     network policy; anything else is the far end.
   - **What happened on 2026-10-08.** Until then every host above except Geofabrik answered, so the
     environment was almost certainly on **Full** network access. The owner switched it to
     **Custom** with only `download.geofabrik.de` in Allowed domains (and the package-manager
     defaults ticked). The change applied to the running session at once. Every other host above
     then got `403`, tylerflores.dev included, so the builds and the smoke test stopped working.
     **A Custom list is the whole allowlist; it doesn't add to Full.**
   - **Fixed the same night: the owner set it back to Full**, and every host above except
     Geofabrik answered again (ridb, the USGS photos, tylerflores.dev: 200). If a later session
     finds 403s, the setting has changed again.
   - **The fix, if it ever recurs (owner, in the environment settings):** either set Network access back to **Full**
     (what worked all of 2026-10-07/08), or keep **Custom** and list every host above, one per line,
     with "Also include default list of common package managers" ticked. Where: claude.ai/code or
     the Desktop app (the docs don't list the mobile app; a phone's browser on claude.ai/code
     works). Click the cloud icon with the environment's name above the message box → **Cloud** → the
     environment's settings icon → **Network access**. It applies to new sessions (and, as seen, to
     the running one). https://code.claude.com/docs/en/cloud-environments#network-access
   - **Geofabrik resets the connection even when allowed** (2026-10-08, after the owner allowed it:
     the proxy accepted the tunnel, then `Recv failure: Connection reset by peer` three times out of
     three; the proxy logged `ws_closed_mid_exchange` after 39 bytes). Before it was allowed, it
     failed the same way, not with a 403. So it's the path to Geofabrik, not the policy. **§4.1
     must start by finding an extract source that answers** (below).
   - Then install `osmium-tool` (apt).
5. **The cache.** `studio/campground-maps/.cache/` (git-ignored) keeps every answer, so a rebuild
   doesn't hit free services again. A failed answer is never cached.

---

## 4. Recreation.gov: build the rollout tooling first

Each item is code with tests, reviewed like everything else. Do them in this order. Each is about
a session or less.

### 4.1 OpenStreetMap from extracts, not the API
- **Why:** OSM's API is for editing. Fifty small reads was within its usage policy; 2,196 is bulk
  use. `osm.mjs` must read OSM features from a state extract.
- **How:**
  - Download the extracts from **OpenStreetMap France** (measured 2026-10-08 on Full; Geofabrik
    still resets the connection there, so it's not the policy):
    - `https://download.openstreetmap.fr/extracts/north-america/<region>-latest.osm.pbf`, regions
      `us-west` (3.8 GB), `us-south` (4.6 GB), `us-midwest` (2.8 GB), `us-northeast` (2.0 GB):
      13.1 GB for the US. Some states are split out too (`us-west/colorado` 413 MB,
      `us-west/california` 1.5 GB; also Florida, Georgia, Texas, Virginia, Illinois, Michigan);
      list a region's folder to see which.
    - **Fresh:** every file was dated 2026-10-07, a day old (`<region>.state.txt` gives the
      replication timestamp). Record it as `sources.osmExtract`.
    - **Speed varies a lot:** 0.25 to about 30 MB/s on 2026-10-08 (`us-northeast`, 2.0 GB, took
      about 40 minutes; an earlier probe read 0.9 MB/s). Work one
      region at a time: download it, `osmium tags-filter` it to the tags below (much smaller), and
      delete the raw file. The session's disk showed 27 GB free.
    - It's the same OpenStreetMap data as the API and Geofabrik (ODbL; credit as now).
    - **Other options, not needed unless this stops answering:** Geofabrik again (it may come back);
      Overture Maps' transportation layer (OSM-derived roads as cloud GeoParquet, read by box with
      DuckDB; untested, and its layers differ from `osmLayers()`); BBBike's extract service (answers,
      but queues each custom box, so not for thousands); the planet file (`planet.openstreetmap.org`,
      about 80 GB; last resort).
    - **Not an option:** downloading through the owner's Chrome. The file would land on their
      computer, with no good way to move gigabytes here.
  - Install `osmium-tool` (apt, or the `osmium` Python package from PyPI) before the first region.
  - `osmium tags-filter` it to the tags `osmLayers()` reads: `highway`, `amenity`, `tourism`,
    `natural=water`, `waterway`, `landuse=reservoir`, `building`.
  - `osmium extract -b <bbox>` per campground (or one pass per state), exported as OSM XML, so
    `parseOsm()` and `osmLayers()` stay unchanged.
  - Record the extract's date in the map (`sources.osmExtract`).
- **Test:** the same campground built from the API and from the extract gives the same layers
  (allowing for edits between the two dates). Check this on 5 of the sample before switching.
- **Keep the API path** for a single rebuild. The build logs which path it used.
- **Built 2026-10-08:** `node studio/campground-maps/osm-extract.mjs <region>` downloads (resumable,
  MD5-checked), trims and keeps the region's published boundary (`.poly`). `osm.mjs` picks the
  extracts whose boundary covers a box (`covers()`), merges two near a border, and cuts boxes in
  one `osmium extract -c` pass per extract (102 boxes in 363 s; a single cut on a 3 GB file takes
  about 70 s, so always batch). Each map records `sources.osmFrom` (regions and OSM date).
  - **Measured:** 13 maps built both ways, 0 features differ (`osm-compare.mjs`).
  - **Alaska and Hawaii aren't in the US extracts.** Use `OSM_FROM=api` (or `auto`) for those
    few; `build-wave.mjs` is extracts-only and lists any box no extract covers as failed.

### 4.2 The population and waves (`population.mjs`)
- **The rule** is `sample.mjs`'s: RIDB facility type Campground, reservable and enabled; only
  overnight non-staff sites; at least 90% of them with a point. On the 2026-10-06 export that's
  3,212 campgrounds; 1,016 single units go to §5.
- **Write** `specs/ridb-all.json`, with every multi-site campground and its id, name, agency,
  state, rec area and site counts, from the newest export. Record the export date and the counts.
  If the counts move from 2,196 / 1,016, say by how much.
- **Waves of about 100**, stratified by agency like the sample, so each wave's pass rate is a
  fresh estimate. Write `specs/wave-NN.json` in `sample.mjs`'s format, so `build-sample.mjs`
  reads it.
- **Order: by CampHawk demand (owner's decision, 2026-10-08; read-only reads of watch counts are
  approved).** Measured that day, the demand signal is thin:
  - **23 Recreation.gov campgrounds have ever been watched** (147 watches, 14 people since
    2026-06-30), and the counts include the owner's own test watches.
  - **18 of the 23 are in the 2,196.** Upper Pines is already built, so ~~**17 are new**~~
    **corrected: 16 are new** (Upper Pines had been counted twice; wave 1 holds all 16). 2 are single
    units (§5.1); 3 are outside the population (two list no overnight sites; one has points
    for under 90% of its sites). Not named here: see the rule below.
  - **So wave 1 is those 17**, topped up to about 100 by the agency-stratified draw.
  - **After that, order by Recreation.gov's own reservation history** as the demand proxy, then
    agency and state. RIDB publishes it as `https://ridb.recreation.gov/downloads/reservations<year>.zip`
    (`reservations2024.zip` answered 200, 505 MB, last modified 2025-04-22). **Checked
    2026-10-08: `reservations2025.zip` exists (487 MB)** and has a `facilityid` column;
    `reservations-count.py` counts overnight camping reservations per facility and keeps nothing
    else (never a customer column). It sits on the same RIDB downloads page as the CC BY 4.0
    export; only per-facility counts are used, and they are not committed.
  - **Re-read the watch counts before every wave**, so a campground somebody starts watching
    jumps the queue. The query (campsite-finder's Supabase, read-only):
    ```sql
    with w as (select w.id, w.user_id, coalesce(wc.campground_id, w.campground_id) cg
               from watches w left join watch_campgrounds wc on wc.watch_id = w.id
               where w.user_id not like '\_\_%' and w.created_at > '2021-01-01')
    select c.id, c.name, count(distinct w.user_id) users, count(distinct w.id) watches
    from w join campgrounds c on c.id = w.cg where c.source = 'ridb'
    group by c.id, c.name order by users desc, watches desc;
    ```
    `campgrounds.id` is the RIDB facility id. **Never commit the counts or the list** (this
    repository is public, and with few users a campground can point to one person). Commit only
    the wave spec, which holds campground ids like every other wave.
  - **The same applies to ReserveCalifornia later:** 22 RC areas have been watched (§6).
- **The 50 already built are wave 0**; don't rebuild them unless the builder changed.

### 4.3 Building waves
- **Generalize `build-sample.mjs`** to take a spec file (`build-wave.mjs specs/wave-NN.json`).
  - Write `public/private/camphawk/maps/ridb-<id>.json` and a manifest per wave
    (**built:** `public/private/camphawk/maps/waves/wave-NN.json`, fetched by the page when the
    wave is chosen; the index the page lists is `src/lab/camphawk/round2/maps/waves.json`).
  - Keep: three at a time, the `[id…]` partial rebuild, failures recorded and the run carried on.
- **Storage, measured:** a map averages 10 KB (largest 46 KB; about 11 KB gzipped for Twin Peaks'
  47 KB). All 2,196 come to about 22 MB, which is fine in the lab repository.
  - **Commit the maps of each wave.**
  - CampHawk would store them in Supabase Storage or R2, not in git (§9).
- **USGS hydrography times out for hours some days.** The build already falls back to OSM water
  and records it (`sources.water`). Rebuild those maps' water later if it matters.

### 4.4 The review page at scale
- **The queue must page and filter:** by wave, verdict, first look, agency and state, "has traces",
  "decided / not decided". Each wave's manifest is fetched when chosen, never bundled whole.
  Keep the deep links (`?id=`, `?show=`, `?tool=trace`) and add `?wave=`.
- **Decisions are recorded with the maps (built 2026-10-08 for wave 0):**
  `src/lab/camphawk/round2/maps/decisions/wave-NN.json`, `{ version, wave, source, decisions:
  [{ id, decision, by, on, note }] }`, read through `maps/decisions.ts` and checked by
  `decisions.test.mts` (every id is a map of that wave, no id twice, a known decision, a date).
  - The page shows a recorded decision for everyone, with "Recorded with the maps, <date>". A click
    on the page is kept in that browser on top of it; Undo reopens even a recorded one.
  - **Built 2026-10-08:** "Download decisions" gives `decisions/wave-NN.json` from the owner's
    clicks, validated (`decisionsFileFor`). Commit it and add it to `DECISION_FILES`. The owner can
    still send calls in chat instead.
  - **Still to build:** the build reads it: approved maps are published; hidden ones show "not
    drawn yet".
- **Test it like the tracing tool:**
  - unit tests;
  - an e2e check (filters, a decision downloaded and validated);
  - mutation round;
  - screenshots at 390 and 1440 with the real photo;
  - `ui-audit`;
  - a critic agent until 8/10 or better.

### 4.5 First-look notes per wave
- `sample-review.ts` holds the sample's first looks. For waves, use one JSON per wave
  (**built:** `src/lab/camphawk/round2/maps/first-look/wave-NN.json`,
  `{ version, wave, by, on, looks: { <id>: { call, note } } }`, registered in `first-look/index.ts`
  and checked by `waves.test.mts`).
- The first offer on the page follows the look: a held map whose checks say spread out or stacked
  offers "Keep it hidden"; any other hold offers "Needs roads added" (`suggestedDecision`).
- **Calls:**
  - `good`: sites on pads, roads on roads;
  - `usable`: sites right, a few lanes missing: at most about 1 site in 7 without a drawn road
    within about 20 m, and every drawn road on a visible one (more is `hold`);
  - `hold`: not usable as drawn;
  - `unsure`: the photo can't settle it.

---

## 5. Recreation.gov: the wave loop (repeat until done)

**For each wave of about 100:**

1. **Build** it (§4.3). Note the failures and why. Retry them once; then list them.
2. **Run the automatic check** (built in): the verdicts, and the manifest's summary with its
   interval.
3. **First look, every map, over the photo.**
   - `node studio/campground-maps/aerial-check.mjs <dir> public/private/camphawk/maps/ridb-<id>.json …`,
     then **read each PNG**.
   - Write the call and one sentence of what you saw, in the first-look file (§4.5).
   - **Zoom any frame wider than about 1 km** with `aerial-grid.mjs` and a box before calling
     it. At that size the overview is too small to see lanes: wave 1's first call on Lodgepole was
     wrong from the overview and right zoomed.
   - **USGS sometimes sends a photo that won't decode;** `aerial-check.mjs` retries and then
     says so. Run it again for those.
   - Judge:
     - Do the sites sit on visible pads?
     - Do the drawn roads follow real roads?
     - Is any loop or lane missing?
     - Is it one campground?
   - Under canopy, the call is `unsure` unless the roads and sites agree with what *is* visible.
4. **Check every change of road source over the photo.** The build records each source's fit
   (`sources.roadPick`). A changed source is better until the photo says otherwise.
5. **Trace what's missing and visible** (the `hold` and `usable` maps with missing lanes):
   - `node studio/campground-maps/aerial-grid.mjs <map.json> <out.png>` for the whole frame (20 m
     grid). Then zoom on each gap with a box and a 5 m grid:
     `aerial-grid.mjs <map.json> <out.png> x0 y0 x1 y1 5 1400`.
   - Write the roads in grid metres, down the middle of the road, one point at each bend, and
     joined to the road they leave. Use `trace-from-grid.mjs <map.json> <spec.json>` (the format
     is in its header). The owner can use the review page's tracing tool instead; both write the
     same file.
   - Mark a through road `"through": true`.
   - Use `"replace": true` only when a source has the roads but draws them consistently in the
     wrong places (Lost Creek: up to 20 m off). Then trace every road, through roads too.
   - **Name a road only from a public designation you can state the source of** (a state route
     number). Never from an OSM name, unless the map credits OSM.
   - **Restrooms and water taps:** only when the photo shows it beyond doubt. A small building is
     not proof of a restroom. Leave them to the owner.
   - Rebuild the map: `NODE_USE_ENV_PROXY=1 node studio/campground-maps/build-wave.mjs <ridb-dir> studio/campground-maps/specs/wave-NN.json <id>…`
     (`build-sample.mjs` for wave 0).
   - **Check every trace over the photo after the rebuild** (`aerial-grid.mjs` again; traced roads
     are cyan). Move any trace more than about 3 m off the visible road, and rebuild.
   - Update the first-look call and note to say what was traced and what is still missing.
6. **Don't trace these; list them instead:**
   - full canopy with no visible lanes (Yellowbottom, Hearts Content, Rancheria);
   - footpaths to walk-in sites (Watchman's F loop): they aren't roads;
   - spurs too short or faint to place;
   - listings that aren't one campground (§5.2): say "split listing" in the first-look note, **add
     the listing to `studio/campground-maps/splits.json`** (`split: true`, who, when, the note's
     first sentence) and rebuild it. The test fails if the area rules can't honour the call
     (Axtel, Moutardier: their loops fit in one area, so no call was added).
   - **After the rebuild, look at the areas' overview** on the review page (or screenshot each
     listing's `section[aria-labelledby="areas-h"]`): do the outlines follow the real clusters?
     Note coarse areas (several clusters in one) and position-named ones.
7. **Owner review.** Tell the owner the wave is ready, with its numbers: ready on its own, usable
   after a look, needs traces approved, can't go live. Give them a short list grouped like
   wave 0's (A: traces to approve, B: fine but flagged, C: keep hidden), each with its review-page
   link (`…/admin/site-maps?id=<id>`). They decide on the page or in chat; record the calls in
   `maps/decisions/wave-NN.json` (§4.4) and commit it.
8. **Record the wave in the docs** (§8): its numbers, the running totals with intervals, what the
   first look found, the time it took, and anything new.
9. **Measure review time.** Note how long the session's first look and tracing took per map, and
   ask the owner how long their review took. **This number is the open question in every
   estimate.**

**Stop and ask the owner** when:
- a wave's pass rate falls outside the sample's interval (50–76% on their own; 79–96% after a
  look). **Wave 1 did (48% on their own, 75% after a look); the owner decided it and said go on.
  Wave 2 is lower again (61 after a look), mostly split listings (19 of 36 held).**
- a new failure mode shows up;
- a source's terms or availability change.

### 5.1 Single-unit campgrounds (1,016)
A cabin, fire lookout or guard station has nothing to tell apart. It needs a location map, not a
site map: one pin on a small area map with the access road, and the unit's facts.
- **Design it first** with `design-direction`'s gates, then build, test and review it like the site
  map (critic rounds, `ui-audit`).
- **Owner's decision (2026-10-08): yes, design it after wave 1. Look picked the same day: map and
  facts side by side, with terrain** (`UnitMap`, card). Built into the build and its check
  (`checkUnit`: the unit's point within 300 m of the listing's own, and a road or trail within
  700 m on the map; rules fixed before any unit wave). **No unit wave has been built yet:** waves by
  demand have drawn none (the population puts single units apart). Next: plan a unit wave.
- RIDB's facility pin can be kilometres off (Dimond O: about 4 km), so use the unit's own campsite
  point.

### 5.2 Listings that aren't one campground
Rabbit Valley (spread over 8 km), Medicine Lake (several campgrounds 2 km apart) and Pioneer Trail
(three group sites 770 m apart):
- **Detect them** with the check's spread and outlier rules.
- **Proposed:** one map per cluster (sites within about 300 m of each other), titled by its loop or
  area, or, for dispersed areas, a list of areas with a location each.
- Design and build it like §5.1. **Owner's decision (2026-10-08): yes, after wave 1.** The look
  is still theirs to approve.
- **Built into the waves 2026-10-08** (see §1). **Designed the same day:** `docs/design/campground-maps-areas.md`
  has the contract, the area rule (`maps/areas.ts`, tested on real listings), two directions for
  each kind, and two critique rounds. Split listings were 10 of wave 1's 20 held maps and 19 of
  wave 2's 36. Single units (§5.1) get a location map with terrain in the same comps.

### 5.4 The parallel rollout (2026-10-08, owner: "each batch to a child")
Everything left (1,945 multi-site campgrounds and 1,016 single units) is planned in one go by
`plan-rollout.mjs` as waves 3 to 39: by OpenStreetMap extract region, most-reserved first, then
single units. `specs/rollout.json` groups them into 11 batches of one region each, so a child
downloads one extract.
- **A child** works from `docs/design/campground-maps-rollout-child.md`: build, first look, split
  calls (`splits/wave-NN.json`), traces, and a handoff. It records no decisions and changes only
  its own waves' files, on its own branch.
- **The orchestrating session** merges each batch, runs `node studio/campground-maps/lab-index.mjs`
  (the wave list and the first-look and decisions imports), makes **the final check**, and records
  pass (approved) or hold (hidden) in `decisions/wave-NN.json`: the owner's delegation. Held maps
  are fixed after.
- **The final check:**
  - every traced map and every split listing over the photo;
  - a random sample of the rest, against the child's calls;
  - the child's handoff read against its files.
  If the sample disagrees with the child on more than a few maps, the whole wave is looked at
  again.

### 5.3 Restroom and water text (optional, owner's call)
- **Where it comes from:**
  - The Forest Service publishes text per site in `EDW_RecInfraRecreationSites_02` layer 0:
    `restroom_availability` ("Vault toilet(s)") and `water_availability`.
  - It publishes **no locations**.
  - Lookup by `nrrs_id` returned nothing for three sample campgrounds (2026-10-07), so **first
    measure** how to match a RIDB facility to a Forest Service site (name, distance) and how often
    it works.
- **Where it shows:** if built, on the camper's page as "Vault toilets; drinking water from faucets
  (locations not mapped)", only where the map has none.

---

## 6. ReserveCalifornia: once State Parks answers

### 6.1 Read the answer, then decide with the owner
- **Permission granted:**
  - Record the exact terms (attribution wording, any limits) in the design doc.
  - Credit State Parks exactly as asked.
- **The records request delivers the data:**
  - Records released under the Public Records Act can't be tied to a license (*County of Santa
    Clara*, 2009). Still, record what was delivered, its date, and any cover-letter conditions.
  - **Not legal advice**: tell the owner, and let them decide whether to use it.
- **Refused or no answer:**
  - RC campgrounds keep "not drawn yet".
  - The fallback (option 2/3 in the design doc) is hand work from the aerial photo, about 30–90
    minutes a campground, with approximate site positions labelled as such. Most-watched first,
    and only on the owner's go-ahead.
- **Once cleared**, lift the local-only rule in one commit:
  - remove `/public/lab-local/` from `.gitignore`;
  - move built maps from `public/lab-local/` to `public/private/camphawk/maps/csp-<key>.json`;
  - drop `LOCAL_MAPS` in `src/lab/camphawk/round2/maps/index.ts`;
  - update the CLAUDE.md router line, the README section, and `docs/NEXT-SESSION.md`'s hard rule.

### 6.2 Bring `build-csp.mjs` up to `build.mjs`
- **Share the code, don't copy it:**
  - pick-by-fit roads (`roads.mjs`; add State Parks' own roads layer as a candidate after
    checking its terms);
  - traces (`trace.mjs`, keyed `csp-<key>`);
  - restrooms and water per kind;
  - `qa.mjs`, plus its own check: the share of RC's units matched to a State Parks point
    (`match.mjs`);
  - credits naming every source;
  - a manifest the review page reads.
- **The spec** (`specs/<key>.json`) names the State Parks unit number, the campground name pattern,
  and RC's facility ids with their loop names (format in `build-csp.mjs`'s header).
  - Generate specs for all 341 RC areas from CampHawk's catalog of RC facilities. The facility ids
    and loop names come from RC's own `/fd/facilities` and `search/grid`, as `build-csp.mjs` reads
    them.
  - The coverage figures (150 automatic / 48 review / 17 manual / 126 no points) came from a
    one-off script. **Rewrite it as `csp-coverage.mjs`** and re-measure before trusting them.
- **Areas whose site numbers repeat across camps** (Humboldt Redwoods: Hidden Springs, Burlington,
  Albee Creek) need a per-area spec with the `campgroundLike` pattern, like Jedediah Smith's.
- **The review page** gets a provider switch (Recreation.gov / ReserveCalifornia), with the same
  checks, first look, tracing and decisions.

### 6.3 The private yardstick (RC's own map positions)
- For each RC area, fit the best scale, rotation and shift from RC's map-picture unit positions to
  State Parks' points. Measure what's left over.
- **Where they agree closely** (Doheny 5 m, Carpinteria 7 m), it confirms the matching. **Where RC's
  drawing is schematic** (Elk Prairie 30 m), the photo decides, and the photo said State Parks was
  right.
- **Use it only to flag** maps for a closer look. **Never commit** the positions, never draw from
  them, and never publish the comparison per site.

### 6.4 The RC loop
- Same as §5: build, check, first look, trace, owner review, docs.
- **Order by demand, as for Recreation.gov (§4.2):** 22 RC areas had been watched on 2026-10-08
  (the same query with `c.source = 'reservecalifornia'`). Draw those first.
- **Expect:** about 150 areas automatic, 48 to review, 17 by hand, 126 without State Parks points.
  The last stay "not drawn yet" unless the owner chooses hand work.
- **Report the data faults found back to State Parks** (Jedediah Smith's two 56s and no 57), on the
  owner's say-so.

---

## 7. Testing and checking (every change)

- **Pure logic is in `studio/` and `src/lab/…/maps/`, with tests:**
  - `scripts/campground-maps-*.test.mts` (QA, roads, traces, matching);
  - `src/lab/camphawk/round2/maps/*.test.mts` (layout, traces, sample).
  - A new rule gets a test built from the real case that prompted it (Twin Peaks, Lost Creek,
    Jedediah Smith's 56).
- **Mutation-test every new guard.**
  - Pure code: list mutants as `{name, file, from, to}`, apply each by exact string replacement,
    run the tests, and restore by writing the original back. A mutant whose `from` matches zero or
    two times is reported "did not apply".
  - Browser checks: the same, plus `npm run build` and `E2E_ONLY="<name part>" npm run e2e` for
    each mutant.
  - Commit before a mutation run. **Never edit `src/` while one runs:** it builds from the working
    tree, and a mutant is on disk at the time.
  - Record the score (e.g. "8 of 8 killed"); fix any survivor with a test, and say so.
- **Browser checks** (`scripts/e2e.mts`):
  - Stub the NAIP photo with a 1×1 PNG so they need no network.
  - Click relative to the photo (`locator.click({ position })`), never with raw page coordinates:
    the photo is taller than the window.
  - Check positions, not only that something happened.
- **Screenshots, looked at:**
  - Use real photos (fetch in Node, serve through `page.route`), signed in, at 390 and 1440.
  - Crop tall pages to read them.
  - Full-page shots put sticky and fixed elements in odd places; that's not a bug.
  - Check overlap, clipping, colour-alone states and touch targets.
- **Reviews before merge:**
  - `ui-audit` for any UI;
  - a separate critic agent (`Agent`, general-purpose) for anything a person will use, given the
    brief, the house rules and the screenshots;
  - fix its must-fixes, then send round 2.
- **`npm run verify`** (typecheck, lint, all tests, build) before every push. Then `npm run e2e`.
  After a merge, `npm run smoke -- https://tylerflores.dev`.

---

## 8. Keeping the docs current (as you go, not at the end)

| When | Update |
|---|---|
| A wave is built and looked at | `docs/design/campground-maps.md`: a results table per wave plus running totals with intervals; `docs/NEXT-SESSION.md`'s map section |
| A builder or rule changes | the file's header comment (why, with the case), `studio/campground-maps/README.md`, the design doc |
| A number changes (population, coverage, pass rate) | every place that quotes it. `grep -rn "<old number>" docs studio src` |
| A finding contradicts an earlier one | strike the old line (`~~old~~ **corrected:** …`) rather than deleting it, so nobody re-derives it |
| State Parks or the owner decides something | the design doc's RC section, `docs/NEXT-SESSION.md`, this file's §1 and §10 |
| Session end | `docs/NEXT-SESSION.md` (done / next / blocked); the CLAUDE.md router if a pointer moved; this playbook if a process changed |

- **Write plainly:** short sentences, the finding first, numbers with their source and date.
- **Mark estimates as estimates.**

---

## 9. Bringing maps into camphawk.app (separate repo, gated)

**Not done from this repository.** It's gated on Apple accepting the current app build and on the
owner's go-ahead. When it starts, in campsite-finder, the design doc's estimate section is the
plan:
- a migration for site coordinates, spur sizes and loop (`new-migration` skill; the RIDB sync
  already reads the coordinates and drops them);
- the builder as a weekly job, with output in Supabase Storage or R2;
- the review page in CampHawk's admin;
- the site map ported to the campground page with real per-site availability;
- tests, `web-design-guidelines` and CampHawk's critic process.

Also fix the docs claim there that providers don't publish site coordinates (RIDB does, for 84%
of bookable sites).

---

## 10. Open owner decisions

**Decided 2026-10-08:**
- ~~Approve the sample's 23 held maps.~~ **Done:** groups A (12 traced) and B (6 flagged but fine)
  approved, C (5) kept hidden; recorded in `maps/decisions/wave-00.json`.
- ~~Wave order.~~ **By CampHawk demand**, read-only reads approved (§4.2).
- ~~Single-unit and split-listing maps.~~ **Yes, designed after wave 1** (§5.1, §5.2); the look
  still needs the owner's approval.

**Still open:**
0. ~~**Wave 1:** the owner's decisions.~~ **Done 2026-10-08:** A and B approved, C and D hidden;
   go on to wave 2.
0a. ~~**Wave 2:** the owner's decisions.~~ **Done 2026-10-08:** A and B approved (23), C and D
   hidden (39).
0b. ~~**Pick the look.**~~ **Done 2026-10-08: split A and single A**, built into the waves (§1).
0c. ~~**The 27 listings now shown as areas.**~~ **Done 2026-10-08:** 14 approved, 13 hidden;
   tighter areas built for the 5 coarse ones (still hidden).
0d. ~~**A unit wave.**~~ **Planned 2026-10-08** with the rest (§5.4): waves 26 to 39.
1. ~~Network access back to Full.~~ **Done 2026-10-08 night** (it had briefly been Custom with one
   host, §3.4).
2. ~~**Approve the look** of the single-unit and split-listing maps.~~ **Done** (0b).
2a. **Alaska and Hawaii (230 maps held, 2026-10-08):** USGS's NAIP returns all black there, so no
   first look is possible. Options: another public-domain photo source (to research: USGS's other
   imagery services, Alaska's state imagery, NOAA), or pass those maps on the automatic check alone.
2b. **"Whole campground as one Standard site" (65 maps held, colorado batch):** a listing whose one
   bookable site is named "Standard" is a whole campground, not a unit. Building them as
   campground maps needs roads and loops without site points (a different map), or a "whole
   campground" design. Owner's call whether to pursue.
3. **Restroom and water text from the Forest Service (§5.3):** build it or not.
4. **Put traced roads into OpenStreetMap too:** needs the owner's own OSM account. No automated
   edits.
5. **State Parks:** what to do with their answer (§6.1). If they refuse, whether to hand-draw the
   most-watched RC campgrounds.

## 11. Known gaps (as of 2026-10-08, after wave 1)

- **Review time per map has never been measured.** Every rollout estimate depends on it.
- **The tracing tool on a real phone:** at 2× and 4× zoom, the sticky road bar may cover the bottom
  strip of the photo. Scrolling the page clears it. Not checked on a device.
- **The camper's map:**
  - the frame isn't fitted tightly (Upper Pines has about 30% river and trail with no sites);
  - USGS rivers are stair-stepped, and roads show facets when zoomed;
  - unzoomed on a phone, few numbers fit (Find a site reaches all).
- **Pick-by-fit's margin** (5 m or a quarter of the best) was set after seeing the sample. Wave 1
  gave no reason to change it.
- **The check reads the median distance to a road,** so it passes a map where a third of the sites
  have no road (Cave Spring, wave 1). A per-loop or 75th-percentile check would catch it. Not
  built; changing a threshold after seeing results must be said out loud.
- **Split listings are shown as areas now** (§5.2). Areas are cut at 1 km, so a listing whose
  clusters sit close together can get one coarse area holding several (Lithia Springs, Sweetwater,
  South Sandusky, Dam Site, Lost Lake). Diamond Lake's outlines still touch; Hardin Ridge's eight
  areas are named by position because its site ranges interleave.
- **Repeated site numbers** (La Wis Wis) and **wrong RIDB states** (Hardin Ridge listed in
  Maine) are shown as published.
- **Census TIGER roads can be rough** (Udall Park's shore road runs a few metres off). The fit rule
  takes them only when clearly better, and the photo check catches the rest.
- **Two maps where a source loop coincides exactly with the site points** (Dennis Cove) can't be
  judged from the photo.
