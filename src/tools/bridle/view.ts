/**
 * What the bridle calculator shows, as pure functions: the share URL and the status line.
 * Kept out of the component so the rules (round the URL, never show stale tensions) are tested.
 */
import type { BridleInput, BridleResult, Units } from "./math";

export const KEYS = ["span", "load", "x", "drop", "rise"] as const;
export type Key = (typeof KEYS)[number];

/** Decimals each input shows. The share URL uses the same precision, so it never fills with noise. */
export const DECIMALS: Record<Key, number> = { span: 1, load: 0, x: 1, drop: 1, rise: 1 };

export function fromQuery(q: URLSearchParams): { input: BridleInput; units: Units } | null {
  const vals = KEYS.map((k) => Number(q.get(k)));
  if (!KEYS.every((k) => q.has(k)) || vals.some((v) => !Number.isFinite(v))) return null;
  const [span, load, x, drop, rise] = vals;
  return { input: { span, load, x, drop, rise }, units: q.get("u") === "metric" ? "metric" : "imperial" };
}

export function toQuery(input: BridleInput, units: Units): string {
  const q = new URLSearchParams();
  // Number() drops trailing zeros ("12.0" → 12) and String(-0) is "0", so a level rig reads rise=0.
  for (const k of KEYS) q.set(k, String(Number(input[k].toFixed(DECIMALS[k]))));
  q.set("u", units);
  return q.toString();
}

export type Status =
  | { kind: "wrong"; text: string }
  | { kind: "note"; caution: boolean; text: string }
  | { kind: "ok"; text: string };

export const FIX_FIELD = "Fix the highlighted measurement to see tensions.";

/**
 * The one status line under the results. `blocked` is true while any measurement can't be read:
 * then the result belongs to an older value, so nothing about it is shown.
 * Texts carry no live numbers, so a polite live region only speaks when the state changes.
 */
export function statusFor(r: BridleResult, load: number, blocked: boolean): Status {
  if (blocked) return { kind: "wrong", text: FIX_FIELD };
  if (!r.valid) return { kind: "wrong", text: r.problem };
  if (Math.max(r.left.tension, r.right.tension) > load) {
    const side = r.left.tension > r.right.tension ? "left" : "right";
    return { kind: "note", caution: true, text: `The ${side} leg carries more than the load itself. Lower the bridle point or move it toward the middle.` };
  }
  if (r.includedAngle > 90) return { kind: "note", caution: false, text: "Legs are more than 90° apart. Past 120° on level beams, each leg carries more than the load." };
  return { kind: "ok", text: "Both legs carry less than the load." };
}

/**
 * Notes about the measurements themselves, shown beside the inputs. Soft: they never block a
 * result. Only two, both about the load, and neither is an engineering limit:
 * - a load of 0 makes every tension 0, which reads like an answer but isn't one;
 * - a load past 10 tons is far beyond the examples and common chain hoists (1/4 to 2 tons), so
 *   it's most often a typo or the wrong units. The note asks you to check, nothing more.
 */
export const LARGE_LOAD: Record<Units, number> = { imperial: 20000, metric: 10000 };

export function loadNotes(load: number, units: Units): string[] {
  if (load === 0) return ["The load is 0, so both legs read 0. Enter the weight you’re hanging."];
  if (load > LARGE_LOAD[units]) {
    return [units === "metric"
      ? "That’s over 10,000 kg (10 tonnes). Check the number and that you meant kilograms."
      : "That’s over 20,000 lb (10 tons). Check the number and that you meant pounds."];
  }
  return [];
}

/**
 * The share URL follows the inputs, but at most once per URL_WRITE_GAP_MS: dragging fires a change
 * on every frame (242 in a 4 s drag), and Safari throws once replaceState runs over 100 times in
 * a short window. The first change after a pause writes at once (a unit switch shows in the URL
 * straight away); changes inside the gap wait, and the last one always lands.
 */
export const URL_WRITE_GAP_MS = 300;

/** How long to wait before the next URL write: 0 means write now. */
export function urlWriteWait(now: number, lastWrite: number): number {
  return Math.max(0, URL_WRITE_GAP_MS - (now - lastWrite));
}
