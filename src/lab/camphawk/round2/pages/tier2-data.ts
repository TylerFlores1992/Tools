import { DATA_SOURCES } from "./sources-data";

// Facts the Tier 2 pages quote, from CampHawk's own constants (campsite-finder
// src/lib/openings-stat.ts, src/lib/limits.ts, src/lib/data-sources.ts). Counts come from data, so
// the pages can't disagree with each other the way CampHawk's do ("ten", "twelve", "fourteen").

/** The measured openings rate, quoted on the guides. */
export const OPENINGS_STAT = { campgrounds: 502, checks: 125_118, openings: 1_100, from: "July 22", to: "September 4, 2026" } as const;
export const openingsPercent = () => `${((100 * OPENINGS_STAT.openings) / OPENINGS_STAT.checks).toFixed(1)}%`;

export const TRIAL_DAYS = 7;
export const CHECK_SECONDS = 15;
export const HOLD_MINUTES = 60;

/** The ReserveCalifornia hold beta closed to the public on Sep 22, 2026 (RC_HOLD_BETA_OPEN = false). */
export const RC_HOLD_OPEN = false;
export const RC_HOLD_CLOSED_ON = "September 22, 2026";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
export const inWords = (n: number) => WORDS[n] ?? n.toLocaleString("en-US");

/** Reservation systems CampHawk reads, one per data source. */
export const SOURCE_COUNT = DATA_SOURCES.length;
