# Home hero: "wilderness cyber" redesign (brief, references, image sources)

*Started 2026-10-18. Owner: "a slight redesign of our dev page. I like the idea. Wilderness cyber
tech feel. But our wolf drawing and woods background you created are not great." Process: skill
`design-direction`. Gates 1 (brief) and 2 (references) are done here. Gate 3 (written directions)
is next. Nothing is built yet.*

## Pick up here (next session)
1. Check the Cloudflare token works (§4.2). It was added to the environment on 2026-10-18, but the
   session that wrote this file couldn't see it, because environment settings load at session start.
2. Re-read §2. **Ask the owner to attach the three reference images again.** They weren't committed:
   two are watermarked stock and one is someone's painting.
3. Gate 3: write the two directions (§3) into this file, then draft 10–20 images each on Cloudflare
   (free) and show them side by side with the references.
4. The owner picks. The finals go on the remaining Vercel AI Gateway credit (§4.1). Then build
   (§5) and critique (Gate 6).

## 1. Brief (owner-confirmed 2026-10-18)
- **Scope: the hero, plus backgrounds.** Replace the code-drawn wolf and woods with generated art.
  Keep the layout, type and tool pages as they are.
  - The only art on the public site today is the hero film: `src/components/HeroFilm.tsx`, from
    `studio/film/` (`terrain.js`, `wolf2.js`), media in `public/media/hero/<hash>/`, folder name in
    `src/lib/hero-media.ts`. Tool pages have no background art. "Backgrounds" means the hero scene,
    plus optional quiet texture elsewhere only if it earns its place.
- **Hero: a still image with subtle motion.** One strong generated image. Slow parallax or drifting
  mist done in CSS, with a reduced-motion path. **The video goes.**
- **The "cyber" side is in the art itself:** circuit or data lines and glow in the forest and in
  the wolf. That rules out the photo-only option where the tech lives only in the UI.
- **Fixed:**
  - layout, type (Mona Sans, JetBrains Mono for labels), and the colour tokens;
  - the tool pages and the copy ("Quiet tools. / Sharp teeth.", `SITE.headline`);
  - **ember is the wolf's eye**, and it's the one highlight per screen;
  - the headline stays the LCP element, never the image;
  - the home hero is always night (`.theme-night`);
  - colour never carries meaning alone (the owner is red-green colour-blind).
- **Free:** the hero art, its composition, and the motion layer.
- **Never** (from `flores-design`): cheesy cyberpunk. No Orbitron, no Matrix rain, no neon
  green/magenta glitch.

## 2. References (owner's, 2026-10-18; images not committed)
| # | What it is | What it brings | Keep / drop |
|---|---|---|---|
| 1 | A painted forest (Red Riding Hood scene). A dark wolf half-hidden on the left, a red-hooded figure lower right, apples on the ground. | A painterly digital illustration. Deep blue-teal night; light glowing up from the ground and the grass; one warm red accent (the apples); mist between the trunks; big gnarled trees framing it. | **Keep** the palette, the ground light, and a wolf you discover rather than one posing. **Drop** the figure and the story props. |
| 2 | Stock (Dreamstime, watermarked). A full-body robotic wolf with armour plating, walking through a blue night forest, with red-orange glowing seams, red eyes and sparks. | Tech built into the animal; a red eye and glowing seams; blue forest bokeh; floating sparks. | **Keep** the seams and eye as ember, and the sparks. **Drop** the full armour (too toy-like) and the watermark. **Reference only.** |
| 3 | Stock (Dreamstime, watermarked). A wolf portrait with glowing white-blue circuit lines through the fur and a magenta-pink eye, in front of city bokeh. | Circuit lines drawn through real-looking fur; a glowing eye; a close portrait. | **Keep** the circuit lines in the fur. **Drop** the city: wilderness was asked for. The eye goes ember, not magenta. **Reference only.** |

**What they share:**
- a dark blue-teal night;
- one warm or red accent, which matches the site's `ember`;
- a wolf on one side, leaving room for the headline;
- light from the details (eyes, seams, the ground), not from the sky.

**Craft bar:** reference 1's finish (painterly, with depth and atmosphere) is the level to reach.
References 2 and 3 are the idea of the tech, not the finish: both read as stock.

**Licensing:** none of the three may be used, traced or edited. Prompts describe the look and
never name the images or their makers.

**Colour-blind check:** red or ember against blue-teal stays distinct for a deuteranope. The
headline must never depend on the red.

## 3. Directions (Gate 3, to write next)
Two candidates the owner has seen named. Write each as a contract per `design-direction`: thesis,
world, first viewport, signature moment, assets, self-check.
- **A, painterly:** close to reference 1. A painted night forest with ground light and mist. The
  wolf half in shadow on one side, with faint circuit glow in the bark, roots and grass, as if the
  forest is wired. Ember eye.
- **B, detailed:** between references 2 and 3. A realistic wolf with fine circuit lines through its
  fur and an ember eye, in a misty blue forest with a few drifting sparks. No armour.

