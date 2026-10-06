# CampHawk home: round 2 directions

> **Status (2026-10-05):** the owner picked **Direction A "Golden hour"**
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

## Self-check (tells.md § Defaults)
- **A** avoids the cream/terracotta and neon-on-black looks, uses one accent, and puts no
  accent word in the headline. Risk: the dark-hero category default. It is mitigated by the
  photo's specific moment and the live UI on the photo.
- **B** avoids code-drawn scenes; the art is painted by a model or a person. Risk: retro-poster
  pastiche. It is mitigated by CampHawk's own hawk and palette and by real UI below the fold.
- Both drop the eyebrow labels, the all-caps chips, the mid-dot meta and the identical icon-card grid.

## Assets log
Generated 2026-10-05 through Vercel AI Gateway on free credit ($1.26 of $5; nothing bought).
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
