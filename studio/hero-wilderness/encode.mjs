// Encodes the chosen hero art for the site (docs/design/hero-wilderness-cyber.md §5).
// Usage: node studio/hero-wilderness/encode.mjs <master.jpg> <outdir>
// Wide cuts keep the whole frame; the portrait cut is composed around the wolf's eye for phones.
// Then move <outdir> into public/media/hero/ and run the hero-media test for the folder name.
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const [master, outdir] = process.argv.slice(2);
if (!master || !outdir) throw new Error("usage: encode.mjs <master.jpg> <outdir>");
await mkdir(outdir, { recursive: true });

const meta = await sharp(master).metadata();
// Portrait: full height, 9:16 wide, from just behind the nose, so the muzzle, eye and brow circuits stay in.
const pw = Math.round((meta.height * 9) / 16);
const portrait = { left: Math.min(meta.width - pw, Math.round(meta.width * 0.423)), top: 0, width: pw, height: meta.height };

const cuts = [
  ...[960, 1600, 2560].map((w) => ({ name: `hero-${w}`, width: w })),
  ...[720, 1080].map((w) => ({ name: `hero-portrait-${w}`, width: w, extract: portrait })),
];
for (const c of cuts) {
  const base = () => (c.extract ? sharp(master).extract(c.extract) : sharp(master)).resize({ width: c.width });
  const avif = await base().avif({ quality: 50, effort: 6 }).toFile(`${outdir}/${c.name}.avif`);
  const webp = await base().webp({ quality: 74 }).toFile(`${outdir}/${c.name}.webp`);
  console.log(`${c.name}: ${avif.width}x${avif.height}  avif ${Math.round(avif.size / 1024)} KB  webp ${Math.round(webp.size / 1024)} KB`);
}
