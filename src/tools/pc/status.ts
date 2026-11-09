// Words for the main PC's state on /private/pc. Never colour alone: every state is a word too.
export type PcView =
  | { kind: "on"; text: string }
  | { kind: "waking"; text: string }
  | { kind: "asleep"; text: string }
  | { kind: "gave-up"; text: string };

export const WAKE_PATIENCE_MS = 180_000; // how long to wait for an answer after a wake

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** What to say, from whether the PC answers and when (if ever) we sent the wake. */
export function pcView(awake: boolean, wokeAt: number | null, now: number): PcView {
  if (awake) return { kind: "on", text: "On. Vectorworks jobs can run." };
  if (wokeAt === null) return { kind: "asleep", text: "Asleep or off." };
  const waited = now - wokeAt;
  if (waited < WAKE_PATIENCE_MS) return { kind: "waking", text: `Waking… ${mmss(waited)}` };
  return { kind: "gave-up", text: "It didn’t answer after 3 minutes. It may be shut down with Wake-on-LAN off, or unplugged from the network." };
}
