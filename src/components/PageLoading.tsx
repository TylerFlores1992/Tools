import { cx } from "./cx";
import { Spinner } from "./Spinner";

/**
 * What a slow page shows the moment you tap through to it, so the tap never looks ignored. The
 * shapes hint at a page (a heading, then cards) without pretending to be its content; the words
 * say what is happening. Used by the `loading.tsx` files under /private, inside each app's shell.
 */
export function PageLoading({ label = "Loading…", cards = 3, className }: { label?: string; cards?: number; className?: string }) {
  return (
    <div className={className}>
      <p role="status" className="inline-flex items-center gap-2 text-small text-ink-2">
        <Spinner />
        {label}
      </p>
      <div aria-hidden="true" className="mt-6 space-y-4">
        <div className="h-8 w-[min(22rem,70%)] animate-pulse rounded-tag bg-surface-2 motion-reduce:animate-none" />
        <div className={cx("grid gap-4", cards > 1 && "sm:grid-cols-2", cards > 2 && "lg:grid-cols-3")}>
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-card border border-line bg-surface motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    </div>
  );
}
