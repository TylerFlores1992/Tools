// Campground names as CampHawk shows them: ported unchanged from campsite-finder
// src/components/v2/campground-name.ts (`tidyCase`), so the lab and camphawk.app read the same.
// RIDB writes a third of its names in capitals ("WARD MTN. CAMPGROUND (MURRAY SUMMIT)"); a name
// that already has a lowercase letter was cased by a person and is left alone.

const WORD_CHARS = "A-Za-z0-9#'’/-";
const SEPARATOR = new RegExp(`^[^${WORD_CHARS}]+$`);
const SPLIT_WORDS = new RegExp(`([^${WORD_CHARS}]+)`);

const KEEP_UPPER = new Set([
  "SP", "SB", "SRA", "SHP", "SNA", "SF", "NF", "NP", "NM", "NRA", "NWR", "WMA",
  "BLM", "USFS", "USACE", "COE", "KOA", "RV", "ATV", "OHV", "ADA", "US", "USA",
  "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI",
  "NE", "NW", "SE", "SW",
]);
const MINOR = new Set(["of", "the", "and", "at", "on", "in", "to", "for", "a", "an", "by"]);
const STATE_CODE = /^[A-Z]{2}$/;

function titleCaseWord(word: string, index: number, inParens: boolean): string {
  if (!word) return word;
  if (/\d/.test(word)) return word;
  const bare = word.replace(/[^A-Za-z]/g, "");
  if (KEEP_UPPER.has(bare)) return word;
  if (inParens && STATE_CODE.test(bare)) return word;
  const lower = word.toLowerCase();
  if (index > 0 && MINOR.has(lower)) return lower;
  return lower.replace(/(^|[-/'’])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function tidyCase(name: string): string {
  if (!name) return name;
  if (/[a-z]/.test(name)) return name;
  let wordIndex = 0;
  let depth = 0;
  let out = "";
  for (const tok of name.split(SPLIT_WORDS)) {
    if (!tok) continue;
    if (SEPARATOR.test(tok)) {
      depth += (tok.match(/\(/g) ?? []).length - (tok.match(/\)/g) ?? []).length;
      if (depth < 0) depth = 0;
      out += tok;
      continue;
    }
    out += titleCaseWord(tok, wordIndex, depth > 0);
    wordIndex++;
  }
  return out;
}
