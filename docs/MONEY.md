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
- **Recurring:** `src/tools/money/recurring.ts` groups by merchant key and fits weekly,
  every 2 weeks, twice a month, monthly (≥3 seen), quarterly, yearly (≥2). Amounts must stay
  within 50% of the median; >15% swing shows "≈".
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

## Ideas not built yet
Budgets per category with a monthly target · weekly summary email · CSV export · splitting a
transaction · a spending-over-time chart.
