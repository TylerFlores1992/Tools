import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { requirePrivate } from "@/lib/money/guard";
import { getIncomeSettings, getStub, getStubFile, listEvents, listStubs } from "@/lib/money/income/store";
import { getTransactions } from "@/lib/money/store";
import { previousStub, stubChecks } from "@/tools/money/income/checks";
import { replacedBy } from "@/tools/money/income/reissue";
import { EARNING_KINDS, W2_FIELDS, YTD_KEYS } from "@/tools/money/income/form";
import { TAX_KEYS, TAX_LABEL } from "@/tools/money/income/types";
import { dayKey, eventDays } from "@/tools/money/income/workdays";
import { money, shortDate } from "@/tools/money/summary";
import { MoneyShell, Tag } from "@/tools/money/ui/MoneyShell";
import { chooseDeposit, removePhoto, removeStub, rereadStub, saveStub } from "../../actions";

export const metadata: Metadata = { title: "Review stub · Income", description: "Check what was read.", robots: { index: false, follow: false } };
export const maxDuration = 60; // "Read again" runs the AI read

const FIELD = "field min-h-11 w-full min-w-0 rounded-input border border-control bg-surface px-3 text-body text-ink tabular-nums";
const v = (n: number | null | undefined) => (n == null ? "" : String(n));
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export default async function StubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePrivate(`/private/money/income/stubs/${id}`);
  const stub = await getStub(id);
  if (!stub) notFound();
  // One query at a time: the pooler stalls pipelined queries (src/lib/money/db.ts).
  const file = await getStubFile(id);
  const all = await listStubs();
  const { config } = await getIncomeSettings();
  const events = await listEvents();
  const txns = await getTransactions(addDays(stub.payDate ?? new Date().toISOString().slice(0, 10), -40));

  const checks = stubChecks(stub, previousStub(stub, all), config);
  const reissues = replacedBy(all);
  const reissuedBy = all.find((o) => o.id === reissues.get(stub.id)) ?? null;
  const reissueOf = all.find((o) => reissues.get(o.id) === stub.id) ?? null;
  const taken = new Set(all.filter((s) => s.id !== stub.id && s.depositTxnId).map((s) => s.depositTxnId!));
  const deposit = stub.depositTxnId ? txns.find((t) => t.id === stub.depositTxnId) ?? null : null;
  const candidates = txns
    .filter((t) => t.amount > 0 && !t.pending && !taken.has(t.id) && t.id !== stub.depositTxnId)
    .filter((t) => (stub.net !== null && Math.abs(t.amount - stub.net) < 1) || (stub.payDate !== null && t.posted >= stub.payDate && t.posted <= addDays(stub.payDate, 30) && /PAYROLL|DEPOSIT/i.test(`${t.description} ${t.payee ?? ""}`)))
    .slice(0, 12);
  const from = stub.periodStart ? addDays(stub.periodStart, -7) : stub.payDate ? addDays(stub.payDate, -28) : null;
  const to = stub.periodEnd ? addDays(stub.periodEnd, 7) : stub.payDate ?? null;
  const days = from && to ? events.flatMap((e) => eventDays(e).filter((d) => d >= from && d <= to).map((d) => ({ key: dayKey(e.eventId, d), day: d, title: e.title }))) : [];
  const claimedElsewhere = new Set(all.filter((s) => s.id !== stub.id && s.status === "saved").flatMap((s) => s.workDays));
  const earnRows = [...stub.earnings, ...Array.from({ length: 3 }, () => null)];
  const dedRows = [...stub.deductions, ...Array.from({ length: 2 }, () => null)];
  const isW2 = stub.kind === "w2";

  return (
    <MoneyShell current="/private/money/income">
      <nav aria-label="Breadcrumb" className="text-small text-muted"><Link href="/private/money/income" className="underline-offset-4 hover:text-ink hover:underline">Income</Link> <span aria-hidden="true">/</span> {isW2 ? "W-2" : "Pay stub"}</nav>
      <Label className="mt-4">Income</Label>
      <h1 className="mt-3 text-title font-normal">{stub.status === "saved" ? (isW2 ? "W-2" : "Pay stub") : "Check what was read"}</h1>
      <p className="mt-3 flex flex-wrap gap-2">
        <Tag>{stub.status === "saved" ? "Saved" : stub.status === "failed" ? "Couldn’t read" : "Not saved yet"}</Tag>
        {stub.depositTxnId && <Tag>In bank</Tag>}
        {stub.estimated && <Tag>Estimate</Tag>}
      </p>
      {stub.estimated && <p className="mt-4 max-w-[64ch] text-body text-ink-2">An estimate, not read from a stub: {stub.notes ?? "worked out from your other stubs."} Add the real stub when you have it; once its take-home matches this one, it replaces the estimate.</p>}
      {reissuedBy && <p className="mt-4 max-w-[64ch] text-body text-ink-2">This week was reissued on <Link href={`/private/money/income/stubs/${reissuedBy.id}`} className="text-ink underline underline-offset-4">check {reissuedBy.checkNumber ?? "(no number)"}</Link>. Its take-home still counts as paid, but gross, taxes and hours come from the reissue.</p>}
      {reissueOf && <p className="mt-4 max-w-[64ch] text-body text-ink-2">A reissue of <Link href={`/private/money/income/stubs/${reissueOf.id}`} className="text-ink underline underline-offset-4">check {reissueOf.checkNumber ?? "(no number)"}</Link>: it takes back that check&rsquo;s take-home, so its own take-home is only the difference.</p>}
      {stub.readError && <p className="mt-4"><State kind="wrong">{stub.readError}</State></p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label="The photo" className="min-w-0">
          {file ? (
            file.mime === "application/pdf" ? (
              <Card><a href={`/private/money/income/stubs/${id}/file`} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-4">Open the PDF</a></Card>
            ) : (
              <a href={`/private/money/income/stubs/${id}/file`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-card border border-line bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element -- a private, uncached file route; next/image would cache it */}
                <img src={`/private/money/income/stubs/${id}/file`} alt="Your stub as photographed" className="h-auto w-full" />
              </a>
            )
          ) : (
            <Card><p className="text-body text-ink-2">No photo kept for this one.</p></Card>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {file && (
              <form action={rereadStub}><input type="hidden" name="id" value={id} /><Button type="submit" variant="quiet">Read it again</Button></form>
            )}
            {file && stub.status === "saved" && (
              <form action={removePhoto}><input type="hidden" name="id" value={id} /><Button type="submit" variant="ghost">Delete the photo, keep the numbers</Button></form>
            )}
          </div>
          {!isW2 && checks.length > 0 && (
            <Card className="mt-6">
              <h2 className="text-h3 font-medium">Checks</h2>
              <ul className="mt-3 grid gap-2 text-small">
                {checks.map((c) => <li key={c.text}><State kind={c.level === "ok" ? "ok" : "wrong"}>{c.text}</State></li>)}
              </ul>
              <p className="mt-3 text-small text-muted">Checks run on what&rsquo;s saved. Save, then come back to re-check your edits.</p>
            </Card>
          )}
        </section>

        <form action={saveStub} className="grid min-w-0 gap-8">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="kind" value={stub.kind} />

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-h3 font-medium">Who and when</legend>
            <F label="Employer" name="employer" value={stub.employer} />
            <F label="Payroll company" name="payrollCompany" value={stub.payrollCompany} />
            {!isW2 && <F label="Show or production" name="showName" value={stub.showName} />}
            {!isW2 && <F label="Pay date" name="payDate" value={stub.payDate} type="date" />}
            {!isW2 && <F label="Period start" name="periodStart" value={stub.periodStart} type="date" />}
            {!isW2 && <F label="Period end (week ending)" name="periodEnd" value={stub.periodEnd} type="date" />}
            {!isW2 && <F label="Check number" name="checkNumber" value={stub.checkNumber} />}
          </fieldset>

          {isW2 ? (
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-2 text-h3 font-medium">Boxes</legend>
              {W2_FIELDS.map(([k, label]) => <F key={k} label={label} name={`w2_${k}`} value={v(stub.w2?.[k])} money={k !== "taxYear"} />)}
            </fieldset>
          ) : (
            <>
              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="mb-2 text-h3 font-medium">Totals</legend>
                <F label="Gross pay" name="gross" value={v(stub.gross)} money />
                <F label="Net pay (take-home)" name="net" value={v(stub.net)} money />
              </fieldset>

              <fieldset className="grid gap-3">
                <legend className="mb-2 text-h3 font-medium">Pay lines</legend>
                {earnRows.map((e, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 rounded-card border border-line p-3 sm:grid-cols-[2fr_1.5fr_1fr_1fr_1.2fr]">
                    <F label="Line" name={`earn_label_${i}`} value={e?.label ?? ""} small />
                    <label className="grid gap-1">
                      <span className="text-small text-ink-2">Kind</span>
                      <select name={`earn_kind_${i}`} defaultValue={e?.kind ?? "regular"} className={FIELD}>
                        {EARNING_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </label>
                    <F label="Hours" name={`earn_hours_${i}`} value={v(e?.hours)} small numeric />
                    <F label="Rate" name={`earn_rate_${i}`} value={v(e?.rate)} small numeric />
                    <F label="Amount" name={`earn_amount_${i}`} value={v(e?.amount)} small numeric />
                  </div>
                ))}
              </fieldset>

              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="mb-2 text-h3 font-medium">Taxes withheld this check</legend>
                {TAX_KEYS.map((k) => <F key={k} label={TAX_LABEL[k]} name={`tax_${k}`} value={v(stub.taxes[k])} money />)}
              </fieldset>

              <fieldset className="grid gap-3">
                <legend className="mb-2 text-h3 font-medium">Other deductions</legend>
                {dedRows.map((d, i) => (
                  <div key={i} className="grid grid-cols-[2fr_1fr] gap-2">
                    <F label="Deduction" name={`ded_label_${i}`} value={d?.label ?? ""} small />
                    <F label="Amount" name={`ded_amount_${i}`} value={v(d?.amount)} small numeric />
                  </div>
                ))}
              </fieldset>

              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="mb-2 text-h3 font-medium">Year to date (from this stub)</legend>
                {YTD_KEYS.map((k) => <F key={k} label={k === "hours" ? "Hours" : k === "gross" ? "Gross" : k === "net" ? "Net" : TAX_LABEL[k]} name={`ytd_${k}`} value={v(stub.ytd[k])} money={k !== "hours"} />)}
              </fieldset>

              <fieldset className="grid gap-2">
                <legend className="mb-2 text-h3 font-medium">Work days this pays for</legend>
                {days.length === 0 ? (
                  <p className="text-body text-ink-2">{events.length ? "No calendar work days near this pay period." : "Connect your calendar in Income settings to tick off the days this pays for."}</p>
                ) : (
                  days.map((d) => (
                    <label key={d.key} className="flex min-h-11 items-center gap-3 text-body">
                      <input type="checkbox" name="workDay" value={d.key} defaultChecked={stub.workDays.includes(d.key)} className="size-5 accent-ink" />
                      <span><span className="tabular-nums">{shortDate(d.day)}</span> · {d.title}{claimedElsewhere.has(d.key) ? <span className="text-small text-muted"> · on another stub</span> : null}</span>
                    </label>
                  ))
                )}
              </fieldset>
            </>
          )}

          <label className="grid gap-1.5">
            <span className="text-small text-ink-2">Notes</span>
            <textarea name="notes" rows={2} defaultValue={stub.notes ?? ""} maxLength={500} className="field w-full rounded-input border border-control bg-surface px-3 py-2 text-body text-ink" />
          </label>

          <div className="flex flex-wrap gap-3">
            <Button type="submit">{stub.status === "saved" ? "Save changes" : "Looks right, save it"}</Button>
          </div>
        </form>
      </div>

      {!isW2 && stub.status === "saved" && (
        <section aria-labelledby="dep" className="mt-12 max-w-[760px]">
          <h2 id="dep" className="text-h2 font-normal">The deposit</h2>
          {deposit ? (
            <p className="mt-3 text-body"><State kind="ok">In the bank: +{money(deposit.amount)} on {shortDate(deposit.posted)} · {deposit.payee || deposit.description}{stub.depositMatch === "auto" ? " (found automatically)" : ""}</State></p>
          ) : (
            <p className="mt-3 text-body text-ink-2">{stub.depositMatch === "none" ? "Marked as having no deposit to find." : "Not found in the bank yet. A paper check shows up once you deposit it; the next sync looks again."}</p>
          )}
          <form action={chooseDeposit} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={id} />
            <label className="grid min-w-0 flex-1 gap-1.5">
              <span className="text-small text-ink-2">Change it</span>
              <select name="txn" defaultValue="" className={FIELD}>
                <option value="" disabled>Pick one</option>
                <option value="auto">Find it automatically</option>
                {candidates.map((t) => <option key={t.id} value={t.id}>+{money(t.amount)} · {shortDate(t.posted)} · {(t.payee || t.description).slice(0, 40)}</option>)}
                <option value="none">There is no deposit for this (cash, or not paid)</option>
              </select>
            </label>
            <Button type="submit" variant="quiet">Use this</Button>
          </form>
        </section>
      )}

      <form action={removeStub} className="mt-12 border-t border-line pt-6">
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="ghost">Delete this {isW2 ? "W-2" : "stub"}</Button>
      </form>
    </MoneyShell>
  );
}

function F({ label, name, value, type = "text", money: isMoney, numeric, small }: { label: string; name: string; value: string | null; type?: string; money?: boolean; numeric?: boolean; small?: boolean }) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-small text-ink-2">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={value ?? ""}
        inputMode={isMoney || numeric ? "decimal" : undefined}
        autoComplete="off"
        className={FIELD + (small ? " px-2" : "")}
      />
    </label>
  );
}

