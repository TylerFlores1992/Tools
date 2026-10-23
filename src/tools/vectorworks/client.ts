// Talks to the Vectorworks connector's panel API running on the owner's own computer
// (`vwmcp-panel`, http://127.0.0.1:7377). The site never sees the drawing: the browser calls the
// computer directly. Pairing: the connector prints a link to /private/vectorworks#port=…&token=…;
// the page keeps that token in this browser only (localStorage) and drops it from the URL.

import type { Units } from "./units";
import type { VwObject } from "./geometry";

export type Pairing = { port: number; token: string };

const KEY = "vwmcp-pairing";

/** Reads a pairing from a URL hash like #port=7377&token=abc… (null if it isn't one). */
export function pairingFromHash(hash: string): Pairing | null {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const port = Number(q.get("port"));
  const token = q.get("token") ?? "";
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || !/^[\w-]{20,}$/.test(token)) return null;
  return { port, token };
}

export function loadPairing(): Pairing | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pairing;
    return pairingFromHash(`port=${p.port}&token=${p.token}`);
  } catch {
    return null;
  }
}

export function savePairing(p: Pairing | null): void {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    // Private windows can refuse storage; the pairing then lasts for this visit only.
  }
}

export type DocInfo = {
  document: string;
  version?: string | null;
  units: Units & { square_unit_name?: string };
  layers: { name: string; type: string }[];
  classes: string[];
  active_layer: string;
  active_class: string;
};

export type Drawing = { count: number; truncated: boolean; units: Units; objects: VwObject[] };

/** Why a call failed, in words a person can act on. */
export class PanelError extends Error {
  constructor(
    message: string,
    readonly kind: "offline" | "unpaired" | "vectorworks" | "refused",
  ) {
    super(message);
  }
}

export class PanelClient {
  constructor(
    readonly pairing: Pairing,
    private readonly fetcher: typeof fetch = (...a) => fetch(...a),
  ) {}

  private get base() {
    return `http://127.0.0.1:${this.pairing.port}`;
  }

  private async request<T>(path: string, init: RequestInit = {}, timeoutMs = 45_000): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await this.fetcher(`${this.base}${path}`, {
        ...init,
        signal: ctrl.signal,
        headers: { authorization: `Bearer ${this.pairing.token}`, "content-type": "application/json", ...init.headers },
      });
    } catch {
      throw new PanelError("Can't reach the connector on this computer. Is vwmcp-panel running?", "offline");
    } finally {
      clearTimeout(timer);
    }
    let body: { ok?: boolean; result?: T; error?: string };
    try {
      body = await res.json();
    } catch {
      throw new PanelError("The connector sent something unexpected.", "vectorworks");
    }
    if (res.status === 401) throw new PanelError("The pairing doesn't match. Open the link vwmcp-panel printed again.", "unpaired");
    if (res.status === 403) throw new PanelError(body.error ?? "The connector refused that.", "refused");
    if (!res.ok || body.ok === false) throw new PanelError(body.error ?? "Vectorworks didn't answer.", "vectorworks");
    return (body.result ?? (body as T)) as T;
  }

  /** True when the connector answers at all (no Vectorworks round trip, no token needed). */
  async alive(): Promise<boolean> {
    try {
      const res = await this.fetcher(`${this.base}/api/health`, { signal: AbortSignal.timeout(4000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  document() {
    return this.request<DocInfo>("/api/document");
  }

  drawing(layer?: string) {
    return this.request<Drawing>(`/api/drawing${layer ? `?layer=${encodeURIComponent(layer)}` : ""}`);
  }

  op<T = unknown>(op: string, args: Record<string, unknown> = {}) {
    return this.request<T>("/api/op", { method: "POST", body: JSON.stringify({ op, args }) });
  }
}
