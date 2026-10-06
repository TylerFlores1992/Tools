---
name: hero-film
description: How the home hero film is made and re-rendered — the raymarched terrain shader, the faceted wolf, frame capture and ffmpeg encoding. Use when touching `studio/film/**` (`terrain.js`, `wolf2.js`, `film.html`, `film.mjs`), `public/media/hero/**`, or when asked to change the hero video, poster, mountains, wolf, mist, camera move, loop length, or to "make the video bolder/calmer".
---

# Hero film pipeline

No AI video service is used. The film is **rendered from code** and captured frame by frame.

- `studio/film/terrain.js` — WebGL2 raymarched heightfield (ridged multifractal, moonlight,
  soft shadows, ambient occlusion, looping valley mist, twinkling stars). Renders in bands so
  long frames don't time out.
- `studio/film/wolf2.js` — the faceted wolf: 100 points, Delaunay-triangulated, fake-3D lit.
  Also renders as constellation or engraving.
- `studio/film/film.html` — the scene: stars + moonbeams + wolf + terrain (transparent sky) +
  haze. `window.frame(phase)` draws one frame for phase ∈ [0,1).
- `studio/film/film.mjs` — `node studio/film/film.mjs <w> <h> <frames> <outdir>`.

## Rules
- **Everything that moves is periodic in `phase`** (camera on a closed orbit, mist drift on a
  circle in noise space, stars on integer frequencies). Frame N joins frame 0 with no seam.
  Check: PSNR(last→first) ≈ PSNR(consecutive) via `ffmpeg -lavfi psnr`.
- Software rendering here is ~5–6 s per 1080p frame: run renders in the background.
- Encode (from the frames dir):
  - `ffmpeg -framerate 24 -i f%04d.png -c:v libsvtav1 -preset 5 -crf 36 -pix_fmt yuv420p hero.webm`
  - `ffmpeg -framerate 24 -i f%04d.png -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart hero.mp4`
  - Poster: the brightest-eyes frame → AVIF (`libaom-av1 -still-picture 1`) and WebP.
- Budget: AV1 < 1 MB, MP4 < 2.5 MB, poster < 120 KB. The headline stays the LCP element.
- Phones get their own 4:5 render, not a crop of the 16:9.
- Files ship from `public/media/hero/<hash>/`, cached `immutable` for a year. After a new
  encode, `npm test` fails in `src/lib/hero-media.test.mts` and names the new hash: rename the
  folder and set `HERO_VERSION` in `src/lib/hero-media.ts`. Never overwrite files in place.
- Look at frames (tile 4 phases with ffmpeg `hstack/vstack`) before committing a render.
