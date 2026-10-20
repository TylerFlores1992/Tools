"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sha256 } from "@/lib/mail/secret";
import { requirePrivate } from "@/lib/money/guard";
import { setCategory } from "@/lib/money/store";
import { OTHER_INCOME } from "@/tools/money/categorize";
import { ReadFailed, readDocument } from "@/lib/money/income/read-document";
import {
  createStub, deleteStub, deleteStubFile, failStub, findStubByFile, getIncomeSettings, getStub, getStubFile, listEvents, listStubs,
  rematchDeposits, saveConfig, setCalendarKeyHash, setDeposit, writeStub,
} from "@/lib/money/income/store";
import { calendarScript } from "@/tools/money/income/calendar-script";
import { parseMoney, parseStubForm } from "@/tools/money/income/form";
import { fromRead } from "@/tools/money/income/read";
import { withDefaults, type IncomeConfig } from "@/tools/money/income/types";
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
 * not added again.
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
  if (existing) return { ok: false, error: "Already added.", id: existing };
  const id = await createStub(kind, file.type, bytes);
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
  if (stub && file) await readInto(id, file.bytes, file.mime, stub.kind);
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
  await requirePrivate("/private/money/income/settings");
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
  redirect("/private/money/income/settings?saved=1");
}

export type ScriptState = { script?: string; attempt: number };

/** A new key: shown once inside the script, stored as SHA-256 only. Stops any older script. */
export async function newCalendarScript(prev: ScriptState): Promise<ScriptState> {
  await requirePrivate("/private/money/income/settings");
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
