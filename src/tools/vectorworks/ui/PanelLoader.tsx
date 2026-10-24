"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/Card";

// The panel reads this browser's pairing (URL hash, localStorage) as it first renders, so it
// only ever renders in the browser: nothing to prerender, nothing to mismatch on hydration.
export const PanelLoader = dynamic(() => import("./VectorworksPanel").then((m) => m.VectorworksPanel), {
  ssr: false,
  loading: () => (
    <Card>
      <p className="text-body text-ink-2">Looking for the connector…</p>
    </Card>
  ),
});
