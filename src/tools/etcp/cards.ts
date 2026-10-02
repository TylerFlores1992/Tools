// ETCP Certified Rigger flashcards, ported from the owner's deck. Answer text uses two marks:
// **bold** and ~sub~ (D~A~ → D with a subscript A). Lines are split on "\n".

export type Deck = "math" | "core" | "arena" | "theatre";

/** Decks are told apart by name and glyph, never by colour (the owner is red-green colour-blind). */
export const DECKS: readonly { key: Deck; label: string; glyph: string }[] = [
  { key: "math", label: "Math & forces", glyph: "◆" },
  { key: "core", label: "Both exams", glyph: "●" },
  { key: "arena", label: "Arena", glyph: "▲" },
  { key: "theatre", label: "Theatre", glyph: "■" },
];

export type Flashcard = { id: string; deck: Deck; q: string; a: string };

const RAW: [Deck, string, string][] = [
  // ---------- Math & forces ----------
  ["math", "Design factor: what is it, and how do you get the WLL?", "Design factor = minimum breaking strength ÷ working load limit.\n\n**WLL = Breaking strength ÷ DF**\n\nExample: 7,000 lb breaking strength at 8:1 → 875 lb WLL."],
  ["math", "Typical design factors you should know", "Wire rope in entertainment rigging: **8:1** is common practice.\nFiber rope: commonly **10:1**.\nAlloy chain slings: rated by the maker (typically 4:1).\nShackles, eyebolts, hoists: the manufacturer's WLL already includes their factor. Know what yours is and what your spec requires on top of it."],
  ["math", "7×19 galvanized aircraft cable: approximate breaking strengths", "1/8\" ≈ 2,000 lb\n3/16\" ≈ 4,200 lb\n1/4\" ≈ 7,000 lb\n3/8\" ≈ 14,400 lb\n\nAlways use the actual manufacturer's rating on the job."],
  ["math", "Termination efficiency: rough numbers", "Swaged or spelter socket ≈ 100%\nFlemish eye with pressed sleeve ≈ 95%\nWedge socket ≈ 80%\nWire rope clips (properly installed) ≈ 80%\nKnots in fiber rope can cost roughly a third to a half of the rope's strength.\n\nSystem strength = weakest component × its efficiency."],
  ["math", "D/d ratio: definition and effect", "D = sheave or pin tread diameter, d = rope diameter.\nThe tighter the bend, the more strength is lost.\n\n1:1 ≈ 50% efficiency\n2:1 ≈ 65%\n4:1 ≈ 75%\nLarger ratios approach 90%+.\n\nA wire rope bent around a shackle pin is a small D/d."],
  ["math", "Fleet angle: definition and limits", "The angle between the rope and a line perpendicular to the drum (or sheave) axis, at the rope's widest travel.\n\nSmooth drum: max ≈ **1.5°**\nGrooved drum: max ≈ **2°**\nToo small (under about 0.5°) and rope can pile up.\n\nFleet angle ≈ arctan(lateral offset ÷ distance to sheave)."],
  ["math", "Symmetric 2-leg bridle: leg tension formula", "**Tension per leg = (W ÷ 2) × (L ÷ V)**\nL = leg length, V = vertical height of the bridle.\n\nExample: 1,000 lb, legs 10′, vertical 8′ → 500 × 10/8 = **625 lb** per leg."],
  ["math", "Bridle included angle: rules of thumb", "60° included → each leg ≈ 0.58 × W\n90° included → each leg ≈ 0.71 × W\n120° included → each leg = **the full load**\n\nKeep included angles at or under 120°. Tension climbs fast past that."],
  ["math", "Asymmetric 2-leg bridle: vertical share on each leg", "D~A~, D~B~ = horizontal distances from apex to each beam point.\n\nV~A~ = W × D~B~ ÷ (D~A~ + D~B~)\nV~B~ = W × D~A~ ÷ (D~A~ + D~B~)\n\nThe **shorter horizontal leg carries more** of the load. (Beams at the same height.)"],
  ["math", "Asymmetric bridle: leg tension and horizontal force", "Tension~A~ = V~A~ × L~A~ ÷ H\nHorizontal~A~ = V~A~ × D~A~ ÷ H\n\nH = vertical height from apex to beam. The two horizontal forces are equal and opposite: they pull the beams toward each other."],
  ["math", "Finding a bridle leg length", "Pythagorean theorem: **L = √(H² + D²)**\n\nExample: 8′ vertical, 6′ horizontal → √(64 + 36) = **10′**.\nRemember to account for hardware length (shackles, steels) in real leg length."],
  ["math", "Simple span beam, one point load: support reactions", "R~A~ = W × b ÷ L    R~B~ = W × a ÷ L\na = distance from A to load, b = distance from load to B.\n\nExample: 1,000 lb, 4′ from A on a 10′ span → R~A~ = 600 lb, R~B~ = 400 lb.\nThe support **closer** to the load takes more."],
  ["math", "Uniformly distributed load on a simple span", "Each support carries **half** the total load.\n\nA UDL is spread evenly (for example, weight per foot of truss or pipe), unlike a point load concentrated at one spot."],
  ["math", "Breastline: what happens to the forces?", "Pulling a hanging load sideways by angle θ from vertical:\n\nVertical line tension = W ÷ cos θ\nBreastline tension = W × tan θ\n\nBoth grow quickly as the angle increases."],
  ["math", "Static vs dynamic vs shock load", "**Static**: load at rest.\n**Dynamic**: load in motion. Acceleration and deceleration add force.\n**Shock**: a sudden stop or free fall onto a line. It can multiply force many times over the static weight.\n\nDesign factors exist partly to cover dynamic effects, not to excuse shock loading."],
  ["math", "Unit conversions to know cold", "1 in = 25.4 mm\n1 m ≈ 3.281 ft\n1 kg ≈ 2.205 lb\n1 kN ≈ 224.8 lbf\n1 metric tonne = 1,000 kg ≈ 2,205 lb\n1 US ton = 2,000 lb"],
  ["math", "Trig refresher for rigging", "SOH-CAH-TOA\nsin θ = opposite ÷ hypotenuse\ncos θ = adjacent ÷ hypotenuse\ntan θ = opposite ÷ adjacent\n\nIn a bridle, the leg is the hypotenuse; vertical and horizontal distances are the other two sides."],
  ["math", "Total static load on a truss: what do you add up?", "Truss weight (lb/ft × length), every fixture and speaker, clamps and hardware, cable weight including cable running off the end and dropping to the floor, plus hoist and chain weight where it's carried by the load.\n\nMiss the cable and chain and you'll pick the wrong answer."],
  ["math", "Center of gravity and load share", "Points closer to the center of gravity carry more load. If the CG is off-center, points don't share equally even if they look symmetric.\nPick points above the CG make a load stable."],
  ["math", "Tilting a 2-point object: which point gains load?", "With the CG **below** the pick points (the stable case), tilting swings the CG horizontally toward the **higher** pick, so the higher point takes more load.\n\nIf the CG were above the picks, it would swing toward the lower end, and the load would be trying to roll over.\n\nRe-check each point whenever you tilt."],
  ["math", "Indeterminate load: what is it?", "A continuous rigid element hung from 3+ points (for example, a truss on four hoists). Load share depends on relative trim and stiffness, not just geometry, so small height differences can overload one point.\n\nLevel carefully; load cells help verify."],

  // ---------- Both exams: hardware, safety, standards ----------
  ["core", "Shackle side-loading reductions", "In-line: 100% of WLL\n45° off the bow's centerline: ≈ 70%\n90° (fully side-loaded): ≈ 50%\n\nPin fully seated and moused for installs; never swap the pin for a bolt."],
  ["core", "Wire rope clips: the saddle rule", "“Never saddle a dead horse.”\n**Saddle on the live (load) end, U-bolt on the dead (tail) end.**\nUse the maker's count and spacing (for example, 3 clips on 1/2\" rope), torque them, then re-torque after the first load.\nClips are about 80% efficient."],
  ["core", "Sling hitches: capacity vs vertical", "Vertical: 100%\nChoker: roughly 75–80% (less if the choke angle is under 120°)\nBasket: up to 2× vertical when legs are vertical; less as legs spread.\n\nAlways check the sling tag."],
  ["core", "Round sling (spanset): inspect and remove if…", "Tag missing or unreadable, cuts or snags exposing core yarns, heat, melt or chemical damage, knots, crushed or stiff areas.\nProtect from sharp steel edges with wear pads; they're not heat-proof."],
  ["core", "Wire rope: removal-from-service signs", "Kinks, birdcaging, crushing, core protrusion, heat or arc damage, heavy corrosion, broken wires beyond allowed limits, noticeable diameter reduction, or damaged terminations."],
  ["core", "Wire rope designation “7×19”", "7 strands, 19 wires per strand. More wires = more flexible and tolerates smaller sheaves, but less abrasion-resistant.\nIWRC = independent wire rope core (stronger, crush-resistant) vs fiber core."],
  ["core", "Knots: what each is for", "**Bowline**: fixed loop that won't slip.\n**Clove hitch**: quick attachment to a pipe or batten.\n**Figure 8**: stopper knot.\n**Sheet bend**: joins two ropes of different sizes.\n**Round turn & two half hitches**: secures a line under load."],
  ["core", "OSHA personal fall arrest: key numbers", "Free fall: 6 ft max\nMax arrest force with a harness: 1,800 lb\nDeceleration distance: 3.5 ft max\nAnchorage: 5,000 lb per person, or engineered with a 2:1 safety factor under a qualified person\nA rescue plan is required: suspension trauma is a real risk."],
  ["core", "Fall clearance: what goes into it?", "Free-fall distance + deceleration distance (up to 3.5′) + harness stretch and D-ring shift + worker height below the D-ring + a safety margin.\nIf the clearance below isn't there, the system doesn't work."],
  ["core", "Guardrail requirements (OSHA)", "Top rail 42\" ± 3\" and able to resist 200 lb of force; midrail roughly halfway; toeboards where things can fall on people below."],
  ["core", "Hierarchy of hazard controls", "1. Elimination\n2. Substitution\n3. Engineering controls\n4. Administrative controls\n5. PPE\n\nPPE is the last line, not the first."],
  ["core", "Ladders: basics", "Set extension ladders at 4:1 (1′ out for every 4′ up), extend 3′ above the landing, keep 3 points of contact, and never stand on rungs marked as not a step."],
  ["core", "Aerial lifts: fall protection", "Boom lifts: wear a harness and lanyard tied to the basket's anchor.\nScissor lifts: the guardrail is the primary fall protection; follow the manufacturer and site rules.\nNever tie off to adjacent structure from a lift."],
  ["core", "ANSI/ESTA standards to recognize", "E1.2: aluminum trusses and towers\nE1.4-1: manual counterweight rigging\nE1.6-1: powered hoist systems\nE1.6-2: electric chain hoists (design, inspection, maintenance)\nE1.21: temporary outdoor structures\nE1.22: fire safety curtains\nE1.47: rigging system inspections\nFree to download from ESTA."],
  ["core", "Duty cycle vs service factor", "**Duty cycle**: how long a motor can run vs rest (for example, 25% is about 15 minutes per hour).\n**Motor service factor**: a multiplier for how far above rated load the motor can safely run (for example, 1.15).\nNeither is a design factor for the rigging."],
  ["core", "Pre-lift and communication essentials", "Establish the lift zone, assign spotters and operators, agree on commands, clear people from under the load, and call “Heads!” for anything falling. Inspect the whole assembly before movement and again after."],
  ["core", "Secondary safeties", "A backup support independent of the primary, so a single failure doesn't drop the load (for example, a steel safety on a hoist point, or safety cables on fixtures). It must be rated for the load and rigged with minimal slack to limit shock."],
  ["core", "Reading plans: what you're checking", "Building load limits and allowable point loads, obstructions (HVAC, sprinklers, electrical, fire systems), structural steel sizes and locations, and whether the hanging plot or line set schedule fits within them. Stamped engineering drawings and load charts rule."],

  // ---------- Arena ----------
  ["arena", "What the Arena exam covers", "Temporary rigging with chain hoists and truss hung from overhead structure: arenas, convention centers, and theatres using the same methods.\n150 questions: planning & engineering (50), installation (60), materials & equipment (40)."],
  ["arena", "Chain hoist: “body up” vs “body down” (climbing)", "**Body up**: hoist hung from the point; chain drops to the load.\n**Body down / climbing**: hook on the point, hoist travels up the chain with the load.\nIn climbing, the hoist body's weight adds to the load the point sees, and it's hanging over people."],
  ["arena", "Bump check: why and how", "A brief run of each hoist before loading to confirm every motor moves, and in the right direction.\nOn 3-phase, swapping any two phases reverses direction. Fix it at the source, not by relabeling."],
  ["arena", "Chain hoist electrical checks", "Verify voltage (208V 3-phase is common in the US), phase rotation, connectors, and that the distro has capacity for the hoists running together. Know direct control vs low-voltage remote control."],
  ["arena", "BGV D8 vs D8+ vs C1 (hoist categories)", "**D8**: suspends loads; needs a secondary safety to hang over people.\n**D8+**: higher design factor and double brakes; static loads over people without a secondary.\n**C1**: for moving loads over people, with additional safety features."],
  ["arena", "Truss load tables", "Manufacturers publish allowable loads by span for: uniformly distributed load, center point load, third points, quarter points, plus deflection. Use the case that matches your actual loading, and hang at nodes or panel points unless the maker allows otherwise."],
  ["arena", "What most affects a truss's capacity on a given span?", "Its height (depth) and material and chord size. Deeper truss with heavier chords = stiffer and stronger. A longer span reduces capacity."],
  ["arena", "Truss assembly checks", "Correct connectors (spigots, fork ends, pins with R-clips, or graded bolts), no bent chords or cracked welds, don't mix manufacturers or series, and match the stamped design if it's engineered."],
  ["arena", "Ground rigger: main responsibilities", "Assemble the points (steels, shackles, spansets), tie them to the rope for the up rigger, and manage lines and the ground crew. Coiling cable and tightening shackles on the steel are not their core job."],
  ["arena", "Up rigger: main tasks", "Work on the steel with fall protection, pull points up with a hand line or cable puller, wrap the beam (basket with wear pads), shackle off, and send the rope back down."],
  ["arena", "Float (the lift step)", "Raise the load just off the deck (inches), stop, check level, load share and hardware, then continue. It's your last cheap chance to catch a problem."],
  ["arena", "Lifting and lowering sequence", "Inspect the whole system → assign spotters and operator → establish the lift zone → bump check → float → level → raise, rechecking level → controlled stop → verify trim and load distribution."],
  ["arena", "Tail downs", "Items hung below truss (lights, speakers, cable picks), attached with rated hardware and secondaries. Count them in the total load."],
  ["arena", "Environmental loads outdoors", "Wind, rain, snow, seismic. Outdoor structures need an operations plan with wind speed limits and actions (lower, remove panels, evacuate). ANSI E1.21 applies to temporary outdoor structures."],
  ["arena", "Why use load cells?", "To measure what each point really carries on indeterminate systems (3+ hoists on one truss) and confirm nothing exceeds its capacity after trimming."],

  // ---------- Theatre ----------
  ["theatre", "What the Theatre exam covers", "Mostly permanent systems: counterweight, hemp, powered and power-assisted, curtain track, and fire curtains.\n150 questions: planning & layout (50), implementation & management (50), rigging systems (50)."],
  ["theatre", "Single-purchase counterweight system", "The arbor travels the same distance as the batten; counterweight is about 1:1 with the load.\nNeeds a tall arbor track, and the lock rail is typically on the stage floor."],
  ["theatre", "Double-purchase counterweight system", "The arbor travels half the batten's distance and needs about **twice** the weight.\nFrees up wing space; the lock rail is often on a fly gallery."],
  ["theatre", "Loading a counterweight set: sequence", "Batten at its low position:\n1. Attach the load to the batten\n2. Load the arbor (from the loading gallery)\n3. Slowly raise the batten\n4. Add or remove weight to balance\n\nUnloading is the reverse: **weight off the arbor first, then load off the batten.**"],
  ["theatre", "The rope lock is not a brake", "It holds a balanced set in place. It isn't built to hold a significantly out-of-weight set; an imbalanced set can slip and run away."],
  ["theatre", "Counterweight system components", "Head block, loft blocks, lift lines, trim chains or turnbuckles, batten, arbor with spreader plates, hand (purchase) line, tension block, lock rail with rope locks, index strip, arbor stops and crash pads."],
  ["theatre", "Spreader plates", "Placed along the arbor rods (roughly every 2 feet) to keep the rods from spreading and bricks from falling out. Distribute them through the stack."],
  ["theatre", "Runaway set: what do you do?", "Don't try to grab the hand line. Shout a warning and clear the stage and loading gallery. Prevention: always load and unload in sequence and communicate with the gallery."],
  ["theatre", "Hemp system: attaching a sandbag", "Use a **trim clamp** or a **sunday** (a sling or wrap on the lines) to attach the sandbag.\nLines are tied off (belayed) on the pin rail; a clew groups several lines."],
  ["theatre", "Hemp system: trimming and securing", "Mark trims on the lines, keep pipes level and straight by adjusting individual lines, and secure with a proper belay. Remember fiber rope stretches and changes with humidity."],
  ["theatre", "Spot line", "A single line added for a special point not on a line set: block on the grid or steel, head block, then to the pin rail or a hoist. Check the structure and clear path first."],
  ["theatre", "Lengthening a batten or marrying sets", "Extensions add weight and span beyond the lift lines, so check overhang and pipe capacity. Marrying two sets (joining battens or arbors) means balancing both and operating them as one."],
  ["theatre", "Breasting a line set", "Pulling a hanging batten up- or downstage with breasting lines. It increases tension in the lift lines and the load can swing, so check the added forces."],
  ["theatre", "Dead haul vs power assist", "**Dead haul**: the motor lifts the entire load, no counterweight.\n**Power assist**: a motor added to a counterweighted set to move the imbalance.\nOther powered types: line shaft, drum hoist, point hoist, chain hoist."],
  ["theatre", "Powered systems: what to verify", "System type and capacity, controls, power requirements, set soft and hard limits, mark trims, and confirm the emergency stop works before use."],
  ["theatre", "Curtain track: key parts", "Carriers, master carriers, track hangers and clamps, splices, live-end and dead-end pulleys, floor (tension) block, operating line."],
  ["theatre", "Curtain rigging types", "**Traveler**: draws on a track (bi-parting or one-way).\n**Tab**: pulled upstage or offstage on a track.\n**Contour / Austrian**: multiple lift lines raise it in shapes, a dynamic load on the batten."],
  ["theatre", "Fire curtain: triggers and release", "Automatic release via **fusible links** (they melt at a set temperature) or detection; manual release by cutting the release line. Descent is controlled (for example, with hydraulic checks). ANSI E1.22 covers these systems."],
  ["theatre", "Fire curtain: hazards to recognize", "Anything blocking the curtain line or smoke pocket, scenery or equipment under its path, disabled or painted-over links, and missed inspections. The curtain must always be able to close."],
];

const DECK_PREFIX: Record<Deck, string> = { math: "m", core: "c", arena: "a", theatre: "t" };
const counters: Record<Deck, number> = { math: 0, core: 0, arena: 0, theatre: 0 };

/** Ids are stable per deck position (m01, c01…) so saved progress survives edits to wording. */
export const CARDS: readonly Flashcard[] = RAW.map(([deck, q, a]) => ({
  id: `${DECK_PREFIX[deck]}${String(++counters[deck]).padStart(2, "0")}`,
  deck,
  q,
  a,
}));

export type Inline = { text: string; bold?: boolean; sub?: boolean };

/** Parses one answer line's **bold** and ~sub~ marks into runs. */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+)\*\*|~([^~]+)~/g;
  let last = 0;
  for (const m of line.matchAll(re)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index) });
    out.push(m[1] !== undefined ? { text: m[1], bold: true } : { text: m[2], sub: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}
