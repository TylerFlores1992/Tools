import { normalize } from "./normalize.ts";

// Words that vary between charges from the same merchant, or carry no identity.
const NOISE = /\b(POS|PURCHASE|DEBIT|CREDIT|CARD|CHECKCARD|RECURRING|PAYMENT|PMT|ACH|WEB|ID|PPD|CCD|WEB ID|ONLINE|AUTH|ON|REF|TRACE|XX+\d*|DES|INDN|CO ID)\b/g;

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

