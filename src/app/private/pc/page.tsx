import type { Metadata } from "next";
import { State } from "@/components/State";
import { requirePrivate } from "@/lib/money/guard";
import { waker, type PcStatus } from "@/lib/pc/waker";
import { PcPanel } from "@/tools/pc/ui/PcPanel";
import { PcShell } from "@/tools/pc/ui/PcShell";

export const metadata: Metadata = {
  title: "Home PC",
  description: "Wake the main PC so Vectorworks can work while you're away.",
  robots: { index: false, follow: false },
};

export default async function PcPage() {
  await requirePrivate("/private/pc");
  const r = await waker<PcStatus>("status");
  return (
    <PcShell>
      {r.ok ? (
        <PcPanel initialAwake={r.data.awake} />
      ) : r.reason === "not-configured" ? (
        <>
          <State kind="note">The PC waker isn&rsquo;t set up yet.</State>
          <p className="mt-3 text-small text-ink-2">
            Setup is in <code className="font-mono">connectors/pc-waker/README.md</code>: BIOS, one script on the PC, one on the home server, then <code className="font-mono">PC_WAKER_URL</code> and <code className="font-mono">PC_WAKER_TOKEN</code> in Vercel.
          </p>
        </>
      ) : (
        <State kind="wrong">{r.message}</State>
      )}
    </PcShell>
  );
}
