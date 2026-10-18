import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { isConfigured } from "@/lib/money/db";
import { requirePrivate } from "@/lib/money/guard";
import { getAccounts, getGmailSettings, listRules, recentRuns } from "@/lib/mail/store";
import { accountLabel } from "@/tools/mail/report";
import { GmailScriptForm, RuleForm, RunNowForm, YahooForm } from "@/tools/mail/ui/MailForms";
import { MailShell } from "@/tools/mail/ui/MailShell";
import { NotConfigured, Unreachable } from "@/tools/money/ui/Setup";
import { removeMailAccount, removeRule } from "../actions";

export const metadata: Metadata = {
  title: "Accounts & rules · Morning Mail",
  description: "Mail accounts and the rules that tidy them.",
  robots: { index: false, follow: false },
};

// Adding a Yahoo account signs in to check it; "Check now" reads every account.
export const maxDuration = 60;

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const ACTION_WORDS = { trash: "Move to Trash", file: "File in", unsubscribe: "Unsubscribe and trash", hide: "Ignore", important: "Always needs you" } as const;

async function load() {
  if (!isConfigured()) return null;
  try {
    const [accounts, gmail, rules, runs] = await Promise.all([getAccounts(), getGmailSettings(), listRules(), recentRuns(8)]);
    return { accounts, gmail, rules, runs };
  } catch {
    return "unreachable" as const;
  }
}

export default async function MailSettings() {
  await requirePrivate("/private/mail/settings");
  const data = await load();
  const keyReady = Boolean(process.env.MAIL_SECRET_KEY);

  return (
    <MailShell current="/private/mail/settings">
      <Label>Morning Mail</Label>
      <h1 className="mt-3 text-title font-normal">Accounts &amp; rules</h1>
      {data === null && <div className="mt-8"><NotConfigured /></div>}
      {data === "unreachable" && <div className="mt-8"><Unreachable /></div>}
      {data && data !== "unreachable" && (
        <div className="mt-8 grid max-w-[760px] gap-10">
          <section aria-labelledby="gmail">
            <h2 id="gmail" className="text-h2 font-normal">Gmail</h2>
            <Card className="mt-4 grid gap-4">
              {data.gmail.keyHash ? (
                data.gmail.lastRunAt ? <State kind="ok">Connected. Last run {when(data.gmail.lastRunAt)}.</State> : <State kind="note">Script made, but it hasn&rsquo;t run yet. Run setup in Apps Script.</State>
              ) : (
                <p className="text-body text-ink-2">Gmail is read by a small script that runs inside your own Google account every morning around 6, so there&rsquo;s no Google sign-in here to expire.</p>
              )}
              <GmailScriptForm connected={Boolean(data.gmail.keyHash)} />
            </Card>
          </section>

          <section aria-labelledby="yahoo">
            <h2 id="yahoo" className="text-h2 font-normal">Yahoo</h2>
            <Card className="mt-4 grid gap-5">
              {data.accounts.filter((a) => a.kind === "yahoo").length > 0 && (
                <ul className="grid gap-3">
                  {data.accounts.filter((a) => a.kind === "yahoo").map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-body text-ink">{a.address}</span>
                        <span className="block text-small">
                          {a.lastError ? <State kind="wrong">{a.lastError}</State> : a.lastRunAt ? <State kind="ok">Checked {when(a.lastRunAt)}</State> : <State kind="note">Not checked yet</State>}
                        </span>
                      </span>
                      <form action={removeMailAccount}>
                        <input type="hidden" name="id" value={a.id} />
                        <Button type="submit" variant="ghost">Remove<span className="sr-only"> {a.address}</span></Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              {!keyReady && <State kind="wrong">The site&rsquo;s encryption key (MAIL_SECRET_KEY) isn&rsquo;t set, so Yahoo accounts can&rsquo;t be saved yet.</State>}
              <details className="text-body text-ink-2">
                <summary className="cursor-pointer text-ink">How to get a Yahoo app password</summary>
                <ol className="mt-2 grid list-decimal gap-1 pl-5">
                  <li>Open <a href="https://login.yahoo.com/account/security" target="_blank" rel="noreferrer" className="text-ink underline underline-offset-4">Yahoo Account Security</a>.</li>
                  <li>Choose <span className="text-ink">Generate app password</span>, name it &ldquo;Morning Mail&rdquo;.</li>
                  <li>Paste the 16 letters below. It only reads and moves mail; you can revoke it there any time.</li>
                </ol>
              </details>
              <YahooForm />
              <div className="border-t border-line pt-5"><RunNowForm /></div>
            </Card>
          </section>

          <section aria-labelledby="rules">
            <h2 id="rules" className="text-h2 font-normal">Rules</h2>
            <p className="mt-2 max-w-[60ch] text-body text-ink-2">Mail is only moved when a rule says so. Rules made from the Today page match the sender&rsquo;s address. Trash is each account&rsquo;s own Trash, so nothing is gone for good.</p>
            {data.rules.length > 0 && (
              <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
                {data.rules.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0 text-body">
                      <span className="text-ink">
                        {[r.matchFrom && `from “${r.matchFrom}”`, r.matchSubject && `subject “${r.matchSubject}”`].filter(Boolean).join(" and ")}
                      </span>
                      <span className="text-ink-2"> → {ACTION_WORDS[r.action]}{r.action === "file" ? ` ${r.folder}` : ""}</span>
                      <span className="block text-small text-muted">{r.hits ? `Used ${r.hits} ${r.hits === 1 ? "time" : "times"}` : "Not used yet"}</span>
                    </span>
                    <form action={removeRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <Button type="submit" variant="ghost">Remove<span className="sr-only"> rule</span></Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <Card className="mt-4"><RuleForm /></Card>
          </section>

          {data.runs.length > 0 && (
            <section aria-labelledby="runs">
              <h2 id="runs" className="text-h2 font-normal">Recent checks</h2>
              <ul className="mt-4 grid gap-2 text-small">
                {data.runs.map((r) => (
                  <li key={r.startedAt} className="flex flex-wrap justify-between gap-2">
                    {r.ok === null ? <State kind="note">Stopped early</State> : r.ok ? <State kind="ok">{r.message}</State> : <State kind="wrong">{r.message}</State>}
                    <span className="tabular-nums text-muted">{when(r.startedAt)} · {r.source === "cron" ? "7 am" : "by hand"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-small text-muted">Accounts: {data.accounts.map((a) => accountLabel(a.id)).join(", ") || "none yet"}.</p>
        </div>
      )}
    </MailShell>
  );
}
