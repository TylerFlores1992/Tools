import { PageLoading } from "@/components/PageLoading";
import { LearnShell } from "@/tools/learn/ui/LearnShell";

/** A lesson has no tabs, so its loading state doesn't show them either. */
export default function Loading() {
  return (
    <LearnShell current={null} crumb="Lesson">
      <PageLoading label="Opening the lesson…" cards={1} />
    </LearnShell>
  );
}
