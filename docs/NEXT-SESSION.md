# Next session

*Updated at the end of every session. Read this first, then `CLAUDE.md`.*

## Where we are (2026-10-02)
- **Phases 0–2 done.** Brief approved: Direction E "Monument" (`docs/BRIEF.md`), headline
  "Quiet tools. / Sharp teeth.", domain `flores.tools` (owner to buy), no bio/about content.
- **Phase 3 (foundations) done** on branch `ccr-7bbd906e-003dsw`:
  - Next 16.3.8 + Tailwind 4.3.3 scaffold, self-hosted Mona Sans + JetBrains Mono.
  - Tokens in `src/app/globals.css` (dark default, light "paper", `.theme-night` hero).
  - Guards (`npm test`, 71 tests): every class generates CSS (Tailwind compiler), contrast
    for every allowed pair in both themes, deutan/protan distinctness, no duplicate token
    declarations, fonts named = loaded, US spelling, CLAUDE.md ≤ 120 lines, skills have
    trigger descriptions. Each guard was mutation-tested.
  - `npm run verify` green. `npm run shots` (32 shots, 4 widths × 2 themes) green.
  - CI workflow, smoke script, favicon set, `/lab` design-system page.
  - Hero film: bolder 8 s loop in `public/media/hero/` (source `studio/film/`).

## Blocked on the owner
1. **No `main` branch yet** — the repo started empty. Needed before the first PR.
2. **Connect the repo to Vercel** for preview deploys (`docs/SETUP.md`).
3. **Buy `flores.tools`.**

## Next: Phase 4 — build to the bar
1. Primitives first in `src/components/` (Button, Link-button, Tag/State with icon+word,
   Card, Kbd, Nav pill) + `/lab` entries + screenshots.
2. Home hero: film (`<video>` AV1 + MP4, poster AVIF), faceted wolf layering, intro
   choreography (stars → ridge → wolf → eyes → headline), reduced-motion/Save-Data poster,
   headline as LCP. Render the 4:5 phone cut of the film.
3. Flagship tool page to full bar (likely the bridle calculator, from the owner's artifact;
   fixes listed in the Phase 0 notes: unit toggle converts values, ✓/✕ not colour alone,
   tilting flashcard to verify against a reference, own formula sheet with credit).
4. Per-page metadata, OG images, sitemap, robots, JSON-LD; ⌘K palette; view transitions.
5. Lighthouse 95+ / LCP < 1.8 s / CLS < 0.05 on preview deploys, then owner sign-off.

## Gotchas met this session
- `create-next-app` refuses the folder name "Tools" (capitals): scaffold elsewhere, copy in.
- `LayoutProps` needs `next typegen` before `tsc` on a clean checkout (`typecheck` does it).
- `pkill -f 'next start'` kills your own shell (the pattern matches the command line). Use
  `pkill -f '[n]ext-server'`.
- Software WebGL here renders ~5 s per 1080p film frame; run film renders in the background.
