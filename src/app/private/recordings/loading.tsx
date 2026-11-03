import { PageLoading } from "@/components/PageLoading";
import { RecordingsShell } from "@/tools/recordings/ui/RecordingsShell";

/** Shown at once while the page asks the home DVR, which can take several seconds. */
export default function Loading() {
  return (
    <RecordingsShell>
      <PageLoading label="Asking the DVR at home…" />
    </RecordingsShell>
  );
}
