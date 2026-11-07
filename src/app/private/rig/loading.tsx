import { PageLoading } from "@/components/PageLoading";
import { SiteHeader } from "@/components/SiteHeader";

/** Shown the moment Rig Planner is tapped, while saved designs load. */
export default function Loading() {
  return (
    <>
      <SiteHeader current="/private" />
      <main id="main" className="mx-auto max-w-[1440px] px-4 pt-6 sm:px-8">
        <PageLoading label="Loading…" />
      </main>
    </>
  );
}
