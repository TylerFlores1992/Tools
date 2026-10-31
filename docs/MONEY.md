# Money tracker (`/private/money`)

Household spending, income and recurring payments for Tyler and his wife, behind the Private
tab's password. Built 2026-10-18.

## How it works
```
Chase, U.S. Bank ──► SimpleFIN Bridge (~$1.50/mo, owner's account)
                         │  daily, read-only
                         ▼
   Vercel Cron 14:13 UTC (≈7am PT) ──► /api/money/sync ──► Supabase project
                                                            schema `money` (role money_app)
                         ▲
   /private/money (Overview · Transactions · Settings) ─────┘
```
- **Bank link:** SimpleFIN Bridge. The owner pastes a one-time *setup token* on Settings; the
  site claims it once for an *access URL* (the real credential, read-only) and stores it in
  `money.settings`. Bridge refreshes from banks about once a day and allows ~24 requests a day,
  so: one cron run a day + "Sync now" capped at 6 a day.
- **First sync** backfills 90 days (two 45-day requests); later syncs re-read 14 days. Pending
  rows in the window are replaced each time (banks can re-id them on posting).
- **Categories:** manual (set on a transaction) > rule (owner's "Always file X this way",
  `money.rules`, matched on raw text *and* merchant key) > keyword list
  (`src/tools/money/categorize.ts`). Re-syncs never overwrite manual.
- **Transfers** between the household's own accounts don't count as money in/out: keyword list,
  plus same-amount/opposite-sign pairs within 5 days across accounts (Chase → U.S. Bank takes up
  to 4). Only auto-filed rows still Uncategorized / Other income / Transfer are paired, so a real
  purchase is never hidden; every sync re-pairs the whole history.
- **Owner's rule (2026-10-18): Mine → Joint is spending.** In the Mine view a transfer to a Joint
  account counts as money out ("Transfer to Joint"); in the Joint view it is money in. Everything
  still counts it as neither, or the bills it pays would be counted twice. Paying his own card from
  his own checking stays a transfer everywhere, because the card's purchases already count
  (`transfersAcross` in `summary.ts`). Marcus (Goldman Sachs Bank) transfers are transfers; once
  Marcus is connected and set to Mine, savings moves count as neither in Mine.
- **Keywords match whole words** (2026-10-18): "MOBIL" used to file US Mobile as Gas and
  "WATER" filed Stillwater Insurance as Utilities. The list was rebuilt from the owner's real
  merchants; new categories Loans, Savings & investing, Paid to people (Zelle/Venmo out, which
  used to vanish as Transfer). Every sync, import and the Settings "Re-file categories" button
  re-files all history that wasn't set by hand. "Always file this way" is ticked by default.
  On the owner's data: Uncategorized 119 → 15 of 362.
- **Recurring:** `src/tools/money/recurring.ts` groups by merchant key and fits weekly,
  every 2 weeks, twice a month, monthly (≥3 seen, or 2 of the same amount), every 2 months,
  quarterly, yearly (≥2). Amounts must stay within 50% of the median; >15% swing shows "≈".
  Bill categories (Utilities, Software, Phone & internet, Subscriptions, Insurance, Housing,
  Loans) may vary in amount and count after two monthly charges, and one name can hold two bills
  (Spectrum internet + mobile). Dining, Groceries, Gas, Shopping and Fees are never bills.
- **Refunds (2026-10-18, owner):** money in under a spending category is a refund and is taken
  off that category's spending, never counted as income (GSPro and Rapsodo charged and refunded).
  Keyword merchants keep their category on a refund; for unknown merchants `findRefunds` matches
  money in to an earlier charge from the same merchant of at least that amount within 120 days.
  Income is only the Income and Other income categories (plus Joint receiving from Mine).
- **Transfer to joint is a bill** in the Mine view ("Transfer to Joint", monthly); Everything
  leaves it out, since the bills it pays are already there.
- **Budget (`/private/money/budget`, `src/tools/money/budget.ts`):** needed each month = bills
  (active recurring, monthly equivalent) + everyday spending (everything else out, net of
  refunds, averaged over up to three full months the history covers). Savings & investing are
  kept apart; left over = money in − needed − saving. Cash on hand sums the view's balances (cards
  count against it); the 30-day list runs cash down by each expected bill.
- **Charts:** money in vs out by month on the overview (year or last 12 months), and in vs needed
  on the budget. In = solid ice, out = hatched series-2, legend in words, a tooltip per bar, and a
  table of the same numbers. Validated with the dataviz script: CVD separation passes in both
  themes; the dark theme's two hues sit above the lightness band, which the hatching and labels
  cover.
