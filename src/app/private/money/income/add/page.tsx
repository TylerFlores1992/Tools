import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { requirePrivate } from "@/lib/money/guard";
import { BulkUploadForm, UploadForm } from "@/tools/money/income/ui/IncomeForms";
import { MoneyShell } from "@/tools/money/ui/MoneyShell";

export const metadata: Metadata = {
  title: "Add a stub · Income",
  description: "Photograph a pay stub or W-2.",
  robots: { index: false, follow: false },
};

// The upload action reads the document with the AI before answering (up to ~50 s).
export const maxDuration = 60;

export default async function AddStub({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requirePrivate("/private/money/income/add");
  const sp = await searchParams;
  return (
    <MoneyShell current="/private/money/income">
      <nav aria-label="Breadcrumb" className="text-small text-muted"><Link href="/private/money/income" className="underline-offset-4 hover:text-ink hover:underline">Income</Link> <span aria-hidden="true">/</span> Add</nav>
      <Label className="mt-4">Income</Label>
      <h1 className="mt-3 text-title font-normal">Add a stub or W-2</h1>
      <Card className="mt-8 max-w-[640px]">
        <UploadForm kind={sp.kind === "w2" ? "w2" : "stub"} />
      </Card>
      <section aria-labelledby="bulk" className="mt-12 max-w-[640px]">
        <h2 id="bulk" className="text-h2 font-normal">Add a year&rsquo;s worth at once</h2>
        <p className="mt-2 text-body text-ink-2">Download each stub as a PDF from the payroll company&rsquo;s site (OneRevolution, MyCast&amp;Crew, GreenSlate and so on), or pick a stack of photos, and add them together. <Link href="/private/money/income#missing" className="text-ink underline underline-offset-4">Stubs still missing</Link> lists what the bank says you were paid.</p>
        <Card className="mt-5">
          <BulkUploadForm />
        </Card>
      </section>
    </MoneyShell>
  );
}
