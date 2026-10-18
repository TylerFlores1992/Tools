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
  plus same-amount/opposite-sign pairs within 3 days across accounts (only for rows still
  Uncategorized / Other income, so a real purchase is never hidden).
- **Recurring:** `src/tools/money/recurring.ts` groups by merchant key and fits weekly,
  every 2 weeks, twice a month, monthly (≥3 seen), quarterly, yearly (≥2). Amounts must stay
  within 50% of the median; >15% swing shows "≈".
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

## Environment variables (Vercel, Production + Preview, Sensitive)
| Name | What |
|---|---|
| `MONEY_DATABASE_URL` | `postgresql://money_app.<project-ref>:<password>@<pooler-host>:6543/postgres` (transaction pooler; Vercel can't reach Supabase's IPv6-only direct host) |
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

## Ideas not built yet
Budgets per category with a monthly target · weekly summary email · CSV export · splitting a
transaction · a spending-over-time chart.
