import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };

const dir = join(process.cwd(), "src", "og");
const assets = Promise.all([
  readFile(join(dir, "MonaSans-400.woff")),
  readFile(join(dir, "MonaSans-500.woff")),
  readFile(join(dir, "og-bg.jpg")),
]);

/** One look for every share image: the hero still, a scrim, an eyebrow and a title. */
export async function ogImage({ eyebrow, title, accent }: { eyebrow: string; title: string; accent?: string }) {
  const [regular, medium, bg] = await assets;
  const bgSrc = `data:image/jpeg;base64,${bg.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#05070e", fontFamily: "Mona Sans" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bgSrc} width={1200} height={630} alt="" style={{ position: "absolute", inset: 0, objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(90deg, rgba(5,7,14,0.92) 0%, rgba(5,7,14,0.7) 45%, rgba(5,7,14,0.1) 75%)" }} />
        <div style={{ position: "absolute", left: 72, top: 64, display: "flex", alignItems: "center", gap: 14, color: "#f3f5fa", fontSize: 26, fontWeight: 500 }}>
          <div style={{ width: 12, height: 12, background: "#ffb27a", transform: "rotate(45deg)", borderRadius: 2 }} />
          {SITE.name}
        </div>
        <div style={{ position: "absolute", left: 72, bottom: 72, display: "flex", flexDirection: "column", maxWidth: 680 }}>
          <div style={{ color: "#c2c9d8", fontSize: 22, letterSpacing: 4, textTransform: "uppercase" }}>{eyebrow}</div>
          <div style={{ color: "#f3f5fa", fontSize: 84, lineHeight: 0.98, letterSpacing: -3, marginTop: 18 }}>{title}</div>
          {accent && <div style={{ color: "#ffb27a", fontSize: 84, lineHeight: 0.98, letterSpacing: -3 }}>{accent}</div>}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Mona Sans", data: regular, weight: 400, style: "normal" },
        { name: "Mona Sans", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
