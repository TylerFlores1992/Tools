import type { Visitor } from "./data";
import type { Look } from "./looks";
import { LookPicture } from "./LookScene";

// "current": ported from campsite-finder src/components/v2/BrandBackdrop.tsx ("camp" art). A
// fixed paper ground; from sm up, the painted scene under a 45% paper scrim, a top wash and a
// bottom fade. Off on phones and in the app.
// New looks: paper with a fine grain; "topo" lays its map behind the whole page. The other
// looks draw their scene in the page itself (LookScene).
export function Backdrop({ visitor, look }: { visitor: Visitor; look: Look }) {
  if (look.id !== "current") {
    return (
      <div aria-hidden="true" className="look-grain pointer-events-none fixed inset-0 -z-10 bg-ch-paper">
        {look.id === "topo" && <LookPicture look={look} eager className="look-map" />}
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-ch-paper">
      {visitor !== "app" && (
        <div className="hidden sm:block">
          <div className="absolute inset-0 bg-cover bg-no-repeat" style={{ backgroundImage: "url('/private/camphawk/hero-bg.webp')", backgroundPosition: "center 22%" }} />
          <div className="absolute inset-0 bg-ch-paper/45" />
          <div className="absolute inset-x-0 top-0 h-[240px] bg-linear-to-b from-ch-paper/92 to-ch-paper/0" />
          <div className="absolute inset-x-0 bottom-0 h-[45%] bg-linear-to-b from-ch-paper/0 to-ch-paper/95" />
        </div>
      )}
    </div>
  );
}
