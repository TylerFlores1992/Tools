import { normalize } from "./normalize.ts";

// Words that vary between charges from the same merchant, or carry no identity.
const NOISE = /\b(POS|PURCHASE|DEBIT|CREDIT|CARD|CHECKCARD|RECURRING|PAYMENT|PMT|ACH|WEB|ID|PPD|CCD|WEB ID|ONLINE|AUTH|ON|REF|TRACE|XX+\d*|DES|INDN|CO ID|AUTHORIZED|PREAUTHORIZED|ELECTRONIC|WITHDRAWAL|AUTOPAY)\b/g;

/** The grouping key: letters only, noise removed, first four words. */
export function merchantKey(description: string): string {
  return normalize(description)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/[^A-Z&' ]+/g, " ")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, 4)
    .join(" ");
}


const SMALL_WORDS = new Set(["of", "and", "the", "to", "for", "a", "an", "at", "by", "in", "on"]);

/**
 * A readable name from a raw bank description, for lists: "WEB AUTHORIZED PMT Valon" → "Valon",
 * "SPOTIFY USA 8775778" → "Spotify USA", "Spectrum 855-707-7328 MO" → "Spectrum". Only the bank's
 * own wording goes: transfer and payment words, ID numbers, phone numbers and the state after them.
 */
export function displayName(description: string): string {
  const hadPhone = /\b\d{3}[-.]\d{3}[-.]\d{4}\b/.test(description);
  let s = description
    .replace(/\b(WEB AUTHORIZED PMT|ELECTRONIC WITHDRAWAL|WEB ONLINE|ONLINE PMT|ACH (DEBIT|PMT)|POS (DEBIT|PURCHASE)|RECURRING PAYMENT|PREAUTHORIZED DEBIT)\b/gi, " ")
    .replace(/\b(PPD|CCD|WEB)\s*ID:?\s*\S*/gi, " ")
    .replace(/\b\d{3}[-.]\d{3}[-.]\d{4}\b/g, " ")
    .replace(/[#*]\s*\d*/g, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (hadPhone) s = s.replace(/\s+[A-Z]{2}$/i, "");
  s = s.replace(/\s*(\.\.\.|…)$/, "").replace(/[\s:.-]+$/, "");
  if (!s) return description.trim();
  if (s !== s.toUpperCase()) return s;
  return s.split(" ").map((w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : /^(USA|LLC|INC|US|ATM)$/.test(w) || w.includes("&") || (w.length <= 3 && /\./.test(w) === false && !/[AEIOU]/.test(w)) ? w : w[0] + w.slice(1).toLowerCase())).join(" ");
}
