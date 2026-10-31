"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sha256 } from "@/lib/mail/secret";
import { requirePrivate } from "@/lib/money/guard";
import { setCategory } from "@/lib/money/store";
import { OTHER_INCOME } from "@/tools/money/categorize";
import { PROGRAMS } from "@/tools/money/income/benefits";
import { ReadFailed, readDocument } from "@/lib/money/income/read-document";
import {
  addWorkDays, createStub, deleteStub, importEvents, removeImportedEvents, fileBenefit, unfileBenefit, deleteStubFile, failStub, findStubByFile, getIncomeSettings, getStub, getStubFile, listEvents, listStubs,
  rematchDeposits, requestCalendarRefresh, saveConfig, setCalendarKeyHash, setDeposit, writeStub,
} from "@/lib/money/income/store";
import { calendarScript } from "@/tools/money/income/calendar-script";
import { parseMoney, parseStubForm } from "@/tools/money/income/form";
import { fromRead } from "@/tools/money/income/read";
import { retryOnUpload } from "@/tools/money/income/read-models";
import { withDefaults, type IncomeConfig, type WorkEvent } from "@/tools/money/income/types";
import { icsEventId, parseIcs, type IcsEvent } from "@/tools/money/income/ics";
import { defaultLinks } from "@/tools/money/income/workdays";

/** Every action re-checks the session itself; the proxy is the first lock, not the only one. */

const MAX_BYTES = 4_000_000;
const OK_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export type OneResult =
  | { ok: true; id: string; status: "review" | "failed"; label: string }
  | { ok: false; error: string; id?: string };

/**
 * One file of a batch ("Add a year of stubs"): stores and reads it like `uploadDocument`, but
 * answers instead of redirecting, so the page can send the next file. The same file twice is
 * not added again. But a file whose earlier read failed is read again (2026-10-31: the owner
 * re-uploaded a stub that had timed out and got "Already added" with nothing to show for it).
 */
export async function uploadOne(form: FormData): Promise<OneResult> {
  await requirePrivate("/private/money/income/add");
  const kind = form.get("kind") === "w2" ? "w2" : "stub";
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Empty file." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Over 4 MB. Save it smaller and add it again." };
  if (!OK_TYPES.has(file.type)) return { ok: false, error: "Not a photo or PDF." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const existing = await findStubByFile(bytes);
  const before = existing ? await getStub(existing) : null;
  if (existing && !retryOnUpload(before?.status)) return { ok: false, error: "Already added.", id: existing };
  const id = existing ?? (await createStub(kind, file.type, bytes));
  await readInto(id, bytes, file.type, kind);
  const stub = await getStub(id);
  revalidatePath("/private/money/income", "layout");
  const label = [stub?.employer || stub?.payrollCompany, stub?.payDate].filter(Boolean).join(" · ") || "Not read";
  return { ok: true, id, status: stub?.status === "failed" ? "failed" : "review", label };
}

/** Runs the AI read and stores what it proposed, for review. */
async function readInto(id: string, bytes: Buffer, mime: string, asked: "stub" | "w2") {
  try {
    const { result, model } = await readDocument(bytes, mime);
    const read = fromRead(result);
    const stub = (await getStub(id))!;
    const merged = { ...stub, ...read, kind: read.kind === "w2" || asked === "w2" ? ("w2" as const) : ("stub" as const) };
    const others = await listStubs();
    const events = await listEvents();
    const workDays = merged.kind === "stub" ? defaultLinks(merged, events, others) : [];
    await writeStub(id, {
      ...merged,
      status: "review",
      workDays,
      notes: read.warnings.length ? `Unsure: ${read.warnings.join(" · ")}` : null,
      readError: null,
    }, model);
  } catch (e) {
    await failStub(id, e instanceof ReadFailed ? e.message : "The stub couldn't be read. Enter it by hand below.");
  }
}

export async function rereadStub(form: FormData): Promise<void> {
  await requirePrivate("/private/money/income");
  const id = String(form.get("id") ?? "");
  const stub = await getStub(id);
  const file = stub ? await getStubFile(id) : null;
  if (stub && file && stub.kind !== "benefit") await readInto(id, file.bytes, file.mime, stub.kind);
  revalidatePath("/private/money/income", "layout");
  redirect(`/private/money/income/stubs/${id}`);
}

export async function saveStub(form: FormData): Promise<void> {
  await requirePrivate("/private/money/income");
  const id = String(form.get("id") ?? "");
  const stub = await getStub(id);
  if (!stub) redirect("/private/money/income");
  const fields = parseStubForm((k) => (form.has(k) ? String(form.get(k)) : null), (k) => form.getAll(k).map(String));
  await writeStub(id, { ...fields, status: "saved", readError: null });
  await rematchDeposits();
  revalidatePath("/private/money", "layout");
  redirect(`/private/money/income?saved=${id}`);
}

