// Rig Studio: the pinned page that holds every rig project. Projects start blank; Claude draws in
// the page from the chat bar, full sessions take the big jobs, Dropbox holds each project's files,
// and the approved version is built in Vectorworks through the connector.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { rentalList, totalWeight } from "../../../src/tools/rig/bom.ts";
import { compileSketch, emptySketch, pointLines, sketchChecks, sketchLoads, type Compiled, type Sketch } from "../../../src/tools/rig/sketch.ts";
import { SERIES } from "../../../src/tools/rig/catalog.ts";
import { systemPrompt, tools as aiTools, turns, type Ctx } from "./ai.ts";
import { loadCaps, mcpWords, payloadOf, SERVERS, type Caps } from "./cap.ts";
import { ago, jobActive, jobWords, needsHandoff, routeJob, sortJobs, sortProjects, fixturesFromCsv, fixturesFromVectorworks, ftIn, layerLoads, parseLength, slug, vid, type Job, type Layer, type Message, type Project, type Version, type Workers } from "./model.ts";
import { isReadout, readoutLayers, readoutSummary } from "./readout.ts";
import { Viewer, type Label, type Show, type ViewName } from "./viewer.ts";

/* ------------------------------------------------------------------ small pieces */

const now = () => new Date().toISOString();
const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(`rs:${k}`);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(`rs:${k}`, JSON.stringify(v));
    } catch {
      /* per-viewer convenience only */
    }
  },
};

type Thumb = { r: [number, number, number, number][]; t: [number, number][]; p: [number, number][] };
function thumbOf(sk: Sketch): Thumb {
  const q = (n: number) => Math.round(n);
  return {
    r: sk.runs.filter((r) => Math.abs(r.a[0] - r.b[0]) + Math.abs(r.a[1] - r.b[1]) > 1).slice(0, 300).map((r) => [q(r.a[0]), q(r.a[1]), q(r.b[0]), q(r.b[1])]),
    t: sk.towers.slice(0, 60).map((t) => [q(t.x), q(t.y)]),
    p: sk.points.slice(0, 120).map((p) => [q(p.at[0]), q(p.at[1])]),
  };
}

function Plan({ thumb }: { thumb?: Thumb }) {
  if (!thumb || (!thumb.r.length && !thumb.t.length && !thumb.p.length)) {
    return (
      <svg className="plan" viewBox="0 0 160 90" aria-hidden="true">
        <rect x="8" y="8" width="144" height="74" className="plan-empty" />
      </svg>
    );
  }
  const xs = [...thumb.r.flatMap((r) => [r[0], r[2]]), ...thumb.t.map((t) => t[0]), ...thumb.p.map((p) => p[0])];
  const ys = [...thumb.r.flatMap((r) => [r[1], r[3]]), ...thumb.t.map((t) => t[1]), ...thumb.p.map((p) => p[1])];
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min(140 / Math.max(1, x1 - x0), 70 / Math.max(1, y1 - y0));
  const X = (x: number) => 80 + (x - (x0 + x1) / 2) * k;
  const Y = (y: number) => 45 - (y - (y0 + y1) / 2) * k;
  return (
    <svg className="plan" viewBox="0 0 160 90" aria-hidden="true">
      {thumb.r.map((r, i) => (
        <line key={i} x1={X(r[0])} y1={Y(r[1])} x2={X(r[2])} y2={Y(r[3])} className="plan-run" />
      ))}
      {thumb.t.map((t, i) => (
        <rect key={i} x={X(t[0]) - 3} y={Y(t[1]) - 3} width="6" height="6" className="plan-tower" />
      ))}
      {thumb.p.map((p, i) => (
        <circle key={i} cx={X(p[0])} cy={Y(p[1])} r="2.6" className="plan-point" />
      ))}
    </svg>
  );
}

function StatusChip({ p }: { p: Project }) {
  if (p.built && p.built === p.current) return <span className="chip built">▣ Built in Vectorworks · v{p.built}</span>;
  if (p.approved && p.approved === p.current) return <span className="chip ok">✓ Approved · v{p.approved}</span>;
  if (p.approved) return <span className="chip draft">✎ Draft v{p.current} · v{p.approved} approved</span>;
  return <span className="chip draft">✎ Draft{p.current ? ` · v${p.current}` : ""}</span>;
}

const glyph = { ok: "✓", warn: "!", note: "i" } as const;

