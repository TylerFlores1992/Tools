/** A read-out's drawing, kept out of the page's database.
 *
 * Read-outs used to be copied into the database, chopped into 256 KB documents: CFF-26 made 111 to
 * 148 of them (some 40 MB), saving took minutes, a phone that put the app away left half a copy,
 * and the database's live view didn't deliver them all, so layers went missing ("got less"). Now
 * the database keeps one small row per drawing layer (name, shown or not, where it came from) and
 * the drawing itself is read from the read-out file in Dropbox when a project opens, then kept on
 * this device (in memory, and in the browser's storage when it allows) so the next open is quick. */
import type { Layer, Shape } from "./model.ts";
import { attachMeshes, isReadout, readoutLayers, type Readout } from "./readout.ts";
import type { Mesh } from "./model.ts";

export type Geometry = Map<string, Shape[]>;

/** Which copy of a drawing: the file, its version in Dropbox and how it's shown (a sheet or not). */
export function geoKey(file: string, modified = "", view = ""): string {
  return `${file}|${modified}|${view}`;
}

const memory = new Map<string, Geometry>();

/** The shapes of each drawing layer, by the row name the layers list shows ("Set: CFF SET-26"). */
export function geometryOf(made: Omit<Layer, "id">[]): Geometry {
  const g: Geometry = new Map();
  for (const l of made) {
    if (l.kind !== "shapes") continue;
    const name = l.group ?? l.name;
    const list = g.get(name) ?? [];
    for (const s of l.shapes ?? []) list.push(s);
    g.set(name, list);
  }
  return g;
}

/** The rows the database keeps for a read-out: one per drawing layer, without its shapes (those
 * come from the file), plus its fixtures and rigging as they are (small). */
export function readoutRows(made: Omit<Layer, "id">[], file: string): Omit<Layer, "id">[] {
  const rows: Omit<Layer, "id">[] = [];
  const seen = new Set<string>();
  for (const l of made) {
    if (l.kind !== "shapes") {
      rows.push(l);
      continue;
    }
    const name = l.group ?? l.name;
    if (seen.has(name)) continue;
    seen.add(name);
    const { shapes: _s, group: _g, ...rest } = l;
    rows.push({ ...rest, name, readout: { file, layer: name } });
  }
  return rows;
}

// ---- this device's copy ---------------------------------------------------------------------

function idb(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    try {
      const req = indexedDB.open("rig-studio-geometry", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("geo");
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ok(null);
      req.onblocked = () => ok(null);
    } catch {
      ok(null);
    }
  });
}

async function fromDevice(key: string): Promise<Geometry | null> {
  try {
    const db = await idb();
    if (!db) return null;
    return await new Promise((ok) => {
      const req = db.transaction("geo").objectStore("geo").get(key);
      req.onsuccess = () => ok(req.result ? new Map(req.result as [string, Shape[]][]) : null);
      req.onerror = () => ok(null);
    });
  } catch {
    return null;
  }
}

async function toDevice(key: string, g: Geometry, file: string) {
  try {
    const db = await idb();
    if (!db) return;
    const store = db.transaction("geo", "readwrite").objectStore("geo");
    // Older copies of the same file go: a device keeps one per file and way of showing it.
    const keys = await new Promise<IDBValidKey[]>((ok) => {
      const req = store.getAllKeys();
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ok([]);
    });
    for (const k of keys) if (String(k).startsWith(`${file}|`) && k !== key) store.delete(k);
    store.put([...g.entries()], key);
  } catch {
    /* storage refused (private window, full): the copy in memory still serves this visit */
  }
}

/** Keep a drawing just read (when it's opened), so the project shows it without reading it again. */
export function remember(key: string, g: Geometry, file: string) {
  memory.set(key, g);
  void toDevice(key, g, file);
}

export function remembered(key: string): Geometry | undefined {
  return memory.get(key);
}

// ---- reading it from Dropbox ----------------------------------------------------------------

type Call = (server: string, tool: string, args: Record<string, unknown>) => Promise<unknown>;
type Entry = { name: string; file_id?: string };

/** Read a read-out and its part files from Dropbox. `folder` is the project's Dropbox folder. */
export async function fetchReadout(call: Call, folder: string | undefined, file: string, payload: (x: unknown) => unknown, server: string): Promise<{ r: Readout; missingParts: number }> {
  const res = payload(await call(server, "fetch", { id: file })) as { text?: string };
  let r: unknown;
  try {
    r = JSON.parse(res?.text ?? "");
  } catch {
    throw new Error("that file isn't a read-out (it isn't JSON)");
  }
  if (!isReadout(r)) throw new Error("that file isn't a Rig Studio read-out");
  let missingParts = 0;
  if (r.mesh_parts?.length && folder) {
    // A big read-out keeps its 3D faces in part files beside it: fetch those too.
    const listing = payload(await call(server, "list_folder", { path: folder, recursive: false })) as { entries?: Entry[] };
    const byName = new Map((listing?.entries ?? []).map((x) => [x.name.toLowerCase(), x]));
    const parts: { meshes?: Record<string, Mesh>; objects?: Readout["objects"] }[] = [];
    for (const name of r.mesh_parts) {
      const pe = byName.get(name.toLowerCase());
      if (!pe?.file_id) {
        missingParts++;
        continue;
      }
      try {
        const pr = payload(await call(server, "fetch", { id: pe.file_id })) as { text?: string };
        parts.push(JSON.parse(pr?.text ?? "{}"));
      } catch {
        missingParts++;
      }
    }
    attachMeshes(r, parts);
  }
  return { r, missingParts };
}

/** The drawing behind a project's read-out rows: from memory, this device, or Dropbox (in that order). */
export async function loadGeometry(row: Layer, call: Call, folder: string | undefined, payload: (x: unknown) => unknown, server: string): Promise<Geometry> {
  const src = row.source!;
  const file = row.readout!.file;
  const key = geoKey(file, src.modified, src.view);
  const mem = memory.get(key);
  if (mem) return mem;
  const dev = await fromDevice(key);
  if (dev) {
    memory.set(key, dev);
    return dev;
  }
  const { r } = await fetchReadout(call, folder, file, payload, server);
  const g = geometryOf(readoutLayers(r, src, row.at, src.view ?? ""));
  remember(key, g, file);
  return g;
}

/** Forget every drawing kept on this device (the next open reads them from Dropbox again). */
export async function forgetAll() {
  memory.clear();
  try {
    const db = await idb();
    db?.transaction("geo", "readwrite").objectStore("geo").clear();
  } catch {
    /* nothing kept */
  }
}

// For the browser checks: start from a device that has nothing kept.
try {
  (globalThis as { __rsGeometry?: unknown }).__rsGeometry = { forget: forgetAll };
} catch {
  /* not in a browser */
}