**Composition for both:**
- the wolf on the right, or its head at upper right;
- dark, quiet space on the left for "Quiet tools. / Sharp teeth.";
- a wide master (about 2560 x 1440), plus a portrait cut composed for phones (not a crop);
- a separate mist or spark layer, if the model can give one, for the CSS motion.

## 4. Image sources (checked 2026-10-18)

### 4.1 Vercel AI Gateway: finals only
- **Balance:** `GET https://ai-gateway.vercel.sh/v1/credits` read **$1.425 left of $5**
  (`total_used` 3.635). It hasn't refilled since early October, and whether the $5 renews is not
  established.
- **Key:** `AI_GATEWAY_API_KEY` (in the environment). Calling pattern: `studio/camphawk-round2/generate.mjs`.
  Its `FLOOR = 2` would refuse now. A new script for this work should set its own floor, for
  example $0.25, and stop there.
- **Costs and models:**
  - Flux 1.1 Ultra cost about $0.06 an image for CampHawk, so roughly 20 images are left.
  - GPT Image and the Recraft pro tiers refuse free credit (403).
  - Recraft v4.1 is capped at 1280 px on free credit.
- **Lessons from CampHawk:**
  - Flux ignores "no X"; describe what is there instead.
  - The OpenAI-style `/v1/images/generations` ignores `aspect_ratio`; use the AI SDK's call, as
    `generate.mjs` does.

### 4.2 Cloudflare Workers AI: free drafts
- **Free allowance:** 10,000 neurons a day, resetting at 00:00 UTC, across all Workers AI use.
  Pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- **Models to use, both with open licences that allow commercial use of the outputs:**
  - `@cf/black-forest-labs/flux-2-klein-4b`: Apache 2.0. 5.37 neurons per input tile and 26.05 per
    output tile (512 x 512 tiles).
  - `@cf/black-forest-labs/flux-1-schnell`: Apache 2.0. 4.80 neurons per tile and 9.60 per step.
    Lower quality, near-free.
- **Rough capacity:** about a hundred klein images a day free. That's an estimate from the price
  table, not measured; read the real cost in the dashboard after the first run.
- **Avoid:**
  - `flux-2-klein-9b` and `flux-2-dev`: FLUX non-commercial licence;
  - `@cf/leonardo/*`: the terms were not checked.
- **Credentials:**
  - `CLOUDFLARE_API_TOKEN`, created by the owner 2026-10-18 from the "Workers AI" template
    (Account · Workers AI · Read and Edit; all accounts; no IP filter).
  - Verify it with `GET https://api.cloudflare.com/client/v4/user/tokens/verify`.
  - Account ID: `GET https://api.cloudflare.com/client/v4/accounts` with the token, or
    `CLOUDFLARE_ACCOUNT_ID` if the owner added it.
- **Call:** `POST https://api.cloudflare.com/client/v4/accounts/<account_id>/ai/run/<model>`.
  - Read each model's page for its input shape before writing the script. The FLUX.2 models take
    multipart form fields and schnell takes JSON; check, don't assume.
- **Network:** the session reaches `api.cloudflare.com` through the agent proxy (checked
  2026-10-18: it answered "Missing Authorization header" without the token).

### 4.3 Ruled out
- **Gemini API free tier:** no image-generation quota as of late 2026 (third-party reports and the
  developer forum). The Gemini app by hand is possible, but it isn't scriptable.

### 4.4 Record every image's provenance (CampHawk didn't, and it's now a blocker)
For each file that ships, record in a table in this doc:
- the file;
- the model and its licence;
- the prompt;
- the date;
- the cost;
- any edit, crop or upscale.

The CampHawk lab's art has no licence or provenance note, which its hand-off had to flag as an
open owner decision.

## 5. Build notes (when the art is picked)
- **The headline stays the LCP element.** The image is a background with explicit dimensions:
  - AVIF and WebP, one wide and one portrait;
  - LQIP or a solid colour first;
  - target under about 150 KB at 1440 wide.
- **Contrast:** the headline goes over a left-side scrim. Add the pair to `src/design/tokens.ts`
  `CONTRAST_PAIRS` first; contrast is a test.
- **Motion:**
  - CSS transform and opacity only;
  - slow, about 20–40 s;
  - paused off-screen;
  - none under `prefers-reduced-motion`;
  - no layout shift.
- **Retiring the film:**
  - `HeroFilm.tsx`, `public/media/hero/<hash>/`, `src/lib/hero-media.ts` and its test,
    `next.config.ts`'s `immutable` header for that path;
  - the `hero-film` skill and `studio/film/`;
  - `scripts/smoke.mts` checks `${HERO_MEDIA}/hero-poster.webp`.

  Update or retire each deliberately. Keep `studio/film/` in history (git), not necessarily in the
  tree.
- **Before you say it looks good:** `npm run shots`. Then a fresh critic agent against the
  references (Gate 6, two rounds at most), then the owner.
