import type { CSSProperties } from "react";
import { LQIP } from "./art-lqip";

// Round-2 art (public/private/camphawk/round2/, made by studio/camphawk-round2/). Plain <img>
// with a width srcset: the files sit behind the private-area sign-in, which Next's image
// optimizer can't pass. Decorative unless given alt text.

const src = (name: string, w: number) => `/private/camphawk/round2/${name}-${w}.webp`;
const srcSet = (name: string, widths: readonly number[]) => widths.map((w) => `${src(name, w)} ${w}w`).join(", ");

export const ART = {
  a1: { name: "a1-hero-wide", widths: [828, 1440, 2560], w: 2560, h: 1429 },
  a3: { name: "a3-phone-dusk", widths: [600, 1200], w: 1200, h: 1490 },
  a4: { name: "a4-cta-dusk", widths: [828, 1440, 2560], w: 2560, h: 1097 },
  c1: { name: "c1-loop-dusk", widths: [900, 1600], w: 1600, h: 893 },
  c2: { name: "c2-site-dusk", widths: [500, 800], w: 800, h: 800 },
  c3: { name: "c3-river-dusk", widths: [500, 800], w: 800, h: 800 },
  b1: { name: "b1-poster-wide", widths: [828, 1440, 2560], w: 2560, h: 1664 },
  b2: { name: "b2-poster-tall", widths: [828, 1170], w: 1170, h: 1800 },
  b3: { name: "b3-watch", widths: [640], w: 640, h: 640 },
  b4: { name: "b4-pack", widths: [640], w: 640, h: 640 },
  b5: { name: "b5-map", widths: [640], w: 640, h: 640 },
  b6: { name: "b6-calendar", widths: [640], w: 640, h: 640 },
  e1: { name: "e1-explore-wide", widths: [828, 1440, 2560], w: 2560, h: 962 },
  e2: { name: "e2-map", widths: [828, 1280], w: 1280, h: 731 },
  n1: { name: "n1-newwatch-wide", widths: [828, 1440, 2560], w: 2560, h: 1097 },
  w1: { name: "w1-watches-wide", widths: [828, 1440, 2560], w: 2560, h: 1097 },
  m1: { name: "m1-coast-wide", widths: [828, 1440, 2560], w: 2560, h: 1097 },
  p1: { name: "p1-pricing-wide", widths: [828, 1440, 2560], w: 2560, h: 1097 },
  v1: { name: "v1-fork-wide", widths: [828, 1440, 2560], w: 2560, h: 1097 },
  s1: { name: "s1-ranger-wide", widths: [828, 1440, 2560], w: 2560, h: 1097 },
  // Round 6: cut from earlier unused generations (no new images), for pages that had a plain band.
  k1: { name: "k1-halfdome-wide", widths: [828, 1440, 2048], w: 2048, h: 878 },
  g1: { name: "g1-sitepost-wide", widths: [828, 1440, 2048], w: 2048, h: 878 },
  r1: { name: "r1-sierra-wide", widths: [828, 1440, 1664], w: 1664, h: 713 },
  t1: { name: "t1-tent-wide", widths: [828, 1440, 1856], w: 1856, h: 796 },
} as const;
export type Piece = (typeof ART)[keyof typeof ART];

type Common = { alt?: string; className?: string; sizes?: string; eager?: boolean; style?: CSSProperties };

export function Art({ art, alt = "", className, sizes = "100vw", eager, style }: Common & { art: Piece }) {
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
      style={placeholder(art.name, style)}
    />
  );
}

/** The blurred copy sits behind the photo until it paints over it. */
const placeholder = (name: string, style?: CSSProperties): CSSProperties | undefined =>
  LQIP[name] ? { backgroundImage: `url(${LQIP[name]})`, backgroundSize: "cover", backgroundPosition: "center", ...style } : style;

/** A wide crop from `at` px up (default 640) and a tall one below, as one picture. */
export function ArtPair({ wide, tall, className, eager, at = 640 }: Common & { wide: Piece; tall: Piece; at?: number }) {
  return (
    <picture className={className}>
      <source media={`(min-width: ${at}px)`} srcSet={srcSet(wide.name, wide.widths)} sizes="100vw" />
      <Art art={tall} eager={eager} />
    </picture>
  );
}
