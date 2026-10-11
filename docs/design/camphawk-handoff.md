# CampHawk: bringing the Golden hour look and the campground maps to camphawk.app

*Hand-off from the tylerflores.dev lab to a campsite-finder orchestrator session, written
2026-10-11. Owner: "Write the handoff, but all will go through an orchestrator session to then
disperse as needed." Every package below goes through that one orchestrator. It sizes each
package, dispatches it, holds the CI slot, checks the branch and opens the PR. No package is
started from this repo.*

## 0. Read this first (the orchestrator)
- **Start:** a cloud session on `TylerFlores1992/campsite-finder`, named "Orchestrator", running
  `/orchestrate` with no task (its boot readings). Then:
  - attach this repo **read-only**: `add_repo` with `owner: TylerFlores1992`, `repo: Tools`,
    `access: "read"`;
  - clone it to `/home/user/Tools`, then run
    `git -C /home/user/Tools remote set-url --push origin DISABLED-read-only`;
  - read this file, then `docs/design/camphawk-home.md` (the lab's design record).
- **Nothing merges to `master` until both of these hold:**
  - Apple has approved the iPhone build under review (1.0 (28), resubmitted 2026-10-05);
  - the owner says ship.

  The reason is that the iOS app's webview loads camphawk.app itself, so a merge shows up in the
  build Apple is reviewing. Branches, CI runs, drafts and PRs are all fine before then. The merge
  is the gate.
- **This repo is reference only.** Copy what you need into campsite-finder. Never push to Tools,
  and never import from it.
- **Where the rules come from:**
  - campsite-finder's own `CLAUDE.md`, `docs/LANES.md`, and its `camphawk-design` and
    `web-design-guidelines` skills bind every package;
  - so does the orchestrate skill's spawn checklist (branch, migration number, no PR from a child,
    `NODE_USE_ENV_PROXY=1` for every `npm run verify`).

  Where this file disagrees with campsite-finder's `CLAUDE.md`, the `CLAUDE.md` wins.

## 1. What the owner still has to decide (ask before the package that needs it)
| Decision | Needed before | Notes |
|---|---|---|
| Ship time | any merge | After Apple's approval. Proposed: merge package by package, not one big swap. |
| How to review a branch | P2 onward | `vercel.json` turns off deploys for `claude/*`, so a child's branch has no preview link. The options: (a) the owner allows one preview prefix, which is a `vercel.json` change; (b) review through local screenshots: `next build` and `next start` with the live keys, and `scripts/screenshot-component.mts` presets. |
| The badge | P2 | The lab's "golden" badge (`badge-golden-80/120.webp`, an AI edit of CampHawk's own `logo-badge.png`) or the product's `BrandMark` / `HawkGlyph`. |
| The AI art | P2 | Every lab photo and painting was made through Vercel AI Gateway (Flux 1.1 Ultra and Recraft v4.1, free credit). No licence or provenance note was ever recorded. Decide whether to ship them and what credit line, if any, to keep. |
| Canopy maps ("decision 5") | M2 | Publish canopy maps with only the roads we can see, or keep them hidden. This decides how many of the 1,005 hidden maps can ever ship. Background: `docs/design/campground-maps-completion-plan.md`, "Decisions for the owner". |
| OpenStreetMap share-alike | M1 | 2,731 maps carry OpenStreetMap data, under the ODbL licence. A map *image* is a "produced work" and can stay ours with credit. Map JSON served to browsers may count as a database extract, which the ODbL says must be offered under the ODbL too. Simple options: say so on a data-sources line and offer the JSON, or draw OSM roads into a non-data form. Not legal advice; the owner's call. |
| The Terms and the Privacy Policy | before public launch | The published Terms say billing is Stripe only and alerts are email and text only. They don't mention auto-cart, holds, store billing or push. The lab also flagged that the Privacy Policy says email can be turned off and doesn't mention the saved Recreation.gov login. That may predate the 2026-10-05 privacy rewrite, so re-read it. The look port never rewords legal text. |
| Filing the bug list | P0 | Whether the "found in CampHawk" list (§5) goes in as GitHub issues. |

