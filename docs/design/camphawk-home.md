# CampHawk home: round 2 directions

> **Status (2026-10-06):** five screens are built in it (home, campground, Explore, New watch, Your watches). The owner picked **Direction A "Golden hour"**
> (`/private/camphawk/golden-hour`). Direction B is kept for reference only. These are lab
> mockups; camphawk.app is never changed from here. What's left: `docs/NEXT-SESSION.md`.

Surface: CampHawk marketing home (`/private/camphawk`, lab). Mode: **Persuade**.
Process: skill `design-direction`. Round 1 lessons and the critic's 4/10 are in its `tells.md`.

## Brief (confirmed with the owner, 2026-10-05)
- **Audience:** US campers trying to get a site at a full campground, usually on a phone, often
  planning in the evening.
- **Job:** get them to search (free), or to start a watch when it's full.
- **Fixed:** functionality: search, watch, the three pricing views, the limits, the footer links.
  Same words where possible. CampHawk's palette.
- **Free:** layout, type scale, composition, imagery, rhythm.

## References (owner's Pinterest picks)
| # | What | Specifics that set the bar |
|---|---|---|
| 1 | Zenze agri landing (dark) | Full-bleed golden-hour photo; two-line headline ~2.6× body; a live-data glass panel on the hero (product as proof); stats strip; a real dashboard section; photo CTA band |
| 2 | Eco real estate (light) | Sunlit forest photo in a large rounded frame; **search bar docked across the hero's bottom edge**; photo cards below on soft paper |
| 3 | Corporate portfolio sheet (dark green + tan) | Deep green grounds, tan pill buttons, botanical photography, big confident sans |
| 4 | Artisan (illustrated) | Vintage travel-poster painting full-bleed; limited muted palette; illustrated vignettes instead of icons |
| 5 | Rennale (tactile) | Leaf and material photography, green and brown, soft tactile depth |

Common thread: real or painted imagery in warm low light, deep greens with warm accents,
headlines that own the screen, and UI that sits *on* the picture. All five are themselves
AI comps (the text is garbled), so they set the art direction and craft level, not literal UX.

## Direction A: "Golden hour"
- **Thesis:** the moment a site opens, at the time of day people dream about camping. The product
  proof (a live alert) sits on the photo itself. It refuses the category default of a headline
  over a generic mountain stock photo with feature cards below.
- **World:** committed color. `ch-forest` owns 40–50% of the page (hero and proof sections);
  `ch-ochre` is the light (one accent per screen); `ch-paper` grounds the reading sections;
  `ch-green` is reserved for actions. Bitter display at 72–88px desktop and 40–44px phone (−0.03em);
  Nunito Sans body at 17px.
- **First viewport (1440):**
  ```
  ┌──────────────────────────────────────────────────────────────┐
  │ CampHawk            Watches  New watch  Explore     Sign in  │  ← transparent nav on photo
  │                                                              │
  │  The campsite you wanted          [photo: lantern-lit tent, │
  │  is already booked.                pines, valley at golden  │
  │  We wait for it.                   hour, right 60%]         │
  │  (88px Bitter, paper)                                        │
  │  CampHawk watches booked…  (17px, 56ch)    ┌─────────────┐   │
  │                                            │ ● Site 042  │   │ ← live alert card
  │                                            │ Upper Pines │   │   (illustrative, labeled)
  │                                            │ opened 14s  │   │
  │                                            └─────────────┘   │
  │ ┌──────────────────────────────────────────────────────────┐ │
  │ │ Where?  [Yosemite]  When? [any 3 nights in Jul] [Search] │ │ ← search docked on the edge
  │ └──────────────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────────────┘
  ```
- **Below:** a forest-colored "watch it work" section, with a phone showing the alert, then
  the cart, built in code as real UI, beside the three steps. Then pricing on paper, with one
  elevation system and no card inside a card. Then the limits as a quiet list. The closing
  CTA is a photo band.
- **Signature moment:** the alert card slides in once on load (reduced motion: already there).
- **Assets:** A1 hero (landscape), A2 hero (portrait), A3 site-post detail, A4 morning CTA band.

