// Rig Studio's page helpers: lengths as Vectorworks writes them, fixtures from the connector and CSV.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixturesFromCsv, fixturesFromVectorworks, ftIn, parseLength } from "./model.ts";

test("lengths: feet and inches, metric, bare numbers in document units", () => {
  assert.equal(parseLength(`20'-6"`), 246);
  assert.equal(parseLength(`20'`), 240);
  assert.equal(parseLength(`6 1/2"`), null);
  assert.equal(parseLength(`12'-6 1/2"`), 150.5);
  assert.equal(parseLength("2540mm"), 100);
  assert.equal(parseLength(254, 25.4), 10);
  assert.equal(parseLength("nope"), null);
  assert.equal(ftIn(268), `22'-4"`);
  assert.equal(ftIn(8.5), `8½"`);
});

test("fixtures from get_lighting_devices: insertion point, Z, weight in lb or kg, type", () => {
  const f = fixturesFromVectorworks({
    units: { units_per_inch: 1 },
    devices: [
      { id: "a", location: [120, 48], z: 470, fields: { "Inst Type": "Spot 400", Weight: "55 lb" }, bbox: [[0, 0], [1, 1]] },
      { id: "b", location: [254, 0], z: 0, fields: { "Inst Type": "Wash", Weight: "10 kg", "Z Location": "20'" } },
      { id: "c", bbox: [[10, 10], [20, 30]], fields: {} },
    ],
  });
  assert.deepEqual(f[0], { x: 120, y: 48, z: 470, lb: 55, type: "Spot 400", id: "a" });
  assert.equal(f[1].lb, 22);
  assert.deepEqual([f[2].x, f[2].y], [15, 20]);
  const mm = fixturesFromVectorworks({ units: { units_per_inch: 25.4 }, devices: [{ location: [2540, 0], z: 5080, fields: {} }] });
  assert.deepEqual([mm[0].x, mm[0].z], [100, 200]);
});

test("fixtures from a CSV in feet, or inches when the header says so", () => {
  const ft = fixturesFromCsv("Type,X,Y,Z,Weight\nSpot,10,4,20,55\nWash,12,4,20,30\n");
  assert.deepEqual(ft.fixtures[0], { x: 120, y: 48, z: 240, lb: 55, type: "Spot" });
  const inch = fixturesFromCsv('x (in),y (in),z (in)\n120,48,240\n');
  assert.equal(inch.fixtures[0].x, 120);
  assert.match(fixturesFromCsv("a,b\n1,2").problem ?? "", /x and y/);
});

import { jobActive, jobWords, needsHandoff, routeJob, sortProjects } from "./model.ts";

test("the project list: pinned first in the order pinned, then most recently changed", () => {
  const p = (id: string, updatedAt: string, pinnedAt?: string | null) => ({ id, updatedAt, pinnedAt });
  const out = sortProjects([p("old", "2026-01-01"), p("new", "2026-03-01"), p("pin2", "2026-01-02", "2026-02-02"), p("pin1", "2025-01-01", "2026-02-01"), p("unpinned", "2026-02-01", null)]);
  assert.deepEqual(out.map((x) => x.id), ["pin1", "pin2", "new", "unpinned", "old"]);
});

test("a PC job checks and wakes the PC through the cloud worker only when the waker is set up", () => {
  const w = { cloud: "c", pc: "p" };
  assert.deepEqual(routeJob(w, "pc"), { trigger: "p", wake: false });
  assert.deepEqual(routeJob({ ...w, wake: true }, "pc"), { trigger: "c", wake: true });
  assert.deepEqual(routeJob({ ...w, wake: true }, "cloud"), { trigger: "c", wake: false });
  assert.deepEqual(routeJob({ cloud: "c", wake: true }, "pc"), { trigger: undefined, wake: false });
});

