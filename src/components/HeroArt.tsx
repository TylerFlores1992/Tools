import { HERO_MEDIA as MEDIA } from "@/lib/hero-media";

/**
 * The home hero art: a still image (docs/design/hero-wilderness-cyber.md).
 *
 * - The headline stays the LCP element; this is a background with explicit dimensions.
 * - Phone-shaped screens (taller than 2:3) get their own cut, composed around the wolf's face (not a crop of the wide),
 *   in the top 72% of the screen, so the headline sits on solid night below the jaw.
 * - AVIF first, WebP as the fallback; the browser picks a width from `sizes`.
 * - Motion: one 2.4 s settle (`.hero-poster`), under the 5 s that would need a pause control;
 *   none under reduced motion.
 * - No client JavaScript: the film's player is gone.
 */
export function HeroArt() {
  const set = (name: string, widths: number[], ext: string) =>
    widths.map((w) => `${MEDIA}/${name}-${w}.${ext} ${w}w`).join(", ");
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden bg-bg">
      <picture>
        <source media="(max-aspect-ratio: 2/3)" type="image/avif" sizes="100vw" srcSet={set("hero-portrait", [720, 1080], "avif")} />
        <source media="(max-aspect-ratio: 2/3)" type="image/webp" sizes="100vw" srcSet={set("hero-portrait", [720, 1080], "webp")} />
        <source type="image/avif" sizes="100vw" srcSet={set("hero", [960, 1600, 2560], "avif")} />
        <img
          src={`${MEDIA}/hero-1600.webp`}
          srcSet={set("hero", [960, 1600, 2560], "webp")}
          sizes="100vw"
          alt=""
          width={1600}
          height={900}
          fetchPriority="high"
          decoding="async"
          className="hero-poster absolute inset-0 size-full object-cover object-[50%_35%] tall:h-[72%] tall:object-[50%_20%]"
        />
      </picture>
    </div>
  );
}
