import { PageLoading } from "@/components/PageLoading";
import { MailShell } from "@/tools/mail/ui/MailShell";

/** Shown the moment a Mail tab or link is tapped, while the page reads the database. */
export default function Loading() {
  return (
    <MailShell>
      <PageLoading label="Loading your mail…" />
    </MailShell>
  );
}
