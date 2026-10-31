"use server";

import { redirect } from "next/navigation";
import { requirePrivate } from "@/lib/money/guard";
import { dvr } from "@/lib/recordings/dvr";
import { readSeriesForm } from "@/tools/recordings/series-form";

/**
 * Every action re-checks the Private session itself; the proxy is the first lock, not the only
 * one. Actions are plain forms that come back to the page with a short message in the URL, so
 * everything works without JavaScript.
 */

const PAGE = "/private/recordings";
const TABS = new Set(["upcoming", "library", "series", "trash"]);
const isKey = (s: string) => /^\d+\|\d+$/.test(s);
const isRuleId = (s: string) => /^[0-9a-f]{8}$/.test(s);
const isTrashId = (s: string) => /^[a-z0-9]{6,20}$/.test(s);
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

function back(tab: string, msg: string, ok: boolean, extra: Record<string, string> = {}): never {
  const q = new URLSearchParams({ tab: TABS.has(tab) ? tab : "upcoming", msg: msg.slice(0, 200), kind: ok ? "ok" : "wrong", ...extra });
  redirect(`${PAGE}?${q}`);
}

async function run(tab: string, path: string, init: Parameters<typeof dvr>[1], done: string, extra?: (data: unknown) => Record<string, string>): Promise<never> {
  const r = await dvr<unknown>(path, init);
  if (!r.ok) back(tab, r.message, false);
  back(tab, done, true, extra?.(r.data));
}

// ---- upcoming ----

export async function skipEpisode(form: FormData): Promise<void> {
  await requirePrivate(PAGE);
  const key = str(form, "key");
  if (!isKey(key)) return;
  await run("upcoming", "skip", { method: "POST", body: { key, skip: true } }, `Skipped ${str(form, "name")}. The rest of the series still records.`, () => ({ unskip: key }));
}

export async function unskipEpisode(form: FormData): Promise<void> {
  await requirePrivate(PAGE);
  const key = str(form, "key");
  if (!isKey(key)) return;
  await run("upcoming", "skip", { method: "POST", body: { key, skip: false } }, `${str(form, "name") || "It"} will record.`);
}

export async function stopRecording(form: FormData): Promise<void> {
  await requirePrivate(PAGE);
  const key = str(form, "key");
  if (!isKey(key)) return;
  await run("upcoming", "stop", { method: "POST", body: { key } }, "Stopping. What was recorded is kept and appears in the library shortly.");
}

export async function cancelOnce(form: FormData): Promise<void> {
  await requirePrivate(PAGE);
  const id = str(form, "id");
  if (!isRuleId(id)) return;
  await run("upcoming", `rules/${id}`, { method: "DELETE", body: {} }, `Canceled ${str(form, "name")}.`);
}

// ---- library ----

export async function deleteEpisode(form: FormData): Promise<void> {
  await requirePrivate(PAGE);
  const rel = str(form, "rel");
  if (!rel) return;
  await run("library", "delete", { method: "POST", body: { rel } }, `Deleted ${str(form, "name")}. It's in the Trash for 7 days.`, (d): Record<string, string> => {
    const id = (d as { id?: string }).id;
    return id && isTrashId(id) ? { undo: id } : {};
  });
}

export async function deleteShow(form: FormData): Promise<void> {
  await requirePrivate(PAGE);
  const rels = form.getAll("rel").map(String).filter(Boolean).slice(0, 500);
  const ruleId = str(form, "ruleId");
  const show = str(form, "show");
  if (form.get("stopSeries") === "1" && isRuleId(ruleId)) {
    await run("library", `rules/${ruleId}`, { method: "DELETE", body: { deleteRecordings: true } }, `Moved ${show} to the Trash and stopped recording it.`);
  }
  for (const rel of rels) {
    const r = await dvr("delete", { method: "POST", body: { rel } });
    if (!r.ok) back("library", r.message, false);
  }
  back("library", `Moved ${rels.length} ${rels.length === 1 ? "episode" : "episodes"} of ${show} to the Trash.`, true);
}

export async function restoreAds(form: FormData): Promise<void> {
  await requirePrivate(PAGE);
  const rel = str(form, "rel");
  if (!rel) return;
  await run("library", "restore-ads", { method: "POST", body: { rel } }, `The full recording of ${str(form, "name")} is back. The ad-free copy is in the Trash.`);
}

// ---- trash ----

export async function undelete(form: FormData): Promise<void> {
  await requirePrivate(PAGE);
  const id = str(form, "id");
  if (!isTrashId(id)) return;
  await run(str(form, "tab") || "library", "undelete", { method: "POST", body: { id } }, "Restored. It's back on every TV.");
}

export async function emptyTrash(): Promise<void> {
  await requirePrivate(PAGE);
  await run("library", "empty-trash", { method: "POST", body: {} }, "Trash emptied.");
}

// ---- series ----

export async function setPaused(form: FormData): Promise<void> {
  await requirePrivate(PAGE);
  const id = str(form, "id");
  if (!isRuleId(id)) return;
  const resume = form.get("resume") === "1";
  await run("series", `rules/${id}`, { method: "PATCH", body: { enabled: resume } }, resume ? `${str(form, "name")} is recording again.` : `Paused ${str(form, "name")}. Nothing records until you resume it.`);
}

export async function deleteSeries(form: FormData): Promise<void> {
  await requirePrivate(PAGE);
  const id = str(form, "id");
  if (!isRuleId(id)) return;
  const del = form.get("deleteRecordings") === "1";
  await run("series", `rules/${id}`, { method: "DELETE", body: { deleteRecordings: del } }, `${str(form, "name")} won't record any more${del ? "; its episodes are in the Trash" : ""}.`);
}

export async function saveDefaults(form: FormData): Promise<void> {
  await requirePrivate(PAGE);
  const b = Number(str(form, "padBeforeMin"));
  const a = Number(str(form, "padAfterMin"));
  if (!Number.isFinite(b) || !Number.isFinite(a)) return;
  await run("series", "settings", { method: "POST", body: { padBeforeMin: b, padAfterMin: a } }, "Default timing saved.");
}


// ---- record a show (/private/recordings/record) ----

export async function saveSeries(form: FormData): Promise<void> {
  await requirePrivate(`${PAGE}/record`);
  const parsed = readSeriesForm(form);
  const ruleId = str(form, "ruleId");
  const editing = isRuleId(ruleId);
  if (!parsed.ok) back(editing ? "series" : "upcoming", parsed.message, false);
  const body = parsed.value;
  await run(editing ? "series" : "upcoming", editing ? `rules/${ruleId}` : "rules", { method: editing ? "PATCH" : "POST", body },
    editing ? `Saved ${body.title}.` : `${body.title} will record ${body.newOnly ? "every new episode" : "every airing"}.`);
}

export async function recordOnce(form: FormData): Promise<void> {
  await requirePrivate(`${PAGE}/record`);
  const parsed = readSeriesForm(form);
  const start = Math.trunc(Number(str(form, "start")));
  const stop = Math.trunc(Number(str(form, "stop")));
  if (!parsed.ok || !(start > 0) || !(stop > start)) back("upcoming", parsed.ok ? "Pick an airing." : parsed.message, false);
  await run("upcoming", "rules", { method: "POST", body: { ...parsed.value, once: start, onceStop: stop } }, `${parsed.value.title} (${str(form, "label").slice(0, 60)}) will record.`);
}
