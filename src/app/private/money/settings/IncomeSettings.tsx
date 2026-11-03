import { Card } from "@/components/Card";
import { State } from "@/components/State";
import { SubmitButton } from "@/components/SubmitButton";
import { getIncomeSettings, listEvents, type IncomeSettings as Settings } from "@/lib/money/income/store";
import { toLocalDate } from "@/tools/money/simplefin";
import { Unreachable } from "@/tools/money/ui/Setup";
import type { WorkEvent } from "@/tools/money/income/types";
import { CalendarScriptForm } from "@/tools/money/income/ui/IncomeForms";
import { IcsImport } from "@/tools/money/income/ui/IcsImport";
import { isImportedEvent } from "@/tools/money/income/ics";
import { removeImported, saveIncomeSettings } from "../income/actions";

// Google Calendar's own names for its event colour ids.
const COLORS: Array<[string, string]> = [
  ["1", "Lavender"], ["2", "Sage"], ["3", "Grape"], ["4", "Flamingo"], ["5", "Banana"], ["6", "Tangerine"],
  ["7", "Peacock"], ["8", "Graphite"], ["9", "Blueberry"], ["10", "Basil"], ["11", "Tomato"],
];
const longDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const FIELD = "field min-h-11 w-full min-w-0 rounded-input border border-control bg-surface px-3 text-body text-ink";

/**
 * The owner kept work days in Yahoo until he moved to Google Calendar on this day (ics.ts), so an
 * older calendar's import ends here by default; the script reads Google from then on.
 */
const MOVED_TO_GOOGLE = "2026-10-05";
/** Today in Pacific time, read once per request (a server component renders once). */
const todayPacific = () => toLocalDate(Date.now() / 1000);

/**
 * The Income part of Money → Settings: the work calendar script, importing an older calendar, and
 * pay, health plan and tax settings. Lives on the one Settings page (owner, 2026-10-20: "Income
 * settings is kind of hidden"); /private/money/income/settings redirects here.
 */
export async function IncomeSettings({ saved, failed, imported: imported_, removed }: { saved?: boolean; failed?: string; imported?: string; removed?: string }) {
  // One query at a time (src/lib/money/db.ts). If the database doesn't answer, say so here
  // instead of taking the whole Settings page down.
  let s: Settings;
  let events: WorkEvent[];
  try {
    s = await getIncomeSettings();
    events = await listEvents();
  } catch (e) {
    console.error("money income settings load failed", e instanceof Error ? e.name : "unknown");
    return (
      <section aria-labelledby="cal" className="max-w-[720px] scroll-mt-6">
        <h2 id="cal" className="text-h2 font-normal">Work calendar, pay and taxes</h2>
        <div className="mt-4"><Unreachable /></div>
      </section>
    );
  }
  const c = s.config;
  const rateRows = [...c.rates, ...Array.from({ length: 3 }, () => null)];
  const summary = (s.lastSummary ?? null) as { sent?: number; recolored?: number; errors?: number; scriptVersion?: string } | null;
  const imported = events.filter((e) => isImportedEvent(e.eventId));
  const today = todayPacific();
  const importedRange = imported.length ? `${longDay(imported[0].startDay)} to ${longDay(imported[imported.length - 1].startDay)}` : "";
  const oldScript = !!s.keyHash && !!summary && Number(summary.scriptVersion ?? 0) < 2;

  return (
    <>
      <section aria-labelledby="cal" className="max-w-[720px] scroll-mt-6">
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

      <section aria-labelledby="import" className="max-w-[720px] scroll-mt-6">
        <h2 id="import" className="text-h2 font-normal">Import an older calendar</h2>
        <Card className="mt-4 grid gap-4">
          <p className="text-body text-ink-2">Work days kept in another calendar before this one (a Yahoo calendar, say). Export it as an .ics file, or copy its share link, then pick the events that were work. Imported days show on the work calendar like the Google ones; the script never changes or removes them.</p>
          {imported_ && <State kind="ok">Imported {imported_} {imported_ === "1" ? "event" : "events"}.</State>}
          {removed && <State kind="ok">Removed {removed} imported {removed === "1" ? "event" : "events"}.</State>}
          {failed === "import" && <p role="alert"><State kind="wrong">Nothing was changed: the money database didn’t answer. Try again in a minute.</State></p>}
          {imported.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-btn border border-line px-4 py-3">
              <span className="text-body text-ink-2">{imported.length} imported {imported.length === 1 ? "event" : "events"}, {importedRange}</span>
              <form action={removeImported}><SubmitButton variant="quiet" pending="Removing…" confirm={`Remove all ${imported.length} imported ${imported.length === 1 ? "event" : "events"}? Days from your Google Calendar stay.`}>Remove all imported</SubmitButton></form>
            </div>
          )}
          <IcsImport defaultFrom={`${today.slice(0, 4)}-01-01`} defaultBefore={today < MOVED_TO_GOOGLE ? today : MOVED_TO_GOOGLE} />
        </Card>
      </section>

      <section aria-labelledby="pay" className="max-w-[720px] scroll-mt-6">
        <h2 id="pay" className="text-h2 font-normal">Pay, health plan and taxes</h2>
        {saved && <p className="mt-3"><State kind="ok">Saved.</State></p>}
        {failed === "income" && <p role="alert" className="mt-3"><State kind="wrong">Not saved: the money database didn’t answer. Try again in a minute.</State></p>}
      {/* Keyed on the saved settings: React resets a form after its action, and a reset <select>
          would show the value it first rendered with, not the one just saved (docs/MONEY.md). */}
      <form key={JSON.stringify(c)} action={saveIncomeSettings} className="mt-6 grid gap-10">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-h3 font-medium">Colors</legend>
          <Pick label="Work days (worked, not paid)" name="workColor" value={c.workColor} />
          <Pick label="Paid" name="paidColor" value={c.paidColor} />
          <label className="flex min-h-11 items-center gap-3 text-body sm:col-span-2">
            <input type="checkbox" name="recolor" defaultChecked={c.recolor} className="size-5 accent-ink" />
            Turn an event the paid color when all its days are paid and in the bank
          </label>
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="mb-2 text-h3 font-medium">Rates and pay</legend>
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
          <legend className="mb-2 text-h3 font-medium">Health plan hours</legend>
          <label className="flex min-h-11 items-center gap-3 text-body sm:col-span-2">
            <input type="checkbox" name="healthShow" defaultChecked={c.health.show} className="size-5 accent-ink" />
            Show health plan hours on Income
          </label>
          <p className="text-small text-muted sm:col-span-2">Off unless all your hours count toward one plan: stubs can&rsquo;t tell which union&rsquo;s plan an hour went to, or whether non-union work counted. Set these from your plan&rsquo;s rules (the Motion Picture plan, for example: 400 hours per six months to keep coverage, banking up to 450). Your plan&rsquo;s own count is the authority.</p>
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
          <legend className="mb-2 text-h3 font-medium">Tax estimate</legend>
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

        <SubmitButton pending="Saving…" className="justify-self-start">Save settings</SubmitButton>
      </form>
      </section>
    </>
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
