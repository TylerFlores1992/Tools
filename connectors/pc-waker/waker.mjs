// The PC waker: runs on the always-on home server and switches the main PC on (Wake-on-LAN)
// when tylerflores.dev asks, so Vectorworks can work while nobody is at the desk.
//
// It listens on the server's loopback only; Tailscale Funnel publishes it at /pc. It answers
// nothing without `Authorization: Bearer <key>` (the key is in pc-waker.token beside this file),
// and it can do exactly two things: send the wake packet, and say whether the PC answers.
// No dependencies: Node 18+ only.
import { createServer } from "node:http";
import { createSocket } from "node:dgram";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** "AA-BB-CC-DD-EE-FF" or "aa:bb:…" → 6 bytes, or null. */
export function parseMac(mac) {
  const hex = String(mac ?? "").replace(/[^0-9a-f]/gi, "");
  return hex.length === 12 ? Buffer.from(hex, "hex") : null;
}

/** The magic packet: six 0xFF bytes, then the MAC sixteen times. */
export function magicPacket(mac) {
  const m = parseMac(mac);
  if (!m) throw new Error("not a MAC address");
  return Buffer.concat([Buffer.alloc(6, 0xff), ...Array(16).fill(m)]);
}

export function sameKey(given, key) {
  const a = Buffer.from(String(given ?? ""));
  const b = Buffer.from(String(key ?? ""));
  return b.length >= 16 && a.length === b.length && timingSafeEqual(a, b);
}

function sendPacket(cfg) {
  const packet = magicPacket(cfg.mac);
  const targets = [...new Set([cfg.broadcast || "255.255.255.255", "255.255.255.255"])];
  return new Promise((resolve, reject) => {
    const sock = createSocket("udp4");
    sock.once("error", reject);
    sock.bind(() => {
      sock.setBroadcast(true);
      let left = targets.length * 3;
      const done = (err) => {
        if (err) return reject(err);
        if (--left === 0) sock.close(() => resolve(targets));
      };
      for (let i = 0; i < 3; i++) for (const t of targets) sock.send(packet, 9, t, done);
    });
  });
}

/** Does the PC answer a ping? (Windows ping flags, or Linux ones when testing elsewhere.) */
function answers(ip) {
  const args = process.platform === "win32" ? ["-n", "1", "-w", "1500", ip] : ["-c", "1", "-W", "2", ip];
  return new Promise((resolve) =>
    execFile("ping", args, { timeout: 5000, windowsHide: true }, (err, stdout) => {
      // Windows ping can exit 0 on "Destination host unreachable"; only a TTL line is a reply.
      resolve(!err && /ttl=/i.test(String(stdout)));
    }),
  );
}

export function makeServer(cfg, deps = {}) {
  const send = deps.send ?? sendPacket;
  const ping = deps.ping ?? answers;
  const now = deps.now ?? Date.now;
  let lastWake = 0;
  const json = (res, code, body) => {
    res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
  };
  return createServer(async (req, res) => {
    const path = (req.url ?? "/").split("?")[0].replace(/^\/pc(?=\/|$)/, "") || "/";
    const auth = String(req.headers.authorization ?? "");
    if (!auth.startsWith("Bearer ") || !sameKey(auth.slice(7), cfg.token)) return json(res, 401, { error: "Not allowed." });
    try {
      if (req.method === "GET" && path === "/status") {
        return json(res, 200, { awake: await ping(cfg.ip), name: cfg.name || "PC", lastWake: lastWake || null, at: now() });
      }
      if (req.method === "POST" && path === "/wake") {
        if (await ping(cfg.ip)) return json(res, 200, { sent: false, awake: true, message: "The PC is already on." });
        if (now() - lastWake < 15000) return json(res, 200, { sent: false, awake: false, message: "Already waking it. Give it a minute." });
        await send(cfg);
        lastWake = now();
        return json(res, 200, { sent: true, awake: false, message: "Sent. The PC usually answers within a minute." });
      }
      return json(res, 404, { error: "Nothing here." });
    } catch {
      return json(res, 500, { error: "The waker hit a problem sending the packet." });
    }
  });
}

export function loadConfig(dir = HERE) {
  const cfg = JSON.parse(readFileSync(join(dir, "pc-waker.json"), "utf8"));
  cfg.token = readFileSync(join(dir, "pc-waker.token"), "utf8").trim();
  if (!parseMac(cfg.mac)) throw new Error("pc-waker.json: mac must be the PC's MAC address, like AA-BB-CC-DD-EE-FF");
  if (!cfg.ip) throw new Error("pc-waker.json: ip must be the PC's address on the home network");
  if (cfg.token.length < 16) throw new Error("pc-waker.token is missing or too short");
  return cfg;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cfg = loadConfig();
  const port = Number(cfg.port || 7381);
  makeServer(cfg).listen(port, "127.0.0.1", () => console.log(`pc-waker: listening on 127.0.0.1:${port} for ${cfg.name || "the PC"} (${cfg.ip})`));
}
