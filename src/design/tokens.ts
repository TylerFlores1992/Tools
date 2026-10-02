// What each colour token MEANS, and every pair the UI is allowed to use.
// src/design/contrast.test.mts checks each pair against both themes' values in globals.css,
// and /lab renders this list. Add a pair here before using a new combination.

export const COLOR_TOKENS = [
  { name: "bg", meaning: "The page." },
  { name: "surface", meaning: "Cards and panels." },
  { name: "surface-2", meaning: "Raised panels, hover fills, table headers." },
  { name: "line", meaning: "Decorative hairlines and dividers. Never the only edge of a control." },
  { name: "line-2", meaning: "Stronger hairlines. Still decorative." },
  { name: "control", meaning: "Edges of inputs, checkboxes and toggles (3:1 against their surface)." },
  { name: "ink", meaning: "Primary text." },
  { name: "ink-2", meaning: "Secondary text and ledes." },
  { name: "muted", meaning: "Labels and metadata. Still AA for body-size text." },
  { name: "ember", meaning: "The wolf's eye: brand moments, one highlight per screen, focus rings. Never status." },
  { name: "ice", meaning: "Correct, done, working. Always with ✓. Series 1 (solid) in diagrams." },
  { name: "wrong", meaning: "Wrong or invalid. Always with ✕ and a word." },
  { name: "series-2", meaning: "Second series in diagrams. Always drawn dashed." },
  { name: "primary", meaning: "Fill of the one main action on a screen." },
  { name: "on-primary", meaning: "Text on primary." },
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number]["name"];

/** min: 4.5 body text · 3 large text (24px+, or 18.66px bold) and UI component edges. */
export const CONTRAST_PAIRS: { fg: ColorToken; bg: ColorToken; min: number; use: string }[] = [
  { fg: "ink", bg: "bg", min: 4.5, use: "body text" },
  { fg: "ink", bg: "surface", min: 4.5, use: "text in cards" },
  { fg: "ink", bg: "surface-2", min: 4.5, use: "text on raised panels" },
  { fg: "ink-2", bg: "bg", min: 4.5, use: "ledes" },
  { fg: "ink-2", bg: "surface", min: 4.5, use: "secondary text in cards" },
  { fg: "ink-2", bg: "surface-2", min: 4.5, use: "secondary text on raised panels" },
  { fg: "muted", bg: "bg", min: 4.5, use: "labels" },
  { fg: "muted", bg: "surface", min: 4.5, use: "labels in cards" },
  { fg: "muted", bg: "surface-2", min: 4.5, use: "labels on raised panels" },
  { fg: "ember", bg: "bg", min: 4.5, use: "highlight text, focus ring" },
  { fg: "ember", bg: "surface", min: 4.5, use: "highlight in cards" },
  { fg: "ice", bg: "bg", min: 4.5, use: "correct / done text" },
  { fg: "ice", bg: "surface", min: 4.5, use: "correct / done in cards" },
  { fg: "wrong", bg: "bg", min: 4.5, use: "error text" },
  { fg: "wrong", bg: "surface", min: 4.5, use: "error text in cards" },
  { fg: "series-2", bg: "surface", min: 3, use: "second diagram series (non-text)" },
  { fg: "on-primary", bg: "primary", min: 4.5, use: "main button label" },
  { fg: "on-primary", bg: "ink-2", min: 4.5, use: "main button label on hover" },
  { fg: "control", bg: "bg", min: 3, use: "input edge on the page" },
  { fg: "control", bg: "surface", min: 3, use: "input edge in a card" },
];

/**
 * States a colour-blind visitor must still tell apart, as seen through deuteranopia and
 * protanopia (the owner is red-green colour-blind). Colour is never the only signal — every
 * one of these also carries an icon and a word — but they must not collapse into one hue.
 */
export const DISTINCT_PAIRS: { a: ColorToken; b: ColorToken; why: string }[] = [
  { a: "ice", b: "ember", why: "correct vs brand highlight" },
  { a: "ice", b: "wrong", why: "correct vs wrong" },
  { a: "wrong", b: "ember", why: "wrong vs brand highlight" },
  { a: "ice", b: "series-2", why: "diagram series 1 vs 2" },
];
