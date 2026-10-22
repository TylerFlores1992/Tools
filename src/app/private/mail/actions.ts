"use server";

import { revalidatePath } from "next/cache";
import { requirePrivate } from "@/lib/money/guard";
import { redirect } from "next/navigation";
import { applyRuleToRecent, resortRecent } from "@/lib/mail/ingest";
import { runYahoo } from "@/lib/mail/run";
import { newKey, sealSecret, sha256 } from "@/lib/mail/secret";
import { addRule, ensureGmailAccount, deleteRule, getRules, removeAccount, setDismissed, setGmailKeyHash, upsertYahoo, recentRuns } from "@/lib/mail/store";
import { testYahooLogin } from "@/lib/mail/yahoo";
import { gmailScript } from "@/tools/mail/gmail-script";
import { cleanFolder } from "@/tools/mail/plan";
import type { RuleAction } from "@/tools/mail/types";

/** Every action re-checks the Private session itself; the proxy is the first lock, not the only one. */

export type FormState = { error?: string; done?: string; script?: string; attempt: number };

const ACTIONS: ReadonlySet<string> = new Set(["trash", "file", "unsubscribe", "hide", "important"]);

export async function toggleDone(form: FormData): Promise<void> {
  await requirePrivate("/private/mail");
  const id = String(form.get("id") ?? "");
  if (!id) return;
  await setDismissed(id, String(form.get("title") ?? "").slice(0, 200), form.get("on") === "1");
  revalidatePath("/private/mail");
}

export async function ruleFromSender(form: FormData): Promise<void> {
  await requirePrivate("/private/mail");
  const addr = String(form.get("addr") ?? "").trim().toLowerCase();
  const action = String(form.get("action") ?? "");
  if (!addr.includes("@") || !ACTIONS.has(action)) return;
  const folder = action === "file" ? cleanFolder(String(form.get("folder") ?? "")) ?? "Misc" : null;
  const rule = { matchFrom: addr, matchSubject: null, action: action as RuleAction, folder };
  const id = await addRule(rule);
  await applyRuleToRecent({ id, ...rule }, addr);
  revalidatePath("/private/mail", "layout");
}

/** Sorts the last week's mail again with the current rules and sorting. Nothing in a mailbox moves. */
export async function resortMail(): Promise<void> {
  await requirePrivate("/private/mail");
  const { checked, changed } = await resortRecent(await getRules());
  revalidatePath("/private/mail", "layout");
  redirect(`/private/mail?resorted=${changed}&of=${checked}`);
}

export async function createRule(prev: FormState, form: FormData): Promise<FormState> {
  await requirePrivate("/private/mail/settings");
  const attempt = prev.attempt + 1;
  const matchFrom = String(form.get("matchFrom") ?? "").trim().slice(0, 120) || null;
  const matchSubject = String(form.get("matchSubject") ?? "").trim().slice(0, 120) || null;
  const action = String(form.get("action") ?? "");
  if (!matchFrom && !matchSubject) return { error: "Fill in who it's from, the subject, or both.", attempt };
  if (!ACTIONS.has(action)) return { error: "Pick what the rule should do.", attempt };
  const folder = action === "file" ? cleanFolder(String(form.get("folder") ?? "")) ?? "Misc" : null;
  await addRule({ matchFrom, matchSubject, action: action as RuleAction, folder });
  revalidatePath("/private/mail", "layout");
  return { done: "Rule saved. It applies to new mail from the next run.", attempt };
}

export async function removeRule(form: FormData): Promise<void> {
  await requirePrivate("/private/mail/settings");
  const id = Number(form.get("id"));
  if (Number.isInteger(id)) await deleteRule(id);
  revalidatePath("/private/mail", "layout");
}

export async function addYahoo(prev: FormState, form: FormData): Promise<FormState> {
  await requirePrivate("/private/mail/settings");
  const attempt = prev.attempt + 1;
  const address = String(form.get("address") ?? "").trim().toLowerCase();
  const pass = String(form.get("appPassword") ?? "").replace(/\s+/g, "");
  if (!/^[^@\s]+@(yahoo|ymail|rocketmail|aol)\.[a-z.]+$/.test(address)) return { error: "Enter a Yahoo address, like name@yahoo.com.", attempt };
  if (pass.length < 8) return { error: "Paste the app password Yahoo made for you (16 letters).", attempt };
  const problem = await testYahooLogin(address, pass);
  if (problem) return { error: problem, attempt };
  try {
    await upsertYahoo(address, sealSecret(pass));
  } catch {
    return { error: "Couldn't save it: the site's encryption key isn't set up.", attempt };
  }
  revalidatePath("/private/mail", "layout");
  return { done: `Signed in to ${address}. It's checked every morning at 7.`, attempt };
}

export async function removeMailAccount(form: FormData): Promise<void> {
  await requirePrivate("/private/mail/settings");
  const id = String(form.get("id") ?? "");
  if (id) await removeAccount(id);
  revalidatePath("/private/mail", "layout");
}

export async function makeGmailScript(prev: FormState): Promise<FormState> {
  await requirePrivate("/private/mail/settings");
  const attempt = prev.attempt + 1;
  const key = newKey();
  await setGmailKeyHash(sha256(key));
  await ensureGmailAccount();
  revalidatePath("/private/mail", "layout");
  return { script: gmailScript("https://tylerflores.dev/api/mail/gmail", key), done: "New script made. Any older copy stops working now.", attempt };
}

export async function runNow(prev: FormState): Promise<FormState> {
  await requirePrivate("/private/mail/settings");
  const attempt = prev.attempt + 1;
  const manualToday = (await recentRuns(50)).filter((r) => r.source === "manual" && Date.now() - Date.parse(r.startedAt) < 86_400_000).length;
  if (manualToday >= 12) return { error: "That's 12 manual checks today; the 7 am run still happens.", attempt };
  const r = await runYahoo("manual");
  revalidatePath("/private/mail", "layout");
  return r.ok ? { done: r.message, attempt } : { error: r.message, attempt };
}
