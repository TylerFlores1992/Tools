# Next session

*Updated at the end of every session. Read this first, then `CLAUDE.md`.*

## Where we are (2026-10-02, end of session)
- **Phases 0–3 done.** Brief: `docs/BRIEF.md` (Direction E "Monument"). PR #1 is open
  (`ccr-7bbd906e-003dsw` → `main`). `main` holds only an empty root commit.
- **Phase 4, first batch, built and awaiting the owner's sign-off:**
  - Primitives in `src/components/` (Button/LinkButton, State, Card, Kbd, Label,
    NumberField, Segmented, SiteHeader, SiteFooter, PageTransition, HeroFilm).
  - Home hero: code-rendered film (16:9 + portrait cuts, AV1/H.264, AVIF posters), scrims,
    intro readable in ~1.2 s, reduced-motion/Save-Data → poster only.
  - Flagship tool: `/workshop/bridle-calculator` (maths in `src/tools/bridle/math.ts`, tested
    against worked examples + 500 random rigs; UI with draggable/keyboard diagram, unit
    conversion, deep links, worked math). Workshop index with honest status.
  - Per-page OG images, sitemap, robots, manifest, JSON-LD on the tool page, view transitions.
  - Fonts subset to 40 KB total (`scripts/subset-fonts.sh`).
- **Measured** (local production build, Lighthouse 12):
  - Mobile: home 98/100/100/100, calculator 98/100/100/100, workshop 99/100/100/100;
    CLS 0. **LCP 2.2–2.4 s simulated** (target 1.8 s): the remaining cost is the Next/React
    runtime (~145 KB JS) sharing simulated slow 4G with the text paint.
  - Desktop: 100 performance on all three, LCP 0.5–0.6 s.
- **Checks:** `npm run verify` (84 tests), `npm run e2e` (6 browser checks), `npm run shots`
  (40 shots incl. measured text-over-film contrast) — all green.

## Blocked on the owner
1. **Sign-off on the home page and the bridle calculator** before the rest of Phase 4.
2. Merge PR #1 (or say to keep stacking on it).
3. Connect the repo to Vercel (`docs/SETUP.md`) — needed to measure LCP on the real CDN.
4. Buy `flores.tools`.

## Next (after sign-off)
1. Re-measure LCP on a Vercel preview; if still > 1.8 s, trim client JS (e.g. make the
   home page ship no client components besides HeroFilm, check bundle with
   `next experimental-analyze`).
2. ETCP rigger study (port the owner's artifacts: 50 questions, 73 flashcards, formula sheet;
   fix ✓/✕ colour-only, verify the tilting flashcard, own formula sheet with credit).
3. ⌘K palette, `/bench`, offline support for `/workshop/*` (service worker).
4. CampHawk tier-3 page with real screenshots (ask before publishing any number).
5. Add `npm run e2e` to CI (needs a Chromium install step on the runner).

## Gotchas met this session
- `create-next-app` refuses the folder name "Tools" (capitals): scaffold elsewhere, copy in.
- `LayoutProps` needs `next typegen` before `tsc` on a clean checkout (`typecheck` does it).
- `pkill -f 'next start'` kills your own shell (the pattern matches the command line). Use
  `pkill -f '[n]ext-server'`.
- Software WebGL here renders ~5 s per 1080p film frame; run film renders in the background.
- tsx injects `__name()` into functions passed to `page.evaluate`: add
  `page.addInitScript("globalThis.__name = (f) => f")` first (scripts do).
- Screenshot after entrance animations finish, or the shot (and contrast reading) lies.
- `opacity-*` on text breaks token contrast; the opacity guard now fails on it.
