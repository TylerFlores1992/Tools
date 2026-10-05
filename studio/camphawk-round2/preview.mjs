// Writes small JPEG previews of generated art: node preview.mjs <outdir> <file…>
import sharp from "sharp";
import { basename } from "node:path";
const [dir, ...files] = process.argv.slice(2);
for (const f of files) {
  const m = await sharp(f).metadata();
  await sharp(f).resize(900).jpeg({ quality: 80 }).toFile(`${dir}/${basename(f).replace(/\.\w+$/, "")}.jpg`);
  console.log(basename(f), m.width, m.height);
}
