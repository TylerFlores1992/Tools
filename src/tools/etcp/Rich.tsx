import { Fragment } from "react";
import { parseInline } from "./cards";
import { cx } from "@/components/cx";

/** One line of study text with **bold** and ~sub~ marks. */
export function RichLine({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((r, i) =>
        r.bold ? <strong key={i} className="font-semibold text-ink">{r.text}</strong> : r.sub ? <sub key={i}>{r.text}</sub> : <Fragment key={i}>{r.text}</Fragment>,
      )}
    </>
  );
}

/** Multi-line study text: blank lines start a new paragraph, single breaks stay as line breaks. */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx("space-y-3", className)}>
      {text.split("\n\n").map((para, i) => (
        <p key={i}>
          {para.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              <RichLine text={line} />
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
