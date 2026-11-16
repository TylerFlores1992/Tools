import type { Limit, Movie, MoviesState } from "./types.ts";

/** Top Movies' words, sorting and the settings form. Pure, so it's tested. */

export type MovieTab = "new" | "older" | "hidden";
export type Sort = "score" | "added" | "year";

export const tabOf = (m: Movie): MovieTab => (m.hidden ? "hidden" : m.recent ? "new" : "older");

export function genresOf(movies: Movie[]): string[] {
  return [...new Set(movies.flatMap((m) => m.genres.split(",").map((g) => g.trim()).filter(Boolean)))].sort();
}

export function pick(movies: Movie[], tab: MovieTab, genre: string, sort: Sort): Movie[] {
  const list = movies.filter((m) => tabOf(m) === tab && (!genre || m.genres.split(",").includes(genre)));
  const by: Record<Sort, (a: Movie, b: Movie) => number> = {
    score: (a, b) => b.score - a.score,
    added: (a, b) => b.added - a.added || b.score - a.score,
    year: (a, b) => b.year - a.year || b.score - a.score,
  };
  return [...list].sort(by[sort]);
}

/** "2h 52m", "48m"; "" when unknown. */
export const runtime = (min: number) => (min > 0 ? (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`) : "");

/** "567k votes", "3.9k votes", "850 votes". */
export function votes(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k votes`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k votes`;
  return `${n} votes`;
}

export function whyHidden(m: Movie): string {
  if (m.hidden === "watched") return `Watched (${Math.round(m.watchedPos * 100)}% in)`;
  if (m.hidden === "seen") return "You marked it seen";
  if (m.hidden === "not interested") return "You marked it not for you";
  if (m.hidden === "foreign language") return "Foreign language (Settings can show these)";
  return m.hidden;
}

export const isImdbId = (s: string) => /^tt\d{1,12}$/.test(s);

type Form = { get(k: string): FormDataEntryValue | null };

/**
 * Reads the settings form against the ranges the home server gave (`limits`). A number outside
 * its range is an error in words, not a silent clamp: the server refuses it too.
 */
export function readSettingsForm(form: Form, limits: MoviesState["limits"]): { ok: true; value: Record<string, number | boolean> } | { ok: false; message: string } {
  const value: Record<string, number | boolean> = {};
  for (const [k, l] of Object.entries(limits) as [string, Limit][]) {
    const raw = form.get(k);
    if (l.bool) { value[k] = raw === "on" || raw === "true"; continue; }
    const n = Number(String(raw ?? "").trim());
    if (raw === null || String(raw).trim() === "" || !Number.isFinite(n)) return { ok: false, message: `${l.label}: enter a number.` };
    if ((l.min !== undefined && n < l.min) || (l.max !== undefined && n > l.max)) return { ok: false, message: `${l.label} must be between ${l.min} and ${l.max}.` };
    value[k] = (l.step ?? 1) < 1 ? Math.round(n * 10) / 10 : Math.round(n);
  }
  return { ok: true, value };
}
