"use server";

import { refresh } from "next/cache";
import { requirePrivate } from "@/lib/money/guard";
import { movies } from "@/lib/recordings/dvr";
import { isImdbId, readSettingsForm } from "@/tools/movies/format";
import type { MoviesState } from "@/tools/movies/types";
import type { ActionResult } from "@/tools/recordings/types";

/**
 * Top Movies' buttons. Each re-checks the Private session, asks the movie-picks service at home
 * (through the DVR's locked entrance), refreshes the page in place and words the outcome for the
 * toast. The home server rebuilds the TV shelves before it answers, so "off the TV" is true.
 */

const PAGE = "/private/movies";
const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const say = (ok: boolean, message: string, undo?: ActionResult["undo"]): ActionResult => ({ ok, message: message.slice(0, 200), undo, at: Date.now() });
const nope = say(false, "That didn't look right. Reload the page and try again.");
const title = (f: FormData) => str(f, "title").slice(0, 80) || "That movie";

export async function markMovie(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePrivate(PAGE);
  const key = str(form, "key"), why = str(form, "why");
  if (!isImdbId(key) || (why !== "seen" && why !== "not interested")) return nope;
  const r = await movies<unknown>("mark", { method: "POST", body: { key, why } });
  if (!r.ok) return say(false, r.message);
  refresh();
  return say(true, `${title(form)} is off the list and the TV shelves.`, { kind: "restore", value: key });
}

export async function restoreMovie(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePrivate(PAGE);
  const key = str(form, "key");
  if (!isImdbId(key)) return nope;
  const r = await movies<unknown>("mark", { method: "POST", body: { key, why: "" } });
  if (!r.ok) return say(false, r.message);
  refresh();
  return say(true, form.get("title") ? `${title(form)} is back on the list.` : "Back on the list.");
}

export async function saveMovieSettings(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePrivate(PAGE);
  // The ranges come from the home server, so the page and the server can't disagree.
  const state = await movies<MoviesState>("state");
  if (!state.ok) return say(false, state.message);
  const read = readSettingsForm(form, state.data.limits);
  if (!read.ok) return say(false, read.message);
  const r = await movies<unknown>("settings", { method: "POST", body: read.value });
  if (!r.ok) return say(false, r.message);
  refresh();
  return say(true, "Saved. The lists here and on the TV now follow the new settings.");
}
