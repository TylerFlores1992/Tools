"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePrivate } from "@/lib/money/guard";
import { deleteRule, manualSyncsToday, saveAccessUrl, setCategory, updateAccount } from "@/lib/money/store";
import { runSync } from "@/lib/money/sync";
import { CATEGORIES } from "@/tools/money/categorize";
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