## Direction B: "Trail poster"
- **Thesis:** CampHawk as a beloved park poster. Warm, crafted, collectible. It extends the
  painted hawk CampHawk already owns (the phone header art) into a whole world. It refuses flat
  vector stock and code-drawn scenes.
- **World:** full palette in a printed register: `ch-paper` ground, `ch-forest` ink, `ch-ochre`
  sun, `ch-blue` water, `ch-green` actions. Bitter Black display at 80–96px and 44px phone, set
  into the painting's sky. Nunito Sans body.
- **First viewport (1440):**
  ```
  ┌──────────────────────────────────────────────────────────────┐
  │ [painted poster, full-bleed: hawk over a granite valley,     │
  │  river, framing pines, small glowing tent, big calm sky]     │
  │                                                              │
  │   The campsite you wanted                                    │
  │   is already booked. We wait for it.  (96px, forest ink)     │
  │                                                              │
  │   [Search campgrounds free]  See what a watch does           │
  │ ─────────────────────── torn-paper edge ──────────────────── │
  │  CampHawk watches booked campgrounds…  (on paper, 17px)      │
  └──────────────────────────────────────────────────────────────┘
  ```
- **Below:** the four features as painted spot vignettes (pocket watch, cart and pack, trail
  map, calendar) in place of icon cards; a two-column "how it works" with numbered steps (it
  is a real sequence); pricing like a park pass (ticket-stub plans); and a quiet footer.
- **Signature moment:** the poster's hawk drifts a few pixels with scroll (reduced motion: still).
- **Assets:** B1 poster (landscape), B2 poster (portrait), B3–B6 spot vignettes (square).

## As built (2026-10-05)
Pages: `/private/camphawk/golden-hour` (A) and `/private/camphawk/trail-poster` (B), code in
`src/lab/camphawk/round2/`. Both keep every function: search, watch, the three pricing views
(View as), the limits and the footer links.

Changes from the contracts above, and why:
- **A's light is dusk, not golden hour.** The model gave blue hour with a lantern-lit tent; the tent
  is the one warm accent. One photo (A1) serves every breakpoint, so there is one tent. Below
  1024px the search sits right under the intro and the tent shows in a window below it; on
  desktop the alert sits on the photo and search docks across its edge.
- **CampHawk's own design rules bind** (`campsite-finder/.claude/skills/camphawk-design`): green
  only for an open site or an action, blue for the Recreation.gov hand-off, ochre only for "you
  asked for this", every status in words (its `Tag` and `Card`, ported to `src/lab/camphawk/ui/`),
  "Open for Jul 18-21" dates, one shadow system (`shadow-ch-pop`), and **no glass**: the
  references' glass panel is out because the skill says it "reads as a different product". The
  caps status tags are CampHawk's primitive, so they stay.
- **"What a watch does"** shows each promise as a small piece of CampHawk's UI (a check log, the
  held cart, a results list, a date window), labeled "Examples, not live data."
- **B's first viewport is a hung print, not a full-bleed poster.** The poster's sky could not hold
  the headline and the actions. The headline and a real search field sit on paper; the tall poster
  hangs beside them with an example alert pinned to it like a ticket stub (the product proof).
  The wide poster closes the page as a second print. The phone header is plain paper, so the page
  doesn't show two hawks in two styles.
- **Pricing** in both is `round2/Pricing2.tsx`: same branches, prices and words, without caps
  chips or the mid-dot, and at reading sizes.
- **Signature motion:** A's alert card rises once; B's print settles and the ticket pins on.
  Reduced motion shows both at rest.

## Screen 2: Campground, in the Golden hour look (2026-10-06)
Route: `/private/camphawk/golden-hour/campground` (lab). Port of campsite-finder
`src/app/(app)/campground/[id]` (`CampgroundDetail`, `AvailabilityGrid`, `WatchCta`,
`CampgroundOpenings`), read-only. Mode: **Operate** (clarity first; the brand lives in the frame).
- **Thesis:** the page answers one question before anything else: *is anything open, and if not,
  can CampHawk watch it?* It refuses the travel-site default of a big gallery first and the
  calendar below the fold.
