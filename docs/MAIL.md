# Morning Mail (`/private/mail`)

The owner's morning email report, behind the Private password. Built
2026-10-18 as a trial next to the Claude-written "Morning Mail" artifact (a 7 am `/mail` Claude run on
the home server, owner's call: "make that all code so Claude isn't involved"). **Since 2026-10-24 an
AI read sorts and summarizes each email** (owner: the code-only sorting kept missing what the
Claude version caught; "Do it").

## The AI read (2026-10-24)
- `src/tools/mail/ai.ts` (brief, prompt, reply parsing, `mergeAi`) + `src/lib/mail/ai-sort.ts` (the
  call). Vercel AI Gateway, OIDC token, **free tier: `google/gemini-2.5-flash`** (Claude models are
  refused on the free tier, docs/MONEY.md). `MAIL_AI_MODEL` switches model; `MAIL_AI=off` disables.
- Sent: sender, subject, first 400 characters, one request per 40 emails, 25 s timeout. Cost sits
  inside the gateway's free monthly credit at ~100 emails a day.
- The code classifier still runs first and is the fallback. The model cannot override: the owner's
  rules; a code "security" call (it may add a summary, or promote something to security).
- `mail.messages.sorted_by` = `ai` | `code`; the page footer says how many of today's emails the
  AI sorted. "Sort the last week again" re-reads the week through the AI too.
- Tests: `src/tools/mail/mail-ai.test.mts` (mutation round 9/9).

## How it works
```
Gmail ── Apps Script in the owner's Google account (daily ~6 am) ──► POST /api/mail/gmail
Yahoo ── IMAP, app passwords, Vercel Cron 14:02 UTC (≈7 am PT) ──► /api/mail/run
                                   │
              classify + owner's rules (src/tools/mail/)
                                   ▼
         Supabase schema `mail` (role money_app) ──► /private/mail (report, ✓, rules)
```
- **Gmail** runs as the owner (`src/tools/mail/gmail-script.ts`), so there is no OAuth token to
  expire weekly (the Books lesson). It sends sender, subject, a 600-char preview and the
  List-Unsubscribe headers, never whole bodies, and performs the moves the server answers with.
  The key is stored as SHA-256 only; making a new script stops the old one.
- **Yahoo** (`src/lib/mail/yahoo.ts`): imap.mail.yahoo.com:993 with an app password, sealed with
  AES-256-GCM under `MAIL_SECRET_KEY`. New mail by UID watermark (reset on UIDVALIDITY change),
  first run reads two days.
- **Classifier** (`src/tools/mail/classify.ts`, pure, tested): owner rules, then security
  (sign-ins, new devices, breaches; a bare verification code is info), then needs you (bills with
  amount and due date, things expiring, a person writing), then bulk (List-Unsubscribe or
  marketing), else other (counted only). Security is checked before bulk on purpose, but from a
  mailing list (List-Unsubscribe, or a marketing subject) only the SUBJECT counts: newsletter
  bodies say "sign in" constantly (a Vercel AI Gateway promo landed under Security on 2026-10-20).
  Every row leads with the subject; "From <sender>" is the second line, a person's email included.
- **Report** (`src/tools/mail/report.ts`): needs-you and security items carry forward up to 7
  days until ticked ✓; codes show only on their day; Done lines per account; unsubscribe by hand;
  still arriving 3+ days after an unsubscribe; couldn't do; mailing lists with one-tap rules.

## Mail is moved only by the owner's rules
No rule, no change. Actions: Trash (the account's own, recoverable), file in a folder/label,
unsubscribe (only a one-click RFC 8058 link, pressed by the server; plain links and mailto are
listed for the owner, since this never sends mail), ignore, always-needs-you. A rule made from the
Today page also applies to that sender's mail from the last two days. Nothing is ever sent or
permanently deleted.

## Environment (Vercel, Sensitive)
`MONEY_DATABASE_URL` (shared with Money), `CRON_SECRET` (shared), `MAIL_SECRET_KEY` (64 hex chars;
changing it makes saved Yahoo passwords unreadable, so re-add the accounts).

## Schema
`docs/sql/mail-schema.sql` (applied to Supabase as migration `mail_schema`, 2026-10-18). Only
`money_app` can read it; checked that CampHawk's anon and service_role cannot.

## Tested / not tested
- Unit: classifier, rules, plan, report (24), the Gmail script in a vm (3), with mutation checks.
- End to end locally: the real Gmail script against a local server and database, nine messages
  modeled on real mail; rules trashed and filed; a failed unsubscribe left mail alone; a second
  run sent nothing.
- **Not tested: Yahoo against a real Yahoo server** (the workspace cannot reach it). The first
  real run is the test; errors show on the page and in Recent checks.

## Owner steps
1. Accounts & rules → Make my Gmail script → paste into script.google.com → run `setup`.
2. For each Yahoo account: Yahoo Account Security → Generate app password → add it.
3. **Trial (owner, 2026-10-18): keep the Claude `/mail` run going too** and compare the two. Turn one off once decided.
