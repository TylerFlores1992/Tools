import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { requirePrivate } from "@/lib/money/guard";
import { getIncomeSettings, listEvents } from "@/lib/money/income/store";
import { CalendarScriptForm } from "@/tools/money/income/ui/IncomeForms";
import { IcsImport } from "@/tools/money/income/ui/IcsImport";
import { isImportedEvent } from "@/tools/money/income/ics";
import { MoneyShell } from "@/tools/money/ui/MoneyShell";
import { removeImported, saveIncomeSettings } from "../actions";

export const metadata: Metadata = { title: "Income settings · Money", description: "Calendar, rates, health plan and tax profile.", robots: { index: false, follow: false } };

// Google Calendar's own names for its event colour ids.
const COLORS: Array<[string, string]> = [
  ["1", "Lavender"], ["2", "Sage"], ["3", "Grape"], ["4", "Flamingo"], ["5", "Banana"], ["6", "Tangerine"],
  ["7", "Peacock"], ["8", "Graphite"], ["9", "Blueberry"], ["10", "Basil"], ["11", "Tomato"],
];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const FIELD = "field min-h-11 w-full min-w-0 rounded-input border border-control bg-surface px-3 text-body text-ink";

export default async function IncomeSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; imported?: string; removed?: string }> }) {
  await requirePrivate("/private/money/income/settings");
  const sp = await searchParams;
  const s = await getIncomeSettings();
  const c = s.config;
  const rateRows = [...c.rates, ...Array.from({ length: 3 }, () => null)];
  const summary = (s.lastSummary ?? null) as { sent?: number; recolored?: number; errors?: number; scriptVersion?: string } | null;
  const imported = (await listEvents()).filter((e) => isImportedEvent(e.eventId));
  const importedRange = imported.length ? `${imported[0].startDay} to ${imported[imported.length - 1].startDay}` : "";
  const oldScript = !!s.keyHash && !!summary && Number(summary.scriptVersion ?? 0) < 2;

  return (
    <MoneyShell current="/private/money/income">
      <nav aria-label="Breadcrumb" className="text-small text-muted"><Link href="/private/money/income" className="underline-offset-4 hover:text-ink hover:underline">Income</Link> <span aria-hidden="true">/</span> Settings</nav>
      <Label className="mt-4">Income</Label>
      <h1 className="mt-3 text-title font-normal">Income settings</h1>
      {sp.saved && <p className="mt-4"><State kind="ok">Saved.</State></p>}

      <section aria-labelledby="cal" className="mt-8 max-w-[760px]">
        <h2 id="cal" className="text-h2 font-normal">Work calendar</h2>
        <Card className="mt-4 grid gap-4">
          <p className="text-body text-ink-2">A small script in your own Google account reads your work days (events in your work or paid color on your main calendar) every 15 minutes, and within a minute of pressing Refresh on Income. It turns an event your paid color once its pay is in the bank. It never creates, moves or deletes events.</p>
          {oldScript && <State kind="note">Your script is the older one that reads once a day. Make a new script below and run setup again for 15-minute reads and Refresh.</State>}
          {s.keyHash ? (
            <State kind={s.lastRunAt ? "ok" : "note"}>
              {s.lastRunAt
                ? `Last read ${new Date(s.lastRunAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${summary ? `: ${summary.sent ?? 0} work events, ${summary.recolored ?? 0} turned paid${summary.errors ? `, ${summary.errors} couldn’t be changed` : ""}` : ""}.`
                : "Script made. It reports here after its first run (run setup once)."}
            </State>
          ) : null}
          <CalendarScriptForm connected={!!s.keyHash} />
        </Card>
      </section>

      <section aria-labelledby="import" className="mt-10 max-w-[760px] scroll-mt-6">
        <h2 id="import" className="text-h2 font-normal">Import an older calendar</h2>
        <Card className="mt-4 grid gap-4">
          <p className="text-body text-ink-2">Work days kept in another calendar before this one (a Yahoo calendar, say). Export it as an .ics file, or copy its share link, then pick the events that were work. Imported days show on the work calendar like the Google ones; the script never changes or removes them.</p>
          {sp.imported && <State kind="ok">Imported {sp.imported} {sp.imported === "1" ? "event" : "events"}.</State>}
          {sp.removed && <State kind="ok">Removed {sp.removed} imported {sp.removed === "1" ? "event" : "events"}.</State>}
          {imported.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-btn border border-line px-4 py-3">
              <span className="text-body text-ink-2">{imported.length} imported {imported.length === 1 ? "event" : "events"}, {importedRange}</span>
              <form action={removeImported}><Button type="submit" variant="quiet">Remove all imported</Button></form>
            </div>
          )}
          <IcsImport defaultFrom={`${new Date().getFullYear()}-01-01`} defaultBefore="2026-10-05" />
        </Card>
      </section>

      <form action={saveIncomeSettings} className="mt-10 grid max-w-[760px] gap-10">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-h2 font-normal">Colors</legend>
          <Pick label="Work days (worked, not paid)" name="workColor" value={c.workColor} />
          <Pick label="Paid" name="paidColor" value={c.paidColor} />
          <label className="flex min-h-11 items-center gap-3 text-body sm:col-span-2">
            <input type="checkbox" name="recolor" defaultChecked={c.recolor} className="size-5 accent-ink" />
            Turn an event the paid color when all its days are paid and in the bank
          </label>
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="mb-2 text-h2 font-normal">Rates and pay</legend>
          <p className="text-small text-muted">Your straight-time hourly rate. Stubs paying less get flagged, and days still waiting on pay are estimated with California overtime (1.5× after 8 hours, 2× after 12). The employer name matches a stub&rsquo;s employer or show, or a calendar event&rsquo;s title.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Num label="Usual rate ($/hour)" name="defaultRate" value={c.defaultRate} />
            <Num label="Hours in a usual day" name="defaultHoursPerDay" value={c.defaultHoursPerDay} />
            <Num label="Pay is late after (days)" name="payLagDays" value={c.payLagDays} />
          </div>
          {rateRows.map((r, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr] gap-3">
              <label className="grid gap-1"><span className="text-small text-ink-2">Employer, show or event title</span><input name={`rate_employer_${i}`} defaultValue={r?.employer ?? ""} className={FIELD} /></label>
              <Num label="Rate ($/hour)" name={`rate_rate_${i}`} value={r?.rate ?? null} />
            </div>
          ))}
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-h2 font-normal">Health plan hours</legend>
          <p className="text-small text-muted sm:col-span-2">Set these from your plan&rsquo;s rules (the Motion Picture plan, for example: 400 hours per six months to keep coverage, banking up to 450). Your plan&rsquo;s own count is the authority.</p>
          <label className="grid gap-1"><span className="text-small text-ink-2">Plan name</span><input name="healthName" defaultValue={c.health.name} className={FIELD} /></label>
          <Num label="Hours needed per period" name="healthHours" value={c.health.hoursPerPeriod} />
          <label className="grid gap-1">
            <span className="text-small text-ink-2">Period length</span>
            <select name="healthMonths" defaultValue={String(c.health.periodMonths)} className={FIELD}>
              {[1, 2, 3, 4, 6, 12].map((m) => <option key={m} value={m}>{m} {m === 1 ? "month" : "months"}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-small text-ink-2">A period starts in</span>
            <select name="healthFirstMonth" defaultValue={String(c.health.firstMonth)} className={FIELD}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <Num label="Bank cap (hours)" name="healthBank" value={c.health.bankCap} />
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-h2 font-normal">Tax estimate</legend>
          <label className="grid gap-1">
            <span className="text-small text-ink-2">Filing</span>
            <select name="filing" defaultValue={c.tax.filing} className={FIELD}>
              <option value="joint">Married filing jointly</option>
              <option value="single">Single</option>
            </select>
          </label>
          <div />
          <Num label="Other household wages this year ($)" name="otherWages" value={c.tax.otherWages} />
          <Num label="Federal tax withheld from those ($)" name="otherWithheld" value={c.tax.otherFederalWithheld} />
          <label className="flex min-h-11 items-center gap-3 text-body sm:col-span-2">
            <input type="checkbox" name="overtimeDeduction" defaultChecked={c.tax.overtimeDeduction} className="size-5 accent-ink" />
            Count the “no tax on overtime” deduction (only overtime federal law requires: after 40 hours in a week)
          </label>
        </fieldset>

        <Button type="submit" className="justify-self-start">Save settings</Button>
      </form>
    </MoneyShell>
  );
}

function Pick({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-small text-ink-2">{label}</span>
      <select name={name} defaultValue={value} className={FIELD}>
        {COLORS.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
      </select>
    </label>
  );
}

function Num({ label, name, value }: { label: string; name: string; value: number | null }) {
  return (
    <label className="grid gap-1">
      <span className="text-small text-ink-2">{label}</span>
      <input name={name} inputMode="decimal" defaultValue={value ?? ""} className={FIELD + " tabular-nums"} />
    </label>
  );
}
