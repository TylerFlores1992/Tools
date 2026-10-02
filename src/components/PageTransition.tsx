import { ViewTransition, type ReactNode } from "react";

/**
 * Route change: old content fades out, new content rises in. Wraps page content only (inside
 * <main>), never the layout, so the header stays put. Untyped navigations (browser back,
 * refresh) don't animate. Reduced motion turns it off in globals.css.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
