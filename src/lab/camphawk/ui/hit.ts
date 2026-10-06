// Ported from campsite-finder src/components/ui/hit.ts (2026-10-06): a 44px invisible tap box
// around a control drawn smaller, so the drawing stays as designed and the thumb still lands.
export const HIT_BOX =
  "before:absolute before:left-1/2 before:top-1/2 before:size-full before:min-h-11 before:min-w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']";

export const HIT_AREA = `relative ${HIT_BOX}`;
