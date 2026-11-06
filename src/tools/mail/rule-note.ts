/**
 * The sentence a sender button ("Always trash", "Not junk", "File in Misc", …) answers with: what
 * the new rule does, and what it did to the last week's mail. Shown in a toast where you pressed,
 * not at the top of the page, so the page stays where you were.
 */

/** What a sender button reports back: shown in the page's toast, where the button was pressed. */
export type SenderResult = { ok: boolean; message: string; at: number };

export type RuleOutcome = {
  addr: string;
  action: string;
  /** Emails from the last week the rule was applied to. */
  touched: number;
  /** The rule already existed, so nothing new was done. */
  dup: boolean;
  /** Moves that Gmail's script makes at its next run. */
  gmail: boolean;
  /** Moves that Yahoo makes right after the page answers. */
  yahoo: boolean;
};

const RULE_WORD: Record<string, string> = {
  trash: "goes to Trash",
  file: "is filed in Misc",
  unsubscribe: "is unsubscribed from and trashed",
  hide: "is left out of this page",
  important: "always shows under Needs you",
};

export function ruleNote(o: RuleOutcome): string | null {
  const word = RULE_WORD[o.action];
  if (!word || !o.addr) return null;
  const addr = o.addr.slice(0, 120);
  if (o.dup) return `That rule was already there: mail from ${addr} ${word}. Nothing new was done.`;
  let text = `Mail from ${addr} ${word} from now on.`;
  const moves = o.action !== "hide" && o.action !== "important";
  const n = o.touched;
  if (moves && n > 0) {
    text += ` ${n} ${n === 1 ? "email" : "emails"} from the last week ${n === 1 ? "was" : "were"} handled the same way`;
    const later = [o.yahoo && "Yahoo moves them in the next minute", o.gmail && "Gmail moves them at its next run"].filter(Boolean).join("; ");
    text += later ? `; ${later}.` : ".";
  }
  return text;
}