## 2. Lane ownership and deploy traps (from campsite-finder's `docs/LANES.md`)
- **Side lane:** `src/app/(app)/` and `src/components/v2/` (the screens). Branch `claude/side-<topic>`.
- **Main lane:** `src/lib/`, `worker/`, migrations. Branch `claude/<topic>`.
- **Not assigned in LANES:** `src/components/ui/` and `src/app/globals.css`. The orchestrator
  assigns them, and says so in the spawn prompt.
- **Worker-deploy traps:** a merge touching `worker/**`, `src/lib/sources/**`, `src/lib/db/**`,
  `src/lib/limits.ts`, `src/lib/auth.ts`, `src/lib/types.ts` or the other entries in
  `worker-deploy.yml`'s `paths:` restarts every poller.
  - Keep the look and the maps out of those paths.
  - Put map code in `src/components/v2/` (or a new `src/lib/site-maps/`, which is not in
    `paths:`), never in `src/lib/sources/`.
  - The RIDB coordinate change (M3) is a worker deploy by nature.
- **Migrations:** main's block 090–099 has one number left (099). Anything after it claims a new
  block in `docs/LANES.md`, in the same PR.

## 3. Work packages
Sizes are a suggestion. The orchestrator sizes each one. Order: P0, then P1, then P2, then any
of P3–P5. M0–M2 run alongside P1–P5, because they touch other files. M3 is optional.

### P0. Check the bug list against master (no code)
- Re-read every item in §5 against current `master`. Several may be fixed already; the list was
  written on 10-06 and 10-07.
- Report each item as still true or fixed, with the file and line.
- File the ones still true as issues, if the owner says so.
- Two items are plain bugs, not look. They could ship ahead of the port if the owner wants:
  - `thisWeekendRange()` in `src/components/ui/date.ts`. It reads the weekday from
    `new Date(today)`, which is UTC midnight, so "This weekend" becomes Saturday to Monday in
    every US timezone. The lab's copy, `src/lab/camphawk/ui/date.ts`, has the fix and a test that
    runs in Los Angeles time.
  - Explore showing `Search failed (502)`.

### P1. Tokens, contrast and primitives (`src/app/globals.css`, `src/components/ui/`)
- **Tokens.** Every `ch-*` value the lab shares with the product is identical; the lab copied
  them on 10-02. Three are lab-only, and the product's `ch-tokens.test.mts` will fail on ported
  code until they exist:
  - `--color-ch-white` `#FFFFFF`. The lab uses it 112 times, including `text-ch-white/70`, `/80`
    and `/85`. The product uses stock `text-white` in places.
  - `--color-ch-map-water` `#BFD6D1`.
  - `--color-ch-map-water-ink` `#2F5550` (5.5:1 on map water; water is never blue).

  The lab tokens are at Tools `src/app/globals.css` lines 167–241. The product's are at
  campsite-finder `src/app/globals.css` lines 52–155.
