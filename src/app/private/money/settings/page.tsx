import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { SubmitButton } from "@/components/SubmitButton";
import { requirePrivate } from "@/lib/money/guard";
import { accountLabel, loadMoney } from "@/lib/money/load";
import { MoneyShell, OWNER_LABEL, Tag } from "@/tools/money/ui/MoneyShell";
import { ConnectForm, ImportForm, RefileForm, SyncNowForm } from "@/tools/money/ui/ConnectForms";
import { importedByAccount } from "@/lib/money/import";
import { shortDate } from "@/tools/money/summary";
import { NotConfigured, Unreachable } from "@/tools/money/ui/Setup";
import { AccountForm } from "@/tools/money/ui/AccountForm";
import { ClearQuery } from "@/tools/money/ui/ClearQuery";
import { disconnect, removeRule, undoStatement } from "../actions";
import { IncomeSettings } from "./IncomeSettings";

export const metadata: Metadata = {
  title: "Settings · Money",
  description: "Bank connection, accounts, rules, and the work calendar, pay and tax settings.",
  robots: { index: false, follow: false },
};

// Connecting runs the first sync inside the action (up to two SimpleFIN requests).
export const maxDuration = 60;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** What a failed action says when it comes back here (`?failed=`). The database is the only thing that fails. */
const FAILED: Record<string, string> = {
  disconnect: "Not disconnected: the money database didn’t answer. Try again in a minute.",
  rule: "The rule wasn’t removed: the money database didn’t answer. Try again in a minute.",
  undo: "The import wasn’t undone: the money database didn’t answer. Try again in a minute.",
};

/** One-time notes in the address, cleared once shown (ClearQuery). */
const NOTES = ["disconnected", "saved", "imported", "removed", "failed"] as const;

