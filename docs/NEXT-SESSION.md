# Next session

*Updated at the end of every session. Read this first, then `CLAUDE.md`.*
*Last updated: 2026-11-12, night (#146 merged; the Claude app restarted on the PC and the supervisor is live: a real server.py change loaded at 22:47:28 with no restart, and `ping` now says when the code last loaded. Branch `reload-proof`). Before: 2026-11-12, evening (branch `truss-pass-reload` on top of #145, connector 0.9.13 + Rig Studio v37: the connector runs under a supervisor and loads new code without restarting the Claude app (needs ONE last restart on the PC to start it; files are on the PC); Plan shows the 3D-only decks and truss (it showed none of the set); the 80' truss ring is dark red as in Vectorworks; compared with Vectorworks' Top/Plan and Right Isometric, view put back to Top/Plan. Left: the 28' ring is black here, dark grey-green in Vectorworks). Before: 2026-11-12, afternoon (branch `deck-on-towers`, Rig Studio v36: stood-up truss legs read with their real height so Weakest Link's raised deck stands on its towers (bridge already on the PC, no restart; Weakest Link re-read with it); the venue's side wall and corner doorways go in the hidden building row. Offered, not started: connector modules that reload without restarting the Claude app). Before: 2026-11-12, midday (branch `weakest-link-deep`, connector 0.9.12 + Rig Studio v35: shared symbol faces, whole-symbol fallback, curved truss faces, by-class attributes, building row hidden, no extra rig boxes, read from above in turned views, menu tidied. Files on the PC; restart the Claude app (jobs/trigger changed); Weakest Link already re-read with it. Still boxes: 1 Stage extrude; type 84 parts that convert only whole). Before: 2026-11-12 (Weakest Link read out after 0.9.10 (bridge.log proves runs). Branch `weakest-link-fidelity`, connector 0.9.11 + Rig Studio v34: active/grayed layers shown, hidden-layer lights/rig in hidden rows, curved truss not boxed, plan edges in pen colours. Bridge already on the PC; a fresh read-out picks up the active-layer fix). Before: 2026-11-11, night (connector 0.9.10, branch `bridge-trace`: opening a drawing over DDE from the connector's thread left Vectorworks waiting, so no command ran from 12:40 on; now a helper process opens and exits; bridge.log; error boxes never learned (the PC had learned "improper argument" → OK, cleared). Needs the Claude app restarted on the PC, then a read-out to confirm). Before: 2026-11-11, evening (connector 0.9.9, branch `open-vwx-in-vectorworks`: drawings open as Vectorworks' registered file type (the program-path way gave "improper argument"), not Windows' .vwx setting, which had opened the blank in Chromium; files are on the PC, restart the Claude app there; untested on the PC: whether Vectorworks2026.exe given a file opens it in the running copy). Before: 2026-11-11, later (PR #137 merged; branch `one-ask-button`: the chat has one Ask button and hands big jobs to full sessions by itself, Rig Studio v32). Before: 2026-11-11, afternoon (PR #137, branch `font-mapping-prompt`, connector 0.9.7 + Rig Studio v31: Vectorworks boxes answered or passed to the phone with "Answer it this way from now on"; the chat asks for Opus 5.5 and says when the connection dropped; X and Y reference lines via the chat's `set_reference`. The connector files are already on the PC; **after merge, restart the Claude app on the PC**. Open: sheet annotations (drapes on CFF) aren't read; the converted CFF copy doesn't close by itself). Before: 2026-11-11 (connector 0.9.3: mirrored and 3D-tipped symbols placed right, deep symbols drawn, sheets as views; open: sheet annotations, the converted CFF copy doesn't close). Before: 2026-11-10 (Rig Studio read-outs look like Vectorworks: connector 0.9.0 reads pens, weights, texts, dimensions, hatches and switched-off classes; Paper view on by default; PR from `readout-fidelity`, includes #131. After merge: restart the Claude app on the PC, re-read CFF from the phone. Open: viewport overrides not read; the converted CFF copy still doesn't close by itself). Earlier 2026-11-09, later (Home PC: `/private/pc` wakes the main PC through the home server, `connectors/pc-waker/`; connector 0.5.6 reads out `VWMCP_WATCH` folders by itself when the PC is quiet; Rig Studio links to the wake page). Earlier 2026-11-09 (Vectorworks files with the PC off: connector 0.5.5 `read_out` writes `<name>.rigread.json` beside a .vwx, and Rig Studio's Files tab opens it from Dropbox as fixtures, the existing rig and outlines; Rig Studio also got pasted pictures in chat, pin/archive/delete for projects and sessions, no truss question on New project, a better head block; PR #117). Before that, 2026-11-08, evening (connector 0.5.4 updates itself from the site and reads its symbol names from `public/private/vectorworks/symbols.json`; Proxy lets the connector fetch those files with RIG_TOKEN). Before that, 2026-11-08 (Rig Studio: the pinned Claude page for every rig project, blank sketches, chat edits, full sessions through two scheduled tasks, Dropbox folders, build in Vectorworks; `docs/RIG-STUDIO.md`; sleeve, head block and tower base drawn properly; PR #113 merged). Earlier: 2026-11-07, afternoon (Rig Planner: stage template with decks, legs, skirt, rails, stairs; connector 0.4.0 builds decks and legs). Earlier: 2026-11-07 (Rig Planner at `/private/rig` + connector `build_rig`, `docs/RIG.md`). Earlier: 2026-11-06 (Morning Mail sender buttons keep your place). Earlier: 2026-11-03 (whole-site audit: every press gives feedback; see the section below). Earlier: 2026-10-30, night (Recordings: the home DVR at `/private/recordings`, through a key-locked Tailscale Funnel; `docs/RECORDINGS.md`). Earlier: 2026-10-30 (portfolio polish pass over every public page, PR #95: four independent reviews plus a real-Chrome walk-through from the home server via the QA bridge, two fix rounds, confirmed in real Chrome). Earlier: 2026-10-26, night (portfolio + résumé at `/work`, unlisted; `src/lib/work.ts`, PDF via `npm run resume`). Earlier the same day: (Learn to read code: `/private/learn`, Phase 1 lessons, spaced review, Gemini marking; `docs/LEARN.md`). Earlier: 2026-10-23 (Vectorworks: connector + live panel at `/private/vectorworks`, branch `claude/vectorworks-panel`). Earlier: 2026-10-21 (Morning Mail: Likely junk and Updates sections, stricter "a person wrote", #81; Income: phone calendar, .ics import, settings merged, #73-#80). Earlier: 2026-10-20 (Money + Mail cleanup and the work calendar, #72; Income stubs, estimates and EDD benefits, #64-#71). Earlier: 2026-10-18 (home hero redesign started, `docs/design/hero-wilderness-cyber.md`). Earlier: 2026-10-11 (the camphawk.app hand-off written, `docs/design/camphawk-handoff.md`; campground maps: every held map with a public-data fix has been through a batch; delegated waves 2,011 pass, 950 held). Earlier: 2026-10-08, night (CampHawk shirts: after polish rounds 5-10 the owner chose to print the pick as it was (round 4 no. 7), kit rebuilt from it, PR #24; owner's map decisions recorded, PR #25; network back on Full, OSM extracts from OpenStreetMap France). Earlier: 2026-10-08 (PR #22 merged and live, production smoke 29/29: campground site maps' roads picked by fit from four sources, a tracing tool on the Site maps review page, traces on 13 sample maps, 45 of 50 can go live after one look, up from 38; and `docs/design/campground-maps-playbook.md` + the `campground-maps` skill, so "complete the maps" picks the work up). Earlier the same day: the 50-campground sample and review page (PR #19, merged, production smoke 29/29), Upper Pines live in the lab, ReserveCalifornia local-only, both State Parks requests sent; CampHawk lab fix rounds 6–17, PR #18 merged.*

## At a glance

| What | Where | State |
|---|---|---|
| Site | https://tylerflores.dev | Live. Merges to `main` deploy production automatically. |
| Home hero | `/` | Rebuilt 2026-10-18: B1 wolf still (PR #52); the film is retired. |
| Bridle calculator | `/workshop/bridle-calculator` | Live. Signed off by the owner. |
| ETCP rigger study | `/workshop/etcp-rigger-study` | Live. Practice tests A/B (25 each) and C (50, exam-weighted), 73 flashcards, formula reference. |
| Private tab | `/private` | Live. Password-only sign-in in the site's design; 30-day session. Lists private projects. |
| Morning Mail | `/private/mail` | Code version, on trial (owner, 2026-10-18): runs alongside the Claude `/mail` run; owner decides which stays (`docs/MAIL.md`). Removed once (#57) and restored. Yahoo untested against a real server. **2026-10-21 (#81):** new buckets `junk` (each says why; Always trash / Not junk) and `updates` (collapsed); a person needs a name that reads as a name; 'log in' counts as security only in a subject; Yahoo List-Unsubscribe read from the message when the header fetch is empty; "Sort the last week again" re-sorts stored mail (owner presses it; a session may not rewrite rows). Bucket check widened in production. |
| Money → Income | `/private/money/income` | Live and in use (`docs/MONEY.md#income`). Real stubs read and approved for 2025-26; estimated stubs from YTD; EDD Paid Family Leave and Disability filed; work calendar (#72) from the calendar script (connected 2026-10-20, 7 events). Pending deposits count as paid since #72. **Open:** today's Morning Mail rows keep the old "Email from" titles (rewriting them was refused as a shared-data change); the Vercel promo stays under Security for today. |
| **Portfolio + résumé** | `/work` · `/work/resume` | Built 2026-10-26 (owner's call; the one exception to no-bio). Unlisted: noindex, not in nav/sitemap (`src/lib/work.test.mts`). Data in `src/lib/work.ts`; CampHawk numbers counted from its database 2026-10-26; private-tool screenshots use made-up data (`public/media/work/`). After editing the data: `BASE_URL=… npm run resume` reprints `public/work/tyler-flores-resume.pdf`. CampHawk's screenshot came from the home server's Chrome via CampHawk's QA bridge (issue #447 in campsite-finder; files are sent by a PowerShell script posting base64 chunks, since the model can't retype them). 11 years in Local 80; no certs to list (owner, 2026-10-26). |
| **Learn to read code** | `/private/learn` | Built 2026-10-26 (`docs/LEARN.md`). Phase 1 (11 lessons + checkpoint), spaced review synced in the `learn` schema, research page. AI marking untested against the real key. **Next:** Phase 2 lessons. |
| **Rig Studio** | pinned artifact · `docs/RIG-STUDIO.md` | Built 2026-11-08. https://claude.ai/artifact/PuRp9wC1DjALUMwfWQYmk5, pinned. Projects start blank; the Air Pro roof is seeded as the first. Chat edits via in-page Claude; "Start a full session" fires scheduled task `Rig Studio — cloud worker` (trig_01GTgYJhhWxFTC7ebpGHHT5i) or `— PC worker` (trig_01RdKtk6j5UJJkYbK4brJhQY, needs the PC). Prompts in `studio/rig-studio/workers.md`. Rebuild with `npx tsx studio/rig-studio/build.mts`, test with `node studio/rig-studio/dev/test.mjs`, republish with the Artifact tool (`url`). Tested live 2026-11-08: chat edit saved v2; a full cloud session started from the page, read the project, added a hoist and saved v3 in ~3 min. **Blocked on the owner:** (1) merge PR #114 (sessions read `scripts/rig-sketch.mts` from main); (2) in the Claude desktop app on the PC, open the scheduled task "Rig Studio — PC worker" and turn on "Require this computer" (fired from the page it ran in the cloud without the PC, failed cleanly); (3) install connector 0.5.4 on the PC by hand once (from /private/vectorworks); from then on it updates itself at every start, and symbol names come from `symbols.json` on the site (20.5" box uses the Air Pro file's own SLV symbols; untested on real VW); (4) open the page in the desktop app once to allow Vectorworks and Dropbox. **Vectorworks from the phone (2026-11-10):** wake + hand-off work end to end; the 0.5.6 self-update broke the PC's install (pip reinstall of a locked vwmcp.exe), fixed in 0.5.7 (pip only on dependency changes; pyproject held at 0.5.6) and restored on the PC by hand. 0.5.8: default trigger 'menu' presses Tools > MCP Run Job through UI Automation, no keys, so jobs run on a LOCKED PC (measured on the owner's PC with the shipping code: 4/4 unlocked, 6/6 locked, a full read_out locked in 17 s); opens `Desktop\Claude connector.vwx` when no drawing is open (untested on hardware); lock detection = LogonUI.exe running. The owner keeps the lock screen; no sign-in change needed. Next: merge #119-#121, restart the Claude app on the PC, run CFF-26's read-out from Rig Studio. **Home PC wake (built 2026-11-09):** owner does `connectors/pc-waker/README.md` setup: BIOS Wake-on-LAN, `pc-setup.ps1` on the PC, Deco IP reservation, `setup.ps1` on the home server (OptiPlex 7040; too weak to run Vectorworks itself), `PC_WAKER_URL`/`PC_WAKER_TOKEN` in Vercel, `VWMCP_WATCH` on the PC. **CFF-26 (owner's show file, Dropbox `/CFF-26_041426_v2025.vwx`, 79 MB):** waiting for the PC: once connector 0.5.5 is on it (it updates itself at VW start after #117 merges), run `read_out` on that file (or press "Read it out on my PC" in Files); then open the `.rigread.json` in Rig Studio and build the mockup from it. Nothing outside Vectorworks reads .vwx. Flaky: e2e "vectorworks show: rigging … downloads the CSV" failed twice on PR #114 and passed on rerun |
| **Rig Planner** | `/private/rig` · `docs/RIG.md` | Built 2026-11-07. Phone-first 3D planner (cube, goal post, tower, flown grid, **stage**, **ground-support roof**: Air Pro self-climber read piece by piece from its drawing), tap-to-edit, rental list, checks, chat (words, then Gemini), AR Quick Look, Save / Send to Vectorworks. Stage = Vectorworks library 4×8/4×4 decks + legs (measured on the library assembly); skirt/rails/stairs drawn on the phone and rented, not drawn in VW (no library symbols). DB `rig_schema` applied, `RIG_TOKEN` set in Vercel and on the PC (owner, 2026-11-07). **Next:** owner runs `git pull` + `vwmcp-install-plugin` (connector 0.5.0: imports missing symbols from the library files itself) and restarts VW; first real `build_rig` (3D calls and library import tested against the fake only; the first library search reads every file, so it may take minutes). A `Deck Test` layer with the measured test decks is in `Vector Test.vwx`. |
| **Vectorworks** | `/private/vectorworks` · `connectors/vectorworks/` | Built 2026-10-23, branch `claude/vectorworks-panel`. Python connector (MCP server for Claude + `vwmcp-panel` local API) and the live panel page. Tested against a strict fake Vectorworks and in a real browser end to end; **not yet run in a real Vectorworks or on Windows** (the owner doesn't have Vectorworks yet). |
| **Page Turner** | `/private/course` · `connectors/course-runner/` | Built 2026-11-02. Course runs in Chrome on the Windows home server; questions go to the owner's phone, which answers through a live, tappable view. It never answers anything itself (owner was told no, deliberately). Tested end to end locally against a sample course. **Waiting on the owner:** setup in the connector README, `COURSE_URL` + `COURSE_TOKEN` in Vercel. Not yet run on Windows or a real course. |
| **Recordings** | `/private/recordings` | Built 2026-10-30 (`docs/RECORDINGS.md`). Upcoming, library, series, trash and Record a show, live from the home DVR through Tailscale Funnel (key in `DVR_TOKEN`). Tested end to end locally against the real DVR. |
| Money tracker | `/private/money` | Live 2026-10-18 (#54, `docs/MONEY.md`). Chase + U.S. Bank via SimpleFIN, daily sync, categories, recurring. Database answers in production. Waiting on the owner to connect SimpleFIN. |
| CampHawk lab | `/private/camphawk` | Live, behind Private. Mockups only: nothing here changes camphawk.app. (`/lab/camphawk` redirects here.) |
| ↳ **Golden hour (chosen look)** | `/private/camphawk/golden-hour` | Live. The home page in the look the owner picked. Critic 7/10, every finding since fixed. Header badge: the owner's pick "Golden-hour sky" (lab only; camphawk.app keeps its badge). |
| ↳ **Campground page** | `/private/camphawk/golden-hour/campground` | Live. CampHawk's campground page in the same look, with every real state. Now shows whichever campground Explore opened (`?id=`). Critic 7/10, findings fixed. |
| ↳ **Explore** | `/private/camphawk/golden-hour/explore` | Built 2026-10-06. Search rail, four result states in words, illustrated map with pins as buttons, search kept in the URL. |
| ↳ **New watch** | `/private/camphawk/golden-hour/new` | Built 2026-10-06. Picker (favorites, parks as one watch, first come refused), nights, muting, Auto-Cart by plan, the 8am hold. |
| ↳ **Your watches** | `/private/camphawk/golden-hour/watches` | Built 2026-10-06. Wall, first run, every card state, holds, provider and auto-cart trouble, alert history. |
| ↳ **Every other screen** | `/private/camphawk/golden-hour/screens` | Live 2026-10-06 (PR #15 merged, smoke 26/26): Tiers 1-4, about 30 pages, listed by tier with their lab switches. |
| ↳ Trail poster | `/private/camphawk/trail-poster` | Live. The other round-2 direction, kept for reference only. |
| ↳ Round 1 looks | `/private/camphawk/looks` | Live. Six backdrop-only mockups (critic 4/10). Superseded; kept for history. |
| Hosting | Vercel project `tylerflores-dev` (Hobby, $0) | Details in `docs/SETUP.md`. The git hook has missed a `main` deploy once (#79): if production is not BUILDING within a minute of a merge, `create_deployment` with `gitSource` {org TylerFlores1992, repo Tools, ref main, full sha}. |
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

## Morning Mail: sender buttons keep your place (2026-11-06)
- **Owner's report:** pressing Not junk or Always trash jumped the page back to the top.
- **Cause:** `ruleFromSender` redirected to `/private/mail?ruled=…` so a note could show under the
  date, and a redirect is a fresh navigation, which scrolls to the top.
- **Fix:** the action returns its sentence (`src/tools/mail/rule-note.ts`) and refreshes the page in
  place; `MailToaster` / `SenderForm` (`src/tools/mail/ui/SenderToast.tsx`) show it at the bottom,
  as Recordings does. Applies to all five sender buttons.
- **Checked:** in real Chromium against a local Postgres with 45 seeded emails, the on-screen rows
  stayed put on every press (the trashed row leaves, the rest close up). The previous build, same
  check, scrolled to 0 on every press. Tests in `rule-note.test.mts`, 3/3 mutations caught.

## Whole-site audit: every press gives feedback (2026-11-03)
Owner: "A lot of the buttons don't really give feedback… go through the entire website public and
private… The site must work perfect."
- **How it was checked:**
  - four read-only code audits (public; Money/Learn/shell; Mail/Recordings/Page Turner/Vectorworks;
    CampHawk lab);
  - the home server's real Chrome on production (public pages; the Private tab wasn't signed in);
  - local builds with `npm run e2e` (57 checks, 3 new), `npm run shots` (80) and phone/desktop
    shots of every private page;
  - a fresh reviewer over the whole diff.
- **Shared pieces:** `SubmitButton` (spinner, pending words, no double press, `confirm`),
  `Spinner`, `PageLoading`, `AppTabs` (tabs follow the URL, pending dot), `LinkPending`, `press.ts`;
  `loading.tsx` for money, mail, learn, learn/[lesson], recordings; `src/app/error.tsx` and
  `global-error.tsx` ("Try again"). The rule is in the `flores-design` skill → Feedback.
- **Bugs fixed:**
  - **Money:** stub "Use this" could wipe a deposit; the category picker snapped back; Income
    crashed with the DB down; one EDD deposit could be filed twice.
  - **Recordings:** delete toasts and Undo vanished with the row.
  - **Mail:** double-tapped rules doubled, and Unsubscribe ran past 60 s.
  - **Page Turner:** polls piled up when the home server was slow.
  - **Flashcards:** "Again" on the last card repeated it.
  - **Bridle:** URL writes could crash Safari.
  - **CampHawk lab:** "Sign up to watch" did nothing for four visitors, and about 30 dead `#` links.
- **Security edges:** the private password has a per-instance lockout (5 tries / 15 min); the ICS
  link fetch refuses private hosts and checks redirects; stub files are served `nosniff`.
- **Both database backstops are applied (2026-11-03, through the Supabase connector):**
  `stubs_one_benefit_per_deposit` (no duplicates existed) and `rules_one_per_match_idx`. The mail
  index needed the file's `delete` first: 12 extra copies of two identical "trash" rules, double
  taps from 2026-10-22 before the code de-duplicated. The oldest of each was kept, so mail sorts
  the same. Nothing references `mail.rules.id`.
- **Real-data walk in the home-server Chrome (2026-11-03, owner signed in, read only):** all 7
  private pages loaded with no console errors, overlap or sideways scroll. Every tab press showed
  a skeleton in ~3-12 ms and content in 0.45-1.5 s. Recordings is the slowest first load (a few
  seconds of "Asking the DVR at home…", then fills). Page Turner says it isn't connected (expected:
  `COURSE_URL`/`COURSE_TOKEN` not set). Vectorworks says "Not paired with this computer yet".
  One small note, left as is: the tapped pill tab turns dark at ~75-120 ms (when the URL changes),
  so the old tab stays lit that long; the skeleton is the instant feedback.
- **Not done / open:**
  - the Money tabs still scroll sideways on a phone (the current tab stays visible);
  - the lockout is per server instance, not global (a long `LAB_PASSWORD` is the real protection).

## Portfolio polish pass (2026-10-30, PR #95)
Owner: "go page by page… it will be used as a portfolio showcasing my AI skill… make it perfect."
- **How it was checked:** four reviewer agents (home/workshop/404/sign-in, bridle, ETCP, /work),
  the home server's real Chrome through the QA bridge (campsite-finder #447; post a `[qa-request]`
  comment, wait with `scripts/qa-bridge/wait.mjs`), a confirming reviewer, and a second bridge pass
  on the protected preview (Vercel share link via `get_access_to_vercel_url`, 23 h).
- **Done:** one content edge (`src/components/wrap.ts`), footer at the window's foot (flex body),
  designed 404, home "In the workshop" strip (`ToolList`), print styles, `State` `sr` prop; bridle:
  no stale tensions on bad input + accessibility; ETCP: no sideways scroll, real breadcrumb,
  indexes at lg+, keyboard flashcards, counts from data; /work + résumé: phone header, back link,
  status wording, PDF reprinted (still one page). New guards in `npm run shots`: lazy images load,
  broken images and sideways scroll fail (both mutation-tested).
- **Open (owner's call):** the 12 px mono labels read small and pale to a real visitor; they are
  the house style and pass AA. Bumping `--text-label` is one line in `globals.css`.
- **Tooling note:** `npm run resume` needs `CHROMIUM_PATH=/opt/pw-browsers/chromium` in cloud
  containers (the pinned Playwright build isn't installed there).

## Money tracker (live 2026-10-18, #54)
Start at `docs/MONEY.md`. Waiting on the owner: sign up at SimpleFIN Bridge, add Chase and U.S.
Bank, paste the setup token at `/private/money/settings`, set each account's owner. After the
first real sync, review what landed in Uncategorized and add keywords or rules.

## Home hero redesign, "wilderness cyber" (started 2026-10-18)
Owner: the wolf drawing and the woods behind it "are not great"; they want a wilderness cyber
tech feel. **Start at `docs/design/hero-wilderness-cyber.md`.**
- **Agreed so far:**
  - scope: the hero and backgrounds;
  - a still image with subtle CSS motion replaces the film;
  - the "cyber" side is in the art itself.
- **References:** three, described in the doc and not committed. Ask the owner to attach them again.
- **Image sources:**
  - Cloudflare Workers AI, free (FLUX.2 klein 4B and FLUX.1 schnell, both Apache 2.0), for drafts;
  - the last $1.43 of Vercel AI Gateway credit, for finals.
- **Done 2026-10-18 (second session):** token verified (valid, active); directions A "The wired
  wood" and B "Circuit fur" written as contracts (§3); a free drafting script,
  `studio/hero-wilderness/draft.mjs`, logs provenance per image.
- **Drafted:** 16 per direction on Cloudflare (free, ~5,000 neurons), shown beside the
  references. Account ID and how to run it: the doc's "Pick up here".
- **Picked and made:** direction C (A12's setting, B1's realism); finals `wide-ultra-03` and
  `tall-ultra-05` on Flux 1.1 Ultra ($0.60 of credit; $0.825 left). Images are git-ignored in
  `studio/hero-wilderness/out/finals/`, gone with the container: regenerate with `final.mjs` or
  have the owner keep copies.
- **Owner rejected the finals and the blend**, chose the B1 draft, upscaled for free with
  Real-ESRGAN x4.
- **Built 2026-10-18:** `HeroArt.tsx` replaces the film (no client JS); the film's source and skill
  are retired. Shots 8/8 pass, including the measured headline contrast over the image.
- **Next:** the owner signs off the built hero; after merging, `npm run smoke -- https://tylerflores.dev`.

## Bringing the lab to camphawk.app: the hand-off is written (2026-10-11)
Owner: "Write the handoff, but all will go through an orchestrator session to then disperse as
needed." `docs/design/camphawk-handoff.md` is the brief for a campsite-finder session running
`/orchestrate`. It covers:
- the owner's open decisions;
- the lane split;
- work packages P0–P5 (the look) and M0–M3 (the maps);
- the checks;
- the bug list to verify.

Nothing merges to camphawk.app until Apple approves the iPhone build and the owner says ship.
M0, the map export, is the one package that runs in this repo, dispatched by that orchestrator.

## Campground site maps (PR #19 2026-10-07, PR #22 2026-10-08, both merged and live)

**2026-10-11: every held map with a fix public data allows has been through a batch (owner:
"finish everything").**
- **Batches:** the agency-map pilot (20 maps; 1 call changed, so it isn't worth scaling), canopy-16,
  three batches of units against the Forest Service's own points, two lidar batches, fix-18 (splits,
  points, outlines) and oregon-01 (DOGAMI relief).
- **Results:** delegated waves now stand at **2,011 passed and 950 held**. Per batch, and what can't
  be done from public data, see the completion plan's "The held maps no batch had touched".
- **What's left is the owner's decision 5:** the canopy maps no layer shows, published with only
  the visible roads or kept hidden. Plus a few person-only calls named in that section: Turner Lake
  West, Barber Flat, Gut Island, Eagleview and Fourbit Ford.
- **Tool:** `refresh-manifest` in the session scratchpad rebuilds a wave's manifest entries from the
  committed maps. Concurrent builds in one wave overwrite each other's entries, and it fixes that.
  It isn't in the repo, so a later session running parallel builds needs the same step.

**2026-10-09 (later): the fix-after campaign ran (owner: "all of them"; dispersed and the no-photo
Alaska maps stay off; canopy: "find a solution to get done correctly").** All 17 photo batches are
done and checked; the canopy answer is the USGS lidar point clouds (`studio/campground-maps/pointcloud/`,
`docs/design/campground-maps-canopy-brief.md`). Results: the completion plan's "The fix-after
campaign: results". Canopy batches 1–15 and the full-replace batch are recorded (650 canopy maps;
363 pass). Left: 10 canopy maps whose layers failed to download (retry `order-qx.txt` in the
session scratchpad: large surveys need the machine to themselves), and the owner's call on what to
do with the ~280 canopy maps public data can't finish (plan's "Decisions for the owner", number 5).

**2026-10-09: finishing every map (owner: "outline-name check; move the Alaska cabin pins; find a
solution for all of the usable and unusable maps").** The plan, the census of every held map by
cause, and the researched sources are in `docs/design/campground-maps-completion-plan.md`. Start
there.
- **Built:**
  - the outline-name check (first-come maps take only an outline named for them, or an unnamed
    one; it catches Davis Flat and Big Creek);
  - site moves in traces (the tracing tool's "Move a site", `sites` in a trace file);
  - stray points 2 km out left off the map, and BLM parking rows not drawn as sites;
  - lidar relief on the review page, the tracing tool and the renders (`LIDAR=1`), from USGS 3DEP
    or Oregon's DOGAMI.
- **Fixed after the lidar pilot found it:** the relief was drawn up to 26% too tall north–south.
- **Results:** 50 more maps pass.
  - 8 passed under the stray-point and parking rules.
  - 40 of 79 unit maps passed after pin moves.
  - 2 of 25 passed in the lidar pilot.
  - Delegated waves now stand at 1,577 passed and 1,384 held.
- **What the pilot means:** lidar helps about 1 in 4 canopy maps and won't finish them. The owner
  decisions are listed in the plan's "Decisions for the owner", and number 5 (publish canopy maps
  with only the visible roads, or keep them hidden) decides most of what's left.
- **Next, if the owner agrees:** Forest Service cabin points for the 39 unit maps still held;
  lidar tracing by demand; photo traces (~320).

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
  reach, 2 are closed). **First look and final check done: 86 pass, 44 held.** Open idea: check
  an outline's OpenStreetMap name against the listing's name (one ring serving two listings).
  `docs/design/campground-maps-first-come.md` has the list.

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

## Vectorworks (2026-10-23)
- **What:** Claude draws, measures and edits in Vectorworks through `connectors/vectorworks/`
  (52 MCP tools, batch + undo journal, lengths like `12'-6"`); the page at `/private/vectorworks`
  shows the open drawing live from the owner's own computer (select, drag snapped, nudge, measure,
  fixture fields, undo), pairing via the link `vwmcp-panel` prints. The site never sees the drawing.
- **Why it's shaped this way:** connector README, "Why it's built this way" (VW 2026 = Python 3.9;
  a wrong `vs` call opens a blocking Script Errors dialog, so every call is checked against the
  official signatures in `vw_plugin/vs_signatures.json`; hotkey trigger waits for the person to
  pause; own undo journal because Ctrl+Z merges scripted runs).
- **Show workflow (head rigger), same day:** files come as one file or separate referenced ones;
  the connector surveys what arrived (`survey_drawing`: viewports, referenced files, plug-in
  types), sets a CL×PL datum, sorts layers/classes into departments (panel toggles + "Same in
  Vectorworks"), stores venue limits per drawing (`~/.vwmcp/shows/`), and works out every point
  (`report.py`: load source, point load with hoist + chain, dynamic ×1.2, hoist %, dead hang or
  bridle between opposite beams, checks worst-first, beam/roof totals, mark-out, CSV, revisions
  with "since"). Panel tabs: Drawing / Rigging / Show setup. Referenced objects are read-only
  (no script API for referenced files). 3+ picks per truss are a continuous-beam estimate, said
  on every such point.
- **Waiting on the owner:** buy/trial Vectorworks 2026 with Spotlight, then the README's "First run
  on real Vectorworks" checklist (items 6-7 cover rigging: plug-in names in `RIGGING_KINDS`, hook
  heights relative vs absolute, viewport sources, Braceworks field names, DWG import codes).
  Expect small fixes in `vwmcp_bridge.py`.
- **Later:** a see-through overlay on the Vectorworks window (needs screen↔drawing mapping), LAN
  access for the phone (would need the panel served by the connector itself: an https page can't
  call a LAN http address).
- **Checks:** `npm run e2e` has 12 `vectorworks` checks against a Node stand-in for the panel API
  (`scripts/vectorworks-mock.mts`); the show checks serve real connector answers recorded in
  `scripts/vectorworks-show.fixture.json`. Re-record after changing the report's shape: run
  `python dev/fake_vectorworks.py --show` and `VWMCP_TRIGGER=none vwmcp-panel`, POST a datum
  (0,0, up) and limits (point 1500, total 60000) to `/api/setup`, then save `/api/survey`,
  `/api/drawing`, `/api/rigging`, `/api/rigging.csv` under the keys survey/drawing/rigging/csv.
  CI job `connector` runs the Python tests (145).
- **Rebuild the download** after changing the connector: `python connectors/vectorworks/make_zip.py`
  (`connector.test.mts` fails if the page's version and the connector's disagree).

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
- No network to Google Fonts in some containers: `next build` fails on the CampHawk lab's Bitter
  / Nunito Sans. For a local check only: `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=<mock.js> next build
  --webpack` with a mock that serves `src/fonts/MonaSans-Variable.woff2` (Turbopack won't take a
  catch-all mock). Never commit that.
- `pkill -f` matches its own shell whenever the pattern's text is anywhere in your command, even
  in a heredoc you're writing. Put restarts in a script file and run the file.
- 2026-10-23: two `lab site-map` e2e checks (waves; a site picked up and moved) fail here on
  untouched `main` too; likely the git-ignored local State Parks data. Not from the Vectorworks work.
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
