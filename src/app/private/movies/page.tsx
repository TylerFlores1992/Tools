import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { SubmitButton } from "@/components/SubmitButton";
import { requirePrivate } from "@/lib/money/guard";
import { movies } from "@/lib/recordings/dvr";
import { tabOf, type MovieTab } from "@/tools/movies/format";
import type { MoviesState } from "@/tools/movies/types";
import { MovieGrid } from "@/tools/movies/ui/MovieGrid";
import { MoviesShell } from "@/tools/movies/ui/MoviesShell";
import { clock, shortDate } from "@/tools/recordings/format";
import { ActionForm } from "@/tools/recordings/ui/ActionForm";
import { Tabs } from "@/tools/recordings/ui/Tabs";
import { Toaster } from "@/tools/recordings/ui/Toaster";
import { markMovie, restoreMovie, saveMovieSettings } from "./actions";

export const metadata: Metadata = {
  title: "Top Movies",
  description: "Well-rated movies new to the IPTV server that you haven't watched yet.",
  robots: { index: false, follow: false },
};

type Tab = MovieTab | "settings";
const TABS: readonly Tab[] = ["new", "older", "hidden", "settings"];
const TAB_LABEL: Record<Tab, string> = { new: "New releases", older: "Older films", hidden: "Hidden", settings: "Settings" };
const field = "min-h-11 w-40 rounded-input border border-control bg-surface px-3 text-body text-ink tabular-nums";

export default async function TopMovies({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePrivate("/private/movies");
  const sp = await searchParams;
  const r = await movies<MoviesState>("state");

  if (!r.ok) {
    return (
      <MoviesShell>
        <h1 className="text-title font-normal">Top Movies</h1>
        <Card className="mt-8 max-w-[640px]">
          {r.reason === "not-configured" ? (
            <State kind="note">Top Movies isn&rsquo;t connected to the home server yet. It uses the same connection as Recordings (<code className="font-mono">docs/MOVIES.md</code>).</State>
          ) : (
            <State kind="wrong">{r.message}</State>
          )}
        </Card>
      </MoviesShell>
    );
  }

  const s = r.data;
  const count = (t: MovieTab) => s.movies.filter((m) => tabOf(m) === t).length;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "new";
  const built = s.builtAt ? Date.parse(s.builtAt) : 0;

  return (
    <MoviesShell>
      <div className="max-w-[680px]">
        <Label rule>Home TV</Label>
        <h1 className="mt-3 text-title font-normal">Top Movies</h1>
        <p className="mt-3 text-lede text-ink-2">
          Well-rated movies new to the server that you haven&rsquo;t watched yet. They&rsquo;re on every TV too, under ★ Top Rated New and ★ Top Rated Older Films.
        </p>
      </div>

      <Toaster restore={restoreMovie}>
        <Tabs
          label="Top Movies"
          tabs={TABS.map((t) => ({ key: t, label: TAB_LABEL[t], count: t === "settings" ? 0 : count(t) }))}
          initial={tab}
          fallback="new"
          panels={{
            new: <MovieGrid movies={s.movies} tab="new" mark={markMovie} restore={restoreMovie} />,
            older: <MovieGrid movies={s.movies} tab="older" mark={markMovie} restore={restoreMovie} />,
            hidden: <MovieGrid movies={s.movies} tab="hidden" mark={markMovie} restore={restoreMovie} />,
            settings: <Settings s={s} />,
          }}
        />
      </Toaster>

      <p className="mt-10 max-w-[72ch] text-small text-muted">
        Ratings come from IMDb. A movie counts as new when it first shows up on the server; copies the provider re-adds to another category don&rsquo;t count.
        {built > 0 && ` Updated ${shortDate(built)}, ${clock(built)}.`}
      </p>
    </MoviesShell>
  );
}

function Settings({ s }: { s: MoviesState }) {
  const v = s.settings, L = s.limits;
  return (
    <Card className="max-w-[640px]">
      <h2 className="text-h3 font-medium">What makes the list</h2>
      <p className="mt-2 text-small text-ink-2">Changes apply here and on the TV shelves as soon as you save.</p>
      <ActionForm action={saveMovieSettings} className="mt-6 grid gap-6">
        <Num name="minRating" label="Minimum IMDb rating" value={v.minRating} l={L.minRating} help="Movies rated below this are left out." />
        <Num name="minVotes" label="Minimum IMDb votes" value={v.minVotes} l={L.minVotes} help="Keeps out movies only a handful of people have rated, whose scores aren't settled yet." />
        <Num name="days" label="New to the server within (days)" value={v.days} l={L.days} help="How long a movie stays on the list after it first shows up on the server." />
        <Num name="newYears" label="New releases cover the last (years)" value={v.newYears} l={L.newYears} help={`Right now: movies from ${v.newSinceYear} on are New releases, older ones are Older films.`} />
        <Num name="watchedPct" label="Counts as watched after (%)" value={v.watchedPct} l={L.watchedPct} help="How far into a movie you get before it leaves the list." />
        <label className="flex min-h-11 items-center gap-3 text-body text-ink">
          <input type="checkbox" name="showForeign" defaultChecked={v.showForeign} className="size-5 accent-ink" />
          Show foreign-language movies
        </label>
        <div>
          <SubmitButton pending="Saving…">Save settings</SubmitButton>
        </div>
      </ActionForm>
    </Card>
  );
}

function Num({ name, label, value, l, help }: { name: string; label: string; value: number; l: { min?: number; max?: number; step?: number }; help: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-small text-ink-2">
      <span className="text-body text-ink">{label}</span>
      <input type="number" name={name} defaultValue={value} min={l.min} max={l.max} step={l.step && l.step < 1 ? l.step : 1} required inputMode="decimal" className={field} />
      <span className="max-w-[60ch]">{help}</span>
    </label>
  );
}
