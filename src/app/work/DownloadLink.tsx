"use client";

import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/Button";

/**
 * A download link that says it worked. A plain <a download> (so it works with JavaScript off,
 * and saves the file instead of leaving the page); after a click the label reads "Download
 * started ✓" for a few seconds. It can't know when the file finishes, so it never claims that.
 */
export function DownloadLink({ href, filename, label, variant = "quiet", className }: {
  href: string; filename: string; label: string; variant?: "primary" | "quiet" | "ghost"; className?: string;
}) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setStarted(false), 3000);
    return () => clearTimeout(t);
  }, [started]);
  return (
    <>
      <a href={href} download={filename} onClick={() => setStarted(true)} className={buttonClasses(variant, className)}>
        {/* Both labels share one cell, so the button keeps its width when the words swap. */}
        <span className="grid">
          <span className="col-start-1 row-start-1">{started ? <><span aria-hidden="true">✓</span> Download started</> : label}</span>
          <span aria-hidden="true" className="invisible col-start-1 row-start-1">{label}</span>
          <span aria-hidden="true" className="invisible col-start-1 row-start-1">✓ Download started</span>
        </span>
      </a>
      <span role="status" className="sr-only">{started ? "Download started." : ""}</span>
    </>
  );
}
