// The app icon and launch art, cut from the home hero (owner's pick "A1", 2026-10-22: the eye and
// the brow circuits, close up). Usage: node studio/app-icon/make.mjs
// Source is the 1080-wide portrait cut already on the site, so the icon always matches the hero.
import sharp from "sharp";
import { HERO_VERSION } from "../../src/lib/hero-media.ts";

const src = `public/media/hero/${HERO_VERSION}/hero-portrait-1080.webp`;
const crop = { left: 360, top: 300, width: 720, height: 720 }; // eye sits at about (0.54, 0.59)
const cut = () => sharp(src).extract(crop);

// Full-bleed squares: Android masks them to its own shape ("maskable"), iOS rounds them itself.
for (const s of [192, 512]) await cut().resize(s, s).png({ compressionLevel: 9, palette: true, quality: 92, dither: 0.6 }).toFile(`public/icons/icon-${s}.png`);
await cut().resize(180, 180).png({ compressionLevel: 9 }).toFile("src/app/apple-icon.png");
// The launch intro's art: one size, shown at up to 192 CSS px on a 3x screen.
await cut().resize(576, 576).webp({ quality: 80 }).toFile("public/icons/launch.webp");
console.log("done");
