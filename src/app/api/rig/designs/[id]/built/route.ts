import { markBuilt, rigStoreReady } from "@/lib/rig/store";
import { noStore, rigTokenOk } from "@/lib/rig/token";

/** The connector reports a finished build; the phone then shows "Built". Bearer `RIG_TOKEN`. */
export async function POST(req: Request, ctx: RouteContext<"/api/rig/designs/[id]/built">) {
  if (!rigTokenOk(req)) return noStore({ error: "unauthorized" }, 401);
  if (!rigStoreReady()) return noStore({ error: "not configured" }, 503);
  const { id } = await ctx.params;
  try {
    return (await markBuilt(id)) ? noStore({ ok: true }) : noStore({ error: "not an approved design" }, 409);
  } catch {
    return noStore({ error: "couldn't reach the database" }, 503);
  }
}
