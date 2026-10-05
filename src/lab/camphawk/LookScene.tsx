import { getImageProps } from "next/image";
import type { Look } from "./looks";

/**
 * A look's art as a picture: the phone crop below 640px, the desktop crop above. Unoptimized
 * on purpose: the files sit behind the private-area sign-in, which Next's image optimizer
 * can't pass. Purely decorative.
 */
export function LookPicture({ look, className, eager }: { look: Look; className?: string; eager?: boolean }) {
  if (!look.art) return null;
  // No preload: a <link> would fetch the phone crop on desktop too.
  const common = { alt: "", unoptimized: true, sizes: "100vw", loading: eager ? "eager" : "lazy", fetchPriority: eager ? "high" : "auto" } as const;
  const { props: { src: desktop } } = getImageProps({ ...common, src: look.art.desktop, width: 2400, height: 1100 });
  const { props: phone } = getImageProps({ ...common, src: look.art.phone, width: 1080, height: 1500 });
  return (
    <picture className={className}>
      <source media="(min-width: 640px)" srcSet={desktop} />
      <img {...phone} alt="" draggable={false} />
    </picture>
  );
}

/** The scene under the hero: full-bleed, tucked up behind the headline and under the cards. */
export function LookScene({ look }: { look: Look }) {
  if (!look.art || look.id === "topo") return null;
  return <LookPicture look={look} eager className="look-scene" />;
}
