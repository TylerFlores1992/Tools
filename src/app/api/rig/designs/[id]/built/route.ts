import { markBuilt, rigStoreReady } from "@/lib/rig/store";
import { noStore, rigTokenOk } from "@/lib/rig/token";

/** The connector reports a finished build; the phone then shows "Built". Bearer `RIG_TOKEN`. */
export async function POST(req: Request, ctx: RouteContext<"/api/rig/designs/[id]/built">) {
  if (!rigTokenOk(req)) return noStore({ error: "unauthorized" }, 401);
  if (!rigStoreReady()) return noStore({ error: "not configured" }, 503);
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { approvedAt?: unknown };
  const approvedAt = typeof body.approvedAt === "string" && !Number.isNaN(Date.parse(body.approvedAt)) ? body.approvedAt : null;
  try {
    return (await markBuilt(id, approvedAt)) ? noStore({ ok: true }) : noStore({ error: "not this approval: it was edited or approved again since" }, 409);
  } catch {
    return noStore({ error: "couldn't reach the database" }, 503);
  }
}
