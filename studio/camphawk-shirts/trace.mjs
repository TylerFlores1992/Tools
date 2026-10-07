import potrace from "potrace"; import { writeFileSync } from "fs";
const jobs = process.argv.slice(2);
for (const name of jobs) {
  await new Promise((res, rej) => potrace.trace(name + ".png", { turdSize: 40, optTolerance: 0.4, threshold: 128 }, (e, svg) => {
    if (e) return rej(e); writeFileSync("traced-" + name + ".svg", svg); res();
  }));
  console.log("traced", name);
}
