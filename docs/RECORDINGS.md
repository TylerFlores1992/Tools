# Recordings (the home DVR)

`/private/recordings` manages the DVR that runs on the home server. Built 2026-10-30.

## What it does
- **Upcoming:** what will record, by day. Skip one episode, cancel a one-time recording, or stop
  one that's running. Shows a warning when more channels record at once than there are provider lines.
- **Library:** episodes by show, with length, size and ad status. Delete moves an episode to the
  Trash, with Undo. "Put ads back" swaps in the full recording the ad remover keeps for 7 days.
- **Series:** pause, edit or delete a series (keeping or trashing its episodes), plus the default
  start-early and end-late timing.
- **Trash:** restore within 7 days, or empty it now.
- **Record a show** (`/record`): search the TV guide (live as you type), pick a show and a channel,
  then choose new episodes only or every airing. Under More options: feed, keep latest N and
  timing. Or record just one airing. "Add a series by name" covers shows not in the guide yet.

Tabs switch in the browser (`ui/Tabs.tsx`; every panel is already on the page, `?tab=` follows) and buttons update the page in place with a toast (`ui/ActionForm.tsx`, `ui/Toaster.tsx`, actions call `refresh()`), so nothing reloads, fades or jumps to the top (owner, 2026-10-31). Forms still work without JavaScript; `AutoSubmit`
only makes the search live.

## How it reaches home
The recorder lives on the home server (the Xtreamfilter project: `scripts/recorder.js`,
`scripts/dvr-api.js`), which is not on the internet.

- **Tailscale Funnel** publishes one path: `https://home-server.<tailnet>.ts.net/dvr`. It goes to a
  second listener in the recorder that is published only on the server's loopback.
- **That listener answers only with `Authorization: Bearer <key>`** and serves the API only: no
  pages, no file downloads, nothing else on the server.
- **This site** calls it from the server (`src/lib/recordings/dvr.ts`). The key never reaches the
  browser, and every action re-checks the Private session (`requirePrivate`).

**Vercel environment variables** (Production):
- `DVR_URL` = `https://home-server.tailef3c66.ts.net/dvr`
- `DVR_TOKEN`: Sensitive. It must equal `secrets/dvr-remote.token` on the home server.

If either is unset, the page says it isn't connected (fail closed).

**To change the key:** write a new random value to `secrets/dvr-remote.token`, restart
`dvr-recorder`, then update `DVR_TOKEN` in Vercel and redeploy.

**To shut the entrance:** on the home server run `tailscale funnel --https=443 off`. The page then
says it can't reach the DVR.

## Local development
`.env.local` (git-ignored) with `LAB_PASSWORD` (any throwaway value), `DVR_URL` and `DVR_TOKEN`.
Then run `npm run dev` and sign in at `/private`.

## Tests
- `src/tools/recordings/recordings.test.mts`: Pacific-time wording across a DST change, grouping,
  clash warnings and form parsing.
- The recorder's own API has 23 checks in the Xtreamfilter project (`scripts/recorder-test/`).
- `npm run smoke` checks that both pages stay behind the sign-in.