export async function removeStub(form: FormData): Promise<void> {
  await requirePrivate("/private/money/income");
  const id = String(form.get("id") ?? "");
  if (id) await deleteStub(id);
  revalidatePath("/private/money", "layout");
  redirect("/private/money/income");
}

export async function removePhoto(form: FormData): Promise<void> {
  await requirePrivate("/private/money/income");
  const id = String(form.get("id") ?? "");
  if (id) await deleteStubFile(id);
  revalidatePath("/private/money/income", "layout");
  redirect(`/private/money/income/stubs/${id}`);
}

/** Pick the deposit by hand, or say there isn't one (stops auto-matching for this stub). */
export async function chooseDeposit(form: FormData): Promise<void> {
  await requirePrivate("/private/money/income");
  const id = String(form.get("id") ?? "");
  const txn = String(form.get("txn") ?? "");
  if (txn === "auto") {
    await setDeposit(id, null, "auto");
    await rematchDeposits();
  } else if (txn === "none" || !txn) await setDeposit(id, null, "none");
  else await setDeposit(id, txn, "manual");
  revalidatePath("/private/money", "layout");
  redirect(`/private/money/income/stubs/${id}`);
}

// ---- settings ----

export async function saveIncomeSettings(form: FormData): Promise<void> {
  await requirePrivate("/private/money/settings");
  const { config: old } = await getIncomeSettings();
  const num = (k: string, fallback: number) => { const v = Number(String(form.get(k) ?? "").trim()); return Number.isFinite(v) && String(form.get(k) ?? "").trim() !== "" ? v : fallback; };
  const rates: IncomeConfig["rates"] = [];
  for (let i = 0; i < 20; i++) {
    const employer = String(form.get(`rate_employer_${i}`) ?? "").trim().slice(0, 60);
    const rate = parseMoney(String(form.get(`rate_rate_${i}`) ?? ""));
    if (employer && rate) rates.push({ employer, rate });
  }
  const color = (k: string, fallback: string) => { const v = String(form.get(k) ?? ""); return /^(1[01]|[1-9])$/.test(v) ? v : fallback; };
  const config = withDefaults({
    ...old,
    workColor: color("workColor", old.workColor),
    paidColor: color("paidColor", old.paidColor),
    recolor: form.get("recolor") === "on",
    payLagDays: Math.max(1, Math.min(90, Math.round(num("payLagDays", old.payLagDays)))),
    defaultHoursPerDay: Math.max(1, Math.min(24, num("defaultHoursPerDay", old.defaultHoursPerDay))),
    defaultRate: parseMoney(String(form.get("defaultRate") ?? "")),
    rates,
    health: {
      show: form.get("healthShow") === "on",
      name: String(form.get("healthName") ?? "").trim().slice(0, 60) || old.health.name,
      hoursPerPeriod: Math.max(0, num("healthHours", old.health.hoursPerPeriod)),
      periodMonths: [1, 2, 3, 4, 6, 12].includes(num("healthMonths", old.health.periodMonths)) ? num("healthMonths", old.health.periodMonths) : old.health.periodMonths,
      firstMonth: Math.max(1, Math.min(12, Math.round(num("healthFirstMonth", old.health.firstMonth)))),
      bankCap: Math.max(0, num("healthBank", old.health.bankCap)),
    },
    tax: {
      filing: form.get("filing") === "single" ? "single" : "joint",
      otherWages: parseMoney(String(form.get("otherWages") ?? "")) ?? 0,
      otherFederalWithheld: parseMoney(String(form.get("otherWithheld") ?? "")) ?? 0,
      overtimeDeduction: form.get("overtimeDeduction") === "on",
    },
  });
  await saveConfig(config);
  revalidatePath("/private/money", "layout");
  redirect("/private/money/settings?saved=income#pay");
}

export type ScriptState = { script?: string; attempt: number };

/** A new key: shown once inside the script, stored as SHA-256 only. Stops any older script. */
export async function newCalendarScript(prev: ScriptState): Promise<ScriptState> {
  await requirePrivate("/private/money/settings");
  const key = randomBytes(24).toString("base64url");
  await setCalendarKeyHash(sha256(key));
  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://tylerflores.dev";
  return { script: calendarScript(`${base}/api/money/calendar`, key), attempt: prev.attempt + 1 };
}

/** "Not pay": file a deposit as Other income by hand, which takes it off "Stubs still missing". */
export async function markNotPay(form: FormData): Promise<void> {
  await requirePrivate("/private/money/income");
  const id = String(form.get("txn") ?? "");
  if (id) await setCategory(id, OTHER_INCOME, null);
  revalidatePath("/private/money", "layout");
}

