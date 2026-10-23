// Lengths in a Vectorworks drawing. The connector reports values in the drawing's own units,
// along with `units_per_inch` (from vs.GetUnits: 1 for inches/feet-and-inches, 25.4 for mm,
// 0.0254 for m). Everything here converts through inches so imperial and metric plots both read
// the way a rigger expects: 12'-6 1/2" or 3,810 mm. The same parser lives in the connector's
// bridge (vwmcp_bridge.py, parse_length); units.test.mts and the Python tests share the cases.

export type Units = { unit_name: string; units_per_inch: number };

export const INCHES: Units = { unit_name: '"', units_per_inch: 1 };

const MM_PER_IN = 25.4;
const SUFFIX_TO_IN: Record<string, number> = {
  '"': 1, in: 1, inch: 1, inches: 1,
  "'": 12, ft: 12, foot: 12, feet: 12,
  mm: 1 / MM_PER_IN, cm: 10 / MM_PER_IN, m: 1000 / MM_PER_IN,
};

/** True when the drawing is inch-based (inches, feet, feet-and-inches). */
export function isImperial(u: Units): boolean {
  const n = u.unit_name.trim().toLowerCase();
  if (['"', "'", "in", "ft", "inch", "feet"].includes(n)) return true;
  return Math.abs(u.units_per_inch - 1) < 1e-9 || Math.abs(u.units_per_inch - 1 / 12) < 1e-9;
}

const NUM = String.raw`\d+(?:\.\d+)?|\.\d+`;
const FRACTION = String.raw`(\d+)\s*/\s*(\d+)`;

function inchesPart(s: string): number | null {
  // 6, 6.5, 6 1/2, 1/2
  const m = s.trim().match(new RegExp(`^(?:(${NUM})(?:\\s+${FRACTION})?|${FRACTION})$`));
  if (!m) return null;
  if (m[1] !== undefined) {
    const whole = Number(m[1]);
    return m[2] !== undefined ? whole + Number(m[2]) / Number(m[3]) : whole;
  }
  const den = Number(m[5]);
  return den === 0 ? null : Number(m[4]) / den;
}

/**
 * A typed length → drawing units, or null when it can't be read (never a silent 0).
 * Accepts 12'-6", 12' 6 1/2", 6", 1/2", 3.5 ft, 450mm, 1.2 m, and a bare number (drawing units).
 */
export function parseLength(raw: string, u: Units): number | null {
  const s = raw.trim().toLowerCase().replace(/[′’]/g, "'").replace(/[″”]/g, '"');
  if (!s) return null;
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1).trim() : s;
  let inches: number | null = null;

  const feetInches = body.match(/^(\d+(?:\.\d+)?)\s*'\s*-?\s*(.*?)\s*"?$/);
  if (feetInches && body.includes("'")) {
    const rest = feetInches[2].trim();
    const ins = rest === "" ? 0 : inchesPart(rest);
    if (ins === null) return null;
    inches = Number(feetInches[1]) * 12 + ins;
  } else {
    const m = body.match(new RegExp(`^(${NUM})\\s*([a-z"']+)$`));
    const frac = body.match(/^(.*?)\s*"$/);
    if (m && SUFFIX_TO_IN[m[2]] !== undefined) {
      inches = Number(m[1]) * SUFFIX_TO_IN[m[2]];
    } else if (frac) {
      inches = inchesPart(frac[1]);
    } else if (new RegExp(`^(?:${NUM})$`).test(body)) {
      const v = Number(body);
      return neg ? -v : v; // already in drawing units
    }
  }
  if (inches === null || !Number.isFinite(inches)) return null;
  const v = inches * u.units_per_inch;
  return neg ? -v : v;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** Drawing units → how a rigger reads it. Imperial to the nearest 1/16", metric to the mm. */
export function formatLength(value: number | null | undefined, u: Units): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  const inches = value / u.units_per_inch;
  const sign = inches < 0 ? "-" : "";
  if (isImperial(u)) {
    const sixteenths = Math.round(Math.abs(inches) * 16);
    const feet = Math.floor(sixteenths / (12 * 16));
    const restSix = sixteenths - feet * 12 * 16;
    const whole = Math.floor(restSix / 16);
    const fracSix = restSix % 16;
    let frac = "";
    if (fracSix) {
      const g = gcd(fracSix, 16);
      frac = ` ${fracSix / g}/${16 / g}`;
    }
    if (feet === 0) return `${sign}${whole}${frac}"`.replace(/^(-?)0 /, "$1");
    return `${sign}${feet}'-${whole}${frac}"`;
  }
  const mm = Math.abs(inches) * MM_PER_IN;
  if (mm >= 10_000) return `${sign}${(mm / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 })} m`;
  return `${sign}${Math.round(mm).toLocaleString("en-US")} mm`;
}

/** Area in square drawing units → sq ft or m². */
export function formatArea(value: number | null | undefined, u: Units): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  const sqIn = value / (u.units_per_inch * u.units_per_inch);
  if (isImperial(u)) return `${(sqIn / 144).toLocaleString("en-US", { maximumFractionDigits: 2 })} sq ft`;
  const sqM = (sqIn * MM_PER_IN * MM_PER_IN) / 1_000_000;
  return `${sqM.toLocaleString("en-US", { maximumFractionDigits: 3 })} m²`;
}

/** Nudge steps offered in the panel, in drawing units. */
export function nudgeSteps(u: Units): { label: string; value: number }[] {
  if (isImperial(u)) {
    return [
      { label: '1"', value: 1 * u.units_per_inch },
      { label: '6"', value: 6 * u.units_per_inch },
      { label: "1'", value: 12 * u.units_per_inch },
    ];
  }
  const perMm = u.units_per_inch / MM_PER_IN;
  return [
    { label: "10 mm", value: 10 * perMm },
    { label: "100 mm", value: 100 * perMm },
    { label: "1 m", value: 1000 * perMm },
  ];
}

/** Rounds a value to the nearest multiple of step (step ≤ 0 leaves it alone). */
export function snap(value: number, step: number): number {
  if (!(step > 0)) return value;
  return Math.round(value / step) * step;
}
