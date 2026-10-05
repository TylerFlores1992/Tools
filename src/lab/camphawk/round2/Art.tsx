// Round-2 art (public/private/camphawk/round2/, made by studio/camphawk-round2/). Plain <img>
// with a width srcset: the files sit behind the private-area sign-in, which Next's image
// optimizer can't pass. Decorative unless given alt text.

const src = (name: string, w: number) => `/private/camphawk/round2/${name}-${w}.webp`;
const srcSet = (name: string, widths: readonly number[]) => widths.map((w) => `${src(name, w)} ${w}w`).join(", ");

export const ART = {
  a1: { name: "a1-hero-wide", widths: [828, 1440, 2560], w: 2560, h: 1429 },
  a2: { name: "a2-hero-tall", widths: [828, 1170], w: 1170, h: 1755 },
  a3: { name: "a3-site-dusk", widths: [600, 1200], w: 1200, h: 1490 },
  a4: { name: "a4-cta-dusk", widths: [828, 1440, 2560], w: 2560, h: 1097 },
  b1: { name: "b1-poster-wide", widths: [828, 1440, 2560], w: 2560, h: 1664 },
  b2: { name: "b2-poster-tall", widths: [828, 1170], w: 1170, h: 1800 },
  b3: { name: "b3-watch", widths: [640], w: 640, h: 640 },
  b4: { name: "b4-pack", widths: [640], w: 640, h: 640 },
  b5: { name: "b5-map", widths: [640], w: 640, h: 640 },
  b6: { name: "b6-calendar", widths: [640], w: 640, h: 640 },
} as const;
type Piece = (typeof ART)[keyof typeof ART];

type Common = { alt?: string; className?: string; sizes?: string; eager?: boolean };

export function Art({ art, alt = "", className, sizes = "100vw", eager }: Common & { art: Piece }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src(art.name, art.widths[art.widths.length - 1])}
      srcSet={srcSet(art.name, art.widths)}
      sizes={sizes}
      width={art.w}
      height={art.h}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      draggable={false}
      className={className}
    />
  );
}

/** A wide crop above 640px and a tall one below, as one picture. */
export function ArtPair({ wide, tall, className, eager }: Common & { wide: Piece; tall: Piece }) {
  return (
    <picture className={className}>
      <source media="(min-width: 640px)" srcSet={srcSet(wide.name, wide.widths)} sizes="100vw" />
      <Art art={tall} eager={eager} />
    </picture>
  );
}
