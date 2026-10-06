// Original practice tests written to the ETCP Certified Rigger – Arena content outline: two
// 25-question sets and a 50-question set (set-c.ts) weighted like the real exam. Every numeric
// answer is recomputed from first principles in questions.test.mts, so a typo in an option or a
// wrong answer key fails the build.

import { C } from "./set-c.ts";

/** The parts of ETCP's Arena content outline (Candidate Handbook, rev. 5.0, Feb 2016). */
export const AREAS = {
  "1A": "Formulas and forces",
  "1B": "General principles of rigging",
  "1C": "Drawings and schedules",
  "2A": "Layout and electrical",
  "2B": "Rigging attachments",
  "2C": "Operations",
  "3A": "Personnel access equipment",
  "3B": "Rigging materials",
} as const;
export type Area = keyof typeof AREAS;

/** Scored questions per area on the real 150-question Arena exam. */
export const ARENA_OUTLINE: Record<Area, number> = { "1A": 25, "1B": 15, "1C": 10, "2A": 10, "2B": 25, "2C": 25, "3A": 10, "3B": 30 };

export type Question = {
  id: string;
  topic: string;
  stem: string;
  options: readonly [string, string, string, string];
  /** Index into `options`. */
  answer: 0 | 1 | 2 | 3;
  explain: string;
  /** Where it sits in the Arena content outline. */
  area?: Area;
};

export type PracticeSet = { slug: string; name: string; about?: string; questions: readonly Question[] };

