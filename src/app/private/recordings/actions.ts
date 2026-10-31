"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requirePrivate } from "@/lib/money/guard";
import { dvr } from "@/lib/recordings/dvr";
import { readSeriesForm } from "@/tools/recordings/series-form";
import type { ActionResult } from "@/tools/recordings/types";

/**
 * Every action re-checks the Private session itself; the proxy is the first lock, not the only
 * one.
 *
 * The page's own buttons (skip, delete, pause…) update the page IN PLACE: they refresh the data
 * and hand back a short message for the toast (`ActionForm` + `Toaster`), so you stay where you
 * were on the page. Owner, 2026-10-31: "it blinks and sends me to the top of the page". The "record
 * a show" page still finishes by going back to Recordings, with the message in the URL.
 */

const PAGE = "/private/recordings";
const TABS = new Set(["upcoming", "library", "series", "trash"]);
const isKey = (s: string) => /^\d+\|\d+$/.test(s);
const isRuleId = (s: string) => /^[0-9a-f]{8}$/.test(s);
const isTrashId = (s: string) => /^[a-z0-9]{6,20}$/.test(s);
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

const say = (ok: boolean, message: string, undo?: ActionResult["undo"]): ActionResult => ({ ok, message: message.slice(0, 200), undo, at: Date.now() });
const nope = say(false, "That didn't look right. Reload the page and try again.");

/** Calls the DVR, refreshes the page's data in place, and words the outcome. */
async function act(path: string, init: Parameters<typeof dvr>[1], done: string, undo?: (data: unknown) => ActionResult["undo"]): Promise<ActionResult> {
  const r = await dvr<unknown>(path, init);
  if (!r.ok) return say(false, r.message);
  refresh();
  return say(true, done, undo?.(r.data));
}

// ---- upcoming ----

export async function skipEpisode(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePrivate(PAGE);
  const key = str(form, "key");
  if (!isKey(key)) return nope;
  return act("skip", { method: "POST", body: { key, skip: true } }, `Skipped ${str(form, "name")}. The rest of the series still records.`, () => ({ kind: "unskip", value: key }));
}

export async function unskipEpisode(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePrivate(PAGE);
  const key = str(form, "key");
  if (!isKey(key)) return nope;
  return act("skip", { method: "POST", body: { key, skip: false } }, `${str(form, "name") || "It"} will record.`);
}

export async function stopRecording(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePrivate(PAGE);
  const key = str(form, "key");
  if (!isKey(key)) return nope;
  return act("stop", { method: "POST", body: { key } }, "Stopping. What was recorded is kept and appears in the library shortly.");
}

export async function cancelOnce(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePrivate(PAGE);
  const id = str(form, "id");
  if (!isRuleId(id)) return nope;
  return act(`rules/${id}`, { method: "DELETE", body: {} }, `Canceled ${str(form, "name")}.`);
}

// ---- library ----

export async function deleteEpisode(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePrivate(PAGE);
  const rel = str(form, "rel");
  if (!rel) return nope;
  return act("delete", { method: "POST", body: { rel } }, `Deleted ${str(form, "name")}. It's in the Trash for 7 days.`, (d) => {
    const id = (d as { id?: string }).id;
    return id && isTrashId(id) ? { kind: "undelete", value: id } : undefined;
  });
}

export async function deleteShow(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePrivate(PAGE);
  const rels = form.getAll("rel").map(String).filter(Boolean).slice(0, 500);
  const ruleId = str(form, "ruleId");
  const show = str(form, "show");
  if (form.get("stopSeries") === "1" && isRuleId(ruleId)) {
    return act(`rules/${ruleId}`, { method: "DELETE", body: { deleteRecordings: true } }, `Moved ${show} to the Trash and stopped recording it.`);
  }
  for (const rel of rels) {
    const r = await dvr("delete", { method: "POST", body: { rel } });
    if (!r.ok) { refresh(); return say(false, r.message); }
  }
  refresh();
  return say(true, `Moved ${rels.length} ${rels.length === 1 ? "episode" : "episodes"} of ${show} to the Trash.`);
}

export async function restoreAds(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePrivate(PAGE);
  const rel = str(form, "rel");
  if (!rel) return nope;
  return act("restore-ads", { method: "POST", body: { rel } }, `The full recording of ${str(form, "name")} is back. The ad-free copy is in the Trash.`);
}

// ---- trash ----

export async function undelete(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePrivate(PAGE);
  const id = str(form, "id");
  if (!isTrashId(id)) return nope;
  return act("undelete", { method: "POST", body: { id } }, "Restored. It's back on every TV.");
}

export async function emptyTrash(): Promise<ActionResult> {
  await requirePrivate(PAGE);
  return act("empty-trash", { method: "POST", body: {} }, "Trash emptied.");
}

// ---- series ----

export async function setPaused(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePrivate(PAGE);
  const id = str(form, "id");
  if (!isRuleId(id)) return nope;
  const resume = form.get("resume") === "1";
  return act(`rules/${id}`, { method: "PATCH", body: { enabled: resume } }, resume ? `${str(form, "name")} is recording again.` : `Paused ${str(form, "name")}. Nothing records until you resume it.`);
}

export async function deleteSeries(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePrivate(PAGE);
  const id = str(form, "id");
  if (!isRuleId(id)) return nope;
  const del = form.get("deleteRecordings") === "1";
  return act(`rules/${id}`, { method: "DELETE", body: { deleteRecordings: del } }, `${str(form, "name")} won't record any more${del ? "; its episodes are in the Trash" : ""}.`);
}

export async function saveDefaults(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePrivate(PAGE);
  const b = Number(str(form, "padBeforeMin"));
  const a = Number(str(form, "padAfterMin"));
  if (!Number.isFinite(b) || !Number.isFinite(a)) return nope;
  return act("settings", { method: "POST", body: { padBeforeMin: b, padAfterMin: a } }, "Default timing saved.");
}

// ---- record a show (/private/recordings/record): a different page, so it goes back ----

function back(tab: string, msg: string, ok: boolean): never {
  const q = new URLSearchParams({ tab: TABS.has(tab) ? tab : "upcoming", msg: msg.slice(0, 200), kind: ok ? "ok" : "wrong" });
  redirect(`${PAGE}?${q}`);
}

export async function saveSeries(form: FormData): Promise<void> {
  await requirePrivate(`${PAGE}/record`);
  const parsed = readSeriesForm(form);
  const ruleId = str(form, "ruleId");
  const editing = isRuleId(ruleId);
  const tab = editing ? "series" : "upcoming";
  if (!parsed.ok) back(tab, parsed.message, false);
  const body = parsed.value;
  const r = await dvr(editing ? `rules/${ruleId}` : "rules", { method: editing ? "PATCH" : "POST", body });
  if (!r.ok) back(tab, r.message, false);
  back(tab, editing ? `Saved ${body.title}.` : `${body.title} will record ${body.newOnly ? "every new episode" : "every airing"}.`, true);
}

export async function recordOnce(form: FormData): Promise<void> {
  await requirePrivate(`${PAGE}/record`);
  const parsed = readSeriesForm(form);
  const start = Math.trunc(Number(str(form, "start")));
  const stop = Math.trunc(Number(str(form, "stop")));
  if (!parsed.ok || !(start > 0) || !(stop > start)) back("upcoming", parsed.ok ? "Pick an airing." : parsed.message, false);
  const r = await dvr("rules", { method: "POST", body: { ...parsed.value, once: start, onceStop: stop } });
  if (!r.ok) back("upcoming", r.message, false);
  back("upcoming", `${parsed.value.title} (${str(form, "label").slice(0, 60)}) will record.`, true);
}
