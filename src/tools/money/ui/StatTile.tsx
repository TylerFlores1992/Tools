import type { ReactNode } from "react";
import { Card } from "@/components/Card";

/**
 * One headline number. The figure sizes itself to the tile (container query units), so
 * "$104,787.97" stays on one line in a quarter-width tile on a laptop and still reads large on a
 * phone, where the tile is full width. Every Money page uses this one, so they match.
 */
export function StatTile({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <Card className="@container min-w-0">
      <p className="font-mono text-label uppercase text-ink-2">{label}</p>
      <p className="mt-2 whitespace-nowrap text-[clamp(20px,13cqi,44px)] leading-[1.1] font-normal tracking-[-0.03em] tabular-nums">{value}</p>
      {note ? <p className="mt-1 text-small tabular-nums text-muted">{note}</p> : null}
    </Card>
  );
}
