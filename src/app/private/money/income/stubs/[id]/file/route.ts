import { cookies } from "next/headers";
import { getStubFile } from "@/lib/money/income/store";
import { SESSION_COOKIE, verifySession } from "@/lib/private-auth";

/** The only types an upload may be (income/actions.ts), and the file name each is shown under. */
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

/** The stub's photo or PDF, for the review screen. Private (proxy + this check), never cached. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySession(token, process.env.LAB_PASSWORD)) return new Response("This area is private.", { status: 401 });
  const { id } = await ctx.params;
  let file: Awaited<ReturnType<typeof getStubFile>>;
  try {
    file = await getStubFile(id);
  } catch (e) {
    console.error("money stub file failed", e instanceof Error ? e.name : "unknown");
    return new Response("Couldn’t reach the money database. Try again in a minute.", { status: 503, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (!file) return new Response("Not found", { status: 404 });
  // A type outside the upload list is sent as plain bytes to download, never rendered.
  const ext = EXT[file.mime];
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": ext ? file.mime : "application/octet-stream",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      // The browser must use the type above, never guess one from the bytes (an "image" that is HTML).
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": ext ? `inline; filename="stub.${ext}"` : 'attachment; filename="stub"',
      // An uploaded PDF is shown in the browser's viewer: nothing in it may run on this origin.
      ...(file.mime === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
    },
  });
}
