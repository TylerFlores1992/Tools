/** Upper case, single spaces: the form every match is made in. */
export function normalize(s: string): string {
  return s.toUpperCase().replace(/\s+/g, " ").trim();
}
