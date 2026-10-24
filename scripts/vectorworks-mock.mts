/**
 * A stand-in for the Vectorworks connector's panel API (vwmcp-panel), for `npm run e2e` in CI,
 * where there is no Vectorworks and no Python connector. Same routes, headers and error shapes
 * as vwmcp/panel.py; it records every op the page sends so checks can assert exact payloads.
 * The real connector is tested against a strict fake of Vectorworks in its own repo.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";

// Real answers recorded from the Python connector against its fake Vectorworks (`--show`: venue
// steel, two trusses on five hoists, fixtures, scenery, and a referenced audio file with PA points).
// Re-record with the connector running: see docs/NEXT-SESSION.md (Vectorworks).
const SHOW = JSON.parse(readFileSync(new URL("./vectorworks-show.fixture.json", import.meta.url), "utf8"));

type Obj = Record<string, unknown> & { id: string; bbox: [[number, number], [number, number]]; geometry: Record<string, unknown> };

export const MOCK_TOKEN = "e2e-pairing-token-0123456789abcdef";

function demo(): Obj[] {
  const fx = (n: number, x: number): Obj => ({
    id: `{FX-${n}}`, type: "plugin", name: "", layer: "Lighting", cls: "Lighting-Fixtures", plugin: "Lighting Device",
    channel: String(100 + n), location: [x, 120], bbox: [[x - 5, 113], [x + 5, 127]], width: 10, height: 14, geometry: { kind: "bbox" },
  });
  return [
    { id: "{DECK}", type: "rectangle", name: "Deck", layer: "Design Layer-1", cls: "None", bbox: [[-180, -60], [180, 60]], width: 360, height: 120, area: 43200, perimeter: 960, geometry: { kind: "polygon", closed: true, points: [[-180, -60], [180, -60], [180, 60], [-180, 60]] } },
    { id: "{TRUSS}", type: "symbol", name: "Electric 1", layer: "Lighting", cls: "None", symbol: "Truss 20ft", location: [0, 120], bbox: [[-120, 114], [120, 126]], width: 240, height: 12, geometry: { kind: "bbox" } },
    fx(1, -90), fx(2, -30), fx(3, 30), fx(4, 90),
  ];
}

export function startVectorworksMock(port: number, allowOrigin: string) {
  let objects = demo();
  let show = false;
  const posts: { path: string; body: Record<string, unknown> }[] = [];
  const fields: Record<string, Record<string, string>> = {};
  const calls: { op: string; args: Record<string, unknown> }[] = [];
  const units = { unit_name: '"', square_unit_name: "sq ft", units_per_inch: 1 };

  const send = (res: ServerResponse, status: number, body: unknown, origin?: string) => {
    if (origin === allowOrigin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  const run = (op: string, args: Record<string, unknown>): unknown => {
    calls.push({ op, args });
    const byId = (id: unknown) => {
      const o = objects.find((x) => x.id === id);
      if (!o) throw new Error(`No object with id '${id}'.`);
      return o;
    };
    switch (op) {
      case "move_objects": {
        const [dx, dy] = [Number(args.dx), Number(args.dy)];
        const moved = (args.ids as string[]).map(byId).map((o) => {
          const m = (p: [number, number]): [number, number] => [p[0] + dx, p[1] + dy];
          const g = { ...o.geometry } as Record<string, unknown>;
          if (Array.isArray(g.points)) g.points = (g.points as [number, number][]).map(m);
          return { ...o, bbox: [m(o.bbox[0]), m(o.bbox[1])], location: o.location ? m(o.location as [number, number]) : undefined, geometry: g } as Obj;
        });
        objects = objects.map((o) => moved.find((n) => n.id === o.id) ?? o);
        return { objects: moved };
      }
      case "get_object": {
        const o = byId(args.id);
        if (show) return { ...o, fields: {} };
        return { ...o, fields: { "Inst Type": "Source Four 26deg", Channel: String(o.channel ?? ""), "Unit Number": "1", Purpose: "Front", Color: "R60", Position: "Electric 1", ...fields[o.id] } };
      }
      case "set_record_fields": {
        const o = byId(args.id);
        const values = args.values as Record<string, string>;
        fields[o.id] = { ...fields[o.id], ...values };
        if (values.Channel) o.channel = values.Channel;
        return { id: o.id, record: args.record, fields: (run("get_object", { id: o.id }) as { fields: Record<string, string> }).fields };
      }
      case "set_visibility":
        return { layers: args.layers ?? {}, classes: args.classes ?? {} };
      case "list_objects":
        return { count: 0, truncated: false, units, objects: [] };
      case "undo_last":
        return { undone: "Undid: move objects." };
      case "select_objects":
        return { selected: (args.ids as string[]).length };
      default:
        throw new Error(`The mock doesn't do '${op}'.`);
    }
  };

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin;
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (req.method === "OPTIONS") return send(res, 204, {}, origin);
    if (url.pathname === "/api/health") return send(res, 200, { ok: true, app: "vwmcp-panel" }, origin);
    if (req.headers.authorization !== `Bearer ${MOCK_TOKEN}`) return send(res, 401, { error: "Wrong or missing pairing token." }, origin);
    const readBody = async () => {
      let body = "";
      for await (const chunk of req) body += chunk;
      return JSON.parse(body || "{}") as Record<string, unknown>;
    };
    if (show) {
      if (url.pathname === "/api/drawing") return send(res, 200, { ok: true, result: { ...SHOW.drawing, objects } }, origin);
      if (url.pathname === "/api/survey") return send(res, 200, { ok: true, result: SHOW.survey }, origin);
      if (url.pathname === "/api/rigging") return send(res, 200, { ok: true, result: SHOW.rigging }, origin);
      if (url.pathname === "/api/rigging.csv") {
        if (origin === allowOrigin) res.setHeader("Access-Control-Allow-Origin", origin);
        res.writeHead(200, { "content-type": "text/csv; charset=utf-8" });
        return res.end(SHOW.csv);
      }
      if ((url.pathname === "/api/setup" || url.pathname === "/api/revision") && req.method === "POST") {
        const body = await readBody();
        posts.push({ path: url.pathname, body });
        if (url.pathname === "/api/revision") {
          const empty = { added: [], removed: [], moved: [], load_changed: [] };
          return send(res, 200, { ok: true, result: { ...SHOW.rigging, changes: empty, changes_since: body.label } }, origin);
        }
        return send(res, 200, { ok: true, result: { datum: SHOW.drawing.setup, limits: SHOW.drawing.setup.limits } }, origin);
      }
    }
    if (url.pathname === "/api/document") {
      const doc = show ? SHOW.survey.document : "E2E Plot.vwx";
      return send(res, 200, { ok: true, result: { document: doc, version: "2026 (31.3.0, build 1)", units, layers: [{ name: "Design Layer-1", type: "design" }, { name: "Lighting", type: "design" }], classes: ["None"], active_layer: "Design Layer-1", active_class: "None" } }, origin);
    }
    if (url.pathname === "/api/drawing") {
      const layer = url.searchParams.get("layer");
      const list = layer ? objects.filter((o) => o.layer === layer) : objects;
      return send(res, 200, { ok: true, result: { count: list.length, truncated: false, units, objects: list } }, origin);
    }
    if (url.pathname === "/api/op" && req.method === "POST") {
      const { op, args = {} } = (await readBody()) as { op: string; args?: Record<string, unknown> };
      try {
        return send(res, 200, { ok: true, result: run(op, args) }, origin);
      } catch (e) {
        return send(res, 422, { ok: false, error: (e as Error).message }, origin);
      }
    }
    send(res, 404, { error: "No such endpoint." }, origin);
  });
  server.listen(port, "127.0.0.1");
  return {
    calls,
    posts,
    reset() { objects = demo(); show = false; calls.length = 0; posts.length = 0; for (const k of Object.keys(fields)) delete fields[k]; },
    /** Serve the recorded show instead of the small plot. */
    useShow() { this.reset(); show = true; objects = SHOW.drawing.objects; },
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