test("the page hands a woken job over once, and never a stale one", () => {
  const at = "2026-11-10T04:00:00Z";
  const t = Date.parse(at);
  const j = { id: "j", pid: "p", project: "P", request: "r", where: "pc" as const, status: "waking" as const, at, text: "job" };
  assert.equal(needsHandoff(j, t + 1000), false); // not awake yet
  assert.equal(needsHandoff({ ...j, awake: true }, t + 1000), true);
  assert.equal(needsHandoff({ ...j, awake: true, handed: true }, t + 1000), false);
  assert.equal(needsHandoff({ ...j, awake: true }, t + 31 * 60_000), false);
  assert.equal(needsHandoff({ ...j, awake: true, status: "failed" }, t + 1000), false);
  assert.match(jobWords({ ...j, progress: "Your PC is asleep. Waking it…" }), /^◌ Your PC is asleep/);
  assert.match(jobWords({ ...j, status: "failed", reply: "No." }), /^✕ Stopped\. No\./);
  assert.ok(jobActive(j) && !jobActive({ ...j, status: "done" }));
});

test("a read-out request and its answer are files named after the drawing and the job", async () => {
  const { requestName, statusName, isNoteFile, fromStatus } = await import("./model.ts");
  assert.equal(requestName("CFF_v2025.vwx", "j1"), "CFF_v2025.j1.rigrequest.json");
  assert.equal(statusName("CFF_v2025.vwx"), "CFF_v2025.rigstatus.json");
  assert.ok(isNoteFile("CFF_v2025.j1.rigrequest.json") && isNoteFile("CFF_v2025.rigstatus.json") && !isNoteFile("CFF_v2025.rigread.json"));
  assert.deepEqual(fromStatus({ job: "j1", state: "done", message: "Read out." }, "j1"), { status: "done", reply: "Read out." });
  assert.equal(fromStatus({ job: "j0", state: "done" }, "j1"), null, "an answer to an older request never finishes this one");
  assert.equal(fromStatus({ job: "j1", state: "failed", message: "No Vectorworks." }, "j1")?.status, "failed");
  assert.equal(fromStatus({ job: "j1", state: "reading" }, "j1")?.status, "running");
});

test("a drawing layer stored in several documents is one row in the Layers list", async () => {
  const { layerRows } = await import("./model.ts");
  const src = { name: "CFF.rigread.json", from: "dropbox" as const, dropboxId: "id:1" };
  const L = (id: string, name: string, extra = {}) => ({ id, name, kind: "shapes" as const, visible: true, at: "t", shapes: [], source: src, ...extra });
  const rows = layerRows([
    L("a", "CFF: SET (1)", { group: "CFF: SET" }),
    L("b", "CFF: SET (2)", { group: "CFF: SET" }),
    L("c", "CFF: CAMERA"),
    L("d", "CFF: AUDIENCE (1)"), // older layers without `group`: grouped by name and source
    L("e", "CFF: AUDIENCE (2)"),
    { id: "f", name: "Venue plan (2)", kind: "image" as const, visible: true, at: "t" }, // an upload named like that stays itself
  ]);
  assert.deepEqual(rows.map((r) => [r.name, r.layers.map((l) => l.id).join("")]), [
    ["CFF: SET", "ab"],
    ["CFF: CAMERA", "c"],
    ["CFF: AUDIENCE", "de"],
    ["Venue plan (2)", "f"],
  ]);
});

test("a busy database write is tried again; a full or bad one fails at once", async () => {
  const { saveWithRetry } = await import("./model.ts");
  const noWait = async () => {};
  let n = 0;
  const busyTwice = async () => {
    if (++n < 3) throw Object.assign(new Error("busy"), { code: "resource_exhausted" });
    return "saved";
  };
  assert.equal(await saveWithRetry(busyTwice, 4, noWait), "saved");
  assert.equal(n, 3);
  let m = 0;
  const full = async () => {
    m++;
    throw Object.assign(new Error("full"), { code: "quota_exceeded" });
  };
  await assert.rejects(saveWithRetry(full, 4, noWait), /full/);
  assert.equal(m, 1, "a full database isn't hammered");
  let k = 0;
  await assert.rejects(saveWithRetry(async () => { k++; throw Object.assign(new Error("blip"), { code: "unavailable" }); }, 3, noWait));
  assert.equal(k, 3, "gives up after its tries");
});
