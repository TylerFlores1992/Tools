// Print kit for Still Water with the camp: traces camp.py's separations (300 dpi) into one vector SVG per ink,
// sized in inches, plus the combined file and the 300 dpi PNGs. Same tracer settings as kit.mjs.
import potrace from "potrace"; import sharp from "sharp"; import { writeFileSync, copyFileSync } from "fs";
const jobs = [
  ["one", "still-water-one-ink_back", [["forest", "#24382A"]]],
  ["three", "still-water_back", [["forest", "#2A3B2E"], ["moss", "#4E5C3B"], ["mist", "#E2E6DC"]]],
];
for (const [src, out, inks] of jobs) {
  const all = [];
  for (let i = 0; i < inks.length; i++) {
    const [name, hex] = inks[i], file = `out2/camp-${src}-sep${i + 1}.png`;
    const m = await sharp(file).metadata(), inches = 11.5;
    const d = await new Promise((res, rej) => potrace.trace(file, { turdSize: 8, optTolerance: 0.3, threshold: 128 }, (e, svg) => e ? rej(e) : res(svg.match(/ d="([^"]+)"/)?.[1] ?? "")));
    const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${inches}in" height="${((inches * m.height) / m.width).toFixed(3)}in" viewBox="0 0 ${m.width} ${m.height}">${body}</svg>`;
    writeFileSync(`kit/${out}_${i + 1}-${name}.svg`, svg(`<path fill="${hex}" fill-rule="evenodd" d="${d}"/>`));
    all.push(`<path fill="${hex}" fill-rule="evenodd" d="${d}"/>`);
    if (inks.length > 1 && i === inks.length - 1) writeFileSync(`kit/${out}_all-inks.svg`, svg(all.join("")));
    console.log(out, name);
  }
  copyFileSync(`out2/camp-${src}.png`, `kit/${out}_300dpi.png`);
}
