// Our own formula reference, in the same notation the practice tests' explanations use. The
// official ETCP sheet (linked from the page) is what candidates get in the exam; this is a study
// companion, not a copy of it. Expressions use the cards' marks: ~sub~ and **bold**.

export const OFFICIAL_SHEET = {
  title: "ETCP Rigging Formula Sheet",
  publisher: "ESTA / ETCP",
  url: "https://etcp.esta.org/certify/documents/rigging/Rigging_Formula_Sheet.pdf",
} as const;

export type Formula = {
  id: string;
  name: string;
  expr: string;
  where?: string;
  note?: string;
  /** Practice questions that use it, by id. */
  questions?: readonly string[];
};

export type FormulaGroup = { id: string; title: string; formulas: readonly Formula[] };

const DEN = "V~1~·H~2~ + V~2~·H~1~";

export const FORMULA_GROUPS: readonly FormulaGroup[] = [
  {
    id: "bridles",
    title: "Two-leg bridles",
    formulas: [
      { id: "leg", name: "Leg length", expr: "L = √(H² + V²)", where: "H = horizontal distance, V = vertical distance from beam point to apex.", note: "Subtract hardware (shackles, hook) to get the steel length.", questions: ["a05", "b04"] },
      { id: "sym-t", name: "Symmetric bridle: tension per leg", expr: "T = (W ÷ 2) × L ÷ V", where: "W = load.", note: "At a 120° included angle each leg carries the full load.", questions: ["a01", "a02", "b01"] },
      { id: "sym-h", name: "Symmetric bridle: horizontal force on each beam", expr: "F~H~ = (W ÷ 2) × H ÷ V", note: "Flat bridles pull the beams hard toward each other.", questions: ["b02"] },
      { id: "asym-t", name: "Any two-leg bridle: leg tension", expr: `T~1~ = W·L~1~·H~2~ ÷ (${DEN})\nT~2~ = W·L~2~·H~1~ ÷ (${DEN})`, where: "1 and 2 are the two beam points; H and V are each leg's horizontal and vertical distances to the apex.", note: "Works for beams at different heights (high/low bridles).", questions: ["a03", "b03"] },
      { id: "asym-v", name: "Any two-leg bridle: vertical force on each beam", expr: `F~V1~ = W·V~1~·H~2~ ÷ (${DEN})\nF~V2~ = W·V~2~·H~1~ ÷ (${DEN})`, note: "The two always add up to W.", questions: ["a04"] },
      { id: "asym-h", name: "Any two-leg bridle: horizontal force", expr: `F~H~ = W·H~1~·H~2~ ÷ (${DEN})`, note: "Equal and opposite on the two beams." },
      { id: "incl", name: "Included angle", expr: "Included angle = 2 × arctan(H ÷ V)", where: "For a symmetric bridle.", note: "Keep it at or under 120°.", questions: ["b14"] },
    ],
  },
  {
    id: "beams",
    title: "Beams, trusses and points",
    formulas: [
      { id: "simple", name: "Simple span, point load: reactions", expr: "R~A~ = W × b ÷ S\nR~B~ = W × a ÷ S", where: "a = distance from A to the load, b = from the load to B, S = span.", note: "With several loads, add each load's share. The closer support carries more.", questions: ["a12", "a13", "b10"] },
      { id: "moments", name: "Overhangs and cantilevers: take moments", expr: "R~2~ = Σ(W × d) ÷ S", where: "d = each load's distance from support 1, S = distance between the supports.", note: "Then R~1~ = total load − R~2~. A cantilever can unload the back point.", questions: ["b11"] },
      { id: "udl", name: "Uniform load on a simple span", expr: "R~A~ = R~B~ = total ÷ 2" , questions: ["a13"] },
      { id: "cont3", name: "Continuous truss on 3 equal points, uniform load", expr: "Ends = 3/16 of total each\nCenter = 10/16 of total", note: "Treating it as two simple spans underestimates the center.", questions: ["a14"] },
      { id: "cont4", name: "Continuous truss on 4 equal points, uniform load", expr: "Ends = 0.4·w·S each\nInner = 1.1·w·S each", where: "w = load per foot, S = one span (total = 3·w·S).", questions: ["b12"] },
      { id: "cg", name: "Center of gravity", expr: "CG = Σ(W × x) ÷ ΣW", where: "x = each weight's distance from the same reference point.", questions: ["a15"] },
    ],
  },
  {
    id: "rope",
    title: "Rope, slings and hardware",
    formulas: [
      { id: "wll", name: "Working load limit", expr: "WLL = Breaking strength ÷ DF", where: "DF = design factor (8:1 is common for wire rope).", questions: ["a08", "b07"] },
      { id: "eff", name: "With a termination", expr: "WLL = Breaking strength × E ÷ DF", where: "E = termination efficiency (for example 0.80 for clips or a wedge socket).", note: "Apply the efficiency before the design factor.", questions: ["a09"] },
      { id: "req", name: "Breaking strength you need", expr: "BS = WLL × DF ÷ E", questions: ["b08"] },
      { id: "dd", name: "D/d ratio", expr: "D/d = D ÷ d", where: "D = diameter of what the rope bends around, d = rope diameter.", note: "Lower ratios lose more strength at the bend.", questions: ["a10"] },
      { id: "sling", name: "Two-leg sling, legs measured from horizontal", expr: "T = (W ÷ 2) ÷ sin(angle)", note: "At 30° from horizontal each leg carries the full load.", questions: ["b15"] },
    ],
  },
  {
    id: "forces",
    title: "Forces and angles",
    formulas: [
      { id: "shock", name: "Shock load", expr: "F = W × (1 + D~F~ ÷ D~S~)", where: "D~F~ = free-fall distance, D~S~ = stopping distance, in the same units.", questions: ["a11", "b09"] },
      { id: "breast", name: "Breast line", expr: "F~breast~ = W × H ÷ V\nT~line~ = W × L ÷ V", where: "H, V = how far the load is pulled sideways and how far it hangs below its suspension point; L = √(H² + V²).", questions: ["a16"] },
      { id: "fleet", name: "Fleet angle", expr: "Fleet angle = arctan(offset ÷ distance)", note: "About 1.5° max for a smooth drum, 2° for grooved.", questions: ["a17", "b16"] },
      { id: "tilt", name: "Tilting a two-point object", expr: "Height difference = d × sin(tilt)", where: "d = distance between the picks, measured along the object.", note: "With the CG below the picks, the higher pick takes more load.", questions: ["b13"] },
    ],
  },
];

/** Not on the official sheet; you need these from memory. */
export const CONVERSIONS: readonly [string, string][] = [
  ["1 in", "25.4 mm"],
  ["1 ft", "0.3048 m"],
  ["1 m", "3.2808 ft"],
  ["1 kg", "2.2046 lb"],
  ["1 lb", "0.4536 kg"],
  ["1 kN", "224.8 lbf"],
  ["1 US ton", "2,000 lb"],
  ["1 metric tonne", "1,000 kg (2,204.6 lb)"],
];

export const FORMULA_COUNT = FORMULA_GROUPS.reduce((n, g) => n + g.formulas.length, 0);
