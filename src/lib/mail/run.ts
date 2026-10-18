import "server-only";
import { finishRun, getAccounts, getRules, startRun } from "./store";
import { syncYahoo } from "./yahoo";

/** The morning run: every enabled Yahoo account, one after another. Gmail runs itself (its script). */
export async function runYahoo(source: "cron" | "manual"): Promise<{ ok: boolean; message: string }> {
  const runId = await startRun(source);
  const rules = await getRules();
  const accounts = (await getAccounts()).filter((a) => a.kind === "yahoo" && a.enabled);
  let stored = 0;
  let moved = 0;
  const problems: string[] = [];
  for (const a of accounts) {
    const r = await syncYahoo(a, rules);
    stored += r.stored;
    moved += r.moved;
    if (!r.ok) problems.push(`${a.address}: ${r.error}`);
  }
  const ok = problems.length === 0;
  const message = accounts.length === 0
    ? "No Yahoo accounts added yet."
    : ok ? `Checked ${accounts.length} Yahoo ${accounts.length === 1 ? "account" : "accounts"}: ${stored} new, ${moved} moved.` : problems.join(" ");
  await finishRun(runId, ok, message, { accounts: accounts.length, stored, moved });
  return { ok, message };
}
