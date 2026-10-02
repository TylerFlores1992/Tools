// Colour maths for the design tests: WCAG 2.x contrast, alpha compositing, and colour-blind
// simulation (Machado, Oliveira & Fernandes 2009, severity 1.0, applied in linear RGB).

export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

export function parseColor(value: string): RGBA {
  const v = value.trim().toLowerCase();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const rgb = v.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/);
  if (rgb) {
    const a = rgb[4] === undefined ? 1 : rgb[4].endsWith("%") ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), a];
  }
  throw new Error(`Unsupported color value: ${value}`);
}

/** Composite a possibly translucent colour over an opaque background. */
export function over(fg: RGBA, bg: RGB): RGB {
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)) as RGB;
}

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const enc = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function luminance([r, g, b]: RGB): number {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const MACHADO = {
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
} as const;
export type Deficiency = keyof typeof MACHADO;

export function simulate(c: RGB, kind: Deficiency): RGB {
  const v = c.map(lin);
  const m = MACHADO[kind];
  return m.map((row) => enc(Math.min(1, Math.max(0, row[0] * v[0] + row[1] * v[1] + row[2] * v[2])))) as RGB;
}

/** Straight RGB distance (0–441). Crude, but stable and easy to reason about in a test. */
export function distance(a: RGB, b: RGB): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
