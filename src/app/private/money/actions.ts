"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePrivate } from "@/lib/money/guard";
import { importRows, undoImport } from "@/lib/money/import";
import { sql } from "@/lib/money/db";
import { deleteRule, getAccounts, getRules, manualSyncsToday, saveAccessUrl, setCategory, updateAccount } from "@/lib/money/store";
import { refileAll, runSync } from "@/lib/money/sync";
import { CATEGORIES } from "@/tools/money/categorize";
import { readBankCsv } from "@/tools/money/csv";
import { merchantKey } from "@/tools/money/recurring";
import { SimpleFinError, claimAccessUrl } from "@/tools/money/simplefin";
import type { Owner } from "@/tools/money/types";

/** Every action re-checks the session itself; the proxy is the first lock, not the only one. */

export type FormState = { error?: string; done?: string; attempt: number };

const MANUAL_SYNCS_PER_DAY = 6;

export async function connect(prev: FormState, form: FormData): Promise<FormState> {
  await requirePrivate("/private/money/settings");
  const attempt = prev.attempt + 1;
  const token = String(form.get("token") ?? "");
  try {
    const access = await claimAccessUrl(token);
    await saveAccessUrl(access);
  } catch (e) {
    return { error: e instanceof SimpleFinError ? e.message : "Couldn’t save the connection. Try again.", attempt };
  }
  const r = await runSync("connect").catch(() => null);
  revalidatePath("/private/money", "layout");
  if (!r?.ok) return { done: `Connected. The first sync didn’t finish: ${r?.message ?? "the database didn’t answer."} Try Sync now in a minute.`, attempt };
  redirect("/private/money?synced=1");
}

export async function syncNow(prev: FormState): Promise<FormState> {
  await requirePrivate("/private/money/settings");
  const attempt = prev.attempt + 1;
  if ((await manualSyncsToday()) >= MANUAL_SYNCS_PER_DAY) {
    return { error: `That’s ${MANUAL_SYNCS_PER_DAY} manual syncs in a day, the limit (SimpleFIN only allows a few requests a day). The daily sync still runs.`, attempt };
  }
  const r = await runSync("manual");
  revalidatePath("/private/money", "layout");
  if (!r.ok) return { error: r.message, attempt };
  const what = r.newTxns === 1 ? "1 new transaction" : `${r.newTxns} new transactions`;
  return { done: `${r.message} ${what}.${r.errors.length ? ` ${r.errors.join(" ")}` : ""}`, attempt };
}

export async function disconnect(): Promise<void> {
  await requirePrivate("/private/money/settings");
  await saveAccessUrl(null);
  revalidatePath("/private/money", "layout");
  redirect("/private/money/settings?disconnected=1");
}

const OWNERS: ReadonlySet<string> = new Set(["mine", "joint", "hers"]);

export async function saveAccount(form: FormData): Promise<void> {
  await requirePrivate("/private/money/settings");
  const id = String(form.get("id") ?? "");
  const ownerRaw = String(form.get("owner") ?? "");
  const displayName = String(form.get("displayName") ?? "").trim().slice(0, 60) || null;
  if (!id) return;
  await updateAccount(id, {
    owner: OWNERS.has(ownerRaw) ? (ownerRaw as Owner) : null,
    displayName,
    hidden: form.get("hidden") === "on",
  });
  revalidatePath("/private/money", "layout");
}

export async function recategorize(form: FormData): Promise<void> {
  await requirePrivate("/private/money/transactions");
  const id = String(form.get("id") ?? "");
  const category = String(form.get("category") ?? "");
  const description = String(form.get("description") ?? "");
  if (!id || !(CATEGORIES as readonly string[]).includes(category)) return;
  // "Always" files by the merchant's name without dates and numbers, so next month's charge matches too.
  const pattern = form.get("always") === "on" ? merchantKey(description) : "";
  await setCategory(id, category, pattern.length >= 3 ? { pattern } : null);
  revalidatePath("/private/money", "layout");
}

export async function removeRule(form: FormData): Promise<void> {
  await requirePrivate("/private/money/settings");
  const pattern = String(form.get("pattern") ?? "");
  if (pattern) await deleteRule(pattern);
  revalidatePath("/private/money", "layout");
}

/** A bank's CSV export, for history older than SimpleFIN's 90 days (src/lib/money/import.ts). */
export async function importStatement(prev: FormState, form: FormData): Promise<FormState> {
  await requirePrivate("/private/money/settings");
  const attempt = prev.attempt + 1;
  const accountId = String(form.get("account") ?? "");
  const file = form.get("file");
  const accounts = await getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return { error: "Pick the account this file is from.", attempt };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the CSV file you downloaded from the bank.", attempt };
  if (file.size > 900_000) return { error: "That file is too big. Download a shorter date range (a few months at a time).", attempt };
  const parsed = readBankCsv(await file.text(), form.get("flip") === "on");
  if (parsed.error) return { error: parsed.error, attempt };
  try {
    const r = await importRows(account.id, parsed.rows);
    revalidatePath("/private/money", "layout");
    const parts = [
      r.added
        ? `Added ${r.added} ${r.added === 1 ? "transaction" : "transactions"}${r.from && r.to ? `, ${dayLabel(r.from)} to ${dayLabel(r.to)}` : ""}.`
        : "Nothing new to add.",
    ];
    if (r.overlap) parts.push(`${r.overlap} ${r.overlap === 1 ? "was" : "were"} already in from the bank sync and skipped.`);
    if (r.repeat) parts.push(`${r.repeat} ${r.repeat === 1 ? "was" : "were"} already imported.`);
    if (parsed.skipped) parts.push(`${parsed.skipped} ${parsed.skipped === 1 ? "line wasn’t" : "lines weren’t"} a transaction.`);
    return { done: parts.join(" "), attempt };
  } catch (e) {
    console.error("money import failed", e instanceof Error ? e.name : "unknown");
    return { error: "The import failed. Nothing was added.", attempt };
  }
}

export async function undoStatement(form: FormData): Promise<void> {
  await requirePrivate("/private/money/settings");
  const accountId = String(form.get("account") ?? "");
  if (accountId) await undoImport(accountId);
  revalidatePath("/private/money", "layout");
}

const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Re-runs the automatic categories over all history, without asking SimpleFIN for anything. */
export async function refileNow(prev: FormState): Promise<FormState> {
  await requirePrivate("/private/money/settings");
  const attempt = prev.attempt + 1;
  try {
    const rules = await getRules();
    const n = await sql().begin((tx) => refileAll(tx, rules));
    revalidatePath("/private/money", "layout");
    return { done: n ? `Re-filed ${n} ${n === 1 ? "transaction" : "transactions"}.` : "Everything was already filed.", attempt };
  } catch (e) {
    console.error("money refile failed", e instanceof Error ? e.name : "unknown");
    return { error: "Re-filing failed. Nothing was changed.", attempt };
  }
}
