# Campground maps: the agency-map pilot (a batch's brief)

*2026-10-11. About 280 canopy maps stay unsure or held after the lidar campaign: the layers show
bands, but not plainly enough to say which band is a lane, or which loop a site is on. The Forest
Service, the Park Service and the Corps of Engineers publish their own campground maps. This pilot
tests, on 20 of those maps, whether an agency's map settles what the layers can't. The
orchestrating session records the first looks and decisions after a final check.*

**Everything in `campground-maps-fix-brief.md` and `campground-maps-canopy-brief.md` applies.** Read
both first. This brief adds what's different.

## Finding the agency's map
- Look for the campground's own map, published by the agency that runs it:
  - the Forest Service: `fs.usda.gov` (the forest's recreation page, "Campground map" PDFs);
  - the Park Service: `nps.gov` (the park's "Campground" page and its maps);
  - the Corps of Engineers: `usace.army.mil` and its district and lake sites;
  - Recreation.gov's listing pages link to many of these.
- Record the exact URL, the publisher and the date the map shows (if it shows one).
- Keep each map file in the batch's scratch folder only. **Never commit an agency map or put one in
  `public/`.**

## Can it be used (decide before you use it)
- **Usable:** made and published by a federal agency itself. Works of the US government are public
  domain (17 U.S.C. § 105).
- **Not usable; record why and move on:**
  - made by a concessionaire, a state, a county or a private company, even when the agency's
    website hosts it;
  - drawn over commercial imagery or a commercial basemap (Google, Esri, Bing, Mapbox and others);
  - marked as copyrighted, or credited to a non-federal author.
- When you can't tell, it's not usable.

## How to use it
- **Never trace from the agency map.** It isn't to scale. Every line still goes on the photo or a
  lidar layer, within about 3 m of the lane's middle, as the canopy brief says.
- Use it only to settle three things:
  - which faint bands on the layers are lanes, and which are drainage, tracks or trails;
  - how the loops connect, and which loop each site is on;
  - whether a pin sits on the right loop.
- If the agency map shows a lane that no layer and no photo shows, don't draw it. Say so in the note.
- Say in the note what the agency map settled, for example: "The Forest Service map (2019) shows
  the C loop's inner lane; the intensity shows it as a faint band, now traced." The trace's
  `photo` credit stays the photo or point cloud the geometry came from.

## The results file
- As in the canopy brief, plus these fields:
  - `"agency": { "url": "...", "publisher": "...", "usable": true|false, "why": "..." }`
    (`null` when no map was found);
  - `"settled": "what the agency map decided, in one sentence"` (`""` if nothing).
- The call is by the same usable bar. A map moves from unsure only when the agency map and a layer
  or the photo together show the lanes to 3 m.