- **Income** is irregular gig pay from several payrolls plus check deposits, so it is shown as
  "Where it came from" (money in by payer; check deposits grouped) rather than relying on the
  Recurring list.
- **Older history (CSV import, 2026-10-18).** SimpleFIN only reaches back 90 days (Actual Budget's
  SimpleFIN docs say the same), so months before that come from each bank's own CSV download,
  imported per account on Settings (`src/tools/money/csv.ts` reads columns by header name;
  `src/lib/money/import.ts` stores them). Rows dated on or after the account's first synced
  transaction are skipped, so overlap can't double anything; ids are `csv:` + a row hash, so a
  repeat import adds nothing; "Undo import" deletes only that account's `csv:` rows. The header
  names for Chase and U.S. Bank were written from the documented formats, not from a real file:
  if a real export is refused, the error names the columns it wanted.
- **Month and year (2026-10-18).** Overview takes `?month=YYYY-MM` or `?year=YYYY`, with month
  chips for the year and a year stepper. The year view has a month-by-month table and "about $X a
  month" averages over months that have data. Pages load at least back to January of last year.
- **Views:** Everything / Mine / Joint, from each account's owner (Settings). Hidden accounts
  count nowhere.

## Where the code is
| What | Where |
|---|---|
| Pure logic + tests (`money.test.mts`) | `src/tools/money/` |
| DB client, queries, sync, session guard | `src/lib/money/` |
| Pages + Server Actions | `src/app/private/money/` |
| Cron + health | `src/app/api/money/{sync,health}/route.ts`, `vercel.json` |

## Security (why it's built this way)
- The data lives in CampHawk's Supabase project (the owner declined a second, paid project) but
  in its **own schema, not exposed to the Data API**, with grants and RLS for `money_app` only.
  CampHawk's `anon` and `service_role` can't read it (checked 2026-10-18). Never grant them.
- Pages and actions re-check the session (`src/lib/money/guard.ts`) on top of `src/proxy.ts`.
- `/api/money/sync` needs `Authorization: Bearer $CRON_SECRET`; unset = refuses everyone.
- `/api/money/health` says only `ok` / `not set` / `unreachable`.
- Never log transactions, the access URL or the DB URL. Errors are logged by name only.

## Environment variables (Vercel, Production + Preview, Sensitive; set 2026-10-18)
| Name | What |
|---|---|
| `MONEY_DATABASE_URL` | `postgresql://money_app.<project-ref>:<password>@aws-1-us-west-2.pooler.supabase.com:6543/postgres` (transaction pooler; Vercel can't reach Supabase's IPv6-only direct host; `aws-0-…` answers "unreachable" for this project) |
| `CRON_SECRET` | Any long random string; Vercel Cron sends it |
| `LAB_PASSWORD` | Already set: the Private password (wife uses the same one) |

**Rotate the database password:** in Supabase SQL editor
`alter role money_app password '<new>';` then edit `MONEY_DATABASE_URL` in Vercel and redeploy.

## Local testing
No Supabase from the workspace (pooler host not resolvable). Use a throwaway Postgres
(`/usr/lib/postgresql/16/bin`), run the schema with `money_app` login, and set
`MONEY_DATABASE_URL=postgres://money_app:local@localhost:5544/postgres?sslmode=disable`
(`sslmode=disable` turns TLS off for local only). Google Fonts is blocked here, so to build
locally, stub the two `next/font/google` calls in `src/app/private/camphawk/layout.tsx`, build,
then restore the file by copy (CI builds the real thing).

## Status (2026-10-18)
- Merged as #54 and deployed. `/api/money/health` reads `ok` in production, and `/private/money`
  lands on the sign-in page when signed out.
- `MONEY_DATABASE_URL` and `CRON_SECRET` are set in Vercel (Production + Preview, Sensitive). The
  `money_app` password was generated in a session, so rotate it if that matters (above).
- **Not yet connected to SimpleFIN.** The first real sync happens when the owner pastes a setup
  token on Settings. Until then the daily cron logs "Not connected to SimpleFIN yet."
- Nothing here calls an AI model at run time: the sync, categories and recurring detection are
  plain code. Claude can read the data on request through the Supabase connector (`money` schema).