- **Same world as the home page:** the forest band carries the header and the campground's name;
  the photo strip docks across the band's bottom edge, the way search does on the home page.
  Paper below. Green only for open days and the watch action; booked days neutral and struck
  through; days we couldn't read carry no mark (never "booked"). Every state has a word.
- **First viewport (1440):**
  ```
  ┌──────────────────────────────────────────────────────────────┐
  │ CampHawk   Watches  New watch  Explore             Sign in   │  forest band
  │ ‹ Back to search                                             │
  │ [AUTO-CART] [Recreation.gov]                                 │
  │ Upper Pines            (Bitter 56, paper)  [Sign up to watch]│
  │ Yosemite Valley, CA                                          │
  │ ┌───────────────────┬────────┬────────┬────────┐             │
  │ │ photo (wide)      │ photo  │ photo  │ photo  │  ← docked   │
  └─┴───────────────────┴────────┴────────┴────────┴─────────────┘
    July 2026 calendar (open: dot + word) │ Sat, Jul 18: 1 site open
  ```
- **Fidelity:** CampHawk's words, states and gates: the watch button's three visitor states
  (from the lab's "View as"), open / booked / not open for booking / couldn't check / past days,
  "Pick a day", first-come campgrounds get a policy panel instead of an empty calendar.
- **Assets:** four dusk photos of a valley campground (generated; labeled as example data).
- **As built:** the answer sits under the name in words ("5 days with openings in July. The next
  is Thursday, July 9."); phones show one photo so the calendar comes sooner; the day panel ends
  with the same gated watch button. Example months demonstrate every CampHawk calendar state: July
  and August (open, booked, past), September (couldn't check), October (not open for booking) and
  November (a failed read, said as an alert). A lab switch shows a first-come campground. The
  photos stay dusk on purpose: the whole Golden hour look is blue hour with warm lamplight (hero,
  feature, closing band), not literal golden hour.

## Screens 3-5: Explore, New watch, Your watches, in the Golden hour look (2026-10-06)
Routes (lab): `/private/camphawk/golden-hour/explore`, `/new`, `/watches`. Ports of campsite-finder
`src/app/(app)/search|new|watches` (`Explore`, `ResultCard`, `ResultsMap`, `NewWatch`,
`TrustPanel`, `SiteMuteList`, `WatchesList`, `WatchCard`, `HoldRow`, `SetupNudges`,
`NewWatchOutlook`, `WatchCta`, `SubscribeCta`, `PricingLink`), read-only, with example data.
Mode: **Operate**. The brand lives in the frame; the work area is CampHawk's own UI at reading sizes.
- **One frame for every app screen:** the forest band holds the header (its tabs now link the
  screens, marked current) and the screen's title; the first card docks up across the band's
  edge by `--gh-dock`, the way search does on the home page; paper below; the forest footer.
  Each band carries a photo with one warm light: Explore the valley and its campsite lights,
  New watch an empty campsite under Half Dome, Your watches a fire lookout keeping watch (the
  last two added at the owner's request after the first review; they started plain).
- **Shared controls** are CampHawk's, ported to `src/lab/camphawk/ui/`: `DatePicker` (two ISO
  dates, a roving-tab grid, cross-month strip), `NightsPicker`, `FilterPanel`, `RadioChips`,
  `Chip`, `Collapsible`, `date.ts`. Labels are sentence case at 13px, not CampHawk's 11px caps.
- **Lab switches live in the URL** (`round2/labState.ts`): `?as=` (View as, now with **Lapsed**
  for "Resubscribe"), `plan`, and each screen's states, so any state can be linked and the
  visitor survives moving between screens. The account gates are one module (`round2/gates.ts`).

**Explore.** The rail (where, within, when, filters, search) docks into the band; results start
on paper beside it. Guests see the status box (context, not a paywall); a subscriber never does.
Results answer in four words: *Sites open*, *Booked — watch it*, *Couldn't check*, *First come,
first served*; with no dates nothing is claimed. The map is an illustration (`e2`, softened toward
paper) with real buttons for pins; each pin's state is a shape as well as a hue (solid, hollow,
small, ringed when picked) and picking one hoists its card. The search is written to the URL, the
cards carry it, and "Back to search" on the campground page restores it. The campground page now
reads `?id=`, so every result opens its own campground (Lower Pines reads "couldn't check" all
the way through; Camp 4 opens as first come).

**New watch.** The form and the "What we'll do" panel sit side by side (the panel stacks below on
phones and sticks on desktop). It explains a watch until a campground is chosen, then reads back
exactly what will be created. Parks are one watch with their bookable parts ticked; walk-up parts
never show; a first-come campground can't be picked and says why. Recreation.gov gets the Auto-cart
switch (with its word, On/Off) and the trust panel on the Auto-Cart plan, or the plain upsell on
Alerts; ReserveCalifornia gets the 8am hold note. Only a subscriber sees "Start watching"; it lands
on Your watches with the new watch at the top. Lab change: a muted site is neutral (a word and a
crossed bell), not CampHawk's red button, because red means "you must act".

**Your watches.** Signed out: the account wall beside the dusk phone photo (`a3`). Signed in
without a plan: the first run, whose button says the step that's open to them. Subscriber: the
running count with New watch, then cards in two columns that don't share a row height (one list in
the DOM). The example watches show a site open and in your cart, tomorrow's 8am holds (queued and
offered, collapsed in their card), a running watch with muted sites, and a paused one; the lab
switches add ReserveCalifornia not responding, auto-cart reconnecting or signed out (dashed red
card, and no cart claim), and the missing-phone nudge. A brand-new watch on a stay that's booked
more than two weeks out gets CampHawk's "expect it to be quiet" note.

