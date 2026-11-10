// A stand-in for claude.ai's window.claude in local screenshots and browser tests: an in-memory
// db with live snapshots, a scripted sample(), and connectors that answer from fixtures.
(() => {
  const docs = new Map(); // path -> data
  const subs = new Set();
  const seed = window.__SEED__ || {};
  for (const [p, d] of Object.entries(seed)) docs.set(p, structuredClone(d));
  const log = (window.__CALLS__ = []);
  const parent = (p) => p.split("/").slice(0, -1).join("/");
  const notify = () => queueMicrotask(() => subs.forEach((s) => s()));
  const snapOf = (path) => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => structuredClone(docs.get(path)), metadata: {} });
  let n = 0;
  const query = (col, wh = [], ob = null, lim = 0) => ({
    where: (f, op, v) => query(col, [...wh, [f, op, v]], ob, lim),
    orderBy: (f, d = "asc") => query(col, wh, [f, d], lim),
    limit: (k) => query(col, wh, ob, k),
    _run() {
      let out = [...docs.keys()].filter((p) => parent(p) === col).map(snapOf);
      for (const [f, op, v] of wh) out = out.filter((s) => (op === "==" ? s.data()[f] === v : true));
      if (ob) out.sort((a, b) => (a.data()[ob[0]] > b.data()[ob[0]] ? 1 : -1) * (ob[1] === "desc" ? -1 : 1));
      if (lim) out = out.slice(0, lim);
      return { docs: out, size: out.length, empty: !out.length, docChanges: () => [], metadata: {} };
    },
    get() { return Promise.resolve(this._run()); },
    onSnapshot(next) { const s = () => next(this._run()); subs.add(s); queueMicrotask(s); return () => subs.delete(s); },
  });
  const col = (path) => Object.assign(query(path), {
    path,
    doc: (id) => doc(`${path}/${id || `auto${++n}${Math.random().toString(36).slice(2, 7)}`}`),
    add: async (d) => { const r = doc(`${path}/auto${++n}${Math.random().toString(36).slice(2, 7)}`); await r.set(d); return r; },
  });
  const doc = (path) => ({
    id: path.split("/").pop(), path,
    get: async () => snapOf(path),
    set: async (d) => { docs.set(path, structuredClone(d)); notify(); },
    update: async (d) => { if (!docs.has(path)) throw { code: "invalid_argument", message: "no doc" }; docs.set(path, { ...docs.get(path), ...structuredClone(d) }); notify(); },
    delete: async () => { docs.delete(path); notify(); },
    onSnapshot(next) { const s = () => next(snapOf(path)); subs.add(s); queueMicrotask(s); return () => subs.delete(s); },
    collection: (c) => col(`${path}/${c}`),
  });
  const db = { doc, collection: col };
  const answers = window.__MCP__ || {};
  const mcp = {
    async callTool(server, tool, input) {
      log.push({ server, tool, input });
      const a = answers[`${server}/${tool}/${input?.id ?? ""}`] ?? answers[`${server}/${tool}`];
      if (!a) throw { code: "server_not_connected", message: "not here", server };
      if (a.error) throw a.error;
      return { content: [{ type: "text", text: JSON.stringify(a) }], payload: a };
    },
    watchTool(server, tool, input, handler) {
      mcp.callTool(server, tool, input).then((r) => handler({ type: "data", result: r }), (e) => handler({ type: "error", error: e }));
      return () => {};
    },
    async listTools() { return { servers: [] }; },
  };
  const sample = Object.assign(async (input, opts) => {
    log.push({ sample: input, images: opts?.images ? [...opts.images].length : 0 });
    const script = (window.__SAMPLE__ || [])[0];
    if (script && opts?.tools) {
      for (const call of script.calls || []) {
        const t = opts.tools.find((x) => x.name === call.name);
        try { await t.execute(call.input, { signal: new AbortController().signal }); } catch (e) { log.push({ toolError: String(e.message || e) }); }
      }
    }
    const text = script?.text ?? "Done.";
    opts?.onText?.({ text, delta: text });
    return { text, truncated: false, modelTierApplied: "default" };
  }, { limits: async () => ({ maxPromptBytes: 262144, tools: { maxCount: 16 }, images: { maxCount: 4, maxInputBytes: 5000000, mediaTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"] } }), json: async () => ({}) });
  const assets = { upload: async (b) => { log.push({ upload: b.type }); return { id: "a".repeat(31) + String(log.length % 10), url: URL.createObjectURL(b) }; }, delete: async () => ({ deleted: true }) };
  const caps = { db, mcp, sample, assets, downloads: { save: async (r) => { log.push({ download: r.filename }); return { status: "saved" }; } }, user: { isOwner: async () => true, canEdit: async () => true, id: async () => "u_test" } };
  window.__DOCS__ = docs;
  window.__setDoc = (p, d) => { docs.set(p, structuredClone(d)); notify(); };
  window.claude = { use: async (name) => caps[name] ?? null };
})();