## Gotcha: Supabase's pooler and pipelining (2026-10-18)
Every money page hung for 300 s in production while `/api/money/health` answered: the pages ran
reads with `Promise.all` on a one-connection pool, postgres.js pipelined them, and Supavisor's
transaction pooler stalls a pipelined connection. Local Postgres has no pooler, so local tests
passed. Fixed with `max: 8` in `db.ts` and sequential reads in `load.ts`.
`/api/money/health?parallel=1` probes it, and `npm run smoke` checks it.

## Gotcha: the owner picker showed the old value after Save (2026-10-18)
React resets a form after its Server Action, and a reset `<select>` shows the value it was first
rendered with, not the new `defaultValue`. The save had worked; the picker lied. Each account's form
is keyed on its saved values so it remounts. Reproduced and fixed in a real browser locally.

## Income (`/private/money/income`, built 2026-10-19) {#income}
The owner is a stagehand paid weekly by several payroll companies, mostly on paper checks, and kept
his work days in Google Calendar (Tangerine = worked, Tomato = paid). Income ties the three together.
- **Stubs and W-2s:** photo or PDF on `/income/add` (shrunk to 2200 px JPEG in the browser, 4 MB
  cap, `serverActions.bodySizeLimit` 4.5 MB) → stored in `money.stub_files` (bytea, private route
  `/income/stubs/<id>/file`) → read by a vision model (`src/lib/money/income/read-document.ts`,
  which models in `src/tools/money/income/read-models.ts`). **Since 2026-10-31 it goes straight
  to Google on the free AI Studio key** (`MONEY_GEMINI_API_KEY`, else Mail's `MAIL_GEMINI_API_KEY`;
  models tried in turn: `MONEY_GEMINI_MODEL`, `gemini-3.5-flash-lite`, `gemini-3.8-flash`,
  `gemini-flash-lite-latest`; up to 60 s each, 110 s in all, pages allow 120 s. Full Flash first
  timed out on a real photo on 2026-10-31, so Lite leads). Vercel AI Gateway read them before and is still used
  when no key is set (`MONEY_STUB_MODEL`, default `google/gemini-2.5-flash`), but its free credit
  ran out ("A positive credit balance is required", every read on 2026-10-31 failed with it).
  **Privacy, the owner's call 2026-10-31:** Google's free tier may use what it is sent to improve
  its products, and a stub photo can't be masked the way Mail masks long numbers, so employee
  number, IDs and pay amounts go as they are. The owner accepted that. A paid Gemini key (set
  `MONEY_GEMINI_API_KEY`) stops Google using the data.
  A failed read says why: out of credit, free quota used up, key refused, too slow, or unreadable.
  Probe: `/api/money/health?ai=<MONEY_PROBE_KEY>` (the same models, text stub; `&model=<provider/model>`
  tries one gateway model instead).
  Owner's call (2026-10-19): use AI. **Nothing counts until the owner saves the review screen.**
  Text shaped like an SSN or account number is blanked in every stored field (`noSsn`); the photo
  itself keeps whatever is printed (stubs show the last 4), and can be deleted after saving.
- **Adding** (`/income/add`, `BulkUploadForm` → `uploadOne`): one file opens its review screen;
  several (owner, 2026-10-19: "upload more than one at a time") are
  sent one at a time from the page (each read is its own request, inside the 60 s limit), each
  landing in "Waiting for you to check". A file byte-for-byte already stored is skipped
  (`findStubByFile`, md5 in SQL). One stub per file: a PDF holding several stubs is read as one.
- **Reissued weeks** (`reissue.ts`): payroll re-runs a week (Project Goose's union reissue, Aug 2026)
  with a stub that recomputes gross and taxes and takes back the first check's take-home ("NET
  PRIOR"). The first stub is "replaced": its take-home still counts as paid and matches its own
  deposit; gross, taxes, hours, withholding, the W-2 check and health hours come from the reissue.
  Worked out from the data each time (same period, later pay date, take-back equals the first net,
  to the cent), so nothing is stored.
- **Estimated stubs** (`estimate.ts`, column `estimated`): for pay with no stub. From a later stub's
  year-to-date (YTD minus the stubs we have = exactly what the missing checks add to; split across
  them by take-home), or from the saved stubs with the closest take-home. gross − taxes = take-home
  on each. Tagged "Estimate". A real stub that matches the same deposit, or the same take-home
  within two weeks, replaces it (`matchDepositsAndEstimates`, run on every save and bank sync).
- **EDD benefits** (`benefits.ts`, kind `benefit`): each EDD deposit is filed on Income as Paid
  Family Leave or Disability Insurance. Per EDD's 1099G FAQ (read 2026-10-20): PFL is taxable on the
  federal return only, nothing withheld; DI usually not taxable; neither taxed by California;
  neither is wages. PFL is added to the federal withholding estimate.
- **Stubs still missing** (`missing.ts`): this year's deposits that look like pay (named payroll
  companies, generic PAYROLL/PR DEPOSIT wording, phone check deposits; never EDD, tax refunds,
  transfers, Zelle, Stripe), grouped by payer, minus the ones a saved stub matched. The same
  deposit in two accounts on the same day counts once (a bank CSV imported into the wrong account
  would otherwise list it twice).
