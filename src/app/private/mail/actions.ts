"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requirePrivate } from "@/lib/money/guard";
import { applyRuleToRecent, resortRecent } from "@/lib/mail/ingest";
import { runYahoo, syncYahooAccounts } from "@/lib/mail/run";
import { newKey, sealSecret, sha256 } from "@/lib/mail/secret";
import { addRule, ensureGmailAccount, deleteRule, getRules, removeAccount, setDismissed, setGmailKeyHash, upsertYahoo, recentRuns } from "@/lib/mail/store";
import { testYahooLogin } from "@/lib/mail/yahoo";
import { gmailScript } from "@/tools/mail/gmail-script";
import { cleanFolder } from "@/tools/mail/plan";
import type { RuleAction } from "@/tools/mail/types";

/** Every action re-checks the Private session itself; the proxy is the first lock, not the only one. */

export type FormState = {
  error?: string;
  done?: string;
  script?: string;
  attempt: number;
  /** What was typed, handed back so a failed try doesn't wipe the form (React resets it after every action). Never the password. */
  values?: Record<string, string>;
};

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
  const { id, created } = await addRule(rule);
  const q = new URLSearchParams({ ruled: addr, did: action, n: "0" });
  if (!created) {
    // A second tap (or the same rule made before): the first one already did the work. Doing it
    // again would press an unsubscribe link twice.
    q.set("dup", "1");
    redirect(`/private/mail?${q}`);
  }
  const { touched, accounts } = await applyRuleToRecent({ id, ...rule }, addr);
  q.set("n", String(touched));
  // Yahoo's moves are made right after the page answers (a Yahoo sign-in and sync can take most of
  // the minute a request gets); Gmail's script makes its own at its next run.
  const yahoo = accounts.filter((a) => a.startsWith("yahoo:"));
  if (yahoo.length) {
    q.set("yahoo", "1");
    after(async () => {
      try {
        await syncYahooAccounts(yahoo); // the page reads the database fresh on the next visit
      } catch (e) {
        console.error("mail: yahoo sync after a new rule failed", e instanceof Error ? e.message : e);
      }
    });
  }
  revalidatePath("/private/mail", "layout");
  if (accounts.some((a) => !a.startsWith("yahoo:"))) q.set("gmail", "1");
  redirect(`/private/mail?${q}`);
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
  const values = { matchFrom: matchFrom ?? "", matchSubject: matchSubject ?? "", folder: String(form.get("folder") ?? "").slice(0, 60) };
  if (!matchFrom && !matchSubject) return { error: "Fill in who it's from, the subject, or both.", attempt, values };
  if (!ACTIONS.has(action)) return { error: "Pick what the rule should do.", attempt, values };
  const folder = action === "file" ? cleanFolder(String(form.get("folder") ?? "")) ?? "Misc" : null;
  const { created } = await addRule({ matchFrom, matchSubject, action: action as RuleAction, folder });
  revalidatePath("/private/mail", "layout");
  return { done: created ? "Rule saved. It applies to new mail from the next run." : "That rule is already in the list, so nothing changed.", attempt };
}

/** Removes a rule; the answer is a sentence for the page. */
export async function removeRule(form: FormData): Promise<{ ok: boolean; message: string }> {
  await requirePrivate("/private/mail/settings");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { ok: false, message: "That didn't look right. Reload the page and try again." };
  await deleteRule(id);
  revalidatePath("/private/mail", "layout");
  return { ok: true, message: "Rule removed. Mail it would have moved now stays where it lands." };
}

export async function addYahoo(prev: FormState, form: FormData): Promise<FormState> {
  await requirePrivate("/private/mail/settings");
  const attempt = prev.attempt + 1;
  const address = String(form.get("address") ?? "").trim().toLowerCase();
  const pass = String(form.get("appPassword") ?? "").replace(/\s+/g, "");
  const values = { address: address.slice(0, 120) }; // the address only: the password is never sent back
  if (!/^[^@\s]+@(yahoo|ymail|rocketmail|aol)\.[a-z.]+$/.test(address)) return { error: "Enter a Yahoo address, like name@yahoo.com.", attempt, values };
  if (pass.length < 8) return { error: "Paste the app password Yahoo made for you (16 letters).", attempt, values };
  const problem = await testYahooLogin(address, pass);
  if (problem) return { error: problem, attempt, values };
  try {
    await upsertYahoo(address, sealSecret(pass));
  } catch {
    return { error: "Couldn't save it: the site's encryption key isn't set up.", attempt, values };
  }
  revalidatePath("/private/mail", "layout");
  return { done: `Signed in to ${address}. It's checked every morning at 7.`, attempt };
}

/** Removes an account and its saved app password; the answer is a sentence for the page. */
export async function removeMailAccount(form: FormData): Promise<{ ok: boolean; message: string }> {
  await requirePrivate("/private/mail/settings");
  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, message: "That didn't look right. Reload the page and try again." };
  await removeAccount(id);
  revalidatePath("/private/mail", "layout");
  return { ok: true, message: `Removed ${id.replace(/^yahoo:/, "")} and its saved app password. You can revoke the app password at Yahoo too.` };
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