function Notice({ tone, children, onClose }: { tone: "ok" | "warn" | "info"; children: ReactNode; onClose?: () => void }) {
  return (
    <div className={`notice ${tone}`} role={tone === "warn" ? "alert" : "status"}>
      <span className="notice-glyph" aria-hidden="true">
        {tone === "ok" ? "✓" : tone === "warn" ? "!" : "i"}
      </span>
      <div className="notice-body">{children}</div>
      {onClose && (
        <button className="icon-btn" onClick={onClose} aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}

function JobRow({ j, brief }: { j: Job; brief?: boolean }) {
  const word = { queued: "Starting", waking: "Waking your PC", running: "Working", done: "Done", failed: "Stopped" }[j.status];
  const g = { queued: "◌", waking: "◌", running: "◐", done: "✓", failed: "!" }[j.status];
  return (
    <li className={`job ${j.status}`}>
      <span className="job-glyph" aria-hidden="true">
        {g}
      </span>
      <div className="job-body">
        <div className="job-head">
          <strong>{word}</strong>
          <span className="muted">
            {j.where === "pc" ? "on your PC" : "in the cloud"} · {ago(j.updated ?? j.at)}
          </span>
        </div>
        <div className="job-req">{j.request}</div>
        {j.progress && j.status !== "done" && <div className="job-progress">{j.progress}</div>}
        {j.reply && !(brief && j.status === "done") && <div className="job-reply">{j.reply}</div>}
        {j.session && (
          <a href={j.session} target="_blank" rel="noreferrer" className="link">
            Open the session
          </a>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ app */

/** The claude.ai link for a fire_trigger result, if it names the session. */
function sessionLink(r: unknown): string | undefined {
  const obj = typeof r === "object" && r ? (r as Record<string, unknown>) : {};
  const rawId = String(obj.session_id ?? (obj.session as { id?: string } | undefined)?.id ?? "");
  return (obj.session_url ?? obj.url ?? (rawId ? `https://claude.ai/code/${rawId.replace(/^cse_/, "session_")}` : undefined)) as string | undefined;
}

type Env = { caps: Caps; workers: Workers | null; vw: "unknown" | "ready" | "absent"; remoteOk: boolean | null };

function App() {
  const [caps, setCaps] = useState<Caps | null>(null);
  const [route, setRoute] = useState(() => location.hash.slice(1));
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<Workers | null>(null);
  const [vw, setVw] = useState<Env["vw"]>("unknown");
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    loadCaps().then(setCaps);
    const on = () => setRoute(location.hash.slice(1));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  useEffect(() => {
    const db = caps?.db;
    if (!db) return;
    const timer = setTimeout(() => setLoadErr((e) => e ?? "The project list is taking a while. It will appear when the store answers."), 10000);
    const u1 = db.collection("projects").onSnapshot(
      (s) => {
        clearTimeout(timer);
        setLoadErr(null);
        setProjects(sortProjects(s.docs.map((d) => ({ ...(d.data() as Project), id: d.id }))));
      },
      (e) => setLoadErr(`Couldn't read projects: ${e.message}`),
    );
    const u2 = db
      .collection("jobs")
      .orderBy("at", "desc")
      .limit(40)
      .onSnapshot((s) => setJobs(s.docs.map((d) => ({ ...(d.data() as Job), id: d.id }))));
    const u3 = db.doc("config/workers").onSnapshot((s) => setWorkers(s.exists ? (s.data() as Workers) : {}));
    return () => {
      clearTimeout(timer);
      u1();
      u2();
      u3();
    };
  }, [caps]);

  useEffect(() => {
    const mcp = caps?.mcp;
    if (!mcp) return void (caps && setVw("absent"));
    mcp.callTool(SERVERS.vw, "ping", {}).then(
      () => setVw("ready"),
      () => setVw("absent"),
    );
  }, [caps]);

  // A woken PC job is handed to the PC worker from here: the cloud worker that woke the PC may not
  // start another scheduled task itself.
  const handing = useRef(new Set<string>());
  useEffect(() => {
    const db = caps?.db;
    const mcp = caps?.mcp;
    const pc = workers?.pc;
    if (!db || !mcp || !pc) return;
    for (const j of jobs) {
      if (!needsHandoff(j, Date.now()) || handing.current.has(j.id)) continue;
      handing.current.add(j.id);
      (async () => {
        await db.doc(`jobs/${j.id}`).update({ handed: true, status: "queued", progress: "Your PC is awake. Starting the job on it…", updated: now() });
        try {
          const sid = sessionLink(payloadOf(await mcp.callTool(SERVERS.remote, "fire_trigger", { trigger_id: pc, text: j.text })));
          if (sid) await db.doc(`jobs/${j.id}`).update({ session: sid });
        } catch (e) {
          await db.doc(`jobs/${j.id}`).update({ status: "failed", reply: mcpWords(e, "Starting the session on your PC"), updated: now() });
        }
      })();
    }
  }, [jobs, caps, workers]);

  if (!caps) return <div className="boot">Opening Rig Studio…</div>;
  const env: Env = { caps, workers, vw, remoteOk: null };
  const pid = route.startsWith("p-") ? route.slice(2) : null;
  if (!caps.db) {
    return (
      <main className="home">
        <Header />
        <Notice tone="info">Your projects live with this page in Claude. Open it in Claude, signed in, to see and change them.</Notice>
      </main>
    );
  }
  if (pid) return <ProjectView key={pid} pid={pid} env={env} jobs={jobs.filter((j) => j.pid === pid)} />;
  return <Home env={env} projects={projects} jobs={jobs} loadErr={loadErr} />;
}

function Header({ children }: { children?: ReactNode }) {
  return (
    <header className="masthead">
      <div className="brand">
        <svg viewBox="0 0 32 32" className="mark" aria-hidden="true">
          <path d="M4 26 L16 6 L28 26 Z M10 26 L16 16 L22 26 M4 26 H28" />
        </svg>
        <div>
          <h1>Rig Studio</h1>
          <p className="muted">Truss, towers and points for each show. Drawn here, built in Vectorworks.</p>
        </div>
      </div>
      {children}
    </header>
  );
}

/* ------------------------------------------------------------------ home */

function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="pin-icon">
      <path d="M10.5 1.5 14.5 5.5 12 6.5 9.5 9 10 12.5 8.5 14 5.5 11 2 14.5 1.5 14 5 10.5 2 7.5 3.5 6 7 6.5 9.5 4Z" />
    </svg>
  );
}

function Home({ env, projects, jobs, loadErr }: { env: Env; projects: Project[] | null; jobs: Job[]; loadErr: string | null }) {
  const [making, setMaking] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "warn" | "info"; text: string } | null>(null);
  const db = env.caps.db!;
  const running = jobs.filter(jobActive);
  const archived = (projects ?? []).filter((p) => p.archived);
  const list = projects ? projects.filter((p) => !!p.archived === showArchived) : null;
  const pinnedCount = (projects ?? []).filter((p) => p.pinnedAt && !p.archived).length;
  const [showOldJobs, setShowOldJobs] = useState(false);
  const [allJobs, setAllJobs] = useState(false);
  const archivedJobs = jobs.filter((j) => j.archived);
  const jobList = sortJobs(jobs.filter((j) => !!j.archived === showOldJobs));
  const jobsShown = allJobs ? jobList : jobList.slice(0, 8);

  const actJob = async (j: Job, what: "pin" | "unpin" | "archive" | "restore" | "delete") => {
    setMenu(null);
    setConfirmDel(null);
    try {
      if (what === "delete") await db.doc(`jobs/${j.id}`).delete();
      else await db.doc(`jobs/${j.id}`).update(what === "pin" ? { pinnedAt: now() } : what === "unpin" ? { pinnedAt: null } : what === "archive" ? { archived: true, pinnedAt: null } : { archived: false });
      if (what === "archive") setNote({ tone: "ok", text: "Archived that session. It's under Archived sessions; the record is kept." });
      if (what === "delete") setNote({ tone: "ok", text: "Deleted that session's record. What the session saved (a version, layers) stays in its project." });
    } catch (e) {
      setNote({ tone: "warn", text: `Couldn't change that session: ${(e as Error).message ?? e}` });
    }
  };

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (!(e.target as Element).closest?.(".card-menu, .menu-btn")) setMenu(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const act = async (p: Project, what: "pin" | "unpin" | "archive" | "restore") => {
    setMenu(null);
    try {
      if (what === "pin") await db.doc(`projects/${p.id}`).update({ pinnedAt: now() });
      if (what === "unpin") await db.doc(`projects/${p.id}`).update({ pinnedAt: null });
      if (what === "archive") await db.doc(`projects/${p.id}`).update({ archived: true, pinnedAt: null });
      if (what === "restore") await db.doc(`projects/${p.id}`).update({ archived: false });
      if (what === "archive") setNote({ tone: "ok", text: `Archived ${p.name}. It's under Archived projects; nothing was deleted.` });
      if (what === "restore") setNote({ tone: "ok", text: `${p.name} is back on the list.` });
    } catch (e) {
      setNote({ tone: "warn", text: `Couldn't change ${p.name}: ${(e as Error).message ?? e}` });
    }
  };

  /** Delete a project for good: its versions, layers (and their drawings), chat (and its pictures) and its sessions' records. */
  const remove = async (p: Project) => {
    setConfirmDel(null);
    setBusyId(p.id);
    try {
      const assets = new Set<string>();
      for (const sub of ["versions", "layers", "chat"]) {
        const snap = await db.collection(`projects/${p.id}/${sub}`).get();
        for (const d of snap.docs) {
          const data = d.data() as { asset?: string; images?: string[] };
          if (data.asset) assets.add(data.asset);
          for (const id of data.images ?? []) assets.add(id);
          await db.doc(`projects/${p.id}/${sub}/${d.id}`).delete();
        }
      }
      const js = await db.collection("jobs").where("pid", "==", p.id).get();
      for (const d of js.docs) await db.doc(`jobs/${d.id}`).delete();
      await db.doc(`projects/${p.id}`).delete();
      if (env.caps.assets) for (const id of assets) await env.caps.assets.delete(id).catch(() => {});
      setNote({ tone: "ok", text: `Deleted ${p.name}.` });
    } catch (e) {
      setNote({ tone: "warn", text: `Couldn't finish deleting ${p.name}: ${(e as Error).message ?? e}. Try again; what's left is still on the list.` });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="home">
      <Header>
        <button className="btn primary" onClick={() => setMaking(true)} id="new-project">
          + New project
        </button>
      </Header>
      <div className="envline">
        <span>{env.vw === "ready" ? "✓ Vectorworks is connected on this computer" : env.vw === "absent" ? "○ Vectorworks: open this page in the Claude desktop app on the PC to build directly" : "◌ Looking for Vectorworks…"}</span>
        <span>{env.workers?.cloud ? "✓ Full sessions ready" : env.workers ? "○ Full sessions aren't set up yet" : "◌ Checking sessions…"}</span>
      </div>
      {making && <NewProject env={env} onCancel={() => setMaking(false)} />}
      {loadErr && <Notice tone="info">{loadErr}</Notice>}
      {projects === null && !loadErr && <p className="muted">Loading projects…</p>}
      {list?.length === 0 && !showArchived && !making && (
        <div className="empty">
          <h2>No projects yet</h2>
          <p>Each project starts blank. Name it, link its Dropbox folder, then ask Claude to lay out truss over the venue drawings, or draw it a run at a time.</p>
          <button className="btn primary" onClick={() => setMaking(true)}>
            + New project
          </button>
        </div>
      )}
      {note && (
        <Notice tone={note.tone} onClose={() => setNote(null)}>
          {note.text}
        </Notice>
      )}
      {showArchived && <h2 className="h3">Archived projects</h2>}
      {showArchived && list?.length === 0 && <p className="muted">Nothing archived.</p>}
      {!!list?.length && (
        <ul className="cards">
          {list.map((p) => {
            const busy = running.some((j) => j.pid === p.id);
            const open = menu === p.id;
            return (
              <li key={p.id} className="card-wrap">
                <a className="card" href={`#p-${p.id}`} aria-busy={busyId === p.id}>
                  <Plan thumb={(p as Project & { thumb?: Thumb }).thumb} />
                  <div className="card-body">
                    <h3>
                      {p.pinnedAt && (
                        <span className="pin-mark" title="Pinned">
                          <PinIcon /> <span className="sr">Pinned:</span>
                        </span>
                      )}
                      {p.name}
                    </h3>
                    <StatusChip p={p} />
                    <span className="muted small">
                      {busyId === p.id ? "Deleting…" : `Updated ${ago(p.updatedAt)}`}
                      {busy ? " · ◐ Claude is working" : ""}
                    </span>
                  </div>
                </a>
                <button className="menu-btn" aria-label={`More for ${p.name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setMenu(open ? null : p.id)} id={`menu-${p.id}`}>
                  ⋯
                </button>
                {open && (
                  <div className="card-menu" role="menu">
                    {!p.archived &&
                      (p.pinnedAt ? (
                        <button role="menuitem" onClick={() => act(p, "unpin")}>
                          Unpin
                        </button>
                      ) : (
                        <button role="menuitem" onClick={() => act(p, "pin")} id={`pin-${p.id}`}>
                          Pin to top
                        </button>
                      ))}
                    {p.archived ? (
                      <button role="menuitem" onClick={() => act(p, "restore")} id={`restore-${p.id}`}>
                        Put back on the list
                      </button>
                    ) : (
                      <button role="menuitem" onClick={() => act(p, "archive")} id={`archive-${p.id}`}>
                        Archive
                      </button>
                    )}
                    <button
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        setMenu(null);
                        setConfirmDel(p.id);
                      }}
                      id={`delete-${p.id}`}
                    >
                      Delete…
                    </button>
                  </div>
                )}
                {confirmDel === p.id && (
                  <div className="card-confirm" role="alertdialog" aria-label={`Delete ${p.name}`}>
                    <p>
                      Delete <strong>{p.name}</strong> for good? Its versions, layers, chat and pictures go too, and it can't be undone. Archive keeps it instead.
                    </p>
                    <div className="row">
                      <button className="btn small danger-btn" onClick={() => remove(p)} id={`delete-yes-${p.id}`}>
                        Delete for good
                      </button>
                      {!p.archived && (
                        <button className="btn small" onClick={() => (setConfirmDel(null), act(p, "archive"))}>
                          Archive instead
                        </button>
                      )}
                      <button className="btn small" onClick={() => setConfirmDel(null)}>
                        Keep it
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!showArchived && pinnedCount === 0 && (list?.length ?? 0) > 2 && <p className="muted small">Tip: use ⋯ on a project to pin it to the top.</p>}
      {(archived.length > 0 || showArchived) && (
        <button className="link small" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? "Back to current projects" : `Archived projects (${archived.length})`}
        </button>
      )}
      {!!jobs.length && (
        <section className="section">
          <h2>{showOldJobs ? "Archived full sessions" : "Full sessions"}</h2>
          <p className="muted small">The big jobs you handed to a separate Claude session from a project's chat (or a Build when Vectorworks wasn't reachable): what it was asked, how it went, and a link to the session.</p>
          {showOldJobs && jobList.length === 0 && <p className="muted">Nothing archived.</p>}
          <ul className="jobs">
            {jobsShown.map((j) => {
              const mid = `job-${j.id}`;
              const open = menu === mid;
              const live = jobActive(j);
              return (
                <li key={j.id} className="job-wrap card-wrap">
                  <a href={`#p-${j.pid}`} className="job-project">
                    {j.pinnedAt && (
                      <span className="pin-mark" title="Pinned">
                        <PinIcon /> <span className="sr">Pinned:</span>
                      </span>
                    )}
                    {j.project}
                  </a>
                  <ul className="jobs">
                    <JobRow j={j} />
                  </ul>
                  <button className="menu-btn job-menu-btn" aria-label={`More for this session on ${j.project}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setMenu(open ? null : mid)} id={`menu-${mid}`}>
                    ⋯
                  </button>
                  {open && (
                    <div className="card-menu job-menu" role="menu">
                      {!j.archived &&
                        (j.pinnedAt ? (
                          <button role="menuitem" onClick={() => actJob(j, "unpin")}>
                            Unpin
                          </button>
                        ) : (
                          <button role="menuitem" onClick={() => actJob(j, "pin")} id={`pin-${mid}`}>
                            Pin to top
                          </button>
                        ))}
                      {j.archived ? (
                        <button role="menuitem" onClick={() => actJob(j, "restore")}>
                          Put back on the list
                        </button>
                      ) : (
                        <button role="menuitem" onClick={() => actJob(j, "archive")} id={`archive-${mid}`}>
                          Archive
                        </button>
                      )}
                      <button
                        role="menuitem"
                        className="danger"
                        onClick={() => {
                          setMenu(null);
                          setConfirmDel(mid);
                        }}
                        id={`delete-${mid}`}
                      >
                        Delete…
                      </button>
                    </div>
                  )}
                  {confirmDel === mid && (
                    <div className="card-confirm" role="alertdialog" aria-label="Delete this session's record">
                      <p>
                        Delete this session's record for good? {live ? "It doesn't stop the session, which is still working. " : ""}Anything it saved to the project stays.
                      </p>
                      <div className="row">
                        <button className="btn small danger-btn" onClick={() => actJob(j, "delete")} id={`delete-yes-${mid}`}>
                          Delete record
                        </button>
                        <button className="btn small" onClick={() => setConfirmDel(null)}>
                          Keep it
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="row">
            {jobList.length > 8 && (
              <button className="link small" onClick={() => setAllJobs(!allJobs)}>
                {allJobs ? "Show fewer" : `Show all ${jobList.length}`}
              </button>
            )}
            {(archivedJobs.length > 0 || showOldJobs) && (
              <button className="link small" onClick={() => setShowOldJobs(!showOldJobs)}>
                {showOldJobs ? "Back to current sessions" : `Archived sessions (${archivedJobs.length})`}
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function NewProject({ env, onCancel }: { env: Env; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [folder, setFolder] = useState<"make" | "link" | "none">(env.caps.mcp ? "make" : "none");
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = env.caps.db!;
    const n = name.trim();
    if (!n) return setErr("Give the project a name.");
    setBusy(true);
    setErr(null);
    let dropbox: Project["dropbox"] = null;
    try {
      if (folder !== "none" && env.caps.mcp) {
        const mcp = env.caps.mcp;
        if (folder === "make") {
          const target = `/Rig Studio/${n.replace(/[\\/:*?"<>|]/g, "-")}`;
          try {
            await mcp.callTool(SERVERS.dropbox, "create_folder", { path: "/Rig Studio" });
          } catch {
            /* already there */
          }
          try {
            const r = payloadOf(await mcp.callTool(SERVERS.dropbox, "create_folder", { path: target })) as { folder?: { path?: string; path_display?: string } };
            dropbox = { path: r?.folder?.path || target, display: r?.folder?.path_display || target };
          } catch (e) {
            const code = (e as { code?: string }).code;
            if (code === "tool_error" && /ALREADY_EXISTS/i.test(JSON.stringify((e as { result?: unknown }).result ?? ""))) dropbox = { path: target, display: target };
            else throw e;
          }
        } else if (path.trim()) {
          const p = path.trim().startsWith("/") || path.trim().startsWith("ns:") ? path.trim() : `/${path.trim()}`;
          const meta = payloadOf(await mcp.callTool(SERVERS.dropbox, "get_file_metadata", { path_or_file_id: p })) as { metadata_type?: string; folder?: { path_display?: string } };
          if (meta?.metadata_type !== "folder") throw { code: "x", message: `${p} isn't a folder in your Dropbox.` };
          dropbox = { path: p, display: meta.folder?.path_display ?? p };
        }
      }
    } catch (e) {
      setBusy(false);
      return setErr(`${mcpWords(e, "Dropbox")} The project wasn't created; try again or choose "No folder for now".`);
    }
    const id = slug(n);
    const t = now();
    const sketch = emptySketch(n);
    await db.doc(`projects/${id}/versions/${vid(1)}`).set({ n: 1, note: "New project", by: "you", at: t, sketch } satisfies Version);
    await db.doc(`projects/${id}`).set({ name: n, createdAt: t, updatedAt: t, status: "draft", current: 1, approved: null, built: null, dropbox, seen: {}, thumb: thumbOf(sketch) });
    location.hash = `p-${id}`;
  };

  return (
    <form className="panel newproj" onSubmit={create}>
      <h2>New project</h2>
      <label htmlFor="np-name">Name</label>
      <input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tennis court roof, Sept 2026" autoFocus maxLength={80} />
      <fieldset disabled={!env.caps.mcp}>
        <legend>Dropbox folder</legend>
        <label className="radio">
          <input type="radio" name="np-folder" id="np-make" checked={folder === "make"} onChange={() => setFolder("make")} /> Make <code>/Rig Studio/{name.trim() || "…"}</code>
        </label>
        <label className="radio">
          <input type="radio" name="np-folder" id="np-link" checked={folder === "link"} onChange={() => setFolder("link")} /> Use a folder I have
        </label>
        {folder === "link" && <input id="np-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="/Shows/Tennis court" aria-label="Dropbox folder path" />}
        <label className="radio">
          <input type="radio" name="np-folder" id="np-none" checked={folder === "none"} onChange={() => setFolder("none")} /> No folder for now
        </label>
      </fieldset>
      {err && <Notice tone="warn">{err}</Notice>}
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy} id="np-create">
          {busy ? "Creating…" : "Create project"}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ project */

type Tab = "chat" | "layers" | "checks" | "rental" | "versions" | "files";

function ProjectView({ pid, env, jobs }: { pid: string; env: Env; jobs: Job[] }) {
  const db = env.caps.db!;
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [versions, setVersions] = useState<Version[]>([]);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [chat, setChat] = useState<Message[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Sketch | null>(null);
  const [tab, setTab] = useState<Tab>(() => store.get<Tab>("tab", "chat"));
  const [view, setView] = useState<ViewName>(() => store.get<ViewName>("view", "3d"));
  const [show, setShow] = useState<Show>(() => store.get<Show>("show", { truss: true, towers: true, points: true, labels: true }));
  const [picked, setPicked] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "ok" | "warn" | "info"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<null | "approve" | "build-replace">(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => store.set("tab", tab), [tab]);
  useEffect(() => store.set("view", view), [view]);
  useEffect(() => store.set("show", show), [show]);

  useEffect(() => {
    const p = db.doc(`projects/${pid}`);
    const u1 = p.onSnapshot((s) => setProject(s.exists ? ({ ...(s.data() as Project), id: s.id } as Project) : null));
    const u2 = p
      .collection("versions")
      .orderBy("n", "desc")
      .limit(60)
      .onSnapshot((s) => setVersions(s.docs.map((d) => d.data() as Version)));
    const u3 = p.collection("layers").onSnapshot((s) => setLayers(s.docs.map((d) => ({ ...(d.data() as Layer), id: d.id })).sort((a, b) => a.at.localeCompare(b.at))));
    const u4 = p
      .collection("chat")
      .orderBy("at", "asc")
      .limit(300)
      .onSnapshot((s) => setChat(s.docs.map((d) => d.data() as Message)));
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [db, pid]);

  const latest = versions[0];
  const shown = viewing !== null ? versions.find((v) => v.n === viewing) ?? latest : latest;
  const sketch = draft ?? shown?.sketch ?? null;
  const compiled = useMemo<Compiled | null>(() => (sketch ? compileSketch(sketch) : null), [sketch]);
  const extra = useMemo(() => layerLoads(layers), [layers]);
  const findings = useMemo(() => (sketch && compiled ? sketchChecks(sketch, compiled, extra) : []), [sketch, compiled, extra]);
  const loads = useMemo(() => (sketch && compiled ? sketchLoads(sketch, compiled, extra) : null), [sketch, compiled, extra]);

  // Keep the card's little plan current when a session saved a version without one.
  useEffect(() => {
    if (!project || !latest || viewing !== null || draft) return;
    const t = JSON.stringify(thumbOf(latest.sketch));
    const p = project as Project & { thumb?: Thumb };
    if (JSON.stringify(p.thumb ?? null) !== t) db.doc(`projects/${pid}`).update({ thumb: JSON.parse(t) }).catch(() => {});
  }, [project, latest, viewing, draft, db, pid]);

  const flash = useCallback((tone: "ok" | "warn" | "info", text: string) => setToast({ tone, text }), []);

  const saveVersion = useCallback(
    async (sk: Sketch, note: string, by: Version["by"]) => {
      if (!project) return 0;
      const n = Math.max(project.current, latest?.n ?? 0) + 1;
      const at = now();
      await db.doc(`projects/${pid}/versions/${vid(n)}`).set({ n, note: note.slice(0, 300), by, at, sketch: sk } satisfies Version);
      await db.doc(`projects/${pid}`).update({ current: n, updatedAt: at, status: "draft", thumb: thumbOf(sk), name: sk.name || project.name });
      return n;
    },
    [db, pid, project, latest],
  );

  const say = useCallback((m: Message) => db.collection(`projects/${pid}/chat`).add(m), [db, pid]);

  const startSession = useCallback(
    async (request: string, where: "cloud" | "pc", file?: string): Promise<string> => {
      const { trigger: trig, wake } = routeJob(env.workers, where);
      if (!env.caps.mcp) throw new Error("Full sessions need this page open in Claude.");
      if (!trig) throw new Error("Full sessions aren't set up for this page yet. Ask Claude in a chat to set up Rig Studio's sessions.");
      const ref = db.collection("jobs").doc();
      const text = `Rig Studio job ${ref.id}\nproject: ${pid} ("${project?.name ?? ""}")\nwhere: ${where}\nviewing version: ${shown?.n ?? 0}\nrequest:\n${request}\n\n(Every at/updated/updatedAt you write is the real current UTC time from \`date -u +%Y-%m-%dT%H:%M:%SZ\`, read fresh each time.)`;
      const job: Omit<Job, "id"> = {
        pid,
        project: project?.name ?? pid,
        request: request.slice(0, 4000),
        where,
        status: wake ? "waking" : "queued",
        at: now(),
        progress: wake ? "Checking whether your PC is on…" : "Waiting for the session to start",
        ...(wake ? { text } : {}),
        ...(file ? { file } : {}),
      };
      await ref.set(job);
      try {
        const r = payloadOf(await env.caps.mcp.callTool(SERVERS.remote, "fire_trigger", { trigger_id: trig, text: wake ? `wake the PC for job ${ref.id}\n${text}` : text })) as Record<string, unknown> | string | undefined;
        const sid = sessionLink(r);
        if (sid && !wake) await ref.update({ session: sid });
      } catch (e) {
        await ref.update({ status: "failed", reply: mcpWords(e, "Starting a session"), updated: now() });
        throw new Error(mcpWords(e, "Starting a session"));
      }
      return ref.id;
    },
    [db, env, pid, project, shown],
  );

  if (project === undefined) return <div className="boot">Opening project…</div>;
  if (project === null)
    return (
      <main className="home">
        <a href="#" className="back">
          ← Projects
        </a>
        <Notice tone="warn">This project isn't here any more. It may have been removed.</Notice>
      </main>
    );

  const isOld = viewing !== null && viewing !== latest?.n;
  const approveN = shown?.n ?? 0;
  const approvedSketch = versions.find((v) => v.n === project.approved)?.sketch;

  const approve = async () => {
    setConfirm(null);
    await db.doc(`projects/${pid}`).update({ approved: approveN, status: "approved", updatedAt: now() });
    await db.doc(`projects/${pid}/versions/${vid(approveN)}`).update({ approvedAt: now() });
    flash("ok", `Version ${approveN} approved. It's the one that gets built.`);
  };

  const build = async (replace = false) => {
    setConfirm(null);
    if (!project.approved || !approvedSketch) return flash("warn", "Approve a version first: only an approved version is built.");
    if (env.vw !== "ready" || !env.caps.mcp) {
      try {
        await startSession(`Build approved version ${project.approved} of this project in Vectorworks with the connector's build_rig, on a layer named "Rig – ${project.name} v${project.approved}". Then mark the project built.`, "pc");
        setTab("chat");
        flash("info", "Vectorworks isn't reachable from this window, so a session on your PC is building it. Progress shows in the chat.");
      } catch (e) {
        flash("warn", (e as Error).message);
      }
      return;
    }
    setBusy("Building in Vectorworks…");
    try {
      const list = compileSketch(approvedSketch).list;
      const r = payloadOf(await env.caps.mcp.callTool(SERVERS.vw, "build_rig", { build_list: list, layer: `Rig – ${project.name} v${project.approved}`.slice(0, 60), replace })) as Record<string, unknown>;
      const placed = Number(r?.placed ?? 0);
      const failed = Number(r?.failed ?? 0);
      const skipped = Array.isArray(r?.skipped) ? (r.skipped as unknown[]).length : Number(r?.skipped ?? 0);
      if (failed === 0 && placed > 0) {
        await db.doc(`projects/${pid}`).update({ built: project.approved, status: "built", updatedAt: now() });
        flash("ok", `Built in Vectorworks: ${placed} pieces placed${skipped ? `, ${skipped} left for the rental list (no library symbol)` : ""}.`);
      } else flash("warn", `Vectorworks placed ${placed} and couldn't place ${failed}. ${String(r?.message ?? "").slice(0, 200)}`);
    } catch (e) {
      const words = mcpWords(e, "Vectorworks");
      if (/already has objects|replace=true/i.test(words)) setConfirm("build-replace");
      else flash("warn", words);
    } finally {
      setBusy(null);
    }
  };

  const restore = async (v: Version) => {
    const n = await saveVersion({ ...v.sketch, name: project.name }, `Restored version ${v.n}`, "you");
    setViewing(null);
    flash("ok", `Version ${v.n} is back, saved as version ${n}.`);
  };

  const labels: Label[] = loads
    ? loads.supports.map((s) => ({ at: s.at, text: `${Math.round(s.lb)} lb`, tone: s.lb > s.capacity ? "warn" : "ok", id: s.id }))
    : [];

  return (
    <div className="project">
      <header className="pbar">
        <a href="#" className="back" aria-label="Back to projects">
          ← <span>Projects</span>
        </a>
        <NameField name={project.name} onSave={(n) => db.doc(`projects/${pid}`).update({ name: n, updatedAt: now() })} />
        <StatusChip p={project} />
        <div className="pbar-actions">
          <label className="sr" htmlFor="ver">
            Version
          </label>
          <select id="ver" value={viewing ?? latest?.n ?? ""} onChange={(e) => setViewing(Number(e.target.value) === latest?.n ? null : Number(e.target.value))}>
            {versions.map((v) => (
              <option key={v.n} value={v.n}>
                v{v.n}
                {v.n === latest?.n ? " (latest)" : ""}
                {v.n === project.approved ? " ✓ approved" : ""}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => setConfirm("approve")} disabled={!shown || project.approved === approveN} id="approve">
            {project.approved === approveN ? "✓ Approved" : `Approve v${approveN}`}
          </button>
          <button className="btn primary" onClick={() => build()} disabled={!project.approved || !!busy} id="build">
            {busy ?? "Build in Vectorworks"}
          </button>
        </div>
      </header>
      {confirm === "approve" && (
        <div className="confirm">
          <span>Approve version {approveN}? It becomes the version that's built in Vectorworks.</span>
          <button className="btn primary" onClick={approve} id="approve-yes">
            Approve
          </button>
          <button className="btn" onClick={() => setConfirm(null)}>
            Cancel
          </button>
        </div>
      )}
      {confirm === "build-replace" && (
        <div className="confirm">
          <span>Vectorworks already has a layer with this name and things on it. Clear that layer and build again?</span>
          <button className="btn primary" onClick={() => build(true)}>
            Clear it and build
          </button>
          <button className="btn" onClick={() => setConfirm(null)}>
            Cancel
          </button>
        </div>
      )}
      {toast && (
        <div className="toast-wrap">
          <Notice tone={toast.tone} onClose={() => setToast(null)}>
            {toast.text}
          </Notice>
        </div>
      )}
      {isOld && shown && (
        <div className="oldbar">
          <span>
            Looking at version {shown.n}: “{shown.note}”, {ago(shown.at)}.
          </span>
          <button className="btn small" onClick={() => restore(shown)}>
            Bring it back as the latest
          </button>
          <button className="btn small" onClick={() => setViewing(null)}>
            Back to latest
          </button>
        </div>
      )}
      <div className="pmain">
        <section className="stagebox" aria-label="Rig drawing">
          <div className="vtools" role="toolbar" aria-label="View">
            {(["3d", "plan", "front", "side"] as ViewName[]).map((v) => (
              <button key={v} className={`seg ${view === v ? "on" : ""}`} aria-pressed={view === v} onClick={() => setView(v)}>
                {v === "3d" ? "3D" : v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
            <span className="vsep" />
            <button className="seg" onClick={() => window.dispatchEvent(new Event("rs-fit"))}>
              Fit
            </button>
            <button className={`seg ${show.labels ? "on" : ""}`} aria-pressed={show.labels} onClick={() => setShow({ ...show, labels: !show.labels })}>
              Loads
            </button>
          </div>
          {sketch && compiled ? (
            <ViewerPane sketch={sketch} compiled={compiled} layers={layers} view={view} show={show} labels={labels} picked={picked} onPick={setPicked} />
          ) : (
            <div className="boot">Loading the drawing…</div>
          )}
          {sketch && !sketch.runs.length && !sketch.towers.length && !layers.length && (
            <div className="blank-hint">
              <strong>Blank project.</strong> Add the venue drawing or lighting plot under Layers or Files, then ask Claude below to lay out truss over it, or describe the rig: “a 40' × 30' box truss grid at 24' trim with a hoist at each corner”.
            </div>
          )}
          {picked && sketch && <PickedCard id={picked} sketch={sketch} loads={loads} onClose={() => setPicked(null)} />}
          <div className="legend" aria-hidden="true">
            <span>
              <i className="sw truss" /> Truss
            </span>
            <span>
              <i className="sw hoist" /> Hoists
            </span>
            {layers.some((l) => l.kind === "rig" && l.visible) && (
              <span>
                <i className="sw existing" /> Existing rig (from the drawing)
              </span>
            )}
            {layers.some((l) => l.kind === "fixtures" && l.visible) && (
              <span>
                <i className="sw fixture" /> Fixtures
              </span>
            )}
          </div>
        </section>
        <aside className="side">
          <nav className="tabs" role="tablist">
            {(
              [
                ["chat", "Chat"],
                ["layers", "Layers"],
                ["checks", `Checks${findings.some((f) => f.level === "warn") ? " !" : ""}`],
                ["rental", "Rental"],
                ["versions", "Versions"],
                ["files", "Files"],
              ] as [Tab, string][]
            ).map(([t, label]) => (
              <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)} id={`tab-${t}`}>
                {label}
              </button>
            ))}
          </nav>
          <div className="tabpane">
            {tab === "chat" && sketch && (
              <ChatPane
                env={env}
                project={project}
                chat={chat}
                jobs={jobs}
                sketch={latest?.sketch ?? sketch}
                layers={layers}
                say={say}
                saveVersion={saveVersion}
                startSession={startSession}
                onDraft={setDraft}
                viewingOld={isOld}
                onLatest={() => setViewing(null)}
              />
            )}
            {tab === "layers" && <LayersPane env={env} pid={pid} layers={layers} show={show} setShow={setShow} flash={flash} />}
            {tab === "checks" && <ChecksPane findings={findings} loads={loads} sketch={sketch} />}
            {tab === "rental" && compiled && sketch && <RentalPane env={env} compiled={compiled} sketch={sketch} name={project.name} version={shown?.n ?? 0} flash={flash} />}
            {tab === "versions" && (
              <VersionsPane
                versions={versions}
                project={project}
                viewing={shown?.n ?? null}
                onView={(n) => setViewing(n === latest?.n ? null : n)}
                onRestore={restore}
                onArchive={async (on) => {
                  await db.doc(`projects/${pid}`).update({ archived: on, updatedAt: now() });
                  flash("ok", on ? "Archived. It's under Archived projects on the list; nothing was deleted." : "Back on the project list.");
                }}
              />
            )}
            {tab === "files" && <FilesPane env={env} project={project} layers={layers} jobs={jobs} startSession={startSession} flash={flash} goChat={() => setTab("chat")} />}
          </div>
        </aside>
      </div>
    </div>
  );
}

function NameField({ name, onSave }: { name: string; onSave: (n: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(name);
  useEffect(() => setV(name), [name]);
  if (!edit)
    return (
      <h1 className="pname">
        <button className="name-btn" onClick={() => setEdit(true)} title="Rename">
          {name}
        </button>
      </h1>
    );
  return (
    <form
      className="pname"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onSave(v.trim());
        setEdit(false);
      }}
    >
      <input id="rename" value={v} onChange={(e) => setV(e.target.value)} autoFocus maxLength={80} onBlur={() => setEdit(false)} aria-label="Project name" />
    </form>
  );
}

function ViewerPane(props: { sketch: Sketch; compiled: Compiled; layers: Layer[]; view: ViewName; show: Show; labels: Label[]; picked: string | null; onPick: (id: string | null) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const first = useRef(true);
  const { sketch, compiled, layers, view, show, labels, picked, onPick } = props;
  useEffect(() => {
    const v = new Viewer(host.current!);
    viewer.current = v;
    (window as unknown as { __rsViewer?: Viewer }).__rsViewer = v;
    const fit = () => v.fit();
    window.addEventListener("rs-fit", fit);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const re = () => v.retheme();
    mq.addEventListener("change", re);
    const mo = new MutationObserver(re);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      window.removeEventListener("rs-fit", fit);
      mq.removeEventListener("change", re);
      mo.disconnect();
      v.dispose();
      viewer.current = null;
    };
  }, []);
  useEffect(() => {
    if (viewer.current) viewer.current.onPick = onPick;
  }, [onPick]);
  useEffect(() => {
    viewer.current?.setLayers(layers);
  }, [layers]);
  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    v.setRig(sketch, compiled, show);
    if (first.current) {
      first.current = false;
      v.setView(view);
    }
  }, [sketch, compiled, show]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    viewer.current?.setView(view);
  }, [view]);
  useEffect(() => {
    viewer.current?.setLabels(labels, show.labels);
  }, [labels, show.labels]);
  useEffect(() => {
    viewer.current?.highlight(new Set(picked ? [picked] : []));
  }, [picked, compiled]);
  return <div className="viewer" ref={host} />;
}

function PickedCard({ id, sketch, loads, onClose }: { id: string; sketch: Sketch; loads: ReturnType<typeof sketchLoads> | null; onClose: () => void }) {
  const run = sketch.runs.find((r) => r.id === id);
  const tower = sketch.towers.find((t) => t.id === id);
  const point = sketch.points.find((p) => p.id === id);
  const load = sketch.loads.find((l) => l.id === id);
  const sup = loads?.supports.find((s) => s.id === id);
  let title = id;
  let body = "";
  if (run) {
    const len = Math.hypot(run.b[0] - run.a[0], run.b[1] - run.a[1], run.b[2] - run.a[2]);
    title = run.label ?? `Run ${run.id}`;
    body = `${ftIn(len)} joint to joint, ${Math.abs(run.a[2] - run.b[2]) > 1 ? "vertical" : `at ${ftIn(run.a[2] - SERIES[sketch.series].height / 2)} trim (bottom chord)`}.`;
  } else if (tower) {
    title = tower.label ?? `Tower ${tower.id}`;
    body = `Ground-support tower at x ${ftIn(tower.x)}, y ${ftIn(tower.y)}${sup ? `, carrying about ${Math.round(sup.lb)} of ${Math.round(sup.capacity)} lb` : ""}.`;
  } else if (point) {
    title = point.label ?? `Point ${point.id}`;
    body = `${point.kind === "hoist" ? "Chain hoist" : "Dead-hang"}, ${point.capacity} lb, at ${ftIn(point.at[2])}${sup ? `; carries about ${Math.round(sup.lb)} lb` : ""}.`;
  } else if (load) {
    title = load.label;
    body = `${load.lb} lb hung at ${ftIn(load.at[2])}.`;
  }
  return (
    <div className="picked" role="status">
      <div>
        <strong>{title}</strong> <span className="muted small">({id})</span>
        <div>{body}</div>
        <div className="muted small">Ask in the chat to change it, e.g. “move {id} 2' downstage”.</div>
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ chat */

function Thumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url ? <img src={url} alt={file.name} /> : null;
}

function ChatPane(props: {
  env: Env;
  project: Project;
  chat: Message[];
  jobs: Job[];
  sketch: Sketch;
  layers: Layer[];
  say: (m: Message) => Promise<unknown>;
  saveVersion: (sk: Sketch, note: string, by: Version["by"]) => Promise<number>;
  startSession: (request: string, where: "cloud" | "pc", file?: string) => Promise<string>;
  onDraft: (s: Sketch | null) => void;
  viewingOld: boolean;
  onLatest: () => void;
}) {
  const { env, project, chat, jobs, sketch, layers, say, saveVersion, startSession, onDraft } = props;
  const [text, setText] = useState(() => store.get(`draft:${project.id}`, ""));
  const [working, setWorking] = useState<string | null>(null);
  const [stream, setStream] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [where, setWhere] = useState<"cloud" | "pc">("cloud");
  const [imgs, setImgs] = useState<File[]>([]);
  const [imgLimits, setImgLimits] = useState<{ maxCount: number; maxInputBytes: number; mediaTypes: string[] } | null>(null);
  useEffect(() => {
    env.caps.sample
      ?.limits()
      .then((l) => setImgLimits((l as { images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] } }).images ?? null))
      .catch(() => setImgLimits(null));
  }, [env.caps.sample]);
  const addImages = (files: File[]) => {
    const types = imgLimits?.mediaTypes ?? ["image/png", "image/jpeg", "image/webp", "image/gif"];
    const ok = files.filter((f) => types.includes(f.type));
    const big = ok.filter((f) => imgLimits && f.size > imgLimits.maxInputBytes);
    const max = imgLimits?.maxCount ?? 4;
    const next = [...imgs, ...ok.filter((f) => !big.includes(f))].slice(0, max);
    if (ok.length < files.length) setErr("Only pictures (PNG, JPG, WebP, GIF) can go in the chat. PDFs and drawings go under Layers.");
    else if (big.length) setErr(`${big[0].name} is too big to send. Try a smaller picture or a screenshot of the part that matters.`);
    else if (imgs.length + ok.length > max) setErr(`Up to ${max} pictures at a time.`);
    setImgs(next);
  };
  /** Keep the pictures with the project (so the chat shows them and a full session can open them). */
  const keepImages = async (files: File[]): Promise<string[]> => {
    if (!env.caps.assets || !files.length) return [];
    const ids: string[] = [];
    for (const f of files) {
      try {
        ids.push((await env.caps.assets.upload(f, { type: f.type })).id);
      } catch {
        /* the chat still works without the copy */
      }
    }
    return ids;
  };
  const abort = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => store.set(`draft:${project.id}`, text), [text, project.id]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [chat.length, stream, working]);

  const active = jobs.filter(jobActive);

  const ask = async () => {
    const req = text.trim() || (imgs.length ? "Here's a picture for reference." : "");
    if (!req || working) return;
    if (!env.caps.sample) return setErr("Claude can't be asked from this view. Open the page in Claude, signed in.");
    setErr(null);
    setText("");
    props.onLatest();
    const files = imgs;
    setImgs([]);
    const kept = await keepImages(files);
    await say({ role: "you", text: req, at: now(), ...(kept.length ? { images: kept } : {}) });
    const state = { sketch, changed: false, notes: [] as string[] };
    const ctx: Ctx = {
      sketch,
      layers,
      history: chat,
      projectName: project.name,
      onDraft: (s) => onDraft(s),
      onProgress: setWorking,
      startSession,
    };
    const msgs = turns(chat, files.length ? `${req}\n\n(I attached ${files.length === 1 ? "a picture" : `${files.length} pictures`}: look at ${files.length === 1 ? "it" : "them"} before answering.)` : req);
    msgs[0] = { role: "user", content: `${systemPrompt(ctx)}\n\n---\n\n${msgs[0].content}` };
    abort.current = new AbortController();
    setWorking("Thinking…");
    setStream("");
    try {
      const r = await env.caps.sample(msgs, {
        ...(files.length && imgLimits ? { images: files } : {}),
        tools: aiTools(ctx, state),
        signal: abort.current.signal,
        modelTier: "default",
        onText: ({ text: t }: { text: string }) => {
          setStream(t);
          setWorking(null);
        },
      });
      let version: number | undefined;
      if (state.changed) version = await saveVersion(state.sketch, state.notes.join("; ") || req, "claude");
      await say({ role: "claude", text: r.text.trim() || (state.changed ? "Done." : "…"), at: now(), ...(version ? { version } : {}) });
    } catch (e) {
      const er = e as { code?: string; message?: string; text?: string };
      if (state.changed) {
        const n = await saveVersion(state.sketch, `${state.notes.join("; ")} (stopped part way)`, "claude");
        await say({ role: "claude", text: `${er.text?.trim() || "Stopped."} The changes so far are saved as version ${n}.`, at: now(), version: n });
      }
      const words: Record<string, string> = {
        not_granted: "Claude isn't allowed on this page yet. Allow it when asked, or from the page's Permissions menu.",
        rate_limited: "Too many requests just now. Wait a minute and ask again.",
        cancelled: "Stopped.",
        prompt_too_large: "This rig is too big to edit in the chat. Use “Start a full session” instead.",
        images_unavailable: "Pictures can't be sent to Claude from this view. Start a full session instead; it can open them.",
        image_rejected: "Claude couldn't read one of the pictures. Try a PNG or JPG screenshot.",
      };
      if (er.code !== "cancelled" || !state.changed) setErr(words[er.code ?? ""] ?? `Claude couldn't finish: ${er.message ?? "unknown problem"}.`);
      if (!state.changed && er.code !== "cancelled") {
        setText(req);
        setImgs(files);
      }
    } finally {
      onDraft(null);
      setWorking(null);
      setStream("");
      abort.current = null;
    }
  };

  const session = async () => {
    const req = text.trim();
    if (!req) return setErr("Say what the session should do first.");
    setErr(null);
    try {
      const files = imgs;
      const kept = await keepImages(files);
      if (files.length && kept.length < files.length) return setErr("The pictures couldn't be saved with the project, so a session couldn't open them. Try again, or send the request without them.");
      setImgs([]);
      await say({ role: "you", text: req, at: now(), ...(kept.length ? { images: kept } : {}) });
      const id = await startSession(
        kept.length ? `${req}\n\nAttached pictures (this page's assets): ${kept.join(", ")}. Open each with the Artifact tool: action "read", url = the page, path = the id.` : req,
        where,
      );
      setText("");
      await say({ role: "session", text: `Started a full session ${where === "pc" ? "on your PC" : "in the cloud"}. Its progress shows here; it saves a new version when it's done.`, at: now(), job: id });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="chat">
      <div className="msgs" ref={list} aria-live="polite">
        {!chat.length && !working && (
          <div className="muted chat-empty">
            <p>Ask for changes in plain words. Claude edits the drawing here and saves each change as a version.</p>
            <ul className="examples">
              {[
                "Lay out 12\" box over the lighting plot, a run over each row of fixtures, hoists every 25'",
                "Add a 40' upstage truss at 24' trim, 6' behind the last row",
                "Move all hoists on the downstage truss 2' offstage",
              ].map((x) => (
                <li key={x}>
                  <button className="link" onClick={() => setText(x)}>
                    {x}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {chat.map((m, i) => {
          const job = m.job ? jobs.find((j) => j.id === m.job) : undefined;
          return (
            <div key={i} className={`msg ${m.role}`}>
              <div className="msg-who">
                {m.role === "you" ? "You" : m.role === "claude" ? "Claude" : "Full session"} <span className="muted">· {ago(m.at)}</span>
                {m.version ? <span className="vtag">v{m.version}</span> : null}
              </div>
              <div className="msg-text">{m.text}</div>
              {!!m.images?.length && (
                <div className="msg-imgs">
                  {m.images.map((id) => (
                    <a key={id} href={`/_blob/${id}`} target="_blank" rel="noreferrer">
                      <img src={`/_blob/${id}`} alt="Picture sent with this message" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
              {job && !m.version && (
                <ul className="jobs">
                  <JobRow j={job} brief />
                </ul>
              )}
            </div>
          );
        })}
        {(working || stream) && (
          <div className="msg claude live">
            <div className="msg-who">Claude</div>
            {stream && <div className="msg-text">{stream}</div>}
            {working && <div className="working">◐ {working}</div>}
          </div>
        )}
      </div>
      {active.length > 0 && <div className="active-jobs">◐ {active.length === 1 ? "A full session is working on this project." : `${active.length} full sessions are working on this project.`}</div>}
      {props.viewingOld && <div className="muted small">Chat changes start from the latest version.</div>}
      {err && (
        <Notice tone="warn" onClose={() => setErr(null)}>
          {err}
        </Notice>
      )}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addImages([...e.dataTransfer.files]);
        }}
      >
        <label htmlFor="ask" className="sr">
          Ask Claude
        </label>
        <textarea
          id="ask"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Change the rig, or describe a big job… (paste a picture to show Claude)"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
          }}
          onPaste={(e) => {
            const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
            if (files.length) {
              e.preventDefault();
              addImages(files);
            }
          }}
        />
        {imgs.length > 0 && (
          <ul className="pending-imgs" aria-label="Pictures to send">
            {imgs.map((f, i) => (
              <li key={i}>
                <Thumb file={f} />
                <button type="button" className="icon-btn" aria-label={`Remove ${f.name}`} onClick={() => setImgs(imgs.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="composer-row">
          {working ? (
            <button type="button" className="btn" onClick={() => abort.current?.abort()} id="stop">
              Stop
            </button>
          ) : (
            <button type="submit" className="btn primary" disabled={!text.trim() && !imgs.length} id="send">
              Change it
            </button>
          )}
          <span className="or">or</span>
          <button type="button" className="btn" onClick={session} disabled={!text.trim() || !!working} id="start-session">
            Start a full session
          </button>
          <label className="sr" htmlFor="where">
            Where the session runs
          </label>
          <select id="where" value={where} onChange={(e) => setWhere(e.target.value as "cloud" | "pc")}>
            <option value="cloud">in the cloud</option>
            <option value="pc">on my PC (Vectorworks, local files)</option>
          </select>
          {where === "pc" && <WakeLink />}
        </div>
      </form>
    </div>
  );
}

/** The PC sleeps; this opens the site page that wakes it through the home server. */
export const WAKE_URL = "https://tylerflores.dev/private/pc";
function WakeLink() {
  return (
    <a className="link small wake" href={WAKE_URL} target="_blank" rel="noreferrer">
      PC asleep? Wake it ↗
    </a>
  );
}

/* ------------------------------------------------------------------ layers */

async function pdfToPng(file: File, page: number): Promise<{ blob: Blob; w: number; h: number; pages: number }> {
  const w = window as unknown as { pdfjsLib?: { getDocument(o: object): { promise: Promise<PdfDoc> }; GlobalWorkerOptions: { workerSrc: string } } };
  type PdfDoc = { numPages: number; getPage(n: number): Promise<{ getViewport(o: { scale: number }): { width: number; height: number }; render(o: object): { promise: Promise<void> } }> };
  const load = (src: string) =>
    new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => res();
      s.onerror = () => rej(new Error("Couldn't load the PDF reader."));
      document.head.appendChild(s);
    });
  if (!w.pdfjsLib) {
    await load("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    await load("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js");
  }
  const lib = w.pdfjsLib!;
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const pg = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
  const base = pg.getViewport({ scale: 1 });
  const scale = Math.min(4, 3200 / Math.max(base.width, base.height));
  const vp = pg.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  await pg.render({ canvasContext: g, viewport: vp }).promise;
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't draw the page."))), "image/png"));
  return { blob, w: canvas.width, h: canvas.height, pages: doc.numPages };
}

function LayersPane({ env, pid, layers, show, setShow, flash }: { env: Env; pid: string; layers: Layer[]; show: Show; setShow: (s: Show) => void; flash: (t: "ok" | "warn" | "info", s: string) => void }) {
  const db = env.caps.db!;
  const [busy, setBusy] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const col = db.collection(`projects/${pid}/layers`);

  const upload = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    try {
      if (["csv", "txt", "tsv"].includes(ext)) {
        const { fixtures, problem } = fixturesFromCsv(await file.text());
        if (problem) return flash("warn", problem);
        await col.add({ name: file.name, kind: "fixtures", visible: true, onRig: true, at: now(), fixtures, source: { name: file.name, from: "upload" } } satisfies Omit<Layer, "id">);
        return flash("ok", `Added ${fixtures.length} fixtures from ${file.name}.`);
      }
      if (["vwx", "dwg", "dxf"].includes(ext)) return flash("info", `${file.name} can't be read in the page. Put it in the project's Dropbox folder and use “Read it in Vectorworks” under Files, or open it in Vectorworks on the PC and use “Read lighting from Vectorworks”.`);
      if (!env.caps.assets) return flash("warn", "Uploading needs editing rights on this page.");
      setBusy(`Adding ${file.name}…`);
      let blob: Blob = file;
      let px: [number, number];
      if (ext === "pdf" || file.type === "application/pdf") {
        const r = await pdfToPng(file, page);
        blob = r.blob;
        px = [r.w, r.h];
        if (r.pages > 1) flash("info", `${file.name} has ${r.pages} pages; added page ${Math.min(page, r.pages)}. Pick another page number before adding to use a different one.`);
      } else {
        const url = URL.createObjectURL(file);
        px = await new Promise<[number, number]>((res, rej) => {
          const im = new Image();
          im.onload = () => res([im.naturalWidth, im.naturalHeight]);
          im.onerror = () => rej(new Error("That image didn't open."));
          im.src = url;
        });
        URL.revokeObjectURL(url);
      }
      const up = await env.caps.assets.upload(blob, { type: blob.type || "image/png" });
      await col.add({ name: file.name.replace(/\.[^.]+$/, ""), kind: "image", visible: true, at: now(), asset: up.id, px, widthIn: 600, x: 0, y: 0, z: 0, rot: 0, opacity: 0.75, source: { name: file.name, from: "upload" } } satisfies Omit<Layer, "id">);
      flash("ok", `Added ${file.name}. Set its real width under the layer so it's to scale.`);
    } catch (e) {
      const er = e as { code?: string; message?: string };
      flash("warn", er.code === "quota_exceeded" ? "This page's file storage is full. Remove an old drawing first." : `Couldn't add ${file.name}: ${er.message ?? String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const fromVw = async () => {
    if (!env.caps.mcp) return;
    setBusy("Reading lighting from Vectorworks…");
    try {
      const info = payloadOf(await env.caps.mcp.callTool(SERVERS.vw, "get_document_info", {})) as { document?: string };
      const res = payloadOf(await env.caps.mcp.callTool(SERVERS.vw, "get_lighting_devices", { limit: 2000 }));
      const fixtures = fixturesFromVectorworks(res);
      if (!fixtures.length) return flash("info", "The drawing open in Vectorworks has no lighting devices.");
      const name = `Lighting from ${String(info?.document ?? "Vectorworks").replace(/\.vwx$/i, "")}`;
      await col.add({ name, kind: "fixtures", visible: true, onRig: true, at: now(), fixtures, source: { name: String(info?.document ?? "Vectorworks"), from: "vectorworks" } } satisfies Omit<Layer, "id">);
      flash("ok", `Added ${fixtures.length} fixtures from Vectorworks.`);
    } catch (e) {
      flash("warn", mcpWords(e, "Vectorworks"));
    } finally {
      setBusy(null);
    }
  };

  const patch = (l: Layer, d: Partial<Layer>) => db.doc(`projects/${pid}/layers/${l.id}`).update(d);

  return (
    <div className="pane">
      <h2 className="h3">The rig</h2>
      <div className="toggles">
        {(
          [
            ["truss", "Truss and blocks"],
            ["towers", "Towers"],
            ["points", "Hoists and points"],
            ["labels", "Load labels"],
          ] as [keyof Show, string][]
        ).map(([k, label]) => (
          <label key={k} className="check">
            <input type="checkbox" id={`show-${k}`} checked={show[k]} onChange={() => setShow({ ...show, [k]: !show[k] })} /> {label}
          </label>
        ))}
      </div>
      <h2 className="h3">Drawings and plots</h2>
      {!layers.length && <p className="muted">Nothing yet. Add the venue plan, a stage drawing or the lighting plot to lay the rig out over.</p>}
      <ul className="layers">
        {layers.map((l) => (
          <li key={l.id} className="layer">
            <div className="layer-row">
              <label className="check">
                <input type="checkbox" id={`vis-${l.id}`} checked={l.visible} onChange={() => patch(l, { visible: !l.visible })} />
                <span>
                  {l.name} <span className="muted small">{l.kind === "image" ? "drawing" : l.kind === "fixtures" ? `${l.fixtures?.length ?? 0} fixtures` : l.kind === "rig" ? `${l.rig?.length ?? 0} truss and rigging pieces` : `${l.shapes?.length ?? 0} outlines`}</span>
                </span>
              </label>
              <button className="link small" onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}>
                {open === l.id ? "Done" : "Adjust"}
              </button>
            </div>
            {open === l.id && (
              <div className="layer-edit">
                {l.kind === "image" && (
                  <>
                    <LenField id={`w-${l.id}`} label="Real width of the drawing" value={l.widthIn ?? 600} onSave={(v) => patch(l, { widthIn: v })} />
                    <LenField id={`x-${l.id}`} label="Left edge at x" value={l.x ?? 0} onSave={(v) => patch(l, { x: v })} allowNeg />
                    <LenField id={`y-${l.id}`} label="Bottom edge at y" value={l.y ?? 0} onSave={(v) => patch(l, { y: v })} allowNeg />
                    <label htmlFor={`r-${l.id}`}>Turn (degrees)</label>
                    <input id={`r-${l.id}`} type="number" step="90" defaultValue={l.rot ?? 0} onBlur={(e) => patch(l, { rot: Number(e.target.value) || 0 })} />
                    <label htmlFor={`o-${l.id}`}>See-through</label>
                    <input id={`o-${l.id}`} type="range" min="0.15" max="1" step="0.05" defaultValue={l.opacity ?? 0.75} onChange={(e) => patch(l, { opacity: Number(e.target.value) })} />
                  </>
                )}
                {l.kind === "fixtures" && (
                  <label className="check">
                    <input type="checkbox" id={`onrig-${l.id}`} checked={!!l.onRig} onChange={() => patch(l, { onRig: !l.onRig })} /> Count their weight on the rig ({Math.round((l.fixtures ?? []).reduce((s, f) => s + f.lb, 0))} lb)
                  </label>
                )}
                {l.source && (
                  <p className="muted small">
                    From {l.source.from === "upload" ? "an upload" : l.source.from === "dropbox" ? "Dropbox" : l.source.from === "vectorworks" ? "Vectorworks" : "a session"}: {l.source.name}, {ago(l.at)}
                  </p>
                )}
                {del === l.id ? (
                  <div className="row">
                    <span>Remove this layer?</span>
                    <button
                      className="btn small"
                      onClick={async () => {
                        await db.doc(`projects/${pid}/layers/${l.id}`).delete();
                        if (l.asset && env.caps.assets) env.caps.assets.delete(l.asset).catch(() => {});
                        setDel(null);
                      }}
                    >
                      Remove
                    </button>
                    <button className="btn small" onClick={() => setDel(null)}>
                      Keep
                    </button>
                  </div>
                ) : (
                  <button className="link small danger" onClick={() => setDel(l.id)}>
                    Remove layer
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="adder">
        <label className="btn" htmlFor="layer-file">
          + Add a drawing or plot
        </label>
        <input
          id="layer-file"
          type="file"
          className="sr"
          accept="image/png,image/jpeg,image/webp,application/pdf,.pdf,.csv,.txt,.vwx,.dwg"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f);
          }}
        />
        <label className="inline" htmlFor="pdf-page">
          PDF page <input id="pdf-page" type="number" min="1" value={page} onChange={(e) => setPage(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <p className="muted small">PDF, PNG or JPG drawings sit under the rig to scale. A CSV with x, y, z (feet), weight and type columns becomes fixtures.</p>
        {env.vw === "ready" && (
          <button className="btn" onClick={fromVw} id="from-vw">
            Read lighting from Vectorworks
          </button>
        )}
        {busy && <p className="working">◐ {busy}</p>}
      </div>
    </div>
  );
}

function LenField({ id, label, value, onSave, allowNeg }: { id: string; label: string; value: number; onSave: (v: number) => void; allowNeg?: boolean }) {
  const [v, setV] = useState(ftIn(value));
  const [bad, setBad] = useState(false);
  useEffect(() => setV(ftIn(value)), [value]);
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={v}
        aria-invalid={bad}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = parseLength(v.replace("−", "-").includes("'") || v.includes('"') ? v.replace("−", "-") : `${v}'`, 1);
          if (n === null || (!allowNeg && n <= 0)) return setBad(true);
          setBad(false);
          if (Math.abs(n - value) > 0.01) onSave(n);
        }}
      />
      {bad && <span className="field-err">✕ Write it like 40' or 40'-6"</span>}
    </>
  );
}

/* ------------------------------------------------------------------ checks, rental, versions */

function ChecksPane({ findings, loads, sketch }: { findings: ReturnType<typeof sketchChecks>; loads: ReturnType<typeof sketchLoads> | null; sketch: Sketch | null }) {
  return (
    <div className="pane">
      <p className="muted small">Planning checks, not engineering. Confirm loads with the rental house and the truss maker's tables.</p>
      <ul className="findings">
        {findings.map((f) => (
          <li key={f.id} className={`finding ${f.level}`}>
            <span className="fglyph" aria-hidden="true">
              {glyph[f.level]}
            </span>
            <span>
              <span className="sr">{f.level === "warn" ? "Check: " : f.level === "ok" ? "Fine: " : "Note: "}</span>
              {f.text}
            </span>
          </li>
        ))}
      </ul>
      {loads && loads.supports.length > 0 && (
        <>
          <h2 className="h3">What each point carries</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>Point</th>
                <th className="num">Load</th>
                <th className="num">Limit</th>
                <th>Use</th>
              </tr>
            </thead>
            <tbody>
              {loads.supports.map((s) => {
                const pct = Math.min(100, (s.lb / s.capacity) * 100);
                const over = s.lb > s.capacity;
                return (
                  <tr key={s.id} className={over ? "over" : ""}>
                    <td>
                      {s.label}
                      <span className="muted small"> {s.kind === "tower" ? "tower" : s.kind === "deadhang" ? "dead-hang" : "hoist"}</span>
                    </td>
                    <td className="num">{Math.round(s.lb)} lb</td>
                    <td className="num">{Math.round(s.capacity)} lb</td>
                    <td>
                      <span className="bar" aria-hidden="true">
                        <i style={{ width: `${pct}%` }} className={over ? "over" : ""} />
                      </span>
                      <span className="small">{over ? "✕ over" : `${Math.round(pct)}%`}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      {sketch && <p className="muted small">{SERIES[sketch.series].label}. Tower limit {sketch.towerLimit} lb.</p>}
    </div>
  );
}

function RentalPane({ env, compiled, sketch, name, version, flash }: { env: Env; compiled: Compiled; sketch: Sketch; name: string; version: number; flash: (t: "ok" | "warn" | "info", s: string) => void }) {
  const lines = [...rentalList(compiled.list), ...pointLines(sketch)];
  const lb = totalWeight(lines);
  const text = [`${name} (v${version}): rental list`, ...lines.map((l) => `${l.qty} × ${l.item}${l.note ? ` (${l.note})` : ""}`), `About ${Math.round(lb)} lb in all.`].join("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      flash("ok", "Rental list copied.");
    } catch {
      const el = document.getElementById("rental-text") as HTMLTextAreaElement | null;
      el?.select();
      flash("info", "Copying isn't allowed here; the list is selected below, so copy it yourself.");
    }
  };
  const csv = async () => {
    if (!env.caps.downloads) return flash("info", "Saving files isn't available in this view.");
    const rows = [["Qty", "Item", "Note", "Weight (lb)"], ...lines.map((l) => [String(l.qty), l.item, l.note ?? "", String(Math.round(l.lb))])];
    const data = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    try {
      await env.caps.downloads.save({ filename: `${name.replace(/[^\w -]+/g, "")} v${version} rental.csv`, data });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "declined" && code !== "cancelled") flash("warn", `Couldn't save the file: ${(e as Error).message ?? code}`);
    }
  };
  return (
    <div className="pane">
      {!lines.length ? (
        <p className="muted">Nothing to rent yet.</p>
      ) : (
        <>
          <table className="tbl">
            <thead>
              <tr>
                <th className="num">Qty</th>
                <th>Item</th>
                <th className="num">lb</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td className="num">{l.qty}</td>
                  <td>
                    {l.item}
                    {l.note && <div className="muted small">{l.note}</div>}
                  </td>
                  <td className="num">{Math.round(l.lb)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td />
                <td>About, in all</td>
                <td className="num">{Math.round(lb)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="row">
            <button className="btn" onClick={copy} id="copy-rental">
              Copy list
            </button>
            <button className="btn" onClick={csv} id="csv-rental">
              Save as CSV
            </button>
          </div>
          <textarea id="rental-text" className="sr" readOnly value={text} aria-label="Rental list text" />
          <p className="muted small">Typical weights, for planning. Check the rental house's sheet.</p>
        </>
      )}
    </div>
  );
}

function VersionsPane({ versions, project, viewing, onView, onRestore, onArchive }: { versions: Version[]; project: Project; viewing: number | null; onView: (n: number) => void; onRestore: (v: Version) => void; onArchive: (on: boolean) => void }) {
  const [ask, setAsk] = useState(false);
  const isArchived = !!(project as Project & { archived?: boolean }).archived;
  return (
    <div className="pane">
      <ol className="versions">
        {versions.map((v) => (
          <li key={v.n} className={`version ${viewing === v.n ? "on" : ""}`}>
            <div className="vhead">
              <strong>v{v.n}</strong>
              <span className="muted small">
                {v.by === "you" ? "You" : v.by === "claude" ? "Claude" : "Full session"} · {ago(v.at)}
              </span>
              {v.n === project.approved && <span className="chip ok small">✓ Approved</span>}
              {v.n === project.built && <span className="chip built small">▣ Built</span>}
            </div>
            <div className="vnote">{v.note}</div>
            <div className="row">
              <button className="link small" onClick={() => onView(v.n)} disabled={viewing === v.n}>
                {viewing === v.n ? "Showing" : "Show"}
              </button>
              {v.n !== versions[0]?.n && (
                <button className="link small" onClick={() => onRestore(v)}>
                  Bring back
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {isArchived ? (
        <button className="link small" onClick={() => onArchive(false)}>
          Put this project back on the list
        </button>
      ) : ask ? (
        <div className="row">
          <span>Archive this project? It leaves the list; nothing is deleted.</span>
          <button className="btn small" id="archive-yes" onClick={() => (setAsk(false), onArchive(true))}>
            Archive
          </button>
          <button className="btn small" onClick={() => setAsk(false)}>
            Keep it
          </button>
        </div>
      ) : (
        <button className="link small" id="archive" onClick={() => setAsk(true)}>
          Archive this project
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ files (Dropbox) */

type Entry = { name: string; path: string; path_display?: string; file_id?: string; modified_time?: string; object_type: string; file?: { size?: number } };

function FilesPane({ env, project, layers, jobs, startSession, flash, goChat }: { env: Env; project: Project; layers: Layer[]; jobs: Job[]; startSession: (r: string, w: "cloud" | "pc", file?: string) => Promise<string>; flash: (t: "ok" | "warn" | "info", s: string) => void; goChat: () => void }) {
  const db = env.caps.db!;
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stamp, setStamp] = useState<number | null>(null);
  const [linkPath, setLinkPath] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const mcp = env.caps.mcp;
    if (!mcp || !project.dropbox) return;
    setErr(null);
    const un = mcp.watchTool(
      SERVERS.dropbox,
      "list_folder",
      { path: project.dropbox.path, recursive: false },
      (ev) => {
        if (ev.type === "data") {
          const p = payloadOf(ev.result as never) as { entries?: Entry[] };
          setEntries((p?.entries ?? []).filter((e) => !e.name.startsWith(".")).sort((a, b) => (b.modified_time ?? "").localeCompare(a.modified_time ?? "")));
          setStamp(ev.result.cache?.storedAt ?? Date.now());
          setErr(null);
        } else {
          const transient = ev.error.code === "server_unavailable" || ev.error.code === "upstream_error";
          if (!transient) setEntries(null);
          setErr(mcpWords(ev.error, "Dropbox"));
        }
      },
      { refetchInterval: 120000, cache: { staleTime: 60000, gcTime: 600000 } },
    );
    return un;
  }, [env.caps.mcp, project.dropbox, tick]);

  const link = async () => {
    const mcp = env.caps.mcp;
    if (!mcp) return;
    const p0 = linkPath.trim();
    if (!p0) return;
    const p = p0.startsWith("/") || p0.startsWith("ns:") ? p0 : `/${p0}`;
    try {
      const meta = payloadOf(await mcp.callTool(SERVERS.dropbox, "get_file_metadata", { path_or_file_id: p })) as { metadata_type?: string; folder?: { path_display?: string } };
      if (meta?.metadata_type !== "folder") return flash("warn", `${p} isn't a folder in your Dropbox.`);
      await db.doc(`projects/${project.id}`).update({ dropbox: { path: p, display: meta.folder?.path_display ?? p } });
    } catch (e) {
      flash("warn", mcpWords(e, "Dropbox"));
    }
  };

  const markSeen = (list: Entry[]) => {
    const seen = { ...project.seen };
    for (const e of list) if (e.file_id && e.modified_time) seen[e.file_id] = e.modified_time;
    return db.doc(`projects/${project.id}`).update({ seen });
  };

  const [opening, setOpening] = useState<string | null>(null);
  /** Turn a read-out from Dropbox into layers (fixtures, the existing rig, outlines). */
  const openReadout = async (e: Entry) => {
    const mcp = env.caps.mcp;
    if (!mcp || !e.file_id) return;
    setOpening(e.file_id);
    try {
      const res = payloadOf(await mcp.callTool(SERVERS.dropbox, "fetch", { id: e.file_id })) as { text?: string };
      let r: unknown;
      try {
        r = JSON.parse(res?.text ?? "");
      } catch {
        throw new Error("that file isn't a read-out (it isn't JSON)");
      }
      if (!isReadout(r)) throw new Error("that file isn't a Rig Studio read-out");
      const old = layers.filter((l) => l.source?.dropboxId === e.file_id);
      for (const l of old) await db.doc(`projects/${project.id}/layers/${l.id}`).delete();
      const made = readoutLayers(r, { name: e.name, dropboxId: e.file_id, modified: e.modified_time, from: "dropbox" }, now());
      for (const l of made) await db.collection(`projects/${project.id}/layers`).add(l);
      await markSeen([e]);
      flash("ok", `${readoutSummary(r)} Added as ${made.length} layer${made.length === 1 ? "" : "s"}${old.length ? ", replacing the older copy" : ""}. See Layers; ask Claude in the chat to rebuild the rig from it.`);
    } catch (er) {
      flash("warn", /fetch|tool/i.test(String((er as { code?: string }).code ?? "")) ? mcpWords(er, "Dropbox") : `Couldn't open the read-out: ${(er as Error).message ?? mcpWords(er, "Dropbox")}`);
    } finally {
      setOpening(null);
    }
  };

  const ask = async (e: Entry, what: "read" | "layer") => {
    const where = "pc";
    const req =
      what === "read"
        ? `Read "${e.path_display ?? e.name}" (Dropbox file id ${e.file_id}) out of Vectorworks on my PC: find it in the PC's Dropbox folder and call the connector's read_out tool with its full Windows path. It writes ${e.name.replace(/\.vwx$/i, "")}.rigread.json beside the file, which Dropbox syncs. Then tell me what's in it (fixtures, truss, hoists, layers). Don't change the drawing or the rig.`
        : `Add "${e.path_display ?? e.name}" from Dropbox (file id ${e.file_id}) to this project as a drawing layer, to scale if the drawing shows a scale or dimensions.`;
    setStarting(e.file_id ?? null);
    try {
      await startSession(req, where, e.file_id);
      await markSeen([e]);
      if (what === "read") flash("info", env.workers?.wake ? "Started. It checks your PC first and wakes it if it's asleep; the status shows under the file." : "Started. The status shows under the file.");
      else {
        goChat();
        flash("info", "A session on your PC is on it. Progress shows in the chat.");
      }
    } catch (er) {
      flash("warn", (er as Error).message);
    } finally {
      setStarting(null);
    }
  };
  const [starting, setStarting] = useState<string | null>(null);
  const fileJob = (id?: string) => (id ? jobs.filter((j) => j.file === id).sort((a, b) => (a.at < b.at ? 1 : -1))[0] : undefined);

  if (!env.caps.mcp) return <div className="pane muted">Dropbox needs this page open in Claude.</div>;
  if (!project.dropbox)
    return (
      <div className="pane">
        <p>Link this project to a Dropbox folder. Its files show here, and the page flags when one changes.</p>
        <label htmlFor="link-path">Folder path</label>
        <input id="link-path" value={linkPath} onChange={(e) => setLinkPath(e.target.value)} placeholder="/Rig Studio/Tennis court" />
        <button className="btn" onClick={link}>
          Link folder
        </button>
      </div>
    );

  const changed = (entries ?? []).filter((e) => e.object_type === "file" && e.file_id && project.seen?.[e.file_id] !== e.modified_time);
  const base = "https://www.dropbox.com/home";
  return (
    <div className="pane">
      <div className="row between">
        <a className="link" href={`${base}${encodeURI(project.dropbox.display)}`} target="_blank" rel="noreferrer">
          {project.dropbox.display} ↗
        </a>
        <button className="link small" onClick={() => setTick((t) => t + 1)}>
          Refresh
        </button>
      </div>
      {stamp && <p className="muted small">Checked {ago(new Date(stamp).toISOString())}; checks again every 2 minutes while open.</p>}
      {err && <Notice tone="warn">{err}</Notice>}
      {changed.length > 0 && (
        <Notice tone="info">
          {changed.length === 1 ? "1 file is new or changed" : `${changed.length} files are new or changed`} since you last looked.{" "}
          <button className="link" onClick={() => markSeen(changed)}>
            Mark as seen
          </button>
        </Notice>
      )}
      {entries === null && !err && <p className="muted">Reading the folder…</p>}
      {entries?.length === 0 && <p className="muted">The folder is empty. Drop the venue drawings, lighting plot and Vectorworks files in it.</p>}
      <ul className="files">
        {(entries ?? []).map((e) => {
          const ext = e.name.split(".").pop()?.toLowerCase() ?? "";
          const isNew = e.object_type === "file" && !!e.file_id && project.seen?.[e.file_id] !== e.modified_time;
          const used = layers.find((l) => l.source?.dropboxId === e.file_id);
          const stale = used && used.source?.modified && e.modified_time && used.source.modified < e.modified_time;
          return (
            <li key={e.path} className="file">
              <div className="file-head">
                <span className="ficon" aria-hidden="true">
                  {e.object_type !== "file" ? "▤" : ext === "vwx" ? "◇" : ext === "pdf" ? "▭" : "▫"}
                </span>
                <a href={`${base}${encodeURI(e.path_display ?? "")}`} target="_blank" rel="noreferrer" className="fname">
                  {e.name}
                </a>
                {isNew && <span className="chip draft small">● {project.seen?.[e.file_id!] ? "Changed" : "New"}</span>}
              </div>
              <div className="muted small">
                {e.modified_time ? `Changed ${ago(e.modified_time)}` : ""}
                {e.file?.size ? ` · ${(e.file.size / 1048576).toFixed(1)} MB` : ""}
                {used ? ` · used as “${used.name}”${stale ? " (Dropbox has a newer copy)" : ""}` : ""}
              </div>
              {e.object_type === "file" && (
                <div className="row">
                  {e.name.toLowerCase().endsWith(".rigread.json") && (
                    <button className="link small" onClick={() => openReadout(e)} disabled={opening === e.file_id} id={`open-readout-${e.file_id}`}>
                      {opening === e.file_id ? "Opening…" : used ? "Open again (replace the layers)" : "Open read-out as layers"}
                    </button>
                  )}
                  {["vwx", "dwg", "dxf"].includes(ext) &&
                    (entries ?? []).some((x) => x.name.toLowerCase() === e.name.replace(/\.vwx$/i, "").toLowerCase() + ".rigread.json" && (x.modified_time ?? "") >= (e.modified_time ?? "")) ? (
                    <span className="muted small">✓ Read out (open the .rigread.json below)</span>
                  ) : ["vwx"].includes(ext) ? (
                    (() => {
                      const j = fileJob(e.file_id);
                      const busy = starting === e.file_id || (j && jobActive(j));
                      return (
                        <>
                          <button className="link small" onClick={() => ask(e, "read")} disabled={!!busy} id={`read-${e.file_id}`}>
                            {starting === e.file_id ? "Starting…" : busy ? "Reading it out…" : j?.status === "failed" ? "Try again" : env.workers?.wake ? "Read it out on my PC" : "Read it out on my PC (needs the PC on)"}
                          </button>
                          {!env.workers?.wake && <WakeLink />}
                        </>
                      );
                    })()
                  ) : null}
                  {["pdf", "png", "jpg", "jpeg"].includes(ext) && (
                    <button className="link small" onClick={() => ask(e, "layer")}>
                      Add as a layer (session)
                    </button>
                  )}
                </div>
              )}
              {e.object_type === "file" && fileJob(e.file_id) && (
                <p className={`job-line small${fileJob(e.file_id)!.status === "failed" ? " bad" : ""}`} role="status" aria-live="polite" id={`job-${e.file_id}`}>
                  {jobWords(fileJob(e.file_id)!)}
                  {jobActive(fileJob(e.file_id)!) && <span className="muted"> · started {ago(fileJob(e.file_id)!.at)}; a big drawing takes 5–10 minutes in all.</span>}
                  {fileJob(e.file_id)!.session && (
                    <>
                      {" "}
                      <a className="link" href={fileJob(e.file_id)!.session} target="_blank" rel="noreferrer">
                        Open the session ↗
                      </a>
                    </>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted small">A Vectorworks file is read once on your PC (it writes a .rigread.json beside it); after that it opens here with the PC off. PDFs and pictures: download them and use “Add a drawing or plot” under Layers.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ boot */

const root = document.getElementById("app")!;
createRoot(root).render(<App />);
