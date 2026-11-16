/**
 * Top Movies (2026-11-15): what the movie-picks service at home answers (Xtreamfilter
 * `scripts/movie-picks.js`, `GET /api/movies/state`). Well-rated movies new to the IPTV server,
 * shown on the TVs as "★ Top Rated New" and "★ Top Rated Older Films".
 */

export type Movie = {
  /** IMDb id ("tt…"): the key for marks. */
  key: string;
  title: string;
  year: number;
  /** IMDb rating, 1–10. */
  rating: number;
  votes: number;
  /** IMDb genres, comma-separated ("Action,Drama"); may be empty. */
  genres: string;
  /** Runtime in minutes; 0 = unknown. */
  minutes: number;
  /** Released within the "new releases" window (★ Top Rated New), else ★ Top Rated Older Films. */
  recent: boolean;
  foreign: boolean;
  score: number;
  /** When the film first appeared on the server (Unix seconds). */
  added: number;
  /** Poster URL from the provider (TMDB), or "". */
  icon: string;
  /** YouTube video id, or "". */
  trailer: string;
  is4k: boolean;
  /** How far into the film a play got, 0–1. */
  watchedPos: number;
  /** Why it's off the shelves: "watched", "seen", "not interested", "foreign language"; "" = on them. */
  hidden: string;
};

export type MovieSettings = {
  days: number;
  minRating: number;
  minVotes: number;
  newYears: number;
  watchedPct: number;
  showForeign: boolean;
  /** Derived: films from this year on count as new releases. */
  newSinceYear: number;
};

export type Limit = { label: string; min?: number; max?: number; step?: number; bool?: boolean };

export type MoviesState = {
  builtAt?: string;
  settings: MovieSettings;
  limits: Record<keyof Omit<MovieSettings, "newSinceYear">, Limit>;
  movies: Movie[];
};
