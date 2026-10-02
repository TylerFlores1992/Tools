# Next session

*Updated at the end of every session. Read this first, then `CLAUDE.md`.*

## Where we are (2026-10-02, end of session)
- **Phases 0–3 done.** Brief: `docs/BRIEF.md` (Direction E "Monument"). PR #1 merged into
  `main` (6ee7d43).
- **Deployed.** Vercel project `tylerflores-dev` (details and gotchas in `docs/SETUP.md`).
  Production from `main` is live at https://tylerflores-dev.vercel.app — smoke test green,
  calculator, film, posters, OG images, sitemap, robots, manifest all 200.
  **https://tylerflores.dev is live** (DNS at Cloudflare, grey cloud; Let's Encrypt certs for
  apex and `www`, auto-renewed by Vercel); `www` 308s to the apex. Merges to `main` deploy
  production automatically; other branches get preview URLs.
- **Phase 4, first batch: signed off by the owner (2026-10-02).**
  - Primitives in `src/components/` (Button/LinkButton, State, Card, Kbd, Label,
    NumberField, Segmented, SiteHeader, SiteFooter, PageTransition, HeroFilm).
  - Home hero: code-rendered film (16:9 + portrait cuts, AV1/H.264, AVIF posters), scrims,
    intro readable in ~1.2 s, reduced-motion/Save-Data → poster only.
  - Flagship tool: `/workshop/bridle-calculator` (maths in `src/tools/bridle/math.ts`, tested
    against worked examples + 500 random rigs; UI with draggable/keyboard diagram, unit
    conversion, deep links, worked math). Workshop index with honest status.
  - Per-page OG images, sitemap, robots, manifest, JSON-LD on the tool page, view transitions.
  - Fonts subset to 40 KB total (`scripts/subset-fonts.sh`).
- **ETCP rigger study is live** (`/workshop/etcp-rigger-study`, code in `src/tools/etcp/`):
  overview, practice tests A/B (25 Qs each, locked answers, ✓/✕ in words, working shown),
  73 flashcards (decks by name + glyph, never colour; keyboard flip; Again/Got it), and our own
  formula reference linking each formula to its questions + the official ETCP PDF. Progress
  is localStorage only (`stored.ts`, survives blocked storage via a memory copy).
  - Every numeric answer key is recomputed in `questions.test.mts` (bridles through the
    calculator's solver); the tilting flashcard was backward in the original and is fixed with
    a geometry test. Exam outline counts verified against ETCP's pages.
  - e2e: wrong-answer copy + reload persistence, answer lock-in, keyboard flip + Got it.
- **Measured** (local production build, Lighthouse 12, before deploy):
  - Mobile: home 98/100/100/100, calculator 98/100/100/100, workshop 99/100/100/100;
    CLS 0. **LCP 2.2–2.4 s simulated** (target 1.8 s): the remaining cost is the Next/React
    runtime (~145 KB JS) sharing simulated slow 4G with the text paint.
  - Desktop: 100 performance on all three, LCP 0.5–0.6 s.
- **Checks:** `npm run verify` (104 tests), `npm run e2e` (10 browser checks), `npm run shots`
  (72 shots incl. measured text-over-film contrast) — all green.
- **Live Lighthouse from this container is too noisy to judge:** home LCP 3.6 / 3.0 / 1.9 s
  across three runs against the live site vs 2.7 / 2.6 s local in the same minutes (the
  container's TLS proxy sits in the path). The anonymous PageSpeed Insights API quota was
  exhausted. Use https://pagespeed.web.dev from a real browser for the real number.

## Blocked on the owner
1. **GitHub default branch → `main`** (`docs/SETUP.md`).
2. **Set `LAB_PASSWORD` in Vercel** so the CampHawk lab can be opened (`docs/SETUP.md`).

## CampHawk lab (built 2026-10-02)
- `/lab/camphawk`: CampHawk's marketing home ported as a design sandbox (`src/lab/camphawk/`),
  with a "View as" switch for its signed-out / subscriber / in-app pricing branches. CampHawk's
  tokens live in `globals.css` under `ch-*` (lab only), fonts Bitter + Nunito Sans load in the
  lab layout only, brand images in `public/lab/camphawk/`. Links are `#`: nothing reaches the
  real app.
- Private: `src/proxy.ts` (Next 16 Proxy, Node runtime) does Basic auth against `LAB_PASSWORD`;
  fails closed. **The owner must set `LAB_PASSWORD` in Vercel** (`docs/SETUP.md`). `npm run
  smoke` asserts production answers 401; e2e asserts 401 for no / wrong password and images,
  200 + noindex with it (mutation-tested by making the check fail open).
- Not yet ported: the `--ch-sticky` scroll-padding publish (anchor jumps can land under the
  phone band) and the account menu. Next screens are the owner's call.

## Next
1. Measure LCP with PageSpeed Insights on tylerflores.dev; if > 1.8 s, trim client JS (e.g. make the
   home page ship no client components besides HeroFilm, check bundle with
   `next experimental-analyze`).
2. CampHawk lab: next screen of the owner's choosing (search results, campground detail, watch setup).
3. ⌘K palette, `/bench`, offline support for `/workshop/*` (service worker).
4. CampHawk tier-3 page with real screenshots (ask before publishing any number).
5. Add `npm run e2e` to CI (needs a Chromium install step on the runner).
6. Hero media is served `max-age=0, must-revalidate` (unhashed names in `public/`). Version
   the filenames and send `immutable` caching via `next.config` headers.

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
- Vercel connector: pass no `teamId` (403 "re-authenticate to this scope"); `create_project`
  works where `create_git_project` doesn't.
- This container can't fetch `https://tylerflores.dev` with curl (it can over plain HTTP). Check
  the certificate with `openssl s_client -connect tylerflores.dev:443 -servername
  tylerflores.dev -proxy ${HTTPS_PROXY#http://}`.
- Lighthouse against a live URL from here needs `--chrome-flags="--ignore-certificate-errors
  --proxy-server=$HTTPS_PROXY"` (the proxy re-signs TLS).