- **Contrast. Neither repo has an automated `ch-*` contrast test.** Add one before the new pairs
  ship. Pairs the lab uses that the product doesn't today:
  - white, and white at 70–85%, on forest and on photo scrims;
  - `ch-line` text and `ch-paper` text on forest;
  - forest on paper (the lab's `paper` button);
  - `ch-faint` as disabled text on paper and on card;
  - `ochre-ink` on `ochre-soft`;
  - `map-water-ink` on `map-water`.
- **Primitives.** Each lab file in `src/lab/camphawk/ui/` started as a copy of the product's file
  and has drifted:
  - `Chip`: selected is forest with a tick, not green; disabled is faint.
  - `Tag`: **a shape mark per status, because the owner is colour-blind**.
  - `DatePicker`: reading sizes, 44px cells, the range in forest and shell.
  - `Card`: paused uses a text token, not opacity.
  - `Collapsible`, `FilterPanel`, `NightsPicker`, `RadioChips`, `hit.ts`: small changes.
  - `ui.ts` `buttonClasses`: adds `ink` and `paper` variants.

  `StatusMark.tsx` exists in the product only as `src/components/admin/status-mark.tsx`, an admin
  component. The lab promotes it to a UI primitive.
- **Fonts.** The faces are already the product's: Bitter and Nunito Sans via `next/font/google`.
  Watch for two lab leaks:
  - `font-sans` in `ErrorStates.tsx` would render in Inter;
  - `font-mono` in the admin map tools has no loaded face in the product (its `--font-mono` points
    at Geist Mono, which isn't loaded).

### P2. The frame: header, footer, bands, art
- **What to port:**
  - `PhotoHeader` and `GhFooter` (`round2/GhChrome.tsx`) into `v2/V2Nav.tsx` and the footer in
    `src/app/(app)/layout.tsx`;
  - `AppBand` and `BandPhoto` (`round2/AppParts.tsx`), and the "reading kit" in `LabPage.tsx`
    (`Prose`, `H2`, `H3`, `P`, `Ul`, `Steps`, `Faq`, `Callout`, `CtaBand`, `WithRail`, `Panel`,
    `ActionLink`);
  - the look of `BareFrame.tsx`, for `/w`, Claim, Connect, and Sign in and up;
  - the `.gh-*` CSS (photo, scrims, pins, map halo): Tools `globals.css` around lines 395–530.
- **Lab scaffolding. Never port any of these:**
  - `LabBar`, `labState.ts` (`?as=`, `useVisitor`, `useUrlState`), `ROUTES` in `gates.ts`;
  - `LabNote`, `LabSelect`, `ScreenLinks`, the `PLANS` switch;
  - the `/screens` and `[...missing]` routes.

  Real state comes from Clerk, `useSubscription`, `useIsNativeApp` and the APIs. The gate rules in
  `gates.ts` already exist as `v2/WatchCta.tsx` and `SubscribeCta.tsx`; reuse those.
- **Differences to resolve:**
  - The lab's tabs differ by sign-in. Signed in: Watches, New watch, Explore. Signed out: Explore,
    New watch, Pricing. The product always shows `/watches`, `/new` and `/search`.
  - The lab footer adds Pricing. **No price and no pricing link may show in the native app.**
    Check every new link against `useIsNativeApp`.
  - The lab's "Explore" is the product's `/search`. Keep the product's URLs.
- **Art:** the Golden hour set, about 3.6 MB of webp in Tools
  `public/private/camphawk/round2/`, served as `<name>-<width>.webp`:
  - home: `a1-hero-wide` (828/1440/2560) and `a4-cta-dusk`;
  - `a3-phone-dusk` (WatchProofs);
  - campground: `c1-loop-dusk`, `c2-site-dusk`, `c3-river-dusk`;
  - band photos `e1`, `n1`, `w1`, `m1`, `p1`, `v1`, `s1` (828/1440/2560);
  - `k1-halfdome-wide` (camping pages) and `e2-map` (Explore's illustrated map).

  Plus `art-lqip.ts` (blur placeholders) and the `Art` / `ArtPair` component (`round2/Art.tsx`).
  The lab uses plain `<img>` only because the files sit behind its sign-in. In the product, decide
  between `next/image` and `public/brand/`. Skip the Trail poster set (b1–b6) and `t1-tent-wide`
  (unused). Waits on the art decision in §1.

### P3. The alert loop (handle with the most care)
| Lab route (Tools `src/app/private/camphawk/golden-hour/…`) | Lab component (`src/lab/camphawk/round2/…`) | Real route | Real component |
|---|---|---|---|
| `/manage` | `pages/Manage.tsx` | `app/(app)/manage/[token]` | `v2/ManageWatch.tsx` |
| `/w` | `pages/Action.tsx` (bare) | `app/w/[token]` | `v2/HoldConfirm.tsx` |
| `/claim` | `pages/Claim.tsx` (bare) | `app/claim/[id]` | `v2/ClaimFlow.tsx` |
| `/settings` | `pages/Settings.tsx` | `app/(app)/settings` | `v2/Settings.tsx`, `AutoCartSettings`, `SmsAlerts`, `DeleteAccount`, `SignOutConfirm` |
| `/connect` | `pages/Connect.tsx` (bare) | `app/connect` | inline page |
| `/welcome` | `pages/Welcome.tsx` | `app/(app)/welcome` | `v2/Welcome.tsx` |

- **`ClaimFlow.tsx` is on the RC hold hand-off path.** Change its look only, never its logic or
  timings. Read campsite-finder's `rc-autocart` skill before touching it.
- **Truth fixes the lab made, which carry over:**
  - Alerts-plan subscribers aren't told auto-cart is on (Settings);
  - Connect's "Done" says the sign-in worked and goes to Settings, not `/`;
  - `/w` mute shows the site name, not the provider id;
  - one format for release times.

### P4. The core screens
| Lab | Lab component | Real route | Real component |
|---|---|---|---|
| `/` | `GoldenHour.tsx`, `Pricing2`, `WatchProofs`, `Art`, `../copy.ts` | `app/(app)/page.tsx` | inline + `v2/PricingSection.tsx` |
| `/explore` | `Explore.tsx` | `app/(app)/search` | `v2/Explore.tsx`, `ResultCard`, `ResultsMap`, `BrandHeader`, `SetupNudges`, `PricingLink` |
| `/campground?id=` | `Campground.tsx` | `app/(app)/campground/[id]` | `v2/CampgroundDetail.tsx`, `AvailabilityGrid`, `CampgroundOpenings`, `WatchCta` |
| `/new` | `NewWatch.tsx` | `app/(app)/new` | `v2/NewWatch.tsx`, `TrustPanel`, `SiteMuteList`, `SubscribeCta` |
| `/watches` | `Watches.tsx` | `app/(app)/watches` | `v2/WatchesList.tsx`, `WatchCard`, `HoldRow`, `HoldsPanel`, `NewWatchOutlook` |

- **Lab example data, and what it maps to in the product:**
  - `explore-data.ts`: `/api/search`, `/api/suggest`, `/api/geo`.
  - `campground-data.ts`: `/api/campgrounds/[id]` and `/availability`.
  - `newwatch-data.ts`: `/api/suggest`, `/api/favorites`, `POST /api/watches`.
  - `watches-data.ts`: `/api/watches`, `/api/watches/alerts`, `/api/watches/[id]/outlook`,
    `/api/rc-holds/mine`, `/api/health/status`, `/api/user/autocart`.
- **Lab additions with no product equivalent yet:**
  - the home photo hero, `AlertCard` and WatchProofs;
  - Explore's illustrated first-run map, its four answers in words, and shape-coded pins;
  - New watch's live "Your watch" preview;
  - the campground photo strip, opening on the first open night, and a Book button in the day
    panel;
  - the site map (M2).

### P5. Everything else
| Lab | Real |
|---|---|
| `/pricing` (`pages/PricingPage.tsx`) | `app/(app)/pricing`: `PricingSection`, `Pricing`, `StorePaywall`, `RcHoldExplainer` |
| `/sign-in`, `/sign-up` (`pages/Auth.tsx`, a stand-in for Clerk's widget) | `app/sign-in`, `app/sign-up` (`AuthPanel.tsx`). Style Clerk's widget; don't replace it. Keep `?plan=` through sign-up. |
| `/auto-cart`, `/campsite-cancellation-alerts`, `/sold-out-campsite` (`pages/Guides.tsx`) | the same paths under `app/(app)/` |
| `/camping`, `/camping/[state]`, hardest-to-book, the cabins, group and yurts hubs and their state pages (`pages/Camping.tsx`) | `app/camping/**`, `v2/SiteTypeHubPage.tsx`, `SiteTypeStatePage.tsx` |
| `/vs/campflare`, `/vs/campnab` (`pages/Vs.tsx`) | `app/(app)/vs/*`, `v2/ComparisonPage.tsx` (the lab shows no prices in the app) |
| `/support`, `/sources`, `/sms-opt-in`, `/privacy`, `/terms` (`pages/Tier4.tsx`) | the same paths under `app/(app)/`. **Legal and SMS wording is published text; keep it word for word** (the SMS opt-in is quoted by the A2P campaign). |
| `/errors` (`pages/ErrorStates.tsx`, `state=not-found\|error\|global`) | `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` |

The admin, `admin/users`, `admin/books/**` and `b/[token]` have no lab version. Leave them as
they are.

### M0. Map export (in Tools, the one package that runs there)
- **Map files:** Tools `public/private/camphawk/maps/ridb-<FacilityID>.json`.
  - 3,211 maps, about 39 MB, median 8 KB, largest 191 KB.
  - The type is `SiteMapData` in `src/lab/camphawk/round2/maps/index.ts`.
- **Which maps may ship.** Decisions live in `src/lab/camphawk/round2/maps/decisions/wave-*.json`,
  and a later wave's file wins.
  - **2,105 approved, 1,005 hidden.** 101 built maps have no decision; treat them as hidden.
  - Owner decisions are in waves 0–2. Waves 3–39 were decided under the owner's delegation.
- **Ids line up.** The map key is RIDB's FacilityID, which is campsite-finder's `campgrounds.id`.
- **Sites carry no RIDB CampsiteID, only the site name.** `build.mjs` reads the id and drops it.
  The export should join each site to its CampsiteID from the RIDB export (facility and site
  name), so availability matches by id. Report any site that doesn't join.
- **The job:** a script in Tools, `studio/campground-maps/export-camphawk.mjs`, that writes a
  slim bundle of approved maps only. Keep only what the renderers read:
  - `name`, `frame`, `bbox`, `labels`, `roads`, `trails`, `lots`, `water`, `buildings`, `pois`,
    `sites`, `split`, `firstCome`, `credits`, `sources.roads`;
  - drop `qa`, `trace`, `sourceRoads`, `evidence` and `source`.

  It's a dispatch into the Tools repo (`source_url` Tools, on its own branch, then a PR to Tools'
  `main`, which is Tools' rule). It only reads the maps and writes a bundle; no map changes.
- **Where the bundle lives in campsite-finder is the orchestrator's call.** Options:
  - static files, e.g. `public/maps/ridb-<id>.json` (39 MB in git);
  - Supabase storage, served by id.
- **ReserveCalifornia maps are not part of this.** State Parks' data stays local-only until they
  approve (their answer is due about 10-17). Never commit it.

### M1. Map renderers on the campground page (side lane)
- **Port these:**
  - `CamperMap` (`round2/AreaMaps.tsx:194`), which picks between:
    - `FirstComeMap` (`FirstCome.tsx`) for first-come campgrounds;
    - `UnitMap` for single units (one site);
    - `AreaMaps` (split listings) or `SiteMap` (`SiteMap.tsx`) for the rest;
  - their helpers in `round2/maps/` (`layout.ts`, `areas.ts`, `trace.ts`, `first-come.ts`);
  - the two map-water tokens and the `.gh-map-halo` / `.gh-map-pin` CSS.
- **Where it goes:** `v2/CampgroundDetail.tsx`, near `AvailabilityGrid` (around lines 246–261) for
  reservable campgrounds, and in the first-come panel otherwise.
  - `SiteMap` takes `picked` (the night) and `openIds` (the sites open that night).
    `AvailabilityGrid` already holds the selected day and `openByDay`; lift that state, and match
    by CampsiteID once M0 adds it.
- **The background:** the main map is vector only.
  - `UnitMap` and `FirstComeMap` add a live USGS 3DEP relief image from
    `elevation.nationalmap.gov`. Check it passes the product's image policy, or cache it.
  - No aerial photo is shown to campers.
- **Hidden or missing map:** show the lab's "We haven't drawn a map of <name> yet". Never draw a
  map that isn't approved.
- **Credits:** print each map's `credits` string exactly. Every map credits "Drawn by CampHawk"
  and RIDB (CC BY 4.0); 2,731 also say "Map data © OpenStreetMap contributors". Never drop or
  shorten a credit.
- **Colour never alone.** Open and booked sites differ by shape and a word, not only by hue
  (`camphawk-design`, and the owner is colour-blind).

### M2. Turning maps on (after the owner's decisions)
- Ship the approved set behind a flag first, then all at once on the owner's word.
- Decision 5 may later move canopy maps from hidden to "visible roads only". That needs a
  re-export, not new code.

### M3. RIDB site coordinates in the database (optional, main lane, a worker deploy)
- The maps carry their own positions, so the map launch does not need this. It fixes a separate
  gap: CampHawk throws away RIDB's site coordinates.
  - `src/lib/sources/ridb/transform.ts:199–235` never reads `CampsiteLatitude` /
    `CampsiteLongitude`.
  - `campsites` (migration 001) has no columns for them.
- **Cost:**
  - a migration (claim a new block);
  - `src/lib/sources/**`, which is a worker deploy and restarts the pollers, so merge it away
    from an 08:00 PT release;
  - fixing campsite-finder's `docs/CONTEXT.md`, which says providers don't publish site
    coordinates (RIDB does, for 84% of bookable sites).

## 4. How to check each package
- **Code:** `NODE_USE_ENV_PROXY=1 npm run verify` in campsite-finder. Its test suite hits the
  production database, so one run at a time, through the orchestrator's CI slot.
- **Look:**
  - screenshots at 390 and 1440 (campsite-finder's screenshot presets, or `next start` locally
    with the live keys);
  - an audit with `web-design-guidelines`;
  - a check against `camphawk-design`.
- **Compare against the lab:** `https://tylerflores.dev/private/camphawk/golden-hour/screens`,
  behind the Private password. Every lab switch is in its URL.
- **The native app:** check every screen with the app user agent (`CampHawkApp`). No price or
  pricing link inside the app, and guests (no account) still reach the paywall and Restore
  Purchases. That is the Apple 5.1.1(v) and 3.1.1 fix; don't regress it.
- **After each merge:** smoke a real page on camphawk.app. `next build` passing doesn't prove a
  page renders.

## 5. Bugs and drift found in CampHawk while the lab was built (10-06/07; verify first, P0)
- **The ReserveCalifornia hold.** The hold beta closed on 2026-09-22, but Pricing, Auto-cart,
  both guides and both comparison pages still offered it.
- **Settings** tells Alerts-plan subscribers "Watching, alerts and auto-cart are all switched on".
- **Connect:**
  - "Done" goes to `/`, which shows prices inside the app;
  - its "still working" note only renders in live-window mode;
  - errors show `mint failed (500)` and "Is your CampHawk server online?".
- **Release times and site ids.** `/w` mute shows the provider's site id. There were three
  formats for one release time.
- **Claim's app copy** still says "tap the cart icon", but its own button replaced that.
- **Sign in and Sign up:**
  - no title of their own, and not noindex;
  - Pricing's signed-out trial links drop the chosen plan.
- **Counts that disagree:**
  - `/vs/*` shows prices inside the app;
  - the site-type hub titles count provinces as states;
  - the number of state systems is given as ten, twelve and fourteen;
  - Canadian coverage is given as "12 of 13", "9 provinces" and "7 provincial systems".
- **Spelling:** "cancelled" in Settings (delete), the guides, the state-page descriptions, the
  competitor lines and New watch's ReserveCalifornia note. US spelling is "canceled".
- **Dates and search:**
  - `thisWeekendRange()` UTC bug (P0);
  - Explore titles a typed-but-unpicked place as if searched there, but searches near the device;
  - Explore shows `Search failed (502)`.
- **Welcome and the campground page:**
  - Welcome has an email checkbox that Settings ignores (email is always on);
  - the campground day panel lists open sites with no Book button.
- **Search** has seven names for its buttons.

## 6. Where things are in this repo
- **The lab's design record:** `docs/design/camphawk-home.md`. It covers every screen, the critic
  rounds, the colour and truth rules the lab applied, and the assets log.
- **Lab code:**
  - `src/lab/camphawk/**` (the `round2/` screens, `pages/`, `ui/`, `maps/`);
  - routes in `src/app/private/camphawk/golden-hour/**`;
  - tokens in `src/app/globals.css`.
- **Map pipeline:** `studio/campground-maps/`, its playbook `docs/design/campground-maps-playbook.md`
  (§9 is about bringing maps to CampHawk), and the results in
  `docs/design/campground-maps-completion-plan.md`.
- **Art:** files in `public/private/camphawk/round2/`; prompts and scripts in
  `studio/camphawk-round2/`.
