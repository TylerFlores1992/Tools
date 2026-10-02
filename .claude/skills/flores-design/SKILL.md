---
name: flores-design
description: How tylerflores.dev (Cyber Wolf) looks, reads and moves — the colour tokens and what each MEANS, type scale, spacing, radii, motion, the hero, and copy rules. Use when building or changing any page or component (`src/app/**`, `src/components/**`, `src/app/globals.css`, `src/design/tokens.ts`), choosing a colour, writing user-facing copy, adding a font, or when asked for polish, "make it look better", a new page or a redesign. Audit the result with `ui-audit`.
---

# tylerflores.dev design (Direction E, "Monument")

**House style, not a generic taste guide.** When an instinct collides with a rule here, the rule
wins. Values live in `src/app/globals.css`; meanings and allowed pairs in `src/design/tokens.ts`.
If this file and those disagree, **the code is right — fix this file.** Full brief:
`docs/BRIEF.md`. Reference renders: `docs/design/`.

## The feel
Precise, nocturnal, alive. A colossal faceted wolf rising behind a night mountain range; quiet
pages around tools with real depth. **Never** cheesy-cyberpunk (no Orbitron, Matrix rain, neon
green/magenta glitch), cute, or corporate. **No bio, no "about me", no nickname story.**

## Colour = meaning (use a token, never a hex)
| token | means |
|---|---|
| `bg` `surface` `surface-2` | page · card · raised |
| `ink` `ink-2` `muted` | text tiers, all AA on every surface |
| `line` `line-2` | decorative hairlines only |
| `control` | edges of inputs/toggles (3:1) |
| `ember` | the wolf's eye: brand moments, ONE highlight per screen, focus ring. **Never status.** |
| `ice` | correct / done / working — always with ✓. Diagram series 1 (solid) |
| `wrong` | wrong / invalid — always with ✕ and a word. (Pink, not red: red collapses into ember for a deuteranope) |
| `series-2` | second diagram series — always dashed |
| `primary` / `on-primary` | the one main action |

- **Colour never carries a state alone.** The owner is red-green colour-blind.
- Dark is the default; light ("paper") follows the system or `data-theme="light"`. The home hero
  is always night (`.theme-night`). No `dark:` variants — tokens switch by themselves.
- New combination? Add it to `CONTRAST_PAIRS` first; the test enforces it.

## Type
Two families: **Mona Sans** (variable wght + wdth) and **JetBrains Mono** (labels only).
`text-display` (home only) · `text-title` · `text-h2` · `text-h3` · `text-lede` · `text-body` ·
`text-small` · `text-label` (mono, uppercase). Body 60–72ch. Numbers `tabular-nums`. Sentence
case everywhere. Display weight 400 — the size does the work.

## Shape, depth, motion
- Radii: `rounded-tag` 8 · `rounded-btn` 14 · `rounded-input` 16 · `rounded-card` 20.
- Cards are solid `surface` + 1px `line` border + `shadow-card`. Glass (backdrop-blur) only on
  the nav pill and ⌘K palette.
- Durations `--dur-instant/fast/base/slow/cinematic` (80/160/240/420/1200ms); easing `ease-out`
  for entrances, `ease-std` for UI; stagger 60ms. Every animation has a reduced-motion path.

## The hero
Code-rendered film (`studio/film/`, skill `hero-film`): 8s seamless loop, AV1 + H.264 + AVIF
poster in `public/media/hero/`. Headline is the LCP element, never the video. Copy:
"Quiet tools. / Sharp teeth." (`SITE.headline` in `src/lib/site.ts`).

## Copy
Plain, specific, honest. US spelling (`src/lib/us-spelling.test.mts`). No invented numbers —
counts come from data (`src/lib/tools.ts`). Never show internals (codes, IDs). Unknown is
never a negative: "–" for an invalid input, not 0.

## Do not
- Put `robots` in a layout (per page). Call `headers()`/`cookies()` in the root layout.
- Use stock Tailwind colours, raw hex in components, or a third font.
- Use `ch-*` (CampHawk) tokens or fonts outside `/lab/camphawk`; they are CampHawk's look, not ours.
- Ship the live WebGL terrain to visitors (it's a production tool for the film).
