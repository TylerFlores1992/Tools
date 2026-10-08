import type { Thumb } from "../maps/sample";

// A sample map's thumbnail: the same drawing the camper's map uses (water, roads as white strokes
// on a muted casing, sites as ink dots), at card size. Roads were simplified to 2 m at build time.
// Strokes and dots keep a fixed screen size at any frame width (non-scaling strokes).
export function MapThumb({ thumb, label, id }: { thumb: Thumb; label: string; id: string }) {
  const f = thumb.frame;
  // Layers run a little past the frame (the build clips with a margin, so strokes reach the edge).
  // Letterboxed into a card's box, that margin would show as a hard-edged lake: clip to the frame.
  const clip = `thumb-${id}`;
  return (
    <svg role="img" aria-label={label} viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`} preserveAspectRatio="xMidYMid meet" className="block size-full">
      <defs><clipPath id={clip}><rect x={f.x} y={f.y} width={f.w} height={f.h} /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
      {thumb.water.map((d, i) => <path key={`w${i}`} d={d} fillRule="evenodd" className="fill-ch-map-water" />)}
      {thumb.roads.map((r, i) => <path key={`c${i}`} d={r.d} fill="none" className="stroke-ch-faint" strokeWidth={r.service ? 4 : 5.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
      {thumb.roads.map((r, i) => <path key={`r${i}`} d={r.d} fill="none" className="stroke-ch-card" strokeWidth={r.service ? 2 : 3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
      </g>
      <path d={thumb.dots.map(([x, y]) => `M${x} ${y}h0`).join("")} className="stroke-ch-ink-2" strokeWidth={3.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
