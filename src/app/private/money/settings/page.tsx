import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { requirePrivate } from "@/lib/money/guard";
import { accountLabel, loadMoney } from "@/lib/money/load";
import { MoneyShell, OWNER_LABEL } from "@/tools/money/ui/MoneyShell";
import { ConnectForm, ImportForm, SyncNowForm } from "@/tools/money/ui/ConnectForms";
import { importedByAccount } from "@/lib/money/import";
import { shortDate } from "@/tools/money/summary";
import { NotConfigured, Unreachable } from "@/tools/money/ui/Setup";
import { disconnect, removeRule, saveAccount, undoStatement } from "../actions";

export const metadata: Metadata = {
  title: "Settings · Money",
  description: "Bank connection, accounts and rules.",
  robots: { index: false, follow: false },
};

// Connecting runs the first sync inside the action (up to two SimpleFIN requests).
export const maxDuration = 60;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const FIELD = "field min-h-11 w-full rounded-input border border-control bg-surface px-3 text-body text-ink";

export default async function MoneySettings({ searchParams }: { searchParams: Promise<{ disconnected?: string }> }) {
  await requirePrivate("/private/money/settings");
  const sp = await searchParams;
  const data = await loadMoney();
  // After loadMoney, not beside it: the pooler stalls queries sent at once (src/lib/money/db.ts).
  const imported = data.state === "ok" ? await importedByAccount().catch(() => new Map<string, { n: number; from: string; to: string }>()) : new Map<string, { n: number; from: string; to: string }>();

  return (
    <MoneyShell current="/private/money/settings">
      <Label>Money</Label>
      <h1 className="mt-3 text-title font-normal">Settings</h1>

      {data.state === "not-configured" && <div className="mt-8"><NotConfigured /></div>}
      {data.state === "unreachable" && <div className="mt-8"><Unreachable /></div>}

      {data.state === "ok" && (
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10">
          <section aria-labelledby="conn">
            <h2 id="conn" className="text-h2 font-normal">Bank connection</h2>
            <Card className="mt-4 max-w-[720px]">
              {sp.disconnected && <p className="mb-4"><State kind="note">Disconnected. Transactions already saved are kept.</State></p>}
              {data.connected ? (
                <>
                  <State kind="ok">Connected to SimpleFIN. Syncs every morning around 7.</State>
                  <div className="mt-5"><SyncNowForm /></div>
                </>
              ) : (
                <ol className="grid list-decimal gap-2 pl-5 text-body text-ink-2 marker:text-muted">
                  <li>Open <a href="https://beta-bridge.simplefin.org" target="_blank" rel="noreferrer" className="text-ink underline underline-offset-4">SimpleFIN Bridge</a> and make an account (about $1.50 a month).</li>
                  <li>Add your banks there: Chase, then U.S. Bank.</li>
                  <li>Choose <span className="text-ink">New app connection</span>, copy the setup token, paste it below.</li>
                </ol>
              )}
              {data.connected ? (
                <details className="mt-6 border-t border-line pt-6">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-btn text-body text-ink-2 hover:text-ink">Replace the connection</summary>
                  <p className="mb-3 mt-2 text-small text-muted">Added a bank or revoked the connection? Paste a new setup token.</p>
                  <ConnectForm reconnect />
                </details>
              ) : (
                <div className="mt-6"><ConnectForm reconnect={false} /></div>
              )}
              {data.connected && (
                <form action={disconnect} className="mt-6 border-t border-line pt-6">
                  <p className="mb-3 text-small text-muted">Forget the SimpleFIN connection on this site. To cut access entirely, also remove the app connection in SimpleFIN Bridge.</p>
                  <Button type="submit" variant="ghost">Disconnect</Button>
                </form>
              )}
            </Card>
          </section>

          <section aria-labelledby="accts">
            <h2 id="accts" className="text-h2 font-normal">Accounts</h2>
            <p className="mt-2 max-w-[60ch] text-body text-ink-2">Mark each account as yours or joint so the Mine and Joint views add up. Hidden accounts aren’t counted anywhere.</p>
            {data.accounts.length === 0 ? (
              <p className="mt-4 text-body text-ink-2">Accounts appear after the first sync.</p>
            ) : (
              <ul className="mt-4 grid max-w-[720px] gap-3">
                {data.accounts.map((a) => (
                  <li key={a.id}>
                    {/* Keyed on the saved values: React resets a form after its action runs, and a
                        reset <select> fell back to "Not set" instead of the value just saved. A new
                        key remounts the form with the new defaults. */}
                    <form key={`${a.owner ?? ""}|${a.displayName ?? ""}|${a.hidden}`} action={saveAccount} className="grid gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:grid-cols-[1fr_10rem] sm:items-end">
                      <input type="hidden" name="id" value={a.id} />
                      <p className="text-small text-muted sm:col-span-2">{[a.orgName, a.name].filter(Boolean).join(" · ")}</p>
                      <label className="grid gap-1.5">
                        <span className="text-small text-ink-2">Name to show</span>
                        <input name="displayName" defaultValue={a.displayName ?? ""} placeholder={accountLabel({ ...a, displayName: null })} maxLength={60} className={`${FIELD} placeholder:text-muted`} />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-small text-ink-2">Whose</span>
                        <select name="owner" defaultValue={a.owner ?? ""} className={FIELD}>
                          <option value="">Not set</option>
                          {(Object.keys(OWNER_LABEL) as Array<keyof typeof OWNER_LABEL>).map((k) => <option key={k} value={k}>{OWNER_LABEL[k]}</option>)}
                        </select>
                      </label>
                      <label className="flex min-h-11 items-center gap-3 text-small text-ink-2">
                        <input type="checkbox" name="hidden" defaultChecked={a.hidden} className="size-5 accent-ink" />
                        Hide this account
                      </label>
                      <Button type="submit" variant="quiet" className="sm:justify-self-end">Save</Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="older">
            <h2 id="older" className="text-h2 font-normal">Older history</h2>
            <p className="mt-2 max-w-[60ch] text-body text-ink-2">The bank sync only reaches back 90 days. For earlier months, download a CSV from each bank’s website and import it here, one account at a time.</p>
            <ol className="mt-3 grid max-w-[60ch] list-decimal gap-1.5 pl-5 text-small text-ink-2 marker:text-muted">
              <li><span className="text-ink">Chase:</span> open the account, choose Download account activity, pick the dates, file type CSV.</li>
              <li><span className="text-ink">U.S. Bank:</span> open the account, choose Download transactions, pick the dates, format CSV.</li>
            </ol>
            <p className="mt-3 max-w-[60ch] text-small text-muted">Dates the sync already has are skipped, so a file that overlaps is fine. Importing the same file twice adds nothing.</p>
            {data.accounts.length === 0 ? (
              <p className="mt-4 text-body text-ink-2">Connect the bank sync first, so the accounts exist.</p>
            ) : (
              <Card className="mt-4 max-w-[720px]">
                <ImportForm accounts={data.accounts.filter((a) => !a.hidden).map((a) => ({ id: a.id, label: accountLabel(a) }))} />
                {imported.size > 0 && (
                  <ul className="mt-6 divide-y divide-line border-t border-line">
                    {data.accounts.filter((a) => imported.has(a.id)).map((a) => {
                      const i = imported.get(a.id)!;
                      return (
                        <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-small">
                          <span className="text-ink-2"><span className="text-ink">{accountLabel(a)}</span> · {i.n} imported, {shortDate(i.from)} {i.from.slice(0, 4)} to {shortDate(i.to)} {i.to.slice(0, 4)}</span>
                          <form action={undoStatement}>
                            <input type="hidden" name="account" value={a.id} />
                            <Button type="submit" variant="ghost">Undo import<span className="sr-only"> for {accountLabel(a)}</span></Button>
                          </form>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            )}
          </section>

          <section aria-labelledby="rules">
            <h2 id="rules" className="text-h2 font-normal">Your rules</h2>
            <p className="mt-2 max-w-[60ch] text-body text-ink-2">Made when you tick “Always file this way” on a transaction. They beat the automatic categories; a category you set by hand beats both.</p>
            {data.rules.length === 0 ? (
              <p className="mt-4 text-body text-ink-2">No rules yet.</p>
            ) : (
              <ul className="mt-4 max-w-[720px] divide-y divide-line rounded-card border border-line bg-surface">
                {data.rules.map((r) => (
                  <li key={r.pattern} className="flex items-center justify-between gap-4 px-4 py-2">
                    <span className="min-w-0 text-body"><span className="font-mono text-small">{r.pattern}</span> <span aria-hidden="true">→</span><span className="sr-only">files as</span> {r.category}</span>
                    <form action={removeRule}>
                      <input type="hidden" name="pattern" value={r.pattern} />
                      <Button type="submit" variant="ghost">Remove<span className="sr-only"> rule for {r.pattern}</span></Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="hist">
            <h2 id="hist" className="text-h2 font-normal">Recent syncs</h2>
            {data.runs.length === 0 ? (
              <p className="mt-4 text-body text-ink-2">No syncs yet.</p>
            ) : (
              <ul className="mt-4 max-w-[720px] divide-y divide-line rounded-card border border-line bg-surface">
                {data.runs.map((r) => (
                  <li key={r.id} className="px-4 py-3 text-small">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {r.ok === null ? <State kind="note">Running or stopped early</State> : r.ok ? <State kind="ok">{r.message}</State> : <State kind="wrong">{r.message}</State>}
                      <span className="tabular-nums text-muted">{when(r.startedAt)} · {r.trigger === "cron" ? "Daily" : r.trigger === "manual" ? "Sync now" : "First sync"}</span>
                    </div>
                    {r.ok && <p className="mt-1 tabular-nums text-muted">{r.newTxns ?? 0} new · {r.accounts ?? 0} {r.accounts === 1 ? "account" : "accounts"}</p>}
                    {r.errors.map((e) => <p key={e} className="mt-1"><State kind="note">{e}</State></p>)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </MoneyShell>
  );
}
