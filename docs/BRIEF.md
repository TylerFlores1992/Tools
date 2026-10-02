# Brief — Direction E "Monument" (approved 2026-10-02)

*2 Oct 2026. Approved: E, headline "Quiet tools. Sharp teeth.", domain likely `flores.tools`, nothing about the person on the site for now.*

## Decisions

| Area | Decision |
|---|---|
| Home | Hero only: the faceted wolf rising behind a night mountain range, headline, one line, **Enter the workshop**. No tools, no bio. Slim footer. |
| Brand | "Cyber Wolf" wordmark with an ember diamond. Domain `flores.tools`. No name, bio, about page or nickname story. |
| Feel | Precise, nocturnal, alive. Never cheesy-cyberpunk, cute or corporate. |
| Hero media | A **code-rendered film loop** (below) with an AVIF poster. No Higgsfield or any paid tool. The live WebGL terrain is the production tool for the film; it's never shipped to visitors. |

## Sitemap (revised: no About)

| Route | Purpose |
|---|---|
| `/` | Hero, as above |
| `/workshop` | The tool index (B's dense table style) |
| `/workshop/bridle-calculator` | Calculator, works offline, deep-linkable inputs |
| `/workshop/etcp-rigger-study` (+ `/practice/a`, `/practice/b`, `/flashcards`, `/formulas`) | Study hub |
| `/workshop/camphawk` | Tier 3 page, link out |
| `/bench` | What's being built |
| `/notes` | Hidden until 2 notes exist |
| System | 404 (wolf in the stars), sitemap, robots, per-page OG images, manifest, offline worker for `/workshop/*` |

Nav: **Home · Workshop · Bench** plus ⌘K.

## Design system

**Type:** **Mona Sans** for display and text (variable, OFL), plus **JetBrains Mono** for labels. That's two families. Hubot and Instrument are dropped.

| Token | Spec | Use |
|---|---|---|
| `display` | clamp(48px, 6.2vw, 156px) / .96 / −0.05em, wght 400, wdth 104 | Home headline |
| `title` | clamp(36px, 4vw, 72px) / 1.02 / −0.04em | Page titles |
| `h2` | clamp(26px, 2.4vw, 40px) / 1.1 / −0.03em | Sections |
| `h3` | 20px / 1.25 / −0.015em, wght 560 | Cards, rows |
| `lede` | clamp(17px, 1.05vw, 24px) / 1.55 | Under titles |
| `body` | 16px / 1.6 | 60–72ch |
| `small` | 14px / 1.5 | Secondary |
| `label` | 12px / 1.4 / +0.16em, mono, uppercase | Eyebrows, metadata |

**Colour (dark is the default; light is for tool pages on request)**

| Token | Dark | Light | Meaning |
|---|---|---|---|
| `bg` | `#05070E` | `#F5F3EE` | Page |
| `surface` / `surface-2` | `#0B1222` / `#111A2E` | `#FFFFFF` / `#EAE6DE` | Cards, raised |
| `ink` / `ink-2` / `muted` | `#F3F5FA` 18.5:1 / `#C2C9D8` 12.1:1 / `#949DB2` 7.4:1 (6.4:1 on surface-2) | `#12141C` 16.6:1 / `#454A57` 8.0:1 / `#5F6472` 5.3:1 (4.75:1 on surface-2) | Text |
| `ember` | `#FFB27A` 11.4:1 | `#9A4A1E` 5.6:1 | **The wolf's eye: brand moments, one highlight per screen, focus rings.** Not for status. |
| `primary` | `ink` button with `bg` text, 18.5:1 | inverse | The one main action |
| `ice` | `#8FB4FF` 9.0:1 | `#2459D6` 6.0:1 | **Correct / done / working**, always with ✓. Series 1 in diagrams (solid). |
| `wrong` | `#FF7AB6` 7.8:1 | `#B0257A` 6.2:1 | **Wrong / invalid**, always with ✕ and a word |
| Series 2 | `ember` dashed | `#B05A1F` dashed | Second leg/series, always dashed |

**Colour-blind checks (deuteranopia simulation, RGB distance):**
- ice vs ember: 155
- wrong vs ember: 77
- wrong vs ice: 81
- **Red was rejected** for "wrong": under deuteranopia it sat only 33 from ember.

**Focus:** a 2px `ember` ring with a 2px offset.

**Text over imagery** always gets a scrim and is measured in screenshots. Every hero text element passes AA at 375, 1440 and 2560.

**Shape and depth:**
- **Radii:** 8 (tags), 14 (buttons), 16 (inputs), 20 (cards), full (nav pill).
- **Glass:** only on the nav pill and the ⌘K palette.
- **Cards:** solid `surface` with a 1px `ink` border at 10% and an inset top highlight.

**Motion:**

| Token | Value | Used for |
|---|---|---|
| instant | 80ms | |
| fast | 160ms | |
| base | 240ms | |
| slow | 420ms | |
| cinematic | 1200ms | Hero intro, once |
| Entrances | ease `cubic-bezier(.16,1,.3,1)` | |
| Stagger | 60ms | |

The hero intro, in order:
1. Stars fade in.
2. The ridge rises 12px.
3. The wolf fades up from the mist.
4. The eyes ignite.
5. The headline is revealed line by line.

Reduced motion means static, with a 150ms fade.

**Breakpoints:** 480, 768, 1024, 1280, 1600 and 2000. Above 2000px, type and spacing scale up rather than freezing.

## Hero film: made in-house, no Higgsfield

There's no AI video generator in this setup. The film is **rendered from code**: the raymarched terrain shader plus the faceted SVG wolf, captured frame by frame in headless Chromium and encoded with ffmpeg. That brings three advantages: it stays exactly on brand, the source is reproducible, and it costs $0.

| Asset | Spec |
|---|---|
| `hero-1080.webm` | AV1 (SVT-AV1), 1920×1080, 24 fps, 8 s seamless loop — 792 KB |
| `hero-1080.mp4` | H.264 fallback, same content, `+faststart` — 2.2 MB |
| `hero-poster.avif` / `.webp` | The frame where the eyes are brightest. It's what reduced-motion and Save-Data visitors see, and it's the first paint. |
| `hero-portrait` set | A separate 4:5 render composed for phones |

**What moves (bolder cut, 2026-10-02):** the camera flies a slow closed orbit (sway + push-in) so the ridges parallax, mist rolls through the valleys, soft moonbeams fall behind the wolf, one shooting star crosses per loop, and the eyes ignite from dark to full glow. Every motion is periodic over the loop, so frame 192 joins frame 0 with no seam.

**Rendering:** about 5 s per 1080p frame in software rendering here, so roughly 12 minutes per loop. Scripts: `film.html`, `film.mjs`, `terrain.js`, `wolf2.js`.

**Upgrades available for Phase 4:**
1. A real 3D wolf with parallax.
2. A slow push-in with a ping-pong loop.
3. A 1440p master.
4. Volumetric moonbeams.

## Next: Phase 3 (foundations)

1. Repo scaffold.
2. A short CLAUDE.md router with a line-cap check.
3. A design skill and a UI-audit skill.
4. `npm run verify`.
5. CI.
6. Vercel previews.
7. The token, contrast and font tests.
8. A Playwright screenshot harness at 375, 768, 1440 and 2560, in light and dark.
9. Branch → PR → merge.