- **Checks on every stub** (`checks.ts`): gross − taxes − deductions = net; lines add up to gross;
  hours × rate per line; OT at 1.5× / 2× the straight rate; rate below the owner's; SS 6.2%,
  Medicare 1.45%, CA SDI 1.3% (2026); year-to-date carries on from the last stub (a gap = a
  missing stub). Words, never colour.
- **Deposits** (`match.ts`): net pay to the cent, −3 to +30 days of the pay date (paper checks get
  deposited late), one stub per deposit, a deposit naming the payroll company wins. Runs on save
  and after every bank sync. The owner can pick another or say "no deposit". A pending deposit
  counts (a phone check sits pending a day or two; until 2026-10-20 two cleared NBC checks still
  read "not in the bank"); a posted one wins over it. The sync deletes and rewrites pending rows,
  which unlinks the stub (`on delete set null`), and the rematch after the sync links it again.
- **Work calendar** (`calendar.ts`, `ui/WorkCalendar.tsx`, section `#calendar`): the month of
  work days from the synced calendar events, each with its status as a word and a glyph (✓ Paid,
  ◐ Stub in, ○ Waiting, ! Late, ◇ Booked, drawn as SVG marks in `ui/PhoneCalendars.tsx`) and a
  border shape; colour only repeats it. A grid at 640 px and up; on a phone, a month of marks where
  tapping a day lists its jobs underneath (owner's pick of five layouts, 2026-10-21). `?cal=YYYY-MM` picks the month, between the
  first event and this month (or the last booked one). A paid day links to its stub.
- **Calendar:** an Apps Script in the owner's account (`calendar-script.ts`, made on
  `/private/money/settings#income` since 2026-10-20, where every Money and Income setting now lives;
  `/income/settings` redirects there; key stored as SHA-256) posts work days to `/api/money/calendar` and
  recolours an event Tomato when every day of it is paid (owner: "Recolor for me"). Same reason as
  Morning Mail's Gmail script: an unverified OAuth app's token dies every 7 days.
  Day status (`workdays.ts`): scheduled / waiting (late after `payLagDays`) / stub in / paid /
  marked (already Tomato, from before this). A stub claims days via its "work days" ticks, which
  default to the calendar days in its pay period.
- **Expected pay** for waiting days: the owner's hourly rate (per employer/show/title, or usual)
  × usual hours a day, with California daily overtime (1.5× after 8, 2× after 12).
- **Health-plan hours** (`health.ts`): straight + OT hours from saved stubs per period; plan rules
  are settings (default 400 hours / 6 months from January, like the Motion Picture plan). The
  plan's own count is the authority. Which plan covers the owner's Local 33 work: not established.
- **Federal withholding check** (`withholding.ts`): 2026 brackets and standard deduction (IRS Rev.
  Proc. 2025-32), joint by default, "nothing more this year" vs "at this pace". The no-tax-on-
  overtime deduction is off by default: it covers FLSA overtime only, not CA daily or union OT.
  **California is not estimated** (2026 schedule unpublished when built). Not tax advice.
- **W-2 check:** each saved W-2 against that employer's saved stubs for the year (withholding boxes
  to the cent; box 1 above gross = a missing stub). Employer matching accepts the payroll company
  as the W-2 employer of record (`sameEmployer`).
- **Probe:** `/api/money/health?ai=<MONEY_PROBE_KEY>` reads a made-up stub the way a real read does
  and says ok/failed and which model answered. The key is a Vercel env var (sensitive); each call
  spends a little free quota.
- Tables: `docs/sql/money-income.sql` (stubs, stub_files, work_events, income_settings).

## Ideas not built yet
Budgets per category with a monthly target · weekly summary email · CSV export · splitting a
transaction · a spending-over-time chart.
