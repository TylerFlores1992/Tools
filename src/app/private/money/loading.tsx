import { PageLoading } from "@/components/PageLoading";
import { MoneyShell } from "@/tools/money/ui/MoneyShell";

/** Shown the moment a Money tab or link is tapped, while the page reads the database. */
export default function Loading() {
  return (
    <MoneyShell>
      <PageLoading label="Loading your money…" />
    </MoneyShell>
  );
}
