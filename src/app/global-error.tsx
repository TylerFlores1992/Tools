"use client";

/**
 * The last resort, when the root layout itself fails, so nothing of the site's frame can render.
 * It must bring its own <html> and <body>; the site's fonts and tokens may be missing, so it keeps
 * to plain system styling.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#05070e", color: "#e8ecf4", fontFamily: "system-ui, sans-serif" }}>
        <main role="alert" style={{ maxWidth: "36rem", padding: "2rem" }}>
          <h1 style={{ fontWeight: 400, fontSize: "2rem", margin: 0 }}>That didn’t load.</h1>
          <p style={{ marginTop: "1rem", lineHeight: 1.5 }}>Something went wrong on our side. Try again in a moment.</p>
          <button type="button" onClick={() => retry()} style={{ marginTop: "1.5rem", minHeight: "44px", padding: "0 1.25rem", borderRadius: "14px", border: "1px solid #3a4258", background: "#e8ecf4", color: "#05070e", font: "inherit", cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
