import type { ComponentProps } from "react";
import { cx } from "./cx";

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("rounded-card border border-line bg-surface p-5 shadow-card sm:p-6", className)} {...rest} />;
}
