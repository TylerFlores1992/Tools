import "server-only";
import { buildReport, accountLabel, addDays, CARRY_DAYS, type AccountStatus, type Report } from "@/tools/mail/report";
import { isConfigured } from "@/lib/money/db";
import { pacificDate } from "./ingest";
import { dayCounts, getAccounts, getDismissed, getGmailSettings, getRows, getUnsubscribed, listRules } from "./store";

export type MailPage =
  | { state: "not-configured" }
  | { state: "unreachable" }
  | {
      state: "ok";
      today: string;
      date: string;
      report: Report;
      dismissed: Set<string>;
      accounts: AccountStatus[];
      history: Array<{ date: string; total: number; needs: number }>;
      gmailConnected: boolean;
    };

export async function loadMail(date?: string): Promise<MailPage> {
  if (!isConfigured()) return { state: "not-configured" };
  const today = pacificDate();
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today ? date : today;
  try {
    // One at a time on purpose: Supabase's pooler stalls pipelined queries (see db.ts).
    const rows = await getRows(addDays(day, -(CARRY_DAYS - 1)));
    const dismissed = await getDismissed();
    const unsubscribed = await getUnsubscribed();
    const accounts = await getAccounts();
    const rules = await listRules();
    const history = await dayCounts(addDays(today, -13));
    const gmail = await getGmailSettings();
    const covered = new Set(rules.map((r) => (r.matchFrom ?? "").toLowerCase()).filter((f) => f.includes("@")));
    const accountErrors = accounts.filter((a) => a.enabled && a.lastError).map((a) => `${accountLabel(a.id)}: ${a.lastError}`);
    const report = buildReport({ date: day, rows: rows.filter((r) => r.reportDate <= day), dismissed, unsubscribed, ruleCoveredAddrs: covered, accountErrors });
    const statuses: AccountStatus[] = accounts.map((a) => ({
      id: a.id,
      label: accountLabel(a.id),
      ok: a.lastRunAt ? !a.lastError : null,
      lastRunAt: a.lastRunAt,
      error: a.lastError,
    }));
    return { state: "ok", today, date: day, report, dismissed, accounts: statuses, history, gmailConnected: Boolean(gmail.keyHash) };
  } catch (e) {
    console.error("mail load failed", e instanceof Error ? e.name : "unknown");
    return { state: "unreachable" };
  }
}
