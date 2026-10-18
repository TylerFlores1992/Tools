// Draft prompts for the home hero, "wilderness cyber" (docs/design/hero-wilderness-cyber.md §3).
// Prompts describe the look; they never name the owner's references or their makers.
// Flux ignores "no X", so each prompt says what IS there, including the empty left side.

const LEFT = "the left half of the frame is deep, quiet, near-black blue shadow between distant trunks, empty and calm";
const NIGHT = "deep blue-teal night, the light comes from the ground and the details, the sky is dark";
const EYE = "one eye glows a warm amber-orange ember, the only warm colour in the image";

export const DIRECTIONS = {
  // A: painterly, the forest is wired.
  a: [
    `Painterly digital illustration of an old night forest, gnarled trunks and roots framing the scene, ${NIGHT}, soft cool light glowing up from moss and grass, thin pale-cyan circuit traces running along the bark and through the roots like veins, mist between the trees. On the right, a dark wolf stands half hidden in shadow behind a trunk, only its muzzle and ${EYE}. ${LEFT}. Rich brushwork, atmospheric depth, cinematic.`,
    `Moody painted forest at night, wide view, huge twisted oak roots in the foreground on the right, faint glowing data lines etched into the bark like silver-blue wiring, luminous grass at ground level, layered mist. A wolf lies low among the roots at right, mostly silhouette, ${EYE}. ${NIGHT}. ${LEFT}. Painterly, textured, fine-art illustration.`,
    `Fine-art digital painting, a misty night woodland seen from low down, roots and fallen leaves lit by a soft teal glow from the ground, slender lines of light branching through the roots like a circuit board grown from wood. The head of a wolf emerges from darkness at upper right, fur painted in loose strokes, ${EYE}. ${NIGHT}. ${LEFT}.`,
    `Storybook-quality painted night forest, tall dark trunks receding into blue mist, a path of faintly glowing moss, pale cyan circuit patterns in the tree bark catching the light, tiny drifting motes. A wolf watching from the right edge, body in shadow, ${EYE}. ${LEFT}. Painterly, deep atmosphere, ${NIGHT}.`,
  ],
  // B: a realistic wolf, circuit lines through the fur, ember eye.
  b: [
    `Photorealistic close portrait of a grey wolf on the right side of the frame, three-quarter view facing left, fine glowing pale-blue circuit lines traced through the fur along the brow, cheek and neck like engraved wiring, ${EYE}. Behind it a misty blue night forest with soft bokeh, a few tiny warm sparks drifting. ${LEFT}. Natural fur detail, shallow depth of field, cinematic lighting.`,
    `Realistic wolf head and shoulders at upper right, looking out of the frame to the left, thin luminous white-blue circuit traces flowing with the direction of the fur, ${EYE}. Blue-teal forest at night behind, fog and out-of-focus trunks, a few small floating embers. ${LEFT}. High detail wildlife photography look, dark and quiet.`,
    `Wildlife photograph style, a wolf standing among dark pines on the right, side light from below, delicate glowing circuit patterns woven through its thick winter fur, ${EYE}. Mist hangs low, tiny sparks drift up from the ground. ${NIGHT}. ${LEFT}. Realistic, restrained, premium.`,
    `Extreme detail portrait of a wolf at the right edge of a wide frame, fur rendered hair by hair, faint cool-white circuitry glowing beneath the fur on the muzzle and around the eyes, ${EYE}. Background a soft-focus misty forest in deep blue-teal. ${LEFT}. Realistic, cinematic, low key.`,
  ],
  // C (owner's pick 2026-10-18): a-wide-klein-12's setting with b-wide-klein-01's realism.
  c: [
    `Cinematic night wildlife photograph in a dense forest, tall dark trunks receding into blue fog, a pale winding dirt path glowing softly as it curves away between the trees, moss lit by a cool glow. Thin pale-cyan circuit traces are etched into the bark of the nearest trunks like glowing wiring. In the right foreground a real grey wolf, head and shoulders, three-quarter view facing left, thin luminous pale-blue circuit lines running through the fur of its brow and neck, ${EYE}. A few tiny warm sparks drift in the air. ${LEFT}. Photorealistic, fur hair by hair, shallow depth of field.`,
    `Photorealistic night forest, low camera, a soft-lit winding path leading into misty blue trees, small floating motes of light. A grey wolf stands close in the lower right corner, partly cropped by the frame, looking left down the path, fine glowing white-blue circuit patterns traced through the fur on its face, ${EYE}. Faint cyan circuitry glows in the bark of the trunk behind it. ${NIGHT}. ${LEFT}. Natural fur detail, cinematic lighting, premium.`,
    `Wide cinematic photograph, deep blue-teal night woodland, fog between straight dark trunks, a pale path winding through glowing moss toward the distance. On the right, a realistic wolf emerges from behind a tree trunk, head lowered, delicate glowing circuit lines along its brow and cheek, ${EYE}. The tree trunk carries thin cyan circuit traces. Tiny amber sparks drift up. ${LEFT}. Shot on a full-frame camera, shallow depth of field.`,
    `Moody night wildlife photography, a forest path lit by soft cool light from the ground, misty blue forest beyond with soft bokeh. In the right third of the frame, a close realistic grey wolf in profile facing left, ears up, luminous pale-blue circuitry flowing with the fur on its forehead and neck, ${EYE}, a few warm sparks floating near it. Faint glowing circuit marks in the bark of nearby trunks. ${LEFT}. Highly detailed, restrained, cinematic.`,
  ],
};

// Wide master and a portrait cut composed for phones (multiples of 16).
export const SIZES = {
  wide: { width: 1536, height: 864 },
  tall: { width: 864, height: 1536 },
};
