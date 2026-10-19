import { money } from "@/tools/money/summary";

/**
 * Money charts, drawn on the server as SVG/HTML (no chart library, no JavaScript).
 * Encoding (owner is red-green colour-blind; never colour alone):
 *   money in  = solid ice (series 1)
 *   money out = series-2 with diagonal hatching ("series 2 is always drawn dashed")
 * Every chart has a legend in words, a native hover tooltip per mark (<title>), and a table
 * of the same numbers next to it or behind "Show as a table".
 */

const HATCH = "repeating-linear-gradient(135deg, var(--fw-series-2) 0 3px, transparent 3px 6px)";

export function Legend({ items }: { items: Array<{ label: string; kind: "in" | "out" | "out-solid" }> }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-small text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <Swatch kind={i.kind} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function Swatch({ kind }: { kind: "in" | "out" | "out-solid" }) {
  if (kind === "in") return <span aria-hidden="true" className="inline-block size-3 rounded-[3px] bg-ice" />;
  if (kind === "out-solid") return <span aria-hidden="true" className="inline-block size-3 rounded-[3px] bg-series-2" />;
  return <span aria-hidden="true" className="inline-block size-3 rounded-[3px] border border-series-2" style={{ backgroundImage: HATCH }} />;
}

export type MonthPoint = { month: string; label: string; moneyIn: number; moneyOut: number; current?: boolean; empty?: boolean };

/** Money in vs money out by month: paired columns on one axis. */
export function InOutChart({ points, title, labels = { in: "Money in", out: "Money out" } }: { points: MonthPoint[]; title: string; labels?: { in: string; out: string } }) {
  const W = 640;
  const H = 220;
  const left = 44;
  const bottom = 24;
  const top = 8;
  const plotH = H - bottom - top;
  const max = Math.max(1, ...points.map((p) => Math.max(p.moneyIn, p.moneyOut)));
  const step = niceStep(max / 4);
  const ceil = Math.ceil(max / step) * step;
  const y = (v: number) => top + plotH - (v / ceil) * plotH;
  const slot = (W - left) / Math.max(1, points.length);
  const bar = Math.min(18, Math.max(5, slot * 0.3));
  const ticks = Array.from({ length: Math.round(ceil / step) + 1 }, (_, i) => i * step);
  return (
    <figure className="grid gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-h3 font-medium">{title}</span>
        <Legend items={[{ label: labels.in, kind: "in" }, { label: labels.out, kind: "out" }]} />
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${title}: ${labels.in.toLowerCase()} and ${labels.out.toLowerCase()} by month. The same numbers are in the table below.`}>
        <defs>
          <pattern id="hatch-out" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="fill-surface" />
            <rect width="3" height="6" className="fill-series-2" />
          </pattern>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
            <text x={left - 6} y={y(t) + 4} textAnchor="end" className="fill-muted text-[11px] tabular-nums">{short(t)}</text>
          </g>
        ))}
        {points.map((p, i) => {
          const cx = left + slot * i + slot / 2;
          return (
            <g key={p.month}>
              {!p.empty && (
                <>
                  <rect x={cx - bar - 1} y={y(p.moneyIn)} width={bar} height={Math.max(0, top + plotH - y(p.moneyIn))} rx={3} className="fill-ice">
                    <title>{`${p.label}: ${labels.in.toLowerCase()} ${money(p.moneyIn)}`}</title>
                  </rect>
                  <rect x={cx + 1} y={y(p.moneyOut)} width={bar} height={Math.max(0, top + plotH - y(p.moneyOut))} rx={3} fill="url(#hatch-out)" className="stroke-series-2" strokeWidth={1}>
                    <title>{`${p.label}: ${labels.out.toLowerCase()} ${money(p.moneyOut)}`}</title>
                  </rect>
                </>
              )}
              <text x={cx} y={H - 6} textAnchor="middle" className={p.current ? "fill-ink text-[11px] font-semibold" : "fill-muted text-[11px]"}>
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Two horizontal bars on one scale: what comes in vs what a month needs (bills + everyday). */
export function NeedBar({ income, bills, everyday }: { income: number; bills: number; everyday: number }) {
  const max = Math.max(1, income, bills + everyday);
  const pct = (v: number) => `${Math.max(0, (v / max) * 100)}%`;
  return (
    <figure className="grid gap-4">
      <Legend items={[{ label: "Money in", kind: "in" }, { label: "Bills", kind: "out-solid" }, { label: "Everyday spending", kind: "out" }]} />
      <div className="grid gap-3">
        <Row label="Comes in" value={money(income)}>
          <span className="block h-full rounded-[4px] bg-ice" style={{ width: pct(income) }} title={`Money in: ${money(income)} a month`} />
        </Row>
        <Row label="Needed" value={money(bills + everyday)}>
          <span className="flex h-full" style={{ width: pct(bills + everyday) }}>
            <span className="block h-full rounded-l-[4px] bg-series-2" style={{ width: `${(bills / Math.max(1, bills + everyday)) * 100}%` }} title={`Bills: ${money(bills)} a month`} />
            <span className="ml-0.5 block h-full rounded-r-[4px] border border-series-2" style={{ width: `${(everyday / Math.max(1, bills + everyday)) * 100}%`, backgroundImage: HATCH }} title={`Everyday spending: ${money(everyday)} a month`} />
          </span>
        </Row>
      </div>
    </figure>
  );
}

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-3 sm:grid-cols-[7rem_1fr_10rem]">
      <span className="text-small text-ink-2">{label}</span>
      <span className="block h-5 overflow-hidden rounded-[4px] bg-surface-2">{children}</span>
      <span className="col-start-2 text-small tabular-nums whitespace-nowrap text-ink sm:col-start-3 sm:text-right">{value} a month</span>
    </div>
  );
}

function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(1, raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const short = (v: number) => (v >= 1000 ? `$${Math.round(v / 100) / 10}k` : `$${Math.round(v)}`);
