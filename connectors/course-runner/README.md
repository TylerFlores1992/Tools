# Page Turner on the home server

Runs a self-paced course in Chrome on the Windows server. It turns pages, and when a question or
checkpoint comes up it stops, sends a push, and waits. You answer on `/private/course`: the page
shows the live course window and passes your taps to it. It never picks or submits an answer.

## Setup (once)
1. Install **Google Chrome** and **Node.js 22+** on the server if they aren't there.
2. In this folder run: `powershell -ExecutionPolicy Bypass -File .\setup.ps1`
   It installs what's needed, writes `.env` with a new key and alert topic, and publishes the
   `/course` path through Tailscale Funnel. The DVR's `/dvr` path is left alone.
3. In Vercel (project `tylerflores-dev`, Production) add, then redeploy:
   - `COURSE_URL` = `https://home-server.tailef3c66.ts.net/course`
   - `COURSE_TOKEN` = the `COURSE_TOKEN` value from `.env` (mark it Sensitive)
4. On your iPhone install **ntfy**, tap +, and subscribe to the `NTFY_TOPIC` value from `.env`.
   Treat that name like a password. Alerts only ever say what's needed, never course content.

## Each time
1. Double-click `start.cmd`. A Chrome window opens. Leave it open; this one uses its own profile.
2. On your phone open `/private/course`, paste the course address, press **Open**, and sign in to
   the course. (Doing the sign-in over RustDesk works too and keeps the password off the relay.)
3. Press **Start**. Page Turner pauses 5 seconds per page, waits for videos and locked buttons, and
   alerts you for questions, a video that won't start, or a page it can't get past.

## How it stays locked
- The listener is on 127.0.0.1 only and refuses anything without the key.
- Only the site holds the key. Every route re-checks the Private session.
- Screens pass straight through on request. Nothing is stored here or on the site.
- To close it: `tailscale funnel --set-path /course off`, or close the `start.cmd` window.

Change the key: edit `COURSE_TOKEN` in `.env`, restart, update Vercel and redeploy.
Don't run a second copy: the Chrome profile can only be open once.
