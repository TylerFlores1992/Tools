# Tells: what makes a design read as generated

Use this file for the Gate 3 self-check and the Gate 6 critique. A tell isn't banned forever (a brief
can ask for any of them), but reaching for one when the choice was free means no choice was made.

## Our own record (CampHawk looks, 2026-10-05): what went wrong and why
| What we did | Why it read cheap | Do instead |
|---|---|---|
| Drew landscapes on canvas (ridgeline, poster, engraving, dusk) | Code-drawn pictures read as clip art or stock vector. The only look that held up was **Painted**, a real painting | Photos, paintings or model-generated images (`assets.md`); code for geometry only |
| Changed only the backdrop and card shadow | The page itself (narrow headline, identical icon-card grid, same chrome) stayed generic, so a new background behind a generic page is still a generic page | Change type scale, composition, imagery and rhythm, all inside the fixed words and controls |
| Six looks, each a theme | Breadth instead of depth, and none was committed | 2–3 directions, each with a written thesis |
| No references | Nothing to measure against, so the bar became "renders without errors" | Gate 2: owner-supplied references, with specifics written down |
| Graded our own screenshots | The builder sees intentions, not the result | Gate 6: a separate critic agent, with references side by side |
| Hard offset shadow on the poster cards | A costume borrowed from neobrutalism, not a depth system | One elevation system, chosen for the world |
| Mist fade from dark forest to paper | Dark plus transparency makes muddy grey | A hard edge, or a fade into a color that exists in both |
| Scene below the fold on a laptop | The first viewport was a headline in empty sky | Design the first viewport first (Gate 3 wireframe) |

**Calibration:** a fresh critic agent using `critique.md` scored round 1's Ridgeline at **4/10, "rethink"**.
It also flagged the SaaS card kit, a card inside a card on pricing, all-caps labels, two hawks in
two art styles (the painted phone header against the vector hills), a secondary CTA as loud as the
primary, 11–12px grey footnotes, and no proof of the product (no real alert shown). Treat 4/10
as the floor we've already hit; a direction worth showing the owner should reach 7.

## Defaults models converge on (from Anthropic's and Impeccable's calibration lists)
- **Looks:** a warm cream ground with a high-contrast serif and a terracotta accent; near-black with
  one neon accent and glowing edges; broadsheet hairlines with italic serif and tiny tracked mono
  labels; flat saturated ink with black boxes and hard offset shadows; the SaaS card kit
  (identical rounded cards, one radius everywhere, the same soft grey shadow, gradient washes).
- **Type:** Inter, Roboto, Arial or system as the display voice. Reflex "distinctive" picks: Fraunces,
  Playfair, Cormorant, Space Grotesk, DM Sans, Outfit, Plus Jakarta and IBM Plex. Small weight
  and size steps (400 vs 600, 1.5×). One accented word in a headline. All-caps labels.
- **Structure:** an eyebrow label above every heading; a grid of same-size cards with an icon,
  heading and text; "01 / 02 / 03" on content that isn't a sequence; the hero-metric block (big
  number, small label, stats); cards nested in cards.
- **Surface:** gradient text; glass or blur as decoration; a colored side-stripe border on cards;
  glows (zero-offset colored halos); bounce or elastic easing; the same fade-up on every section;
  grain, stripes or grid overlays with nothing under them; `→` added to every link and button;
  mid-dot meta strings ("A · B · C"); emoji or Unicode standing in for icons.
- **Copy:** vague claims ("all-in-one", "scale without limits"); labels named after the system,
  not the user's task.

Note: some of these appear in tylerflores.dev's own approved Monument design (mono labels, `→` on
the primary CTA). That design was signed off, so leave it alone, but don't carry those habits
into new work by reflex.

## What "high end" actually consists of (the inverse)
- **Real imagery** with an art direction: one subject, one light, consistent grade.
- **Type doing the work:** a confident display size, real contrast between steps, tight but legible
  tracking, short measure.
- **Space as a material:** fewer things per viewport, generous and *uneven* rhythm (a dense
  passage earns a quiet one).
- **Restraint:** one bold move per page; cut one accessory before shipping.
- **Craft in the corners:** focus rings, selection color, scrollbars, number alignment, hover
  and loading states, all themed.
- **Specific copy** in the product's own voice.
