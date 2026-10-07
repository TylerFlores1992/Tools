import potrace from "potrace"; import sharp from "sharp"; import { writeFileSync } from "fs";
for (const [src, inches, out] of [["out2/one-ink.png", 11.5, "still-water-one-ink_back_1-forest"], ["out2/one-chest-ink.png", 3.75, "still-water-one-ink_chest_1-forest"]]) {
  const buf = await sharp(src).png().toBuffer(); const m = await sharp(buf).metadata();
  const d = await new Promise((res, rej) => potrace.trace(buf, { turdSize: 8, optTolerance: 0.3, threshold: 128 }, (e, svg) => e ? rej(e) : res(svg.match(/ d="([^"]+)"/)[1])));
  writeFileSync(`kit/${out}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${inches}in" height="${((inches * m.height) / m.width).toFixed(3)}in" viewBox="0 0 ${m.width} ${m.height}"><path fill="#24382A" fill-rule="evenodd" d="${d}"/></svg>`);
  console.log(out);
}
