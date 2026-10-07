// Print kit: each ink separation (from the 300 dpi renders) traced to a one-colour vector SVG sized in inches.
import potrace from "potrace"; import sharp from "sharp"; import { writeFileSync, readdirSync } from "fs";
const jobs = [
  ["night-watch-print", 11.5, [["bone", "#EAE0C8"]], "night-watch_back"],
  ["night-watch-chest-print", 3.75, [["bone", "#EAE0C8"]], "night-watch_chest"],
  ["still-water-print", 11.5, [["forest", "#2A3B2E"], ["moss", "#4E5C3B"], ["mist", "#E2E6DC"]], "still-water_back"],
  ["still-water-chest-print", 3.75, [["forest", "#2A3B2E"]], "still-water_chest"],
];
for (const [src, inches, inks, out] of jobs) {
  const all = [];
  for (let i = 0; i < inks.length; i++) {
    const [name, hex] = inks[i];
    // sep PNG: white = ink → invert so potrace traces the ink
    const buf = await sharp(`out2/${src}-sep${i + 1}.png`).negate().png().toBuffer();
    const meta = await sharp(buf).metadata();
    const d = await new Promise((res, rej) => potrace.trace(buf, { turdSize: 8, optTolerance: 0.3, threshold: 128, color: hex }, (e, svg) => e ? rej(e) : res(svg.match(/ d="([^"]+)"/)?.[1] ?? "")));
    const hIn = (inches * meta.height) / meta.width;
    const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${inches}in" height="${hIn.toFixed(3)}in" viewBox="0 0 ${meta.width} ${meta.height}">${body}</svg>`;
    writeFileSync(`kit/${out}_${i + 1}-${name}.svg`, svg(`<path fill="${hex}" fill-rule="evenodd" d="${d}"/>`));
    all.push([hex, d]); console.log(out, name);
    if (i === inks.length - 1) writeFileSync(`kit/${out}_all-inks.svg`, svg(all.map(([h, dd]) => `<path fill="${h}" fill-rule="evenodd" d="${dd}"/>`).join("")));
  }
}
