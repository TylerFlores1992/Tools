import { HERO_MEDIA as MEDIA } from "@/lib/hero-media";

/**
 * The home hero art: a still image with one slow drift (docs/design/hero-wilderness-cyber.md).
 *
 * - The headline stays the LCP element; this is a background with explicit dimensions.
 * - Portrait screens get their own cut, composed around the wolf's face (not a crop of the wide).
 * - AVIF first, WebP as the fallback; the browser picks a width from `sizes`.
 * - Motion is CSS only (`.hero-drift`), and none at all under reduced motion.
 * - No client JavaScript: the film's player is gone.
 */
export function HeroArt() {
  const set = (name: string, widths: number[], ext: string) =>
    widths.map((w) => `${MEDIA}/${name}-${w}.${ext} ${w}w`).join(", ");
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden bg-bg">
      <picture>
        <source media="(orientation: portrait)" type="image/avif" sizes="100vw" srcSet={set("hero-portrait", [720, 1080], "avif")} />
        <source media="(orientation: portrait)" type="image/webp" sizes="100vw" srcSet={set("hero-portrait", [720, 1080], "webp")} />
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
          className="hero-poster hero-drift absolute inset-0 size-full object-cover object-[50%_35%] portrait:object-[72%_35%]"
        />
      </picture>
    </div>
  );
}