**Found in CampHawk while porting (not changed there; read-only):**
- `src/components/ui/date.ts` `thisWeekendRange()` reads the weekday from `new Date(today)`, which
  parses as UTC midnight: in every US timezone "This weekend" becomes Saturday to Monday. The lab's
  `date.ts` has the fix and a test that runs in Los Angeles time.
- Explore types a place and presses Search without picking a suggestion: it searches near the
  device but titles the results "within 10 mi of <typed text>". The lab says it couldn't find the
  place instead.
- Explore shows `Search failed (502)` on a failed search (an HTTP code, against its own copy rule).
- New watch's ReserveCalifornia note spells "cancelled" (US: "canceled").

## Every other screen: Tiers 1-4, in the Golden hour look (2026-10-06)
All of CampHawk's user-facing pages now have a lab version (`/private/camphawk/golden-hour/screens`
lists them by tier, with their switches). Out of scope: `admin/` (internal) and `b/[token]` (a
redirect). Specs were written from campsite-finder (read-only); the words are CampHawk's except
where a lab change is noted in the page file's header comment.

**Two frames.** App and content pages use `LabPage` (`round2/LabPage.tsx`): the forest band with
the header, title and a photo, paper below, the forest footer, plus a reading kit (prose, steps,
callouts, questions, a closing band). Screens that must not invite you away (the one-tap page,
Claim, Connect, Sign in/up) use `BareFrame`: forest top with the badge, one card, no tabs or footer.

- **Tier 1, the alert loop:** Manage watch, the one-tap page (`/w`, 20 results, including the 8am
  hold offer and its confirmations), Claim a held site (9 statuses × 3 devices), Settings (every
  visitor, plan, biller and auto-cart state), Connect Recreation.gov, Welcome.
