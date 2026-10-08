# First-come campgrounds booked as one "Standard" site: the design contract

*2026-10-08. Lab only. Comps: `/private/camphawk/golden-hour/admin/site-maps/layouts`, third section
(`?fc=glance|steps&f=<id>`). Component: `src/lab/camphawk/round2/FirstCome.tsx`; the pure parts
(`isFirstCome`, the outline, the frame, the restrooms) in `src/lab/camphawk/round2/maps/first-come.ts`
(tested in `first-come.test.mts`); the facts from RIDB: `studio/campground-maps/first-come.mjs`
(tested in `scripts/campground-maps-first-come.test.mts`).*

## What these listings are (measured on RIDB, 2026-10-07 export)
- **130 of the rollout's listings have one site, named "Standard"**: 16 in wave 35, 49 in wave 36,
  50 in wave 32, and the rest across waves 31, 34, 38 and 39. They were built as single units and
  held, because the point is never on a pad.
- They are **first-come campgrounds, not units**:
  - all 130 sit in a loop named "Scan and Pay", beside management rows ("ScanPay 2–4") at 0,0;
  - 125 descriptions say first-come, first-served;
  - 124 mention Scan and Pay: you take a site and pay on the spot in the Recreation.gov app.
- **The point is a placeholder near the campground.** Where OpenStreetMap outlines the campground
  (88 of 130), the point is inside it for 39, within 50 m for 32, 50–200 m for 12, and 200–800 m
  for 5.
- **What RIDB says about them is thin:**
  - 34 descriptions state a site count (read by `siteCount`, checked by hand on all 36 candidates;
    one false match fixed);
  - 3 list amenities on the Standard site;
  - 2 say the campground is closed.
  - Nothing is invented to fill the gaps.

## Brief
1. **Subject and audience:** a camper on the campground page, usually on a phone, who found this
   campground in search or a link and wants to camp there. They may not know what first-come means,
   and CampHawk can't book or watch it.
2. **Mode:** Operate. Clarity first; CampHawk's look (`camphawk-design`, `ch-*` tokens) in the details.
3. **The one job:** the camper understands there's nothing to reserve, knows how to get a site,
   and can find the campground. Proof: they can say the three steps and open it in a maps app.
4. **Fixed:** the map drawing rules (roads, trails, water, relief, scale), never colour alone, the
   palette, the copy rules (US spelling, nothing claimed beyond the data).
5. **Free:** what leads (map or steps), how the campground's area is drawn, what facts sit beside it.

## Two directions
**A · Map and how-to side by side.**
- The campground's area is hatched and outlined on a square map, labelled "Campground", with its
  own restrooms. With no outline, a pin says "About here".
- Beside it (below it on a phone): the three steps, then the facts (sites, getting to a site,
  what's here, where, alerts).
- **Thesis:** it reads like the single-unit map the owner picked, so the campground page stays
  one family.

**B · Steps first, then a wide map.**
- A strip of the three steps across the top, a wide map under it, and the facts in two columns
  below.
- **Thesis:** the first thing a camper needs is "you can't book this, here's what to do", so lead
  with it.

**Shared:**
- A "First come, first served" chip with a tent icon.
- A closed notice (icon, the word "Closed", a sentence) when the description says closed.
- The Scan and Pay step only when the description says Scan and Pay; otherwise "Pay at the
  campground".
- Alerts: "There's nothing to book ahead, so CampHawk can't watch it for openings."

## Self-check against the defaults
- **The hatching is pattern, not colour**: the area reads as "the campground" for a colour-blind
  reader, and the label says it in words.
- No new colours: ink for the outline and labels, the alert tokens for "Closed" (with its icon
  and word).
- No picture drawn in code. The map is data, the relief is a survey.
- **Copy claims only what RIDB says:**
  - the site count is attributed to "Recreation.gov's description";
  - an unknown count is said to be unknown;
  - amenities come from RIDB attributes or restrooms on the map.

## Not settled
- Whether the build should record "first-come" for these listings, so the check and the review
  page treat them as their own kind (not a unit). It waits for the owner's pick.
- 42 have no OpenStreetMap outline. For those the map is a pin "About here", which is honest but
  thin. Tracing their outline from the photo is possible where it shows.
