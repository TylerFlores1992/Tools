"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/Button";
import { Card } from "@/components/Card";
import { cx } from "@/components/cx";
import { SubmitButton } from "@/components/SubmitButton";
import { ActionForm, type Action } from "@/tools/recordings/ui/ActionForm";
import { genresOf, pick, runtime, votes, whyHidden, type MovieTab, type Sort } from "../format";
import type { Movie } from "../types";

const field = "min-h-11 rounded-input border border-control bg-surface px-3 text-body text-ink";
const SORTS: { key: Sort; label: string }[] = [
  { key: "score", label: "Best rated" },
  { key: "added", label: "Newest on the server" },
  { key: "year", label: "Newest release" },
];

/**
 * One tab's posters (New releases, Older films or Hidden), with its own genre filter and sort.
 * Filtering and sorting happen here in the browser; the buttons are server actions that update
 * the page in place and answer in the toast (Recordings' `ActionForm`).
 */
export function MovieGrid({ movies, tab, mark, restore }: { movies: Movie[]; tab: MovieTab; mark: Action; restore: Action }) {
  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState<Sort>("score");
  const mine = movies.filter((m) => (tab === "hidden" ? m.hidden : !m.hidden && m.recent === (tab === "new")));
  const list = pick(movies, tab, genre, sort);
  const genres = genresOf(mine);

  if (!mine.length) {
    return (
      <Card>
        <p className="text-body text-ink-2">
          {tab === "hidden" ? "Nothing hidden. Movies you watch or mark show up here, with a way to put them back." : "Nothing here right now. New arrivals that pass the settings appear within the hour."}
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <label className="grid gap-1.5 text-small text-ink-2">
          Genre
          <select value={genre} onChange={(e) => setGenre(e.target.value)} className={field}>
            <option value="">All genres</option>
            {genres.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-small text-ink-2">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={field}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <p className="pb-3 text-small text-muted tabular-nums" aria-live="polite">{list.length} of {mine.length}</p>
      </div>
      {list.length ? (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {list.map((m) => <Poster key={m.key} m={m} mark={mark} restore={restore} />)}
        </ul>
      ) : (
        <p className="mt-5 text-body text-ink-2">No {genre.toLowerCase()} movies here.</p>
      )}
    </>
  );
}

function Poster({ m, mark, restore }: { m: Movie; mark: Action; restore: Action }) {
  const small = buttonClasses("ghost", "min-h-11 w-full px-2 text-small");
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="relative aspect-[2/3] bg-surface-2">
        {m.icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- the provider's TMDB posters, not ours to optimise
          <img src={m.icon} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          <p className="grid h-full place-items-center p-4 text-center text-small text-muted">{m.title}</p>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="text-body font-medium break-words">{m.title}</h3>
        <p className="text-small text-ink-2 tabular-nums">
          <span aria-label={`IMDb rating ${m.rating.toFixed(1)} out of 10`}>★ {m.rating.toFixed(1)}</span>
          <span className="text-muted"> · {votes(m.votes)}</span>
        </p>
        <p className="text-small text-muted tabular-nums">{[m.year, runtime(m.minutes), m.is4k ? "4K" : ""].filter(Boolean).join(" · ")}</p>
        {m.genres && <p className="text-small text-muted">{m.genres.split(",").join(", ")}</p>}
        <p className="flex gap-4 text-small">
          <a href={`https://www.imdb.com/title/${m.key}/`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-ink">IMDb</a>
          {m.trailer && (
            <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(m.trailer)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-ink">Trailer</a>
          )}
        </p>
        <div className="mt-auto pt-1">
          {m.hidden ? (
            <>
              <p className="pb-1 text-small text-muted">{whyHidden(m)}</p>
              <ActionForm action={restore}>
                <input type="hidden" name="key" value={m.key} />
                <input type="hidden" name="title" value={m.title} />
                <SubmitButton variant="quiet" pending="Putting back…" className={cx("min-h-11 w-full px-2 text-small")}>Put back</SubmitButton>
              </ActionForm>
            </>
          ) : (
            <ActionForm action={mark} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="key" value={m.key} />
              <input type="hidden" name="title" value={m.title} />
              <SubmitButton variant="ghost" name="why" value="seen" pending="Saving…" className={small}>Seen it</SubmitButton>
              <SubmitButton variant="ghost" name="why" value="not interested" pending="Saving…" className={small}>Not for me</SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>
    </li>
  );
}
