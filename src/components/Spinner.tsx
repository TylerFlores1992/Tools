import { cx } from "./cx";

/**
 * A small working indicator that sits inside a button or beside a label. It takes the text's
 * colour, so it needs no contrast pair of its own. With reduced motion it stops turning and stays
 * as a ring: the words beside it ("Saving…") carry the state either way.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      className={cx("shrink-0 animate-spin motion-reduce:animate-none", className)}
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.8" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
