import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { PageTransition } from "@/components/PageTransition";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { PanelLoader } from "@/tools/vectorworks/ui/PanelLoader";
import { CONNECTOR } from "@/tools/vectorworks/connector";

// Private (src/proxy.ts) and never indexed. The drawing never touches this site: the page talks
// straight to the connector on the owner's own computer (src/tools/vectorworks/client.ts).
export const metadata: Metadata = {
  title: "Vectorworks",
  description: "The open Vectorworks drawing, live from this computer.",
  robots: { index: false, follow: false },
};

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded-tag bg-surface-2 px-1.5 py-0.5 font-mono text-small text-ink [overflow-wrap:anywhere]">{children}</code>
);

export default function VectorworksPage() {
  return (
    <>
      <SiteHeader current="/private" />
      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-24 pt-4 sm:px-12 sm:pt-8 3xl:max-w-[1600px]">
        <nav aria-label="Breadcrumb" className="text-small text-muted">
          <Link href="/private" className="rounded-tag underline-offset-4 hover:text-ink hover:underline">Private</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <span className="text-ink-2">Vectorworks</span>
        </nav>
        <PageTransition>
          <div className="mt-6 max-w-[760px]">
            <Label>Connector {CONNECTOR.version}</Label>
            <h1 className="mt-3 text-title font-normal">Vectorworks</h1>
            <p className="mt-4 text-lede text-ink-2">
              The drawing open on your computer, live. Click to select, drag to move, measure anything, edit fixtures. Claude uses the same connector to draw for you.
            </p>
          </div>

          <div className="mt-8">
            <PanelLoader />
          </div>

          <section id="setup" aria-labelledby="setup-h" className="mt-12 scroll-mt-24">
            <h2 id="setup-h" className="text-h2 font-normal">Set up</h2>
            <p className="mt-2 max-w-[64ch] text-body text-ink-2">Once per computer, about ten minutes. Windows, Vectorworks {CONNECTOR.testedWith} with Spotlight.</p>
            <ol className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Step n={1} title="Install the connector">
                <p>
                  <a href={CONNECTOR.download} className="underline underline-offset-4 hover:text-ink">Download the connector</a> ({CONNECTOR.downloadLabel}), unzip it, and in that folder run:
                </p>
                <pre className="mt-3 overflow-x-auto rounded-input bg-surface-2 p-3 font-mono text-small text-ink">{`python -m venv .venv
.venv\\Scripts\\activate
pip install -e ".[windows]"
vwmcp-install-plugin`}</pre>
              </Step>
              <Step n={2} title="Add two menu commands in Vectorworks">
                <p>Tools ▸ Plug-ins ▸ Plug-in Manager ▸ Custom Plug-ins ▸ New ▸ Command. Name it <Code>MCP Run Job</Code>, set the script language to Python, and paste the first script the installer printed. Do the same for <Code>MCP Session</Code> with the second.</p>
              </Step>
              <Step n={3} title="Give MCP Run Job a shortcut">
                <p>Tools ▸ Workspaces ▸ Edit Current Workspace ▸ Menus: drag both commands into a menu, then give <Code>MCP Run Job</Code> <Code>Ctrl+Shift+Alt+M</Code>. That shortcut is how Claude and this page wake Vectorworks up.</p>
              </Step>
              <Step n={4} title="Connect Claude">
                <p>For Claude Code: <Code>claude mcp add vectorworks -- {"<folder>"}\.venv\Scripts\vwmcp.exe</Code>. For Claude Desktop, the README has the config block. Then ask Claude to “ping Vectorworks”.</p>
              </Step>
              <Step n={5} title="Pair this page">
                <p>Run <Code>vwmcp-panel</Code> and open the link it prints, in the browser you want to use. It keeps a pairing token for this browser only; the drawing goes straight from your computer to the page and never through this site.</p>
              </Step>
              <Step n={6} title="If the shortcut misbehaves">
                <p>Set <Code>VWMCP_TRIGGER=session</Code> and run <Code>MCP Session</Code> instead: a small window that answers every quarter second until you press Stop.</p>
              </Step>
            </ol>
          </section>

          <section aria-labelledby="notes-h" className="mt-12 max-w-[760px]">
            <h2 id="notes-h" className="text-h3 font-medium">Good to know</h2>
            <ul className="mt-3 grid list-disc gap-2 pl-5 text-body text-ink-2 marker:text-muted">
              <li>Working in Vectorworks? Requests wait until you let go of the mouse and pause, so they never land mid-drag.</li>
              <li>Nothing runs while a Vectorworks dialog is open, or in the first 30 seconds after it starts.</li>
              <li>Ctrl+Z in Vectorworks lumps Claude’s changes together. <b className="font-medium text-ink">Undo last change</b> here reverses them one at a time; deletes and color changes say when only Ctrl+Z can.</li>
              <li>Lengths can be typed the way you write them: <Code>12&apos;-6&quot;</Code>, <Code>6 1/2&quot;</Code>, <Code>450mm</Code>.</li>
            </ul>
          </section>
        </PageTransition>
      </main>
      <SiteFooter />
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="min-w-0">
      <Card className="h-full min-w-0">
        <p className="font-mono text-label uppercase text-muted">Step {n}</p>
        <h3 className="mt-2 text-h3 font-medium">{title}</h3>
        <div className="mt-2 grid gap-2 text-body text-ink-2">{children}</div>
      </Card>
    </li>
  );
}
