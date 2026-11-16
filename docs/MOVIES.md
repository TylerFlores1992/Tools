# Top Movies

`/private/movies` shows well-rated movies new to the home IPTV server that nobody has watched yet,
and controls what makes the list. Built 2026-11-15. The same movies are on every TV as
**★ Top Rated New** and **★ Top Rated Older Films**.

## What it does
- **New releases / Older films:** posters with the IMDb rating, votes, year, runtime, genres and
  IMDb/trailer links. Filter by genre; sort by best rated, newest on the server or newest release.
- **Seen it / Not for me:** takes a movie off the list and off the TV shelves, with Undo in the toast.
- **Hidden:** what was watched (played past the "watched" point), marked, or left out as foreign
  language, each with **Put back**.
- **Settings:** minimum IMDb rating and votes, how long a movie counts as new to the server, how
  many years count as "new releases", the watched point, and foreign-language movies on or off.
  The ranges come from the home server, which refuses anything outside them too.

## How it reaches home
Through the same key-locked Tailscale Funnel entrance as Recordings (`DVR_URL`, `DVR_TOKEN`; see
`docs/RECORDINGS.md`). The recorder's locked listener passes `/api/movies/…` (state, mark,
settings) on to the movie-picks service at home; nothing else of it is reachable. Calls are made
from the server (`movies()` in `src/lib/recordings/dvr.ts`), and every action re-checks the
Private session.

The home side lives in the Xtreamfilter project: `scripts/movie-picks.js` (IMDb datasets,
matching, the shelves), `scripts/dvr-api.js` (the entrance), and HANDOFF "Top Movies".

## Code
- `src/app/private/movies/`: page, actions, loading.
- `src/tools/movies/`: types, sorting/words/settings form (`format.ts`, tested in
  `movies.test.mts`), `ui/MovieGrid.tsx` (posters, filters), `ui/MoviesShell.tsx`.
- Shared with Recordings: `Tabs`, `ActionForm`, `Toaster` (its `restore` Undo is Top Movies').
