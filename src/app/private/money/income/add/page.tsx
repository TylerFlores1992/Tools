import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { requirePrivate } from "@/lib/money/guard";
import { BulkUploadForm } from "@/tools/money/income/ui/IncomeForms";
import { MoneyShell } from "@/tools/money/ui/MoneyShell";

export const metadata: Metadata = {
  title: "Add stubs · Income",
  description: "Add pay stubs or W-2s, one or many.",
  robots: { index: false, follow: false },
};

// The upload action reads the document with the AI before answering (up to ~50 s).
export const maxDuration = 120;

export default async function AddStub({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requirePrivate("/private/money/income/add");
  const sp = await searchParams;
  return (
    <MoneyShell current="/private/money/income">
      <nav aria-label="Breadcrumb" className="text-small text-muted"><Link href="/private/money/income" className="underline-offset-4 hover:text-ink hover:underline">Income</Link> <span aria-hidden="true">/</span> Add</nav>
      <Label className="mt-4">Income</Label>
      <h1 className="mt-3 text-title font-normal">Add stubs or W-2s</h1>
      <p className="mt-3 max-w-[64ch] text-body text-ink-2">Pick one file or a whole year&rsquo;s worth: PDFs from the payroll sites (OneRevolution, MyCast&amp;Crew, GreenSlate and so on) or photos of paper stubs. <Link href="/private/money/income#missing" className="text-ink underline underline-offset-4">Stubs still missing</Link> lists what the bank says you were paid.</p>
      <Card className="mt-8 max-w-[640px]">
        <BulkUploadForm kind={sp.kind === "w2" ? "w2" : "stub"} />
      </Card>
    </MoneyShell>
  );
}