const A: Question[] = [
  { id: "a01", topic: "2-way bridle", stem: "A symmetric 2-leg bridle hangs from two beams 20 ft apart. The apex is centered and 10 ft below the beams. The load is 1,000 lb. What is the tension in each leg?", options: ["500 lb", "707 lb", "1,000 lb", "1,414 lb"], answer: 1,
    explain: "H = 10 ft, V = 10 ft, so L = √(10² + 10²) = 14.14 ft. For a symmetric bridle T = (W/2) × L/V = 500 × 14.14/10 = 707 lb." },
  { id: "a02", topic: "2-way bridle", stem: "At what included angle does each leg of a symmetric 2-leg bridle carry a tension equal to the full load?", options: ["60°", "90°", "120°", "150°"], answer: 2,
    explain: "At 120° each leg is 60° from vertical. T = (W/2) / cos 60° = (W/2)/0.5 = W. Beyond 120° leg tension exceeds the load, which is why 120° is the usual maximum." },
  { id: "a03", topic: "2-way bridle", stem: "Beams A and B are 12 ft apart at the same height. The apex is 4 ft horizontally from beam A and 6 ft below the beams. Load: 2,000 lb. What is the tension in the leg to beam A?", options: ["1,111 lb", "1,333 lb", "1,602 lb", "2,000 lb"], answer: 2,
    explain: "H1 = 4, H2 = 8, V1 = V2 = 6. L1 = √(4² + 6²) = 7.21 ft. Denominator = V1·H2 + V2·H1 = 48 + 24 = 72. T1 = W·L1·H2 / 72 = 2,000 × 7.21 × 8 / 72 ≈ 1,602 lb. (1,333 lb is the vertical force on beam A, not the leg tension.)" },
  { id: "a04", topic: "2-way bridle", stem: "Same bridle as the previous question. What vertical force does beam B receive?", options: ["667 lb", "1,000 lb", "1,111 lb", "1,333 lb"], answer: 0,
    explain: "F2v = W·V2·H1 / (V1·H2 + V2·H1) = 2,000 × 6 × 4 / 72 ≈ 667 lb. Check: beam A gets 2,000 × 6 × 8 / 72 = 1,333 lb, and 1,333 + 667 = 2,000." },
  { id: "a05", topic: "Sling length", stem: "A bridle leg runs 9 ft horizontally and 12 ft vertically from the beam to the apex. Ignoring hardware, what is the leg length?", options: ["13 ft", "15 ft", "17 ft", "21 ft"], answer: 1,
    explain: "L = √(9² + 12²) = √225 = 15 ft. In the field, subtract the length of shackles, the motor hook and so on to get the steel length." },
  { id: "a06", topic: "Conversions", stem: "A video wall weighs 500 kg. What is its weight in pounds?", options: ["227 lb", "1,000 lb", "1,102 lb", "1,250 lb"], answer: 2,
    explain: "1 kg = 2.2046 lb. 500 × 2.2046 ≈ 1,102 lb. (227 is what you get if you divide instead of multiply.)" },
  { id: "a07", topic: "Conversions", stem: "A trim height is specified as 12 m. What is that in feet?", options: ["36.0 ft", "39.4 ft", "40.2 ft", "43.9 ft"], answer: 1,
    explain: "1 m = 3.2808 ft. 12 × 3.2808 ≈ 39.4 ft." },
  { id: "a08", topic: "Design factor", stem: "A wire rope has a nominal breaking strength of 14,400 lb. Using a design factor of 8:1, what is its working load limit?", options: ["1,440 lb", "1,800 lb", "2,880 lb", "14,400 lb"], answer: 1,
    explain: "WLL = Breaking strength ÷ Design factor = 14,400 / 8 = 1,800 lb." },
  { id: "a09", topic: "Efficiency", stem: "A wire rope with a breaking strength of 9,800 lb is terminated with a fitting rated at 80% efficiency. With an 8:1 design factor, what is the WLL of the assembly?", options: ["980 lb", "1,225 lb", "1,960 lb", "7,840 lb"], answer: 0,
    explain: "Reduce for the termination first: 9,800 × 0.80 = 7,840 lb. Then apply the design factor: 7,840 / 8 = 980 lb." },
  { id: "a10", topic: "D/d ratio", stem: "A 1/2 in wire rope is bent around a 12 in diameter pipe. What is the D/d ratio?", options: ["6:1", "12:1", "24:1", "48:1"], answer: 2,
    explain: "D/d = diameter of the object ÷ diameter of the rope = 12 / 0.5 = 24:1. Lower ratios mean greater strength loss in the rope at the bend." },
  { id: "a11", topic: "Shock load", stem: "A 1,000 lb load free-falls 2 ft and is stopped in 2 in. Using F = W × (1 + fall distance / stopping distance), what is the peak force?", options: ["2,000 lb", "12,000 lb", "13,000 lb", "24,000 lb"], answer: 2,
    explain: "Convert to the same units: 24 in / 2 in = 12. F = 1,000 × (1 + 12) = 13,000 lb. The shorter the stopping distance, the higher the force." },
  { id: "a12", topic: "Beam loads", stem: "A 2,000 lb point load hangs 5 ft from the left end of a 20 ft simple span. What is the reaction at the left support?", options: ["500 lb", "1,000 lb", "1,500 lb", "2,000 lb"], answer: 2,
    explain: "R_left = W × (distance to the other support) / span = 2,000 × 15 / 20 = 1,500 lb. The support closer to the load carries more of it." },
  { id: "a13", topic: "Beam loads", stem: "A 40 ft truss weighing 25 lb/ft hangs from points at each end. A 300 lb fixture is hung 10 ft from the left end. What load does the left point carry?", options: ["575 lb", "650 lb", "725 lb", "800 lb"], answer: 2,
    explain: "Truss: 25 × 40 = 1,000 lb, split evenly = 500 lb each. Fixture: 300 × 30/40 = 225 lb on the left. Left = 500 + 225 = 725 lb (right = 575 lb)." },
  { id: "a14", topic: "Indeterminate loads", stem: "A continuous truss with a total uniformly distributed load of 2,400 lb hangs from three evenly spaced points. Approximately how much does the center point carry?", options: ["800 lb", "1,200 lb", "1,500 lb", "1,800 lb"], answer: 2,
    explain: "For two equal continuous spans under a UDL, the ends each carry 3/16 of the total and the center carries 10/16 (62.5%). 0.625 × 2,400 = 1,500 lb. Treating each span as simply supported (1,200 lb) underestimates the center." },
  { id: "a15", topic: "Center of gravity", stem: "A 30 ft truss (600 lb, uniform) carries 400 lb at 5 ft and 200 lb at 25 ft, both measured from the left end. Where is the combined center of gravity?", options: ["12.0 ft", "13.3 ft", "15.0 ft", "16.7 ft"], answer: 1,
    explain: "CG = Σ(W·x) / ΣW = (600×15 + 400×5 + 200×25) / 1,200 = (9,000 + 2,000 + 5,000) / 1,200 = 13.3 ft from the left." },
  { id: "a16", topic: "Breast lines", stem: "An 800 lb load is pulled offstage with a horizontal breast line so it ends up 5 ft horizontally and 15 ft vertically from its suspension point. What is the force in the breast line?", options: ["200 lb", "267 lb", "533 lb", "843 lb"], answer: 1,
    explain: "F_breast = W × H / V = 800 × 5 / 15 ≈ 267 lb. The suspension line tension is W × L / V = 800 × 15.81 / 15 ≈ 843 lb." },
  { id: "a17", topic: "Fleet angle", stem: "A rope leaves a drum 1 ft to the side of the head block's centerline, and the block is 40 ft away. What is the fleet angle?", options: ["0.72°", "1.43°", "2.00°", "2.86°"], answer: 1,
    explain: "Fleet angle = arctan(offset / distance) = arctan(1/40) ≈ 1.43°." },
  { id: "a18", topic: "Operations", stem: "What does it mean to “float” a load?", options: ["Lift it just clear of the floor and pause to check balance and connections", "Run all motors at once to trim height", "Lower it onto dunnage", "Remove the chain bags"], answer: 0,
    explain: "Floating the load (a few inches off the floor) lets you check level, point loads, hardware and balance before committing to the full lift." },
  { id: "a19", topic: "Knots", stem: "Which knot forms a fixed loop at the end of a hand line that won't slip or bind under load?", options: ["Clove hitch", "Bowline", "Sheet bend", "Half hitch"], answer: 1,
    explain: "The bowline makes a fixed loop that is easy to untie after loading, which is why it's the standard for tying off to hardware on a hand line." },
  { id: "a20", topic: "Knots", stem: "Which knot is used to join two ropes of different diameters?", options: ["Sheet bend", "Figure 8", "Clove hitch", "Bowline"], answer: 0,
    explain: "The sheet bend is designed for joining ropes of unequal size." },
  { id: "a21", topic: "Operations", stem: "What is the main purpose of a bump check before a lift?", options: ["Test the load cells", "Confirm every hoist moves in the correct direction and responds to its control", "Measure trim height", "Check for wind load"], answer: 1,
    explain: "Briefly bumping each motor confirms direction and control assignment before the load is committed." },
  { id: "a22", topic: "Electrical", stem: "A three-phase chain hoist runs in the opposite direction from the others on the same controller. What is the usual cause?", options: ["Low voltage", "Phase rotation is reversed", "The brake is worn", "The load is too light"], answer: 1,
    explain: "Reversed phase rotation makes a three-phase motor run backward. It's corrected by a qualified person swapping two phase conductors at the appropriate point, not by rewiring on the fly." },
  { id: "a23", topic: "Hardware", stem: "When two bridle legs are joined with a shackle, where should the legs go?", options: ["On the pin", "In the bow", "Either, as long as the included angle is under 120°", "Across the pin and bow"], answer: 1,
    explain: "Multiple legs go in the bow; the pin connects to a single eye such as the motor hook or apex ring. This keeps the load centered and avoids side-loading the pin." },
  { id: "a24", topic: "Fall protection", stem: "Under OSHA, a personal fall arrest anchor that is not part of an engineered system must support at least how much per attached worker?", options: ["1,800 lb", "3,600 lb", "5,000 lb", "10,000 lb"], answer: 2,
    explain: "5,000 lb per worker, or it must be designed with a safety factor of at least two under the supervision of a qualified person." },
  { id: "a25", topic: "Hardware", stem: "When installing U-bolt wire rope clips, where does the saddle go?", options: ["On the dead (short) end", "On the live (load) end", "Alternating on each clip", "It doesn't matter"], answer: 1,
    explain: "“Never saddle a dead horse.” The saddle bears on the live end, the U-bolt on the dead end. Reversed clips can cut capacity drastically." },
];

