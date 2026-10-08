# Next session

*Updated at the end of every session. Read this first, then `CLAUDE.md`.*
*Last updated: 2026-10-08, night (CampHawk shirts: after polish rounds 5-10 the owner chose to print the pick as it was (round 4 no. 7), kit rebuilt from it, PR #24; owner's map decisions recorded, PR #25; network back on Full, OSM extracts from OpenStreetMap France). Earlier: 2026-10-08 (PR #22 merged and live, production smoke 29/29: campground site maps' roads picked by fit from four sources, a tracing tool on the Site maps review page, traces on 13 sample maps, 45 of 50 can go live after one look, up from 38; and `docs/design/campground-maps-playbook.md` + the `campground-maps` skill, so "complete the maps" picks the work up). Earlier the same day: the 50-campground sample and review page (PR #19, merged, production smoke 29/29), Upper Pines live in the lab, ReserveCalifornia local-only, both State Parks requests sent; CampHawk lab fix rounds 6–17, PR #18 merged.*

## At a glance

| What | Where | State |
|---|---|---|
| Site | https://tylerflores.dev | Live. Merges to `main` deploy production automatically. |
| Home hero | `/` | Live. Signed off by the owner. |
| Bridle calculator | `/workshop/bridle-calculator` | Live. Signed off by the owner. |
| ETCP rigger study | `/workshop/etcp-rigger-study` | Live. Practice tests A/B (25 each) and C (50, exam-weighted), 73 flashcards, formula reference. |
| Private tab | `/private` | Live. Password-only sign-in in the site's design; 30-day session. Lists private projects. |
| CampHawk lab | `/private/camphawk` | Live, behind Private. Mockups only: nothing here changes camphawk.app. (`/lab/camphawk` redirects here.) |
| ↳ **Golden hour (chosen look)** | `/private/camphawk/golden-hour` | Live. The home page in the look the owner picked. Critic 7/10, every finding since fixed. Header badge: the owner's pick "Golden-hour sky" (lab only; camphawk.app keeps its badge). |
| ↳ **Campground page** | `/private/camphawk/golden-hour/campground` | Live. CampHawk's campground page in the same look, with every real state. Now shows whichever campground Explore opened (`?id=`). Critic 7/10, findings fixed. |
| ↳ **Explore** | `/private/camphawk/golden-hour/explore` | Built 2026-10-06. Search rail, four result states in words, illustrated map with pins as buttons, search kept in the URL. |
| ↳ **New watch** | `/private/camphawk/golden-hour/new` | Built 2026-10-06. Picker (favorites, parks as one watch, first come refused), nights, muting, Auto-Cart by plan, the 8am hold. |
| ↳ **Your watches** | `/private/camphawk/golden-hour/watches` | Built 2026-10-06. Wall, first run, every card state, holds, provider and auto-cart trouble, alert history. |
| ↳ **Every other screen** | `/private/camphawk/golden-hour/screens` | Live 2026-10-06 (PR #15 merged, smoke 26/26): Tiers 1-4, about 30 pages, listed by tier with their lab switches. |
| ↳ Trail poster | `/private/camphawk/trail-poster` | Live. The other round-2 direction, kept for reference only. |
| ↳ Round 1 looks | `/private/camphawk/looks` | Live. Six backdrop-only mockups (critic 4/10). Superseded; kept for history. |
| Hosting | Vercel project `tylerflores-dev` (Hobby, $0) | Details in `docs/SETUP.md`. |
| Domain + DNS | Cloudflare | Done. HTTPS certificates issued and auto-renewed by Vercel. |

**How to see the lab:** open https://tylerflores.dev/private and sign in with the Private
password (`LAB_PASSWORD`). Vercel preview links for a branch can't sign in: `LAB_PASSWORD` is set
for Production only, and the sign-in fails closed without it. To review a branch before merging,
add `LAB_PASSWORD` to Vercel's Preview environment (Settings → Environment Variables) and redeploy.

**Checks, all green:** `npm run verify` (191 tests) · `npm run e2e` (36 browser checks;
`E2E_ONLY=<text>` runs the matching ones) ·
`npm run shots` (80 screenshots) · `npm run smoke -- https://tylerflores.dev` (29/29 on production after #19 merged, 2026-10-07, including
that `/private`, every lab page and its old URL land on the sign-in page, private files answer 401,
and the hero film is served `immutable`). CI runs `verify` and `e2e` on every push.

## Campground site maps (PR #19 2026-10-07, PR #22 2026-10-08, both merged and live)

**Late night, 2026-10-08: the fix-after list, started (owner: "start with the 60 trace
candidates; find a public-domain photo source for Alaska and Hawaii; design a whole campground map
for the Standard ones").**
- **Trace candidates (63 maps): done.** Two children traced them from NAIP (`wip/maps-trace-a`, 28
  in the south; `wip/maps-trace-b`, 35 in the midwest, west and northeast). The final check over the
  photo passed **23** that were held (13 and 10). 40 stay held, mostly lanes under full canopy.
  Results are in the design doc's "Fix after"
  section.
- **Alaska and Hawaii (219 maps): done.** Two public-domain photo sources are wired in beside NAIP
  (`aerial.ts`).
  - Alaska: the Forest Service Alaska Region's CC0 orthophotos via IIPP (202 of 217).
  - Hawaii: NAIP 2021 via IIPP (both maps).
  - 15 Alaska maps have no photo and stay held.
  - The final check passed 32 (first look: good 16, usable 17; Williwaw held).
  - Rollout totals: 1,441 passed, 1,520 held.
- **First-come campgrounds (130 "Standard" listings): the owner picked A ("Go with A, build it
  in").** Built in: the `firstcome` kind, `checkFirstCome`, the camper page, and decide-wave's
  `"as": "firstcome"` rule. All 130 are rebuilt: 81 ready, 49 for a person (47 have no outline in
  reach, 2 are closed). **Next: their first look as first-come maps** (brief step 3b), then the
  decisions. Until then they stay hidden under their old unit calls.

**Night, 2026-10-08: the parallel rollout is done: all 12 batch groups merged (PRs #32 to #40).**
- **2,961 maps built in waves 3 to 39; 1,386 passed the final check and 1,575 are held to fix
  after.** Per-batch numbers and notes are in the design doc's "The parallel rollout" table.
  Production smoke after #38: every check passes (curl, with retries for this sandbox's TLS
  resets; Node's fetch to tylerflores.dev is reset here, so `npm run smoke` fails before the
  first answer).
- **No child is running.** All are archived; each batch's handoff is folded into the design doc
  and kept in its `wip/maps-<batch>` branch history.
- **One `usable` bar for every batch**, from the owner's wave 1 and 2 approvals. Sites and drawn
  roads right with some spurs or lanes missing pass. Held instead:
  - a drawn road off the visible one;
  - misplaced or stacked sites;
  - about a third or more of the sites with no drawn road.
  - The final check re-read every `usable` note against it: 173 of 449 held. It is in the
    child brief and the playbook, and `decide-wave --why` keeps the reason on each held map.
- **Held, to fix after:**
  - Alaska and Hawaii: 220 listings, NAIP is black there (playbook §10 2a).
  - "Standard" whole campgrounds (2b).
  - About 60 trace candidates the children listed (lanes plain in the open).
  - Stray RIDB points 14 km to 6,000 km away; an outlier rule should drop them.
  - Dispersed lake and island listings, waiting for the dispersed design.
  - OSM area outlines drawn as roads in Oklahoma, Arkansas and Texas.

**Late evening, 2026-10-08: the rest of Recreation.gov, in parallel (PR pending, then children).**
- The 27 area listings decided (14 approved, 13 hidden). Tighter areas for the 5 coarse ones (a
  loop joins only an area it touches; a split call can set `gap` or `maxSpan`).
- **Everything left is planned** (`plan-rollout.mjs`): waves 3 to 39, in 11 batches of one OSM
  region each (`specs/rollout.json`). Each batch goes to a child session
  (`docs/design/campground-maps-rollout-child.md`); this session merges, makes the final check, and
  records pass or hold (playbook §5.4). The fleet's state: `list_sessions` (tag
  `maps-rollout-2026-10-08`) and each child's `wip/maps-<batch>` branch and `.handoff/` file.

**Evening, 2026-10-08 (PR #30, merged): the look picked and built in.**
- **Wave 2 decided:** pass A and B (23 approved), hold C and D (39). `maps/decisions/wave-02.json`.
- **The owner picked split A and single A.** Built into the build, the check and the review page:
  - each listing is one unit, one map, areas or dispersed (`build.mjs` `viewOf`);
  - a reviewer's calls either way are in `studio/campground-maps/splits.json`;
  - every area is checked, every split waits for a person, units have their own check;
  - the review page and the lab campground page show campers' view (`CamperMap`).
- **27 listings rebuilt as areas** and looked at:
  - 14: the split fixes them;
  - 6: still missing roads;
  - 7: the split isn't right yet (coarse, Diamond Lake, Hardin Ridge).
  - Grouped in the design doc's "Areas built in". **They wait on the owner.**
- **Next:** the owner's calls on the 27; a unit wave (none built yet); a tighter cut for coarse
  areas; the 7 trace candidates from wave 2.
- **#29 never deployed to production** (no Vercel deployment for `93513c1`). This PR's merge
  deploys main with both: check the production deployment's sha after merging.

**Same day, later (PR #29, merged):**
- **Wave 1 decided:** the owner approved A and B (31) and hid C and D (25). Recorded in
  `maps/decisions/wave-01.json`.
- **Wave 2:** 100 by reservations, built and looked at. **61 usable (51–70%)**; 36 held, 19 of
  them split listings. 2 traced. Waits on the owner's decisions (design doc, "Wave 2").
- **Split listings and single units are designed** as lab comps at
  `/private/camphawk/golden-hour/admin/site-maps/layouts`, with the contract, critique and
  measurements in `docs/design/campground-maps-areas.md`.
  - Recommended: A (one area at a time) and A (map with terrain and facts).
  - Not built into the waves yet: the owner picks first.

**Wave 1 (2026-10-08, PR #28, merged):** the rollout tooling is built (OpenStreetMap from
regional extracts, `population.mjs`, `build-wave.mjs`, the review page at scale with Download
decisions). Wave 1 is 100 campgrounds by demand (the 16 watched, then the most-reserved of each
agency).
- **Built:** all 100 (no failures).
- **First look over the photo:** 49 good, 26 usable with roads missing, 20 not usable as drawn, 5
  can't tell. So **75 of 100 are usable after one look (66–82%)**. That is below the sample's
  79–96%, so per the playbook it waits on the owner.
- **Army Corps parks are the weak group:** 11 of 23 usable. All 16 watched campgrounds are usable.
- **9 maps traced** from the photo. Each was checked over the photo after the rebuild.
- **Why the 20 are held:** 10 split listings, 9 missing roads under canopy, 1 repeated site
  numbers.
- **The check passed 4 maps the photo doesn't support** (Cave Spring and others). The review page
  now asks for a decision on those too.
- **Waiting on the owner:** decisions on wave 1 (review page `?wave=1`, then Download decisions),
  and whether wave 2 goes ahead as planned.
- **Next after that:** design the split-listing and single-unit maps (owner approved, after wave
  1).
- **Full write-up:** the design doc's "Wave 1".
**Start here for maps:** `docs/design/campground-maps-playbook.md` (the plan to finish every
Recreation.gov and ReserveCalifornia map: rules, tooling to build, the wave loop, testing, doc
updates, owner decisions; the `campground-maps` skill loads it on "complete the maps"). Then
`docs/design/campground-maps.md` (research, measurements, time estimate) and
`studio/campground-maps/README.md` (how to build one).

**Live in the lab (PR #19 merged 2026-10-07):**
- **Upper Pines** has a real site map: `/private/camphawk/golden-hour/campground`. It is built
  from RIDB (CC BY 4.0), NPS GIS and USGS, with Find a site, zoom, and numbers beside their dots.
  Critic rounds went 5.5 → 7, with the main finding fixed after.
- **Jedediah Smith (ReserveCalifornia),** `?id=jedediah-smith`. Its map is built from California
  State Parks' own campsite layer, so it **shows only on a local run**. Deployed, it shows the
  "not drawn yet" state.
- **Site maps review (admin mock), `/private/camphawk/golden-hour/admin/site-maps`:** the
  50-campground Recreation.gov sample, built 2026-10-07 evening.
  - A queue with each map's verdict and thumbnail; each map's checks and its aerial-photo
    overlay; Approve / Keep hidden (saved in the browser only).
  - **Results:**
    - The check passed **32 of 50 (64%; 50-76% across 2,196)**.
    - A first look over the aerial photo found none of those unusable, but 12 are missing some
      roads; 6 of the 18 it held were fine.
    - **38 of 50 can go live after one look.**
    - RIDB's site points were right wherever the pads could be seen; **the gap is roads** (9 of
      the 12 unusable maps).
  - Full write-up: the design doc's "The 50-campground sample".
- **Roads fixed the same night** (design doc, "Roads: picked by fit, then traced"):
  - **Pick by fit (`roads.mjs`):** each map draws its roads from whichever of four sources the
    sites sit along: Park Service, OpenStreetMap, Forest Service or Census TIGER (new). 10 of 50
    maps changed source, and 4 more passed on their own (32 → 36).
  - **The tracing tool:** "Trace what's missing" on each map's review page.
    - Draw roads, restrooms and water taps over the photo, with zoom, snapping and the keyboard.
    - Name a road, mark it a through road, or replace the source's roads.
    - Saved in the browser. **Download trace file** gives `studio/campground-maps/traces/ridb-<id>.json`.
    - **To put a trace on the map:** add the file to `traces/` and run
      `NODE_USE_ENV_PROXY=1 node studio/campground-maps/build-sample.mjs <ridb-dir> <id>`.
    - A traced map always waits for approval (an eighth check).
    - Reviewed: UI audit, and critic rounds 6.5 → 8/10, every finding fixed. Not checked on a
      real phone: at 2×/4×, the sticky road bar may cover the bottom strip of the photo.
  - **Traces on 13 sample maps,** each checked over the photo. Only visible roads were traced, and
    every file's note says what was left out.
  - **Result:** **45 of 50 can go live after one look (90%; 79–96%)**, up from 38. 27 are ready on
    their own; that number fell on purpose, because 12 maps wait only for their traced roads to be
    approved.
  - **The five left:**
    - Rabbit Valley, Medicine Lake and Pioneer Trail aren't one campground;
    - Yellowbottom is under full canopy;
    - Murrell Park shows no lanes to its sites.
  - **Restrooms and water:** the Forest Service publishes only text ("Vault toilet(s)"), not
    locations. Saying that text on the map where no location exists is not built.
  - **Rebuilding needs the RIDB export** (248 MB, not committed; README step 1).
- **The owner decided (2026-10-08):**
  - **All 23 held sample maps:** 18 approved (12 with traced roads, 6 flagged but fine), 5 kept
    hidden (Yellowbottom, Murrell, Rabbit Valley, Medicine Lake, Pioneer Trail). Recorded in
    `src/lab/camphawk/round2/maps/decisions/wave-00.json`; the review page shows them for everyone.
  - **Waves go by CampHawk demand.** Only 23 Recreation.gov campgrounds have ever been watched; ~~17~~
    **16** new ones are in the 2,196, so they lead wave 1. After that, Recreation.gov's reservation
    history (to check). Playbook §4.2.
  - **Single-unit and split-listing maps: yes, designed after wave 1.**
  - **Network, after the owner's change (2026-10-08 night):** the environment went to Custom with
    only `download.geofabrik.de`. Every other map source and tylerflores.dev now answer `403`, and
    Geofabrik resets the connection anyway. **Fixed the same night: back on Full**, and every host
    answers except Geofabrik. **OpenStreetMap extracts come from OpenStreetMap France instead**
    (13.1 GB for the US, a day old, about 0.9 MB/s; playbook §4.1). Probe the hosts first thing
    anyway (§3.4 has the command).

**Waiting on California State Parks** (both emails sent 2026-10-07 from the owner's Gmail):
- **Public Records Act request** to Parks.PRA@parks.ca.gov, for their campsite layer (ArcGIS item
  `f0374d8702f14ad5962023c7a502da65`, `InternalCampsiteSpur`, 11,334 points) and any campsite
  GIS. By law they must say within **10 days, by about 2026-10-17**, whether they have records;
  they can extend by 14. Fees are direct cost only.
- **Permission request** to geodata@parks.ca.gov, for commercial use of that layer, plus who
  owns RC's map artwork. No deadline.
- **When an answer comes:**
  - If permission is granted, or the records request delivers the data: data from the records
    request carries no license conditions (*County of Santa Clara*). Remove the local-only rule
    and commit the State Parks maps:
    - drop `public/lab-local/` from `.gitignore`;
    - move the map into `src/lab/camphawk/round2/maps/` and `MAPS`;
    - remove its `LOCAL_MAPS` entry;
    - update the CLAUDE.md router line.
  - If refused: maps stay Recreation.gov-only. The fallback for RC is aerial photos and elevation
    data, which is hand work, about 30-90 min per campground.

**Hard rule until then:** State Parks' data never enters this public repo or a deploy.
`build-csp.mjs` writes to `public/lab-local/`, and its cache goes to `studio/campground-maps/.cache/`;
both are git-ignored. Rebuild locally with
`NODE_USE_ENV_PROXY=1 node studio/campground-maps/build-csp.mjs studio/campground-maps/specs/jedediah-smith.json`.
`NODE_USE_ENV_PROXY=1` is required in a session, or RC's firewall answers 403.

**Measured, so nobody re-derives it:**
- **Recreation.gov:** 3,212 overnight campgrounds have points for 90% or more of their sites
  (the earlier "3,623" counted 411 day-use facilities). 1,016 of them are a single unit and need
  no site map; the other 2,196 are what a rollout draws.
- **ReserveCalifornia,** across 341 RC areas in CampHawk's catalog:
  - 87% of drawable sites match a State Parks point;
  - 64% would draw automatically, 21% need review, 7% need hand work, and 8% have no points.
- **State Parks' accuracy:** points sit a median 1-9 m from real roads. RC's own drawings are
  partly schematic, a typical 13 m off.
- **Recreation.gov automatic share (50-campground sample):** 64% pass on their own, 76% after one
  look. Not measured: review time per map, and positions under dense canopy.

**Next, when the owner says so** (about 3-4 weeks of sessions for both providers; the breakdown is
in the design doc):
1. ~~A 50-campground Recreation.gov sample.~~ Done 2026-10-07 (above), then ~~pick the road
   source by fit~~ and ~~trace missing loops~~, both built the same night. Options still open, each
   the owner's call (design doc, "What would raise it"):
   - **approve the 23 held maps** on the review page (12 only need their traces approved);
   - put the traced roads into OpenStreetMap too (needs the owner's own OSM account);
   - draw maps over the aerial photo;
   - split multi-campground listings;
   - restroom and water text from the Forest Service where the map has no location.
2. Bring the map into CampHawk (campsite-finder). Gated on Apple's approval of the current build
   and the owner's go-ahead.
3. The Recreation.gov rollout.
4. ReserveCalifornia, after State Parks answers.

**For CampHawk's issue list:** campsite-finder's `docs/CONTEXT.md` says providers don't publish
site coordinates. RIDB does, for 84% of bookable sites, and CampHawk's RIDB sync drops them.

## Waiting on the owner
0. **CampHawk shirts: print the pick (round 4 no. 7); owner to order** (2026-10-08, PR #24 open).
   - **Decision.** The owner picked no. 7 "Short reflection" (no mirrored peak: the wife said it read as a
     diamond). Rounds 5-10 then polished it with fresh art-director and print-technician scores each round
     (final: 8 / 8.5 and 9), but shown side by side the owner chose the **pick as it was**: "the hawk, tent
     and fire in the new one look terrible." Don't reopen the polish unless the owner asks.
   - **The files.** `studio/camphawk-shirts/kit/`: the pick from `ref/pick-no7/`, rebuilt by
     `node studio/camphawk-shirts/pickkit.mjs` with only the print-safety rules (`prep5.py` via
     `finish5.py ... keep`, about 0.3% of the ink). PNGs are the masters (11.5 x 8.33 in canvas, art about
     10.1 x 7.6 in); 1-bit screen films per ink with registration marks; traced SVGs. Chest prints unchanged.
     The production spec (placement, DTF press settings, screen order, meshes, strike-off) is the last
     section of the shirt README.
   - **Pages.** Kit page (the pick, with films): https://claude.ai/artifact/W4NqM9AcXuW41qFYoVUGhM.
     Emailed to the owner 2026-10-08: the as-picked files untouched, https://claude.ai/artifact/BYjkHu1DDX9ZnHRGSWpCdD.
   - **The plan.** Giveaway (one ink, natural): DTF transfers pressed at home, about $9 a shirt. Owners
     (three inks, sage): a screen shop (as DTF it is a stiff 27 in2 patch).
   - **Next, waiting on the owner:** how many of each shirt and the heat press size, then build the DTF
     gang sheet from `kit/*_300dpi.png`; merge PR #24 on the owner's word.
   - Vercel image credit used: $0.62 of the owner's $0.75. Both Flux Kontext edits of the peak were
     unusable (one near-identical, one painterly), so nothing from the image model is in the files.
1. **GitHub default branch → `main`** (GitHub → Settings → General → Default branch). New PRs
   still default to the old session branch.
2. *(Optional)* **`LAB_PASSWORD` for Preview** in Vercel, so lab work can be reviewed on a
   branch's preview link before it merges.
3. **Apple's review of CampHawk's current app build.** The owner is waiting for Apple to accept
   it before starting a new build. Don't start bringing the lab look to camphawk.app until then.
   The iOS app's webview loads camphawk.app directly (`server.url`), so web changes show in the
   app too.

## Next up (in order)
0. **CampHawk lab: rounds 6–17 on `ccr-c1332bd1-j9qtgp`** (in a PR for review; PR #16 is merged
   and done). Critics sat at 8.55–8.65 for six rounds of small fixes, so the owner picked "option
   1": rework the weakest templates. Done 2026-10-07: plain bands carry two or three numbers from
   the data (`facts` on `LabPage`); state, site-type and hub pages use `CatalogLayout` (lead and list
   in one column, sticky "Narrow it down" card); Always booked shares it; Welcome is a plain band, a
   700px setup column and the example alert beside it. Round-15 critic scores: see
   `docs/design/camphawk-home.md`: rounds 15 and 16 averaged 8.65 (best screens 9.0–9.2; the
   floor is now the guide and app-paywall pages at 8.3–8.5). Still open from round 16: Explore's
   default capture shows no results or map; numbered-step boxes on six screens; Welcome's
   Finish/Skip pair; Claim and Connect frames differ. Open a PR when the owner asks; merge only on
   their word. **Terms** (published text, not reworded) says billing is through Stripe only and
   alerts are email and text only, and doesn't cover auto-cart or holds: for the owner.
   **Round 17 and after (2026-10-07):** a second rework (Explore first run, New watch's "Your watch",
   the in-app paywall) held critics at 8.6. **PR #18** merged 2026-10-07
   (production smoke 27/27). Done after it opened: the campground page opens on its
   first open night, every holdable row on Manage says when it releases, sign-up has a consent
   line. Kept on purpose: Welcome's Finish and Skip (carrier rules need a way past texts), Claim's
   "Not now" outside its cards (Claim is three cards; Connect is one). Still open, owner's call:
   the three legal-text gaps above; numbered-step boxes remain on Home, Welcome, the auto-cart
   guide and Pricing (where they explain a process, not a screen).
   **For the owner, from CampHawk's real Privacy Policy** (flagged in a lab note, not reworded): it
   says email alerts can be turned off (the product keeps email always on), and it doesn't mention
   the saved Recreation.gov login auto-cart keeps.
1. **CampHawk lab: fix rounds are merged** (PR #16, 2026-10-06). Five critic/audit rounds took the
   lab from 6.5 to 8.0. What changed and what's still open: `docs/design/camphawk-home.md`, "Fix
   rounds: toward a 10". The open list is the next lab work, if the owner wants it.
   **Bringing it to camphawk.app** waits for Apple to accept the current app build (above). When it's
   time, the owner gives: write access to campsite-finder, the scope (which screens first), a preview
   review on Vercel, and a ship time.
2. **CampHawk lab: owner review.** Every CampHawk screen is live in the lab (PR #15 merged
   2026-10-06, smoke 26/26). Start at `/private/camphawk/golden-hour/screens`. These are
   mockups on example data; bringing the look to camphawk.app is a separate project in
   campsite-finder and needs the owner's go-ahead (proposed order: shared tokens, header and
   badge first, then screens a few at a time, plus the CampHawk bug list below).
   Every lab switch is in the URL (`?as=subscriber`, `plan=alerts`, plus each screen's own).
   What was built, what's real vs illustrative, the lab changes and the CampHawk issues found
   are in `docs/design/camphawk-home.md`, "Every other screen". Owner's earlier calls kept: band
   photos on New watch and Your watches; the "Check out on Recreation.gov" button on an in-cart
   watch. Left as CampHawk has them: caps tags, mid-dot meta lines, "Auto-Cart" as the plan name,
   title-case site-type headings (they're the search query).
   **Possible next steps** (owner's call): hand the "found in
   CampHawk" list to CampHawk's own repo as issues.
   **CampHawk's code:** attach `TylerFlores1992/campsite-finder` to the session **read-only**
   (`add_repo`, access "read"), clone to `/home/user/campsite-finder`, then disable pushing:
   `git -C /home/user/campsite-finder remote set-url --push origin DISABLED-read-only`. Never
   modify it. Its design rules (`.claude/skills/camphawk-design/SKILL.md`) bind every lab
   screen and win over references (that's why there's no glass).
   **Art** (`studio/camphawk-round2/`, free credit only, $2.045 left; `generate.mjs` stops under
   $2, so no more images without new credit; `m1`, `p1`, `v1`, `s1` were the last four): band photos `e1` (Explore), `n1` (New watch), `w1` (Your
   watches) share `BandPhoto` and the `.gh-app-photo`/`.gh-app-scrim` rules (crop per photo via
   `--gh-pos`/`--gh-pos-lg`; band text over them measures 4.8:1 or better, all of it large type). Also `e2` (map), `c2`
   (brightened), the badge (`badge-golden-*`). Round-1 screens keep the original badge on purpose.
3. **Speed:** measure LCP with https://pagespeed.web.dev on tylerflores.dev. Target is 1.8 s on
   mobile. If over, trim client JS (home ships only HeroFilm as a client component; check the
   bundle with `next experimental-analyze`).
4. **ETCP study:** if the owner wants more, a Theatre-weighted set (its outline is in the same
   handbook) or a 150-question timed "full exam" mode drawing from A/B/C. Write new sets the same
   way as `set-c.ts`: facts verified against primary sources, numbers recomputed in tests.
5. **Later:** ⌘K palette, `/bench`, offline support for `/workshop/*`, a CampHawk tier-3 page
   with real screenshots (ask before publishing any number).

## What's built, in more detail

### Foundations (Phases 0–3)
Brief: `docs/BRIEF.md` (Direction E "Monument"). Next 16 + Tailwind 4 tokens, design guard
tests, screenshot harness, CI, skills. Primitives in `src/components/`. Fonts subset to 40 KB
(`scripts/subset-fonts.sh`). Per-page OG images, sitemap, robots, manifest, view transitions.

### Home hero
Code-rendered film (`studio/film/`, skill `hero-film`): 16:9 and portrait cuts, AV1/H.264,
AVIF posters. Intro readable in about 1.2 s. Reduced motion or Save-Data shows the poster only.

### Hero media caching (2026-10-06)
The film and posters live in `public/media/hero/<hash>/`, where the hash covers every file's
name and bytes (`src/lib/hero-media.ts`). `next.config.ts` sends `public, max-age=31536000,
immutable` for that path. A re-encode fails `src/lib/hero-media.test.mts`, which prints the new
folder name; the smoke test checks the header on the live site.

### Bridle calculator
Math in `src/tools/bridle/math.ts`, tested against worked examples and 500 random rigs.
Draggable and keyboard-operable diagram, ft/lb ↔ m/kg, deep links, the math worked by hand.

### ETCP rigger study (`src/tools/etcp/`)
- Practice tests A and B (25 questions each): answers lock in, ✓/✕ shown in words, working
  shown. Every numeric answer is recomputed in `questions.test.mts` (bridles through the
  calculator's solver).
- 73 flashcards in four decks, told apart by name and glyph, never colour. The original
  tilting card was backward (the higher pick gains load); fixed, with a geometry test.
- Formula reference in our own notation, each formula linked to its questions, plus the
  official ETCP PDF. Exam outline counts checked against ETCP's pages.
- Practice test C (`set-c.ts`, 50 questions): weighted like the real exam by ETCP's Arena
  outline (handbook rev. 5.0, Feb 2016: 1A 25, 1B 15, 1C 10, 2A 10, 2B 25, 2C 25, 3A 10, 3B 30
  of 150; each area within one question of its share, tested). It uses ETCP's sample formats:
  "1 and 2 only" lists and put-in-order items. The score card breaks results down by area.
  Facts were checked against eCFR (OSHA 1910/1926), Crosby Applications & Warnings, CM Lodestar
  manual, Prolyte manual, a Tomcat load table and ETCP's formula sheet, with sources named in
  the explanations. Answer keys are spread across A–D (tested).
  Left out on purpose: "taildown" and "cable puller" (in the outline, but no public definition
  found), and an exact WRTB splice-efficiency figure (couldn't reach a primary source).
- Progress is saved in the browser only (`stored.ts`).

### Private tab (`src/app/private/`, `src/proxy.ts`, `src/lib/private-auth.ts`)
- The header's third tab, with a lock icon. On phones the Home tab steps aside (the "Cyber Wolf"
  name links home) so the brand never wraps; Home returns from 640 px.
- `/private/sign-in`: the site's own password page. One field, Show/Hide, errors in words with
  ✕, refocus after a miss, works without JavaScript (Server Action). A wrong password waits
  600 ms before answering.
- Session: `v1.<expiry>.<HMAC>` cookie keyed from `LAB_PASSWORD`, HttpOnly, Secure, SameSite=Lax,
  path `/private`, 30 days. Stateless; changing the password signs every device out.
- `src/proxy.ts`: pages without a session → sign-in with `?next=` (only paths inside `/private`
  are honored); files → 401; everything private gets noindex + `Cache-Control: private,
  no-store`. Fails closed when the variable is unset or empty.
- `/private`: lists projects from `src/lib/private.ts`, plus Sign out.

### CampHawk lab (`src/lab/camphawk/`, `src/app/private/camphawk/`)
- CampHawk's marketing home ported as a design sandbox, with a "View as" switch for its
  signed-out / subscriber / in-app pricing. Fake data; every link is `#`. A breadcrumb leads
  back to Private.
- CampHawk's look is scoped to the lab: `ch-*` tokens in `globals.css`, Bitter + Nunito Sans
  loaded in the lab layout only, brand images in `public/private/camphawk/`.
- **New looks** (`src/lab/camphawk/looks.ts`, `LookScene.tsx`, `/private/camphawk/looks`):
  Ridgeline, Topo, Field guide, Park poster, Dusk, Painted, plus Current. `?look=<id>` picks one;
  the switch keeps it in the URL. Each look changes only the backdrop and the card finish
  (`.look[data-look=…]` rules in `globals.css`). Ridgeline and Dusk bend CampHawk's "no gradients
  or glows" rule; the overview says so.
- Look art is drawn in code from CampHawk's palette: `node studio/camphawk-looks/render.mjs
  [name …]` writes `public/private/camphawk/looks/*.webp` (seeded, so renders repeat exactly).
  Painted is CampHawk's own unused `hero-bg-alt.webp`. Dusk's hero type is light on `ch-ink`
  (7.2:1 or better; those pairs aren't in the contrast test, which covers our tokens only).
- Not ported yet: CampHawk's `--ch-sticky` scroll padding (anchor jumps can land under the
  phone header) and the account menu.

### CampHawk round 2 (`src/lab/camphawk/round2/`)
- Built with skill `design-direction`. Brief, references, contracts and "As built" notes for both
  screens: `docs/design/camphawk-home.md`.
- **Golden hour home** (`GoldenHour.tsx`): a dusk photo hero (one photo at every size), an
  example alert as CampHawk's open-site card, search docked on the photo's edge (under the intro
  on phones). "What a watch does" shows each promise as a piece of CampHawk's UI
  (`WatchProofs.tsx`). Pricing in `Pricing2.tsx`.
- **Campground** (`Campground.tsx`, `campground-data.ts`): the answer first ("5 days with
  openings in July"), docked photos, a month calendar with CampHawk's states (open, booked, past,
  couldn't check, not open for booking, failed read), the day panel, About, "Is … fully booked?".
  Lab switches: "View as" (four visitors, each with WatchCta's label), "Reservations / First
  come", "Page" (loaded, loading, not found, couldn't load) and "From" (search or Google, which
  swaps "Back to search" for the breadcrumb). Example data pins "today" to Jul 6, 2026.
- **CampHawk's rules hold everywhere:** green only for an open site or an action, blue for the
  Recreation.gov hand-off, ochre only for "you asked for this", every status in words (`Tag`,
  `Card` ported to `src/lab/camphawk/ui/`), "Open for Jul 18-21" dates, `shadow-ch-pop` only, no
  glass. Shared chrome in `GhChrome.tsx`; the lab bar in `LabBar.tsx`; home copy in `copy.ts`.
- **Art** is generated: `studio/camphawk-round2/` (`generate.mjs` through Vercel AI Gateway,
  `prompts.mjs`, `export.mjs` for picks). Free credit only: $2.34 of $5 used, nothing bought;
  GPT Image and the Recraft pro tiers refuse free credit (403). Flux ignores "no X": describe
  what IS in the frame instead.
- **Guards:** e2e checks both directions' art, search and pricing views, the copy rewrites, and
  the campground's days, months, page states, breadcrumb and watch labels (each new guard
  mutation-tested). The lab's scrollbar, overscroll ground, selection and phone browser bar are
  themed (`html:has(.camphawk)` in globals.css).
- Save the owner's reference screenshots to `docs/design/refs/` next round.

## Measurements (2026-10-02)
- Local production build, Lighthouse 12, mobile: home 98, calculator 98, workshop 99
  performance; 100 accessibility, best practices and SEO; CLS 0. LCP 2.2–2.4 s simulated
  (target 1.8 s). Desktop: 100, LCP 0.5–0.6 s.
- Lighthouse run from this container against the live site is too noisy to judge (LCP 1.9 to
  3.6 s across runs). Use PageSpeed Insights from a real browser.

## Gotchas
- `globals.css` collapses every transition to 1ms under reduced motion, and the default
  transition property is `all`: a script that reads computed styles (an outline, a colour) right
  after a change sees the old value. Wait a frame (30-60ms) before reading or screenshotting.
- A `<label>` that wraps a `<select>` makes the option text part of its accessible name; give the
  select an `aria-label` if tests look it up by label.
- `hidden` plus `buttonClasses()` on one element: the button's `inline-flex` wins and it shows.
  Wrap it in `<span className="hidden sm:contents">` instead.
- A grid with a fixed container height still sizes its implicit rows to content (square photos
  overflow and cover what's below). Set `auto-rows-[…]` on the grid, not `h-[…]`.
- Lab headings: `.camphawk h1` uses `var(--font-ch-display)`, which `@theme inline` never emits, so
  headings on the lab's Current page render in Nunito. Round 2 names Bitter directly. Check whether
  camphawk.app has the same bug before "fixing" Current.
- AI Gateway's OpenAI-style `/v1/images/generations` ignores `aspect_ratio`; use the AI SDK's
  `generateImage({ aspectRatio })` (studio/camphawk-round2/ has its own package.json).
- Recraft (free tier) tops out at 1280px; flat poster art survives a 2x Lanczos upscale, photos wouldn't.
- `create-next-app` refuses the folder name "Tools" (capitals): scaffold elsewhere, copy in.
- `LayoutProps` needs `next typegen` before `tsc` on a clean checkout (`typecheck` does it).
- `pkill -f 'next start'` kills your own shell. Use `pkill -f '[n]ext-server'`.
- Software WebGL here renders about 5 s per 1080p film frame; run film renders in the background.
- tsx injects `__name()` into functions passed to `page.evaluate`: add
  `page.addInitScript("globalThis.__name = (f) => f")` first (scripts do).
- Screenshot after entrance animations finish, or the shot (and contrast reading) lies.
- `opacity-*` on text breaks token contrast; the opacity guard fails on it.
- A mutation test only counts if the build succeeds: a break that fails `tsc` leaves the old
  build in place and the e2e run proves nothing. Check `npm run build` exits 0 first.
- In a `&&` chain, don't put `;` before `git push`: the push runs even when an earlier commit
  failed.
- Vercel connector: pass no `teamId` (403 "re-authenticate to this scope"); `create_project`
  works where `create_git_project` doesn't. It can't sign in to Private: test that with
  `npm run e2e` locally, which starts its own server with a known password.
- Next's route announcer repeats the new page's `<h1>` in a hidden live region after a client
  navigation, so `getByText(<h1 text>)` matches twice. Use `getByRole("heading", …)`.
- A plain CSS class used only inside a compound selector (`.look[data-look=x]`) fails the tokens
  test: give it a base rule of its own at the start of a line.
- Playwright `fullPage` shots draw `position: fixed` backgrounds one viewport tall (the Topo map
  stops partway). That's the screenshot, not the page; check by scrolling.
- Text fields draw the focus ring on their frame: wrap the input in `.field` (globals.css).
- From this container, `curl https://tylerflores.dev` fails but Node's `fetch` works, so
  `npm run smoke -- https://tylerflores.dev` is fine. To inspect the certificate:
  `openssl s_client -connect tylerflores.dev:443 -servername tylerflores.dev -proxy ${HTTPS_PROXY#http://}`.
- Lighthouse against a live URL from here needs `--chrome-flags="--ignore-certificate-errors
  --proxy-server=$HTTPS_PROXY"` (the proxy re-signs TLS).
