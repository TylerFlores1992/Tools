# Next session

*Updated at the end of every session. Read this first, then `CLAUDE.md`.*
*Last updated: 2026-10-02.*

## At a glance

| What | Where | State |
|---|---|---|
| Site | https://tylerflores.dev | Live. Merges to `main` deploy production automatically. |
| Home hero | `/` | Live. Signed off by the owner. |
| Bridle calculator | `/workshop/bridle-calculator` | Live. Signed off by the owner. |
| ETCP rigger study | `/workshop/etcp-rigger-study` | Live. Practice tests A/B, 73 flashcards, formula reference. |
| CampHawk lab | `/lab/camphawk` | Live and private. Owner's password is set in Vercel. Home page only so far. |
| Hosting | Vercel project `tylerflores-dev` (Hobby, $0) | Details in `docs/SETUP.md`. |
| Domain + DNS | Cloudflare | Done. HTTPS certificates issued and auto-renewed by Vercel. |

**Checks, all green:** `npm run verify` (104 tests) · `npm run e2e` (10 browser checks) ·
`npm run shots` (72 screenshots) · `npm run smoke -- https://tylerflores.dev` (9 pages, including
`/lab/camphawk` answering 401 without the password).

## Waiting on the owner
1. **GitHub default branch → `main`** (GitHub → Settings → General → Default branch). New PRs
   still default to the old session branch.
2. **Pick the next CampHawk lab screen:** search results, campground detail, or watch setup.

## Next up (in order)
1. **CampHawk lab:** the screen the owner picks. Port it from `/home/user/campsite-finder`
   (read-only; never modify that repo) into `src/lab/camphawk/`, with fake data and `#` links.
2. **Speed:** measure LCP with https://pagespeed.web.dev on tylerflores.dev. Target is 1.8 s on
   mobile. If over, trim client JS (home ships only HeroFilm as a client component; check the
   bundle with `next experimental-analyze`).
3. **Hero media caching:** files in `public/media/hero/` are served `max-age=0`. Version the
   filenames and send `immutable` caching from `next.config` headers.
4. **CI:** add `npm run e2e` (needs a Chromium install step on the runner).
5. **Later:** ⌘K palette, `/bench`, offline support for `/workshop/*`, a CampHawk tier-3 page
   with real screenshots (ask before publishing any number).

## What's built, in more detail

### Foundations (Phases 0–3)
Brief: `docs/BRIEF.md` (Direction E "Monument"). Next 16 + Tailwind 4 tokens, design guard
tests, screenshot harness, CI, skills. Primitives in `src/components/`. Fonts subset to 40 KB
(`scripts/subset-fonts.sh`). Per-page OG images, sitemap, robots, manifest, view transitions.

### Home hero
Code-rendered film (`studio/film/`, skill `hero-film`): 16:9 and portrait cuts, AV1/H.264,
AVIF posters. Intro readable in about 1.2 s. Reduced motion or Save-Data shows the poster only.

### Bridle calculator
Math in `src/tools/bridle/math.ts`, tested against worked examples and 500 random rigs.
Draggable and keyboard-operable diagram, ft/lb ↔ m/kg, deep links, the math worked by hand.

### ETCP rigger study (`src/tools/etcp/`)
- Practice tests A and B (25 questions each): answers lock in, ✓/✕ shown in words, working
  shown. Every numeric answer is recomputed in `questions.test.mts` (bridles through the
  calculator's solver).
- 73 flashcards in four decks, told apart by name and glyph, never colour. The original
  tilting card was backward (the higher pick gains load); fixed, with a geometry test.
- Formula reference in our own notation, each formula linked to its questions, plus the
  official ETCP PDF. Exam outline counts checked against ETCP's pages.
- Progress is saved in the browser only (`stored.ts`).

### CampHawk lab (`src/lab/camphawk/`, `src/app/lab/camphawk/`)
- CampHawk's marketing home ported as a design sandbox, with a "View as" switch for its
  signed-out / subscriber / in-app pricing. Fake data; every link is `#`.
- CampHawk's look is scoped to the lab: `ch-*` tokens in `globals.css`, Bitter + Nunito Sans
  loaded in the lab layout only, brand images in `public/lab/camphawk/`.
- Private: `src/proxy.ts` checks HTTP Basic auth against `LAB_PASSWORD` (any username).
  Fails closed if the variable is missing. Set in Vercel on 2026-10-02 (Production, Sensitive).
- Not ported yet: CampHawk's `--ch-sticky` scroll padding (anchor jumps can land under the
  phone header) and the account menu.

## Measurements (2026-10-02)
- Local production build, Lighthouse 12, mobile: home 98, calculator 98, workshop 99
  performance; 100 accessibility, best practices and SEO; CLS 0. LCP 2.2–2.4 s simulated
  (target 1.8 s). Desktop: 100, LCP 0.5–0.6 s.
- Lighthouse run from this container against the live site is too noisy to judge (LCP 1.9 to
  3.6 s across runs). Use PageSpeed Insights from a real browser.

## Gotchas
- `create-next-app` refuses the folder name "Tools" (capitals): scaffold elsewhere, copy in.
- `LayoutProps` needs `next typegen` before `tsc` on a clean checkout (`typecheck` does it).
- `pkill -f 'next start'` kills your own shell. Use `pkill -f '[n]ext-server'`.
- Software WebGL here renders about 5 s per 1080p film frame; run film renders in the background.
- tsx injects `__name()` into functions passed to `page.evaluate`: add
  `page.addInitScript("globalThis.__name = (f) => f")` first (scripts do).
- Screenshot after entrance animations finish, or the shot (and contrast reading) lies.
- `opacity-*` on text breaks token contrast; the opacity guard fails on it.
- A mutation test only counts if the build succeeds: a break that fails `tsc` leaves the old
  build in place and the e2e run proves nothing. Check `npm run build` exits 0 first.
- In a `&&` chain, don't put `;` before `git push`: the push runs even when an earlier commit
  failed.
- Vercel connector: pass no `teamId` (403 "re-authenticate to this scope"); `create_project`
  works where `create_git_project` doesn't. It can't read the CampHawk lab: test that with
  `npm run e2e` locally, which starts its own server with a known password.
- From this container, `curl https://tylerflores.dev` fails but Node's `fetch` works, so
  `npm run smoke -- https://tylerflores.dev` is fine. To inspect the certificate:
  `openssl s_client -connect tylerflores.dev:443 -servername tylerflores.dev -proxy ${HTTPS_PROXY#http://}`.
- Lighthouse against a live URL from here needs `--chrome-flags="--ignore-certificate-errors
  --proxy-server=$HTTPS_PROXY"` (the proxy re-signs TLS).
