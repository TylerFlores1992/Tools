import type { HTMLAttributes } from "react";
import { cx } from "@/components/cx";

// Ported from campsite-finder src/components/ui/Card.tsx (2026-10-06).
//   default resting
//   hit     a site is open right now: green border, the loudest state in the UI
//   warn    the user must act: red DASHED border (the dash is the non-colour channel, so a
//           deuteranope can tell it from `hit`)
//   paused  not running: content muted, surface off-white; never the controls
// Emphasis states use a 1.5px border and shave 0.5px of padding so the box never jitters.
// Lab change: paused mutes `[data-card-dim]` with a text token instead of opacity (this repo's
// opacity guard bans partial opacity, which breaks token contrast).
export type CardState = "default" | "hit" | "warn" | "paused";

const STATE: Record<CardState, string> = {
  default: "border-ch-line p-[15px]",
  hit: "border-ch-green border-[1.5px] p-[14.5px]",
  warn: "border-ch-alert border-[1.5px] border-dashed p-[14.5px]",
  paused: "border-ch-line p-[15px] bg-ch-paper [&_[data-card-dim]]:text-ch-muted",
};

export function Card({ state = "default", className, ...rest }: HTMLAttributes<HTMLDivElement> & { state?: CardState }) {
  return <div data-state={state} className={cx("rounded-ch-card border bg-ch-card shadow-ch-card", STATE[state], className)} {...rest} />;
}
