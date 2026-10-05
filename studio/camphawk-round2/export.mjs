// Exports the picked round-2 art to public/private/camphawk/round2/ as WebP.
// Usage: node studio/camphawk-round2/export.mjs   (picks are listed below)
// Recraft tops out at 1280px on free credit; posters are upscaled with Lanczos (flat print art holds up).
import sharp from "sharp";

const OUT = "public/private/camphawk/round2/";
const SRC = "studio/camphawk-round2/out/";
const PICKS = [
  ["a1-hero-wide", "a1-hero-wide-bfl_flux_pro_1_1_ultra-1.png", [2560, 1440, 828]],
  ["a2-hero-tall", "a2-hero-tall-bfl_flux_pro_1_1_ultra-1.jpeg", [1170, 828]],
  ["a3-site-post", "a3-site-post-bfl_flux_pro_1_1_ultra-3.jpeg", [1200, 600]],
  ["a4-cta-morning", "a4-cta-morning-bfl_flux_pro_1_1_ultra-1.jpeg", [2560, 1440, 828]],
  ["b1-poster-wide", "b1-poster-wide-recraft_recraft_v4_1-5.webp", [2560, 1440, 828]],
  ["b2-poster-tall", "b2-poster-tall-recraft_recraft_v4_1-1.webp", [1170, 828]],
  ["b3-watch", "b3-watch-recraft_recraft_v4_1-1.webp", [640]],
  ["b4-pack", "b4-pack-recraft_recraft_v4_1-1.webp", [640]],
  ["b5-map", "b5-map-recraft_recraft_v4_1-1.webp", [640]],
  ["b6-calendar", "b6-calendar-recraft_recraft_v4_1-1.webp", [640]],
];

// Vignettes are painted on cream: key that cream out to transparency (soft edge), so they sit on
// any paper without a visible square.
async function keyed(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => (y * info.width + x) * 4;
  const bg = [0, 1, 2].map((c) => [at(4, 4), at(info.width - 5, 4), at(4, info.height - 5), at(info.width - 5, info.height - 5)].reduce((t, i) => t + data[i + c], 0) / 4);
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.max(...[0, 1, 2].map((c) => Math.abs(data[i + c] - bg[c])));
    data[i + 3] = d <= 10 ? 0 : d >= 26 ? 255 : Math.round(((d - 10) / 16) * 255);
  }
  return sharp(data, { raw: info });
}

for (const [name, file, widths] of PICKS) {
  const vignette = /^b[3-6]-/.test(name);
  for (const w of widths) {
    const info = await (vignette ? await keyed(SRC + file) : sharp(SRC + file))
      .resize({ width: w, kernel: "lanczos3" })
      .sharpen(w > 1280 && file.endsWith(".webp") ? { sigma: 0.6 } : undefined)
      .webp({ quality: name.startsWith("b") ? 82 : 78, alphaQuality: 90 })
      .toFile(`${OUT}${name}-${w}.webp`);
    console.log(`${name}-${w}.webp ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)} KB`);
  }
}
