# Assets: where pictures come from ($0 budget)

**Rule:** pictures come from cameras, painters or image models. Code draws geometry: type, layout,
maps from real data, diagrams, charts, icons, crisp marks. Never ship a canvas or SVG "scene"
(landscape, sky, animal, figure) as the hero picture.

## Free, license-safe sources
| Source | License | Check before use |
|---|---|---|
| **NPS / NPGallery** (npgallery.nps.gov, nps.gov galleries) | Public domain when credited "NPS" with **no ©** | The credit line. Anything © or credited to someone else is NOT public domain. Acknowledge "NPS" where practical |
| **Other US federal agencies** (USFS, BLM, USGS, NASA) | Usually public domain | Same check on each item's credit |
| **Unsplash** | Unsplash License: free, commercial OK, no attribution required | Not for resale as-is; avoid recognizable people or brands without care |
| **Openverse / Wikimedia Commons** | Per item (CC0, CC BY, CC BY-SA) | Record the exact license and author; CC BY needs credit on the page |
| **The owner's own photos** | The owner's | Ask; the best option when available |
| **The owner's image-model output** (any free tier) | Per tool's terms | The owner generates; we never pay or sign up for anything |

Record every asset in the surface's `docs/design/<surface>.md`: file, source URL, license,
credit. Verify a URL resolves before relying on it. Big commercial sites often block this
container; NPS and Wikimedia usually load.

## Preparing images
- Hero: export at 2× the display size, WebP or AVIF, quality about 70–78, and art-directed phone
  and desktop crops (`<picture>`), as `src/lab/camphawk/LookScene.tsx` does.
- One grade across the page: the same light and temperature. Small, deliberate edits only
  (crop, exposure, a slight tint toward the palette), never filters.
- Text over imagery needs measured contrast on the rendered pixels (ui-audit), or a calm area
  of the image, or a solid panel.

## Image-prompt pack (for the owner to run in a free image tool)
Write prompts as an art director's brief, not a keyword list:
1. **Subject and moment:** one concrete thing ("a single tent on a granite shelf above a lake at blue
   hour", not "camping").
2. **Medium:** "35mm film photograph", "gouache painting", "risograph print". Pick one and keep it
   across the set.
3. **Light and palette:** name the light, plus 3–4 colors from the project's tokens.
4. **Composition for the layout:** "subject in the lower right third; calm sky in the upper left
   for a headline", plus the aspect ratio (desktop 21:9, phone 4:5).
5. **Exclusions:** "no text, no logos, no people's faces, no lens flare, no oversaturation".
Generate 4 or more, then pick by the layout's needs (a calm area for text, subject placement), not prettiness.
