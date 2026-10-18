import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { requirePrivate } from "@/lib/money/guard";
import { loadMail } from "@/lib/mail/load";
import type { ReportItem } from "@/tools/mail/report";
import { MailShell } from "@/tools/mail/ui/MailShell";
import { Tag } from "@/tools/money/ui/MoneyShell";
import { NotConfigured, Unreachable } from "@/tools/money/ui/Setup";
import { ruleFromSender, toggleDone } from "./actions";

export const metadata: Metadata = {
  title: "Morning Mail",
  description: "What came in overnight across Gmail and Yahoo.",
  robots: { index: false, follow: false },
};

const longDate = (d: string) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
const shortDate = (d: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" });
const dayTime = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function MorningMail({ searchParams }: { searchParams: Promise<{ date?: string; handled?: string }> }) {
  await requirePrivate("/private/mail");
  const sp = await searchParams;
  const data = await loadMail(sp.date);

  if (data.state !== "ok") {
    return (
      <MailShell current="/private/mail">
        <h1 className="text-title font-normal">Morning Mail</h1>
        <div className="mt-8">{data.state === "not-configured" ? <NotConfigured /> : <Unreachable />}</div>
      </MailShell>
    );
  }

  const { report: r, date, today } = data;
  const showHandled = sp.handled === "1";
  const isToday = date === today;
  const noAccounts = data.accounts.length === 0;
  const visible = (items: ReportItem[]) => (showHandled ? items : items.filter((i) => !data.dismissed.has(i.id)));
  const handledCount = [...r.needsYou, ...r.security].filter((i) => data.dismissed.has(i.id)).length;

  return (
    <MailShell current="/private/mail">
      <div className="mx-auto max-w-[720px]">
        <Label>{isToday ? "Today" : "Earlier"}</Label>
        <h1 className="mt-3 text-title font-normal">{longDate(date)}</h1>
        <p className="mt-3 text-small text-muted">
          {r.total} {r.total === 1 ? "email" : "emails"} checked
          {r.otherCount ? ` · ${r.otherCount} needed nothing` : ""}
          {!isToday && <> · <Link href="/private/mail" className="underline underline-offset-4 hover:text-ink">Back to today</Link></>}
        </p>

        <ul className="mt-5 grid gap-1.5 text-small" aria-label="Accounts">
          {data.accounts.map((a) => (
            <li key={a.id}>
              {a.ok === null ? (
                <State kind="note">{a.label}: not checked yet</State>
              ) : a.ok ? (
                <State kind="ok">{a.label}: checked {a.lastRunAt ? dayTime(a.lastRunAt) : ""}</State>
              ) : (
                <State kind="wrong">{a.label}: {a.error}</State>
              )}
            </li>
          ))}
        </ul>

        {noAccounts && (
          <Card className="mt-8">
            <h2 className="text-h3 font-medium">Connect your mail</h2>
            <p className="mt-2 text-body text-ink-2">Add Gmail and your Yahoo accounts, and this page fills in every morning at 7.</p>
            <Link href="/private/mail/settings" className="mt-4 inline-flex min-h-11 items-center rounded-btn bg-primary px-5 text-body font-medium text-on-primary">Set up accounts</Link>
          </Card>
        )}

        <div className="mt-8 grid gap-6">
          <Section title="Needs you" count={visible(r.needsYou).filter((i) => !data.dismissed.has(i.id)).length}>
            <Items items={visible(r.needsYou)} dismissed={data.dismissed} empty="Nothing needs you." canDismiss={isToday} />
          </Section>
          <Section title="Security" count={visible(r.security).filter((i) => !data.dismissed.has(i.id)).length}>
            <Items items={visible(r.security)} dismissed={data.dismissed} empty="No new sign-in or breach alerts." canDismiss={isToday} />
          </Section>
          {handledCount > 0 && isToday && (
            <Link href={showHandled ? "/private/mail" : "/private/mail?handled=1"} className="justify-self-start text-small text-ink-2 underline underline-offset-4 hover:text-ink">
              {showHandled ? "Hide handled" : `Show ${handledCount} handled`}
            </Link>
          )}

          <Section title="Done">
            {r.done.length ? (
              <ul className="grid gap-3">
                {r.done.map((d) => (
                  <li key={d.account} className="grid gap-0.5">
                    <span className="font-mono text-label uppercase text-muted">{d.account}</span>
                    <span className="text-body text-ink-2">{d.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-ink-2">No changes. Mail is only moved by your rules.</p>
            )}
          </Section>

          {r.unsubscribeByHand.length > 0 && (
            <Section title="Unsubscribe by hand" count={r.unsubscribeByHand.length}>
              <ul className="grid gap-3">
                {r.unsubscribeByHand.map((u) => (
                  <li key={u.id} className="text-body">
                    <span className="text-ink">{u.sender}</span>
                    <span className="block text-small text-muted">
                      {u.note}{" "}
                      {u.link && <a href={u.link} target="_blank" rel="noreferrer noopener" className="text-ink-2 underline underline-offset-4 hover:text-ink">Open its unsubscribe page</a>}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {r.stillArriving.length > 0 && (
            <Section title="Still arriving after unsubscribe" count={r.stillArriving.length}>
              <ul className="grid gap-2">
                {r.stillArriving.map((s) => (
                  <li key={s.sender} className="text-body text-ink-2">
                    <span className="text-ink">{s.sender}</span>: {s.count} today, unsubscribed {shortDate(s.since)}. A trash rule will catch them.
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {r.couldntDo.length > 0 && (
            <Section title="Couldn't do" count={r.couldntDo.length}>
              <ul className="grid gap-2">
                {r.couldntDo.map((c) => <li key={c}><State kind="wrong">{c}</State></li>)}
              </ul>
            </Section>
          )}

          {r.bulk.length > 0 && isToday && (
            <Section title="Mailing lists today" count={r.bulk.length}>
              <p className="text-small text-muted">Nothing here was moved. Pick what should happen to each sender from now on (today&rsquo;s emails included).</p>
              <ul className="grid gap-4">
                {r.bulk.map((b) => (
                  <li key={b.addr} className="grid gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
                    <div className="min-w-0">
                      <p className="text-body text-ink">{b.name} <span className="text-small text-muted">· {b.count} · {b.accounts.join(", ")}</span></p>
                      <p className="truncate text-small text-muted">{b.sample}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SenderButton addr={b.addr} action="trash" label="Always trash" />
                      <SenderButton addr={b.addr} action="file" label="File in Misc" folder="Misc" />
                      {b.oneClick && <SenderButton addr={b.addr} action="unsubscribe" label="Unsubscribe" />}
                      <SenderButton addr={b.addr} action="hide" label="Ignore" />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {data.history.length > 1 && (
            <Section title="Earlier">
              <ul className="grid gap-1">
                {data.history.filter((h) => h.date !== date).map((h) => (
                  <li key={h.date}>
                    <Link href={`/private/mail?date=${h.date}`} className="flex min-h-10 items-center justify-between rounded-btn px-1 text-body text-ink-2 hover:bg-surface-2 hover:text-ink">
                      <span>{longDate(h.date)}</span>
                      <span className="text-small tabular-nums text-muted">{h.needs} for you · {h.total} emails</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <p className="mt-10 text-small text-muted">
          Checked every morning at 7{data.accounts.find((a) => a.lastRunAt) ? `, last at ${time(data.accounts.map((a) => a.lastRunAt).filter(Boolean).sort().pop() as string)}` : ""}. All code, no AI. Nothing is ever sent or permanently deleted; mail moves only when one of your rules says so.
        </p>
      </div>
    </MailShell>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="flex items-baseline justify-between font-mono text-label uppercase text-ink-2">
        <span>{title}</span>
        {count !== undefined && <span className="tabular-nums">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function Items({ items, dismissed, empty, canDismiss }: { items: ReportItem[]; dismissed: Set<string>; empty: string; canDismiss: boolean }) {
  if (!items.length) return <p className="text-body text-ink-2">{empty}</p>;
  return (
    <ul className="grid gap-4">
      {items.map((i) => {
        const done = dismissed.has(i.id);
        return (
          <li key={i.id} className="flex items-start gap-3">
            <div className={`min-w-0 flex-1 ${done ? "line-through decoration-muted" : ""}`}>
              <p className="flex flex-wrap items-center gap-2 text-body font-medium text-ink">
                {i.level === "urgent" && <Tag>Urgent</Tag>}
                <span className="break-words">{i.title}</span>
              </p>
              {i.detail && <p className="mt-0.5 break-words text-small text-ink-2">{i.detail}</p>}
              <p className="mt-0.5 text-small text-muted">{i.account}{i.since ? ` · since ${shortDate(i.since)}` : ""}</p>
            </div>
            {canDismiss && (
              <form action={toggleDone}>
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="title" value={i.title} />
                <input type="hidden" name="on" value={done ? "0" : "1"} />
                <button
                  type="submit"
                  aria-label={`${done ? "Restore" : "Mark handled"}: ${i.title}`}
                  aria-pressed={done}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border border-control text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink aria-pressed:bg-primary aria-pressed:text-on-primary"
                >
                  <span aria-hidden="true">✓</span>
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SenderButton({ addr, action, label, folder }: { addr: string; action: string; label: string; folder?: string }) {
  return (
    <form action={ruleFromSender}>
      <input type="hidden" name="addr" value={addr} />
      <input type="hidden" name="action" value={action} />
      {folder && <input type="hidden" name="folder" value={folder} />}
      <button type="submit" className="inline-flex min-h-10 items-center rounded-btn border border-line-2 bg-surface px-3 text-small text-ink-2 transition-colors duration-150 hover:border-control hover:bg-surface-2 hover:text-ink">
        {label}
      </button>
    </form>
  );
}