- **Tier 2, getting and keeping customers:** Pricing (every visitor, a failed lookup, a failed
  checkout, the app's store paywall), Sign in and Sign up (a stand-in for Clerk's widget, with
  Clerk's words), the Auto-cart explainer, the cancellation-alerts landing, the sold-out guide.
- **Tier 3, search pages:** Camping by state, the state pages (47 states and 9 provinces; under 5
  campgrounds is a real 404), the cabin, group and yurt hubs and their state pages, Hardest to
  book, CampHawk vs Campflare and vs Campnab (no comparison table, by CampHawk's own rule).
- **Tier 4, utility and legal:** Support, Data sources, SMS opt-in, Privacy, Terms, and the
  not-found and error screens.

**Real vs illustrative.** Prices, limits, the openings figure, the data-source list, which states
and provinces have pages, California's 875, the province counts, the yurt states, the cabin total
and the hardest-to-book parks come from CampHawk's code. Other states' counts, the cabin and group
splits by state, and every campground list are illustrative, and the pages say so.

**Lab changes, applied across the tiers (CampHawk's own rules, applied to its own pages):**
- Colour: muted is neutral, never red; every provider hand-off (Book, Hold it, Connect, Set up
  auto-cart, Stripe checkout) is blue; a queued hold is ochre; headings, links, step numbers and
  ticks are ink or forest, never decorative green; copy never names a button by its colour.
- Truth: Alerts-plan subscribers aren't told auto-cart is on; sign-out only promises texts with a
  number saved; the ReserveCalifornia hold says it's closed to new holds (since Sep 22, 2026)
  wherever CampHawk still offers it; Connect's "Done" says the sign-in worked, not "auto-cart is
  active", and goes to Settings, not the marketing page; no price inside the app anywhere.
- Words: one release-time format ("8 AM", "Tue, Jul 7 at 8 AM PT"); site names, never provider
  ids; sentences, never HTTP codes; "canceled"; counts derived from data so the pages agree.
- Flow: a plan picked on Pricing survives sign-up and Welcome and comes back; Welcome follows
  `?next=` (lab paths only); "Skip for now" skips instead of saving email-off.
- Access: the Claim password field has its own label (its "Show" button had joined the name);
  every screen has one H1; the search-page counts say what they count.

**Critic pass (2026-10-06):** 7/10 overall (Tier 1 6.5, Tier 2 7, Tier 3 7.5). Fixed: the closed-hold
notice is neutral, not ochre; Pricing's hold card keeps one text width and tucks its steps behind
"How it works when it reopens"; repeated copy trimmed on Connect and Welcome; Manage says why a
site is queued, "1 sent" not a bare number, and stacks Remove on phones; en dashes in date ranges;
"/sources" reads "data sources page"; the hub's "13 state park systems" is derived. Two findings
were already fixed when it looked (the colour-named button, the lab-select overflow). Kept, on
purpose: green for trial and sign-up (the lab-wide choice since the home page), blue for "Hold
it" and the auto-cart On tag (CampHawk's provider kind), the title-case hub names (the search
query), the pre-ticked "save my login" box (CampHawk requires it), and CampHawk's own CTA words.

**Found in CampHawk while porting (not changed there; read-only):**
- The ReserveCalifornia hold beta closed on 2026-09-22 (`RC_HOLD_BETA_OPEN = false`), but
  Pricing, Auto-cart, both guides and both comparison pages still offer it.
- Settings tells Alerts-plan subscribers "Watching, alerts and auto-cart are all switched on".
- Connect's "Done" goes to `/` (prices, inside the app); its "still working" note only renders in
  the live-window mode, so form users never see it; errors show `mint failed (500)` and "Is your
  CampHawk server online?".
- `/w` mute shows the provider's site id; three formats for one release time.
- Claim's app copy still says "tap the cart icon", which its own button replaced.
- Sign in and Sign up have no title of their own and aren't noindex; Pricing's signed-out trial
  links drop the chosen plan.
- `/vs/*` shows prices inside the app; the site-type hub titles count provinces as states; the
  pages give the number of state systems as ten, twelve and fourteen in different places.
- "cancelled" in Settings (delete), the guides, the state-page descriptions and the competitor lines.

## Fix rounds: toward a 10 (2026-10-06)
The owner asked for "as close to a 10 as possible", with our own status marks. Five rounds of fresh
critic, accessibility audit, fix and re-test. Critic scores: 6.5 → 7.2 → 7.5 → 8.0 → 8.0 (each round a new reviewer who hadn't seen the last; round 5's findings are fixed and not yet re-scored).
This section overrides older notes above where they disagree (for example, trial and sign-up are
no longer green).

**Status marks (`ui/Tag.tsx`).** Every status tag carries a shape as well as a word and a colour,
for the owner's red-green colour blindness: drawn marks that match Explore's map pins (tick = open,
solid dot = booked, ring = couldn't check, small dot = first come) and one line icon per other
status (eye = watching, clock = queued or time left, plus-circle = offered, cart, bolt = auto-cart,
pause, refresh = reconnecting, triangle = needs you, cloud-off = provider down, power on/off,
dashed circle = not set up). `StatusMark` draws one outside a tag. An e2e check fails if a Watches
tag loses its mark. Selected chips carry a tick; the date picker's selected days are ink.

**Button colours.** Green only for getting a site (search, Hold it, Start watching, "Yes — hold it
for me", "It's mine — hand it over"); blue for a booking-provider hand-off (Book, Recreation.gov checkout, auto-cart,
ReserveCalifornia sign-in); **ink** (forest) for account steps (trial, sign up, sign in, save,
finish, upgrade, Stripe checkout); **paper** for the same on a forest band. e2e fails if a trial button turns green.

**One vocabulary.**
- Search: "Search campgrounds" (the home hero adds "free"). It replaced six other names.
- The ReserveCalifornia feature: "8 AM hold", invite-only since Sep 22, 2026.
  - Its stages are "Holds you asked for" (ochre, "Asked") and "Sites you can hold at 8 AM" ("Can hold").
  - Its buttons are "Hold it for me" and "It's mine — hand it over".
- "Auto-Cart" is the plan and "auto-cart" is the feature.
- Canada: "12 of Canada's 13 provinces and territories" everywhere, from `CANADA_REGIONS` in `data.ts`. An e2e check guards it, and was mutation-tested.

**Layout.**
- Every page uses one container: the band's width and gutter.
- Wide screens get an "On this page" rail on Settings, the guides and the vs pages.
  - The rail comes first in the DOM, so it is read first, and is shown on the right.
- Manage, Welcome and Pricing are two columns on wide screens.
- Bare pages use a 20px gutter. Sign in and sign up center the badge, with their context line on the forest band.

**Behaviour (audit rounds).**
- Explore's Where field is an ARIA combobox.
- Focus moves to the safe choice when a confirm opens, and back to the trigger when it closes.
- Radio groups take the arrow keys plus Home and End.
- Buttons stay live and say what's missing, then focus that field; a dead button reads as broken.
- The date picker can't go before today's month.

**Open from round 5 (not done):**
- New watch and Explore look thin at 1440. Ideas: a slot count, an Add-to-cart toggle and results preview.
- The California page lists about 40 of its 875 campgrounds with no "show all".
- One "Site 042" is used for two different holds in the sample data.
- The lab's "today" (Jul 6) sits before the dated stats it quotes.
- Settings shows email, texts and the plan as plain text where auto-cart has a pill.
- The Google "G" is a placeholder.

**Kept on purpose.**
- `/w`, claim, connect and sign-in/up are bare (CampHawk's decision).
- Title-case hub names (they are the search query). SMS and legal wording (carrier copy).
- Blue Book on the campground page (it hands off).
- The SMS page's grey preview button.
- "Back to watches" under the title on Manage.

**Found in CampHawk on these rounds (not changed there):**
- Welcome has an email checkbox that Settings ignores (email is always on).
- The campground day panel lists open sites with no Book button.
- The hold beta is still offered.
- Coverage is given as "12 of 13" provinces, as "9 provinces" and as "7 provincial systems" on different pages.
- Search has seven button names.

## Fix rounds 6–12: toward a 9 (2026-10-07)
The owner's bar: "above a 9". Each round: two fresh critics (same prompt, never the builder), axe-core
4.14 (WCAG 2.2 AA plus best practice, 390 and 1440, collapsibles open and shut), fix, verify, e2e.
Averages: r7 8.35 · r8 8.25 · r9 8.6 · r10 8.55 · r11 8.65 · r12 8.6 (A 8.6, B 8.6) · r13 8.6 (A 8.6, B 8.6) · r14 8.6 (A 8.6, B 8.6) · r15, after the rework, 8.65 (A 8.7, B 8.6) · r16 8.65 (A 8.7, B 8.6). axe: 0 violations on all 32 routes.

**Typography (guarded by `src/lab/camphawk/typography.test.mts`, mutation-tested).** Curly
apostrophes only (never `&apos;` or a straight `'` between letters); "8 AM" and other times keep a
non-breaking space; "7‑day" keeps a non-breaking hyphen (U+2011). US spelling now also catches
"tick the box".

**One beta note.** `BetaNote` (`round2/BareFrame.tsx`): an (i) and `HOLD_BETA_NOTE`, plus an
optional line. Used on New watch, the offer page, Pricing, the auto-cart guide and vs. New marks:
`hold` (alarm clock: an 8 AM hold) and `active` (circle check: subscription Active).

**Guards found broken (round 12).** The typography and US-spelling scans stripped `/* … */`
before `//`, so a line comment holding a `/**` glob opened a "block" that hid ~100 lines of
Camping.tsx from both. Now one left-to-right pass; both re-mutation-tested in the hidden region.
Signed-out tabs (Explore · New watch · Pricing) and Pricing in the footer have an e2e guard.

**Shared words.** `LAUNCH_PRICING` and `HOLD_BETA_LABEL` in `tier2-data.ts`. "Run up to 6 watches
at once" everywhere (a watch is a campground and dates, so "6 campgrounds" was wrong). Times as en
dash ranges ("Jul 18–21").

**Shape changes.** Settings-style rows (icon, sans title, state pill, one line) on Settings and
Welcome (Email, Push, Text). One primary button per plan card, the badge on the card's top edge,
terms as one block under the plans. Auto-cart guide steps as numbered cards. Towns and Hardest to
book as cards and a ranked list. Watches: holds you asked for first; cart tag names the site.

**Photos.** k1 (Half Dome at dusk, Hardest to book) and t1 (lit tent, Welcome) are re-crops of
earlier outputs (no spend). r1 (California) and g1 (auto-cart) were tried and removed: the title
fell to 1.8:1 and 2.99:1 over bright sky, and `object-position` can't move a full-width image.

## Option 1: the catalog and setup templates, reworked (2026-10-07)
Six rounds of small fixes held at 8.55–8.65: each fresh pair of critics found a new set of nits,
and some contradicted the last (counts on cards, the Auto-cart chip). The owner chose a rework of
the weakest templates over more rounds or paid photos.
- **Numbers in the band.** `LabPage`/`AppBand` take `facts`: two or three numbers from the data
  beside a plain band's title (under it on phones, hairlines between). California: 875 tracked,
  300 towns, 2 booking systems; the hub, site-type and site-type-state pages likewise.
- **`CatalogLayout`** (`round2/pages/Camping.tsx`): lead and list in one column, a sticky card
  beside it: search, then "Narrow it down" links (site types, related guides). It replaced the
  lead + link line + button stack and the two promo cards. On phones the card follows the list,
  and drops its search button where the page already ends with one.
- **Always booked** uses the same frame; its card holds the counts (28 campgrounds, 18 parks and
  seashores), the "our own pick, not a ranking" note, search and next reads. No percentages on
  this page (an e2e guard).
- **Welcome**: plain band (t1, the tent, was soft at desktop and is now unused), the setup column
  capped at 700px, and beside it the alert you're setting up (`AlertCard`, shared with home) and
  what happens next.
- California's site-type sample now takes 2, 3 or 1 campgrounds a town in turn.

## Self-check (tells.md § Defaults)
- **A** avoids the cream/terracotta and neon-on-black looks, uses one accent, and puts no
  accent word in the headline. Risk: the dark-hero category default. It is mitigated by the
  photo's specific moment and the live UI on the photo.
- **B** avoids code-drawn scenes; the art is painted by a model or a person. Risk: retro-poster
  pastiche. It is mitigated by CampHawk's own hawk and palette and by real UI below the fold.
- Both drop the eyebrow labels, the all-caps chips, the mid-dot meta and the identical icon-card grid.

## Assets log
Generated 2026-10-05 and 2026-10-06 through Vercel AI Gateway on free credit (about $2.96 of $5 used by the end of 2026-10-06, $2.045 left; nothing bought; `generate.mjs` stops under $2, so no more images without new credit).
Script, prompts and picks: `studio/camphawk-round2/` (`generate.mjs`, `prompts.mjs`, `export.mjs`).
Photos: `bfl/flux-pro-1.1-ultra` (raw mode). Paintings: `recraft/recraft-v4.1` (1280px max on free
credit, so posters are 2x Lanczos upscales; GPT Image and the Recraft pro tiers are closed to free credit).

| File | Direction | Source | Pick and notes |
|---|---|---|---|
| a1-hero-wide | A | Flux 1.1 Ultra | Blue-hour more than golden hour; tent right, misty ridges left. Needs a left scrim for text. |
| a2-hero-tall | A | Flux 1.1 Ultra | Retired 2026-10-06: a different tent from A1. A1 now serves every size. |
| a3-phone-dusk | A | Flux 1.1 Ultra | A phone glowing on a picnic table at dusk, lantern, no tent (2026-10-06; replaced a tent shot so the page has one tent). |
| a4-cta-dusk | A | Flux 1.1 Ultra | Lake at dusk, mug on warm-lit granite lower left. Replaced the daylight morning shot so the page has one light. |
| b1-poster-wide | B | Recraft v4.1 | Hawk upper right, glowing tent by the river, sky upper left. |
| b2-poster-tall | B | Recraft v4.1 | Hawk in a calm sky, canyon and river, tent at the foot. |
| b3–b6 vignettes | B | Recraft v4.1 | Watch, pack, map, calendar on cream. Pack is the strongest; watch is scratchier. |
| e1-explore-wide | A | Flux 1.1 Ultra | Explore's band (2026-10-06): a valley at blue hour, campsite lights along the river. The first try read as a city; the second asked for about ten lone lights. Cinema bars cropped by `export.mjs`. |
| e2-map | A | Recraft v4.1 | Explore's illustrated map: forest, a pale valley, a river and a lake, no labels. Softened 45% toward paper so pins read. |
| c2-site-dusk | A | Flux 1.1 Ultra | Re-exported with a shadow lift (curve 0.78): it read as a black square at card size. |
| n1-newwatch-wide | A | Flux 1.1 Ultra | New watch's band (owner's call, 2026-10-06): an empty campsite under Half Dome at blue hour, a lantern on the table. First try. |
| w1-watches-wide | A | Flux 1.1 Ultra | Your watches' band: a fire lookout on a ridge, its window lit, over a misty valley. First try. |
| badge-golden | A | Flux Kontext | The owner's pick: CampHawk's own badge with a warm sky, cut from its white field. Lab only. |
| m1-coast-wide | A | Flux 1.1 Ultra | Manage's band (fix round): coastal campground at dusk, tents under cypress. About $0.06. |
| p1-pricing-wide | A | Flux 1.1 Ultra | Pricing's band: two lit bell tents under pines. About $0.06. |
| v1-fork-wide | A | Flux 1.1 Ultra | The vs pages' band: a trail fork at blue hour. About $0.06. |
| k1-halfdome-wide, t1-tent-wide | A | Flux 1.1 Ultra | Re-crops of c4-cliff-dusk-2 and a3-site-dusk-1 (2026-10-07); no new spend. |
| s1-ranger-wide | A | Flux 1.1 Ultra | Support's band: a ranger cabin at a meadow edge, porch light on. About $0.06. Exported inline with sharp (`export.mjs` stops on the a1 original, which is no longer in `out/`). |
