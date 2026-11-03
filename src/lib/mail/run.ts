import "server-only";
import { finishRun, getAccounts, getRules, startRun } from "./store";
import { syncYahoo } from "./yahoo";

/** The morning run: every enabled Yahoo account, one after another. Gmail runs itself (its script). */
export async function runYahoo(source: "cron" | "manual"): Promise<{ ok: boolean; message: string }> {
  const runId = await startRun(source);
  // Whatever happens below, the run gets an ending: a crash part-way used to leave it reading
  // "Stopped early" for ever.
  let ok = false;
  let message = "The check stopped part-way. It runs again at 7.";
  let counts: Record<string, number> = {};
  try {
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
    ok = problems.length === 0;
    message = accounts.length === 0
      ? "No Yahoo accounts added yet."
      : ok ? `Checked ${accounts.length} Yahoo ${accounts.length === 1 ? "account" : "accounts"}: ${stored} new, ${moved} moved.` : problems.join(" ");
    counts = { accounts: accounts.length, stored, moved };
  } catch (e) {
    console.error("mail run failed", e instanceof Error ? e.message : e);
    ok = false;
  } finally {
    await finishRun(runId, ok, message, counts).catch((e) => console.error("mail run: couldn't record its end", e instanceof Error ? e.message : e));
  }
  return { ok, message };
}

/** Makes the waiting mailbox moves (and reads new mail) for some Yahoo accounts right now. */
export async function syncYahooAccounts(ids: readonly string[]): Promise<{ moved: number; problems: string[] }> {
  const rules = await getRules();
  const accounts = (await getAccounts()).filter((a) => a.kind === "yahoo" && a.enabled && ids.includes(a.id));
  let moved = 0;
  const problems: string[] = [];
  for (const a of accounts) {
    const r = await syncYahoo(a, rules);
    moved += r.moved;
    if (!r.ok) problems.push(`${a.address}: ${r.error}`);
  }
  return { moved, problems };
}
