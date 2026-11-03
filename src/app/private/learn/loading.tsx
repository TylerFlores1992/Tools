import { PageLoading } from "@/components/PageLoading";
import { LearnShell } from "@/tools/learn/ui/LearnShell";

/** Shown the moment a Learn tab is tapped, while the page reads your progress. */
export default function Loading() {
  return (
    <LearnShell>
      <PageLoading label="Loading…" />
    </LearnShell>
  );
}