/** File an EDD deposit as Paid Family Leave or Disability Insurance. */
export async function fileEdd(form: FormData): Promise<void> {
  await requirePrivate("/private/money/income");
  const txn = String(form.get("txn") ?? "");
  const program = String(form.get("program") ?? "");
  if (txn && (PROGRAMS as readonly string[]).includes(program)) await fileBenefit(txn, program);
  revalidatePath("/private/money", "layout");
}

export async function unfileEdd(form: FormData): Promise<void> {
  await requirePrivate("/private/money/income");
  const id = String(form.get("id") ?? "");
  if (id) await unfileBenefit(id);
  revalidatePath("/private/money", "layout");
}

/** Refresh on Income: the calendar script reads on its next one-minute wake (refresh.ts). */
export async function refreshCalendar(): Promise<void> {
  await requirePrivate("/private/money/income");
  await requestCalendarRefresh();
}

// ---- importing an older calendar (.ics) ----

const ICS_MAX_BYTES = 5_000_000;
export type IcsPreview = { events?: IcsEvent[]; repeating?: number; canceled?: number; outside?: number; error?: string; from?: string; before?: string; attempt: number };

/**
 * Step 1: read an .ics file (or a calendar's share link) and list its events in the dates given,
 * for the owner to tick. Nothing is saved.
 */
export async function previewIcs(prev: IcsPreview, form: FormData): Promise<IcsPreview> {
  await requirePrivate("/private/money/settings");
  const attempt = prev.attempt + 1;
  const from = String(form.get("from") ?? "");
  const before = String(form.get("before") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(before) || from >= before) return { attempt, error: "Pick a start date before the end date." };
  let text = "";
  const file = form.get("file");
  const link = String(form.get("link") ?? "").trim().replace(/^webcal:\/\//i, "https://");
  try {
    if (file instanceof File && file.size > 0) {
      if (file.size > ICS_MAX_BYTES) return { attempt, error: "That file is over 5 MB." };
      text = await file.text();
    } else if (link) {
      if (!/^https:\/\//i.test(link)) return { attempt, error: "The link should start with https:// or webcal://." };
      const res = await fetch(link, { signal: AbortSignal.timeout(20_000), headers: { Accept: "text/calendar" } });
      if (!res.ok) return { attempt, error: `The calendar link answered ${res.status}.` };
      text = (await res.text()).slice(0, ICS_MAX_BYTES);
    } else return { attempt, error: "Choose the .ics file, or paste the calendar's link." };
  } catch {
    return { attempt, error: "Couldn't read that calendar. Try downloading the file and choosing it instead." };
  }
  if (!/BEGIN:VCALENDAR/.test(text)) return { attempt, error: "That isn't a calendar file (.ics)." };
  const r = parseIcs(text, from, before);
  return { attempt, from, before, ...r, events: r.events.slice(0, 1500) };
}

/**
 * Step 2: save the ticked events as work days. Days a saved stub's pay period covers are linked to
 * that stub; the rest are marked paid (`paid` ticked: weeks from before this tracker) or left
 * waiting.
 */
export async function saveIcs(form: FormData): Promise<void> {
  await requirePrivate("/private/money/settings");
  const { config } = await getIncomeSettings();
  const markPaid = form.get("paid") === "on";
  const picked: WorkEvent[] = [];
  for (const raw of form.getAll("pick").slice(0, 1500)) {
    try {
      const e = JSON.parse(String(raw)) as IcsEvent;
      const ok = typeof e.uid === "string" && e.uid && typeof e.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.startDay) && /^\d{4}-\d{2}-\d{2}$/.test(e.endDay) && e.endDay >= e.startDay;
      if (ok) picked.push({ eventId: icsEventId(e).slice(0, 400), title: e.title.slice(0, 200) || "Work", startDay: e.startDay, endDay: e.endDay, color: markPaid ? config.paidColor : config.workColor, recoloredAt: null });
    } catch { /* skip a bad row */ }
  }
  if (picked.length) {
    await importEvents(picked);
    // Link the new days to the saved stubs whose pay periods cover them.
    const stubs = (await listStubs()).filter((s) => s.kind === "stub" && s.status === "saved");
    for (const s of stubs) {
      const add = defaultLinks(s, picked, stubs).filter((k) => !s.workDays.includes(k));
      if (add.length) { s.workDays = [...s.workDays, ...add]; await addWorkDays(s.id, add); }
    }
  }
  revalidatePath("/private/money/income", "layout");
  redirect(`/private/money/settings?imported=${picked.length}#import`);
}

export async function removeImported(): Promise<void> {
  await requirePrivate("/private/money/settings");
  const n = await removeImportedEvents();
  revalidatePath("/private/money/income", "layout");
  redirect(`/private/money/settings?removed=${n}#import`);
}
