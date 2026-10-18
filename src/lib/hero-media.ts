/**
 * Where the home hero art lives. The folder is named after a hash of its files, so a new render
 * gets a new URL and the files can be cached forever (`next.config.ts` sends `immutable`).
 * After re-encoding (`studio/hero-wilderness/encode.mjs`), `src/lib/hero-media.test.mts` fails and prints the new folder name: rename
 * the folder in `public/media/hero/` and update HERO_VERSION.
 */
export const HERO_VERSION = "6bfd286dfc";
export const HERO_MEDIA = `/media/hero/${HERO_VERSION}`;
