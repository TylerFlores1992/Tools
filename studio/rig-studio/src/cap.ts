// The page's runtime capabilities (claude.ai artifact contract 0.2.96), loosely typed: the page
// designs for each one being absent and lights features up as they arrive.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Snap = { id: string; exists: boolean; data(): any };
export type QSnap = { docs: Snap[] };
export type DocRef = {
  id: string;
  get(): Promise<Snap>;
  set(d: object): Promise<void>;
  update(d: object): Promise<void>;
  delete(): Promise<void>;
  onSnapshot(next: (s: Snap) => void, err?: (e: { code: string; message: string }) => void): () => void;
  collection(p: string): ColRef;
};
export type Query = {
  where(f: string, op: string, v: unknown): Query;
  orderBy(f: string, d?: "asc" | "desc"): Query;
  limit(n: number): Query;
  get(): Promise<QSnap>;
  onSnapshot(next: (s: QSnap) => void, err?: (e: { code: string; message: string }) => void): () => void;
};
export type ColRef = Query & { doc(id?: string): DocRef; add(d: object): Promise<DocRef> };
export type DB = { doc(p: string): DocRef; collection(p: string): ColRef };

export type McpError = { code: string; message: string; server?: string; retryable?: boolean; result?: unknown };
export type Mcp = {
  callTool(server: string, tool: string, input?: unknown, opts?: object): Promise<{ payload?: unknown; content: { type: string; text?: string }[] }>;
  watchTool(server: string, tool: string, input: unknown, handler: (ev: { type: "data"; result: { payload?: unknown; cache?: { storedAt: number } } } | { type: "error"; error: McpError }) => void, opts?: object): () => void;
  listTools(server?: string): Promise<{ servers: { server: string; authStatus: string; tools: { name: string }[] }[] }>;
};
export type SampleTool = { name: string; description: string; inputSchema?: object; execute(input: Record<string, unknown>, ctx: { signal: AbortSignal }): unknown };
export type Sample = ((input: string | { role: "user" | "assistant"; content: string }[], opts?: object) => Promise<{ text: string; truncated: boolean }>) & {
  limits(): Promise<{ tools?: { maxCount: number }; maxPromptBytes: number }>;
};
export type Assets = { upload(b: Blob, o?: { type?: string }): Promise<{ id: string; url: string }>; delete(id: string): Promise<{ deleted: boolean }> };
export type Downloads = { save(r: { filename: string; data: string | Blob }): Promise<{ status: string }> };
export type User = { isOwner(): Promise<boolean>; canEdit(): Promise<boolean>; id(): Promise<string | null> };

export type Caps = { db: DB | null; mcp: Mcp | null; sample: Sample | null; assets: Assets | null; downloads: Downloads | null; user: User | null };

const use = async <T,>(name: string): Promise<T | null> => {
  try {
    const c = (window as any).claude;
    if (!c?.use) return null;
    return ((await c.use(name)) as T) ?? null;
  } catch {
    return null;
  }
};

export async function loadCaps(): Promise<Caps> {
  const [db, mcp, sample, assets, downloads, user] = await Promise.all([use<DB>("db"), use<Mcp>("mcp"), use<Sample>("sample"), use<Assets>("assets"), use<Downloads>("downloads"), use<User>("user")]);
  return { db, mcp, sample, assets, downloads, user };
}

export const SERVERS = { remote: "Claude Code Remote", dropbox: "Dropbox", vw: "host:vectorworks" } as const;

/** A connector failure in words, with the one thing that fixes it. */
export function mcpWords(e: unknown, what: string): string {
  const err = e as McpError;
  switch (err?.code) {
    case "needs_reauth":
      return `${err.server ?? what} needs signing in again: reconnect it in claude.ai Settings → Connectors.`;
    case "server_not_connected":
      return what === "Vectorworks" ? "Vectorworks only answers when this page is open in the Claude desktop app on the computer running it." : `Add ${err.server ?? what} in claude.ai Settings → Connectors.`;
    case "not_in_manifest":
    case "approval_required":
    case "consent_required":
      return `This page isn't allowed to use ${what} yet. Allow it when Claude asks, or from the page's Permissions menu.`;
    case "blocked_by_policy":
      return `Your organization blocks ${what} here.`;
    case "server_unavailable":
      return `${what} didn't answer. Try again in a moment.`;
    case "cancelled":
      return "Cancelled.";
    case "tool_error": {
      const res = err.result as { content?: { text?: string }[] } | undefined;
      const t = res?.content?.find((c) => c.text)?.text ?? err.message;
      return `${what}: ${String(t).slice(0, 400)}`;
    }
    default:
      return `${what}: ${err?.message ?? String(e)}`.slice(0, 400);
  }
}

/** The text a tool answered with, parsed when it's JSON. */
export function payloadOf(r: { payload?: unknown; content?: { type: string; text?: string }[] }): unknown {
  if (r.payload !== undefined) return r.payload;
  const t = r.content?.find((c) => c.type === "text")?.text;
  if (t === undefined) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}
