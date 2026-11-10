# PC waker

Lets the always-on home server switch the main PC on, so Vectorworks can work from the phone while
nobody is at the desk: **Wake my PC** on `/private/pc` (Rig Studio links to it) → the site asks
the home server → the server sends a Wake-on-LAN packet → the PC wakes with Vectorworks still open
→ Rig Studio's PC jobs run → the PC goes back to sleep after 30 idle minutes.

The PC **sleeps**, it isn't shut down: Vectorworks, the Claude app and the connector stay open and
are ready a few seconds after it wakes. Waking from a full shutdown also works on most PCs, but
then someone has to sign in to Windows before Vectorworks can start.

## Setup (once, about 15 minutes)
1. **On the main PC, in the BIOS** (restart, press Del or F2): turn on *Wake on LAN* (also called
   *Power On By PCI-E*, *Resume by LAN* or *Wake on PCI-E*). Turn off *ErP / EuP Ready* if there is
   one: it cuts power to the network card. Save and exit.
2. **On the main PC**, in an admin PowerShell, from this folder:
   `powershell -ExecutionPolicy Bypass -File .\pc-setup.ps1`
   It lets the wired card wake the PC (magic packet only), turns off Fast Startup, sets sleep
   after 30 idle minutes, lets the home network ping the PC (so the page can tell it's awake),
   and prints `-Mac … -Ip …`.
3. **In the Deco app**: reserve that IP for the PC (More → Advanced → Address Reservation).
4. **On the home server**, admin PowerShell, from this folder (Node 22+ needed, already there for
   Page Turner):
   `powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Mac <from step 2> -Ip <from step 2>`
   It writes `pc-waker.json`, makes a key in `pc-waker.token`, starts the waker at every boot (a
   scheduled task, `pc-waker`) and publishes `/pc` through Tailscale Funnel. `/dvr` and `/course`
   are left alone.
5. **In Vercel** (project `tylerflores-dev`, Production) add, then redeploy:
   - `PC_WAKER_URL` = `https://desktop-mdc5q6e.tailef3c66.ts.net/pc`
   - `PC_WAKER_TOKEN` = the text in `pc-waker.token` (mark it Sensitive)
6. **Connector (optional, recommended):** set `VWMCP_WATCH` on the PC to your Dropbox folders
   with show files, separated by `;` (e.g. `C:\Users\you\Dropbox\Rig Studio;C:\Users\you\Dropbox\Shows`).
   The connector then reads out new or changed .vwx files by itself, only when nobody has touched
   the PC or asked Claude anything for 10 minutes. `ping` shows what it watches.

## Try it
Put the PC to sleep, open `/private/pc` on the phone, press **Wake my PC**. Within a minute it
should say the PC is on.

If it never wakes: the BIOS setting (step 1) is the usual cause; then check the PC is on a cable
(Wi-Fi can't wake), and that the server and PC are on the same network.

## How it stays locked
- The waker listens on the server's 127.0.0.1 only; Funnel publishes `/pc` and nothing else of it.
- It refuses anything without the key, and can only send the wake packet or ping the PC. It
  refuses a second wake within 15 seconds.
- Only the site holds the key, server-side; every press re-checks the Private session.
- To shut it: `tailscale funnel --set-path /pc off`, or disable the `pc-waker` scheduled task.

## Tests
`node --test waker.test.mjs` (the packet, the key, repeat-wake refusal, the two routes).
