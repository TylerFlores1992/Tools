import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { requirePrivate } from "@/lib/money/guard";
import { getRig, listRigs, rigStoreReady } from "@/lib/rig/store";
import { RigPlanner, type RigActions } from "@/tools/rig/ui/RigPlanner";
import { approve, chat, remove, save } from "./actions";

// Private (src/proxy.ts) and never indexed. Designs live in the `rig` schema (docs/RIG.md).
export const metadata: Metadata = {
  title: "Rig Planner",
  description: "Design truss rigs on the phone, then build them in Vectorworks.",
  robots: { index: false, follow: false },
};

type Search = Promise<{ id?: string }>;

const actions: RigActions = { chat, save, approve, remove };

export default async function RigPage({ searchParams }: { searchParams: Search }) {
  await requirePrivate("/private/rig");
  const { id } = await searchParams;
  const ready = rigStoreReady();
  const [saved, opened] = ready ? [await listRigs(), id ? await getRig(id).catch(() => null) : null] : [null, null];
  return (
    <>
      <SiteHeader current="/private" />
      <main id="main" className="mx-auto max-w-[1440px] px-4 pt-3 sm:px-8 sm:pt-6">
        <nav aria-label="Breadcrumb" className="flex items-baseline justify-between gap-3 text-small text-muted">
          <span>
            <Link href="/private" className="rounded-tag underline-offset-4 hover:text-ink hover:underline">Private</Link>
            <span aria-hidden="true" className="px-2">/</span>
            <span className="text-ink-2">Rig Planner</span>
          </span>
        </nav>
        <h1 className="sr-only">Rig Planner</h1>
        <div className="mt-3">
          <RigPlanner
            actions={actions}
            storeReady={ready && saved !== null}
            saved={saved?.map((r) => ({ id: r.id, name: r.name, status: r.status, updatedAt: r.updatedAt, design: r.design })) ?? null}
            initial={opened ? { id: opened.id, design: opened.design, status: opened.status } : null}
          />
        </div>
      </main>
    </>
  );
}
