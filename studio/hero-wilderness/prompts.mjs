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
};

// Wide master and a portrait cut composed for phones (multiples of 16).
export const SIZES = {
  wide: { width: 1536, height: 864 },
  tall: { width: 864, height: 1536 },
};