const B: Question[] = [
  { id: "b01", topic: "2-way bridle", stem: "A symmetric bridle hangs from beams 16 ft apart with the apex centered 6 ft below them. Load: 1,200 lb. What is the tension in each leg?", options: ["600 lb", "800 lb", "1,000 lb", "1,200 lb"], answer: 2,
    explain: "H = 8, V = 6, L = 10 ft. T = (W/2) × L/V = 600 × 10/6 = 1,000 lb." },
  { id: "b02", topic: "2-way bridle", stem: "For the same bridle, what horizontal force pulls each beam toward the other?", options: ["600 lb", "800 lb", "1,000 lb", "1,333 lb"], answer: 1,
    explain: "F_h = (W/2) × H/V = 600 × 8/6 = 800 lb. Flat bridles put large inward forces on the steel." },
  { id: "b03", topic: "High/low bridle", stem: "Beam A is 50 ft high and beam B is 48 ft high; they're 10 ft apart. The apex is at 40 ft, 4 ft horizontally from A. Load: 1,000 lb. What is the tension in leg A?", options: ["435 lb", "652 lb", "702 lb", "1,000 lb"], answer: 2,
    explain: "H1 = 4, V1 = 10, H2 = 6, V2 = 8. L1 = √(16 + 100) = 10.77 ft. Denominator = V1·H2 + V2·H1 = 60 + 32 = 92. T1 = W·L1·H2 / 92 = 1,000 × 10.77 × 6 / 92 ≈ 702 lb. (652 lb is the vertical force on A; leg B carries ≈ 435 lb.)" },
  { id: "b04", topic: "Sling length", stem: "In the same high/low bridle, how long is leg A (ignoring hardware)?", options: ["10.00 ft", "10.77 ft", "11.66 ft", "14.00 ft"], answer: 1,
    explain: "L1 = √(4² + 10²) = √116 ≈ 10.77 ft. Leg B = √(6² + 8²) = 10 ft." },
  { id: "b05", topic: "Conversions", stem: "A load cell reads 2 kN. What is that in pounds-force?", options: ["200 lb", "441 lb", "450 lb", "4,409 lb"], answer: 2,
    explain: "1 kN ≈ 224.8 lbf, so 2 kN ≈ 450 lb. (441 lb is 200 kg × 2.2046, a common mix-up between kN and kg.)" },
  { id: "b06", topic: "Conversions", stem: "A scenic piece weighs 3,500 lb. What is that in kilograms?", options: ["1,588 kg", "1,750 kg", "3,500 kg", "7,716 kg"], answer: 0,
    explain: "3,500 / 2.2046 ≈ 1,588 kg." },
  { id: "b07", topic: "Design factor", stem: "A wire rope has a breaking strength of 4,200 lb. With a 10:1 design factor, what is the WLL?", options: ["420 lb", "525 lb", "840 lb", "4,200 lb"], answer: 0,
    explain: "WLL = 4,200 / 10 = 420 lb." },
  { id: "b08", topic: "Design factor", stem: "You need a sling with a WLL of 1,500 lb. The termination is 90% efficient and you are using an 8:1 design factor. What minimum rope breaking strength is required?", options: ["10,800 lb", "12,000 lb", "13,333 lb", "16,667 lb"], answer: 2,
    explain: "Required BS = WLL × DF / efficiency = 1,500 × 8 / 0.90 ≈ 13,333 lb." },
  { id: "b09", topic: "Shock load", stem: "A 500 lb load drops 6 in and is stopped in 1 in. What is the peak force?", options: ["500 lb", "3,000 lb", "3,500 lb", "6,000 lb"], answer: 2,
    explain: "F = W × (1 + fall/stop) = 500 × (1 + 6) = 3,500 lb." },
  { id: "b10", topic: "Beam loads", stem: "A 30 ft simple span carries 1,000 lb at 10 ft and 600 lb at 20 ft, measured from the left. What is the left reaction?", options: ["733 lb", "800 lb", "867 lb", "1,600 lb"], answer: 2,
    explain: "R_left = 1,000 × 20/30 + 600 × 10/30 = 667 + 200 ≈ 867 lb. Right = 1,600 − 867 = 733 lb." },
  { id: "b11", topic: "Cantilever", stem: "A 30 ft truss (20 lb/ft) hangs from points at 0 ft and 24 ft. A 150 lb fixture sits at the 30 ft end. What does the point at 24 ft carry?", options: ["187.5 lb", "375 lb", "562.5 lb", "750 lb"], answer: 2,
    explain: "Moments about the 0 ft point: 600 × 15 + 150 × 30 = 13,500 lb-ft. R(24 ft) = 13,500 / 24 = 562.5 lb. The 0 ft point carries 750 − 562.5 = 187.5 lb. Cantilevers unload the back point." },
  { id: "b12", topic: "Indeterminate loads", stem: "A continuous truss with a 3,000 lb uniform load hangs from four evenly spaced points. About how much does each inner point carry?", options: ["750 lb", "1,000 lb", "1,100 lb", "1,500 lb"], answer: 2,
    explain: "For three equal continuous spans under UDL, ends carry 0.4wS and inner points 1.1wS, where total = 3wS. So inner = 1.1/3 × 3,000 = 1,100 lb; ends = 400 lb. Assuming an even 750 lb split underestimates the inner points." },
  { id: "b13", topic: "Tilting", stem: "An LED panel has pick points 4 ft apart. How much higher must the upstage pick be than the downstage pick to tilt the panel 15°?", options: ["0.26 ft", "1.04 ft", "1.07 ft", "3.86 ft"], answer: 1,
    explain: "The pick points rotate with the panel, so the height difference is 4 × sin 15° ≈ 1.04 ft (about 12.4 in). Using tan gives 1.07 ft, which is wrong here because the 4 ft is measured along the tilted object." },
  { id: "b14", topic: "Geometry", stem: "A symmetric bridle leg runs 5 ft horizontally and 12 ft vertically. What is the included angle between the two legs?", options: ["22.6°", "45.2°", "67.4°", "134.8°"], answer: 1,
    explain: "Each leg is arctan(5/12) ≈ 22.6° from vertical. Included angle = 2 × 22.6° = 45.2°." },
  { id: "b15", topic: "Sling angles", stem: "A 1,000 lb load hangs from a symmetric 2-leg sling with each leg at 30° from horizontal. What is the tension in each leg?", options: ["500 lb", "577 lb", "866 lb", "1,000 lb"], answer: 3,
    explain: "T = (W/2) / sin(angle from horizontal) = 500 / 0.5 = 1,000 lb. Low sling angles multiply tension quickly." },
  { id: "b16", topic: "Fleet angle", stem: "What is a commonly cited maximum fleet angle for a smooth (ungrooved) drum?", options: ["0.5°", "1.5°", "4°", "10°"], answer: 1,
    explain: "About 1.5° for smooth drums (around 2° for grooved). Too large and the rope piles up or scrubs; too small and it won't wind back across the drum." },
  { id: "b17", topic: "Hoists", stem: "Compared to single-reeved, a double-reeved chain hoist with the same motor has:", options: ["Twice the speed, same capacity", "Twice the capacity, half the speed", "Same capacity, half the speed", "Twice the capacity, same speed"], answer: 1,
    explain: "Doubling the chain falls doubles mechanical advantage: capacity goes up and speed goes down by roughly the same factor." },
  { id: "b18", topic: "Hardware", stem: "Why is a protective pad used when a sling is choked or basketed around a steel beam?", options: ["To add friction so the sling doesn't slide", "To protect the sling from sharp edges and improve the bend radius", "To insulate the steel electrically", "It's only required outdoors"], answer: 1,
    explain: "Beam flanges have sharp edges that cut slings and create a poor D/d. Pads (like burlap or sling savers) protect the sling." },
  { id: "b19", topic: "Inspection", stem: "Which is NOT a reason to remove wire rope from service?", options: ["Birdcaging", "Kinking", "A light film of lubricant", "Several broken wires in one lay"], answer: 2,
    explain: "Lubrication is normal and helpful. Birdcaging, kinks, crushing, heat damage, heavy corrosion and broken wires beyond limits all call for removal." },
  { id: "b20", topic: "Controls", stem: "After an emergency stop is activated on a hoist control system, what should happen?", options: ["Hoists resume when the button is released", "Motion stays stopped until the E-stop is deliberately reset and the operator restarts", "The system automatically lowers all loads", "Only the selected hoist stops"], answer: 1,
    explain: "An E-stop removes power from all motion and must be manually reset. Releasing it should never restart motion by itself." },
  { id: "b21", topic: "Communications", stem: "During a lift, who may call a stop?", options: ["Only the head rigger", "Only the motor operator", "Anyone who sees a hazard", "Only the production manager"], answer: 2,
    explain: "Anyone who sees a problem should call stop. Moving loads resume only on the designated person's command." },
  { id: "b22", topic: "Fall protection", stem: "A personal fall arrest system should typically limit free fall to no more than:", options: ["2 ft", "4 ft", "6 ft", "12 ft"], answer: 2,
    explain: "6 ft is the common limit for a PFAS with a shock-absorbing lanyard (with total arrest force limited to 1,800 lb)." },
  { id: "b23", topic: "Drawings", stem: "Which facility drawing shows beam sizes and locations for planning rigging points?", options: ["Structural steel plan", "Electrical one-line", "HVAC plan", "Seating chart"], answer: 0,
    explain: "The structural steel plan (and the building's allowable load information) is the basis for point placement." },
  { id: "b24", topic: "Indeterminate loads", stem: "Why are load cells especially valuable on a truss hung from four or more points?", options: ["They replace the need for a hanging plot", "The load distribution is indeterminate and can shift with slight trim differences", "They speed up the motors", "They're required for all 2-point loads"], answer: 1,
    explain: "With more than two points, small height differences change how load is shared. Load cells show the real distribution." },
  { id: "b25", topic: "Slings", stem: "Roughly what percentage of vertical capacity does a round sling have in a choker hitch?", options: ["50%", "80%", "100%", "200%"], answer: 1,
    explain: "About 80% of vertical rating in a choker (less if the choke angle is under 120°). A vertical basket is about 200%." },
];

export const PRACTICE_SETS: readonly PracticeSet[] = [
  { slug: "a", name: "Practice test A", questions: A },
  { slug: "b", name: "Practice test B", questions: B },
  { slug: "c", name: "Practice test C", about: "Weighted like the real exam: each part of ETCP's Arena content outline gets its share of the 50 questions.", questions: C },
];

export function practiceSet(slug: string): PracticeSet | undefined {
  return PRACTICE_SETS.find((s) => s.slug === slug);
}

export const LETTERS = ["A", "B", "C", "D"] as const;