export default async function MoneySettings({ searchParams }: { searchParams: Promise<{ disconnected?: string; saved?: string; imported?: string; removed?: string; failed?: string }> }) {
  await requirePrivate("/private/money/settings");
  const sp = await searchParams;
  const data = await loadMoney();
  // After loadMoney, not beside it: the pooler stalls queries sent at once (src/lib/money/db.ts).
  const imported = data.state === "ok" ? await importedByAccount().catch(() => new Map<string, { n: number; from: string; to: string }>()) : new Map<string, { n: number; from: string; to: string }>();

  return (
    <MoneyShell current="/private/money/settings">
      <Label>Money</Label>
      <h1 className="mt-3 text-title font-normal">Settings</h1>
      <ClearQuery keys={NOTES} />

      {data.state === "not-configured" && <div className="mt-8"><NotConfigured /></div>}
      {data.state === "unreachable" && <div className="mt-8"><Unreachable /></div>}

      {data.state === "ok" && (
        <nav aria-label="On this page" className="mt-6 overflow-x-auto">
          <ul className="flex w-max gap-1 text-small sm:w-auto sm:flex-wrap">
            {[["conn", "Bank"], ["accts", "Accounts"], ["income", "Work calendar"], ["import", "Import a calendar"], ["pay", "Pay and taxes"], ["older", "Older bank history"], ["rules", "Category rules"], ["hist", "Recent syncs"]].map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="flex min-h-11 items-center rounded-full border border-line px-3 whitespace-nowrap text-ink-2 hover:text-ink">{label}</a></li>
            ))}
          </ul>
        </nav>
      )}

      {data.state === "ok" && (
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10">
          <section aria-labelledby="conn" className="scroll-mt-6">
            <h2 id="conn" className="text-h2 font-normal">Bank connection</h2>
            <Card className="mt-4 max-w-[720px]">
              {sp.disconnected && <p className="mb-4"><State kind="ok">Disconnected. Transactions already saved are kept.</State></p>}
              {sp.failed === "disconnect" && <p role="alert" className="mb-4"><State kind="wrong">{FAILED.disconnect}</State></p>}
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
                  <SubmitButton variant="ghost" pending="Disconnecting…" confirm="Disconnect the bank sync? Transactions already saved are kept; new ones stop arriving until you connect again.">Disconnect</SubmitButton>
                </form>
              )}
            </Card>
          </section>

          <section aria-labelledby="accts" className="scroll-mt-6">
            <h2 id="accts" className="text-h2 font-normal">Accounts</h2>
            <p className="mt-2 max-w-[60ch] text-body text-ink-2">Mark each account as yours or joint so the Mine and Joint views add up. Hidden accounts aren’t counted anywhere.</p>
            {data.accounts.length === 0 ? (
              <p className="mt-4 text-body text-ink-2">Accounts appear after the first sync.</p>
            ) : (
              <ul className="mt-4 max-w-[720px] divide-y divide-line rounded-card border border-line bg-surface">
                {data.accounts.map((a) => (
                  <li key={a.id}>
                    <details className="group">
                      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0">
                          <span className="block truncate text-body text-ink">{accountLabel(a)}</span>
                          {a.displayName && <span className="mt-0.5 block truncate text-small text-muted">{[a.orgName, a.name].filter(Boolean).join(" · ")}</span>}
                        </span>
                        <span className="flex items-center gap-2">
                          {a.hidden && <Tag>Hidden</Tag>}
                          <Tag>{a.owner ? OWNER_LABEL[a.owner] : "Owner not set"}</Tag>
                          <span className="text-small text-ink-2 underline underline-offset-4">Edit<span className="sr-only"> {accountLabel(a)}</span></span>
                        </span>
                      </summary>
                      <AccountForm
                        id={a.id}
                        bankName={[a.orgName, a.name].filter(Boolean).join(" · ")}
                        placeholder={accountLabel({ ...a, displayName: null })}
                        displayName={a.displayName}
                        owner={a.owner}
                        hidden={a.hidden}
                        owners={Object.entries(OWNER_LABEL)}
                      />
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div id="income" className="grid scroll-mt-6 grid-cols-[minmax(0,1fr)] gap-10 border-t border-line-2 pt-10">
            <IncomeSettings saved={sp.saved === "income"} failed={sp.failed} imported={sp.imported} removed={sp.removed} />
          </div>

          <section aria-labelledby="older" className="scroll-mt-6">
            <h2 id="older" className="text-h2 font-normal">Older bank history</h2>
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
                {sp.failed === "undo" && <p role="alert" className="mb-4 text-small"><State kind="wrong">{FAILED.undo}</State></p>}
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
                            <SubmitButton variant="ghost" pending="Undoing…" confirm={`Remove the ${i.n} imported transactions from ${accountLabel(a)}? Synced transactions are kept.`}>Undo import<span className="sr-only"> for {accountLabel(a)}</span></SubmitButton>
                          </form>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            )}
          </section>

          <section aria-labelledby="rules" className="scroll-mt-6">
            <h2 id="rules" className="text-h2 font-normal">Category rules</h2>
            <p className="mt-2 max-w-[60ch] text-body text-ink-2">Made when you leave “Always file this way” ticked on a transaction. They beat the automatic categories; a category you set by hand beats both. Every sync re-files the history; “Re-file categories” does it now without asking the bank.</p>
            <div className="mt-4"><RefileForm /></div>
            {sp.failed === "rule" && <p role="alert" className="mt-4 text-small"><State kind="wrong">{FAILED.rule}</State></p>}
            {data.rules.length === 0 ? (
              <p className="mt-4 text-body text-ink-2">No rules yet.</p>
            ) : (
              <ul className="mt-4 max-w-[720px] divide-y divide-line rounded-card border border-line bg-surface">
                {data.rules.map((r) => (
                  <li key={r.pattern} className="flex items-center justify-between gap-4 px-4 py-2">
                    <span className="min-w-0 text-body"><span className="font-mono text-small">{r.pattern}</span> <span aria-hidden="true">→</span><span className="sr-only">files as</span> {r.category}</span>
                    <form action={removeRule}>
                      <input type="hidden" name="pattern" value={r.pattern} />
                      <SubmitButton variant="ghost" pending="Removing…" confirm={`Remove the rule for “${r.pattern}”? Transactions it filed are re-filed automatically on the next sync.`}>Remove<span className="sr-only"> rule for {r.pattern}</span></SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="hist" className="scroll-mt-6">
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
