import { cx } from "./cx";

/**
 * Press feedback for anything tappable that isn't a <Button> (Buttons already squeeze). Phones
 * have no hover, so without this a tap shows nothing until the next screen arrives.
 *
 * - `PRESS`: a small squeeze, for chips, pills, tabs and options. Same scale as Button.
 * - `PRESS_ROW`: a gentler squeeze, for wide rows and cards, where 2% would jump.
 * - `PRESS_FILL`: the raised fill while held. Only on things that aren't already filled
 *   (a selected chip in `primary` keeps its fill, or its label would lose contrast).
 *
 * With reduced motion the squeeze is dropped; the fill still shows the press.
 * Written through cx() so src/design/tokens.test.mts checks every class generates CSS.
 */
export const PRESS = cx("active:scale-[0.98] motion-reduce:active:scale-100");
export const PRESS_ROW = cx("active:scale-[0.995] motion-reduce:active:scale-100");
export const PRESS_FILL = cx("active:bg-surface-2");
