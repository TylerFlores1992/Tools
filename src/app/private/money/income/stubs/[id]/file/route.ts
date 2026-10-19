import { cookies } from "next/headers";
import { getStubFile } from "@/lib/money/income/store";
import { SESSION_COOKIE, verifySession } from "@/lib/private-auth";

/** The stub's photo or PDF, for the review screen. Private (proxy + this check), never cached. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySession(token, process.env.LAB_PASSWORD)) return new Response("This area is private.", { status: 401 });
  const { id } = await ctx.params;
  const file = await getStubFile(id);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      "Content-Disposition": "inline",
      // An uploaded PDF is shown in the browser's viewer: nothing in it may run on this origin.
      ...(file.mime === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
    },
  });
}
