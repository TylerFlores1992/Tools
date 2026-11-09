import { PageLoading } from "@/components/PageLoading";
import { PcShell } from "@/tools/pc/ui/PcShell";

/** Shown at once while the page asks the home server whether the PC answers. */
export default function Loading() {
  return (
    <PcShell>
      <PageLoading label="Asking the home server…" />
    </PcShell>
  );
}
